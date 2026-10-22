/** @type {import('next').NextConfig} */
const nextConfig = {
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
