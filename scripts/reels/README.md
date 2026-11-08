# Vidéos de la semaine (TikTok / Reels)

Génère chaque semaine 7 vidéos verticales (1080×1920) dans la DA « Chiffres et preuves », les visuels
qui vont avec, et le fichier `publications.md` avec les textes TikTok, Instagram, YouTube Shorts et
WhatsApp de chaque jour. La phrase de Backed, « Avant de payer, passe par Backed. », termine chaque
vidéo, chaque visuel et chaque texte.

## Automatique

Le workflow **Vidéos de la semaine** tourne chaque vendredi vers 18h (heure de Paris en hiver), pour que le lot
soit prêt au réveil le samedi (GitHub retarde parfois les tâches planifiées de plusieurs heures).
Chaque run prépare :

- le top 3 du samedi (le lendemain) : « Les codes en tendance », les marques les plus en hausse sur Google Trends
  (`tendances.txt`, mis à jour à la main) qui ont un code valable jusqu'à la fin de la semaine suivante, dans l'ordre
  du classement (on descend dans la liste quand on n'a pas le code d'une marque), vidéo `00-…-top3.mp4`
  et textes en tête de `publications.md`, avec le tableau des clics qui a servi au classement ;
- du dimanche au vendredi suivants : 1 vidéo « Code du jour » par jour ;
- pour chaque jour (et le top 3) : une carte carrée à envoyer avec le message WhatsApp de 12h15 (`…-whatsapp.png`) ;
  la vidéo, elle, se publie à 19h sur TikTok, en Reel et en story Instagram (la même vidéo), et en YouTube Shorts.

Pas de carrousel de la semaine (arrêté en novembre 2026) : il donnait tous les codes d'avance, sans effet d'attente.
Chaque code sort le jour même, une seule fois : WhatsApp à 12h15, puis les réseaux à 19h.

Les vidéos et les visuels montrent le logo de la marque. Il est téléchargé pendant le run : icône haute
définition du site (Google, 256 px, puis `apple-touch-icon`), sinon le logo d'Airtable. En dessous de 64 px,
pas de logo (la vidéo garde le nom de la marque seul). La liste est dans `logos.txt` de l'aperçu.

Un aperçu léger (planches `videos.jpg` et `visuels.jpg`, `publications.md`, `logos.txt`) est poussé sur
la branche `semaine-apercu`, remplacée à chaque run : pratique pour vérifier sans télécharger le zip.

Pour récupérer les fichiers : GitHub → onglet **Actions** → **Vidéos de la semaine** →
dernier run → en bas, **Artifacts** → `backed-semaine-N` (zip, gardé 30 jours).
Les textes s'affichent aussi directement dans le résumé du run.

Pour lancer à la main : **Actions → Vidéos de la semaine → Run workflow**
(champ optionnel : date du premier jour).

## Comment les offres sont choisies

- Offres `Active` et non expirées, avec un code et une marque (nom + slug), comme sur le site.
- Les plus copiées d'abord : clics des 7 derniers jours (clics actuels − relevé « Suivi quotidien » d'il y a
  7 jours), puis clics au total, puis les plus récentes. Les clics sont regroupés par `Slug`
  (marque + créateur), comme sur le site (`lib/classement.ts`).
- Une seule offre par marque.
- Codes du jour : seulement les offres valables jusqu'au vendredi (date de fin vide ou après).
- Le nombre de nouvelles offres par jour ne change rien : toujours 1 vidéo par jour. S'il manque des offres, le jour est marqué « pas de nouvelle vidéo » dans `publications.md`.
- Aucun compteur (nombre de codes, de créateurs) dans les vidéos, puisqu'elles sont préparées pour toute la semaine.
- Vidéos premium (depuis novembre 2026), dans le style du motion « Le réflexe Backed » : pages HTML
  `scripts/motion/code_du_jour.html` et `top3.html`, rendues image par image dans Chromium (`scripts/motion/moteur.py`).
  Code du jour (~9,7 s) : accroche (« Code du jour » + logo et marque, puis une carte premium en 3D avec l'avantage et le code à moitié masqué), la carte de l'offre arrive en 3D et le code est copié,
  le code s'envole et se colle au paiement (« Tu paies moins. Et tu soutiens <créateur>. »), fin Backed.
  Top 3 (~8,7 s) : « Top 3 de la semaine », la carte violette en 3D avec les trois codes à moitié masqués, qui se
  dévoilent l'un après l'autre, fin Backed.
  Tout reste dans la zone que l'interface TikTok / Reels ne recouvre pas. `--classique` : anciennes vidéos (Pillow).
- La remise affichée est le premier pourcentage de l'offre (5 à 90 %) ; les « jusqu'à -X % » ne sont pas
  traités comme une remise garantie.

## En local

```bash
pip install Pillow numpy scipy playwright && python -m playwright install chromium   # + ffmpeg installé
AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... python3 scripts/reels/generate_week.py --out out/semaine
# test sans Airtable (et sans télécharger les logos) :
python3 scripts/reels/generate_week.py --fixture scripts/reels/fixture.json --out out/test --no-logo --preview out/apercu
# carrousel « C'est quoi Backed ? » (à publier une fois et à épingler) :
python3 scripts/reels/visuels.py --about out/cest-quoi-backed --createurs 120 --codes 200
```

## Musique

Chaque vidéo a une musique originale synthétisée par `musique.py` (aucun sample, pas de droits d'auteur) : 4 variantes de fond qui tournent d'une vidéo à l'autre, et la même signature sonore sur le logo de fin. Le volume est normalisé pour les réseaux (-14 LUFS).

Polices : Syne, Inter et JetBrains Mono (licence SIL Open Font License, voir `fonts/`).
