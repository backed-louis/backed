"""Couverture des vidéos « Code du jour » : la première image montre le créateur, la marque et la remise.

TikTok prend la première image de la vidéo comme couverture (thumbnailOffset 0 dans Buffer). On ajoute donc au tout
début de la vidéo 2 images (≈ 0,07 s) : l'image à 1 s (logo, marque, carte de remise), descendue un peu, avec
« LE CODE DE » + le nom du créateur au-dessus. Tout tient dans la zone visible de la grille TikTok (recadrage 3:4,
de y = 240 à y = 1680 sur une vidéo 1080 × 1920).

  python3 scripts/reels/couverture.py video.mp4 "Créateur" [sortie.mp4]       # sans sortie : remplace la vidéo
  python3 scripts/reels/couverture.py --image video.mp4 "Créateur" image.jpg  # seulement l'image (couverture à importer)
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
LABEL = (167, 139, 250)
GLOW = (139, 0, 255, 160)
W, H = 1080, 1920
TOP = 600        # haut du bloc logo + marque après décalage
IMAGES = 2       # images de couverture ajoutées au début de la vidéo


def _font(name, size, var):
    f = ImageFont.truetype(os.path.join(FONTS, f"{name}.ttf"), size)
    f.set_variation_by_name(var)
    return f


def _spaced(d, cx, y, text, font, fill, sp):
    w = sum(d.textlength(c, font=font) for c in text) + sp * (len(text) - 1)
    x = cx - w / 2
    for c in text:
        d.text((x, y), c, font=font, fill=fill, anchor="ls")
        x += d.textlength(c, font=font) + sp


def image(frame, createur, label="LE CODE DE"):
    """frame : l'image de la vidéo à 1 s. Renvoie la couverture 1080 × 1920 (label : « LES CODES DE » pour un top 3)."""
    o = frame.convert("RGB").resize((W, H))
    a = np.asarray(o.convert("L"))
    rows = np.where(a.max(axis=1) > 60)[0]
    top = int(rows.min()) if len(rows) else 445
    shift = max(0, TOP - top)
    im = o.copy()
    im.paste(o.crop((0, top - 30, W, 1350)), (0, top - 30 + shift))
    im.paste(o.crop((0, 0, W, top - 30)).resize((W, top - 30 + shift)), (0, 0))
    size = 128
    d0 = ImageDraw.Draw(im)
    while d0.textlength(createur, font=_font("Syne", size, "ExtraBold")) > 880 and size > 44:
        size -= 4
    nom = _font("Syne", size, "ExtraBold")
    glow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).text((W // 2, 470), createur, font=nom, fill=GLOW, anchor="ms")
    im = Image.alpha_composite(im.convert("RGBA"), glow.filter(ImageFilter.GaussianBlur(30)))
    d = ImageDraw.Draw(im)
    _spaced(d, W // 2, 350, label, _font("Mono", 36, "Medium"), LABEL, 12)
    d.text((W // 2, 470), createur, font=nom, fill=(255, 255, 255), anchor="ms")
    return im.convert("RGB")


def _probe(src):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-of", "json", src],
                         check=True, capture_output=True, text=True).stdout
    streams = json.loads(out)["streams"]
    v = next(s for s in streams if s["codec_type"] == "video")
    a = next((s for s in streams if s["codec_type"] == "audio"), None)
    num, den = v.get("r_frame_rate", "30/1").split("/")
    return round(int(num) / int(den)) or 30, (int(a["sample_rate"]) if a else None)


def frame_a_1s(src, dst):
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-ss", "1", "-i", src,
                    "-frames:v", "1", dst], check=True)


def appliquer(src, createur, dst=None):
    """Ajoute la couverture (créateur + marque + remise) en première image de la vidéo src."""
    dst = dst or src
    fps, sr = _probe(src)
    with tempfile.TemporaryDirectory() as tmp:
        f1, cov, out = (os.path.join(tmp, n) for n in ("f.png", "c.png", "o.mp4"))
        frame_a_1s(src, f1)
        image(Image.open(f1), createur).save(cov)
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
    if args and args[0] == "--image":
        _, src, createur, dst = args
        with tempfile.TemporaryDirectory() as tmp:
            f1 = os.path.join(tmp, "f.png")
            frame_a_1s(src, f1)
            image(Image.open(f1), createur).save(dst, quality=92)
    else:
        appliquer(args[0], args[1], args[2] if len(args) > 2 else None)
