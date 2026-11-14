"""Gérard Pleinpot, même visage dans toutes les expressions : on part d'un portrait de base et on demande à FLUX Kontext
(édition d'image qui garde l'identité) de changer seulement l'expression. Service gratuit Pollinations, sinon l'espace
Hugging Face public de FLUX.1 Kontext."""
import os, sys, time, urllib.parse, urllib.request

OUT = sys.argv[1] if len(sys.argv) > 1 else "out/gerard"
os.makedirs(OUT, exist_ok=True)
BASE_URL = os.environ["BASE_URL"]
KEEP = "Keep exactly the same man, same face, same round glasses, same thick mustache, same mustard cardigan, same living room, same lighting, photorealistic."
EDITS = {
    "fier": "Make him smile smugly and proudly at the camera, chin up, holding up a gold credit card next to his face.",
    "joie": "Make him laugh with joy, mouth wide open, raising one fist in celebration.",
    "choc": "Make him horrified, staring at his phone screen with his mouth wide open in shock, eyes wide, eyebrows raised high.",
    "depite": "Make him sad and defeated, one hand on his forehead, frowning, eyes looking down.",
}
SEED = int(os.environ.get("SEED", "3110"))


def save(path, data, how):
    open(path, "wb").write(data)
    print(f"ok {path} ({len(data)//1024} Ko) via {how}", flush=True)


def pollinations(prompt, path):
    q = urllib.parse.quote(prompt)
    img = urllib.parse.quote(BASE_URL, safe="")
    for host in ("https://image.pollinations.ai/prompt/", "https://gen.pollinations.ai/image/"):
        url = f"{host}{q}?model=kontext&image={img}&width=576&height=1024&seed={SEED}&nologo=true"
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "backed-gerard/1.0"})
                with urllib.request.urlopen(req, timeout=240) as r:
                    data, ctype = r.read(), r.headers.get("Content-Type", "")
                if ctype.startswith("image/") and len(data) > 20000:
                    save(path, data, "pollinations kontext"); return True
                print(f"pollinations : {ctype} {len(data)} o : {data[:300]!r}", flush=True)
            except urllib.error.HTTPError as e:
                print(f"pollinations {host} HTTP {e.code} : {e.read()[:300]!r}", flush=True)
                if e.code in (401, 402, 403): break
            except Exception as e:
                print(f"pollinations {host} essai {attempt + 1} : {e}", flush=True)
            time.sleep(15 * (attempt + 1))
    return False


_client = None
def space(prompt, path):
    global _client
    try:
        from gradio_client import Client, handle_file
        if _client is None:
            _client = Client("black-forest-labs/FLUX.1-Kontext-Dev")
            print(_client.view_api(return_format="str", print_info=False)[:1500], flush=True)
        res = _client.predict(input_image=handle_file(BASE_URL), prompt=prompt, seed=SEED, randomize_seed=False,
                              guidance_scale=2.5, steps=28, api_name="/infer")
        src = res[0] if isinstance(res, (list, tuple)) else res
        src = src.get("path") if isinstance(src, dict) else src
        save(path, open(src, "rb").read(), "espace Hugging Face")
        return True
    except Exception as e:
        print(f"espace Hugging Face : {type(e).__name__} : {e}", flush=True)
        return False


ok = 0
for name, edit in EDITS.items():
    path = os.path.join(OUT, f"k-{name}.jpg")
    prompt = f"{edit} {KEEP}"
    ok += pollinations(prompt, path) or space(prompt, path)
print(f"{ok} images")
sys.exit(0 if ok else 1)
