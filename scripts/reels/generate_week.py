"""Génère les vidéos et les textes de la semaine à partir des offres Airtable.

Usage :
  AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... python3 scripts/reels/generate_week.py --out out/semaine
  python3 scripts/reels/generate_week.py --fixture scripts/reels/fixture.json --out out/test

Sortie : le top 3 du samedi qui suit (le script tourne le vendredi soir ; les marques les plus en hausse dans la Search
Console), puis une vidéo « Code du jour » pour chaque jour du dimanche au vendredi suivants. Pour chaque jour :
la vidéo (publiée à 19h sur TikTok, en Reel et en story Instagram, et en YouTube Shorts) et la carte WhatsApp
(12h15). Pas de carrousel de la semaine : chaque code sort le jour même, une fois (WhatsApp à 12h15, réseaux à 19h).
publications.md donne les textes TikTok, Instagram, YouTube Shorts et WhatsApp de chaque jour.
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "motion"))
import logos  # noqa: E402
import render  # noqa: E402
import visuels  # noqa: E402

SIGN = " ".join(render.SIGNATURE)  # « Avant de payer, passe par Backed. »
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
SHIPPING = re.compile(r"(\d{1,2})\s?%[^.,;]*?(livraison|frais de port)", re.I)


def trends(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), "tendances.txt")):
    """Secours, si la Search Console ne répond pas : marques de tendances.txt, dans l'ordre ; minuscules."""
    if not os.path.exists(path):
        return []
    return [l.strip().lower() for l in open(path, encoding="utf-8") if l.strip() and not l.startswith("#")]


def trends_search_console():
    """Slugs des pages marques de backed.fr les plus en hausse dans la Search Console (impressions des 7 derniers jours
    contre la moyenne hebdomadaire des 4 semaines d'avant, voir gsc.py), la plus forte hausse d'abord.
    None si la Search Console n'est pas accessible (pas de clé GSC_SERVICE_ACCOUNT, erreur) : on prend alors tendances.txt.
    Aucun chiffre n'est écrit (le dépôt et ses journaux sont publics) : seulement l'ordre des marques."""
    if not os.environ.get("GSC_SERVICE_ACCOUNT"):
        return None
    try:
        import gsc
        s = gsc.session()
        ranked, _, _ = gsc.brand_stats(s, gsc.pick_site(s))
        return [d["slug"] for d in ranked]
    except Exception as e:  # noqa: BLE001 — le lot de la semaine passe avant tout
        print(f"⚠️ Search Console indisponible ({type(e).__name__} : {e}) : classement de secours tendances.txt", flush=True)
        return None


def pick_offers(data, today, n_daily=6, n_top=3, valid_until=None, only=None, trending=None):
    """`only` : liste de marques imposées (dans cet ordre) pour les codes du jour ; pas de top 3."""
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
        # « -15 % sur la livraison » : la remise porte sur les frais de port, pas sur la commande.
        ship = SHIPPING.search(benefit)
        gain = f"-{ship.group(1)} % sur la livraison" if ship else ""
        if ship:
            pct = None
        offers.append({
            "brand": name, "slug": slug, "code": code, "benefit": benefit, "pct": pct, "gain": gain,
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

    if only:
        wanted = [m.strip().lower() for m in only if m.strip()]
        daily = [next(o for o in offers if o["brand"].lower() == m) for m in wanted
                 if any(o["brand"].lower() == m for o in offers)]
        return daily, [], len(data["offers"]), len(creators), since, []
    # Codes du jour et top 3 : l'offre doit tenir jusqu'à la fin de la semaine (la vidéo reste en ligne après sa
    # publication).
    valid = [o for o in offers if not (o["end"] and valid_until and o["end"] < valid_until)]
    trending = trending or []   # slugs (Search Console) ou noms (tendances.txt), en minuscules, la plus en hausse d'abord
    is_brand = lambda o, key: key in (o["slug"], o["brand"].lower())  # noqa: E731
    # Top 3 : les marques les plus en hausse (Search Console) qui ont un code valable toute la semaine — les 1re, 2e et 3e
    # si on a leurs codes, sinon on descend dans le classement. Pour chaque marque, son code le plus copié, puis celui qui
    # affiche une remise chiffrée, puis le plus récent. Jamais les « plus copiés » à la place.
    top, missing = [], []
    for rank, key in enumerate(trending, 1):
        mine = [o for o in valid if is_brand(o, key)]
        if not mine:
            missing.append(key)   # en hausse, mais pas de code valable : à signaler
        elif len(top) < n_top:
            best = max(mine, key=lambda o: (o["week"], o["clicks"], bool(o["pct"]), o["created"]))
            top.append(dict(best, trend_rank=rank))
    # Codes du jour : pas les marques du top 3 (déjà publiées le samedi) ; d'abord les autres marques en hausse, dans
    # l'ordre de la Search Console, puis les plus copiées.
    pos = {k: i for i, k in enumerate(trending)}
    in_top = {o["brand"].lower() for o in top}
    pool = sorted((o for o in valid if o["brand"].lower() not in in_top),
                  key=lambda o: min(pos.get(o["slug"], len(pos)), pos.get(o["brand"].lower(), len(pos))))
    daily = one_per_brand(pool, n_daily)
    return daily, top, len(data["offers"]), len(creators), since, missing


# ------------------------------------------------------------------ textes
def tag(s):
    return "#" + "".join(ch for ch in s.lower() if ch.isalnum())


def date_fr(d):
    return f"{JOURS[d.weekday()]} {'1er' if d.day == 1 else d.day} {MOIS[d.month - 1]}"


def texts_offer(o, weekday):
    url = f"backed.fr/marque/{o['slug']}"
    # Les captions commencent par « Code promo <marque> » : c'est ce que les gens tapent dans la
    # recherche TikTok / Instagram (premier visiteur venu de la recherche : « code promo betclic »).
    accroche = (f"Code promo {o['brand']} : -{o['pct']} %." if o["pct"] else
                f"Code promo {o['brand']} : {o['gain']}." if o.get("gain") else f"Code promo {o['brand']}.")
    via = f"le code de {o['creator']}" if o["creator"] else f"chez {o['brand']}"
    tags = f"#codepromo #codepromo{tag(o['brand'])[1:]} {tag(o['brand'])}" + (f" {tag(o['creator'])}" if o["creator"] else "") + " #bonplan"
    # Instagram n'accepte plus que 5 hashtags par publication (depuis déc. 2025) : sans #codepromo<marque>
    insta_tags = f"#codepromo {tag(o['brand'])}" + (f" {tag(o['creator'])}" if o["creator"] else "") + " #bonplan #reduction"
    # Avantage en clair, jamais coupé au milieu : s'il ne tient pas, la caption reste « Code promo <marque>. »
    gain = render.first_clause(o.get("benefit") or "", 60).rstrip(" .")
    accroche_tt = accroche if o["pct"] or o.get("gain") or not gain or gain.endswith("…") else f"Code promo {o['brand']} : {gain}."
    tiktok = f"{accroche_tt} ⚡\nCode {o['code']}, {via}.\n{SIGN_LINK} → backed.fr\n\n{tags}"
    insta = (f"{accroche} ⚡\n{render.short(o['benefit'], 120)}\nCode {o['code']}"
             + (f", partagé par {o['creator']}" if o["creator"] else "")
             + f".\n\n{SIGN_LINK} → lien en bio\n\n{insta_tags}")
    wa = (f"Code du jour ⚡\n{o['brand']} : {render.first_clause(o['benefit'], 80)}\nCode : {o['code']}\n"
          + (f"via {o['creator']}\n" if o["creator"] else "") + f"→ {url}\n\n{SIGN}")
    return tiktok, insta, wa, WA_TIME


def top_sub(items=None):
    """Sous-titre du top 3 (vidéo, visuel WhatsApp) : les marques les plus recherchées (Search Console)."""
    return "Les codes en tendance"


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
    n = len(items)  # marques les plus en hausse dans la Search Console cette semaine
    head_tt, head_ig, head_wa = (f"Les {n} codes promo en tendance cette semaine. 🔥", f"Les {n} codes promo en tendance cette semaine 🔥",
                                 f"🔥 Les {n} codes promo en tendance cette semaine")
    tiktok = (f"{head_tt}\n{lines}\n"
              f"Enregistre pour plus tard. {SIGN}\n\n#codepromo #bonplan #youtube")
    insta = (f"{head_ig}\n\n{rich_insta}\n\n"
             f"Enregistre ce post. {SIGN_LINK} → lien en bio\n\n#codepromo #bonplan #youtube")
    wa = (f"{head_wa}\n\n{rich_wa}\n\n"
          f"Copie le code, colle-le au paiement : tu paies moins et tu soutiens le créateur ⚡\n{SIGN_LINK} → backed.fr")
    return tiktok, insta, wa, WA_TIME


def texts_youtube(o):
    """Titre (100 caractères max) et description du Short YouTube."""
    gain = o["disc"] or o.get("gain") or render.hook_gain(o.get("benefit") or "", 50).rstrip(" .…")
    title = f"Code promo {o['brand']}" + (f" : {gain}" if gain else "")
    if o["creator"] and len(title) + len(o["creator"]) + 14 <= 100:
        title += f" (code de {o['creator']})"
    desc = ((o["benefit"] + "\n" if o["benefit"] else "")
            + f"Code : {o['code']}" + (f", partagé par {o['creator']} dans sa vidéo YouTube" if o["creator"] else "")
            + f"\n👉 backed.fr/marque/{o['slug']}\n\n{SIGN} Tous les codes promo des créateurs YouTube, "
            f"au même endroit. Gratuit, sans compte.\n\n#codepromo #codepromo{tag(o['brand'])[1:]} #bonplan #shorts")
    return title[:100], desc


def texts_youtube_top(items):
    what = "en tendance"
    title = f"Les {len(items)} codes promo {what} cette semaine : " + ", ".join(o["brand"] for o in items)
    if len(title) > 100:
        title = f"Les {len(items)} codes promo {what} cette semaine"
    desc = ("\n".join(f"{i + 1}. {o['brand']} — code {o['code']}" + (f" ({o['creator']})" if o["creator"] else "")
                       for i, o in enumerate(items))
            + f"\n\n{SIGN} Tous les codes → backed.fr\n\n#codepromo #bonplan #shorts")
    return title, desc


def ranking_note(items, since, source):
    """Ce sur quoi repose le top 3, pour vérifier avant de publier (pas publié)."""
    rows = "\n".join(f"| {i + 1} | {o['brand']} | {o.get('trend_rank', '?')} | {o['code']} | {o['week']} | {o['clicks']} |"
                     for i, o in enumerate(items))
    return (f"Classement : {source}, qui ont un code valable toute la semaine ; pour chacune, son code le plus copié.\n\n"
            f"| # | Marque | Rang (hausse) | Code | Clics 7 jours | Clics au total |\n|---|---|---|---|---|---|\n{rows}\n")


SOURCE_GSC = "les marques dont la page backed.fr monte le plus dans la Search Console (impressions des 7 derniers jours)"
SOURCE_SECOURS = "⚠️ Search Console indisponible cette semaine : marques de secours de scripts/reels/tendances.txt"


WA_TIME = "12h15"   # WhatsApp, envoyé à la main chaque jour ; tout le reste se publie à 19h (Buffer)


def block(title, video, tiktok, insta, wa, wa_time, yt=None, wa_img=None):
    files = f"Vidéo : `{video}` — à 19h : TikTok + Reel Instagram + story Instagram (la même vidéo) + YouTube Shorts\n"
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
    ap.add_argument("--classique", action="store_true", help="Anciennes vidéos (Pillow) au lieu des vidéos premium (Chromium)")
    ap.add_argument("--marques", help="Marques imposées, séparées par des virgules, un jour chacune à partir de --start "
                                      "(lot spécial : pas de top 3)")
    a = ap.parse_args()

    data = json.load(open(a.fixture, encoding="utf-8")) if a.fixture else load_from_airtable()
    start = dt.date.fromisoformat(a.start) if a.start else next_sunday(dt.date.today())
    week_end = (start + dt.timedelta(days=5)).isoformat()  # vendredi : dernier « Code du jour »
    top_day = start - dt.timedelta(days=1)  # le samedi (le lendemain du vendredi où le script tourne)
    only = a.marques.split(",") if a.marques else None
    trending, source = (None, SOURCE_GSC) if only else (trends_search_console(), SOURCE_GSC)
    if trending is None and not only:
        trending, source = trends(), SOURCE_SECOURS
    daily, top, n_offers, n_creators, since, missing = pick_offers(data, dt.date.today(), valid_until=week_end, only=only,
                                                                   trending=trending)
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

    # Vidéos premium (pages HTML rendues dans Chromium, voir scripts/motion) ; --classique : anciennes vidéos Pillow.
    mot = None
    if not a.classique:
        import moteur
        mot = moteur.Moteur().__enter__()

    def make_video(kind, payload, path, variante):
        """Renvoie (durée, ou None sans vidéo ; images pour l'aperçu)."""
        if mot:
            tpl, data = (("code_du_jour.html", moteur.offer_data(payload)) if kind == "offre"
                         else ("top3.html", moteur.top_data(payload, kicker=top_sub(payload).upper())))
            dur = None if a.no_video else mot.video(tpl, data, path, variante=variante)
            return dur, mot.images(tpl, data)
        shots = (render.offer_shots(payload, proof) if kind == "offre"
                 else render.top_shots(payload, proof, sub=top_sub(payload) + "."))
        dur = None if a.no_video else render.encode(shots, path, variante=variante)
        return dur, video_stills(shots)

    md = [f"# Publications Backed — semaine du {date_fr(start)}\n",
          f"Généré automatiquement depuis Airtable le {dt.date.today().isoformat()} : {n_offers} offres actives, "
          "une par marque, valables jusqu'au vendredi. "
          + f"Top 3 : {source}, qui ont un code valable. Codes du jour : les autres marques en hausse, puis les plus "
          "copiées (clics des 7 derniers jours, puis au total). "
          + "Le nombre de nouvelles offres par jour n'a pas d'importance : 1 vidéo par jour, toujours.\n"]
    # Le top 3 d'abord : il se publie le samedi, avec le classement de la semaine qui se termine.
    if len(top) < 2 and not only:
        md.append(f"## {date_fr(top_day)} — Top 3 de la semaine\n\n⚠️ Pas de top 3 : moins de 2 marques en hausse "
                  "ont un code valable cette semaine.\n")
    if len(top) >= 2:
        name = f"00-{top_day.isoformat()}-top{len(top)}.mp4"
        dur, stills = make_video("top", top, os.path.join(a.out, name), 3)
        if dur:
            print(f"✅ {name} ({dur:.1f} s)", flush=True)
        stem = f"00-{top_day.isoformat()}-top{len(top)}"
        wa_img = visuels.top_card(top, title=top_sub(top))
        visuels.save(wa_img, os.path.join(a.out, f"{stem}-whatsapp.png"))
        vid_rows.append(stills)
        vis_rows.append([wa_img])
        md.append(block(f"{date_fr(top_day)} — Top {len(top)} de la semaine", name, *texts_top(top),
                        yt=texts_youtube_top(top), wa_img=f"{stem}-whatsapp.png"))
        md.append(ranking_note(top, since, source))
    if missing:
        names = {(r["fields"].get("slug") or "").lower(): r["fields"].get("Name") for r in data["brands"]}
        shown = [names.get(k) or k for k in missing[:10]]
        md.append("### Marques en hausse sans code valable cette semaine\n\n" + ", ".join(shown)
                  + "\n\nRecherchées sur backed.fr, mais pas de code actif valable jusqu'au vendredi : un code à ajouter ?\n")
    for i, o in enumerate(daily):
        day = start + dt.timedelta(days=i)
        stem = f"{i + 1:02d}-{day.isoformat()}-{o['slug']}"
        name = f"{stem}.mp4"
        dur, stills = make_video("offre", o, os.path.join(a.out, name), i % 4)
        if dur:
            print(f"✅ {name} ({dur:.1f} s)", flush=True)
        wa_img = visuels.whatsapp_card(o, date_fr(day))
        visuels.save(wa_img, os.path.join(a.out, f"{stem}-whatsapp.png"))
        vid_rows.append(stills)
        vis_rows.append([wa_img])
        md.append(block(f"{date_fr(day)} — {o['brand']}", name, *texts_offer(o, day.weekday()), yt=texts_youtube(o),
                        wa_img=f"{stem}-whatsapp.png"))
    for i in range(len(daily), 0 if only else 6):  # pas assez d'offres valables toute la semaine
        day = start + dt.timedelta(days=i)
        md.append(f"## {date_fr(day)} — pas de nouvelle vidéo\n\nPas assez d'offres valables toute la semaine : "
                  "republie la vidéo qui a le mieux marché, ou saute ce jour.\n")
    if not only:
        md.append(f"## {date_fr(start + dt.timedelta(days=6))} — Top 3\n\nIl sera généré la veille au soir (vendredi), "
                  "avec les clics de la semaine : c'est le premier fichier du lot suivant.\n")

    if mot:
        mot.__exit__(None, None, None)
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
