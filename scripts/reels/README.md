# Vidéos de la semaine (TikTok / Reels)

Génère chaque semaine 7 vidéos verticales (1080×1920) dans la DA « Chiffres et preuves »,
et le fichier `publications.md` avec les textes TikTok, Instagram et WhatsApp de chaque jour.

## Automatique

Le workflow **Vidéos de la semaine** tourne chaque samedi à 8h (heure de Paris en hiver).
Il prépare la semaine suivante, du dimanche au samedi :

- du dimanche au vendredi : 1 vidéo « Code du jour » par jour ;
- le samedi : le top 3 des codes les plus cliqués.

Pour récupérer les fichiers : GitHub → onglet **Actions** → **Vidéos de la semaine** →
dernier run → en bas, **Artifacts** → `backed-semaine-N` (zip, gardé 30 jours).
Les textes s'affichent aussi directement dans le résumé du run.

Pour lancer à la main : **Actions → Vidéos de la semaine → Run workflow**
(champ optionnel : date du premier jour).

## Comment les offres sont choisies

- Offres `Active` et non expirées, avec un code et une marque (nom + slug), comme sur le site.
- Les plus cliquées d'abord (champ `Clicks`), puis les plus récentes.
- Une seule offre par marque.
- Si le texte de l'offre contient un pourcentage (5 à 90 %), la vidéo s'ouvre sur un prix barré
  sur un panier d'exemple de 100 €, affiché comme tel. Sinon, elle s'ouvre sur le texte de l'offre.
  Les « jusqu'à -X % » ne sont pas traités comme un pourcentage garanti.

## En local

```bash
pip install Pillow   # + ffmpeg installé
AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... python3 scripts/reels/generate_week.py --out out/semaine
# test sans Airtable :
python3 scripts/reels/generate_week.py --fixture scripts/reels/fixture.json --out out/test
```

Polices : Syne, Inter et JetBrains Mono (licence SIL Open Font License, voir `fonts/`).
