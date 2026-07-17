const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Evita aviso "multiple lockfiles" quando existe package-lock.json acima (ex.: pasta do usuário).
  turbopack: {
    root: path.resolve(__dirname),
  },
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
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      // HTML e rotas da app: nunca cachear no CDN/navegador (evita shell antigo)
      {
        source: "/login",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/((?!_next/static|_next/image|brand|favicon.ico|sw.js).*)",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
