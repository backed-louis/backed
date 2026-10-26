"""Génère les vidéos et les textes de la semaine à partir des offres Airtable.

Usage :
  AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... python3 scripts/reels/generate_week.py --out out/semaine
  python3 scripts/reels/generate_week.py --fixture scripts/reels/fixture.json --out out/test

Sortie : le top 3 du jour (le samedi où le script tourne, classé sur les clics des 7 derniers jours),
puis une vidéo « Code du jour » pour chaque jour du dimanche au vendredi suivants, + publications.md
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
        url = f"https://api.airtable.com/v0/{base}/{urllib.parse.quote(table)}?{urllib.parse.urlencode(q, doseq=True)}"
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
        # Clics de toutes les offres (même inactives) et relevés quotidiens : voir click_stats.
        "clicked": fetch_table("Offers", {"filterByFormula": "{Clicks}>0", "fields[]": ["Slug", "Clicks"]}),
        "suivi": fetch_table("Suivi quotidien", {"filterByFormula": "IS_AFTER({Date}, DATEADD(TODAY(), -15, 'days'))",
                                                 "fields[]": ["Date", "Clics par offre"]}),
    }


# ------------------------------------------------------------------ classement
def click_stats(data, today):
    """Clics des 7 derniers jours et au total, par Slug (marque + créateur), comme lib/classement.ts.

    Semaine = clics actuels − relevé « Suivi quotidien » d'il y a 7 jours (le plus récent qui a au
    moins 7 jours, sinon le plus ancien). Regrouper par Slug rend à l'offre affichée les clics que
    le site comptait par erreur sur une ancienne offre au même slug (jusqu'au 26 octobre 2026).
    Sans relevés (fixture), la semaine vaut 0 et le classement se fait sur le total."""
    snaps = []
    for r in data.get("suivi", []):
        f = r.get("fields", {})
        try:
            snaps.append((str(f.get("Date") or ""), json.loads(f.get("Clics par offre") or "{}")))
        except ValueError:
            pass
    snaps = sorted(s for s in snaps if s[0] and s[0] <= today.isoformat())
    limit = (today - dt.timedelta(days=7)).isoformat()
    old = [s for s in snaps if s[0] <= limit]
    ref = (old[-1] if old else snaps[0]) if snaps else None
    week, total = {}, {}
    for r in data.get("clicked", []):
        f = r.get("fields", {})
        key, clicks = f.get("Slug") or r["id"], f.get("Clicks") or 0
        total[key] = total.get(key, 0) + clicks
        if ref:
            week[key] = week.get(key, 0) + max(0, clicks - (ref[1].get(r["id"]) or 0))
    return week, total, (ref[0] if ref else None)


# ------------------------------------------------------------------ sélection
def pick_offers(data, today, n_daily=6, n_top=3, valid_until=None):
    week, total, since = click_stats(data, today)
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
        benefit = str(f.get("Benefit") or "").strip()
        pct = render.percent_of(benefit)
        offers.append({
            "brand": name, "slug": slug, "code": code, "benefit": benefit, "pct": pct,
            "disc": f"-{pct} %" if pct else "", "detail": benefit,
            "creator": creators.get((f.get("Creator") or [None])[0], ""),
            "week": week.get(f.get("Slug") or r["id"], 0),
            "clicks": max(f.get("Clicks") or 0, total.get(f.get("Slug") or r["id"], 0)),
            "created": r.get("createdTime", ""), "end": end,
        })
    # Les plus copiées cette semaine, puis au total, puis les plus récentes ; une seule offre par marque.
    offers.sort(key=lambda o: (o["week"], o["clicks"], o["created"]), reverse=True)

    def one_per_brand(items, n):
        seen, unique = set(), []
        for o in items:
            if o["brand"].lower() not in seen:
                seen.add(o["brand"].lower())
                unique.append(o)
        return unique[:n]

    # Codes du jour : l'offre doit tenir jusqu'à la fin de la semaine. Top 3 : publié le jour même.
    daily = one_per_brand([o for o in offers if not (o["end"] and valid_until and o["end"] < valid_until)], n_daily)
    top = one_per_brand(offers, n_top)
    return daily, top, len(data["offers"]), len(creators), since


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
    def gain(o):
        return render.first_clause(o["benefit"], 80).rstrip(" .") if o["benefit"] else ""

    def via(o):
        return f", partagé par {o['creator']}" if o["creator"] else ""

    lines = "\n".join(f"{i + 1}. {o['brand']} — {o['code']}" for i, o in enumerate(items))
    rich_insta = "\n\n".join(f"{i + 1}. {o['brand']}" + (f" : {gain(o)}" if gain(o) else "") + f"\nCode {o['code']}{via(o)}"
                              for i, o in enumerate(items))
    rich_wa = "\n\n".join(f"{i + 1}. {o['brand']}" + (f" : {gain(o)}" if gain(o) else "")
                           + f"\nCode : {o['code']}{via(o)}\n→ backed.fr/marque/{o['slug']}" for i, o in enumerate(items))
    tiktok = (f"Les {len(items)} codes les plus copiés sur Backed cette semaine. 🔥\n{lines}\n"
              "Enregistre pour plus tard.\n\n#codepromo #bonplan #youtube")
    insta = (f"Les {len(items)} codes les plus copiés de la semaine 🔥\n\n{rich_insta}\n\n"
             "Enregistre ce post. Tous les codes → lien en bio\n\n#codepromo #bonplan #youtube")
    wa = (f"🔥 Les {len(items)} codes les plus copiés sur Backed cette semaine\n\n{rich_wa}\n\n"
          "Copie le code, colle-le au paiement : tu paies moins et tu soutiens le créateur ⚡\nTous les codes → backed.fr")
    return tiktok, insta, wa, "10h"


def ranking_note(items, since):
    """Ce sur quoi repose le top 3, pour vérifier avant de publier (pas publié)."""
    base = f"clics depuis le relevé du {since}, puis au total" if since else "clics au total (pas encore de relevé)"
    rows = "\n".join(f"| {i + 1} | {o['brand']} | {o['code']} | {o['week']} | {o['clicks']} |" for i, o in enumerate(items))
    return (f"Classement : {base}, une offre par marque.\n\n"
            f"| # | Marque | Code | Clics 7 jours | Clics au total |\n|---|---|---|---|---|\n{rows}\n")


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
    week_end = (start + dt.timedelta(days=5)).isoformat()  # vendredi : dernier « Code du jour »
    top_day = start - dt.timedelta(days=1)  # le samedi où le script tourne
    daily, top, n_offers, n_creators, since = pick_offers(data, dt.date.today(), valid_until=week_end)
    if not daily:
        sys.exit("Aucune offre active avec code et marque : rien à générer.")
    # Pas de chiffre qui bouge chaque jour dans les vidéos : elles sont générées le samedi pour toute la semaine.
    proof = "Les codes promo de tes créateurs YouTube"
    os.makedirs(a.out, exist_ok=True)

    md = [f"# Publications Backed — semaine du {date_fr(start)}\n",
          f"Généré automatiquement depuis Airtable le {dt.date.today().isoformat()} : {n_offers} offres actives, "
          "les plus copiées en premier (clics des 7 derniers jours, puis au total), une par marque, et pour les codes "
          "du jour seulement celles valables jusqu'au vendredi. "
          "Le nombre de nouvelles offres par jour n'a pas d'importance : 1 vidéo par jour, toujours.\n"]
    # Le top 3 d'abord : il se publie aujourd'hui (samedi), avec le classement de la semaine qui se termine.
    if len(top) >= 2:
        name = f"00-{top_day.isoformat()}-top{len(top)}.mp4"
        if not a.no_video:
            dur = render.encode(render.top_shots(top, proof, sub="Les plus copiés cette semaine."), os.path.join(a.out, name), variante=3)
            print(f"✅ {name} ({dur:.1f} s)", flush=True)
        md.append(block(f"{date_fr(top_day)} (aujourd'hui) — Top {len(top)} de la semaine", name, *texts_top(top)))
        md.append(ranking_note(top, since))
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
    md.append(f"## {date_fr(start + dt.timedelta(days=6))} — Top 3\n\nIl sera généré ce samedi-là à 8h, "
              "avec les clics de la semaine : télécharge le zip de ce jour-là.\n")

    with open(os.path.join(a.out, "publications.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md))
    print(f"📝 {os.path.join(a.out, 'publications.md')}")


if __name__ == "__main__":
    main()
