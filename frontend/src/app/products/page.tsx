import { Suspense } from "react";
import ProductCard from "@/components/ProductCard";
import ProductFilters from "@/components/ProductFilters";
import { serverGet } from "@/lib/api";
import { translate } from "@/lib/i18n";
import { readPreferences } from "@/lib/prefs";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Бүх бүтээл / All crafts",
  description: "Монголын гар урлаачдын бүтээлүүдийг хайж үзнэ.",
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { locale, currency } = await readPreferences();
  const t = (key: string) => translate(locale, key);

  const query: Record<string, string> = { locale, currency };
  for (const key of [
    "q",
    "categoryId",
    "material",
    "technique",
    "style",
    "inventoryType",
    "location",
    "minPrice",
    "maxPrice",
    "international",
    "shopId",
    "sellerId",
  ]) {
    const value = params[key];
    if (typeof value === "string" && value) query[key] = value;
  }

  const productsPayload = await serverGet<{ products: Product[] }>("/products", query);

  const products = productsPayload?.products ?? [];

  return (
    <div className="page-wide py-10">
      <div className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("products.title")}</h1>
        <p className="muted mt-1">
          {products.length} {t("products.count")}
        </p>
      </div>

      <Suspense fallback={<div className="card h-20 skeleton" />}>
        <ProductFilters />
      </Suspense>

      <section className="mt-8">
        {products.length === 0 ? (
          <div className="card grid place-items-center px-6 py-20 text-center">
            <p className="muted max-w-sm">{t("products.empty")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
