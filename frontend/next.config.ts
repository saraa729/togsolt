import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Дизайны давталт хийхэд build-ийг lint зогсоохгүй байх
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
