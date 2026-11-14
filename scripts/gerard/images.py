"""Génère les photos de Gérard Pleinpot (personnage photoréaliste créé par IA) avec un service gratuit (Pollinations, FLUX).
Même description et même graine pour chaque expression, pour garder le même visage."""
import os, sys, time, urllib.parse, urllib.request

OUT = sys.argv[1] if len(sys.argv) > 1 else "out/gerard"
os.makedirs(OUT, exist_ok=True)
# L'expression d'abord (le modèle privilégie le début de la description), puis le personnage, court et identique partout.
PERSO = ("chubby 55-year-old French man with receding brown hair, thick brown mustache, clean-shaven chin, round tortoiseshell glasses, "
         "mustard-yellow cardigan over a white shirt, sitting on a beige sofa in a cozy French living room, warm lamp light, "
         "candid smartphone photo, photorealistic, natural skin")
EXPR = {
    "fier": "photo of a smug proud man with a big confident smile holding up a gold credit card next to his face",
    "joie": "photo of an overjoyed man laughing with his mouth wide open, celebrating with a fist pump, gold credit card in hand",
    "choc": "photo of a horrified man staring at his smartphone, mouth wide open in shock, eyes wide, eyebrows raised high",
    "depite": "photo of a sad defeated man slumped on a sofa, facepalm, hand covering his forehead, frowning, phone in his lap",
}
SEEDS = [int(s) for s in os.environ.get("SEEDS", "2026,3110,7777").split(",")]
W, H = 576, 1024


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
        ok += get(f"{expr}, {PERSO}", seed, os.path.join(OUT, f"{seed}-{name}.jpg"))
        time.sleep(6)
print(f"{ok} images")
sys.exit(0 if ok else 1)
