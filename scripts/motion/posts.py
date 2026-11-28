"""Posts image de Backed (Instagram et TikTok mode photo), dans le système « grille » de novembre 2026 :
une paire de couleurs par post (violet + acide, nuit + acide, acide + nuit), grain papier, typo géante, tampon, ticket de caisse.

Trois types :
- ticket : le ticket de caisse de la semaine (« TICKET N°49 »), les codes déjà sortis du lundi au samedi ; publié le dimanche ;
- tampon : le code le plus copié de la semaine, signé d'un tampon « LE PLUS COPIÉ · CODE VÉRIFIÉ » ;
- typo : 1 à 3 mots en typo géante, pour les temps forts (Cyber Monday, Noël, soldes), à la demande.

Chaque post sort en deux formats : Instagram 4:5 (1080 × 1350) et TikTok 9:16 (1080 × 1920). Le contenu tient dans
une zone 3:4 : c'est ce que montrent les grilles des profils Instagram et TikTok.

  python3 scripts/motion/posts.py typo --mots CYBER MON DAY. --fond violet --pied "les codes de tes créateurs" --out out/cyber
  python3 scripts/motion/posts.py exemple --out out/posts      # les trois types, avec des codes d'exemple

Utilisé par scripts/reels/generate_week.py (ticket du dimanche et tampon du mercredi).
"""
import argparse
import html
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "reels"))

V, A, N, W, P = "#8B00FF", "#C8FF3D", "#07080F", "#FFFFFF", "#F2EFE6"
FONDS = {"violet": (V, A), "nuit": (N, A), "acide": (A, N)}   # fond, couleur du texte
# zone 3:4 dans chaque format : (x, y, largeur, hauteur)
FORMATS = {"instagram": (1080, 1350, (33.75, 0, 1012.5, 1350)),
           "tiktok": (1080, 1920, (90, 250, 900, 1200))}   # TikTok : au-dessus de la légende et à gauche des boutons
TICKET = "M16 0H104A16 16 0 0 1 120 16V32A13 13 0 0 0 120 58V74A16 16 0 0 1 104 90H16A16 16 0 0 1 0 74V58A13 13 0 0 0 0 32V16A16 16 0 0 1 16 0Z"
BPATH = ('transform="translate(19.99 68) scale(0.07 -0.07)" d="M690 -14Q600 -14 528.0 4.5Q456 23 405.0 57.5Q354 92 327.0 139.5Q300 187 300 245Q300 303 '
         '327.0 351.0Q354 399 405.0 433.5Q456 468 528.0 486.5Q600 505 690 505Q798 505 882.5 476.0Q967 447 1015.0 389.0Q1063 331 1063 245Q1063 163 '
         '1015.0 105.0Q967 47 882.5 16.5Q798 -14 690 -14ZM600 138Q668 138 716.0 150.0Q764 162 789.0 186.0Q814 210 814 245Q814 299 758.0 325.5Q702 '
         '352 600 352Q524 352 460.5 343.0Q397 334 358.5 311.0Q320 288 320 245Q320 203 358.5 180.0Q397 157 460.5 147.5Q524 138 600 138ZM320 690V190Q320 '
         '126 315.5 74.5Q311 23 306 0H80V690Z"')
MOIS = ["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."]
GRAIN = ("url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E"
         "%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix "
         "values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' "
         "filter='url(%23n)'/%3E%3C/svg%3E\")")
e = html.escape


def u(n):
    return f"calc(var(--u) * {n})"


def ticket_svg(t, b, style=""):
    return f'<svg viewBox="0 0 120 90" style="display:block;{style}"><path fill="{t}" d="{TICKET}"/><path fill="{b}" {BPATH}/></svg>'


CSS = f"""
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{ overflow: hidden; }}
#post {{ position: absolute; left: 0; top: 0; overflow: hidden; isolation: isolate; font-family: Inter, sans-serif; }}
#post::after {{ content: ''; position: absolute; inset: 0; background-image: {GRAIN}; background-size: 600px; opacity: .35; mix-blend-mode: multiply; pointer-events: none; z-index: 5; }}
#post.violet {{ background: radial-gradient(130% 120% at 0% 0%, #A93BFF 0%, #8B00FF 40%, #5A00B5 100%); }}
#post.nuit {{ background: {N}; }}
#post.acide {{ background: {A}; }}
.zone {{ position: absolute; }}
.giant {{ position: absolute; left: 0; right: 0; top: {u(6)}; font-family: Syne, sans-serif; font-weight: 800; line-height: .84; letter-spacing: -.045em; white-space: nowrap; }}
.giant > div {{ width: max-content; }}
.giant .hl {{ padding: 0 {u(2)}; transform: rotate(-2deg); margin-top: {u(2.5)}; }}
.foot {{ position: absolute; left: {u(7)}; right: {u(7)}; bottom: {u(7)}; display: flex; align-items: center; gap: {u(3)}; font-family: Mono, monospace; font-weight: 800; font-size: {u(3.6)}; letter-spacing: .12em; text-transform: uppercase; }}
.foot svg {{ width: {u(9)}; flex-shrink: 0; }}
.lead {{ font-family: Syne, sans-serif; font-weight: 800; letter-spacing: -.02em; line-height: 1.05; }}
.big {{ font-family: Syne, sans-serif; font-weight: 800; letter-spacing: -.04em; line-height: .95; }}
.mono {{ font-family: Mono, monospace; font-weight: 800; letter-spacing: .08em; }}
.tag {{ position: absolute; left: {u(6)}; bottom: {u(6)}; font-family: Mono, monospace; font-weight: 800; font-size: {u(3.6)}; letter-spacing: .12em; padding: {u(1.4)} {u(2.4)}; border-radius: {u(1)}; transform: rotate(-3deg); z-index: 6; }}
.blinds {{ position: absolute; inset: -20%; background: repeating-linear-gradient(118deg, rgba(0,0,0,0) 0 97px, rgba(0,0,0,.22) 97px 162px); filter: blur(17px); pointer-events: none; z-index: 4; mix-blend-mode: multiply; }}
.rcpt {{ width: {u(64)}; background: {P}; color: {N}; font-family: Mono, monospace; font-size: {u(3.1)}; line-height: 1.35; padding: {u(6)} {u(5)} {u(8)}; position: relative;
  -webkit-mask: linear-gradient(#000 0 0) top/100% calc(100% - var(--u) * 2) no-repeat, conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/calc(var(--u) * 4) calc(var(--u) * 2) repeat-x;
          mask: linear-gradient(#000 0 0) top/100% calc(100% - var(--u) * 2) no-repeat, conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) bottom/calc(var(--u) * 4) calc(var(--u) * 2) repeat-x; }}
.rcpt::before {{ content: ''; position: absolute; inset: 0; background-image: {GRAIN}; background-size: 500px; opacity: .25; mix-blend-mode: multiply; }}
.r-head {{ text-align: center; }}
.r-head svg {{ width: {u(10)}; margin: 0 auto {u(1.5)}; }}
.r-brand {{ font-family: Syne, sans-serif; font-weight: 800; font-size: {u(6.5)}; letter-spacing: -.03em; line-height: 1; }}
.r-small {{ font-size: {u(2.4)}; letter-spacing: .1em; opacity: .75; margin-top: {u(.8)}; }}
.r-dash {{ border-top: {u(.45)} dashed {N}; opacity: .55; margin: {u(2.6)} 0; }}
.r-row {{ display: flex; justify-content: space-between; align-items: baseline; gap: {u(2)}; }}
.r-row b {{ font-weight: 800; }}
.r-row > :last-child {{ text-align: right; white-space: nowrap; }}
.r-sub {{ display: flex; justify-content: space-between; gap: {u(2)}; font-size: {u(2.6)}; opacity: .85; margin-bottom: {u(2)}; }}
.r-code {{ font-weight: 800; padding: 0 {u(.8)}; background: {A}; box-shadow: 0 0 0 {u(.3)} {A}; transform: rotate(-1.5deg); display: inline-block; }}
.r-num {{ font-family: Syne, sans-serif; font-weight: 800; font-size: {u(4.3)}; letter-spacing: -.03em; color: {V}; line-height: 1; white-space: nowrap; }}
.r-stamp {{ position: absolute; left: {u(1)}; bottom: {u(5)}; width: {u(26)}; height: {u(26)}; transform: rotate(-16deg); opacity: .9; mix-blend-mode: multiply; z-index: 2; }}
.r-total {{ font-size: {u(3.6)}; }}
.r-small2 {{ font-size: {u(2.6)}; opacity: .8; }}
.r-bar {{ height: {u(9)}; margin: {u(3)} {u(4)} {u(1)}; background: repeating-linear-gradient(90deg,{N} 0 2px,transparent 2px 4px,{N} 4px 7px,transparent 7px 9px,{N} 9px 10px,transparent 10px 13px); }}
"""

# mots en typo géante : chacun calé sur la largeur de la zone (les mots courts deviennent énormes)
FIT_JS = """
document.querySelectorAll('[data-fit]').forEach(el => {
  const zone = el.closest('.zone'), U = zone.offsetWidth / 100, target = parseFloat(el.dataset.fit) * U;
  el.style.fontSize = '100px';
  const w = el.getBoundingClientRect().width;
  el.style.fontSize = (100 * target / w) + 'px';
});
// le ticket : réduit s'il dépasse 92 % de la hauteur de la zone
document.querySelectorAll('[data-fith]').forEach(el => {
  const zone = el.closest('.zone'), h = el.getBoundingClientRect().height, max = zone.offsetHeight * parseFloat(el.dataset.fith);
  if (h > max) { el.style.transformOrigin = 'top center'; el.style.transform = `scale(${max / h})`; }
});
window.READY = true;
"""


def page(fmt, fond, inner, extra=""):
    from moteur import _fonts
    w, h, (zx, zy, zw, zh) = FORMATS[fmt]
    return f"""<!doctype html><meta charset="utf-8"><style>{_fonts()}{CSS}</style>
<div id="post" class="{fond}" style="width:{w}px;height:{h}px">{extra}
<div class="zone" style="left:{zx}px;top:{zy}px;width:{zw}px;height:{zh}px;--u:{zw / 100}px">{inner}</div></div>
<script>document.fonts.ready.then(() => {{ {FIT_JS} }});</script>"""


# ------------------------------------------------------------------ les trois types
def typo(mots, fond="violet", pied="avant de payer, passe par backed.fr", surligne_dernier=False):
    bg, fg = FONDS[fond]
    rows = ""
    for k, m in enumerate(mots):
        last = surligne_dernier and k == len(mots) - 1
        style = f"background:{fg};color:{bg if fond != 'violet' else N};display:inline-block" if last else ""
        rows += f'<div class="{"hl" if last else ""}" data-fit="{84 if last else 95}" style="margin-left:{u(4 if last else -1)};{style}">{e(m)}</div>'
    inner = (f'<div class="giant" style="color:{fg}">{rows}</div>'
             f'<div class="foot" style="color:{fg}">{ticket_svg(fg, bg if fond != "violet" else V)}<span>{e(pied)}</span></div>')
    return fond, inner, ""


def recu(items, numero, periode):
    lines = ""
    for o in items:
        lines += (f'<div class="r-row"><b>{e(o["creator"].upper())}</b><span>{e(o["gain"])}</span></div>'
                  f'<div class="r-sub"><span>{e(o["brand"].upper())}</span><span class="r-code">{e(o["code"])}</span></div>')
    return f"""<div class="rcpt">
<div class="r-head">{ticket_svg(V, W)}<div class="r-brand">BACKED</div><div class="r-small">backed.fr · codes vérifiés</div></div>
<div class="r-dash"></div>
<div style="text-align:center"><div class="r-num">TICKET N°{e(str(numero))}</div><div class="r-small" style="margin-top:{u(1.2)}">SEMAINE DU {e(periode)}</div></div>
<div class="r-dash"></div>
{lines}
<div class="r-dash"></div>
<div class="r-row r-total"><b>CODES VÉRIFIÉS</b><b>{len(items)} ✓</b></div>
<div class="r-row r-small2"><span>PRIX PAYÉ</span><span>LE BON</span></div>
<div class="r-dash"></div>
<div class="r-small" style="text-align:center">MERCI ET À LA SEMAINE PROCHAINE</div>
<div class="r-bar"></div>
<div class="r-small" style="text-align:center">BACKED.FR/L/INSTAGRAM</div>
<div class="r-stamp">{tampon_svg(V, P, "CODE VÉRIFIÉ ✦ BACKED.FR ✦ CODE VÉRIFIÉ ✦ BACKED.FR ✦", "")}</div>
</div>"""


def ticket(items, numero, periode):
    """items : [{creator, brand, gain, code}], dans l'ordre de sortie."""
    inner = (f'<div style="position:absolute;left:50%;top:{u(5)};transform:translateX(-50%) rotate(-4deg);'
             f'filter:drop-shadow(0 {u(4)} {u(5)} rgba(0,0,0,.5))"><div data-fith=".9">{recu(items, numero, periode)}</div></div>')
    return "violet", inner, '<div class="blinds"></div>'


_n = [0]


def tampon_svg(col, bg, texte, sous):
    _n[0] += 1
    i = _n[0]
    return f"""<svg viewBox="0 0 200 200" style="display:block;width:100%;height:100%;overflow:visible">
<defs><path id="sc{i}" d="M100,100 m-80,0 a80,80 0 1,1 160,0 a80,80 0 1,1 -160,0"/>
<filter id="sr{i}"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3"/></filter></defs>
<g filter="url(#sr{i})">
<circle cx="100" cy="100" r="97" fill="none" stroke="{col}" stroke-width="3.5"/>
<circle cx="100" cy="100" r="63" fill="none" stroke="{col}" stroke-width="2"/>
<text font-family="Mono, monospace" font-weight="800" font-size="14.5" fill="{col}" textLength="496" lengthAdjust="spacing"><textPath href="#sc{i}">{e(texte)}</textPath></text>
<g transform="translate(64 73) scale(.6)"><path fill="{col}" d="{TICKET}"/><path fill="{bg}" {BPATH}/></g>
<text x="100" y="146" text-anchor="middle" font-family="Mono, monospace" font-weight="800" font-size="9" letter-spacing="1.5" fill="{col}">{e(sous)}</text>
</g></svg>"""


def tampon(o, anneau="LE PLUS COPIÉ ✦ CODE VÉRIFIÉ ✦ LE PLUS COPIÉ ✦ CODE VÉRIFIÉ ✦", sous=""):
    """o : {creator, brand, gain, code}."""
    head = ("le code d'" if o["creator"][:1].lower() in "aeiouyhéèêàâîôû" else "le code de ") + o["creator"] if o.get("creator") else f"code {o['brand']}"
    big = o["gain"] or o["brand"]
    size = 15 if len(big) <= 8 else 11 if len(big) <= 14 else 8
    inner = f"""<div style="position:absolute;left:{u(8)};top:{u(8)};width:{u(52)};height:{u(52)};transform:rotate(-12deg)">{tampon_svg(N, A, anneau, sous)}</div>
<div style="position:absolute;left:{u(8)};right:{u(8)};bottom:{u(9)};color:{N}">
<div class="lead" style="font-size:{u(6.2)}">{e(head)}</div>
<div class="big" style="font-size:{u(size)};margin-top:{u(1)}">{e(big)}</div>
<div class="mono" style="font-size:{u(3.6)};margin-top:{u(2.5)}">{e(("CHEZ " + o["brand"] + " · CODE " + o["code"]).upper())}</div></div>"""
    return "acide", inner, ""


# ------------------------------------------------------------------ rendu
class Posts:
    """Rend les posts dans Chromium (Playwright). with Posts() as p: p.rendre(typo([...]), "out/x")"""

    def __init__(self, browser=None, executable_path=None):
        self._own = browser is None
        self._browser = browser
        self._exe = executable_path

    def __enter__(self):
        if self._own:
            from playwright.sync_api import sync_playwright
            self._pw = sync_playwright().start()
            self._browser = self._pw.chromium.launch(**({"executable_path": self._exe} if self._exe else {}))
        return self

    def __exit__(self, *exc):
        if self._own:
            self._browser.close()
            self._pw.stop()

    def rendre(self, post, stem, formats=("instagram", "tiktok")):
        """Écrit <stem>-instagram.png et <stem>-tiktok.png ; renvoie les chemins."""
        fond, inner, extra = post
        out = []
        for fmt in formats:
            w, h, _ = FORMATS[fmt]
            pg = self._browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
            pg.on("pageerror", lambda err: print(f"⚠️ erreur dans la page : {err}", flush=True))
            pg.set_content(page(fmt, fond, inner, extra))
            pg.wait_for_function("window.READY === true", timeout=30000)
            pg.wait_for_timeout(150)
            path = f"{stem}-{fmt}.png"
            pg.screenshot(path=path, type="png")
            pg.close()
            out.append(path)
        return out


def periode_fr(lundi, samedi):
    if lundi.month == samedi.month:
        return f"{lundi.day}–{samedi.day} {MOIS[samedi.month - 1]}"
    return f"{lundi.day} {MOIS[lundi.month - 1]}–{samedi.day} {MOIS[samedi.month - 1]}"


EXEMPLE = [
    {"creator": "Nassim Sahili", "brand": "Withings", "gain": "-15 %", "code": "NASSIM15"},
    {"creator": "AstronoGeek", "brand": "Incogni", "gain": "-60 %", "code": "ASTRONOGEEK"},
    {"creator": "Baptiste Pitois", "brand": "Oscaro", "gain": "-10 %", "code": "BAPTISTE10"},
    {"creator": "Mcfly et Carlito", "brand": "HelloFresh", "gain": "Jusqu'à -85 €", "code": "MCFLYCARLITO26"},
    {"creator": "Jojol", "brand": "Certideal", "gain": "-25 €", "code": "JOJOL"},
    {"creator": "Diego", "brand": "Japhy", "gain": "-60 %", "code": "CALIN"},
]

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("type", choices=["typo", "exemple"])
    ap.add_argument("--mots", nargs="+", help="1 à 3 mots, en capitales (ex. CYBER MON DAY.)")
    ap.add_argument("--fond", choices=list(FONDS), default="violet")
    ap.add_argument("--pied", default="avant de payer, passe par backed.fr")
    ap.add_argument("--surligne-dernier", action="store_true", help="le dernier mot sur une étiquette (ex. BACKED.)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--chrome", help="chemin de Chrome si Playwright n'a pas installé Chromium")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    with Posts(executable_path=a.chrome) as p:
        if a.type == "typo":
            print("\n".join(p.rendre(typo(a.mots, a.fond, a.pied, a.surligne_dernier), os.path.join(a.out, "typo"))))
        else:
            print("\n".join(p.rendre(ticket(EXEMPLE, 49, "30 NOV.–5 DÉC."), os.path.join(a.out, "ticket"))))
            print("\n".join(p.rendre(tampon(EXEMPLE[1], sous="02.12.2026"), os.path.join(a.out, "tampon"))))
            print("\n".join(p.rendre(typo(["CYBER", "MON", "DAY."], "violet", "les codes de tes créateurs"), os.path.join(a.out, "typo"))))
