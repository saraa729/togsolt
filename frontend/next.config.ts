import type { NextConfig } from "next";

const distDir = process.env.NEXT_DIST_DIR;
const LOCAL_API_URL = "http://localhost:4000";
const DEFAULT_RENDER_API_URL = "https://expocraft-backend.onrender.com";

function cleanApiUrl(value?: string): string {
  const trimmed = String(value || "").trim().replace(/\/$/, "");
  if (!trimmed) return "";
  if (/[<>\u0442\u0422]|\bTAH|\bTANY|RENDER-BACKEND/i.test(trimmed)) return "";
  return trimmed;
}

function defaultApiUrl(): string {
  const configured = cleanApiUrl(process.env.NEXT_PUBLIC_API_URL || process.env.API_URL);
  if (configured && configured !== LOCAL_API_URL) return configured;
  if (process.env.NODE_ENV === "production") return DEFAULT_RENDER_API_URL;
  return configured || LOCAL_API_URL;
}

const apiUrl = defaultApiUrl();

const nextConfig: NextConfig = {
  ...(distDir ? { distDir } : {}),
  allowedDevOrigins: [
    "192.168.10.*",
    "192.168.1.*",
    "192.168.10.86",
    "192.168.10.42",
    "192.168.10.34",
    "192.168.10.28",
    "192.168.1.7",
  ],
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
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: `${apiUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
