import type { Currency, Locale, Money } from "./types";

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

export const API_URL = defaultApiUrl();

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}

function isPrivateIpv4(hostname: string): boolean {
  return /^(10|192\.168|172\.(1[6-9]|2\d|3[0-1]))\./.test(hostname);
}

export function getApiUrl(): string {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production") return API_URL;

  try {
    const currentHost = window.location.hostname;
    const currentIsLoopback = isLoopbackHost(currentHost);
    const target = new URL(API_URL);
    const targetIsLoopback = isLoopbackHost(target.hostname);

    if (currentIsLoopback && isPrivateIpv4(target.hostname)) {
      target.hostname = "localhost";
      return target.toString().replace(/\/$/, "");
    }

    if (!currentIsLoopback && (targetIsLoopback || isPrivateIpv4(target.hostname))) {
      target.hostname = currentHost;
      return target.toString().replace(/\/$/, "");
    }
  } catch {
    return API_URL;
  }

  return API_URL;
}

export function formatMoney(money: Money | null | undefined, locale: Locale = "mn"): string {
  if (!money) return "—";
  const amount = Number(money.amount || 0);
  if (money.currency === "USD") {
    // Доллар үргэлж 2 оронтой — $18 ба $9.99 нэг жагсаалтад зэрэгцэхэд эв нэгдэлтэй.
    return `$${amount.toLocaleString(locale === "mn" ? "mn-MN" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `${amount.toLocaleString("en-US")}₮`;
}

export function formatAmount(amount: number | undefined, currency: string): string {
  return formatMoney({ amount: Number(amount || 0), currency: currency as Currency });
}

export function formatDate(value?: string | null, locale: Locale = "mn"): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale === "mn" ? "mn-MN" : "en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateTime(value?: string | null, locale: Locale = "mn"): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDate(value, locale)} ${date.toLocaleTimeString(locale === "mn" ? "mn-MN" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/**
 * Backend нь байршуулсан зургийг `/uploads/…` гэсэн харьцангуй замаар буцаадаг.
 * Hydration зөрөхөөс сэргийлж зурагны src-г server/client дээр ижил relative
 * хэвээр үлдээнэ. Next rewrite `/uploads/*`-ийг backend рүү proxy хийнэ.
 */
export function resolveImageUrl(url?: string | null): string | null {
  const value = url?.trim();
  if (!value) return null;
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:")) return value;
  if (value.startsWith("/")) return value;
  return value;
}

/** Товч placeholder зураг — зурагны URL байхгүй үед. */
export function imageOrPlaceholder(url?: string | null): string {
  const resolved = resolveImageUrl(url);
  if (resolved) return resolved;
  return "data:image/svg+xml;utf8," + encodeURIComponent(PLACEHOLDER_SVG);
}

/** Зураггүй үед: алхан хээтэй, тайван өнгийн хавтан (хуурамч зураг ашиглахгүй). */
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><defs><pattern id="a" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M6 54V6h48v36H18V18h24v12" fill="none" stroke="#b6a289" stroke-width="3" opacity="0.35"/></pattern></defs><rect width="600" height="600" fill="#e2d8c8"/><rect width="600" height="600" fill="url(#a)"/><text x="300" y="316" font-family="Georgia, serif" font-size="30" letter-spacing="6" fill="#7d6c58" text-anchor="middle">expocraft</text></svg>`;

/** Хэмжээ нь текст эсвэл {width,height,depth} объект байж болно. */
export function formatSize(size: unknown): string {
  if (!size) return "";
  if (typeof size === "string") return size;
  if (typeof size === "object") {
    const value = size as Record<string, unknown>;
    const parts = ["width", "height", "depth", "length", "diameter"]
      .filter((key) => value[key] !== undefined && value[key] !== null)
      .map((key) => `${value[key]}`);
    if (parts.length) return `${parts.join(" × ")} cm`;
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${item}`)
      .join(", ");
  }
  return String(size);
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function classNames(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}
