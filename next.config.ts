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
};

export default nextConfig;
