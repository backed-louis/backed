# Vidéos de la semaine (TikTok / Reels)

Génère chaque semaine 7 vidéos verticales (1080×1920) dans la DA « Chiffres et preuves », les visuels
qui vont avec, et le fichier `publications.md` avec les textes TikTok, Instagram, YouTube Shorts et
WhatsApp de chaque jour. La phrase de Backed, « Avant de payer, passe par Backed. », termine chaque
vidéo, chaque visuel et chaque texte.

## Automatique

Le workflow **Vidéos de la semaine** tourne chaque samedi à 8h (heure de Paris en hiver).
Chaque run prépare :

- le top 3 du jour même (samedi) : les 3 codes les plus copiés des 7 derniers jours, vidéo `00-…-top3.mp4`
  et textes en tête de `publications.md`, avec le tableau des clics qui a servi au classement ;
- du dimanche au vendredi suivants : 1 vidéo « Code du jour » par jour ;
- pour chaque jour (et le top 3) : une image de story Instagram (`…-story.png`, avec la place du sticker lien
  sous le code) et une carte carrée à envoyer avec le message WhatsApp (`…-whatsapp.png`) ;
- le carrousel de la semaine (`carrousel/01.png` à `08.png`, format 4:5) : couverture, un code par image,
  image de fin. À publier le dimanche sur Instagram, et sur TikTok en mode photo.

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
- La vidéo s'ouvre sur l'accroche (logo et nom de la marque, créateur, gain), puis la carte du code,
  puis la fin : le logo Backed qui se tape, « Avant de payer, passe par Backed. » et backed.fr.
  Tout reste dans la zone que l'interface TikTok / Reels ne recouvre pas.
- La remise affichée est le premier pourcentage de l'offre (5 à 90 %) ; les « jusqu'à -X % » ne sont pas
  traités comme une remise garantie.

## En local

```bash
pip install Pillow numpy scipy   # + ffmpeg installé
AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... python3 scripts/reels/generate_week.py --out out/semaine
# test sans Airtable (et sans télécharger les logos) :
python3 scripts/reels/generate_week.py --fixture scripts/reels/fixture.json --out out/test --no-logo --preview out/apercu
# carrousel « C'est quoi Backed ? » (à publier une fois et à épingler) :
python3 scripts/reels/visuels.py --about out/cest-quoi-backed --createurs 120 --codes 200
```

## Musique

Chaque vidéo a une musique originale synthétisée par `musique.py` (aucun sample, pas de droits d'auteur) : 4 variantes de fond qui tournent d'une vidéo à l'autre, et la même signature sonore sur le logo de fin. Le volume est normalisé pour les réseaux (-14 LUFS).

Polices : Syne, Inter et JetBrains Mono (licence SIL Open Font License, voir `fonts/`).
