import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite al servidor smoke usar su propio directorio de build y no pisar el `next dev` normal.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    dangerouslyAllowSVG: false,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
};

export default nextConfig;
