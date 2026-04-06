import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright / E2E hits dev server via 127.0.0.1; Next 16 blocks cross-origin HMR without this.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["prisma", "@prisma/client"],
};

export default nextConfig;
