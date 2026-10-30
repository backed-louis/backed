"""Logos des marques pour les vidéos et les visuels, téléchargés au moment de la génération.

Les logos enregistrés dans Airtable sont souvent des favicons de 32 px : trop flous en grand. On essaie
d'abord l'icône haute définition du site (Google, 256 px, puis apple-touch-icon, 180 px), puis le logo
d'Airtable. On garde la plus grande ; en dessous de 64 px, pas de logo (la vidéo s'affiche sans).
"""
import io
import urllib.parse
import urllib.request

from PIL import Image

MIN_SIZE = 64
UA = "Mozilla/5.0 (compatible; BackedBot/1.0; +https://backed.fr)"
_cache = {}


def domain_of(website):
    w = (website or "").strip()
    if not w:
        return ""
    if "://" not in w:
        w = "https://" + w
    host = (urllib.parse.urlparse(w).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def _get(url, timeout=10):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read(3_000_000)
        im = Image.open(io.BytesIO(data))
        im.load()
        return im.convert("RGBA")
    except Exception:
        return None


def candidates(website, airtable_logos=()):
    dom = domain_of(website)
    urls = []
    if dom:
        urls += [f"https://www.google.com/s2/favicons?domain={dom}&sz=256",
                 f"https://{dom}/apple-touch-icon.png",
                 f"https://www.{dom}/apple-touch-icon.png"]
    return urls + [u for u in airtable_logos if u]


def fetch(brand, website, airtable_logos=()):
    """Meilleur logo trouvé pour la marque (image RGBA), ou None."""
    key = brand.lower()
    if key in _cache:
        return _cache[key]
    best = None
    for url in candidates(website, airtable_logos):
        im = _get(url)
        if im and (best is None or min(im.size) > min(best.size)):
            best = im
        if best and min(best.size) >= 180:
            break
    _cache[key] = best if best and min(best.size) >= MIN_SIZE else None
    return _cache[key]


def airtable_urls(field):
    """URLs d'un champ pièce jointe Airtable, la plus grande vignette d'abord."""
    urls = []
    for a in field or []:
        th = (a.get("thumbnails") or {}).get("full") or {}
        urls += [th.get("url"), a.get("url")]
    return [u for u in urls if u]
