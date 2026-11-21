"""Logos des marques pour les vidéos et les visuels, téléchargés au moment de la génération.

Ordre de recherche (on garde la plus grande image trouvée, carrée de préférence) :
1. un fichier du dépôt, scripts/reels/logos/<slug>.png (ou .jpg, .webp) : logo choisi à la main, toujours prioritaire ;
2. une adresse donnée à la main dans scripts/reels/logos/sources.json ({"slug": "https://…"}) ;
3. les icônes déclarées par le site (apple-touch-icon, icônes du manifeste en 192/512 px, icône SVG) ;
4. les services d'icônes (Google en 256 px, DuckDuckGo) ;
5. l'icône de l'app de la marque sur l'App Store (512 px, carrée), si l'app est bien la sienne (site ou éditeur) ;
6. le logo de la marque sur Wikidata / Wikimedia Commons (souvent un logotype en longueur) ;
7. le logo d'Airtable (souvent un favicon de 32 px).
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
# Sites qui ne sont pas ceux de la marque (boutique, billetterie, page d'agence…) : leurs icônes seraient fausses.
HOTES_TIERS = ("amazon.", "playstation.com", "kolsquare", "noxinfluencer", "billetweb", "youtube.com", "youtu.be",
               "linktr.ee", "bit.ly", "instagram.com", "tiktok.com", "twitch.tv", "google.")


def domain_of(website):
    w = (website or "").strip()
    if not w:
        return ""
    if "://" not in w:
        w = "https://" + w
    host = (urllib.parse.urlparse(w).hostname or "").lower()
    host = host[4:] if host.startswith("www.") else host
    return "" if any(t in host for t in HOTES_TIERS) else host


def _full_size(url):
    """Image Shopify (…/cdn/shop/…?width=32, _96x96.png) : la même en taille d'origine."""
    if "/cdn/shop/" not in url:
        return url
    u = urllib.parse.urlparse(url)
    q = [(k, v) for k, v in urllib.parse.parse_qsl(u.query) if k not in ("width", "height", "crop")]
    path = re.sub(r"_\d+x\d*(?=\.\w+$)", "", u.path)
    return urllib.parse.urlunparse(u._replace(path=path, query=urllib.parse.urlencode(q)))


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
        url = _full_size(urllib.parse.urljoin(base, href))
        if "mask" in rel:   # mask-icon (Safari) : silhouette noire, pas le logo
            continue
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


def _norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def app_icon(brand, dom, seller_hint=""):
    """Icône 512 px de l'app de la marque (App Store, France), seulement si l'app est bien la sienne : son site
    d'éditeur est celui de la marque, ou l'éditeur porte le nom de la marque (ou `seller_hint`)."""
    b, root = _norm(seller_hint or brand), _norm(dom.split(".")[0]) if dom else ""
    if len(b) < 3:
        return ""
    for entity in ("software", "macSoftware"):
        q = urllib.parse.urlencode({"term": brand, "entity": entity, "country": "fr", "limit": 8})
        data, _ = _raw(f"https://itunes.apple.com/search?{q}", limit=2_000_000)
        try:
            results = json.loads(data or b"{}").get("results", [])
        except Exception:  # noqa: BLE001
            results = []
        for r in results:
            seller_site = _norm(urllib.parse.urlparse(r.get("sellerUrl") or "").hostname or "")
            seller = _norm(r.get("sellerName") or r.get("artistName"))
            if (root and len(root) >= 3 and root in seller_site) or (b in seller) or (seller and seller in b and len(seller) >= 4):
                return r.get("artworkUrl512") or r.get("artworkUrl100") or ""
    return ""


def wikidata_logo(dom):
    """Logo (P154) de l'élément Wikidata dont le site officiel est ce domaine, rendu en PNG 512 px."""
    if not dom:
        return ""
    pattern = "^https?://([a-z0-9-]+\\\\.)?" + re.escape(dom).replace("\\", "\\\\") + "/?$"
    sparql = ('SELECT ?logo WHERE { ?item wdt:P856 ?site ; wdt:P154 ?logo . '
              f'FILTER(REGEX(LCASE(STR(?site)), "{pattern}")) }} LIMIT 1')
    data, _ = _raw("https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": sparql, "format": "json"}),
                   timeout=20, limit=200_000)
    try:
        b = json.loads(data or b"{}")["results"]["bindings"]
    except Exception:  # noqa: BLE001
        return ""
    if not b:
        return ""
    name = urllib.parse.unquote(b[0]["logo"]["value"].rsplit("/", 1)[-1])
    return "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(name) + "?width=512"


def _local(slug):
    for ext in ("png", "jpg", "jpeg", "webp"):
        p = os.path.join(LOCAL, f"{slug}.{ext}")
        if slug and os.path.exists(p):
            with open(p, "rb") as f:
                return _open(f.read()), p
    return None, ""


def _manual(slug):
    """Sources choisies à la main (scripts/reels/logos/sources.json) : une adresse, ou « appstore:Recherche|éditeur »,
    « wikidata-site:domaine.com » ; une liste pour en essayer plusieurs (la plus grande image gagne)."""
    try:
        with open(os.path.join(LOCAL, "sources.json"), encoding="utf-8") as f:
            spec = json.load(f).get(slug, [])
    except Exception:  # noqa: BLE001
        return []
    urls = []
    for item in ([spec] if isinstance(spec, str) else spec):
        if item.startswith("appstore:"):
            term, _, seller = item[9:].partition("|")
            urls.append(app_icon(term, "", seller))
        elif item.startswith("wikidata-site:"):
            urls.append(wikidata_logo(item[14:]))
        else:
            urls.append(item)
    return [u for u in urls if u]


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
    manual = _manual(slug)
    if manual:
        groups.append(manual)
    if dom:
        groups.append([f"https://{dom}/apple-touch-icon.png", f"https://www.{dom}/apple-touch-icon.png"])
        groups.append(page_icons(dom))
        groups.append([f"https://www.google.com/s2/favicons?domain={dom}&sz=256",
                       f"https://icons.duckduckgo.com/ip3/{dom}.ico"])
    groups.append(lambda: [app_icon(brand, dom)])
    groups.append(lambda: [wikidata_logo(dom)])
    groups.append([u for u in airtable_logos if u])
    best, best_src = None, ""
    for urls in groups:
        if callable(urls):   # sources plus lentes : seulement si rien de net avant
            urls = urls()
        for url in dict.fromkeys(u for u in urls if u):
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
