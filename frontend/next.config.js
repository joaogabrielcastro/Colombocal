/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN;
    // Em produção, sem NEXT_PUBLIC_API_ORIGIN, deixa /api seguir o roteamento
    // padrão do host (ex.: Nginx/Proxy), evitando fallback incorreto para localhost.
    if (!apiOrigin) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
