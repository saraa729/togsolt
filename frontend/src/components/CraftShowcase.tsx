"use client";

import Link from "next/link";
import { useState } from "react";
import CraftTile from "@/components/CraftTile";
import { useApp } from "@/lib/app-context";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/lib/types";

/** Эхлээд харагдах карт — desktop дээр яг нэг эгнээ. */
const INITIAL = 4;
/** "Цааш үзэх" дарах бүрд нэмэгдэх тоо — дахиад нэг бүтэн эгнээ. */
const STEP = 4;

/**
 * Танилцуулгын цуглуулгын хэсэг. Эхэндээ дөрвөн бүтээл харуулж,
 * "Цааш үзэх" дарахад дөрвөөр нэмнэ. Бүгд гарсан үед бүх цуглуулга руу хөтөлнө.
 */
export default function CraftShowcase({ products }: { products: Product[] }) {
  const { t, locale } = useApp();
  const [visible, setVisible] = useState(INITIAL);

  const shown = products.slice(0, visible);
  const hasMore = visible < products.length;

  return (
    <>
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((product, index) => (
          <CraftCard key={product.id} product={product} index={index} priceText={formatMoney(product.price, locale)}>
            {t(`inv.${product.inventoryType}`)}
          </CraftCard>
        ))}
      </div>

      <div className="mt-12 flex justify-center">
        {hasMore ? (
          <button type="button" className="btn-pill-dark" onClick={() => setVisible((count) => count + STEP)}>
            {t("home.loadMore")}
          </button>
        ) : (
          <Link href="/products" className="btn-pill-dark">
            {t("home.viewAllCollection")} <span className="text-base">⟶</span>
          </Link>
        )}
      </div>
    </>
  );
}

/**
 * Бүтээлийн карт — музейд өлгөсөн зураг шиг нимгэн хүрээтэй.
 * Хөвүүлэхэд бага зэрэг өргөгдөж, хөшиг дор "дэлгэрэнгүй" гарч ирнэ.
 */
function CraftCard({
  product,
  index,
  priceText,
  children,
}: {
  product: Product;
  index: number;
  priceText: string;
  /** Үнийн мөрийн баруун талд бичих тэмдэглэгээ (нөөцийн горим). */
  children: React.ReactNode;
}) {
  const { t } = useApp();

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex flex-col border border-ink/12 bg-surface p-3 transition-all duration-300 hover:-translate-y-1 hover:border-ink/35 hover:shadow-[0_18px_40px_-24px_rgba(34,28,21,0.55)]"
    >
      <div className="relative overflow-hidden">
        <CraftTile product={product} ratio="aspect-[4/5]" showTitle={false} />

        <div className="absolute inset-0 flex items-end bg-[linear-gradient(to_top,rgba(23,20,15,0.72),transparent_55%)] p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="rule-link text-white">
            {t("common.details")} <span className="text-base">⟶</span>
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        <span className="eyebrow text-ink/35">{String(index + 1).padStart(2, "0")}</span>
        <h3 className="display mt-1.5 line-clamp-2 text-base leading-snug">{product.titleText}</h3>
        <p className="mt-1 truncate text-xs text-muted">{product.shop?.displayName}</p>

        <div className="mt-auto flex items-baseline justify-between gap-3 border-t border-ink/12 pt-4">
          <span className="text-sm font-medium">{priceText}</span>
          <span className="shrink-0 text-[10px] tracking-[0.14em] text-muted uppercase">{children}</span>
        </div>
      </div>
    </Link>
  );
}
