const Airtable = require('airtable')

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID)

const newBrands = [
  // Finance / Investissement
  { name: 'Saxo Banque', description: 'Courtier en ligne pour investir en bourse.', website: 'https://www.home.saxo/fr-fr', category: 'Finance' },
  { name: 'Linxea', description: 'Assurance vie et épargne en ligne.', website: 'https://www.linxea.com', category: 'Finance' },
  { name: 'Freedom 24', description: 'Courtier européen pour investir en bourse.', website: 'https://freedom24.com/fr', category: 'Finance' },
  { name: 'Trading 212', description: 'Application d\'investissement sans commission.', website: 'https://www.trading212.com/fr', category: 'Finance' },
  { name: 'Interactive Brokers', description: 'Courtier international avec les frais les plus bas.', website: 'https://www.interactivebrokers.com', category: 'Finance' },
  { name: 'MEXEM', description: 'Courtier pour investir en bourse en Europe.', website: 'https://www.mexem.com', category: 'Finance' },
  { name: 'Fundora', description: 'Investir dans le Private Equity à partir de 100€.', website: 'https://fundora.eu', category: 'Finance' },
  { name: 'Bricks', description: 'Investissement immobilier fractionné à partir de 10€.', website: 'https://www.bricks.co', category: 'Finance' },

  // Tech & Gaming
  { name: 'Scuf', description: 'Manettes gaming haute performance.', website: 'https://www.scufgaming.com', category: 'Tech & Gaming' },
  { name: 'Winamax', description: 'Plateforme de paris sportifs et poker en ligne.', website: 'https://www.winamax.fr', category: 'Divertissement' },
  { name: 'Brilliant', description: 'Plateforme d\'apprentissage des maths et sciences.', website: 'https://brilliant.org', category: 'Éducation' },
  { name: 'Hostinger', description: 'Hébergeur web abordable et performant.', website: 'https://www.hostinger.fr', category: 'Tech & Gaming' },
  { name: 'Incogni', description: 'Service de suppression de données personnelles en ligne.', website: 'https://incogni.com', category: 'Tech & Gaming' },
  { name: 'Whatnot', description: 'Plateforme de vente en direct de collectibles.', website: 'https://www.whatnot.com', category: 'E-commerce' },

  // Sport & Santé
  { name: 'Fitness Boutique', description: 'Équipements et nutrition pour le fitness.', website: 'https://www.fitnessboutique.fr', category: 'Santé' },
  { name: 'Train With Me', description: 'Application de coaching sportif en ligne.', website: 'https://www.trainwithme.fr', category: 'Santé' },
  { name: 'Japhy', description: 'Alimentation naturelle et personnalisée pour chiens et chats.', website: 'https://www.japhy.fr', category: 'Animaux' },

  // Food
  { name: 'Train Sweat Eat', description: 'Programmes fitness et nutrition en ligne.', website: 'https://www.trainsweateat.com', category: 'Santé' },

  // Divertissement / Lifestyle
  { name: 'happn', description: 'Application de rencontres basée sur la géolocalisation.', website: 'https://www.happn.com/fr', category: 'Divertissement' },
  { name: 'Fruitz', description: 'Application de rencontres intuitive et fun.', website: 'https://www.fruitz.io', category: 'Divertissement' },
  { name: 'MyHeritage', description: 'Plateforme de généalogie et d\'arbres familiaux.', website: 'https://www.myheritage.fr', category: 'Divertissement' },
  { name: 'Play Pods Paris', description: 'Salles de gaming immersives à Paris.', website: 'https://www.playpods.fr', category: 'Divertissement' },

  // Autres
  { name: 'LegalPlace', description: 'Plateforme juridique en ligne pour les entrepreneurs.', website: 'https://www.legalplace.fr', category: 'Finance' },
  { name: 'FarmKind', description: 'Association contre l\'élevage industriel.', website: 'https://www.farmkind.org', category: 'Animaux' },
  { name: 'Hellowork', description: 'Plateforme de recherche d\'emploi en France.', website: 'https://www.hellowork.com', category: 'Éducation' },
  { name: 'Ecosia', description: 'Moteur de recherche qui plante des arbres.', website: 'https://www.ecosia.org', category: 'Tech & Gaming' },
  { name: 'Garnier', description: 'Marque de cosmétiques et soins naturels.', website: 'https://www.garnier.fr', category: 'Santé' },
  { name: 'Qonto', description: 'Compte pro en ligne pour entrepreneurs et PME.', website: 'https://qonto.com/fr', category: 'Finance' },
  { name: 'Paris Investor Week', description: 'Événement annuel dédié à l\'investissement à Paris.', website: 'https://www.parisinvestorweek.com', category: 'Finance' },
]

async function getCategoryId(categoryName) {
  const records = await base('Categories')
    .select({ filterByFormula: `{Name} = "${categoryName}"`, maxRecords: 1 })
    .firstPage()
  return records[0]?.id || null
}

async function brandExists(name) {
  const records = await base('Brands')
    .select({ filterByFormula: `{Name} = "${name}"`, maxRecords: 1 })
    .firstPage()
  return records.length > 0
}

async function main() {
  console.log('🚀 Ajout des marques manquantes...')

  // Charge toutes les catégories en une fois
  const categoriesRaw = await base('Categories').select().all()
  const categoriesMap = {}
  categoriesRaw.forEach(r => {
    categoriesMap[r.fields['Name']] = r.id
  })

  let added = 0
  let skipped = 0

  for (const brand of newBrands) {
    const exists = await brandExists(brand.name)
    if (exists) {
      console.log(`⏭️  ${brand.name} — déjà présent`)
      skipped++
      continue
    }

    const categoryId = categoriesMap[brand.category]
    const domain = new URL(brand.website).hostname
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`

    const fields = {
      'Name': brand.name,
      'Description': brand.description,
      'Website': brand.website,
      'Logo': [{ url: faviconUrl }],
    }

    if (categoryId) {
      fields['Category'] = [categoryId]
    }

    await base('Brands').create([{ fields }])
    console.log(`✅ ${brand.name} — ajouté`)
    added++
  }

  console.log(`\n✅ Terminé : ${added} ajoutés, ${skipped} ignorés`)
}

main().catch(console.error)