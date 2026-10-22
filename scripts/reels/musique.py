"""Musique originale des vidéos Backed (électro minimale), calée sur les coupes de la vidéo.

- 4 variantes de fond (tempo, tonalité et groove différents), qui tournent d'une vidéo à l'autre.
- Une signature sonore identique sur le logo de fin de chaque vidéo (le « logo sonore » de Backed).

Tout est synthétisé ici, sans aucun sample externe : pas de droits d'auteur.

Usage : python3 musique.py sortie.wav durée variante coupe1 coupe2 ...
(la dernière coupe est le début du plan logo)
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100

# (BPM, progression : (basse, accord) par mesure, hats en doubles croches, basse sur quels contretemps)
VARIANTES = [
    (124, [(57, [69, 72, 76]), (53, [65, 69, 72]), (48, [64, 67, 72]), (55, [62, 67, 71])], False, (0.5, 0.75)),  # la mineur
    (118, [(50, [62, 65, 69]), (46, [62, 65, 70]), (53, [60, 65, 69]), (48, [60, 64, 67])], False, (0.5,)),        # ré mineur
    (128, [(52, [64, 67, 71]), (48, [64, 67, 72]), (55, [62, 67, 71]), (50, [62, 66, 69])], True, (0.5, 0.75)),   # mi mineur
    (122, [(48, [63, 67, 72]), (44, [63, 68, 72]), (51, [63, 67, 70]), (46, [62, 65, 70])], True, (0.25, 0.5)),   # do mineur
]


def _t(d):
    return np.arange(int(d * SR)) / SR


def _sos(kind, f):
    return butter(2, f, kind, fs=SR, output='sos')


def _lp(x, f):
    return sosfilt(_sos('low', f), x)


def _hp(x, f):
    return sosfilt(_sos('high', f), x)


def _bp(x, lo, hi):
    return sosfilt(_sos('band', [lo, hi]), x)


def _add(buf, sig, at):
    i = int(at * SR)
    if i < 0:
        sig, i = sig[-i:], 0
    if i >= len(buf):
        return
    n = min(len(sig), len(buf) - i)
    buf[i:i + n] += sig[:n]


def _note(n):
    return 440 * 2 ** ((n - 69) / 12)


def _saw(freq, d, detune=0.0):
    t = _t(d)
    return sum(np.sin(2 * np.pi * freq * (1 + detune) * k * t) / k for k in range(1, 14))


def _kick():
    t = _t(0.42)
    f = 45 + 95 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5) + np.sin(2 * np.pi * 2000 * t) * np.exp(-t * 300) * 0.15


def _clap(rng):
    t = _t(0.22)
    env = np.exp(-t * 22)
    for d in (0.0, 0.012, 0.024):
        env = env + np.where(t >= d, np.exp(-(t - d) * 120), 0) * 0.6
    return _bp(rng.standard_normal(len(t)), 900, 4000) * env * 0.32


def _hat(rng, open_=False):
    t = _t(0.18 if open_ else 0.045)
    return _hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * (18 if open_ else 90)) * 0.16


def _whoosh(rng, d=0.45):
    t = _t(d)
    n = rng.standard_normal(len(t))
    out = np.zeros_like(t)
    blocks = 12
    for b in range(blocks):
        s, e = b * len(t) // blocks, (b + 1) * len(t) // blocks
        c = 400 * (14 ** (b / blocks))
        out[s:e] = _bp(n, c * 0.7, min(c * 1.4, 18000))[s:e]
    return out * (t / d) ** 2 * 0.35


def _impact(rng, strength=1.0):
    t = _t(0.9)
    f = 38 + 70 * np.exp(-t * 14)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5)
    crash = _hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 6) * 0.18
    return (boom * 0.9 + crash) * strength


def _bell(freq, d=1.2):
    """Cloche FM, claire et courte."""
    t = _t(d)
    mod = np.sin(2 * np.pi * freq * 3.5 * t) * 2.2 * np.exp(-t * 6)
    return np.sin(2 * np.pi * freq * t + mod) * np.exp(-t * 3.2)


def signature():
    """Logo sonore Backed : deux notes montantes (la → ré), un fond grave et un léger scintillement. Toujours identique."""
    d = 1.8
    out = np.zeros(int(d * SR))
    _add(out, _bell(880.0) * 0.5, 0.0)
    _add(out, _bell(1174.66) * 0.6, 0.16)
    t = _t(d)
    out += np.sin(2 * np.pi * 146.83 * t) * np.exp(-t * 2.2) * np.minimum(1, t / 0.02) * 0.35  # ré grave
    shimmer = _hp(np.random.default_rng(1).standard_normal(len(t)), 9000) * np.exp(-t * 3) * 0.04
    return out + shimmer


def make_music(path, dur, cuts, variante=0, seed=7, sig_at=None, clicks=()):
    rng = np.random.default_rng(seed)
    bpm, prog, sixteenth_hats, bass_offs = VARIANTES[variante % len(VARIANTES)]
    beat = 60 / bpm
    cuts = [c for c in cuts if 0 < c < dur]
    end_start = cuts[-1] if cuts else dur  # dernier plan (logo) : plus de beat, place à la signature
    n = int(dur * SR) + SR
    drums, bass, pad, fx = (np.zeros(n) for _ in range(4))
    duck = np.ones(n)

    b = 0
    while b * beat < dur:
        at = b * beat
        groove = at < end_start - 0.05
        if groove:
            _add(drums, _kick(), at)
            i = int(at * SR)
            dk = 1 - 0.75 * np.exp(-_t(beat) * 9)
            m = max(0, min(len(dk), n - i))
            duck[i:i + m] = np.minimum(duck[i:i + m], dk[:m])
            if b % 2 == 1:
                _add(drums, _clap(rng), at)
            _add(drums, _hat(rng, open_=(b % 4 == 3)), at + beat / 2)
            _add(drums, _hat(rng) * 0.6, at + beat * 0.75)
            if sixteenth_hats:
                _add(drums, _hat(rng) * 0.4, at + beat * 0.25)
        root, chord = prog[(b // 4) % 4]
        if groove:
            for off in bass_offs:
                d = beat * 0.22
                _add(bass, _lp(_saw(_note(root - 12), d), 420) * np.exp(-_t(d) * 9) * 0.55, at + beat * off)
        if b % 4 == 0:
            d = beat * 4
            chord_sig = sum(_lp(_saw(_note(m), d, dt), 1400) for m in chord for dt in (-0.004, 0.004))
            env = np.minimum(1, _t(d) / 0.08) * np.minimum(1, (d - _t(d)) / 0.3)
            _add(pad, chord_sig * env * 0.045, at)
        b += 1

    # Le fond s'efface sur le plan logo pour laisser la signature seule.
    i0 = int(end_start * SR)
    fade = np.ones(n)
    fade[i0:] = np.clip(1 - (np.arange(n - i0) / SR) / 0.35, 0, 1)
    pad *= fade

    _add(fx, _impact(rng), 0.0)
    for c in cuts[:-1]:
        _add(fx, _whoosh(rng), c - 0.45)
        _add(fx, _impact(rng, 0.8), c)
    if cuts:
        _add(fx, _whoosh(rng) * 0.8, end_start - 0.45)
        _add(fx, _impact(rng, 0.45), end_start)
        _add(fx, signature(), (sig_at if sig_at is not None else end_start + 0.1) + 0.02)
    # clics de clavier (outro : le logo qui se tape)
    for c in clicks:
        t = _t(0.018)
        _add(fx, _hp(rng.standard_normal(len(t)), 2500) * np.exp(-t * 260) * 0.25, c)

    end = int(dur * SR)
    mix = (drums * 0.9 + bass * duck + pad * (0.55 + 0.45 * duck) + fx)[:end]
    tail = int(0.25 * SR)
    mix[-tail:] *= np.linspace(1, 0, tail)
    wide = 0.08 * np.roll(pad[:end], 300)
    st = np.stack([mix + wide, mix - wide], axis=1)
    st = np.tanh(st * 1.2) / np.tanh(1.2)
    st /= np.max(np.abs(st)) * 1.05
    wavfile.write(path, SR, (st * 32767).astype(np.int16))


if __name__ == '__main__':
    make_music(sys.argv[1], float(sys.argv[2]), [float(c) for c in sys.argv[4:]], int(sys.argv[3]))
