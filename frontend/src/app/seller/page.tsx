"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ShopForm from "@/components/ShopForm";
import { Alert, EmptyState, PageHeader, Stat, StatusPill } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { formatAmount } from "@/lib/format";
import type { Balances, Order, Product } from "@/lib/types";

export default function SellerOverviewPage() {
  const { t, locale, currency } = useApp();
  const { shop, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [productsData, ordersData, balanceData] = await Promise.all([
      api.get<{ products: Product[] }>("/seller/products", { query: { locale, currency } }).catch(() => ({ products: [] })),
      api.get<{ orders: Order[] }>("/orders").catch(() => ({ orders: [] })),
      api.get<{ balances: Balances }>("/seller/balance").catch(() => ({ balances: null as unknown as Balances })),
    ]);
    setProducts(productsData.products || []);
    setOrders(ordersData.orders || []);
    setBalances(balanceData.balances || null);
    setLoading(false);
  }, [locale, currency]);

  useEffect(() => {
    if (shop) load();
    else setLoading(false);
  }, [shop, load]);

  /*
   * Дэлгүүр үүсгэсний дараа `shop` null-аас объект болж, доорх early return
   * алга болдог. Тиймээс hook-ууд заавал буцаахаас ӨМНӨ дуудагдана — эс бөгөөс
   * React өмнөх render-ээс олон hook уншаад унана.
   */
  const sellerItems = useMemo(
    () => orders.flatMap((order) => (order.items || []).filter((item) => item.sellerId === user?.id)),
    [orders, user?.id]
  );
  const activeItems = useMemo(
    () => sellerItems.filter((item) => !["completed", "cancelled"].includes(item.status)),
    [sellerItems]
  );
  const recentOrders = useMemo(() => orders.slice(0, 4), [orders]);
  const showcaseProducts = useMemo(() => products.slice(0, 4), [products]);

  if (!shop) {
    return <ShopForm onSaved={() => window.location.reload()} />;
  }

  const available = balances?.sellerBalance?.MNT || 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("seller.title")}
        subtitle={t("seller.dashboardSubtitle")}
        action={
          <Link href="/seller/products/new" className="btn-primary">
            {t("seller.newProduct")}
          </Link>
        }
      />

      <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{shop.displayName}</h2>
            <p className="muted mt-1">
              {[shop.province, shop.district].filter(Boolean).join(", ")} · {" "}
              <Link href={`/shop/${shop.slug}`} className="link">
                /shop/{shop.slug}
              </Link>
            </p>
          </div>
          <StatusPill status={shop.status} label={shop.status === "verified" ? t("shop.verified") : t("shop.pending")} />
        </div>
      </div>

      {shop.status !== "verified" ? <Alert tone="warn">{t("seller.pendingNotice")}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("seller.myProducts")} value={loading ? "…" : products.length} />
        <Stat
          label={t("seller.orders")}
          value={loading ? "…" : activeItems.length}
          hint={`${sellerItems.length} ${t("common.total")}`}
        />
        <Stat label={t("seller.available")} value={formatAmount(available, "MNT")} />
        <Stat
          label={t("shop.rating")}
          value={(shop.stats?.ratingAverage ?? 0).toFixed(1)}
          hint={`${shop.stats?.ratingCount || 0}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="card-pad space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{t("seller.recentOrders")}</h2>
              <p className="muted text-sm">{t("seller.recentOrdersSubtitle")}</p>
            </div>
            <Link href="/seller/orders" className="btn-secondary">
              {t("common.viewAll")}
            </Link>
          </div>

          {recentOrders.length ? (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <article key={order.id} className="rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{order.id}</p>
                      <p className="muted text-sm">{new Date(order.createdAt).toLocaleDateString(locale === "mn" ? "mn-MN" : "en-US")}</p>
                    </div>
                    <StatusPill status={order.status} label={order.status} />
                  </div>
                  <p className="muted mt-3 text-sm">
                    {t("seller.orderItemsCount", { count: order.items?.length || 0 })}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title={t("seller.noOrders")}
              description={t("seller.noOrdersDesc")}
              actionLabel={t("seller.orders")}
              actionHref="/seller/orders"
            />
          )}
        </section>

        <section className="card-pad space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{t("seller.myProducts")}</h2>
              <p className="muted text-sm">{t("seller.productsSubtitle")}</p>
            </div>
            <Link href="/seller/products/new" className="btn-secondary">
              {t("seller.newProduct")}
            </Link>
          </div>

          {showcaseProducts.length ? (
            <div className="space-y-3">
              {showcaseProducts.map((product) => (
                <article key={product.id} className="rounded-2xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{product.titleText}</p>
                      <p className="muted text-sm">{product.inventoryType.replaceAll("_", " ")}</p>
                    </div>
                    <span className="badge badge-clay">{product.status}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title={t("seller.noProducts")}
              description={t("seller.noProductsDesc")}
              actionLabel={t("seller.newProduct")}
              actionHref="/seller/products/new"
            />
          )}
        </section>
      </div>

      <section className="card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold tracking-tight">{t("shop.story")}</h2>
            <p className="muted text-sm">{t("seller.shopStoryHint")}</p>
          </div>
          <Link href="/seller/shop" className="btn-secondary">
            {t("common.update")}
          </Link>
        </div>
        <p className="muted mt-3 whitespace-pre-line">{shop.story?.mn || shop.storyText || "—"}</p>
      </section>
    </div>
  );
}
