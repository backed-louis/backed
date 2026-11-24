"""Trouve une chaîne YouTube à partir d'un nom, d'un @handle ou d'une adresse, pour l'ajouter à la table Creators :
affiche les chaînes candidates avec leur Channel ID, leur @handle, leurs abonnés et leur avatar.

  YOUTUBE_API_KEY=... python3 scripts/trouver_chaine.py "Arthur Morault"
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

KEY = os.environ["YOUTUBE_API_KEY"]
API = "https://www.googleapis.com/youtube/v3/"


def get(path, **params):
    params["key"] = KEY
    with urllib.request.urlopen(API + path + "?" + urllib.parse.urlencode(params), timeout=30) as r:
        return json.load(r)


def main():
    q = " ".join(sys.argv[1:]).strip()
    ids = []
    m = re.search(r"(UC[\w-]{22})", q)
    h = re.search(r"@([\w.-]+)", q)
    if m:
        ids = [m.group(1)]
    elif h:
        ids = [i["id"] for i in get("channels", part="id", forHandle=h.group(1)).get("items", [])]
    if not ids:
        ids = [i["snippet"]["channelId"] for i in get("search", part="snippet", type="channel", q=q, maxResults=8,
                                                       regionCode="FR", relevanceLanguage="fr").get("items", [])]
    rows = get("channels", part="snippet,statistics", id=",".join(ids)).get("items", []) if ids else []
    lines = [f"## Chaînes trouvées pour « {q} »", "", "| Chaîne | @handle | Channel ID | Abonnés | Avatar |",
             "|---|---|---|---|---|"]
    for c in rows:
        s, st = c["snippet"], c.get("statistics", {})
        avatar = (s.get("thumbnails", {}).get("high") or s.get("thumbnails", {}).get("default") or {}).get("url", "")
        lines.append(f"| {s['title']} | {s.get('customUrl', '')} | {c['id']} | {st.get('subscriberCount', '?')} | {avatar} |")
    out = "\n".join(lines)
    print(out)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(out + "\n")


if __name__ == "__main__":
    main()
