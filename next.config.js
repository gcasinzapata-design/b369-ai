// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { appDir: true },
  // No cambies nada aquí hasta que el deploy pase
  // Si luego agregamos mapas/scraping, ajustamos aquí con calma
};

module.exports = nextConfig;
