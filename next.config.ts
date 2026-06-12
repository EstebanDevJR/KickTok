import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["got-scraping"],
  turbopack: { root: __dirname },
};

export default nextConfig;
