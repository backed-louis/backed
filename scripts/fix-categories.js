const Airtable = require('airtable')

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID)

function toSlug(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

async function main() {
  console.log('🚀 Nettoyage et mise à jour des catégories...\n')

  // 1. Catégories existantes
  const categoriesRaw = await base('Categories').select().all()
  const categoriesMap = {}
  categoriesRaw.forEach(r => {
    if (r.fields['Name']) categoriesMap[r.fields['Name']] = r.id
  })

  // 2. Créer les nouvelles catégories
  const newCategories = ['Rencontres', 'Beauté', 'Sport']
  for (const cat of newCategories) {
    if (categoriesMap[cat]) {
      console.log(`⏭️  "${cat}" déjà existante`)
    } else {
      const created = await base('Categories').create([{
        fields: { 'Name': cat, 'Slug': toSlug(cat), 'Priority': 99 }
      }])
      categoriesMap[cat] = created[0].id
      console.log(`✅ Catégorie créée : ${cat}`)
    }
  }

  // 3. Brands existantes
  const brandsRaw = await base('Brands').select({ fields: ['Name'] }).all()
  const brandsMap = {}
  brandsRaw.forEach(r => {
    if (r.fields['Name']) brandsMap[r.fields['Name']] = r.id
  })

  // 4. Corriger les catégories
  const corrections = {
    'Qonto': 'Finance',
    'Saily': 'Voyage',
    'Ubigi': 'Voyage',
    'Garnier': 'Beauté',
    'Vichy': 'Beauté',
    'happn': 'Rencontres',
    'Fruitz': 'Rencontres',
    'Fitness Boutique': 'Sport',
    'Train With Me': 'Sport',
    'Train Sweat Eat': 'Sport',
  }

  console.log('\n📝 Correction des catégories...')
  for (const [brandName, categoryName] of Object.entries(corrections)) {
    const brandId = brandsMap[brandName]
    const categoryId = categoriesMap[categoryName]
    if (!brandId) { console.log(`  ⚠️  Brand introuvable : ${brandName}`); continue }
    if (!categoryId) { console.log(`  ⚠️  Catégorie introuvable : ${categoryName}`); continue }
    await base('Brands').update(brandId, { 'Category': [categoryId] })
    console.log(`  ✅ ${brandName} → ${categoryName}`)
  }

  // 5. Supprimer les brands parasites
  const toDelete = [
    'Farmkind Heureka',
    'Linxea Spirit 2',
    'Trainsweateat',
    'Les Choses Simples X Crunch Creator',
    'Sinvestir Conseil',
  ]

  console.log('\n🗑️  Suppression des brands parasites...')
  for (const brandName of toDelete) {
    const brandId = brandsMap[brandName]
    if (!brandId) { console.log(`  ⚠️  Introuvable : ${brandName}`); continue }
    await base('Brands').destroy([brandId])
    console.log(`  🗑️  ${brandName} supprimée`)
  }

  console.log('\n✅ Terminé !')
}

main().catch(console.error)