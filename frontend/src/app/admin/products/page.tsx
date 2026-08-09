"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, EmptyState, Spinner, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatMoney, imageOrPlaceholder } from "@/lib/format";
import type { Product } from "@/lib/types";

const STATUSES = ["", "active", "hidden", "sold"] as const;

export default function AdminProductsPage() {
  const { t, locale, currency } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ products: Product[] }>("/admin/products", {
        query: { locale, currency, ...(status ? { status } : {}) },
      });
      setProducts(data.products || []);
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setLoading(false);
    }
  }, [locale, currency, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function setProductStatus(productId: string, next: string) {
    setBusy(productId);
    try {
      await api.patch(`/admin/products/${productId}/status`, { status: next });
      await load();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.products")}</h1>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((value) => (
          <button
            key={value || "all"}
            type="button"
            className={status === value ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
            onClick={() => setStatus(value)}
          >
            {value === "" ? t("common.all") : value}
          </button>
        ))}
      </div>

      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      {loading ? (
        <div className="card h-64 skeleton" />
      ) : products.length === 0 ? (
        <EmptyState title={t("common.empty")} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("common.product")}</th>
                <th>{t("common.shop")}</th>
                <th>{t("common.price")}</th>
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
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      />
                      <Link href={`/products/${product.id}`} className="truncate font-medium hover:underline">
                        {product.titleText}
                      </Link>
                    </div>
                  </td>
                  <td className="text-xs">{product.shop?.displayName}</td>
                  <td className="whitespace-nowrap">{formatMoney(product.price, locale)}</td>
                  <td>
                    <StatusPill status={product.status} />
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        disabled={busy === product.id || product.status === "hidden"}
                        onClick={() => setProductStatus(product.id, "hidden")}
                      >
                        {busy === product.id ? <Spinner className="h-3 w-3" /> : null}
                        {t("admin.hideProduct")}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        disabled={busy === product.id || product.status === "active"}
                        onClick={() => setProductStatus(product.id, "active")}
                      >
                        {t("admin.activate")}
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
