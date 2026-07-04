import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Minimal container output for Cloud Run.
  output: "standalone",
};

export default nextConfig;
