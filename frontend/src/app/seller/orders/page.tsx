"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, EmptyState, Spinner, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Order, OrderItem, Product } from "@/lib/types";

const SELLER_STATUSES = ["accepted", "making", "shipped", "delivered", "cancelled"] as const;

export default function SellerOrdersPage() {
  const { t, locale } = useApp();
  const { user } = useAuth();
  const [items, setItems] = useState<{ item: OrderItem; order: Order }[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, catalog] = await Promise.all([
        api.get<{ orders: Order[] }>("/orders"),
        api.get<{ products: Product[] }>("/seller/products", { query: { locale } }).catch(() => ({ products: [] })),
      ]);
      const rows: { item: OrderItem; order: Order }[] = [];
      for (const order of data.orders || []) {
        for (const item of order.items || []) {
          if (item.sellerId === user?.id) rows.push({ item, order });
        }
      }
      rows.sort((a, b) => new Date(b.item.createdAt).getTime() - new Date(a.item.createdAt).getTime());
      setItems(rows);
      setTitles(Object.fromEntries((catalog.products || []).map((product) => [product.id, product.titleText])));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [user?.id, locale]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="card h-64 skeleton" />;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t("seller.orders")}</h1>
      {error ? <Alert tone="error">{error}</Alert> : null}

      {items.length === 0 ? (
        <EmptyState title={t("orders.empty")} />
      ) : (
        <div className="space-y-4">
          {items.map(({ item, order }) => (
            <SellerOrderCard
              key={item.id}
              item={item}
              order={order}
              title={titles[item.productId]}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SellerOrderCard({
  item,
  order,
  title,
  onChanged,
}: {
  item: OrderItem;
  order: Order;
  title?: string;
  onChanged: () => void;
}) {
  const { t, locale } = useApp();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [carrier, setCarrier] = useState(item.tracking?.carrier || "");
  const [trackingCode, setTrackingCode] = useState(item.tracking?.trackingCode || "");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [open, setOpen] = useState(false);

  async function setStatus(status: string) {
    setBusy(true);
    setMessage(null);
    try {
      await api.patch(`/seller/order-items/${item.id}/status`, { status, note: note || undefined });
      setNote("");
      onChanged();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  async function addProgress() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await api.post(`/seller/order-items/${item.id}/progress`, { note: note.trim() });
      setNote("");
      setMessage({ tone: "success", text: t("common.saved") });
      onChanged();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  async function saveShipment() {
    setBusy(true);
    try {
      await api.patch(`/seller/order-items/${item.id}/shipment`, {
        carrier: carrier || undefined,
        trackingCode: trackingCode || undefined,
        method: item.shippingOption?.code,
        status: "in_transit",
      });
      setMessage({ tone: "success", text: t("common.saved") });
      onChanged();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-5 py-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{title || item.productId}</p>
          <p className="muted text-xs">
            {order.id} · {formatDateTime(item.createdAt, locale)} · ×{item.quantity}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={item.status} label={t(`ostatus.${item.status}`)} />
          <StatusPill status={item.escrowStatus} />
          <span className="font-semibold">{formatMoney(item.sellerReceivable, locale)}</span>
        </div>
      </header>

      <div className="space-y-3 p-5">
        <div className="grid gap-2 text-xs text-muted sm:grid-cols-3">
          <span>
            {t("cart.shippingOption")}: {item.shippingOption?.label}
          </span>
          <span>
            {t("common.commission")}: {formatMoney(item.commission, locale)}
          </span>
          <span>
            {t("product.leadTime")}: {item.productionDays || 0} {t("product.days")}
          </span>
        </div>

        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

        <div className="flex flex-wrap gap-2">
          {SELLER_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={status === "cancelled" ? "btn-danger btn-sm" : "btn-secondary btn-sm"}
              disabled={busy || item.status === status || ["completed", "cancelled"].includes(item.status)}
              onClick={() => setStatus(status)}
            >
              {t(`ostatus.${status}`)}
            </button>
          ))}
          <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen((value) => !value)}>
            {open ? t("common.close") : t("seller.addProgress")}
          </button>
        </div>

        {open ? (
          <div className="space-y-3 rounded-xl border border-line p-4">
            <textarea
              className="textarea"
              placeholder={t("common.note")}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={addProgress}>
              {busy ? <Spinner className="h-3 w-3" /> : null}
              {t("seller.addProgress")}
            </button>

            <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-3">
              <input
                className="input"
                placeholder={t("seller.carrier")}
                value={carrier}
                onChange={(event) => setCarrier(event.target.value)}
              />
              <input
                className="input"
                placeholder={t("seller.trackingCode")}
                value={trackingCode}
                onChange={(event) => setTrackingCode(event.target.value)}
              />
              <button type="button" className="btn-dark btn-sm" disabled={busy} onClick={saveShipment}>
                {t("seller.shipment")}
              </button>
            </div>
          </div>
        ) : null}

        {item.progressUpdates?.length ? (
          <ul className="space-y-1 rounded-xl bg-paper p-3 text-xs text-muted">
            {item.progressUpdates.map((update) => (
              <li key={update.id}>
                <span className="font-medium text-ink">{t(`ostatus.${update.status}`) || update.status}</span> —{" "}
                {update.note || "—"} · {formatDateTime(update.createdAt, locale)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
