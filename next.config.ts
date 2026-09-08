import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  serverExternalPackages: ["cloudflare:workers"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "cloudflare:workers"];
    }
    return config;
  },
};

export default nextConfig;
