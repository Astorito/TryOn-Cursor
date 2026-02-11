const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Raíz del proyecto (evita warning por múltiples lockfiles)
  outputFileTracingRoot: path.join(__dirname),

  // Permitir servir widget-core.js desde lib/
  serverExternalPackages: [],

  // Headers globales de seguridad y CORS
  async headers() {
    return [
      {
        // CORS para todas las API routes
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-API-Key' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
      {
        // Seguridad para todas las rutas
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.fal.ai https://fal.media",
              "connect-src 'self' https://*.fal.ai https://*.supabase.co",
              "font-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
