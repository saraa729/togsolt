"use client";

import Link from "next/link";
import { useApp } from "@/lib/app-context";
import { imageOrPlaceholder, initials } from "@/lib/format";
import type { Shop } from "@/lib/types";
import { Stars } from "./ui";

export default function ShopCard({ shop }: { shop: Shop }) {
  const { t } = useApp();
  const portrait = shop.artisanProfile?.portraitUrl || shop.logoUrl;

  return (
    <Link href={`/shop/${shop.slug}`} className="card flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="h-24 bg-clay-soft">
        {shop.bannerUrl ? (
          <img src={imageOrPlaceholder(shop.bannerUrl)} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="-mt-8 px-5 pb-5">
        <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border-2 border-surface bg-pine text-lg font-semibold text-white">
          {portrait ? (
            <img src={imageOrPlaceholder(portrait)} alt={shop.displayName} className="h-full w-full object-cover" />
          ) : (
            initials(shop.displayName)
          )}
        </div>
        <p className="mt-3 font-medium">{shop.displayName}</p>
        <p className="muted mt-0.5 text-xs">
          {[shop.province, shop.district].filter(Boolean).join(", ") || shop.city}
        </p>
        {shop.storyText ? <p className="muted mt-2 line-clamp-2">{shop.storyText}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          {shop.verified ? <span className="badge bg-emerald-50 text-emerald-700">✓ {t("shop.verified")}</span> : null}
          <span className="inline-flex items-center gap-1">
            <Stars value={shop.stats?.ratingAverage || 0} />
            {shop.stats?.ratingCount ? `(${shop.stats.ratingCount})` : ""}
          </span>
          {typeof shop.productCount === "number" ? (
            <span>
              {shop.productCount} {t("shop.products")}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
