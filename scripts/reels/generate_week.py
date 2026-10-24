"""Génère les vidéos et les textes de la semaine à partir des offres Airtable.

Usage :
  AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... python3 scripts/reels/generate_week.py --out out/semaine
  python3 scripts/reels/generate_week.py --fixture scripts/reels/fixture.json --out out/test

Sortie : une vidéo par jour (dimanche → vendredi : 1 code, samedi : top 3) + publications.md
avec les textes TikTok, Instagram et WhatsApp de chaque jour.
"""
import argparse
import datetime as dt
import json
import os
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render  # noqa: E402

ACTIVE_NOT_EXPIRED = "AND({Status}=\"Active\", OR({End Date}=\"\", IS_AFTER({End Date}, DATEADD(TODAY(), -1, 'days'))))"
JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]


# ------------------------------------------------------------------ Airtable
def fetch_table(table, params=None):
    base, key = os.environ["AIRTABLE_BASE_ID"], os.environ["AIRTABLE_API_KEY"]
    records, offset = [], None
    while True:
        q = dict(params or {})
        if offset:
            q["offset"] = offset
        url = f"https://api.airtable.com/v0/{base}/{urllib.parse.quote(table)}?{urllib.parse.urlencode(q)}"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.load(r)
        records += data.get("records", [])
        offset = data.get("offset")
        if not offset:
            return records


def load_from_airtable():
    return {
        "offers": fetch_table("Offers", {"filterByFormula": ACTIVE_NOT_EXPIRED}),
        "brands": fetch_table("Brands"),
        "creators": fetch_table("Creators"),
    }


# ------------------------------------------------------------------ sélection
def pick_offers(data, n_daily=6, n_top=3, valid_until=None):
    brands = {r["id"]: r["fields"] for r in data["brands"]}
    creators = {r["id"]: r["fields"].get("Name", "") for r in data["creators"]}
    offers = []
    for r in data["offers"]:
        f = r["fields"]
        b = brands.get((f.get("Brand") or [None])[0]) or {}
        name, slug = b.get("Name", ""), b.get("slug", "")
        code = str(f.get("Code") or "").strip()
        if not (name and slug and code):  # même garde-fou que le site + on ne montre que des codes
            continue
        end = str(f.get("End Date") or "")
        if end and valid_until and end < valid_until:  # l'offre doit tenir jusqu'à la fin de la semaine
            continue
        benefit = str(f.get("Benefit") or "").strip()
        pct = render.percent_of(benefit)
        offers.append({
            "brand": name, "slug": slug, "code": code, "benefit": benefit, "pct": pct,
            "disc": f"-{pct} %" if pct else "", "detail": benefit,
            "creator": creators.get((f.get("Creator") or [None])[0], ""),
            "clicks": f.get("Clicks") or 0, "created": r.get("createdTime", ""),
        })
    # Les plus cliquées d'abord, puis les plus récentes ; une seule offre par marque.
    offers.sort(key=lambda o: (o["clicks"], o["created"]), reverse=True)
    seen, unique = set(), []
    for o in offers:
        if o["brand"].lower() not in seen:
            seen.add(o["brand"].lower())
            unique.append(o)
    return unique[:n_daily], unique[:n_top], len(data["offers"]), len(creators)


# ------------------------------------------------------------------ textes
def tag(s):
    return "#" + "".join(ch for ch in s.lower() if ch.isalnum())


def date_fr(d):
    return f"{JOURS[d.weekday()]} {d.day} {MOIS[d.month - 1]}"


def texts_offer(o, weekday):
    url = f"backed.fr/marque/{o['slug']}"
    # Les captions commencent par « Code promo <marque> » : c'est ce que les gens tapent dans la
    # recherche TikTok / Instagram (premier visiteur venu de la recherche : « code promo betclic »).
    accroche = f"Code promo {o['brand']} : -{o['pct']} %." if o["pct"] else f"Code promo {o['brand']}."
    via = f"le code de {o['creator']}" if o["creator"] else f"chez {o['brand']}"
    tags = f"#codepromo #codepromo{tag(o['brand'])[1:]} {tag(o['brand'])}" + (f" {tag(o['creator'])}" if o["creator"] else "") + " #bonplan"
    # Avantage en clair, jamais coupé au milieu : s'il ne tient pas, la caption reste « Code promo <marque>. »
    gain = render.first_clause(o.get("benefit") or "", 60).rstrip(" .")
    accroche_tt = accroche if o["pct"] or not gain or gain.endswith("…") else f"Code promo {o['brand']} : {gain}."
    tiktok = f"{accroche_tt} ⚡\nCode {o['code']}, {via}.\nTous les codes sur backed.fr\n\n{tags}"
    insta = (f"{accroche} ⚡\n{render.short(o['benefit'], 120)}\nCode {o['code']}"
             + (f", partagé par {o['creator']}" if o["creator"] else "")
             + f".\n\nTous les codes → lien en bio\n\n{tags} #reduction")
    wa = (f"Code du jour ⚡\n{o['brand']} : {render.first_clause(o['benefit'], 80)}\nCode : {o['code']}\n"
          + (f"via {o['creator']}\n" if o["creator"] else "") + f"→ {url}")
    wa_time = "18h" if weekday == 6 else "12h15"
    return tiktok, insta, wa, wa_time


def texts_top(items):
    lines = "\n".join(f"{i + 1}. {o['brand']} — {o['code']}" for i, o in enumerate(items))
    tiktok = f"Les {len(items)} codes les plus copiés sur Backed. 🔥\nEnregistre pour plus tard.\n\n#codepromo #bonplan #youtube"
    insta = f"Top {len(items)} de la semaine 🔥\n{lines}\n\nEnregistre ce post. Tous les codes → lien en bio\n\n#codepromo #bonplan #youtube"
    wa = f"Les {len(items)} codes les plus copiés sur Backed 🔥\n{lines}\nTous sur backed.fr"
    return tiktok, insta, wa, "10h"


def block(title, video, tiktok, insta, wa, wa_time):
    return (f"## {title}\n\nVidéo : `{video}` — TikTok + Reel Instagram à 19h\n\n"
            f"**TikTok**\n```\n{tiktok}\n```\n\n**Instagram**\n```\n{insta}\n```\n\n"
            f"**WhatsApp ({wa_time})**\n```\n{wa}\n```\n")


# ------------------------------------------------------------------ main
def next_sunday(today):
    return today + dt.timedelta(days=(6 - today.weekday()) % 7 or 7)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out/semaine")
    ap.add_argument("--fixture", help="JSON {offers, brands, creators} au format de l'API Airtable (pour tester)")
    ap.add_argument("--start", help="Date du premier jour (AAAA-MM-JJ), par défaut le prochain dimanche")
    ap.add_argument("--no-video", action="store_true", help="Ne génère que publications.md")
    a = ap.parse_args()

    data = json.load(open(a.fixture, encoding="utf-8")) if a.fixture else load_from_airtable()
    start = dt.date.fromisoformat(a.start) if a.start else next_sunday(dt.date.today())
    week_end = (start + dt.timedelta(days=6)).isoformat()
    daily, top, n_offers, n_creators = pick_offers(data, valid_until=week_end)
    if not daily:
        sys.exit("Aucune offre active avec code et marque : rien à générer.")
    # Pas de chiffre qui bouge chaque jour dans les vidéos : elles sont générées le samedi pour toute la semaine.
    proof = "Les codes promo de tes créateurs YouTube"
    os.makedirs(a.out, exist_ok=True)

    md = [f"# Publications Backed — semaine du {date_fr(start)}\n",
          f"Généré automatiquement depuis Airtable le {dt.date.today().isoformat()} : {n_offers} offres actives, "
          "les plus cliquées en premier, une par marque, et seulement celles valables jusqu'à la fin de la semaine. "
          "Le nombre de nouvelles offres par jour n'a pas d'importance : 1 vidéo par jour, toujours.\n"]
    for i, o in enumerate(daily):
        day = start + dt.timedelta(days=i)
        name = f"{i + 1:02d}-{day.isoformat()}-{o['slug']}.mp4"
        if not a.no_video:
            dur = render.encode(render.offer_shots(o, proof), os.path.join(a.out, name), variante=i % 4)
            print(f"✅ {name} ({dur:.1f} s)", flush=True)
        md.append(block(f"{date_fr(day)} — {o['brand']}", name, *texts_offer(o, day.weekday())))
    for i in range(len(daily), 6):  # pas assez d'offres valables toute la semaine
        day = start + dt.timedelta(days=i)
        md.append(f"## {date_fr(day)} — pas de nouvelle vidéo\n\nPas assez d'offres valables toute la semaine : "
                  "republie la vidéo qui a le mieux marché, ou saute ce jour.\n")
    if len(top) >= 2:
        day = start + dt.timedelta(days=6)  # le top 3 reste toujours le samedi
        name = f"07-{day.isoformat()}-top{len(top)}.mp4"
        if not a.no_video:
            dur = render.encode(render.top_shots(top, proof, sub="Les plus copiés sur Backed."), os.path.join(a.out, name), variante=len(daily) % 4)
            print(f"✅ {name} ({dur:.1f} s)", flush=True)
        md.append(block(f"{date_fr(day)} — Top {len(top)}", name, *texts_top(top)))

    with open(os.path.join(a.out, "publications.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md))
    print(f"📝 {os.path.join(a.out, 'publications.md')}")


if __name__ == "__main__":
    main()
