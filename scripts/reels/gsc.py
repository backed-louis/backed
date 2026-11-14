"""Chiffres de la Google Search Console pour les pages marques de backed.fr (/marque/<slug>).

Lit la clé du compte de service dans GSC_SERVICE_ACCOUNT (secret GitHub, accès « Restreint », lecture seule).
Compare les impressions des 7 derniers jours à la moyenne hebdomadaire des 28 jours d'avant, par marque.

  python3 scripts/reels/gsc.py --out gsc.json      # écrit le classement des marques
"""
import argparse
import datetime as dt
import json
import os
import sys
import urllib.parse

SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
API = "https://searchconsole.googleapis.com/webmasters/v3"
MIN_IMPRESSIONS = 30          # en dessous, une hausse en % ne veut rien dire


def session():
    from google.oauth2 import service_account
    from google.auth.transport.requests import AuthorizedSession
    info = json.loads(os.environ["GSC_SERVICE_ACCOUNT"])
    creds = service_account.Credentials.from_service_account_info(info, scopes=[SCOPE])
    return AuthorizedSession(creds)


def pick_site(s):
    r = s.get(f"{API}/sites"); r.raise_for_status()
    sites = [x["siteUrl"] for x in r.json().get("siteEntry", []) if x.get("permissionLevel") != "siteUnverifiedUser"]
    print(f"Propriétés accessibles : {len(sites)}", flush=True)
    for pref in ("sc-domain:backed.fr", "https://www.backed.fr/", "https://backed.fr/"):
        if pref in sites:
            return pref
    if sites:
        return sites[0]
    sys.exit("Aucune propriété Search Console accessible : vérifier l'ajout du compte de service dans la Search Console.")


def query(s, site, start, end, dims, filters=None, limit=25000):
    body = {"startDate": start.isoformat(), "endDate": end.isoformat(), "dimensions": dims, "rowLimit": limit, "dataState": "all"}
    if filters:
        body["dimensionFilterGroups"] = [{"filters": filters}]
    r = s.post(f"{API}/sites/{urllib.parse.quote(site, safe='')}/searchAnalytics/query", json=body); r.raise_for_status()
    return r.json().get("rows", [])


def slug_of(url):
    path = urllib.parse.urlparse(url).path
    parts = [p for p in path.split("/") if p]
    return parts[1] if len(parts) >= 2 and parts[0] == "marque" else None


def brand_stats(s, site, today=None):
    today = today or dt.date.today()
    end = today - dt.timedelta(days=1)                 # « all » : les données récentes, encore provisoires
    rec_start = end - dt.timedelta(days=6)
    base_end = rec_start - dt.timedelta(days=1)
    base_start = base_end - dt.timedelta(days=27)
    flt = [{"dimension": "page", "operator": "contains", "expression": "/marque/"}]
    agg = {}
    for key, a, b in (("rec", rec_start, end), ("base", base_start, base_end)):
        for row in query(s, site, a, b, ["page"], flt):
            slug = slug_of(row["keys"][0])
            if not slug:
                continue
            d = agg.setdefault(slug, {"slug": slug, "rec": 0, "base": 0, "clics": 0, "pos": None})
            d[key] += row["impressions"]
            if key == "rec":
                d["clics"] += row["clicks"]
                d["pos"] = round(row["position"], 1)
    out = []
    for d in agg.values():
        base_week = d["base"] / 4
        d["base_semaine"] = round(base_week, 1)
        d["hausse_pct"] = round(100 * (d["rec"] - base_week) / base_week) if base_week >= 5 else None
        d["gain"] = round(d["rec"] - base_week)
        out.append(d)
    # classement : marques avec assez d'impressions, la plus forte hausse absolue d'abord
    ranked = sorted([d for d in out if d["rec"] >= MIN_IMPRESSIONS and d["gain"] > 0], key=lambda d: -d["gain"])
    period = {"recent": [rec_start.isoformat(), end.isoformat()], "base": [base_start.isoformat(), base_end.isoformat()]}
    return ranked, out, period


def top_queries(s, site, slug, today=None, n=5):
    today = today or dt.date.today()
    end = today - dt.timedelta(days=1)
    rows = query(s, site, end - dt.timedelta(days=6), end, ["query"],
                 [{"dimension": "page", "operator": "contains", "expression": f"/marque/{slug}"}], limit=n)
    return [(r["keys"][0], r["impressions"]) for r in rows]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="gsc.json")
    a = ap.parse_args()
    s = session()
    site = pick_site(s)
    ranked, allb, period = brand_stats(s, site)
    for d in ranked[:10]:
        d["requetes"] = top_queries(s, site, d["slug"])
    json.dump({"site": site, "periode": period, "classement": ranked, "toutes": allb}, open(a.out, "w"), ensure_ascii=False, indent=1)
    print(f"{len(allb)} pages marques, {len(ranked)} en hausse (≥ {MIN_IMPRESSIONS} impressions sur 7 jours)", flush=True)


if __name__ == "__main__":
    main()
