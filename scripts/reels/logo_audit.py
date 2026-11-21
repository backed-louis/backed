"""Vérifie le logo de chaque marque qui a une offre active avec code : taille trouvée, d'où il vient, et une planche
pour le voir. Les marques sans logo net (moins de 64 px) seraient écartées des vidéos : leur ajouter un logo carré dans
scripts/reels/logos/<slug>.png, ou son adresse dans scripts/reels/logos/sources.json.

  AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... python3 scripts/reels/logo_audit.py --out out/logos
"""
import argparse
import concurrent.futures as cf
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate_week as gw  # noqa: E402
import logos  # noqa: E402

TILE, LABEL, COLS = 220, 56, 8
FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts", "Inter.ttf")


def font(size):
    try:
        return ImageFont.truetype(FONT, size)
    except OSError:
        return ImageFont.load_default()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out/logos")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    brands = {r["id"]: r["fields"] for r in gw.fetch_table("Brands")}
    offers = gw.fetch_table("Offers", {"filterByFormula": gw.ACTIVE_NOT_EXPIRED})
    used = {}
    for r in offers:
        f = r["fields"]
        b = brands.get((f.get("Brand") or [None])[0]) or {}
        if str(f.get("Code") or "").strip() and b.get("Name") and b.get("slug"):
            used[b["slug"]] = b

    def check(item):
        slug, b = item
        im, src = logos.fetch_with_source(b["Name"], b.get("Website") or "", logos.airtable_urls(b.get("Logo")), slug)
        return slug, b, im, src

    with cf.ThreadPoolExecutor(12) as ex:
        rows = sorted(ex.map(check, used.items()), key=lambda r: (r[2] is not None, r[1]["Name"].lower()))

    ok = [r for r in rows if r[2] is not None]
    lines = [f"# Logos des marques ({len(ok)} nets sur {len(rows)})", "",
             "| Marque | slug | Taille | Source |", "|---|---|---|---|"]
    for slug, b, im, src in rows:
        size = f"{im.width}×{im.height}" if im else "**aucun**"
        lines.append(f"| {b['Name']} | {slug} | {size} | {src or '—'} |")
    with open(os.path.join(a.out, "logos.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    n = len(rows)
    sheet = Image.new("RGB", (COLS * TILE, ((n + COLS - 1) // COLS) * (TILE + LABEL)), (16, 12, 24))
    d = ImageDraw.Draw(sheet)
    for i, (slug, b, im, src) in enumerate(rows):
        x, y = (i % COLS) * TILE, (i // COLS) * (TILE + LABEL)
        box = Image.new("RGBA", (TILE - 40, TILE - 40), (255, 255, 255, 255) if im else (60, 30, 90, 255))
        if im:
            lg = im.copy()
            lg.thumbnail((TILE - 60, TILE - 60))
            box.alpha_composite(lg, ((box.width - lg.width) // 2, (box.height - lg.height) // 2))
        sheet.paste(box.convert("RGB"), (x + 20, y + 20))
        d.text((x + 20, y + TILE - 14), b["Name"][:22], fill=(240, 240, 240), font=font(18))
        d.text((x + 20, y + TILE + 10), f"{im.width}px" if im else "AUCUN LOGO", fill=(170, 150, 220) if im else
               (255, 90, 90), font=font(16))
    sheet.save(os.path.join(a.out, "logos.jpg"), quality=85)
    print(f"Logos nets : {len(ok)} / {len(rows)}. Sans logo : "
          + ", ".join(b["Name"] for _, b, im, _ in rows if im is None), flush=True)


if __name__ == "__main__":
    main()
