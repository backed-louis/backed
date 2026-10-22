"""Moteur de rendu des vidéos Backed (DA « Chiffres et preuves »), 1080x1920, 30 fps.

Dépendances : Pillow + ffmpeg (et numpy + scipy pour la musique, voir musique.py). Les polices sont dans scripts/reels/fonts (licence OFL).
"""
import math
import os
import re
import subprocess

from PIL import Image, ImageDraw, ImageFilter, ImageFont

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
    img.paste(c, (int(W / 2 - c.width / 2), int(yc - c.height / 2 + 60 * (1 - p))), c)


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
        rise(d, lt, 0.6, 1600, "Abonne-toi : un code chaque jour.", fit(d, "Abonne-toi : un code chaque jour.", W - 140, 52, "inter", "Bold"), OFF, dist=15)
    return fn


# ------------------------------------------------------------------ nouveau format (accroche dès la 1re image)
def eob(x, k=1.8):
    """Arrivée avec léger rebond."""
    return 1 + (k + 1) * (x - 1) ** 3 + k * (x - 1) ** 2


def s_hook(o):
    """1re image pleine et lisible tout de suite : le créateur, le gain, la marque. Aucun fondu d'entrée."""
    who = f"Le code de {o['creator']}" if o.get("creator") else f"Code promo {o['brand']}"
    gain = f"{o['disc']} chez {o['brand']}" if o.get("disc") else first_clause(o.get("benefit") or o["brand"], 34)

    def fn(img, d, lt):
        bg(d)
        text_c(d, 520, "CODE DU JOUR", F("inter", 40, "Bold"), GREY)
        fw = fit(d, who, W - 140, 120)
        lines = wrap(d, who, F("syne", 112), W - 140) if tsize(d, who, F("syne", 112))[1] > W - 140 else [who]
        fw = fit(d, max(lines, key=len), W - 140, 112)
        y = 720
        for ln in lines:
            text_c(d, y, ln, fw, OFF)
            y += int(fw.size * 1.1)
        fg = fit(d, gain, W - 140, 104)
        text_c(d, y + 70, gain, fg, LILAS)
        # soulignement qui se trace sous le gain
        gw = tsize(d, gain, fg)[1]
        u = eo(prog(lt, 0.15, 0.45))
        d.rounded_rectangle((W / 2 - gw / 2, y + 150, W / 2 - gw / 2 + gw * u, y + 162), radius=6, fill=VIO)
        if o.get("detail") and o.get("disc"):
            det = short(o["detail"], 44)
            text_c(d, y + 240, det, fit(d, det, W - 160, 44, "inter", "SemiBold"), GREY)
        a = 0.55 + 0.45 * abs(math.sin(lt * 4))
        text_c(d, 1560, "Le code arrive ↓", F("inter", 46, "Bold"), OFF, alpha=a)
    return fn


def s_code(o):
    """La carte du code, copiée tout de suite."""
    title = short(o.get("detail") or o.get("benefit") or o["brand"], 40)

    def fn(img, d, lt):
        bg(d)
        text_c(d, 420, title, fit(d, title, W - 140, 72, "syne", "Bold"), OFF)
        draw_card(img, lt, 0.0, o, 960, copy_at=0.9)
        if lt > 0.9:
            rise(d, lt, 0.95, 1420, "Copié. Tu paies le bon prix.", F("inter", 46, "SemiBold"), GREEN, dist=20)
    return fn


def s_top_hook(items):
    def fn(img, d, lt):
        bg(d)
        text_c(d, 520, "LA SÉLECTION DE LA SEMAINE", F("inter", 40, "Bold"), GREY)
        text_c(d, 760, f"{len(items)} codes", F("syne", 190), OFF)
        text_c(d, 950, "à garder.", fit(d, "à garder.", W - 160, 130), LILAS)
        names = " · ".join(o["brand"] for o in items)
        text_c(d, 1160, names, fit(d, names, W - 160, 58, "inter", "Bold"), OFF)
        a = 0.55 + 0.45 * abs(math.sin(lt * 4))
        text_c(d, 1560, "Enregistre pour plus tard ↓", F("inter", 46, "Bold"), OFF, alpha=a)
    return fn


# ------------------------------------------------------------------ outro : le logo se tape dans la barre de recherche
OUTRO_DUR = 3.4
TYPE_T0, TYPE_DT = 0.20, 0.085          # frappe : une lettre toutes les 85 ms
DOT_T = TYPE_T0 + 6 * TYPE_DT + 0.06    # point violet = 1re note de la signature sonore
PULSE_T = DOT_T + 0.17                  # le point respire = 2e note
TXT_T = PULSE_T + 0.45                  # les textes n'arrivent qu'après l'animation du logo
LOGO_Y = 860
_glow = None


def _glow_layer():
    global _glow
    if _glow is None:
        g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(g).ellipse((W / 2 - 520, LOGO_Y - 300, W / 2 + 520, LOGO_Y + 300), fill=VIO + (150,))
        _glow = g.filter(ImageFilter.GaussianBlur(140))
    return _glow


def s_outro():
    def fn(img, d, lt):
        bg(d)
        pulse = 0.35 + 0.25 * eo(prog(lt, 0.0, 0.6)) + 0.4 * eo(prog(lt, DOT_T, 0.15)) * (1 - prog(lt, DOT_T + 0.15, 0.8))
        gl = _glow_layer().copy()
        gl.putalpha(gl.getchannel("A").point(lambda v: int(v * clamp(pulse))))
        img.paste(gl, (0, 0), gl)
        # rectangle de la barre de recherche
        a_in = eob(prog(lt, 0.0, 0.32))
        yc = LOGO_Y + 120 * (1 - clamp(a_in))
        sc = 0.92 + 0.08 * a_in
        x0, x1 = W / 2 - (W / 2 - 90) * sc, W / 2 + (W / 2 - 90) * sc
        y0, y1 = yc - 115 * sc, yc + 115 * sc
        A = int(255 * clamp(a_in))
        d.rounded_rectangle((x0, y0, x1, y1), radius=int(70 * sc), fill=SLATE + (A,), outline=VIO + (A,), width=5)
        mx, my, mr = x0 + 95 * sc, yc - 8, 30 * sc
        d.ellipse((mx - mr, my - mr, mx + mr, my + mr), outline=GREY + (A,), width=int(8 * sc))
        d.line((mx + mr * 0.7, my + mr * 0.7, mx + mr * 1.5, my + mr * 1.5), fill=GREY + (A,), width=int(9 * sc))
        # « Backed » se tape, lettre par lettre
        f = fit(d, "Backed.", (W - 180) - 330, 170)
        word = "Backed"
        tx = x0 + 165 * sc
        for i, ch in enumerate(word):
            p = prog(lt, TYPE_T0 + i * TYPE_DT, 0.12)
            if p <= 0:
                break
            pre = word[:i]
            bx = tx + (tsize(d, pre, f)[1] if pre else 0)
            fl = F("syne", f.size * (1.35 - 0.35 * eo(p)))
            b, w, h = tsize(d, ch, fl)
            d.text((bx - b[0] - (w - tsize(d, ch, f)[1]) / 2, yc - h / 2 - b[1] - 6), ch, font=fl, fill=OFF + (int(255 * clamp(p * 1.5)),))
        wfull = tsize(d, word, f)[1]
        r = f.size * 0.105
        dx, dy = tx + wfull + f.size * 0.03 + r, yc + tsize(d, "B", f)[2] / 2 - r * 1.05 - 6
        pd = prog(lt, DOT_T, 0.3)
        if pd > 0.001:
            rr = r * eob(pd, 2.4) * (1 + 0.22 * math.sin(math.pi * prog(lt, PULSE_T, 0.25)))
            d.ellipse((dx - rr, dy - rr, dx + rr, dy + rr), fill=VIO + (255,))
            for t_, amp in ((DOT_T, 5.0), (PULSE_T, 3.2)):
                rp = prog(lt, t_, 0.45)
                if 0 < rp < 1:
                    R = r * (1 + amp * eo(rp))
                    d.ellipse((dx - R, dy - R, dx + R, dy + R), outline=LILAS + (int(220 * (1 - rp)),), width=6)
            sp = prog(lt, DOT_T, 0.4)
            if 0 < sp < 1:
                for k in range(10):
                    ang = k * 2 * math.pi / 10 + 0.3
                    dist = r * (1.5 + 6 * eo(sp))
                    q = 9 * (1 - sp)
                    cx, cy = dx + math.cos(ang) * dist, dy + math.sin(ang) * dist
                    d.rectangle((cx - q, cy - q, cx + q, cy + q), fill=(LILAS if k % 2 else VIO) + (int(255 * (1 - sp)),))
        if lt > TYPE_T0 - 0.05:
            n = min(6, int(max(0, lt - TYPE_T0) / TYPE_DT) + 1)
            cx = tx + (tsize(d, word[:n], f)[1] if lt < DOT_T else wfull + f.size * 0.03 + 2 * r) + 16
            ca = 1 - prog(lt, PULSE_T + 0.15, 0.2)
            if ca > 0 and (lt < DOT_T or int(lt * 3.2) % 2 == 0):
                d.rounded_rectangle((cx, yc - 62, cx + 10, yc + 50), radius=4, fill=VIO + (int(A * ca),))
        # textes, après le logo
        pc = eob(prog(lt, TXT_T, 0.3))
        if pc > 0.02:
            lab = "✓ Code appliqué"
            fc = F("inter", 44, "Bold")
            b, w, h = tsize(d, lab, fc)
            cw = (w + 70) * clamp(pc, 0, 1.2)
            cy = y1 + 95
            d.rounded_rectangle((W / 2 - cw / 2, cy - 46, W / 2 + cw / 2, cy + 46), radius=46, fill=(16, 52, 33), outline=GREEN, width=3)
            if pc > 0.6:
                text_c(d, cy, lab, fc, GREEN, alpha=prog(lt, TXT_T + 0.1, 0.15))
        t0 = TXT_T + 0.25
        rise(d, lt, t0, 1215, "Paie le bon prix.", fit(d, "Paie le bon prix.", W - 160, 96), LILAS, dist=30, dur=0.35)
        p = eob(prog(lt, t0 + 0.2, 0.35))
        if p > 0.02:
            pw = 290 * clamp(p, 0, 1.15)
            pill = (W / 2 - pw, 1300, W / 2 + pw, 1420)
            d.rounded_rectangle(pill, radius=60, fill=VIO)
            text_c(d, 1360, "backed.fr", F("inter", 58, "Bold"), OFF, alpha=prog(lt, t0 + 0.3, 0.15))
            sh = prog(lt, t0 + 0.55, 0.5)
            if 0 < sh < 1:
                layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                bx = pill[0] - 120 + (pill[2] - pill[0] + 240) * sh
                ImageDraw.Draw(layer).polygon([(bx, 1300), (bx + 60, 1300), (bx + 10, 1420), (bx - 50, 1420)], fill=(255, 255, 255, 90))
                mask = Image.new("L", (W, H), 0)
                ImageDraw.Draw(mask).rounded_rectangle(pill, radius=60, fill=255)
                layer.putalpha(Image.composite(layer.getchannel("A"), Image.new("L", (W, H), 0), mask))
                img.paste(layer, (0, 0), layer)
        cta = "Abonne-toi : un code chaque jour."
        rise(d, lt, t0 + 0.45, 1600, cta, fit(d, cta, W - 160, 54, "inter", "Bold"), OFF, dist=20, dur=0.35)
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
    # Nouveau format (oct. 2026) : accroche pleine dès la 1re image, carte du code, outro logo.
    return [(1.6, s_hook(o)), (2.2, s_code(o)), (OUTRO_DUR, s_outro())]


def top_shots(items, proof):
    return [(1.5, s_top_hook(items)), (2.8, s_top(items)), (OUTRO_DUR, s_outro())]


def render(shots, t):
    img = Image.new("RGB", (W, H), NIGHT)
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


def encode(shots, path, variante=None):
    """Encode la vidéo. Avec `variante` (0 à 3), ajoute la musique Backed et la signature sonore (musique.py)."""
    dur = sum(d for d, _ in shots)
    video_path = path if variante is None else path + ".video.mp4"
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                          "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                          "-crf", "20", "-preset", "fast", "-movflags", "+faststart", video_path], stdin=subprocess.PIPE)
    for i in range(int(dur * FPS)):
        p.stdin.write(render(shots, i / FPS).tobytes())
    p.stdin.close()
    if p.wait() != 0:
        raise RuntimeError(f"ffmpeg a échoué pour {path}")
    if variante is not None:
        import itertools
        import musique  # numpy + scipy, seulement si on ajoute le son
        cuts = list(itertools.accumulate(d for d, _ in shots))[:-1]
        outro_start = cuts[-1] if cuts else 0
        wav = path + ".wav"
        musique.make_music(wav, dur, cuts, variante, sig_at=outro_start + DOT_T,
                           clicks=[outro_start + TYPE_T0 + i * TYPE_DT for i in range(6)])
        r = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", video_path, "-i", wav, "-map", "0:v", "-map", "1:a",
                            "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=7", "-c:a", "aac", "-b:a", "192k",
                            "-ar", "44100", "-shortest", "-movflags", "+faststart", path])
        os.remove(video_path)
        os.remove(wav)
        if r.returncode != 0:
            raise RuntimeError(f"ffmpeg (son) a échoué pour {path}")
    return dur
