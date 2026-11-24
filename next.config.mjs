/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build : un seul processus pour générer les pages, donc une seule lecture d'Airtable par build.
  // À plusieurs processus (et quand le build de la PR et celui de production partaient en même temps),
  // Airtable dépassait sa limite de 5 requêtes par seconde, répondait 429 et le build échouait.
  experimental: { cpus: 1 },
  // Une page peut attendre la fin d'un blocage Airtable (30 s) et ses nouveaux essais (35 s) sans faire échouer le build.
  staticPageGenerationTimeout: 180,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'yt3.ggpht.com' },
      { protocol: 'https', hostname: 'yt3.googleusercontent.com' },
    ],
  },
  // Anciennes adresses vues par Google (404 dans la Search Console) : redirections permanentes.
  async redirects() {
    return [
      { source: '/marque', destination: '/explorer', permanent: true },
      // Anciennes pages marque nommées d'après le domaine (ex. /marque/nordvpn.com -> /marque/nordvpn)
      { source: '/marque/:slug([a-z0-9-]+)\\.(com|fr|io|co|net|org)', destination: '/marque/:slug', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "img-src 'self' data: https: *;",
          },
        ],
      },
    ]
  },
}

export default nextConfig
