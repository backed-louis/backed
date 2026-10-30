"""Démo écran de backed.fr en vidéo verticale (1080×1920) : on cherche une marque, on copie le code.

Filmé dans un vrai navigateur (Playwright, écran de téléphone), puis monté dans la DA des vidéos :
accroche, écran zoomé sur l'action avec les étapes, fin « Avant de payer, passe par Backed. ».
Les clics de la démo ne sont pas comptés (les appels /api/track sont bloqués).

Usage (dans GitHub Actions, où backed.fr est joignable) :
  pip install playwright Pillow numpy scipy && python -m playwright install --with-deps chromium
  python3 scripts/demo/demo_ecran.py --marque Emma --out out/demo
"""
import argparse
import asyncio
import base64
import io
import json
import math
import os
import sys
import time

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "reels"))
import render  # noqa: E402
from render import F, fit, text_c, eo, prog, clamp, VIO, LILAS, OFF, GREY, GREEN, CX, SW  # noqa: E402

VW, VH, DSF = 360, 780, 3          # écran de téléphone filmé (px CSS) et densité
UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")


# ------------------------------------------------------------------ tournage
async def film(url, marque, out):
    from playwright.async_api import async_playwright
    frames, events = [], {}
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": VW, "height": VH}, device_scale_factor=DSF,
                                        is_mobile=True, has_touch=True, locale="fr-FR", user_agent=UA)
        await ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=url)
        page = await ctx.new_page()
        await page.route("**/api/track/**", lambda r: r.abort())  # la démo ne compte pas de clics
        await page.goto(url + "/explorer", wait_until="networkidle")
        await page.wait_for_timeout(800)

        cdp = await ctx.new_cdp_session(page)

        def on_frame(ev):
            frames.append((ev["metadata"]["timestamp"], ev["data"]))
            asyncio.ensure_future(cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]}))

        cdp.on("Page.screencastFrame", on_frame)
        await cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 85, "everyNthFrame": 1,
                                                "maxWidth": VW * DSF, "maxHeight": VH * DSF})
        await page.wait_for_timeout(1200)

        box = page.locator("input[type=text]").first
        await box.scroll_into_view_if_needed()
        await page.wait_for_timeout(300)
        events["input"] = await box.bounding_box()
        events["tap_search"] = time.time()
        await box.tap()
        await page.wait_for_timeout(350)
        events["type_start"] = time.time()
        await box.type(marque, delay=150)
        events["typed"] = time.time()
        await page.wait_for_timeout(900)

        btn = page.locator(".offer-card button").first
        bb = await btn.bounding_box()
        card = await page.locator(".offer-card").first.bounding_box()
        if bb and bb["y"] + bb["height"] > VH - 40:  # le résultat est sous l'écran : on fait défiler doucement
            dy = bb["y"] + bb["height"] - VH * 0.6
            for _ in range(12):
                await page.mouse.wheel(0, dy / 12)
                await page.wait_for_timeout(30)
            await page.wait_for_timeout(500)
            bb = await btn.bounding_box()
            card = await page.locator(".offer-card").first.bounding_box()
        events["button"], events["card"] = bb, card
        events["focus"] = time.time()   # la caméra du montage glisse vers le bouton (0,6 s), puis on appuie
        events["code"] = (await btn.inner_text()).strip()
        await page.wait_for_timeout(1000)
        events["tap_copy"] = time.time()
        await btn.tap()
        await page.wait_for_timeout(1800)
        events["end"] = time.time()
        await cdp.send("Page.stopScreencast")
        await browser.close()

    os.makedirs(out, exist_ok=True)
    t0 = frames[0][0]
    for k in ("tap_search", "type_start", "typed", "focus", "tap_copy", "end"):
        events[k] -= t0
    with open(os.path.join(out, "tournage.json"), "w") as f:
        json.dump({"events": events, "frames": [(t - t0, d) for t, d in frames]}, f)
    return events, [(t - t0, d) for t, d in frames]


# ------------------------------------------------------------------ montage
WIN_W = SW                  # largeur de la fenêtre zoomée à l'écran (800 px)
WIN_Y0 = 455                # haut de la fenêtre
CROP_H = 430                # hauteur de la zone filmée montrée (px CSS)
SCALE = WIN_W / VW          # px vidéo par px CSS
WIN_H = int(CROP_H * SCALE)


def screen_scene(frames, ev, start, dur):
    """L'écran filmé, zoomé sur l'action : la caméra suit la recherche puis le bouton du code."""
    decoded = {}

    def frame_at(t):
        k = 0
        for i, (ft, _) in enumerate(frames):
            if ft <= t:
                k = i
            else:
                break
        if k not in decoded:
            decoded.clear()
            decoded[k] = Image.open(io.BytesIO(base64.b64decode(frames[k][1]))).convert("RGB")
        return decoded[k]

    inp, btn = ev["input"], ev["button"]
    y_search = inp["y"] - 70                                    # recherche en haut, les résultats dessous
    y_card = (btn["y"] + btn["height"] / 2) - CROP_H * 0.55     # le bouton du code un peu sous le centre
    t_move = ev.get("focus", ev["typed"] + 0.15)

    def cam_top(t):
        p = eo(prog(t, t_move, 0.6))
        top = y_search + (y_card - y_search) * p
        return clamp(top, 0, VH - CROP_H)

    steps = [(0.0, "1", "Cherche ta marque"), (ev["typed"] + 0.15 - start, "2", "Copie le code"),
             (ev["tap_copy"] + 0.45 - start, "3", "Colle-le au paiement")]

    def fn(img, d, lt):
        render.bg(d)
        t = start + lt
        # étape en cours (en haut, dans la zone sûre)
        cur = max((s for s in steps if lt >= s[0]), key=lambda s: s[0])
        p = eo(prog(lt, cur[0], 0.3))
        d.ellipse((CX - SW / 2, 330 - 42, CX - SW / 2 + 84, 330 + 42), fill=VIO)
        text_c_at(d, CX - SW / 2 + 42, 330, cur[1], F("inter", 46, "Bold"), OFF)
        lab = fit(d, cur[2], SW - 110, 64)
        bx = CX - SW / 2 + 110
        b = d.textbbox((0, 0), cur[2], font=lab)
        d.text((bx - b[0] + 30 * (1 - p), 330 - (b[3] - b[1]) / 2 - b[1]), cur[2], font=lab, fill=OFF + (int(255 * p),))
        # fenêtre de l'écran filmé
        top = cam_top(t)
        fr = frame_at(t)
        k = fr.width / VW  # px de l'image filmée par px CSS
        crop = fr.crop((0, int(top * k), fr.width, int((top + CROP_H) * k))).resize((WIN_W, WIN_H), Image.LANCZOS)
        x0 = int(CX - WIN_W / 2)
        win = Image.new("RGBA", (WIN_W, WIN_H))
        win.paste(crop, (0, 0))
        m = Image.new("L", (WIN_W, WIN_H), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, WIN_W - 1, WIN_H - 1), radius=36, fill=255)
        win.putalpha(m)
        img.paste(win, (x0, WIN_Y0), win)
        d.rounded_rectangle((x0 - 3, WIN_Y0 - 3, x0 + WIN_W + 2, WIN_Y0 + WIN_H + 2), radius=38, outline=VIO, width=5)
        # doigt : cercle qui s'enfonce au moment des appuis
        for key, bbx in (("tap_search", inp), ("tap_copy", btn)):
            tp = t - ev[key]
            if -0.25 < tp < 0.6:
                cx = x0 + (bbx["x"] + bbx["width"] / 2) * SCALE
                cy = WIN_Y0 + (bbx["y"] + bbx["height"] / 2 - top) * SCALE
                if tp < 0:
                    r, a = 46, clamp(1 + tp / 0.25)
                else:
                    r, a = 46 + 60 * eo(clamp(tp / 0.6)), 1 - clamp(tp / 0.6)
                d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 255, 255, int(90 * a)), outline=(255, 255, 255, int(220 * a)), width=4)
        # sous la fenêtre : le rappel du gain
        if lt >= steps[2][0]:
            q = eo(prog(lt, steps[2][0], 0.35))
            msg = "Tu paies moins. Le créateur est soutenu."
            text_c(d, WIN_Y0 + WIN_H + 70, msg, fit(d, msg, SW, 44, "inter", "Bold"), GREEN, alpha=q)
    return fn


def text_c_at(d, x, y, s, f, fill):
    b = d.textbbox((0, 0), s, font=f)
    d.text((x - (b[2] - b[0]) / 2 - b[0], y - (b[3] - b[1]) / 2 - b[1]), s, font=f, fill=fill)


def s_demo_hook():
    def fn(img, d, lt):
        render.bg(d)
        text_c(d, 400, "LE RÉFLEXE BACKED", F("inter", 40, "Bold"), GREY)
        f = F("syne", min(fit(d, "Avant de payer", SW, 130).size, fit(d, "en ligne,", SW, 130).size))
        text_c(d, 620, "Avant de payer", f, OFF)
        text_c(d, 620 + f.size * 1.1, "en ligne,", f, OFF)
        g = fit(d, "fais ça.", SW, 170)
        text_c(d, 640 + f.size * 2.3, "fais ça.", g, LILAS)
        a = 0.55 + 0.45 * abs(math.sin(lt * 4))
        text_c(d, 1290, "10 secondes ↓", F("inter", 46, "Bold"), OFF, alpha=a)
    return fn


def monter(frames, ev, out, marque):
    start = max(0.0, ev["tap_search"] - 0.9)
    dur = ev["end"] - start
    shots = [(1.6, s_demo_hook()), (dur, screen_scene(frames, ev, start, dur)), (render.OUTRO_DUR, render.s_outro())]
    path = os.path.join(out, f"demo-{marque.lower().replace(' ', '-')}.mp4")
    total = render.encode(shots, path, variante=1)
    # planche pour vérifier sans ouvrir la vidéo
    times = [0.8, 1.6 + 0.5, 1.6 + (ev["typed"] - start), 1.6 + (ev["tap_copy"] - start) + 0.2,
             1.6 + dur - 0.2, 1.6 + dur + render.OUTRO_DUR - 0.1]
    ims = [render.render(shots, t).resize((270, 480)) for t in times]
    sheet = Image.new("RGB", (len(ims) * 286 - 16, 480), (255, 255, 255))
    for i, im in enumerate(ims):
        sheet.paste(im, (i * 286, 0))
    sheet.save(os.path.join(out, "apercu.jpg"), quality=85)
    return path, total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="https://backed.fr")
    ap.add_argument("--marque", default="Emma")
    ap.add_argument("--out", default="out/demo")
    ap.add_argument("--tournage", help="Remonter à partir d'un tournage.json existant (sans refilmer)")
    a = ap.parse_args()
    if a.tournage:
        data = json.load(open(a.tournage))
        ev, frames = data["events"], [tuple(x) for x in data["frames"]]
    else:
        ev, frames = asyncio.run(film(a.url, a.marque, a.out))
    print(f"🎥 {len(frames)} images filmées, code copié : {ev.get('code')}", flush=True)
    path, total = monter(frames, ev, a.out, a.marque)
    print(f"✅ {path} ({total:.1f} s)")


if __name__ == "__main__":
    main()
