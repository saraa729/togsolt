"use client";

import Link from "next/link";
import { useApp } from "@/lib/app-context";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/lib/types";
import CraftTile from "./CraftTile";

export default function ProductCard({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { t, locale } = useApp();
  const sold = product.status === "sold" || (product.inventoryType !== "made_to_order" && product.stock === 0);

  return (
    <Link href={`/products/${product.id}`} className="group block">
      <div className="relative">
        <CraftTile product={product} ratio="aspect-[4/5]" showTitle={false} />

        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-paper/90 px-2.5 py-1 text-[10px] font-medium tracking-[0.12em] uppercase">
            {t(`inv.${product.inventoryType}`)}
          </span>
        </div>

        {sold ? (
          <div className="absolute inset-0 grid place-items-center bg-night/50">
            <span className="rounded-full bg-paper px-3 py-1.5 text-[10px] font-medium tracking-[0.14em] uppercase">
              {t("product.soldOut")}
            </span>
          </div>
        ) : null}
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-snug">{product.titleText}</p>

      {!compact ? (
        <p className="mt-0.5 truncate text-xs text-muted">
          {product.shop?.displayName}
          {product.shop?.verified ? " ✓" : ""}
        </p>
      ) : null}

      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{formatMoney(product.price, locale)}</span>
        {product.inventoryType === "made_to_order" && product.productionDays ? (
          <span className="text-[11px] text-muted">
            {product.productionDays} {t("product.days")}
          </span>
        ) : product.inventoryType === "one_of_one" ? (
          <span className="text-[11px] text-clay">{t("inv.one_of_one")}</span>
        ) : product.stock > 0 ? (
          <span className="text-[11px] text-muted">
            {product.stock} {t("product.stockLeft")}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
