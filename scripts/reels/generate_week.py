"""Génère les vidéos et les textes de la semaine à partir des offres Airtable.

Usage :
  AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... python3 scripts/reels/generate_week.py --out out/semaine
  python3 scripts/reels/generate_week.py --fixture scripts/reels/fixture.json --out out/test

Sortie : le top 3 du samedi qui suit (le script tourne le vendredi soir ; classé sur les clics des 7 derniers jours),
puis une vidéo « Code du jour » pour chaque jour du dimanche au vendredi suivants. Pour chaque jour :
la vidéo, l'image de story et la carte WhatsApp ; pour la semaine : le carrousel (dossier carrousel/).
publications.md donne les textes TikTok, Instagram, YouTube Shorts et WhatsApp de chaque jour.
"""
import argparse
import datetime as dt
import json
import os
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import logos  # noqa: E402
import render  # noqa: E402
import visuels  # noqa: E402

SIGN = " ".join(render.SIGNATURE)  # « Avant de payer, passe par Backed. »
YOUTUBE = "youtube.com/@backed-fr"   # la chaîne YouTube de Backed
SIGN_LINK = SIGN.rstrip(".")       # devant une flèche : « Avant de payer, passe par Backed → lien en bio »

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
            "website": b.get("Website") or "", "logo_urls": logos.airtable_urls(b.get("Logo")),
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
    return f"{JOURS[d.weekday()]} {'1er' if d.day == 1 else d.day} {MOIS[d.month - 1]}"


def period_fr(a, b):
    da = "1er" if a.day == 1 else str(a.day)
    db = "1er" if b.day == 1 else str(b.day)
    return f"du {da} au {db} {MOIS[b.month - 1]}" if a.month == b.month else f"du {da} {MOIS[a.month - 1]} au {db} {MOIS[b.month - 1]}"


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
    tiktok = f"{accroche_tt} ⚡\nCode {o['code']}, {via}.\n{SIGN_LINK} → backed.fr\n\n{tags}"
    insta = (f"{accroche} ⚡\n{render.short(o['benefit'], 120)}\nCode {o['code']}"
             + (f", partagé par {o['creator']}" if o["creator"] else "")
             + f".\n\n{SIGN_LINK} → lien en bio\n\n{tags} #reduction")
    wa = (f"Code du jour ⚡\n{o['brand']} : {render.first_clause(o['benefit'], 80)}\nCode : {o['code']}\n"
          + (f"via {o['creator']}\n" if o["creator"] else "") + f"→ {url}\n\n{SIGN}")
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
              f"Enregistre pour plus tard. {SIGN}\n\n#codepromo #bonplan #youtube")
    insta = (f"Les {len(items)} codes les plus copiés de la semaine 🔥\n\n{rich_insta}\n\n"
             f"Enregistre ce post. {SIGN_LINK} → lien en bio\n\n#codepromo #bonplan #youtube")
    wa = (f"🔥 Les {len(items)} codes les plus copiés sur Backed cette semaine\n\n{rich_wa}\n\n"
          f"Copie le code, colle-le au paiement : tu paies moins et tu soutiens le créateur ⚡\n"
          f"Le code du jour en vidéo sur YouTube → {YOUTUBE}\n{SIGN_LINK} → backed.fr")
    return tiktok, insta, wa, "10h"


def texts_youtube(o):
    """Titre (100 caractères max) et description du Short YouTube."""
    gain = o["disc"] or render.hook_gain(o.get("benefit") or "", 50).rstrip(" .…")
    title = f"Code promo {o['brand']}" + (f" : {gain}" if gain else "")
    if o["creator"] and len(title) + len(o["creator"]) + 14 <= 100:
        title += f" (code de {o['creator']})"
    desc = ((o["benefit"] + "\n" if o["benefit"] else "")
            + f"Code : {o['code']}" + (f", partagé par {o['creator']} dans sa vidéo YouTube" if o["creator"] else "")
            + f"\n👉 backed.fr/marque/{o['slug']}\n\n{SIGN} Tous les codes promo des créateurs YouTube, "
            f"au même endroit. Gratuit, sans compte.\n\n#codepromo #codepromo{tag(o['brand'])[1:]} #bonplan #shorts")
    return title[:100], desc


def texts_youtube_top(items):
    title = f"Les {len(items)} codes promo les plus copiés cette semaine : " + ", ".join(o["brand"] for o in items)
    if len(title) > 100:
        title = f"Les {len(items)} codes promo les plus copiés cette semaine"
    desc = ("\n".join(f"{i + 1}. {o['brand']} — code {o['code']}" + (f" ({o['creator']})" if o["creator"] else "")
                       for i, o in enumerate(items))
            + f"\n\n{SIGN} Tous les codes → backed.fr\n\n#codepromo #bonplan #shorts")
    return title, desc


def texts_carousel(items, period):
    rows = "\n".join(f"{i + 1}. {o['brand']}" + (f" : {o['disc']}" if o["disc"] else "") + f" — code {o['code']}"
                     for i, o in enumerate(items))
    return (f"Les {len(items)} codes promo de la semaine ({period}), à enregistrer avant ton prochain achat 💜\n\n"
            f"{rows}\n\nTous les codes partagés par tes créateurs YouTube → lien en bio\n{SIGN}\n\n"
            "#codepromo #bonplan #reduction #youtube")


def ranking_note(items, since):
    """Ce sur quoi repose le top 3, pour vérifier avant de publier (pas publié)."""
    base = f"clics depuis le relevé du {since}, puis au total" if since else "clics au total (pas encore de relevé)"
    rows = "\n".join(f"| {i + 1} | {o['brand']} | {o['code']} | {o['week']} | {o['clicks']} |" for i, o in enumerate(items))
    return (f"Classement : {base}, une offre par marque.\n\n"
            f"| # | Marque | Code | Clics 7 jours | Clics au total |\n|---|---|---|---|---|\n{rows}\n")


def block(title, video, tiktok, insta, wa, wa_time, yt=None, story=None, wa_img=None, link=None):
    files = f"Vidéo : `{video}` — TikTok + Reel Instagram + YouTube Shorts à 19h\n"
    if story:
        files += f"\nStory Instagram ({wa_time}) : `{story}` + sticker lien → {link}\n"
    if wa_img:
        files += f"\nWhatsApp ({wa_time}) : l'image `{wa_img}` avec le texte ci-dessous\n"
    out = (f"## {title}\n\n{files}\n"
           f"**TikTok**\n```\n{tiktok}\n```\n\n**Instagram**\n```\n{insta}\n```\n\n")
    if yt:
        out += f"**YouTube Shorts** — titre\n```\n{yt[0]}\n```\nDescription\n```\n{yt[1]}\n```\n\n"
    return out + f"**WhatsApp ({wa_time})**\n```\n{wa}\n```\n"


# ------------------------------------------------------------------ aperçu (pour vérifier sans télécharger le zip)
def preview_sheet(rows, path, w=270):
    """Planche JPEG : une ligne d'images par entrée (vidéos : accroche, code, fin)."""
    from PIL import Image
    if not rows:
        return
    h_of = lambda im: int(im.height * w / im.width)  # noqa: E731
    H = sum(max(h_of(im) for im in r) + 16 for r in rows)
    Wd = max(len(r) for r in rows) * (w + 16)
    sheet = Image.new("RGB", (Wd, H), (255, 255, 255))
    y = 0
    for r in rows:
        for i, im in enumerate(r):
            sheet.paste(im.convert("RGB").resize((w, h_of(im))), (i * (w + 16), y))
        y += max(h_of(im) for im in r) + 16
    sheet.save(path, quality=82)


def video_stills(shots):
    t, out = 0.0, []
    for dur, _ in shots:
        out.append(render.render(shots, t + min(dur - 0.05, max(1.2, dur * 0.7))))
        t += dur
    return out


# ------------------------------------------------------------------ main
def next_sunday(today):
    return today + dt.timedelta(days=(6 - today.weekday()) % 7 or 7)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out/semaine")
    ap.add_argument("--fixture", help="JSON {offers, brands, creators} au format de l'API Airtable (pour tester)")
    ap.add_argument("--start", help="Date du premier jour (AAAA-MM-JJ), par défaut le prochain dimanche")
    ap.add_argument("--no-video", action="store_true", help="Ne génère que publications.md")
    ap.add_argument("--preview", help="Dossier où écrire un aperçu léger (planches JPEG + publications.md)")
    ap.add_argument("--no-logo", action="store_true", help="Ne télécharge pas les logos des marques")
    a = ap.parse_args()

    data = json.load(open(a.fixture, encoding="utf-8")) if a.fixture else load_from_airtable()
    start = dt.date.fromisoformat(a.start) if a.start else next_sunday(dt.date.today())
    week_end = (start + dt.timedelta(days=5)).isoformat()  # vendredi : dernier « Code du jour »
    top_day = start - dt.timedelta(days=1)  # le samedi (le lendemain du vendredi où le script tourne)
    daily, top, n_offers, n_creators, since = pick_offers(data, dt.date.today(), valid_until=week_end)
    if not daily:
        sys.exit("Aucune offre active avec code et marque : rien à générer.")
    # Pas de chiffre qui bouge chaque jour dans les vidéos : elles sont générées le vendredi pour toute la semaine.
    proof = "Les codes promo de tes créateurs YouTube"
    os.makedirs(a.out, exist_ok=True)
    # Logos haute définition, téléchargés maintenant (le champ Logo d'Airtable est souvent un favicon de 32 px)
    logo_log = []
    for o in daily + top:
        o["logo"] = None if a.no_logo else logos.fetch(o["brand"], o["website"], o["logo_urls"])
        logo_log.append(f"{o['brand']} : " + (f"{o['logo'].width}×{o['logo'].height} px" if o["logo"] else "pas de logo net"))
    print("🖼️  Logos — " + " · ".join(dict.fromkeys(logo_log)), flush=True)
    vid_rows, vis_rows = [], []

    md = [f"# Publications Backed — semaine du {date_fr(start)}\n",
          f"Généré automatiquement depuis Airtable le {dt.date.today().isoformat()} : {n_offers} offres actives, "
          "les plus copiées en premier (clics des 7 derniers jours, puis au total), une par marque, et pour les codes "
          "du jour seulement celles valables jusqu'au vendredi. "
          "Le nombre de nouvelles offres par jour n'a pas d'importance : 1 vidéo par jour, toujours.\n"]
    # Le top 3 d'abord : il se publie le samedi, avec le classement de la semaine qui se termine.
    if len(top) >= 2:
        name = f"00-{top_day.isoformat()}-top{len(top)}.mp4"
        shots = render.top_shots(top, proof, sub="Les plus copiés cette semaine.")
        if not a.no_video:
            dur = render.encode(shots, os.path.join(a.out, name), variante=3)
            print(f"✅ {name} ({dur:.1f} s)", flush=True)
        stem = f"00-{top_day.isoformat()}-top{len(top)}"
        wa_img, story_img = visuels.top_card(top), visuels.top_card(top, visuels.STORY)
        visuels.save(wa_img, os.path.join(a.out, f"{stem}-whatsapp.png"))
        visuels.save(story_img, os.path.join(a.out, f"{stem}-story.png"))
        vid_rows.append(video_stills(shots))
        vis_rows.append([story_img, wa_img])
        md.append(block(f"{date_fr(top_day)} — Top {len(top)} de la semaine", name, *texts_top(top),
                        yt=texts_youtube_top(top), story=f"{stem}-story.png", wa_img=f"{stem}-whatsapp.png", link="backed.fr"))
        md.append(ranking_note(top, since))
    # Carrousel de la semaine : les codes du jour, à publier le dimanche (Instagram, et TikTok en mode photo)
    period = period_fr(start, start + dt.timedelta(days=max(0, len(daily) - 1)))
    slides = visuels.week_carousel(daily, period)
    os.makedirs(os.path.join(a.out, "carrousel"), exist_ok=True)
    for k, im in enumerate(slides):
        visuels.save(im, os.path.join(a.out, "carrousel", f"{k + 1:02d}.png"))
    vis_rows.append(slides[:4])
    vis_rows.append(slides[4:])
    md.append(f"## {date_fr(start)} à 11h — Carrousel de la semaine\n\n"
              f"Images : dossier `carrousel/` ({len(slides)} images, dans l'ordre) — post Instagram, et TikTok en mode photo.\n\n"
              f"**Légende**\n```\n{texts_carousel(daily, period)}\n```\n")
    for i, o in enumerate(daily):
        day = start + dt.timedelta(days=i)
        stem = f"{i + 1:02d}-{day.isoformat()}-{o['slug']}"
        name = f"{stem}.mp4"
        shots = render.offer_shots(o, proof)
        if not a.no_video:
            dur = render.encode(shots, os.path.join(a.out, name), variante=i % 4)
            print(f"✅ {name} ({dur:.1f} s)", flush=True)
        story_img, _ = visuels.story(o, date_fr(day))
        wa_img = visuels.whatsapp_card(o, date_fr(day))
        visuels.save(story_img, os.path.join(a.out, f"{stem}-story.png"))
        visuels.save(wa_img, os.path.join(a.out, f"{stem}-whatsapp.png"))
        vid_rows.append(video_stills(shots))
        vis_rows.append([story_img, wa_img])
        md.append(block(f"{date_fr(day)} — {o['brand']}", name, *texts_offer(o, day.weekday()), yt=texts_youtube(o),
                        story=f"{stem}-story.png", wa_img=f"{stem}-whatsapp.png", link=f"backed.fr/marque/{o['slug']}"))
    for i in range(len(daily), 6):  # pas assez d'offres valables toute la semaine
        day = start + dt.timedelta(days=i)
        md.append(f"## {date_fr(day)} — pas de nouvelle vidéo\n\nPas assez d'offres valables toute la semaine : "
                  "republie la vidéo qui a le mieux marché, ou saute ce jour.\n")
    md.append(f"## {date_fr(start + dt.timedelta(days=6))} — Top 3\n\nIl sera généré la veille au soir (vendredi), "
              "avec les clics de la semaine : c'est le premier fichier du lot suivant.\n")

    with open(os.path.join(a.out, "publications.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md))
    print(f"📝 {os.path.join(a.out, 'publications.md')}")
    if a.preview:
        os.makedirs(a.preview, exist_ok=True)
        preview_sheet(vid_rows, os.path.join(a.preview, "videos.jpg"))
        preview_sheet(vis_rows, os.path.join(a.preview, "visuels.jpg"), w=240)
        with open(os.path.join(a.preview, "publications.md"), "w", encoding="utf-8") as f:
            f.write("\n".join(md))
        with open(os.path.join(a.preview, "logos.txt"), "w", encoding="utf-8") as f:
            f.write("\n".join(dict.fromkeys(logo_log)) + "\n")
        print(f"👀 aperçu dans {a.preview}")


if __name__ == "__main__":
    main()
