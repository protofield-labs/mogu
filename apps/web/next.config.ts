import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal container output for Cloud Run.
  output: "standalone",
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
