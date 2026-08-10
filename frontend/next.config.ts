import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.10.86", "192.168.10.42", "192.168.10.34", "192.168.1.7"],
  devIndicators: false,
  experimental: {
    devtoolSegmentExplorer: false,
  },
  eslint: {
    // Дизайны давталт хийхэд build-ийг lint зогсоохгүй байх
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
