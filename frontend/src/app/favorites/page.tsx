"use client";

import { useCallback, useEffect, useState } from "react";
import ProductCard from "@/components/ProductCard";
import RequireAuth from "@/components/RequireAuth";
import { EmptyState } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import type { Product } from "@/lib/types";

export default function FavoritesPage() {
  return (
    <RequireAuth role="buyer">
      <FavoritesView />
    </RequireAuth>
  );
}

function FavoritesView() {
  const { t, locale, currency } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [favorites, recommendations] = await Promise.all([
      api.get<{ products: Product[] }>("/favorites/products", { query: { locale, currency } }).catch(() => ({ products: [] })),
      api.get<{ products: Product[] }>("/recommendations", { query: { locale, currency } }).catch(() => ({ products: [] })),
    ]);
    setProducts(favorites.products || []);
    setRecommended(recommendations.products || []);
    setLoading(false);
  }, [locale, currency]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="page-wide py-10">
        <div className="h-9 w-56 rounded-full skeleton" />
        <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <div className="aspect-4/5 w-full rounded-2xl skeleton" />
              <div className="h-3.5 w-4/5 rounded-full skeleton" />
              <div className="h-3 w-1/3 rounded-full skeleton" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-wide py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="display text-[28px] leading-tight tracking-tight sm:text-[34px]">{t("favorites.title")}</h1>
        {products.length ? <p className="muted text-sm">{t("favorites.count", { count: products.length })}</p> : null}
      </header>

      {products.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="♡"
            title={t("favorites.empty")}
            description={t("favorites.emptyHint")}
            actionLabel={t("cart.emptyCta")}
            actionHref="/products"
          />
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {recommended.length ? (
        <section className="mt-16 border-t border-line pt-10">
          <h2 className="section-title">{t("favorites.recommended")}</h2>
          <p className="muted mt-1.5 text-sm">{t("favorites.recommendedHint")}</p>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {recommended.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
