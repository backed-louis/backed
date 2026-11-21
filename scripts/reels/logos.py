"""Logos des marques pour les vidéos et les visuels, téléchargés au moment de la génération.

Ordre de recherche (on garde la plus grande image trouvée, carrée de préférence) :
1. un fichier du dépôt, scripts/reels/logos/<slug>.png (ou .jpg, .webp) : logo choisi à la main, toujours prioritaire ;
2. une adresse donnée à la main dans scripts/reels/logos/sources.json ({"slug": "https://…"}) ;
3. les icônes déclarées par le site (apple-touch-icon, icônes du manifeste en 192/512 px, icône SVG) ;
4. les services d'icônes (Google en 256 px, DuckDuckGo) ;
5. le logo d'Airtable (souvent un favicon de 32 px).
En dessous de 64 px, pas de logo : la vidéo afficherait l'initiale de la marque, ce qu'on ne publie pas
(voir scripts/reels/logo_audit.py, qui liste les marques sans logo net).
"""
import io
import json
import os
import re
import urllib.parse
import urllib.request

from PIL import Image

MIN_SIZE = 64
GOOD_SIZE = 180
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/124.0 Safari/537.36")
LOCAL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logos")
_cache = {}


def domain_of(website):
    w = (website or "").strip()
    if not w:
        return ""
    if "://" not in w:
        w = "https://" + w
    host = (urllib.parse.urlparse(w).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def _raw(url, timeout=10, limit=3_000_000):
    """(contenu, adresse finale) ou (None, url)."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*", "Accept-Language": "fr-FR,fr"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read(limit), r.geturl()
    except Exception:  # noqa: BLE001 — un site injoignable n'arrête pas le lot
        return None, url


def _open(data):
    """Image RGBA depuis des octets (PNG, JPEG, ICO, WebP… ou SVG si cairosvg est installé), sinon None."""
    if not data:
        return None
    try:
        im = Image.open(io.BytesIO(data))
        im.load()
        return im.convert("RGBA")
    except Exception:  # noqa: BLE001
        pass
    if b"<svg" in data[:4000].lower():
        try:
            import cairosvg  # facultatif : rend les icônes SVG
            im = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=data, output_width=512)))
            im.load()
            return im.convert("RGBA")
        except Exception:  # noqa: BLE001
            return None
    return None


def _get(url):
    return _open(_raw(url)[0])


def _attr(tag, name):
    m = re.search(name + r'\s*=\s*["\']([^"\']+)', tag, re.I)
    return m.group(1) if m else ""


def page_icons(dom):
    """Icônes déclarées par la page d'accueil : <link rel=…icon…> et icônes du manifeste."""
    html, base = _raw(f"https://{dom}/", limit=1_500_000)
    if not html:
        html, base = _raw(f"https://www.{dom}/", limit=1_500_000)
    if not html:
        return []
    out = []
    for tag in re.findall(r"<link\b[^>]*>", html.decode("utf-8", "ignore"), re.I):
        rel, href = _attr(tag, "rel").lower(), _attr(tag, "href")
        if not href:
            continue
        url = urllib.parse.urljoin(base, href)
        if "manifest" in rel:
            mdata, mbase = _raw(url, limit=500_000)
            try:
                icons = json.loads(mdata or b"{}").get("icons", [])
            except Exception:  # noqa: BLE001
                icons = []
            out += [urllib.parse.urljoin(mbase, i.get("src", "")) for i in icons if i.get("src")]
        elif "icon" in rel:
            out.append(url)
    return out


def _local(slug):
    for ext in ("png", "jpg", "jpeg", "webp"):
        p = os.path.join(LOCAL, f"{slug}.{ext}")
        if slug and os.path.exists(p):
            with open(p, "rb") as f:
                return _open(f.read()), p
    return None, ""


def _manual(slug):
    try:
        with open(os.path.join(LOCAL, "sources.json"), encoding="utf-8") as f:
            return json.load(f).get(slug, "")
    except Exception:  # noqa: BLE001
        return ""


def fetch_with_source(brand, website, airtable_logos=(), slug=""):
    """(meilleur logo RGBA ou None, d'où il vient)."""
    key = (slug or brand).lower()
    if key in _cache:
        return _cache[key]
    im, src = _local(slug)
    if im is not None:
        _cache[key] = (im, src)
        return _cache[key]
    dom = domain_of(website)
    groups = []
    if _manual(slug):
        groups.append([_manual(slug)])
    if dom:
        groups.append([f"https://{dom}/apple-touch-icon.png", f"https://www.{dom}/apple-touch-icon.png"])
        groups.append(page_icons(dom))
        groups.append([f"https://www.google.com/s2/favicons?domain={dom}&sz=256",
                       f"https://icons.duckduckgo.com/ip3/{dom}.ico"])
    groups.append([u for u in airtable_logos if u])
    best, best_src = None, ""
    for urls in groups:
        for url in dict.fromkeys(urls):
            got = _get(url)
            if got and (best is None or min(got.size) > min(best.size)):
                best, best_src = got, url
        if best and min(best.size) >= GOOD_SIZE:
            break
    _cache[key] = (best, best_src) if best and min(best.size) >= MIN_SIZE else (None, best_src)
    return _cache[key]


def fetch(brand, website, airtable_logos=(), slug=""):
    """Meilleur logo trouvé pour la marque (image RGBA), ou None."""
    return fetch_with_source(brand, website, airtable_logos, slug)[0]


def airtable_urls(field):
    """URLs d'un champ pièce jointe Airtable, la plus grande vignette d'abord."""
    urls = []
    for a in field or []:
        th = (a.get("thumbnails") or {}).get("full") or {}
        urls += [th.get("url"), a.get("url")]
    return [u for u in urls if u]
