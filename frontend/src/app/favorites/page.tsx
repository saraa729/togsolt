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
      <div className="page py-12">
        <div className="card h-64 skeleton" />
      </div>
    );
  }

  return (
    <div className="page-wide py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("favorites.title")}</h1>

      {products.length === 0 ? (
        <div className="mt-6">
          <EmptyState title={t("favorites.empty")} actionLabel={t("cart.emptyCta")} actionHref="/products" />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {recommended.length ? (
        <section className="mt-14">
          <h2 className="section-title pb-5">{t("favorites.recommended")}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {recommended.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
