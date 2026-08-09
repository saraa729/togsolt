"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, EmptyState, Spinner, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatMoney, imageOrPlaceholder } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function SellerProductsPage() {
  const { t, locale, currency } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ products: Product[] }>("/seller/products", { query: { locale, currency } });
      setProducts(data.products || []);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [locale, currency]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleStatus(product: Product) {
    setBusy(product.id);
    try {
      await api.patch(`/seller/products/${product.id}/status`, {
        status: product.status === "active" ? "hidden" : "active",
      });
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="card h-64 skeleton" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("seller.myProducts")}</h1>
        <Link href="/seller/products/new" className="btn-primary">
          + {t("seller.newProduct")}
        </Link>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {products.length === 0 ? (
        <EmptyState title={t("common.empty")} actionLabel={t("seller.newProduct")} actionHref="/seller/products/new" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("common.product")}</th>
                <th>{t("products.filters.inventory")}</th>
                <th>{t("common.price")}</th>
                <th>{t("seller.stock")}</th>
                <th>{t("common.status")}</th>
                <th>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <img
                        src={imageOrPlaceholder(product.images?.[0])}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0">
                        <Link href={`/products/${product.id}`} className="block truncate font-medium hover:underline">
                          {product.titleText}
                        </Link>
                        <span className="text-xs text-muted">{product.category?.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="text-xs">{t(`inv.${product.inventoryType}`)}</td>
                  <td className="whitespace-nowrap">{formatMoney(product.price, locale)}</td>
                  <td>{product.inventoryType === "made_to_order" ? "∞" : product.stock}</td>
                  <td>
                    <StatusPill status={product.status} />
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Link href={`/seller/products/${product.id}`} className="btn-secondary btn-sm">
                        {t("common.update")}
                      </Link>
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        disabled={busy === product.id || product.status === "sold"}
                        onClick={() => toggleStatus(product)}
                      >
                        {busy === product.id ? <Spinner className="h-3 w-3" /> : null}
                        {product.status === "active" ? t("seller.hide") : t("seller.show")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
