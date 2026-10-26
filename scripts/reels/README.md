# Vidéos de la semaine (TikTok / Reels)

Génère chaque semaine 7 vidéos verticales (1080×1920) dans la DA « Chiffres et preuves »,
et le fichier `publications.md` avec les textes TikTok, Instagram et WhatsApp de chaque jour.

## Automatique

Le workflow **Vidéos de la semaine** tourne chaque samedi à 8h (heure de Paris en hiver).
Chaque run prépare :

- le top 3 du jour même (samedi) : les 3 codes les plus copiés des 7 derniers jours, vidéo `00-…-top3.mp4`
  et textes en tête de `publications.md`, avec le tableau des clics qui a servi au classement ;
- du dimanche au vendredi suivants : 1 vidéo « Code du jour » par jour.

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
- Si le texte de l'offre contient un pourcentage (5 à 90 %), la vidéo s'ouvre sur un prix barré
  sur un panier d'exemple de 100 €, affiché comme tel. Sinon, elle s'ouvre sur le texte de l'offre.
  Les « jusqu'à -X % » ne sont pas traités comme un pourcentage garanti.

## En local

```bash
pip install Pillow numpy scipy   # + ffmpeg installé
AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... python3 scripts/reels/generate_week.py --out out/semaine
# test sans Airtable :
python3 scripts/reels/generate_week.py --fixture scripts/reels/fixture.json --out out/test
```

## Musique

Chaque vidéo a une musique originale synthétisée par `musique.py` (aucun sample, pas de droits d'auteur) : 4 variantes de fond qui tournent d'une vidéo à l'autre, et la même signature sonore sur le logo de fin. Le volume est normalisé pour les réseaux (-14 LUFS).

Polices : Syne, Inter et JetBrains Mono (licence SIL Open Font License, voir `fonts/`).
