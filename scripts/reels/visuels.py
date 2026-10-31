"""Visuels fixes de Backed, dans la DA des vidéos : carte WhatsApp (1080×1080), image de story
Instagram (1080×1920, avec la place du sticker lien), carrousel de la semaine (1080×1350) et
carrousel « C'est quoi Backed ? ».

Usage seul (carrousel « C'est quoi Backed ? ») :
  python3 scripts/reels/visuels.py --about out/cest-quoi-backed
"""
import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render import (F, fit, tsize, wrap, short, first_clause, logo_tile, letter_tile,  # noqa: E402
                    NIGHT, SLATE, LINE, VIO, LILAS, OFF, GREY, GREEN, SIGNATURE)

SQ = (1080, 1080)      # WhatsApp
STORY = (1080, 1920)   # story Instagram
POST = (1080, 1350)    # carrousel 4:5 (Instagram, TikTok mode photo)


# ------------------------------------------------------------------ outils
def canvas(size, glow=None):
    img = Image.new("RGBA", size, NIGHT + (255,))
    if glow:
        cx, cy, rx, ry, a = glow
        g = Image.new("RGBA", size, (0, 0, 0, 0))
        ImageDraw.Draw(g).ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=VIO + (a,))
        img.alpha_composite(g.filter(ImageFilter.GaussianBlur(min(rx, ry) * 0.45)))
    return img, ImageDraw.Draw(img)


def tc(d, cx, yc, s, f, fill):
    """Texte centré sur (cx, yc)."""
    b, w, h = tsize(d, s, f)
    d.text((cx - w / 2 - b[0], yc - h / 2 - b[1]), s, font=f, fill=fill)
    return w


def tl(d, x, yc, s, f, fill):
    """Texte aligné à gauche, centré verticalement sur yc."""
    b, w, h = tsize(d, s, f)
    d.text((x - b[0], yc - h / 2 - b[1]), s, font=f, fill=fill)
    return w


def lines_block(d, cx, y, lines, f, fill, lh=1.12):
    """Lignes centrées à partir du haut `y` ; renvoie le bas du bloc."""
    for ln in lines:
        tc(d, cx, y + f.size / 2, ln, f, fill)
        y += f.size * lh
    return y


def wrapped(d, text, maxw, size, kind="syne", weight="ExtraBold", max_lines=2, min_size=40):
    """Plus grande police (≤ size) pour laquelle le texte tient en `max_lines` lignes de `maxw`."""
    s = size
    while True:
        f = F(kind, s, weight)
        ls = wrap(d, text, f, maxw)
        if (len(ls) <= max_lines and all(tsize(d, ln, f)[1] <= maxw for ln in ls)) or s <= min_size:
            return ls[:max_lines], f
        s -= 4


def tile_for(o, size):
    return logo_tile(o["logo"], size) if o.get("logo") is not None else letter_tile(o["brand"], size)


def wordmark(d, cx, yc, size, fill=OFF):
    """« Backed » + le point violet, comme le logo de fin des vidéos."""
    f = F("syne", size)
    b, w, h = tsize(d, "Backed", f)
    r = size * 0.105
    total = w + size * 0.03 + 2 * r
    x = cx - total / 2
    d.text((x - b[0], yc - h / 2 - b[1]), "Backed", font=f, fill=fill)
    bh = tsize(d, "B", f)[2]
    dx, dy = x + w + size * 0.03 + r, yc + bh / 2 - r * 1.05
    d.ellipse((dx - r, dy - r, dx + r, dy + r), fill=VIO)


def code_box(d, cx, y, w, h, code, size):
    d.rounded_rectangle((cx - w / 2, y, cx + w / 2, y + h), radius=int(h * 0.22), fill=SLATE, outline=VIO, width=4)
    f = fit(d, code, w - 80, size, "mono", "Bold")
    tc(d, cx, y + h / 2, code, f, OFF)
    return y + h


def pill(d, cx, yc, text, size=52, fill=VIO, color=OFF, padx=60, h=None):
    f = F("inter", size, "Bold")
    _, w, _ = tsize(d, text, f)
    h = h or size * 2
    d.rounded_rectangle((cx - w / 2 - padx, yc - h / 2, cx + w / 2 + padx, yc + h / 2), radius=int(h / 2), fill=fill)
    tc(d, cx, yc, text, f, color)


def signature(d, cx, yc, size, maxw):
    """« Avant de payer, passe par Backed. » sur deux lignes, la 2e en lilas."""
    f = F("syne", min(fit(d, SIGNATURE[0], maxw, size).size, fit(d, SIGNATURE[1], maxw, size).size))
    tc(d, cx, yc - f.size * 0.58, SIGNATURE[0], f, OFF)
    tc(d, cx, yc + f.size * 0.58, SIGNATURE[1], f, LILAS)


def gain_of(o):
    """Ce que le code fait gagner : la remise (« -15 % ») ou la 1re proposition de l'offre."""
    return o.get("disc") or first_clause(o.get("benefit") or "", 60).rstrip(" .")


def offer_block(img, d, o, y, cx, w, T=200, s=1.0, detail=True):
    """Logo, marque, gain, détail, créateur et code, empilés et centrés. Renvoie le bas du bloc."""
    t = tile_for(o, T)
    img.alpha_composite(t, (int(cx - T / 2), int(y)))
    y += T + 48 * s
    fb = fit(d, o["brand"], w, 92 * s)
    y = lines_block(d, cx, y, [o["brand"]], fb, OFF) + 26 * s
    if o.get("disc"):
        y = lines_block(d, cx, y, [o["disc"]], fit(d, o["disc"], w, 170 * s), LILAS, lh=1.05) + 10 * s
        if detail and o.get("benefit"):
            ls, f = wrapped(d, short(o["benefit"], 90), w, 40 * s, "inter", "SemiBold", 2, 28)
            y = lines_block(d, cx, y, ls, f, GREY, lh=1.3) + 10 * s
    else:
        ls, f = wrapped(d, gain_of(o), w, 80 * s, max_lines=2, min_size=44)
        y = lines_block(d, cx, y, ls, f, LILAS) + 10 * s
    if o.get("creator"):
        y = lines_block(d, cx, y + 6 * s, [f"Partagé par {o['creator']}"], fit(d, f"Partagé par {o['creator']}", w, 38 * s, "inter", "Medium"), GREY) + 8 * s
    y += 26 * s
    return code_box(d, cx, y, w, 150 * s, o["code"], 92 * s)


def placed_block(img, d, o, top, bottom, cx, w, T, s, detail=True):
    """offer_block centré verticalement entre top et bottom (réduit s'il ne tient pas). Renvoie son bas."""
    for k in range(6):
        probe = Image.new("RGBA", img.size)
        h = offer_block(probe, ImageDraw.Draw(probe), o, 0, cx, w, T, s, detail)
        if h <= bottom - top or k == 5:
            break
        T, s = int(T * 0.9), s * 0.9
    return offer_block(img, d, o, top + max(0, (bottom - top - h) / 2), cx, w, T, s, detail)


def day_label(d, cx, y, date_label, size=36):
    tc(d, cx, y, "CODE DU JOUR", F("inter", size, "Bold"), GREY)
    tc(d, cx, y + size * 1.4, date_label, F("inter", size, "SemiBold"), LILAS)


# ------------------------------------------------------------------ la semaine
def whatsapp_card(o, date_label):
    """Carte carrée envoyée avec le message WhatsApp du jour."""
    img, d = canvas(SQ, glow=(540, 300, 420, 260, 70))
    day_label(d, 540, 64, date_label, 32)
    placed_block(img, d, o, 150, 905, 540, 840, T=170, s=0.86)
    signature(d, 540, 995, 48, 880)
    return img


def story(o, date_label):
    """Image de story : le code du jour, avec une zone vide au-dessus de la barre de réponse pour le
    sticker lien (à ajouter dans Instagram, vers backed.fr/marque/<marque>)."""
    img, d = canvas(STORY, glow=(540, 640, 480, 340, 80))
    day_label(d, 540, 270, date_label, 38)
    bottom = placed_block(img, d, o, 390, 1310, 540, 880, T=250, s=1.1)
    hint = "Le lien est juste en dessous ↓"
    tc(d, 540, bottom + 85, hint, F("inter", 48, "Bold"), OFF)
    # zone du sticker lien : de bottom + 140 à ~1570, laissée vide
    signature(d, 540, 1650, 46, 840)
    return img, bottom + 140


def top_card(items, size=SQ, title="Les plus copiés cette semaine"):
    """Carte du top 3 : une ligne par code (logo, marque, code, remise)."""
    W_, H_ = size
    img, d = canvas(size, glow=(W_ / 2, H_ * 0.3, 420, 260, 70))
    tall = H_ > W_
    y = 300 if tall else 70
    tc(d, W_ / 2, y, "TOP " + str(len(items)), F("inter", 36, "Bold"), GREY)
    tc(d, W_ / 2, y + 75, title, fit(d, title, W_ - 160, 64), OFF)
    rh, gap = (230, 40) if tall else (190, 26)
    y0 = (450 if tall else 200)
    for i, o in enumerate(items):
        y = y0 + i * (rh + gap)
        d.rounded_rectangle((80, y, W_ - 80, y + rh), radius=36, fill=SLATE, outline=LINE, width=3)
        tl(d, 115, y + rh / 2, str(i + 1), F("syne", 76), LILAS)
        T = rh - 70
        img.alpha_composite(tile_for(o, T), (215, int(y + 35)))
        x = 215 + T + 30
        disc = o.get("disc") or ""
        fd = F("syne", 64 if tall else 56)
        dw = tsize(d, disc, fd)[1] + 30 if disc else 0
        tl(d, x, y + rh * 0.33, o["brand"], fit(d, o["brand"], W_ - 120 - x - dw, 56), OFF)
        tl(d, x, y + rh * 0.68, o["code"], fit(d, o["code"], W_ - 120 - x - dw, 52, "mono", "Bold"), OFF)
        if disc:
            tl(d, W_ - 115 - dw + 30, y + rh / 2, disc, fd, GREEN)
    if tall:  # story : la place du sticker lien sous les codes
        tc(d, W_ / 2, y0 + len(items) * (rh + gap) + 50, "Le lien est juste en dessous ↓", F("inter", 48, "Bold"), OFF)
    signature(d, W_ / 2, 1650 if tall else 995, 48, W_ - 200)
    return img


def week_cover(items, period):
    img, d = canvas(POST, glow=(540, 520, 460, 300, 80))
    tc(d, 540, 150, "LES CODES DE LA SEMAINE", F("inter", 38, "Bold"), GREY)
    tc(d, 540, 210, period, F("inter", 38, "SemiBold"), LILAS)
    tc(d, 540, 370, f"{len(items)} codes", fit(d, f"{len(items)} codes", 900, 210), OFF)
    tc(d, 540, 540, "à garder.", fit(d, "à garder.", 900, 140), LILAS)
    T, gap, per_row = 170, 40, 3
    rows = [items[i:i + per_row] for i in range(0, len(items), per_row)]
    y = 680
    for row in rows:
        x = 540 - (len(row) * T + (len(row) - 1) * gap) / 2
        for o in row:
            img.alpha_composite(tile_for(o, T), (int(x), int(y)))
            x += T + gap
        y += T + gap
    tl(d, 760, 1265, "Glisse →", F("inter", 44, "Bold"), OFF)
    tl(d, 90, 1265, "backed.fr", F("inter", 40, "Bold"), GREY)
    return img


def week_slide(o, i, n):
    img, d = canvas(POST, glow=(540, 300, 420, 260, 70))
    tl(d, 80, 95, f"{i}/{n}", F("inter", 38, "Bold"), GREY)
    wordmark(d, 900, 95, 46)
    placed_block(img, d, o, 160, 1190, 540, 880, T=220, s=1.0)
    url = f"backed.fr/marque/{o['slug']}"
    tc(d, 540, 1262, url, fit(d, url, 900, 38, "inter", "SemiBold"), GREY)
    return img


def end_slide(sub="Enregistre ce post pour ton prochain achat."):
    img, d = canvas(POST, glow=(540, 560, 480, 320, 110))
    wordmark(d, 540, 330, 120)
    signature(d, 540, 640, 96, 900)
    pill(d, 540, 870, "backed.fr", 60)
    tc(d, 540, 1040, "Les codes promo de tes créateurs YouTube.", fit(d, "Les codes promo de tes créateurs YouTube.", 900, 40, "inter", "SemiBold"), OFF)
    tc(d, 540, 1100, "Gratuit · sans compte", F("inter", 40, "SemiBold"), GREY)
    tc(d, 540, 1240, sub, fit(d, sub, 900, 36, "inter", "Medium"), GREY)
    return img


def week_carousel(items, period):
    return [week_cover(items, period)] + [week_slide(o, i + 1, len(items)) for i, o in enumerate(items)] + [end_slide()]


# ------------------------------------------------------------------ « C'est quoi Backed ? »
def _title(d, y, lines, size=104, maxw=900, colors=None):
    f = F("syne", min(fit(d, ln, maxw, size).size for ln in lines))
    for i, ln in enumerate(lines):
        tc(d, 540, y + i * f.size * 1.12, ln, f, (colors or [OFF] * len(lines))[i])
    return y + (len(lines) - 1) * f.size * 1.12 + f.size * 0.6


def _paragraph(d, y, text, size=44, maxw=860, fill=GREY, weight="SemiBold"):
    f = F("inter", size, weight)
    for ln in wrap(d, text, f, maxw):
        tc(d, 540, y, ln, f, fill)
        y += size * 1.4
    return y


def _footer(d, k, n):
    tl(d, 80, 1265, f"{k}/{n}", F("inter", 36, "Bold"), GREY)
    if k < n:
        tl(d, 800, 1265, "Glisse →", F("inter", 40, "Bold"), OFF)


def _row_card(img, d, y, icon, text, h=150):
    d.rounded_rectangle((110, y, 970, y + h), radius=36, fill=SLATE, outline=LINE, width=3)
    icon(d, 200, y + h / 2)
    ls, f = wrapped(d, text, 620, 42, "inter", "Bold", 2, 30)
    yy = y + h / 2 - (len(ls) - 1) * f.size * 0.65
    for ln in ls:
        tl(d, 290, yy, ln, f, OFF)
        yy += f.size * 1.3


def _icon_play(d, x, y):
    d.rounded_rectangle((x - 52, y - 38, x + 52, y + 38), radius=20, fill=VIO)
    d.polygon([(x - 14, y - 20), (x - 14, y + 20), (x + 22, y)], fill=OFF)


def _icon_text(d, x, y):
    d.rounded_rectangle((x - 46, y - 46, x + 46, y + 46), radius=18, outline=LILAS, width=5)
    for k, w in enumerate((56, 56, 34)):
        d.rounded_rectangle((x - 28, y - 26 + k * 22, x - 28 + w, y - 18 + k * 22), radius=4, fill=LILAS)


def _icon_story(d, x, y):
    d.ellipse((x - 48, y - 48, x + 48, y + 48), outline=VIO, width=7)
    d.ellipse((x - 34, y - 34, x + 34, y + 34), fill=SLATE)
    d.arc((x - 48, y - 48, x + 48, y + 48), 200, 320, fill=NIGHT, width=9)
    d.text((x, y), "24h", font=F("inter", 28, "Bold"), fill=LILAS, anchor="mm")


def _check(d, x, y, r=30):
    d.ellipse((x - r, y - r, x + r, y + r), fill=(16, 52, 33), outline=GREEN, width=3)
    d.line([(x - r * 0.42, y + 1), (x - r * 0.1, y + r * 0.32), (x + r * 0.45, y - r * 0.32)], fill=GREEN, width=6, joint="curve")


def about_slides(n_creators=None, n_codes=None):
    N = 7
    out = []

    # 1. couverture
    img, d = canvas(POST, glow=(540, 560, 460, 320, 90))
    tc(d, 540, 180, "C'EST QUOI BACKED ?", F("inter", 40, "Bold"), GREY)
    _title(d, 470, ["Tu paies", "plein pot ?"], 150, colors=[OFF, LILAS])
    _paragraph(d, 820, "Les codes promo existent. Ils sont juste cachés.", 48, 820, OFF, "Bold")
    _footer(d, 1, N)
    out.append(img)

    # 2. où sont les codes
    img, d = canvas(POST)
    _title(d, 210, ["Où sont", "les codes ?"], 112, colors=[OFF, LILAS])
    _row_card(img, d, 470, _icon_play, "Au milieu d'une vidéo YouTube de 20 minutes")
    _row_card(img, d, 650, _icon_text, "Tout en bas d'une description que personne ne lit")
    _row_card(img, d, 830, _icon_story, "Dans une story qui disparaît en 24 h")
    _paragraph(d, 1070, "Résultat : tu passes à côté.", 44, 860, GREY)
    _footer(d, 2, N)
    out.append(img)

    # 3. Backed les rassemble
    img, d = canvas(POST, glow=(540, 380, 420, 240, 80))
    wordmark(d, 540, 230, 110)
    _title(d, 420, ["les rassemble", "pour toi."], 104, colors=[OFF, LILAS])
    _paragraph(d, 640, "Chaque jour, on lit les vidéos de tes créateurs YouTube et on garde les codes encore actifs.", 42, 860, GREY)
    stats = [(f"{n_creators}+", "créateurs suivis"), (f"{n_codes}+", "codes actifs")] if n_creators and n_codes else []
    for k, (big, small) in enumerate(stats):
        x0 = 110 + k * 445
        d.rounded_rectangle((x0, 870, x0 + 415, 1110), radius=36, fill=SLATE, outline=LINE, width=3)
        tc(d, x0 + 207, 960, big, F("syne", 96), LILAS)
        tc(d, x0 + 207, 1050, small, F("inter", 38, "SemiBold"), OFF)
    _footer(d, 3, N)
    out.append(img)

    # 4. comment ça marche
    img, d = canvas(POST)
    _title(d, 180, ["Comment", "ça marche ?"], 104, colors=[OFF, LILAS])
    steps = ["Cherche une marque", "Copie le code", "Colle-le au paiement"]
    for k, label in enumerate(steps):
        y = 420 + k * 270
        d.ellipse((110, y, 190, y + 80), fill=VIO)
        tc(d, 150, y + 40, str(k + 1), F("inter", 46, "Bold"), OFF)
        tl(d, 225, y + 40, label, F("inter", 50, "Bold"), OFF)
        by = y + 105
        if k == 0:   # barre de recherche
            d.rounded_rectangle((225, by, 970, by + 110), radius=55, fill=SLATE, outline=VIO, width=4)
            d.ellipse((265, by + 33, 305, by + 73), outline=GREY, width=6)
            d.line((299, by + 67, 318, by + 86), fill=GREY, width=7)
            tl(d, 345, by + 55, "Une marque, un créateur…", F("inter", 40, "Medium"), GREY)
        elif k == 1:  # code + bouton
            d.rounded_rectangle((225, by, 640, by + 110), radius=24, fill=SLATE, outline=LINE, width=3)
            tl(d, 260, by + 55, "CODE10", F("mono", 54, "Bold"), OFF)
            d.rounded_rectangle((665, by, 970, by + 110), radius=55, fill=GREEN)
            tc(d, 817, by + 55, "Copié", F("inter", 44, "Bold"), OFF)
        else:        # champ code promo du site marchand
            d.rounded_rectangle((225, by, 970, by + 110), radius=24, fill=SLATE, outline=LINE, width=3)
            tl(d, 260, by + 55, "Code promo : CODE10", F("inter", 40, "SemiBold"), OFF)
            _check(d, 915, by + 55, 28)
    _footer(d, 4, N)
    out.append(img)

    # 5. le créateur
    img, d = canvas(POST, glow=(540, 520, 440, 280, 90))
    _title(d, 250, ["Et tu soutiens", "ton créateur."], 100, colors=[OFF, LILAS])
    d.rounded_rectangle((110, 450, 970, 740), radius=44, fill=SLATE, outline=VIO, width=4)
    fc = F("syne", min(fit(d, "1 code", 760, 110).size, fit(d, "= 1 créateur", 760, 110).size))
    tc(d, 540, 540, "1 code", fc, OFF)
    tc(d, 540, 650, "= 1 créateur", fc, LILAS)
    _paragraph(d, 830, "Le code que tu copies, c'est celui du créateur qui l'a partagé. En l'utilisant, tu le soutiens directement.", 42, 840, GREY)
    _footer(d, 5, N)
    out.append(img)

    # 6. gratuit
    img, d = canvas(POST)
    _title(d, 230, ["Et c'est", "gratuit."], 120, colors=[OFF, LILAS])
    for k, label in enumerate(["Sans compte", "Sans extension à installer", "Des codes à jour, chaque jour"]):
        y = 540 + k * 175
        d.rounded_rectangle((110, y, 970, y + 140), radius=36, fill=SLATE, outline=LINE, width=3)
        _check(d, 190, y + 70, 34)
        tl(d, 255, y + 70, label, fit(d, label, 680, 48, "inter", "Bold"), OFF)
    _footer(d, 6, N)
    out.append(img)

    # 7. fin
    out.append(end_slide("Lien en bio · Enregistre ce post"))
    tl(ImageDraw.Draw(out[-1]), 80, 1265, f"{N}/{N}", F("inter", 36, "Bold"), GREY)
    return out


ABOUT_CAPTION = """C'est quoi Backed ? 💜

Les meilleurs codes promo sont cachés : au milieu de vidéos YouTube de 20 minutes, en bas de descriptions que personne ne lit, dans des stories qui disparaissent.

Backed les rassemble au même endroit. Tu cherches une marque, tu copies le code, tu paies moins. Et tu soutiens le créateur qui l'a partagé.

Gratuit, sans compte → lien en bio

Avant de payer, passe par Backed.

#codepromo #bonplan #reduction #youtube #backed"""


def save(img, path):
    img.convert("RGB").save(path, optimize=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--about", required=True, help="Dossier de sortie du carrousel « C'est quoi Backed ? »")
    ap.add_argument("--createurs", type=int)
    ap.add_argument("--codes", type=int)
    a = ap.parse_args()
    os.makedirs(a.about, exist_ok=True)
    for k, im in enumerate(about_slides(a.createurs, a.codes)):
        save(im, os.path.join(a.about, f"{k + 1:02d}.png"))
    with open(os.path.join(a.about, "legende.txt"), "w", encoding="utf-8") as f:
        f.write(ABOUT_CAPTION + "\n")
    print(f"✅ {a.about}")
