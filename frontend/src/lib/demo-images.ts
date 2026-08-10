import type { Shop } from "./types";

export const LANDING_HERO_IMAGE = "/images/expocraft/landing-hero.png";

const ARTISAN_IMAGES: Record<string, string> = {
  "nomad-felt-studio": "/images/expocraft/artisan-felt.png",
  "steppe-woodcraft": "/images/expocraft/artisan-wood.png",
  "altan-silver-line": "/images/expocraft/artisan-silver.png",
  "khuree-leather-house": "/images/expocraft/artisan-leather.png",
  "deel-atelier": "/images/expocraft/artisan-textile.png",
  "gobi-textile-studio": "/images/expocraft/artisan-ceramic.png",
  "khangai-brush": "/images/expocraft/artisan-paint.png",
  "tsagaan-bone-craft": "/images/expocraft/artisan-bone.png",
  "blue-flame-ceramics": "/images/expocraft/artisan-blue-ceramic.png",
  "little-nomad-toys": "/images/expocraft/artisan-toys.png",
};

export function demoArtisanImage(shopOrSlug?: Pick<Shop, "slug"> | string | null): string | null {
  const slug = typeof shopOrSlug === "string" ? shopOrSlug : shopOrSlug?.slug;
  return slug ? ARTISAN_IMAGES[slug] || null : null;
}
