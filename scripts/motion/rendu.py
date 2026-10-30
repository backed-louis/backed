"""Rendu du motion « Le réflexe Backed » (demo.html) en vidéo verticale 1080×1920, 30 images/s, avec la musique Backed.

L'animation est une page HTML dont chaque image est calculée par window.render(t), puis filmée image par
image dans Chromium (Playwright) : le rendu est net et identique d'une fois sur l'autre.

Usage :
  # avec l'offre réelle (Airtable) et le vrai logo de la marque, dans GitHub Actions :
  AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... python3 scripts/motion/rendu.py --marque Emma --out out/motion
  # en local, avec les données par défaut de demo.html (sans logo) :
  python3 scripts/motion/rendu.py --local --out out/motion
  # quelques images seulement, pour vérifier la mise en page :
  python3 scripts/motion/rendu.py --local --apercu --out out/motion
"""
import argparse
import base64
import io
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REELS = os.path.join(HERE, "..", "reels")
sys.path.insert(0, REELS)

FPS = 30
CUTS = [0.0, 2.0, 5.6, 7.7, 11.3, 14.7]        # un fichier par plan, joints sans réencodage
OUTRO = 11.3                                     # début de la fin (logo) : signature sonore
TYPE_T0, TYPE_DT = 0.20, 0.085                   # mêmes temps que la fin des vidéos (render.py)
DOT_T = TYPE_T0 + 6 * TYPE_DT + 0.06
APERCU = [0.95, 2.9, 4.1, 5.0, 6.0, 6.5, 7.1, 8.6, 10.5, 12.3, 13.4, 14.65]


# ------------------------------------------------------------------ données
def offre_airtable(marque):
    """L'offre avec code la plus copiée de la marque, et ce qu'il faut pour l'afficher."""
    import generate_week as gw
    import logos
    import render
    brands = gw.fetch_table("Brands", {"filterByFormula": f'LOWER({{Name}})="{marque.lower()}"'})
    if not brands:
        sys.exit(f"Marque introuvable dans Airtable : {marque}")
    b = brands[0]
    offers = [o for o in gw.fetch_table("Offers", {"filterByFormula": 'AND({Status}="Active", {Code}!="")'})
              if b["id"] in (o["fields"].get("Brand") or [])]
    if not offers:
        sys.exit(f"Aucune offre active avec code pour {marque}")
    o = max(offers, key=lambda r: r["fields"].get("Clicks") or 0)["fields"]
    createur = ""
    if o.get("Creator"):
        cr = gw.fetch_table("Creators", {"filterByFormula": f'RECORD_ID()="{o["Creator"][0]}"'})
        createur = cr[0]["fields"].get("Name", "") if cr else ""
    bf = b["fields"]
    logo = logos.fetch(bf.get("Name", marque), bf.get("Website", ""), logos.airtable_urls(bf.get("Logo")))
    data_uri = None
    if logo is not None:
        buf = io.BytesIO()
        logo.save(buf, "PNG")
        data_uri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    benefit = str(o.get("Benefit") or "").strip()
    return {"marque": bf.get("Name", marque), "code": str(o["Code"]).strip(), "createur": createur,
            "description": bf.get("Description", ""), "avantage": render.first_clause(benefit, 90),
            "remise": render.percent_of(benefit) or 0, "prix": 249, "logo": data_uri}


def page_html(data):
    html = open(os.path.join(HERE, "demo.html"), encoding="utf-8").read()
    faces = []
    for fam, f in (("Syne", "Syne.ttf"), ("Inter", "Inter.ttf"), ("Mono", "Mono.ttf")):
        b64 = base64.b64encode(open(os.path.join(REELS, "fonts", f), "rb").read()).decode()
        faces.append(f'@font-face{{font-family:"{fam}";src:url(data:font/ttf;base64,{b64}) format("truetype");font-weight:100 900;}}')
    html = html.replace("/*FONTS*/", "\n".join(faces))
    if data:
        a, b = html.index("/*DATA*/"), html.index("/*END*/") + len("/*END*/")
        html = html[:a] + json.dumps(data, ensure_ascii=False) + html[b:]
    return html


# ------------------------------------------------------------------ rendu
def ouvrir(p, html):
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
    page.set_content(html)
    page.wait_for_function("window.READY === true", timeout=30000)
    return browser, page


def apercu(page, out):
    from PIL import Image
    ims = []
    for t in APERCU:
        page.evaluate(f"render({t})")
        im = Image.open(io.BytesIO(page.screenshot(type="png")))
        im.save(os.path.join(out, f"image-{t:05.2f}.png"))
        ims.append(im.convert("RGB").resize((270, 480)))
    cols = 6
    sheet = Image.new("RGB", (cols * 286 - 16, ((len(ims) + cols - 1) // cols) * 496 - 16), (255, 255, 255))
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % cols) * 286, (i // cols) * 496))
    sheet.save(os.path.join(out, "apercu.jpg"), quality=88)


def plans(page, out):
    """Un fichier par plan (nom temporaire renommé si ffmpeg réussit), puis jointure sans réencodage."""
    parts = []
    for k in range(len(CUTS) - 1):
        final = os.path.join(out, f"plan{k}.mp4")
        tmp = os.path.join(out, f"plan{k}.tmp.mp4")
        ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg",
                               "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
                               "-r", str(FPS), "-movflags", "+faststart", tmp], stdin=subprocess.PIPE)
        for i in range(round(CUTS[k] * FPS), round(CUTS[k + 1] * FPS)):
            page.evaluate(f"render({i / FPS})")
            ff.stdin.write(page.screenshot(type="jpeg", quality=92))
        ff.stdin.close()
        if ff.wait() != 0:
            raise RuntimeError(f"ffmpeg a échoué pour le plan {k}")
        os.replace(tmp, final)
        parts.append(final)
        print(f"  plan {k + 1}/{len(CUTS) - 1}", flush=True)
    lst = os.path.join(out, "plans.txt")
    with open(lst, "w") as f:
        f.writelines(f"file '{os.path.abspath(p)}'\n" for p in parts)
    video = os.path.join(out, "video.mp4")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", video], check=True)
    for p in parts:
        os.remove(p)
    os.remove(lst)
    return video


def son(video, path, variante):
    import musique
    dur = CUTS[-1]
    wav = path + ".wav"
    tapes = [3.62 + 0.14 * i for i in range(4)] + [OUTRO + TYPE_T0 + i * TYPE_DT for i in range(6)]
    musique.make_music(wav, dur, CUTS[1:-1], variante, sig_at=OUTRO + DOT_T, clicks=tapes)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=7", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-shortest",
                    "-movflags", "+faststart", path], check=True)
    os.remove(wav)
    os.remove(video)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--marque", default="Emma")
    ap.add_argument("--out", default="out/motion")
    ap.add_argument("--local", action="store_true", help="Données par défaut de demo.html, sans Airtable")
    ap.add_argument("--apercu", action="store_true", help="Quelques images seulement (apercu.jpg)")
    ap.add_argument("--variante", type=int, default=2, help="Musique (0 à 3)")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    data = None if a.local else offre_airtable(a.marque)
    if data:
        print(f"🎯 {data['marque']} — code {data['code']}" + (f" ({data['createur']})" if data["createur"] else "")
              + (", logo trouvé" if data["logo"] else ", sans logo"), flush=True)
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser, page = ouvrir(p, page_html(data))
        apercu(page, a.out)
        if not a.apercu:
            video = plans(page, a.out)
            name = (data or {}).get("marque", "demo").lower().replace(" ", "-")
            path = os.path.join(a.out, f"backed-motion-{name}.mp4")
            son(video, path, a.variante)
            print(f"✅ {path}")
        browser.close()


if __name__ == "__main__":
    main()
