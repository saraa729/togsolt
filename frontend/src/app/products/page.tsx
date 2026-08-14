import { Suspense } from "react";
import ProductCard from "@/components/ProductCard";
import ProductFilters, { type ProductFacets } from "@/components/ProductFilters";
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

const FILTER_KEYS = [
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
];

function unique(values: (string | undefined | null)[]) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { locale, currency } = await readPreferences();
  const t = (key: string) => translate(locale, key);

  const query: Record<string, string> = { locale, currency };
  for (const key of FILTER_KEYS) {
    const value = params[key];
    if (typeof value === "string" && value) query[key] = value;
  }

  const filtered = FILTER_KEYS.some((key) => query[key]);

  /*
   * Шүүлтүүрийн сонголтууд нь үр дүнгээс биш, БҮХ бүтээлээс гарна. Эсрэгээр
   * хийвэл нэг шүүлтүүр сонгоход бусад сонголтууд алга болж, хэрэглэгч сонголтоо
   * өөрчилж чадахгүй мухардалд ордог. Шүүлтгүй үед хоёр дахь хүсэлт шаардлагагүй.
   */
  const [productsPayload, categoriesPayload, facetPayload] = await Promise.all([
    serverGet<{ products: Product[] }>("/products", query),
    serverGet<{ categories: { id: string; nameText: string }[] }>("/categories", { locale }),
    filtered ? serverGet<{ products: Product[] }>("/products", { locale, currency }) : Promise.resolve(null),
  ]);

  const products = productsPayload?.products ?? [];
  const facetProducts = facetPayload?.products ?? products;

  const byLabel = (prefix: string) => (a: string, b: string) =>
    translate(locale, `${prefix}.${a}`).localeCompare(translate(locale, `${prefix}.${b}`), locale);

  const facets: ProductFacets = {
    categories: categoriesPayload?.categories ?? [],
    materials: unique(facetProducts.flatMap((product) => product.materials || [])).sort(byLabel("mat")),
    techniques: unique(facetProducts.flatMap((product) => product.techniques || [])).sort(byLabel("tech")),
    inventoryTypes: unique(facetProducts.map((product) => product.inventoryType)).sort(byLabel("inv")),
  };

  return (
    <div className="page-wide py-10">
      <div className="pb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("products.title")}</h1>
        <p className="muted mt-1">
          {products.length} {t("products.count")}
        </p>
      </div>

      <Suspense fallback={<div className="card h-20 skeleton" />}>
        <ProductFilters facets={facets} />
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
