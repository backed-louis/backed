"""Moteur de rendu des vidéos Backed (DA « Chiffres et preuves »), 1080x1920, 30 fps.

Aucune dépendance hors Pillow + ffmpeg. Les polices sont dans scripts/reels/fonts (licence OFL).
"""
import math
import os
import re
import subprocess

from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
NIGHT = (7, 8, 15)
SLATE = (20, 21, 31)
LINE = (44, 46, 62)
VIO = (139, 0, 255)
LILAS = (178, 102, 255)
OFF = (244, 242, 238)
GREY = (140, 143, 163)
GREEN = (46, 204, 113)

FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
_FILES = {"syne": "Syne.ttf", "inter": "Inter.ttf", "mono": "Mono.ttf"}
_cache = {}


def F(kind, size, weight="ExtraBold"):
    size = max(8, int(size))
    key = (kind, size, weight)
    if key not in _cache:
        f = ImageFont.truetype(os.path.join(FONT_DIR, _FILES[kind]), size)
        try:
            f.set_variation_by_name(weight)
        except Exception:
            pass
        _cache[key] = f
    return _cache[key]


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def prog(t, s, d):
    return clamp((t - s) / d)


def eo(x):
    return 1 - (1 - x) ** 3


def tsize(d, s, f):
    b = d.textbbox((0, 0), s, font=f)
    return b, b[2] - b[0], b[3] - b[1]


def fit(d, s, maxw, size, kind="syne", weight="ExtraBold"):
    f = F(kind, size, weight)
    _, w, _ = tsize(d, s, f)
    return F(kind, size * maxw / w, weight) if w > maxw else f


def text_c(d, yc, s, f, fill, alpha=1.0):
    b, w, h = tsize(d, s, f)
    d.text(((W - w) / 2 - b[0], yc - h / 2 - b[1]), s, font=f, fill=fill + (int(255 * clamp(alpha)),))


def rise(d, lt, start, yc, s, f, fill, dist=40, dur=0.3):
    p = eo(prog(lt, start, dur))
    if p > 0:
        text_c(d, yc + dist * (1 - p), s, f, fill, alpha=p)


def wrap(d, s, f, maxw):
    words, lines, cur = s.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if tsize(d, test, f)[1] <= maxw or not cur:
            cur = test
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def eur(x):
    return f"{x:,.2f}".replace(",", " ").replace(".", ",") + " €"


def bg(d):
    d.rectangle((0, 0, W, H), fill=NIGHT)


def count(lt, start, dur, target):
    return int(round(target * eo(prog(lt, start, dur))))


# ------------------------------------------------------------------ données
PCT = re.compile(r"(\d{1,2})\s?%")


def percent_of(benefit):
    """Premier pourcentage de réduction trouvé dans le texte de l'offre (5 à 90), sinon None."""
    if "jusqu" in (benefit or "").lower():  # « jusqu'à -74 % » : pas un pourcentage garanti
        return None
    for m in PCT.finditer(benefit or ""):
        v = int(m.group(1))
        if 5 <= v <= 90:
            return v
    return None


def first_clause(text, n=48):
    """Première proposition lisible d'un texte d'offre (« Un dessert offert à vie et… » → « Un dessert offert à vie »)."""
    t = " ".join((text or "").split())
    for sep in [" + ", ", ", "; ", " et ", " puis "]:
        head = t.split(sep)[0]
        if 8 <= len(head) < len(t):
            t = head
    return short(t, n)


def short(text, n):
    text = " ".join((text or "").split())
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


# ------------------------------------------------------------------ scènes
def s_price(pct):
    """Prix barré sur un panier d'exemple de 100 €, affiché comme tel."""
    before = 100.0
    after = round(before * (100 - pct) / 100, 2)
    saved = round(before - after, 2)

    def fn(img, d, lt):
        bg(d)
        rise(d, lt, 0.0, 420, "Exemple : panier de 100 €", F("inter", 40, "SemiBold"), GREY, dist=20)
        s = eur(before)
        big = lt < 0.75
        f = fit(d, s, W - 120, 230) if big else F("syne", 150)
        y = 760
        p = eo(prog(lt, 0.05, 0.3))
        text_c(d, y + 40 * (1 - p), s, f, OFF if big else GREY, alpha=p)
        sp = eo(prog(lt, 0.55, 0.25))
        if sp > 0:
            _, w2, _ = tsize(d, s, f)
            x0 = (W - w2) / 2 - 10
            d.line([(x0, y), (x0 + (w2 + 20) * sp, y)], fill=VIO if big else GREY, width=14 if big else 9)
        if not big:
            rise(d, lt, 0.8, 1010, eur(after), fit(d, eur(after), W - 100, 240), OFF, dist=50)
            q = eo(prog(lt, 1.15, 0.3))
            if q > 0:
                txt = "-" + eur(count(lt, 1.15, 0.5, int(saved * 100)) / 100)
                fg = F("syne", 96)
                _, w3, h3 = tsize(d, txt, fg)
                d.rounded_rectangle((W / 2 - w3 / 2 - 40, 1230 - h3 / 2 - 30, W / 2 + w3 / 2 + 40, 1230 + h3 / 2 + 30),
                                    radius=40, fill=(20, 60, 38, int(255 * q)))
                text_c(d, 1230, txt, fg, GREEN, alpha=q)
                rise(d, lt, 1.3, 1370, "économisés", F("inter", 44, "SemiBold"), GREEN, dist=20)
    return fn


def s_statement(lines, sub=None):
    def fn(img, d, lt):
        bg(d)
        fonts = [fit(d, l, W - 140, 140) for l in lines]
        m = min(f.size for f in fonts)
        n = len(lines)
        for i, l in enumerate(lines):
            y = H / 2 - 60 + (i - (n - 1) / 2) * m * 1.2
            col = LILAS if (i == n - 1 and n > 1) else OFF
            rise(d, lt, i * 0.15, y, l, F("syne", m), col)
        if sub:
            rise(d, lt, 0.4, H / 2 + n * m * 0.6 + 40, sub, F("inter", 42, "SemiBold"), GREY, dist=20)
    return fn


def s_benefit(benefit):
    """Ouverture quand l'offre n'a pas de pourcentage : le texte de l'offre en grand."""
    def fn(img, d, lt):
        bg(d)
        f = F("syne", 104)
        lines = wrap(d, first_clause(benefit), f, W - 160)[:3]
        n = len(lines)
        for i, l in enumerate(lines):
            y = H / 2 - 60 + (i - (n - 1) / 2) * 130
            rise(d, lt, i * 0.12, y, l, fit(d, l, W - 140, 104), LILAS if i == n - 1 else OFF)
    return fn


def draw_card(img, lt, start, o, yc, copy_at=None):
    p = eo(prog(lt, start, 0.35))
    if p <= 0:
        return
    cw, ch = 920, 560
    c = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    d.rounded_rectangle((0, 0, cw - 1, ch - 1), radius=40, fill=SLATE, outline=LINE, width=3)
    disc = o.get("disc") or ""
    dw = tsize(d, disc, F("syne", 110))[1] + 40 if disc else 0
    if disc:
        fd = F("syne", 110)
        b, w, _ = tsize(d, disc, fd)
        d.text((cw - 50 - w - b[0], 46 - b[1]), disc, font=fd, fill=LILAS)
    d.text((50, 46), o["brand"], font=fit(d, o["brand"], cw - 100 - dw, 72), fill=OFF)
    if o.get("creator"):
        d.text((50, 140), "via " + o["creator"], font=fit(d, "via " + o["creator"], cw - 100, 36, "inter", "Medium"), fill=GREY)
    if o.get("detail"):
        det = short(o["detail"], 48)
        d.text((50, 200), det, font=fit(d, det, cw - 100, 36, "inter", "SemiBold"), fill=OFF)
    d.rounded_rectangle((50, 280, cw - 50, 400), radius=20, fill=NIGHT, outline=LINE, width=2)
    code = o["code"] or "Lien direct"
    fm = fit(d, code, cw - 180, 72, "mono", "Bold")
    b, w, h = tsize(d, code, fm)
    d.text((90 - b[0], 340 - h / 2 - b[1]), code, font=fm, fill=OFF)
    copied = copy_at is not None and lt >= copy_at
    d.rounded_rectangle((50, 430, cw - 50, 515), radius=42, fill=GREEN if copied else VIO)
    lbl = "Copié" if copied else "Copier le code"
    fb = F("inter", 42, "Bold")
    b, w, h = tsize(d, lbl, fb)
    d.text((cw / 2 - w / 2 - b[0], 472 - h / 2 - b[1]), lbl, font=fb, fill=OFF)
    sc = 0.94 + 0.06 * p
    if copied:
        sc *= 1 + 0.03 * math.exp(-(lt - copy_at) * 10)
    c = c.resize((int(cw * sc), int(ch * sc)), Image.BICUBIC)
    c.putalpha(c.getchannel("A").point(lambda v: int(v * p)))
    img.alpha_composite(c, (int(W / 2 - c.width / 2), int(yc - c.height / 2 + 60 * (1 - p))))


def s_card(o, title):
    def fn(img, d, lt):
        bg(d)
        rise(d, lt, 0.0, 420, title, fit(d, title, W - 140, 96), OFF)
        draw_card(img, lt, 0.2, o, 960, copy_at=1.4)
    return fn


def s_top(items):
    def fn(img, d, lt):
        bg(d)
        rise(d, lt, 0.0, 260, f"{len(items)} codes.", F("syne", 120), OFF)
        sub = "Les plus copiés cette semaine."
        rise(d, lt, 0.12, 390, sub, fit(d, sub, W - 160, 60, "syne", "Bold"), LILAS)
        for i, o in enumerate(items):
            y = 640 + i * 360
            p = eo(prog(lt, 0.4 + i * 0.3, 0.3))
            if p <= 0:
                continue
            x0, a = 90 + 80 * (1 - p), int(255 * p)
            d.rounded_rectangle((x0, y, x0 + 900, y + 300), radius=36, fill=SLATE + (a,), outline=LINE + (a,), width=3)
            d.text((x0 + 50, y + 40), str(i + 1), font=F("syne", 110), fill=LILAS + (a,))
            d.text((x0 + 200, y + 48), o["brand"], font=fit(d, o["brand"], 330, 60), fill=OFF + (a,))
            code = o["code"] or "Lien direct"
            d.text((x0 + 200, y + 130), code, font=fit(d, code, 620, 56, "mono", "Bold"), fill=OFF + (a,))
            if o.get("creator"):
                d.text((x0 + 200, y + 215), "via " + o["creator"], font=fit(d, "via " + o["creator"], 620, 34, "inter", "Medium"), fill=GREY + (a,))
            if o.get("disc"):
                fd = F("syne", 70)
                b, w, _ = tsize(d, o["disc"], fd)
                d.text((x0 + 860 - w - b[0], y + 50), o["disc"], font=fd, fill=GREEN + (a,))
    return fn


def s_end(proof):
    def fn(img, d, lt):
        bg(d)
        rise(d, lt, 0.0, 760, "Backed.", fit(d, "Backed.", W - 160, 200), OFF)
        rise(d, lt, 0.2, 940, "Paie le bon prix.", fit(d, "Paie le bon prix.", W - 140, 100), LILAS)
        p = eo(prog(lt, 0.5, 0.3))
        if p > 0:
            d.rounded_rectangle((W / 2 - 300, 1120, W / 2 + 300, 1250), radius=65, fill=VIO + (int(255 * p),))
            text_c(d, 1185, "backed.fr", F("inter", 60, "Bold"), OFF, alpha=p)
        rise(d, lt, 0.8, 1380, proof, fit(d, proof, W - 140, 38, "inter", "Medium"), GREY, dist=15)
        rise(d, lt, 0.9, 1440, "Gratuit · sans compte", F("inter", 38, "Medium"), GREY, dist=15)
    return fn


# ------------------------------------------------------------------ montage
def offer_shots(o, proof):
    """Une vidéo « Code du jour » pour une offre."""
    pct = o.get("pct")
    if pct:
        opening = (1.9, s_price(pct))
        title = f"{o['brand']}, -{pct} %."
    else:
        opening = (1.6, s_benefit(o.get("benefit") or o["brand"]))
        title = f"Le code de {o['creator']}." if o.get("creator") else f"Code {o['brand']}."
    return [opening, (2.4, s_card(o, title)), (2.2, s_end(proof))]


def top_shots(items, proof):
    return [(3.0, s_top(items)), (2.2, s_end(proof))]


def render(shots, t):
    img = Image.new("RGBA", (W, H), NIGHT + (255,))
    d = ImageDraw.Draw(img, "RGBA")
    t0, cut = 0.0, 9
    for dur, fn in shots:
        if t < t0 + dur:
            fn(img, d, t - t0)
            cut = t - t0
            break
        t0 += dur
    else:
        dur, fn = shots[-1]
        fn(img, d, dur)
    zoom = 1.0 + 0.035 * math.exp(-cut * 10)
    cw, ch = W / zoom, H / zoom
    return img.convert("RGB").resize((W, H), Image.BILINEAR, box=((W - cw) / 2, (H - ch) / 2, (W + cw) / 2, (H + ch) / 2))


def encode(shots, path):
    dur = sum(d for d, _ in shots)
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                          "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                          "-crf", "20", "-preset", "fast", "-movflags", "+faststart", path], stdin=subprocess.PIPE)
    for i in range(int(dur * FPS)):
        p.stdin.write(render(shots, i / FPS).tobytes())
    p.stdin.close()
    if p.wait() != 0:
        raise RuntimeError(f"ffmpeg a échoué pour {path}")
    return dur
