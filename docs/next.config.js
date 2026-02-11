/** @type {import('next').NextConfig} */
const nextConfig = {
  // Habilitar modo standalone para optimizar deployments
  output: 'standalone',
  
  // Configurar headers para CORS
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-API-Key, Authorization' },
        ],
      },
    ]
  },

  // Configuración de variables de entorno
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    FAL_KEY: process.env.FAL_KEY,
    PRISMA_DISABLE_PREPARED_STATEMENTS: process.env.PRISMA_DISABLE_PREPARED_STATEMENTS,
  },

  // Optimizaciones
  swcMinify: true,
  reactStrictMode: true,

  // Configuración de imágenes
  images: {
    domains: ['fal.media', 'fal.run'],
  },
}

module.exports = nextConfig
