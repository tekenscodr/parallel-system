import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  outputFileTracingIncludes: {
    "/api/admin/albums/files/[filename]": ["./exports/albums/**/*"],
    "/api/admin/albums/election": ["./exports/albums/ahafo_album_data.json", "./public/cdn/**/*", "./public/npp-logo.png"],
    "/api/admin/albums/image": ["./public/cdn/**/*"],
  },
  serverExternalPackages: ["cloudflare:workers"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "cloudflare:workers"];
    }
    return config;
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/admin/dashboard", permanent: false },
      { source: "/campaigns", destination: "/admin/dashboard", permanent: false },
      { source: "/send-message", destination: "/admin/dashboard", permanent: false },
      { source: "/contacts", destination: "/admin/dashboard", permanent: false },
      { source: "/reports", destination: "/admin/dashboard", permanent: false },
      { source: "/locations", destination: "/admin/dashboard", permanent: false },
      { source: "/message-history", destination: "/admin/dashboard", permanent: false },
    ];
  },
};

export default nextConfig;
