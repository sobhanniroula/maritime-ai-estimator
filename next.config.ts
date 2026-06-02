import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from external map tile sources
  images: {
    domains: [],
  },
};

export default nextConfig;
