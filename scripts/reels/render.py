"""Moteur de rendu des vidéos Backed, 1080x1920, 30 fps. Identité « piste C » (novembre 2026) : fond nuit,
violet électrique en relief, vert acide pour le code et le surligneur, logo ticket.

Dépendances : Pillow + ffmpeg (et numpy + scipy pour la musique, voir musique.py). Les polices sont dans scripts/reels/fonts (licence OFL).
"""
import math
import os
import re
import subprocess

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageStat

W, H, FPS = 1080, 1920, 30
NIGHT = (7, 8, 15)
SLATE = (20, 21, 31)
LINE = (44, 46, 62)
VIO = (139, 0, 255)
LILAS = (204, 119, 255)   # mauve : liens et petits textes d'accent
ACID = (200, 255, 61)     # vert acide : le code et le surligneur, rien d'autre
INK = (18, 20, 38)        # cartes
INK_LINE = (35, 38, 74)
SOFT = (233, 221, 255)    # texte clair sur fond violet
OFF = (244, 242, 238)
GREY = (140, 143, 163)
GREEN = (46, 204, 113)

# Zone sûre : ce que l'interface TikTok / Reels ne recouvre pas (barre du haut, boutons à droite,
# légende et pseudo en bas). Tout texte et toute carte des vidéos restent dedans.
SAFE_L, SAFE_T, SAFE_R, SAFE_B = 120, 300, 920, 1360
CX = (SAFE_L + SAFE_R) / 2   # 520 : axe de la zone sûre, décalé à gauche à cause des boutons
SW = SAFE_R - SAFE_L         # 800 : largeur utile

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
    d.text((CX - w / 2 - b[0], yc - h / 2 - b[1]), s, font=f, fill=fill + (int(255 * clamp(alpha)),))


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


_halo = None


def halo_bg(img):
    """Fond nuit avec le halo violet de la marque : grand en haut à gauche, plus discret en bas à droite."""
    global _halo
    if _halo is None:
        g = Image.new("RGBA", (W, H), NIGHT + (255,))
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ld = ImageDraw.Draw(lay)
        ld.ellipse((-520, -420, 760, 860), fill=VIO + (110,))
        ld.ellipse((520, 1300, 1500, 2280), fill=(178, 102, 255, 60))
        g.alpha_composite(lay.filter(ImageFilter.GaussianBlur(220)))
        _halo = g.convert("RGB")
    img.paste(_halo)


_violet = None


def violet_bg():
    """Fond violet en relief : lumière en haut à gauche, violet profond en bas à droite, grand ticket en filigrane."""
    global _violet
    if _violet is None:
        g = Image.radial_gradient("L").resize((int(2 * 1.3 * W), int(2 * 1.2 * H)), Image.BILINEAR)
        g = g.crop((int(1.3 * W), int(1.2 * H), int(1.3 * W) + W, int(1.2 * H) + H))
        stops = [(0, (169, 59, 255)), (0.4, VIO), (1.0, (90, 0, 181))]

        def lut(c):
            out = []
            for v in range(256):
                t = v / 255
                for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
                    if t <= t1:
                        k = (t - t0) / (t1 - t0)
                        out.append(int(c0[c] + (c1[c] - c0[c]) * k))
                        break
            return out
        img = Image.merge("RGB", [g.point(lut(i)) for i in range(3)]).convert("RGBA")
        wm = ticket(1500, fill=(78, 0, 160, 140), ink=(122, 16, 240, 128)).rotate(14, resample=Image.BICUBIC, expand=True)
        img.alpha_composite(wm, (W - int(wm.width * 0.62), H - int(wm.height * 0.7)))
        _violet = img.convert("RGB")
    return _violet


def ticket(w, fill=VIO + (255,), ink=OFF + (255,)):
    """Le symbole Backed : un ticket à deux encoches avec un b (proportions 120 × 90)."""
    k = 4
    W4, H4 = w * k, int(w * 0.75) * k
    m = Image.new("L", (W4, H4), 0)
    md = ImageDraw.Draw(m)
    md.rounded_rectangle((0, 0, W4 - 1, H4 - 1), radius=int(W4 * 16 / 120), fill=255)
    r = W4 * 13 / 120
    for cx in (0, W4):
        md.ellipse((cx - r, H4 / 2 - r, cx + r, H4 / 2 + r), fill=0)
    t = Image.new("RGBA", (W4, H4), fill)
    t.putalpha(ImageChops.multiply(m, Image.new("L", (W4, H4), fill[3] if len(fill) > 3 else 255)))
    d = ImageDraw.Draw(t)
    f = F("syne", W4 * 70 / 120)
    b, bw, bh = tsize(d, "b", f)
    lay = Image.new("RGBA", (W4, H4), (0, 0, 0, 0))
    ImageDraw.Draw(lay).text((W4 * 0.47 - bw / 2 - b[0], H4 * 0.5 - bh / 2 - b[1]), "b", font=f, fill=ink)
    t.alpha_composite(lay)
    return t.resize((w, int(w * 0.75)), Image.LANCZOS)


def hl_layer(d, s, f, angle=2):
    """Le surligneur : le texte en nuit sur une étiquette vert acide, légèrement inclinée."""
    b, w, h = tsize(d, s, f)
    px, py = int(f.size * 0.16), int(f.size * 0.12)
    lay = Image.new("RGBA", (w + 2 * px, h + 2 * py), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    ld.rounded_rectangle((0, 0, lay.width - 1, lay.height - 1), radius=int(f.size * 0.12), fill=ACID + (255,))
    ld.text((px - b[0], py - b[1]), s, font=f, fill=NIGHT + (255,))
    return lay.rotate(angle, resample=Image.BICUBIC, expand=True)


def highlight(img, cx, yc, s, f, alpha=1.0, angle=2):
    lay = hl_layer(ImageDraw.Draw(img), s, f, angle)
    if alpha < 1:
        lay.putalpha(lay.getchannel("A").point(lambda v: int(v * clamp(alpha))))
    img.paste(lay, (int(cx - lay.width / 2), int(yc - lay.height / 2)), lay)


def count(lt, start, dur, target):
    return int(round(target * eo(prog(lt, start, dur))))


# ------------------------------------------------------------------ données
PCT = re.compile(r"(\d{1,2})\s?%")


def percent_of(benefit):
    """Premier pourcentage de réduction trouvé dans le texte de l'offre (5 à 90), sinon None."""
    # « jusqu'à -74 % » : pas un pourcentage garanti (mais « valable jusqu'à fin 2026 » ne gêne pas)
    if re.search(r"jusqu\S*\s*(?:à|a)\s*-?\s?\d+\s?%", benefit or "", re.I):
        return None
    for m in PCT.finditer(benefit or ""):
        v = int(m.group(1))
        if 5 <= v <= 90:
            return v
    return None


def first_clause(text, n=48):
    """Première proposition lisible d'un texte d'offre (« Un dessert offert à vie et… » → « Un dessert offert à vie »)."""
    t = " ".join(re.sub(r"\s*\([^)]*\)", "", text or "").split())   # sans parenthèses : « (versions 512 Go…) »
    for sep in [" + ", ", ", "; ", " et ", " puis "]:
        head = t.split(sep)[0]
        if 8 <= len(head) < len(t):
            t = head
    return short(t, n)


def hook_gain(text, n=40):
    """Gain court pour l'accroche, coupé à une limite naturelle plutôt qu'au milieu d'un mot :
    « -10€ dès 30€ d'achat pour les nouveaux clients » → « -10€ dès 30€ d'achat »."""
    t = first_clause(text, 500)
    if len(t) > n:
        for sep in (" pour ", " sur ", " avec ", " à partir ", " dès ", " chez ", " sans ", " pendant ", " lors ",
                    " à l'", " à la ", " jusqu'au "):
            head = t.split(sep)[0]
            if 8 <= len(head) <= n:
                return head
    return short(t, n)


def short(text, n):
    text = " ".join((text or "").split())
    return text if len(text) <= n else text[: n - 1].rstrip() + "…"


# ------------------------------------------------------------------ logos des marques
_tiles = {}


def _round_mask(size, radius):
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=radius * 4, fill=255)
    return m.resize((size, size), Image.LANCZOS)


def logo_tile(logo, size):
    """Logo de la marque en tuile carrée arrondie, comme une icône d'appli : plein cadre si l'icône est
    déjà un carré opaque, sinon posé sur fond blanc (sombre si le logo est clair, pour qu'il reste visible)."""
    key = (id(logo), size)
    if key in _tiles:
        return _tiles[key]
    lg = logo.convert("RGBA")
    a = lg.getchannel("A")
    w, h = lg.size
    corners = [a.getpixel(p) for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    if min(corners) > 200 and abs(w - h) <= max(2, w // 50):
        tile = lg.resize((size, size), Image.LANCZOS)
    else:
        box = a.point(lambda v: 255 if v > 16 else 0).getbbox()
        if box:
            lg = lg.crop(box)
        vis = lg.getchannel("A").point(lambda v: 255 if v > 128 else 0)
        light = vis.getbbox() is not None and ImageStat.Stat(lg.convert("L"), mask=vis).mean[0] > 215
        tile = Image.new("RGBA", (size, size), SLATE + (255,) if light else (255, 255, 255, 255))
        s = size * 0.68 / max(lg.size)
        lg = lg.resize((max(1, round(lg.width * s)), max(1, round(lg.height * s))), Image.LANCZOS)
        tile.alpha_composite(lg, ((size - lg.width) // 2, (size - lg.height) // 2))
    tile.putalpha(ImageChops.multiply(tile.getchannel("A"), _round_mask(size, int(size * 0.22))))
    _tiles[key] = tile
    return tile


def letter_tile(name, size):
    """Tuile de secours quand on n'a pas de logo net : l'initiale de la marque sur fond violet."""
    key = ("lettre", name, size)
    if key not in _tiles:
        t = Image.new("RGBA", (size, size), VIO + (255,))
        d = ImageDraw.Draw(t)
        ch = (name.strip()[:1] or "?").upper()
        f = F("syne", size * 0.58)
        b, w, h = tsize(d, ch, f)
        d.text((size / 2 - w / 2 - b[0], size / 2 - h / 2 - b[1]), ch, font=f, fill=OFF)
        t.putalpha(_round_mask(size, int(size * 0.22)))
        _tiles[key] = t
    return _tiles[key]


def faded(tile, alpha):
    if alpha >= 1:
        return tile
    t = tile.copy()
    t.putalpha(t.getchannel("A").point(lambda v: int(v * clamp(alpha))))
    return t


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
    cw, ch = SW, 560
    c = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    d.rounded_rectangle((0, 0, cw - 1, ch - 1), radius=40, fill=INK, outline=INK_LINE, width=3)
    # Ligne 1 : la marque, sur toute la largeur. Ligne 2 : « via créateur » à gauche, la remise à droite.
    disc = o.get("disc") or ""
    fd = F("syne", 80)
    dw = tsize(d, disc, fd)[1] + 40 if disc else 0
    bx = 50
    if o.get("logo") is not None:
        c.alpha_composite(logo_tile(o["logo"], 84), (50, 34))
        bx = 50 + 84 + 26
    fbr = fit(d, o["brand"], cw - 50 - bx, 72)
    b, w, h = tsize(d, o["brand"], fbr)
    d.text((bx - b[0], 76 - h / 2 - b[1]), o["brand"], font=fbr, fill=OFF)
    if disc:
        b, w, h = tsize(d, disc, fd)
        d.text((cw - 50 - w - b[0], 150 - h / 2 - b[1]), disc, font=fd, fill=OFF)
    if o.get("creator"):
        d.text((50, 132), "via " + o["creator"], font=fit(d, "via " + o["creator"], cw - 100 - dw, 36, "inter", "Medium"), fill=GREY)
    if o.get("detail"):
        det = short(o["detail"], 48)
        d.text((50, 200), det, font=fit(d, det, cw - 100, 36, "inter", "SemiBold"), fill=OFF)
    d.rounded_rectangle((50, 280, cw - 50, 400), radius=20, fill=ACID)
    code = o["code"] or "Lien direct"
    fm = fit(d, code, cw - 180, 72, "mono", "ExtraBold")
    b, w, h = tsize(d, code, fm)
    d.text((90 - b[0], 340 - h / 2 - b[1]), code, font=fm, fill=NIGHT)
    copied = copy_at is not None and lt >= copy_at
    d.rounded_rectangle((50, 430, cw - 50, 515), radius=42, fill=NIGHT if copied else VIO, outline=ACID if copied else None, width=4)
    lbl = "Copié !" if copied else "Copier le code"
    fb = F("inter", 42, "Bold")
    b, w, h = tsize(d, lbl, fb)
    d.text((cw / 2 - w / 2 - b[0], 472 - h / 2 - b[1]), lbl, font=fb, fill=ACID if copied else OFF)
    sc = 0.94 + 0.06 * p
    if copied:
        sc *= 1 + 0.03 * math.exp(-(lt - copy_at) * 10)
    c = c.resize((int(cw * sc), int(ch * sc)), Image.BICUBIC).rotate(1.5, resample=Image.BICUBIC, expand=True)
    c.putalpha(c.getchannel("A").point(lambda v: int(v * p)))
    img.paste(c, (int(CX - c.width / 2), int(yc - c.height / 2 + 60 * (1 - p))), c)


def s_card(o, title):
    def fn(img, d, lt):
        bg(d)
        rise(d, lt, 0.0, 420, title, fit(d, title, W - 140, 96), OFF)
        draw_card(img, lt, 0.2, o, 960, copy_at=1.4)
    return fn


def s_top(items, sub="La sélection de la semaine."):
    def fn(img, d, lt):
        img.paste(violet_bg())
        rise(d, lt, 0.0, 380, f"{len(items)} codes.", fit(d, f"{len(items)} codes.", SW, 110), OFF)
        rise(d, lt, 0.12, 480, sub, fit(d, sub, SW, 56, "syne", "Bold"), SOFT)
        for i, o in enumerate(items):
            y = 580 + i * 255
            p = eo(prog(lt, 0.4 + i * 0.3, 0.3))
            if p <= 0:
                continue
            x0, a = SAFE_L + 60 * (1 - p), int(255 * p)
            d.rounded_rectangle((x0, y, x0 + SW, y + 230), radius=32, fill=NIGHT + (a,))
            d.text((x0 + 40, y + 34), str(i + 1), font=F("syne", 100), fill=ACID + (a,))
            disc = o.get("disc") or ""
            fd = F("syne", 56)
            dw = tsize(d, disc, fd)[1] + 30 if disc else 0
            bx = x0 + 165
            if o.get("logo") is not None:
                t = faded(logo_tile(o["logo"], 62), p)
                img.paste(t, (int(bx), y + 26), t)
                bx += 62 + 18
            fbr = fit(d, o["brand"], x0 + SW - 40 - bx, 54)
            b, w, h = tsize(d, o["brand"], fbr)
            d.text((bx - b[0], y + 57 - h / 2 - b[1]), o["brand"], font=fbr, fill=OFF + (a,))
            code = o["code"] or "Lien direct"
            d.text((x0 + 165, y + 102), code, font=fit(d, code, SW - 205 - dw, 52, "mono", "ExtraBold"), fill=ACID + (a,))
            if o.get("creator"):
                d.text((x0 + 165, y + 172), "via " + o["creator"], font=fit(d, "via " + o["creator"], SW - 205, 32, "inter", "Medium"), fill=GREY + (a,))
            if disc:
                b, w, _ = tsize(d, disc, fd)
                d.text((x0 + SW - 35 - w - b[0], y + 96), disc, font=fd, fill=OFF + (a,))
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


HEAD_Y = 380  # en-tête de l'accroche : logo de la marque, « CODE DU JOUR » et nom de la marque
HOOK_Y = 585  # 1re ligne de l'accroche (centre), sous l'en-tête


def brand_header(img, d, o, label="CODE DU JOUR", yc=HEAD_Y, T=156):
    """Le logo de la marque à gauche, « CODE DU JOUR » et le nom de la marque à droite : on reconnaît
    la marque dès la 1re image. Sans logo, les deux lignes seules, centrées."""
    fl = F("inter", 36, "Bold")
    if o.get("logo") is None:
        text_c(d, yc - 36, label, fl, GREY)
        text_c(d, yc + 32, o["brand"], fit(d, o["brand"], SW, 70), OFF)
        return
    gap = 34
    fb = fit(d, o["brand"], SW - T - gap, 70)
    tw = max(tsize(d, label, fl)[1], tsize(d, o["brand"], fb)[1])
    x = CX - (T + gap + tw) / 2
    tile = logo_tile(o["logo"], T)
    img.paste(tile, (int(x), int(yc - T / 2)), tile)
    x += T + gap
    for s, f, col, y in ((label, fl, GREY, yc - 38), (o["brand"], fb, OFF, yc + 30)):
        b, w, h = tsize(d, s, f)
        d.text((x - b[0], y - h / 2 - b[1]), s, font=f, fill=col)


def s_hook(o):
    """1re image pleine et lisible tout de suite : le créateur, le gain, la marque. Aucun fondu d'entrée."""
    if o.get("creator"):
        c = o["creator"]
        who = ["le code d'" if c[:1].lower() in "aeiouyhéèêàâîôû" else "le code de", c]
    else:
        who = ["code promo", o["brand"]]
    gain = (f"{o['disc']} chez {o['brand']}" if o.get("disc") else
            o.get("gain") or hook_gain(o.get("benefit") or o["brand"]))

    def two_lines(d, text):
        """Coupe un texte en deux lignes les plus égales possible (None s'il n'a qu'un mot)."""
        words = text.split()
        if len(words) < 2:
            return None
        ref = F("syne", 100)
        return min(([" ".join(words[:k]), " ".join(words[k:])] for k in range(1, len(words))),
                   key=lambda ls: max(tsize(d, l, ref)[1] for l in ls))

    def layout(d):
        """Choisit la mise en page la plus grosse qui tient dans la zone sûre : nom du créateur et gain
        sur une ou deux lignes. Le gain reste plus petit que le nom."""
        whos = [who]
        split = two_lines(d, who[1]) if len(who[1]) > 14 else None
        if split:
            whos.append([who[0]] + split)
        gains = [[gain]]
        if o.get("disc"):
            gains.append([o["disc"], f"chez {o['brand']}"])
            if two_lines(d, f"chez {o['brand']}"):
                gains.append([o["disc"]] + two_lines(d, f"chez {o['brand']}"))
        elif two_lines(d, gain):
            gains.append(two_lines(d, gain))
        best = None
        for wl in whos:
            fw = min(fit(d, ln, SW - 80, 130).size for ln in wl[1:])
            for gl in gains:
                fg = min(min(fit(d, g, SW - 40, 104).size for g in gl), int(fw * 0.85))
                bottom = HOOK_Y + fw * 1.05 + (len(wl) - 1) * fw * 1.22 + 40 + len(gl) * fg * 1.15
                if bottom > 1210:
                    continue
                # le gain doit rester lisible sur un téléphone, et pas écrasé par le nom
                ok = fg >= 54 and fg >= 0.5 * fw
                score = (1000 if ok else 0) + fw + 1.2 * fg - 6 * (len(wl) + len(gl))  # gros, puis peu de lignes
                if best is None or score > best[0]:
                    best = (score, wl, F("syne", fw), gl, F("syne", fg))
        return best[1:]

    def fn(img, d, lt):
        halo_bg(img)
        brand_header(img, d, o)
        lines, fw, glines, fg = layout(d)
        y = HOOK_Y
        for i, ln in enumerate(lines):
            if i == 0:
                text_c(d, y, ln, F("syne", fw.size * 0.62), OFF)   # « le code de », plus petit
                y += int(fw.size * 1.05)
            else:   # le nom du créateur, surligné en vert acide
                highlight(img, CX, y, ln, fw)
                y += int(fw.size * 1.22)
        y += 40
        for g in glines:
            text_c(d, y, g, fg, OFF)
            last, y = y, y + int(fg.size * 1.15)
        uy = last + int(fg.size * 0.77)
        if o.get("detail") and o.get("disc") and uy + 90 < 1220:
            det = short(o["detail"], 44)
            text_c(d, uy + 90, det, fit(d, det, SW, 44, "inter", "SemiBold"), GREY)
        a = 0.55 + 0.45 * abs(math.sin(lt * 4))
        text_c(d, 1290, "Le code arrive ↓", F("inter", 46, "Bold"), OFF, alpha=a)
    return fn


def s_hook_phrase(label, lines, answer):
    """Accroche en une phrase (concepts Black Friday) : une question en blanc, puis la réponse en lilas,
    dont la 1re ligne est un gros chiffre (« +10 % »). `lines` et `answer` sont des listes de lignes ;
    le bloc est centré verticalement dans la zone sûre."""
    def fn(img, d, lt):
        halo_bg(img)
        text_c(d, 370, label, fit(d, label, SW, 40, "inter", "Bold"), GREY)
        fw = F("syne", min(fit(d, ln, SW - 40, 120).size for ln in lines))
        fas = [fit(d, a, SW - 40, 200 if i == 0 else 96) for i, a in enumerate(answer)]
        height = len(lines) * fw.size * 1.1 + 70 + sum(f.size * 1.1 for f in fas) + 40
        y = 460 + (1220 - 460 - height) / 2 + fw.size / 2
        for ln in lines:
            text_c(d, y, ln, fw, OFF)
            y += fw.size * 1.1
        y += 70 - fw.size * 0.55
        for i, (a, fa) in enumerate(zip(answer, fas)):
            y += fa.size * 0.55
            if i == 0:
                highlight(img, CX, y, a, fa)
                y += 40
            else:
                text_c(d, y, a, fa, OFF)
            y += fa.size * 0.55
        a = 0.55 + 0.45 * abs(math.sin(lt * 4))
        text_c(d, 1290, "Le code arrive ↓", F("inter", 46, "Bold"), OFF, alpha=a)
    return fn


def s_code(o):
    """La carte du code, copiée tout de suite."""
    title = "le code à copier"

    def fn(img, d, lt):
        halo_bg(img)
        text_c(d, 400, title, fit(d, title, SW, 80), OFF)
        draw_card(img, lt, 0.0, o, 820, copy_at=0.9)
        if lt > 0.9:
            rise(d, lt, 0.95, 1230, "Copié. Tu paies le bon prix.", fit(d, "Copié. Tu paies le bon prix.", SW, 46, "inter", "SemiBold"), ACID, dist=20)
    return fn


def s_top_hook(items):
    def fn(img, d, lt):
        img.paste(violet_bg())
        text_c(d, 420, "LA SÉLECTION DE LA SEMAINE", fit(d, "LA SÉLECTION DE LA SEMAINE", SW, 40, "mono", "ExtraBold"), SOFT)
        big = f"{len(items)} codes"
        text_c(d, 620, big, fit(d, big, SW, 190), OFF)
        highlight(img, CX, 810, "à garder.", fit(d, "à garder.", SW - 80, 130))
        # les logos des marques, puis leurs noms : on voit tout de suite de quelles marques il s'agit
        T, gap = 150, 40
        x = CX - (len(items) * T + (len(items) - 1) * gap) / 2
        for o in items:
            t = logo_tile(o["logo"], T) if o.get("logo") is not None else letter_tile(o["brand"], T)
            img.paste(t, (int(x), 990 - T // 2), t)
            x += T + gap
        names = " · ".join(o["brand"] for o in items)
        text_c(d, 1145, names, fit(d, names, SW, 50, "inter", "Bold"), OFF)
        a = 0.55 + 0.45 * abs(math.sin(lt * 4))
        text_c(d, 1290, "Enregistre pour plus tard ↓", fit(d, "Enregistre pour plus tard ↓", SW, 46, "inter", "Bold"), OFF, alpha=a)
    return fn


# ------------------------------------------------------------------ outro : le logo se tape dans la barre de recherche
OUTRO_DUR = 3.4
SIGNATURE = ("Avant de payer,", "passe par Backed.")   # la phrase de Backed, partout (vidéos, visuels, textes)
TYPE_T0, TYPE_DT = 0.20, 0.085          # frappe : une lettre toutes les 85 ms
DOT_T = TYPE_T0 + 6 * TYPE_DT + 0.06    # point violet = 1re note de la signature sonore
PULSE_T = DOT_T + 0.17                  # le point respire = 2e note
TXT_T = PULSE_T + 0.45                  # les textes n'arrivent qu'après l'animation du logo
LOGO_Y = 720
_glow = None


def _glow_layer():
    global _glow
    if _glow is None:
        g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(g).ellipse((CX - 480, LOGO_Y - 300, CX + 480, LOGO_Y + 300), fill=VIO + (150,))
        _glow = g.filter(ImageFilter.GaussianBlur(140))
    return _glow


def s_outro():
    d0 = ImageDraw.Draw(Image.new("RGB", (8, 8)))
    fs = 150
    while True:   # proportions du logo : ticket haut de 1,07 × la taille du texte, le tout ≤ 780 px
        f = F("syne", fs)
        sym_w = int(fs * 1.43)
        ww = sum(f.getlength(ch) - 0.045 * fs for ch in "backed")
        if sym_w + 0.3 * fs + ww <= 780 or fs <= 60:
            break
        fs -= 2
    sym = ticket(sym_w)

    def fn(img, d, lt):
        bg(d)
        pulse = 0.35 + 0.25 * eo(prog(lt, 0.0, 0.6)) + 0.4 * eo(prog(lt, DOT_T, 0.15)) * (1 - prog(lt, DOT_T + 0.15, 0.8))
        gl = _glow_layer().copy()
        gl.putalpha(gl.getchannel("A").point(lambda v: int(v * clamp(pulse))))
        img.paste(gl, (0, 0), gl)
        # mise en page finale : ticket + « backed », centrés sur l'axe de la zone sûre
        word = "backed"
        f = F("syne", fs)
        track = -0.045 * f.size
        widths = [tsize(d, ch, f)[1] for ch in word]
        advs = [f.getlength(ch) + track for ch in word]
        ww = sum(advs[:-1]) + widths[-1]
        gap = int(0.3 * fs)
        total = sym_w + gap + ww
        x0 = CX - total / 2
        sh = int(sym_w * 0.75)
        tx = x0 + sym_w + gap
        asc = tsize(d, "b", f)[2]
        base_y = LOGO_Y - asc / 2
        # les lettres se tapent une à une
        x = tx
        for i, ch in enumerate(word):
            p = prog(lt, TYPE_T0 + i * TYPE_DT, 0.12)
            if p > 0:
                fl = F("syne", f.size * (1.35 - 0.35 * eo(p)))
                b, w, h = tsize(d, ch, fl)
                wn = tsize(d, ch, f)[1]
                d.text((x - b[0] - (w - wn) / 2, base_y + (tsize(d, ch, f)[0][1] - b[1]) - (h - tsize(d, ch, f)[2]) / 2 - tsize(d, ch, f)[0][1]),
                       ch, font=fl, fill=OFF + (int(255 * clamp(p * 1.5)),))
            x += advs[i]
        # le ticket arrive sur la 1re note, respire sur la 2e
        pd = prog(lt, DOT_T, 0.3)
        if pd > 0.001:
            k = eob(pd, 2.4) * (1 + 0.08 * math.sin(math.pi * prog(lt, PULSE_T, 0.25)))
            t = sym.resize((max(1, int(sym_w * k)), max(1, int(sh * k))), Image.BICUBIC).rotate(-6 * (1 - clamp(pd)), resample=Image.BICUBIC, expand=True)
            cx, cy = x0 + sym_w / 2, LOGO_Y
            img.paste(t, (int(cx - t.width / 2), int(cy - t.height / 2)), t)
            for t_, amp in ((DOT_T, 1.0), (PULSE_T, 0.7)):
                rp = prog(lt, t_, 0.45)
                if 0 < rp < 1:
                    R = sym_w * 0.55 * (1 + amp * eo(rp))
                    d.ellipse((cx - R, cy - R, cx + R, cy + R), outline=ACID + (int(200 * (1 - rp)),), width=6)
            sp = prog(lt, DOT_T, 0.4)
            if 0 < sp < 1:
                for j in range(10):
                    ang = j * 2 * math.pi / 10 + 0.3
                    dist = sym_w * (0.6 + 1.4 * eo(sp))
                    q = 12 * (1 - sp)
                    px, py = cx + math.cos(ang) * dist, cy + math.sin(ang) * dist
                    d.rectangle((px - q, py - q, px + q, py + q), fill=(ACID if j % 2 else VIO) + (int(255 * (1 - sp)),))
        # textes, après le logo : « avant de payer, » puis « passe par backed. » surligné
        t0 = TXT_T + 0.1
        ft = F("syne", min(fit(d, "avant de payer,", SW, 92).size, fit(d, "passe par backed.", SW - 80, 92).size))
        rise(d, lt, t0, 1010, "avant de payer,", ft, OFF, dist=30, dur=0.35)
        ph = eo(prog(lt, t0 + 0.12, 0.35))
        if ph > 0:
            highlight(img, CX, 1115 + 30 * (1 - ph), "passe par backed.", ft, alpha=ph)
        P0, P1 = 1220, 1326
        p = eob(prog(lt, t0 + 0.35, 0.35))
        if p > 0.02:
            pw = 270 * clamp(p, 0, 1.15)
            pill = (CX - pw, P0, CX + pw, P1)
            d.rounded_rectangle(pill, radius=53, fill=VIO)
            text_c(d, (P0 + P1) / 2, "backed.fr", F("mono", 54, "ExtraBold"), OFF, alpha=prog(lt, t0 + 0.45, 0.15))
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


def phrase_shots(o, label, lines, answer):
    """Une vidéo à accroche-phrase (ex. Black Friday « Le code en plus ») : phrase, carte du code, fin."""
    return [(1.9, s_hook_phrase(label, lines, answer)), (2.2, s_code(o)), (OUTRO_DUR, s_outro())]


def top_shots(items, proof, sub="La sélection de la semaine."):
    return [(1.5, s_top_hook(items)), (2.8, s_top(items, sub)), (OUTRO_DUR, s_outro())]


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
