// Outils communs des vidéos premium : courbes, textes, fond vivant, tuile de logo, carte de l'offre, doigt, fin Backed.
// Chaque page définit setup() et render(t) ; moteur.py appelle render(t) pour chaque image.
const $ = id => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const prog = (t, s, d) => clamp((t - s) / d);
const lerp = (a, b, p) => a + (b - a) * p;
const eo = x => 1 - Math.pow(1 - x, 3);
const eo5 = x => 1 - Math.pow(1 - x, 5);
const expo = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const back = (x, k = 1.7) => 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2);
const spring = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-6.5 * x) * Math.cos(9 * x);
const CX = 520;   // axe de la zone sûre TikTok / Reels (x 120–920, y 300–1360)

function esc(s) { return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function textWidth(el) { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().width; }
function fitSize(el, maxw, max) { el.style.fontSize = "100px"; return Math.min(max, 100 * maxw / textWidth(el)); }
function words(el, text) {
  el.innerHTML = text.split(" ").map(w => `<span class="word"><span>${esc(w)}</span></span>`).join(" ");
  return [...el.querySelectorAll(".word > span")];
}
function show(el, on) { el.style.display = on ? (el.dataset.d || "block") : "none"; }
function blur(el, px) { el.style.filter = px > .05 ? `blur(${px}px)` : "none"; }
const de = n => (/^[aeiouyhéèêàâîôû]/i.test(n) ? "d'" : "de ") + n;

// tuile du logo : style "opaque" (carré plein cadre), "pad" (posé sur blanc), "pad-dark" (logo clair, posé sur sombre) ;
// sans logo, l'initiale de la marque sur violet
function tileHTML(logo, name, size, style) {
  if (!logo) return `<div class="tile lettre" style="width:${size}px;height:${size}px"><span style="font-size:${size * .55}px">${esc((name || "?").slice(0, 1).toUpperCase())}</span></div>`;
  const cls = style === "opaque" ? "" : " pad", bg = style === "pad-dark" ? "background:#1b1c29;" : "";
  return `<div class="tile${cls}" style="width:${size}px;height:${size}px;${bg}"><img src="${logo}"></div>`;
}

function cardHTML(D) {
  return `<div class="c-head">${tileHTML(D.logo, D.marque, 72, D.logoStyle)}<div class="c-brand">${esc(D.marque)}</div></div>
    ${D.avantage ? `<div class="c-benefit">${esc(D.avantage)}</div>` : ""}
    <div class="codebtn"><span>${esc(D.code)}</span><div class="ok">✓ Copié !</div></div>
    ${D.createur ? `<div class="c-credit">Partagé par <b>${esc(D.createur)}</b></div>` : ""}`;
}

// ------------------------------------------------------------------ fond, grain, fin
function setupCommon() {
  const f = $("frame");
  f.insertAdjacentHTML("afterbegin", `<div class="orb" id="orb1"></div><div class="orb" id="orb2"></div>`);
  $("outro").innerHTML = `<div class="orb" id="oglow"></div>
    <div id="bar"><div id="mag"></div><div id="typed"></div></div>
    <div id="dot"></div><div class="ring" id="ring1"></div><div class="ring" id="ring2"></div><div id="sparks"></div><div id="ocaret"></div>
    <div class="sig" id="sig1">Avant de payer,</div><div class="sig" id="sig2" style="color:var(--lilas)">passe par Backed.</div>
    <div id="pill"><span>backed.fr</span><i id="shine"></i></div>
    <div id="free">Gratuit · sans compte</div>`;
  f.insertAdjacentHTML("beforeend", `<div id="flash"></div><canvas id="grain" width="540" height="960"></canvas><div id="vignette"></div>`);
  $("outro").style.display = "block";   // visible le temps de mesurer les textes
  $("typed").innerHTML = "Backed".split("").map(c => `<span>${c}</span>`).join("");
  const ts = fitSize($("typed"), 470, 150);
  [...$("typed").children].forEach(s => s.style.fontSize = ts + "px");
  $("typed").style.fontSize = ts + "px";
  window.OUT = { ts };
  $("sparks").innerHTML = Array.from({ length: 10 }, () => `<div class="spark"></div>`).join("");
  const sz = Math.min(fitSize($("sig1"), 790, 92), fitSize($("sig2"), 790, 92));
  $("sig1").style.fontSize = $("sig2").style.fontSize = sz + "px";
  OUT.sigTop = 940; OUT.sig = sz;
  $("sig1").style.top = OUT.sigTop + "px"; $("sig2").style.top = (OUT.sigTop + sz * 1.12) + "px";
  $("outro").style.display = "none";
  const g = $("grain").getContext("2d"), img = g.createImageData(540, 960);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < img.data.length; i += 4) { const v = rnd() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  $("grain").style.width = "1620px"; $("grain").style.height = "2880px";
}

function renderBackground(t, glow = .6) {
  $("orb1").style.cssText = `width:1100px;height:1100px;left:${-180 + 60 * Math.sin(t * .35)}px;top:${200 + 50 * Math.cos(t * .3)}px;background:radial-gradient(circle, rgba(139,0,255,${.34 * glow}), rgba(139,0,255,0) 62%)`;
  $("orb2").style.cssText = `width:900px;height:900px;left:${420 + 50 * Math.cos(t * .28)}px;top:${1000 + 60 * Math.sin(t * .32)}px;background:radial-gradient(circle, rgba(178,102,255,${.18 * glow}), rgba(178,102,255,0) 62%)`;
  const f = Math.floor(t * 30);
  $("grain").style.transform = `translate(${-((f * 137) % 540)}px, ${-((f * 251) % 960)}px)`;
}

function renderFlash(t, at) {
  const fl = prog(t, at, .5);
  $("flash").style.opacity = fl > 0 && fl < 1 ? Math.sin(fl * Math.PI) * .55 : 0;
}

// titre d'étape (kicker + titre) : entre, puis sort avant que le suivant n'entre
function renderStep(el, t, a, b) {
  const pin = expo(prog(t, a, .6)), pout = eio(prog(t, b - .05, .25));
  el.style.opacity = t < a || t > b + .3 ? 0 : pin * (1 - pout);
  el.style.transform = `translateY(${(1 - pin) * 50 - pout * 50}px)`;
  blur(el, (1 - pin) * 8 + pout * 8);
}

// doigt qui appuie : taps = [[instant, rect], …]
function renderFinger(t, taps) {
  let on = false;
  for (const [at, r] of taps) {
    const d = t - at;
    if (!r || d <= -.45 || d >= .5) continue;
    on = true;
    const x = r.left + r.width / 2, y = r.top + r.height / 2, inP = eo(prog(d, -.45, .35)), outP = prog(d, .15, .3);
    $("finger").style.transform = `translate(${x + (1 - inP) * 60}px, ${y + (1 - inP) * 90}px) scale(${d > -.05 && d < .12 ? .82 : 1})`;
    $("finger").style.opacity = inP * (1 - outP) * .95;
    const rp = prog(d, 0, .5);
    $("ripple").style.transform = `translate(${x}px, ${y}px) scale(${1 + rp * 1.8})`;
    $("ripple").style.opacity = d >= 0 ? (1 - rp) * .9 : 0;
  }
  show($("finger"), on); show($("ripple"), on);
}

// fin : mêmes temps que les vidéos (render.py) pour la signature sonore
const TYPE_T0 = .20, TYPE_DT = .085, DOT_T = TYPE_T0 + 6 * TYPE_DT + .06, PULSE_T = DOT_T + .17, TXT_T = PULSE_T + .45;
function renderOutro(t, T0) {
  const lt = t - T0;
  show($("outro"), lt > -.05);
  if (lt <= -.05) return;
  const g = .5 + .25 * eo(prog(lt, 0, .6)) + .35 * eo(prog(lt, DOT_T, .15)) * (1 - prog(lt, DOT_T + .15, .8));
  $("oglow").style.cssText = `left:0px;top:${720 - 380}px;width:1040px;height:760px;background:radial-gradient(ellipse, rgba(139,0,255,${.5 * g}), rgba(139,0,255,0) 65%)`;
  const ain = back(prog(lt, 0, .38));
  $("bar").style.opacity = clamp(prog(lt, 0, .25));
  $("bar").style.transform = `translateY(${(1 - clamp(ain)) * 120}px) scale(${.92 + .08 * ain})`;
  const spans = [...$("typed").children];
  spans.forEach((sp, i) => {
    const p = prog(lt, TYPE_T0 + i * TYPE_DT, .12);
    sp.style.opacity = clamp(p * 1.5);
    sp.style.transform = `scale(${1.35 - .35 * eo(p)})`;
  });
  const by = 605 + (1 - clamp(ain)) * 120, ts = OUT.ts, last = spans[5];
  const textEnd = 120 + 165 + last.offsetLeft + last.offsetWidth;
  const r = ts * .105, dx = textEnd + ts * .03 + r, dy = by + 112 + ts * .34 - r;
  const pd = prog(lt, DOT_T, .3);
  const rr = pd > .001 ? r * back(pd, 2.4) * (1 + .22 * Math.sin(Math.PI * prog(lt, PULSE_T, .25))) : 0;
  $("dot").style.cssText = `left:${dx - rr}px;top:${dy - rr}px;width:${2 * rr}px;height:${2 * rr}px`;
  [["ring1", DOT_T, 5], ["ring2", PULSE_T, 3.2]].forEach(([id, at, amp]) => {
    const rp = prog(lt, at, .45), R = r * (1 + amp * eo(rp));
    $(id).style.cssText = `left:${dx - R}px;top:${dy - R}px;width:${2 * R}px;height:${2 * R}px;opacity:${rp > 0 && rp < 1 ? (1 - rp) * .86 : 0}`;
  });
  const spk = prog(lt, DOT_T, .4);
  [...$("sparks").children].forEach((el, k) => {
    const ang = k * 2 * Math.PI / 10 + .3, dist = r * (1.5 + 6 * eo(spk)), q = 18 * (1 - spk);
    el.style.cssText = `left:${dx + Math.cos(ang) * dist - q / 2}px;top:${dy + Math.sin(ang) * dist - q / 2}px;width:${q}px;height:${q}px;opacity:${spk > 0 && spk < 1 ? 1 - spk : 0};background:${k % 2 ? "var(--lilas)" : "var(--vio)"}`;
  });
  const n = Math.min(6, Math.floor(Math.max(0, lt - TYPE_T0) / TYPE_DT) + 1);
  const cxp = lt < DOT_T ? 120 + 165 + (lt > TYPE_T0 ? spans[n - 1].offsetLeft + spans[n - 1].offsetWidth : 0) + 12 : dx + r + 16;
  const ca = 1 - prog(lt, PULSE_T + .15, .2);
  $("ocaret").style.cssText = `left:${cxp}px;top:${by + 112 - 56}px;opacity:${ca > 0 && lt > TYPE_T0 - .05 && (lt < DOT_T || Math.floor(lt * 3.2) % 2 === 0) ? ca * clamp(ain) : 0}`;
  const t0 = TXT_T - .15;
  [["sig1", t0], ["sig2", t0 + .12]].forEach(([id, at]) => {
    const p = expo(prog(lt, at, .55));
    $(id).style.opacity = p; $(id).style.transform = `translateY(${(1 - p) * 50}px)`; blur($(id), (1 - p) * 10);
  });
  const pillTop = OUT.sigTop + OUT.sig * 2.35 + 30, pp = back(prog(lt, t0 + .3, .45));
  $("pill").style.top = pillTop + "px";
  $("pill").style.opacity = clamp(pp * 2);
  $("pill").style.transform = `translateX(-50%) scale(${clamp(pp, 0, 1.2) * .3 + .7})`;
  const sh = prog(lt, t0 + .75, .6);
  $("shine").style.left = (-120 + 760 * sh) + "px";
  $("shine").style.opacity = sh > 0 && sh < 1 ? 1 : 0;
  const fr = expo(prog(lt, t0 + .55, .5));
  $("free").style.top = (pillTop + 140) + "px";
  $("free").style.opacity = fr; $("free").style.transform = `translateY(${(1 - fr) * 20}px)`;
}

// démarrage : polices, puis images, puis setup() de la page
function boot() {
  document.fonts.ready.then(() => {
    setupCommon();
    setup();
    const imgs = [...document.querySelectorAll("img")];
    Promise.all(imgs.map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => {
      if (window.measure) measure();
      render(0);
      window.READY = true;
    });
  });
}
