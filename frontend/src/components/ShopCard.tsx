"use client";

import Link from "next/link";
import { useApp } from "@/lib/app-context";
import { demoArtisanImage } from "@/lib/demo-images";
import { imageOrPlaceholder, initials } from "@/lib/format";
import { shopCraftLine, shopDisplayName, shopLocationText } from "@/lib/shop-display";
import type { Shop } from "@/lib/types";
import { Stars } from "./ui";

export default function ShopCard({ shop }: { shop: Shop }) {
  const { t } = useApp();
  const demoImage = demoArtisanImage(shop);
  const portrait = demoImage || shop.artisanProfile?.portraitUrl || shop.logoUrl;
  const banner = demoImage || shop.bannerUrl;
  const makerName = shop.artisanProfile?.makerName;
  const displayName = shopDisplayName(shop);
  const craftLine = shopCraftLine(shop);

  return (
    <Link href={`/shop/${shop.slug}`} className="card flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <div className="h-24 bg-clay-soft">
        {banner ? (
          <img src={imageOrPlaceholder(banner)} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="-mt-8 px-5 pb-5">
        <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border-2 border-surface bg-pine text-lg font-semibold text-white">
          {portrait ? (
            <img src={imageOrPlaceholder(portrait)} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            initials(displayName)
          )}
        </div>
        <p className="mt-3 font-medium">{displayName}</p>
        {makerName ? <p className="mt-0.5 text-sm text-ink">{t("seller.makerName")}: {makerName}</p> : null}
        {craftLine ? <p className="mt-1 line-clamp-1 text-xs font-medium text-clay-dark">{craftLine}</p> : null}
        <p className="muted mt-0.5 text-xs">{shopLocationText(shop)}</p>
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
