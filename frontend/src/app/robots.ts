import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Хайлтын роботод зориулсан дүрэм.
 *
 * Дэлгүүр, бүтээлийн хуудсууд индекслэгдэх нь платформын гол ялгарал тул
 * нээлттэй. Хувийн болон удирдлагын хэсгүүдийг хаана — эдгээр нь нэвтрэлт
 * шаарддаг бөгөөд хайлтын үр дүнд гарах ёсгүй.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/seller", "/account", "/cart", "/orders", "/messages", "/contracts", "/favorites"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
