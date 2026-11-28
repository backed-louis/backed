"""Couverture des vidéos TikTok : une image dédiée, pensée pour la grille du profil, mise en première image de la vidéo.

TikTok prend la première image de la vidéo comme couverture (thumbnailOffset 0 dans Buffer) et l'affiche recadrée en
3:4 sur le profil (de y = 240 à y = 1680 sur une vidéo 1080 × 1920). On ajoute donc au tout début de la vidéo
2 images (≈ 0,07 s) avec, centrés dans cette zone :
- code du jour : « le code de » + le créateur en très gros surligné en vert acide, le logo et le nom de la marque,
  puis la remise en énorme, sur le fond nuit au halo violet ;
- top 3 : « TOP 3 » et, pour chaque code, le logo, la marque et le créateur, sur le fond violet en relief.

  python3 scripts/reels/couverture.py video.mp4 couverture.jpg [sortie.mp4]          # ajoute l'image en tête
  python3 scripts/reels/couverture.py --offre "Créateur" "Marque" logo.png "-10 %" sortie.jpg   # seulement l'image
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from render import (F, fit, tsize, wrap, logo_tile, first_clause, halo_bg, violet_bg, hl_layer,  # noqa: E402
                    NIGHT, VIO, LILAS, OFF, SOFT)

W, H = 1080, 1920
TOP, BOT = 240, 1680   # zone visible sur la grille du profil (3:4)
START = 300
IMAGES = 2             # images de couverture ajoutées au début de la vidéo


# ------------------------------------------------------------------ dessin
def _base(violet=False):
    img = Image.new("RGB", (W, H), NIGHT)
    if violet:
        img.paste(violet_bg())
    else:
        halo_bg(img)
    img = img.convert("RGBA")
    return img, ImageDraw.Draw(img)


def _hl(img, cx, yc, s, f):
    lay = hl_layer(ImageDraw.Draw(img), s, f, 2)
    img.alpha_composite(lay, (int(cx - lay.width / 2), int(yc - lay.height / 2)))


def _tc(d, cx, yc, s, f, fill):
    b, w, h = tsize(d, s, f)
    d.text((cx - w / 2 - b[0], yc - h / 2 - b[1]), s, font=f, fill=fill)


def _glow(img, cx, yc, s, f, fill, glow=VIO + (200,), blur=24):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    _tc(ImageDraw.Draw(layer), cx, yc, s, f, glow)
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))
    _tc(ImageDraw.Draw(img), cx, yc, s, f, fill)


def _lines(d, text, maxw, size, min_size, max_lines=2):
    """Plus grande police Syne (≤ size) pour laquelle le texte tient en max_lines lignes de maxw."""
    s = size
    while True:
        f = F("syne", s)
        ls = wrap(d, text, f, maxw)
        if (len(ls) <= max_lines and all(tsize(d, ln, f)[1] <= maxw for ln in ls)) or s <= min_size:
            return ls[:max_lines], f
        s -= 4


def _centered(build):
    """Dessine une première fois pour mesurer, puis recentre le bloc dans la zone visible du profil."""
    _, end = build(0)
    h = end - START
    return build(max(0, ((TOP + BOT) / 2 - 30) - (START + h / 2)))[0]


def gain_court(o):
    """La remise en quelques mots : « -10 % », « -15 % livraison », « Jusqu'à 270 € offerts »."""
    if o.get("disc"):
        return o["disc"]
    if o.get("gain"):
        return o["gain"].replace(" sur la livraison", " livraison")
    t = first_clause(o.get("benefit") or "", 500)
    t = re.sub(r"(\d)\s?(%|€)", "\\1 \\2", t)
    reduc = " de réduction" in t
    head = t.split(" sur ")[0]
    if head != t and re.fullmatch(r"-?\d+ (%|€)", head):   # « -22 € sur la MagGo 2 Pro » → « -22 € »
        t = head
    if len(t) > 28:
        # « -300 € sur le Xiaomi 18 Pro Max » → « -300 € » ; « Jusqu'à 270 € offerts à l'ouverture… » → « Jusqu'à 270 € offerts »
        for sep in (" de réduction", " pour ", " sur ", " avec ", " à partir ", " dès ", " chez ", " pendant ",
                    " lors ", " en ", " via ", " à l'", " à la ", " jusqu'au "):
            head = t.split(sep)[0].strip()
            if head != t and len(head) <= 28 and (re.search(r"\d", head) or len(head) >= 14):
                t = head
                break
        else:   # coupé à la fin d'un mot
            t = t[:29].rsplit(" ", 1)[0]
    t = t.replace(" de réduction", "")
    if reduc:   # « Jusqu'à 85 € de réduction » → « Jusqu'à -85 € »
        t = re.sub(r"^(Jusqu'à|jusqu'à)\s+(\d)", "\\1 -\\2", t)
    return t


def _offre(off, createur, marque, logo, gain):
    img, d = _base()
    _tc(d, 540, START + 30 + off, "le code de", F("syne", 72), OFF)
    ls, f = _lines(d, createur, 900, 150, 80)
    y = START + 110 + off
    for ln in ls:
        _hl(img, 540, y + f.size * 0.6, ln, f)
        y += f.size * 1.3
    y += 40
    if logo is not None:
        t = logo_tile(logo, 250)
        img.alpha_composite(t, (540 - 125, int(y)))
        y += 250 + 40
    fb = fit(d, marque, 940, 110)
    _tc(d, 540, y + fb.size / 2, marque, fb, OFF)
    y += fb.size + 50
    f1 = fit(d, gain, 980, 240)
    ls, f = ([gain], f1) if f1.size >= 150 else _lines(d, gain, 980, 200, 70, max_lines=3)
    for ln in ls:
        _tc(d, 540, y + f.size / 2, ln, f, OFF)
        y += f.size
    return img, y


def offre(o):
    """Couverture d'un code du jour (o : offre du générateur, avec creator, brand, logo, disc/gain/benefit)."""
    return _centered(lambda off: _offre(off, o["creator"], o["brand"], o.get("logo"), gain_court(o))).convert("RGB")


def _top(off, items, titre):
    img, d = _base(violet=True)
    _tc(d, 540, START + 30 + off, titre, F("mono", 44, "ExtraBold"), SOFT)
    _tc(d, 540, START + 170 + off, "TOP 3" if len(items) == 3 else f"TOP {len(items)}", F("syne", 190), OFF)
    y = START + 320 + off
    T = 190
    for o in items:
        if o.get("logo") is not None:
            img.alpha_composite(logo_tile(o["logo"], T), (90, int(y)))
        fb = fit(d, o["brand"], 640, 92)
        b = tsize(d, o["brand"], fb)[0]
        d.text((330 - b[0], y + 18 - b[1]), o["brand"], font=fb, fill=OFF)
        if o.get("creator"):
            fc = fit(d, o["creator"], 640, 64, "inter", "Bold")
            b = tsize(d, o["creator"], fc)[0]
            d.text((330 - b[0], y + 130 - b[1]), o["creator"], font=fc, fill=SOFT)
        y += T + 60
    return img, y - 60


def top(items, titre="LES CODES EN TENDANCE"):
    return _centered(lambda off: _top(off, items, titre)).convert("RGB")


# ------------------------------------------------------------------ vidéo
def _probe(src):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-of", "json", src],
                         check=True, capture_output=True, text=True).stdout
    streams = json.loads(out)["streams"]
    v = next(s for s in streams if s["codec_type"] == "video")
    a = next((s for s in streams if s["codec_type"] == "audio"), None)
    num, den = v.get("r_frame_rate", "30/1").split("/")
    return round(int(num) / int(den)) or 30, (int(a["sample_rate"]) if a else None)


def appliquer(src, couv, dst=None):
    """Ajoute l'image couv (PIL, 1080 × 1920) en première image de la vidéo src."""
    dst = dst or src
    fps, sr = _probe(src)
    with tempfile.TemporaryDirectory() as tmp:
        cov, out = os.path.join(tmp, "c.png"), os.path.join(tmp, "o.mp4")
        couv.convert("RGB").resize((W, H)).save(cov)
        dur = f"{IMAGES / fps:.4f}"
        cmd = ["ffmpeg", "-nostdin", "-loglevel", "error", "-y",
               "-loop", "1", "-framerate", str(fps), "-t", dur, "-i", cov]
        if sr:
            cmd += ["-f", "lavfi", "-t", dur, "-i", f"anullsrc=r={sr}:cl=stereo", "-i", src,
                    "-filter_complex",
                    f"[0:v]scale={W}:{H},setsar=1,fps={fps},format=yuvj420p[c];[2:v]setsar=1,format=yuvj420p[v];"
                    "[c][1:a][v][2:a]concat=n=2:v=1:a=1[vo][ao]",
                    "-map", "[vo]", "-map", "[ao]", "-c:a", "aac", "-b:a", "192k"]
        else:
            cmd += ["-i", src, "-filter_complex",
                    f"[0:v]scale={W}:{H},setsar=1,fps={fps},format=yuvj420p[c];[1:v]setsar=1,format=yuvj420p[v];"
                    "[c][v]concat=n=2:v=1:a=0[vo]", "-map", "[vo]"]
        cmd += ["-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuvj420p",
                "-movflags", "+faststart", out]
        subprocess.run(cmd, check=True)
        shutil.move(out, dst)
    return dst


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "--offre":
        _, createur, marque, logo, gain, dst = args
        lg = Image.open(logo) if logo and os.path.exists(logo) else None
        offre({"creator": createur, "brand": marque, "logo": lg, "disc": gain}).save(dst, quality=92)
    else:
        appliquer(args[0], Image.open(args[1]), args[2] if len(args) > 2 else None)
