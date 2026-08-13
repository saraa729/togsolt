import HomeDashboard from "@/components/HomeDashboard";
import { serverGet } from "@/lib/api";
import { demoHomePayload } from "@/lib/demo-content";
import { readPreferences } from "@/lib/prefs";
import type { HomePayload, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Нэвтэрсэн хэрэглэгчийн нүүр. Өгөгдлийг серверээс уншиж, харагдах хэсгийг
 * client самбарт (HomeDashboard) шилжүүлнэ — тэнд хэрэглэгч, сагс зэрэг мэдээлэл нэмэгдэнэ.
 */
export default async function HomePage() {
  const { locale, currency } = await readPreferences();

  const [home, catalog] = await Promise.all([
    serverGet<HomePayload>("/home", { locale, currency }),
    serverGet<{ products: Product[] }>("/products", { locale, currency }),
  ]);

  const fallback = demoHomePayload(locale, currency);
  const products = catalog?.products?.length ? catalog.products : home?.featuredProducts?.length ? home.featuredProducts : fallback.featuredProducts;

  return (
    <HomeDashboard
      recommended={pickOnePerCategory(products, 12)}
      fresh={sortByNewest(products).slice(0, 8)}
      categories={home?.categories?.length ? home.categories : fallback.categories}
      artisans={home?.newArtisans?.length ? home.newArtisans : fallback.newArtisans}
    />
  );
}

/** Ангилал бүрээс ээлжлүүлэн түүнэ — санал болгох зурвас нэг төрлөөр дүүрэхээс сэргийлнэ. */
function pickOnePerCategory(items: Product[], limit: number): Product[] {
  const buckets = new Map<string, Product[]>();
  for (const item of items) {
    const bucket = buckets.get(item.categoryId);
    if (bucket) bucket.push(item);
    else buckets.set(item.categoryId, [item]);
  }

  const lists = [...buckets.values()];
  const picked: Product[] = [];
  const depth = Math.max(...lists.map((list) => list.length), 0);

  for (let round = 0; round < depth && picked.length < limit; round += 1) {
    for (const list of lists) {
      if (!list[round]) continue;
      picked.push(list[round]);
      if (picked.length === limit) break;
    }
  }

  return picked;
}

function sortByNewest(items: Product[]): Product[] {
  return [...items].sort((a, b) => {
    const left = a.createdAt ? Date.parse(a.createdAt) : 0;
    const right = b.createdAt ? Date.parse(b.createdAt) : 0;
    return right - left;
  });
}
