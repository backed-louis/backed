"""Génère les photos de Gérard Pleinpot (personnage photoréaliste créé par IA) avec un service gratuit (Pollinations, FLUX).
Même description et même graine pour chaque expression, pour garder le même visage."""
import os, sys, time, urllib.parse, urllib.request

OUT = sys.argv[1] if len(sys.argv) > 1 else "out/gerard"
os.makedirs(OUT, exist_ok=True)
BASE = ("candid vertical smartphone photo, photorealistic, a 55-year-old French man named Gerard, bald on top with a thin brown comb-over, "
        "thick bushy brown mustache, round thin metal glasses, slightly chubby friendly face, rosy cheeks, mustard-yellow knitted cardigan "
        "over a white shirt, sitting on a beige sofa in a modest French living room, warm evening lamp light, natural skin texture, "
        "shallow depth of field, medium shot, centered, looking natural")
EXPR = {
    "fier": "smug proud smile, chin up, one eyebrow raised, holding up a gold credit card next to his face, looking at the camera",
    "joie": "delighted big open-mouth grin, celebrating with a fist pump, gold credit card in the other hand, looking at the camera",
    "choc": "staring at his smartphone in total shock, mouth wide open, eyes wide open behind his glasses, eyebrows raised high",
    "depite": "defeated and dejected, slumped on the sofa, hand on his forehead, sad frown, smartphone in his lap, looking down",
}
SEEDS = [int(s) for s in os.environ.get("SEEDS", "1207,4242,9001").split(",")]
W, H = 864, 1536


def get(prompt, seed, path):
    q = urllib.parse.quote(prompt)
    urls = [f"https://image.pollinations.ai/prompt/{q}?width={W}&height={H}&seed={seed}&model=flux&nologo=true&private=true",
            f"https://gen.pollinations.ai/image/{q}?width={W}&height={H}&seed={seed}&model=flux&nologo=true"]
    for url in urls:
        for attempt in range(4):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "backed-gerard/1.0"})
                with urllib.request.urlopen(req, timeout=180) as r:
                    data = r.read()
                    ctype = r.headers.get("Content-Type", "")
                if ctype.startswith("image/") and len(data) > 20000:
                    open(path, "wb").write(data)
                    print(f"ok {path} ({len(data)//1024} Ko) via {url.split('/')[2]}", flush=True)
                    return True
                print(f"réponse inattendue {ctype} {len(data)} o : {data[:200]!r}", flush=True)
            except Exception as e:
                print(f"échec {url.split('/')[2]} essai {attempt + 1} : {e}", flush=True)
            time.sleep(15 * (attempt + 1))
    return False


ok = 0
for seed in SEEDS:
    for name, expr in EXPR.items():
        ok += get(f"{BASE}, {expr}", seed, os.path.join(OUT, f"{seed}-{name}.jpg"))
        time.sleep(6)
print(f"{ok} images")
sys.exit(0 if ok else 1)
