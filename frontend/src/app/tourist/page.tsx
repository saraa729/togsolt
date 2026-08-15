import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { serverGet } from "@/lib/api";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Жуулчдад зориулсан хуудас — backend-ийн `/tourist/home` нь энэ зорилгоор
 * англи хэл, USD валют, олон улсад илгээх боломжтой бүтээлүүдийг буцаадаг.
 * Тиймээс энэ хуудсыг сайтын хэл сонголтоос үл хамааран англиар үзүүлнэ.
 */
type TouristHome = {
  locale: string;
  currency: string;
  headline: string;
  featuredProducts: Product[];
};

export const metadata: Metadata = {
  title: "Gifts from Mongolia — ExpoCraft",
  description: "Handmade Mongolian craft from verified artisans, bought safely through escrow.",
  alternates: { canonical: "/tourist" },
};

export default async function TouristPage() {
  const data = await serverGet<TouristHome>("/tourist/home");

  return (
    <div className="page">
      <section className="pb-10">
        <p className="eyebrow text-muted">For visitors</p>
        <h1 className="display mt-3 text-3xl sm:text-4xl">{data?.headline || "Unique gifts from Mongolia"}</h1>
        <p className="muted mt-3 max-w-2xl">
          Every piece is made by a verified Mongolian artisan. Prices are shown in USD and your payment is held in
          escrow until the craft reaches you.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/products" className="btn-primary">
            Browse all crafts
          </Link>
          <Link href="/artisans" className="btn-secondary">
            Meet the artisans
          </Link>
        </div>
      </section>

      {data?.featuredProducts?.length ? (
        <section className="border-t border-line pt-10">
          <h2 className="display text-xl sm:text-2xl">Gift picks</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {data.featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : (
        <section className="border-t border-line pt-10">
          <div className="card px-6 py-14 text-center">
            <p className="muted">No gift picks are available right now.</p>
            <Link href="/products" className="btn-secondary mt-4">
              Browse all crafts
            </Link>
          </div>
        </section>
      )}

    </div>
  );
}
