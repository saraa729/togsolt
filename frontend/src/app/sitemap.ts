import type { MetadataRoute } from "next";
import { serverGet } from "@/lib/api";
import { SITE_URL } from "@/lib/site";
import type { Product, Shop } from "@/lib/types";

/**
 * Динамик sitemap — бүтээл болон дэлгүүрийн нээлттэй хуудсуудыг оруулна.
 *
 * Backend унасан ч sitemap үүсэх ёстой тул `serverGet` алдаа гарвал null
 * буцаадгийг ашиглаж, зөвхөн статик хуудсуудаар үргэлжилнэ.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/products`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/artisans`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/tourist`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/register`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const [catalog, directory] = await Promise.all([
    serverGet<{ products: Product[] }>("/products", { locale: "mn", currency: "MNT" }),
    serverGet<{ shops: Shop[] }>("/shops", { locale: "mn" }),
  ]);

  const products: MetadataRoute.Sitemap = (catalog?.products ?? [])
    .filter((product) => product.status === "active")
    .map((product) => ({
      url: `${SITE_URL}/products/${product.id}`,
      lastModified: product.updatedAt ? new Date(product.updatedAt) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  const shops: MetadataRoute.Sitemap = (directory?.shops ?? [])
    .filter((shop) => shop.slug)
    .map((shop) => ({
      url: `${SITE_URL}/shop/${shop.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  return [...staticPages, ...products, ...shops];
}
