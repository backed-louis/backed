"""Moteur des vidéos premium de Backed : une page HTML par format (code_du_jour.html, top3.html), dont chaque
image est calculée par window.render(t) et filmée dans Chromium (Playwright), un fichier par plan joint sans
réencodage, puis la musique Backed (musique.py).

Utilisé par generate_week.py :
  with Moteur() as m:
      m.video("code_du_jour.html", offer_data(o), "out/01.mp4", variante=0)
      m.images("code_du_jour.html", offer_data(o))   # quelques images pour l'aperçu
"""
import base64
import io
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REELS = os.path.join(HERE, "..", "reels")
sys.path.insert(0, REELS)

FPS = 30
TYPE_T0, TYPE_DT = 0.20, 0.085                   # mêmes temps que commun.js (fin Backed)
DOT_T = TYPE_T0 + 6 * TYPE_DT + 0.06
_faces = None


def _fonts():
    global _faces
    if _faces is None:
        out = []
        for fam, f in (("Syne", "Syne.ttf"), ("Inter", "Inter.ttf"), ("Mono", "Mono.ttf")):
            b64 = base64.b64encode(open(os.path.join(REELS, "fonts", f), "rb").read()).decode()
            out.append(f'@font-face{{font-family:"{fam}";src:url(data:font/ttf;base64,{b64}) format("truetype");font-weight:100 900;}}')
        _faces = "\n".join(out)
    return _faces


def page_html(template, data=None):
    html = open(os.path.join(HERE, template), encoding="utf-8").read()
    html = html.replace("/*FONTS*/", _fonts(), 1)
    if "/*COMMUN_CSS*/" in html:
        html = html.replace("/*COMMUN_CSS*/", open(os.path.join(HERE, "commun.css"), encoding="utf-8").read(), 1)
    if "/*COMMUN_JS*/" in html:
        html = html.replace("/*COMMUN_JS*/", open(os.path.join(HERE, "commun.js"), encoding="utf-8").read(), 1)
    if data is not None:
        a = html.index("window.DATA = /*DATA*/") + len("window.DATA = ")
        b = html.index("/*END*/", a) + len("/*END*/")
        html = html[:a] + json.dumps(data, ensure_ascii=False).replace("</", "<\\/") + html[b:]
    return html


# ------------------------------------------------------------------ données
def logo_data(img):
    """(data URI, style de tuile) pour un logo PIL : « opaque » (carré plein cadre), « pad » (sur blanc),
    « pad-dark » (logo clair, sur sombre)."""
    if img is None:
        return None, "pad"
    from PIL import ImageStat
    lg = img.convert("RGBA")
    a = lg.getchannel("A")
    w, h = lg.size
    corners = [a.getpixel(p) for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    if min(corners) > 200 and abs(w - h) <= max(2, w // 50):
        style = "opaque"
    else:
        box = a.point(lambda v: 255 if v > 16 else 0).getbbox()
        if box:
            lg = lg.crop(box)
        vis = lg.getchannel("A").point(lambda v: 255 if v > 128 else 0)
        light = vis.getbbox() is not None and ImageStat.Stat(lg.convert("L"), mask=vis).mean[0] > 215
        style = "pad-dark" if light else "pad"
    lg.thumbnail((320, 320))
    buf = io.BytesIO()
    lg.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(), style


def offer_data(o):
    """Ce qu'il faut à code_du_jour.html, depuis une offre de generate_week.pick_offers."""
    import render
    logo, style = logo_data(o.get("logo"))
    benefit = o.get("benefit") or ""
    return {
        "marque": o["brand"], "code": o["code"], "createur": o.get("creator") or "",
        "avantage": render.first_clause(benefit, 90),
        "gainBig": o.get("disc") or "",
        "gainText": "" if o.get("disc") else (o.get("gain") or render.hook_gain(benefit or o["brand"], 46)),
        "remise": o.get("pct") or 0, "logo": logo, "logoStyle": style,
    }


def top_data(items):
    out = []
    for o in items:
        logo, style = logo_data(o.get("logo"))
        out.append({"marque": o["brand"], "code": o["code"], "createur": o.get("creator") or "",
                    "disc": o.get("disc") or "", "logo": logo, "logoStyle": style})
    return {"items": out}


# ------------------------------------------------------------------ rendu
class Moteur:
    def __enter__(self):
        from playwright.sync_api import sync_playwright
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch()
        self.page = None
        self._loaded = None
        return self

    def __exit__(self, *exc):
        self._browser.close()
        self._pw.stop()

    def charger(self, template, data):
        key = (template, json.dumps(data, sort_keys=True))
        if self._loaded != key:
            # une page neuve à chaque vidéo : set_content garderait les variables de la précédente
            if self.page:
                self.page.close()
            self.page = self._browser.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
            self.page.on("pageerror", lambda e: print(f"⚠️ erreur dans la page : {e}", flush=True))
            self.page.set_content(page_html(template, data))
            self.page.wait_for_function("window.READY === true", timeout=60000)
            self.meta = self.page.evaluate("({d: window.DUREE, cuts: window.CUTS, outro: window.OUTRO_T, clicks: window.CLICKS || []})")
            self._loaded = key
        return self.meta

    def images(self, template, data, times=None):
        """Quelques images de la vidéo (PIL), par défaut une par plan."""
        from PIL import Image
        meta = self.charger(template, data)
        cuts = meta["cuts"]
        if times is None:
            times = [a + .72 * (b - a) for a, b in zip(cuts[:-1], cuts[1:])]
            times[-1] = cuts[-1] - .1
        out = []
        for t in times:
            self.page.evaluate(f"render({t})")
            out.append(Image.open(io.BytesIO(self.page.screenshot(type="png"))).convert("RGB"))
        return out

    def video(self, template, data, path, variante=0):
        """Rend la vidéo dans `path` (mp4 H.264, 30 i/s, son AAC) ; renvoie sa durée."""
        meta = self.charger(template, data)
        cuts, dur = meta["cuts"], meta["d"]
        with tempfile.TemporaryDirectory(dir=os.path.dirname(os.path.abspath(path)) or ".") as tmp:
            parts = []
            for k in range(len(cuts) - 1):
                final, part = os.path.join(tmp, f"plan{k}.mp4"), os.path.join(tmp, f"plan{k}.tmp.mp4")
                ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS),
                                       "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "19",
                                       "-pix_fmt", "yuv420p", "-r", str(FPS), part], stdin=subprocess.PIPE)
                for i in range(round(cuts[k] * FPS), round(cuts[k + 1] * FPS)):
                    self.page.evaluate(f"render({i / FPS})")
                    ff.stdin.write(self.page.screenshot(type="jpeg", quality=92))
                ff.stdin.close()
                if ff.wait() != 0:
                    raise RuntimeError(f"ffmpeg a échoué ({path}, plan {k})")
                os.replace(part, final)
                parts.append(final)
            lst = os.path.join(tmp, "plans.txt")
            with open(lst, "w") as f:
                f.writelines(f"file '{p}'\n" for p in parts)
            video = os.path.join(tmp, "video.mp4")
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", video], check=True)
            import musique
            wav = os.path.join(tmp, "son.wav")
            outro = meta["outro"]
            clicks = list(meta["clicks"]) + [outro + TYPE_T0 + i * TYPE_DT for i in range(6)]
            musique.make_music(wav, dur, cuts[1:-1], variante, sig_at=outro + DOT_T, clicks=clicks)
            tmp_out = os.path.join(tmp, "final.mp4")
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", video, "-i", wav, "-map", "0:v", "-map", "1:a",
                            "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=7", "-c:a", "aac", "-b:a", "192k",
                            "-ar", "44100", "-shortest", "-movflags", "+faststart", tmp_out], check=True)
            os.replace(tmp_out, path)
        return dur
