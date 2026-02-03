import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed output: 'export' to enable API routes for proxy functionality
  // This fixes CORS issues when fetching from external IPTV servers
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
