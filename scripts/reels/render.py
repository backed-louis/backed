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
    cw, ch = SW, 560
    c = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    d.rounded_rectangle((0, 0, cw - 1, ch - 1), radius=40, fill=SLATE, outline=LINE, width=3)
    # Ligne 1 : la marque, sur toute la largeur. Ligne 2 : « via créateur » à gauche, la remise à droite.
    disc = o.get("disc") or ""
    fd = F("syne", 80)
    dw = tsize(d, disc, fd)[1] + 40 if disc else 0
    d.text((50, 40), o["brand"], font=fit(d, o["brand"], cw - 100, 72), fill=OFF)
    if disc:
        b, w, h = tsize(d, disc, fd)
        d.text((cw - 50 - w - b[0], 150 - h / 2 - b[1]), disc, font=fd, fill=LILAS)
    if o.get("creator"):
        d.text((50, 132), "via " + o["creator"], font=fit(d, "via " + o["creator"], cw - 100 - dw, 36, "inter", "Medium"), fill=GREY)
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
    img.paste(c, (int(CX - c.width / 2), int(yc - c.height / 2 + 60 * (1 - p))), c)


def s_card(o, title):
    def fn(img, d, lt):
        bg(d)
        rise(d, lt, 0.0, 420, title, fit(d, title, W - 140, 96), OFF)
        draw_card(img, lt, 0.2, o, 960, copy_at=1.4)
    return fn


def s_top(items, sub="La sélection de la semaine."):
    def fn(img, d, lt):
        bg(d)
        rise(d, lt, 0.0, 380, f"{len(items)} codes.", fit(d, f"{len(items)} codes.", SW, 110), OFF)
        rise(d, lt, 0.12, 480, sub, fit(d, sub, SW, 56, "syne", "Bold"), LILAS)
        for i, o in enumerate(items):
            y = 580 + i * 255
            p = eo(prog(lt, 0.4 + i * 0.3, 0.3))
            if p <= 0:
                continue
            x0, a = SAFE_L + 60 * (1 - p), int(255 * p)
            d.rounded_rectangle((x0, y, x0 + SW, y + 230), radius=32, fill=SLATE + (a,), outline=LINE + (a,), width=3)
            d.text((x0 + 40, y + 34), str(i + 1), font=F("syne", 100), fill=LILAS + (a,))
            disc = o.get("disc") or ""
            fd = F("syne", 56)
            dw = tsize(d, disc, fd)[1] + 30 if disc else 0
            d.text((x0 + 165, y + 30), o["brand"], font=fit(d, o["brand"], SW - 205, 54), fill=OFF + (a,))
            code = o["code"] or "Lien direct"
            d.text((x0 + 165, y + 102), code, font=fit(d, code, SW - 205 - dw, 52, "mono", "Bold"), fill=OFF + (a,))
            if o.get("creator"):
                d.text((x0 + 165, y + 172), "via " + o["creator"], font=fit(d, "via " + o["creator"], SW - 205, 32, "inter", "Medium"), fill=GREY + (a,))
            if disc:
                b, w, _ = tsize(d, disc, fd)
                d.text((x0 + SW - 35 - w - b[0], y + 96), disc, font=fd, fill=GREEN + (a,))
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


HOOK_Y = 490  # 1re ligne de l'accroche (centre), sous « CODE DU JOUR »


def s_hook(o):
    """1re image pleine et lisible tout de suite : le créateur, le gain, la marque. Aucun fondu d'entrée."""
    if o.get("creator"):
        c = o["creator"]
        who = ["Le code", f"d'{c}" if c[:1].lower() in "aeiouyhéèêàâîôû" else f"de {c}"]
    else:
        who = ["Code promo", o["brand"]]
    gain = f"{o['disc']} chez {o['brand']}" if o.get("disc") else first_clause(o.get("benefit") or o["brand"], 34)

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
        split = two_lines(d, who[1])
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
            fw = min(fit(d, ln, SW - 40, 130).size for ln in wl)
            for gl in gains:
                fg = min(min(fit(d, g, SW - 40, 104).size for g in gl), int(fw * 0.85))
                bottom = HOOK_Y + len(wl) * fw * 1.1 + 50 + len(gl) * fg * 1.15
                if bottom > 1210:
                    continue
                # le gain doit rester lisible sur un téléphone, et pas écrasé par le nom
                ok = fg >= 54 and fg >= 0.5 * fw
                score = (1000 if ok else 0) + fw + 1.2 * fg - 6 * (len(wl) + len(gl))  # gros, puis peu de lignes
                if best is None or score > best[0]:
                    best = (score, wl, F("syne", fw), gl, F("syne", fg))
        return best[1:]

    def fn(img, d, lt):
        bg(d)
        text_c(d, 370, "CODE DU JOUR", F("inter", 40, "Bold"), GREY)
        lines, fw, glines, fg = layout(d)
        y = HOOK_Y
        for ln in lines:
            text_c(d, y, ln, fw, OFF)
            y += int(fw.size * 1.1)
        y += 50
        for g in glines:
            text_c(d, y, g, fg, LILAS)
            last, y = y, y + int(fg.size * 1.15)
        # soulignement qui se trace sous le gain
        gw = max(tsize(d, g, fg)[1] for g in glines)
        uy = last + int(fg.size * 0.77)
        u = eo(prog(lt, 0.15, 0.45))
        d.rounded_rectangle((CX - gw / 2, uy, CX - gw / 2 + gw * u, uy + 12), radius=6, fill=VIO)
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
        bg(d)
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
            text_c(d, y, a, fa, LILAS if i == 0 else OFF)
            if i == 0:
                aw, uy = tsize(d, a, fa)[1], y + fa.size * 0.6
                y += 40  # place pour le soulignement
            y += fa.size * 0.55
        u = eo(prog(lt, 0.25, 0.5))
        d.rounded_rectangle((CX - aw / 2, uy, CX - aw / 2 + aw * u, uy + 12), radius=6, fill=VIO)
        a = 0.55 + 0.45 * abs(math.sin(lt * 4))
        text_c(d, 1290, "Le code arrive ↓", F("inter", 46, "Bold"), OFF, alpha=a)
    return fn


def s_code(o):
    """La carte du code, copiée tout de suite."""
    title = "Le code à copier"

    def fn(img, d, lt):
        bg(d)
        text_c(d, 400, title, fit(d, title, SW, 72, "syne", "Bold"), OFF)
        draw_card(img, lt, 0.0, o, 820, copy_at=0.9)
        if lt > 0.9:
            rise(d, lt, 0.95, 1230, "Copié. Tu paies le bon prix.", fit(d, "Copié. Tu paies le bon prix.", SW, 46, "inter", "SemiBold"), GREEN, dist=20)
    return fn


def s_top_hook(items):
    def fn(img, d, lt):
        bg(d)
        text_c(d, 420, "LA SÉLECTION DE LA SEMAINE", fit(d, "LA SÉLECTION DE LA SEMAINE", SW, 40, "inter", "Bold"), GREY)
        big = f"{len(items)} codes"
        text_c(d, 640, big, fit(d, big, SW, 190), OFF)
        text_c(d, 830, "à garder.", fit(d, "à garder.", SW, 130), LILAS)
        names = " · ".join(o["brand"] for o in items)
        text_c(d, 1010, names, fit(d, names, SW, 58, "inter", "Bold"), OFF)
        a = 0.55 + 0.45 * abs(math.sin(lt * 4))
        text_c(d, 1290, "Enregistre pour plus tard ↓", fit(d, "Enregistre pour plus tard ↓", SW, 46, "inter", "Bold"), OFF, alpha=a)
    return fn


# ------------------------------------------------------------------ outro : le logo se tape dans la barre de recherche
OUTRO_DUR = 3.4
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
        x0, x1 = CX - (SW / 2) * sc, CX + (SW / 2) * sc
        y0, y1 = yc - 115 * sc, yc + 115 * sc
        A = int(255 * clamp(a_in))
        d.rounded_rectangle((x0, y0, x1, y1), radius=int(70 * sc), fill=SLATE + (A,), outline=VIO + (A,), width=5)
        mx, my, mr = x0 + 95 * sc, yc - 8, 30 * sc
        d.ellipse((mx - mr, my - mr, mx + mr, my + mr), outline=GREY + (A,), width=int(8 * sc))
        d.line((mx + mr * 0.7, my + mr * 0.7, mx + mr * 1.5, my + mr * 1.5), fill=GREY + (A,), width=int(9 * sc))
        # « Backed » se tape, lettre par lettre
        f = fit(d, "Backed.", SW - 300, 170)
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
            d.rounded_rectangle((CX - cw / 2, cy - 46, CX + cw / 2, cy + 46), radius=46, fill=(16, 52, 33), outline=GREEN, width=3)
            if pc > 0.6:
                text_c(d, cy, lab, fc, GREEN, alpha=prog(lt, TXT_T + 0.1, 0.15))
        t0 = TXT_T + 0.25
        rise(d, lt, t0, 1060, "Paie le bon prix.", fit(d, "Paie le bon prix.", SW, 96), LILAS, dist=30, dur=0.35)
        p = eob(prog(lt, t0 + 0.2, 0.35))
        if p > 0.02:
            pw = 290 * clamp(p, 0, 1.15)
            pill = (CX - pw, 1120, CX + pw, 1240)
            d.rounded_rectangle(pill, radius=60, fill=VIO)
            text_c(d, 1180, "backed.fr", F("inter", 58, "Bold"), OFF, alpha=prog(lt, t0 + 0.3, 0.15))
            sh = prog(lt, t0 + 0.55, 0.5)
            if 0 < sh < 1:
                layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                bx = pill[0] - 120 + (pill[2] - pill[0] + 240) * sh
                ImageDraw.Draw(layer).polygon([(bx, 1120), (bx + 60, 1120), (bx + 10, 1240), (bx - 50, 1240)], fill=(255, 255, 255, 90))
                mask = Image.new("L", (W, H), 0)
                ImageDraw.Draw(mask).rounded_rectangle(pill, radius=60, fill=255)
                layer.putalpha(Image.composite(layer.getchannel("A"), Image.new("L", (W, H), 0), mask))
                img.paste(layer, (0, 0), layer)
        cta = "Abonne-toi : un code chaque jour."
        rise(d, lt, t0 + 0.45, 1310, cta, fit(d, cta, SW, 50, "inter", "Bold"), OFF, dist=20, dur=0.35)
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
