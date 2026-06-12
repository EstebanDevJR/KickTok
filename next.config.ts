import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["got-scraping"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/header-generator/data_files/**/*"],
  },
  turbopack: { root: __dirname },
};

export default nextConfig;
