"use client";

import { useEffect, useState } from "react";
import { Alert, EmptyState, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function AdminOrdersPage() {
  const { t, locale } = useApp();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ orders: Order[] }>("/admin/orders")
      .then((data) => setOrders(data.orders || []))
      .catch((caught) => setError(errorMessage(caught)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card h-64 skeleton" />;
  if (error) return <Alert tone="error">{error}</Alert>;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.orders")}</h1>

      {orders.length === 0 ? (
        <EmptyState title={t("orders.empty")} />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <article key={order.id} className="card overflow-hidden">
              <button
                type="button"
                className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-4 text-left hover:bg-paper"
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted">{order.id}</p>
                  <p className="text-sm font-medium">
                    {order.buyer?.name || order.buyerId} · {order.destinationCountry}
                  </p>
                  <p className="muted text-xs">{formatDateTime(order.createdAt, locale)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={order.escrowStatus} />
                  <span className="badge-neutral">{order.payment?.method?.toUpperCase()}</span>
                  <span className="text-xs text-muted">
                    {t("common.commission")}: {formatMoney(order.commissionTotal, locale)}
                  </span>
                  <span className="font-semibold">{formatMoney(order.subtotal, locale)}</span>
                </div>
              </button>

              {expanded === order.id ? (
                <div className="border-t border-line bg-paper/60 px-5 py-4">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t("common.product")}</th>
                        <th>{t("common.seller")}</th>
                        <th>{t("common.status")}</th>
                        <th>{t("common.escrow")}</th>
                        <th>{t("common.total")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(order.items || []).map((item) => (
                        <tr key={item.id}>
                          <td className="font-mono text-xs">{item.productId}</td>
                          <td className="font-mono text-xs">{item.sellerId}</td>
                          <td>
                            <StatusPill status={item.status} label={t(`ostatus.${item.status}`)} />
                          </td>
                          <td>
                            <StatusPill status={item.escrowStatus} />
                          </td>
                          <td>{formatMoney(item.lineTotal, locale)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
