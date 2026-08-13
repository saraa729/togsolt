"use client";

import { useCallback, useEffect, useState } from "react";
import OrderTimeline, { nextSellerStatuses } from "@/components/OrderTimeline";
import { Alert, EmptyState, Spinner, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatMoney, imageOrPlaceholder } from "@/lib/format";
import type { Order, OrderItem, Product } from "@/lib/types";

/** Төлөв нь дуусч, урлаач цаашид өөрчилж чадахгүй мөрүүд. */
const LOCKED_STATUSES = ["completed", "cancelled", "disputed"];

type CatalogEntry = { title: string; image?: string };

export default function SellerOrdersPage() {
  const { t, locale } = useApp();
  const { user } = useAuth();
  const [items, setItems] = useState<{ item: OrderItem; order: Order }[]>([]);
  const [catalog, setCatalog] = useState<Record<string, CatalogEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, products] = await Promise.all([
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
      setCatalog(
        Object.fromEntries(
          (products.products || []).map((product) => [
            product.id,
            { title: product.titleText, image: product.images?.[0] },
          ])
        )
      );
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
              entry={catalog[item.productId]}
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
  entry,
  onChanged,
}: {
  item: OrderItem;
  order: Order;
  entry?: CatalogEntry;
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

  /*
   * Урлаач зөвхөн урагш явна. Эхнийх нь ердийн дараагийн алхам (тод товч),
   * үлдсэн нь алгасах сонголт — бэлэн бүтээл "хийж байна"-г алгасаж шууд
   * илгээгддэг тул алгасахыг хаахгүй, зүгээр л хоёрдогч байдлаар харуулна.
   */
  const forward = LOCKED_STATUSES.includes(item.status) ? [] : nextSellerStatuses(item.status);
  const [nextStatus, ...skipStatuses] = forward;
  const canCancel = !LOCKED_STATUSES.includes(item.status) && item.status !== "delivered";

  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line bg-paper px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={imageOrPlaceholder(entry?.image)}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl border border-line/70 object-cover"
          />
          <div className="min-w-0">
            <p className="truncate font-medium">{entry?.title || item.productId}</p>
            <p className="muted truncate text-xs">
              {order.id} · {formatDateTime(item.createdAt, locale)} · ×{item.quantity}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusPill status={item.status} label={t(`ostatus.${item.status}`)} />
          <span className="font-semibold">{formatMoney(item.sellerReceivable, locale)}</span>
        </div>
      </header>

      <div className="space-y-4 p-5">
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

        <OrderTimeline status={item.status} />

        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

        {LOCKED_STATUSES.includes(item.status) ? (
          <p className="muted text-xs">{t("seller.statusLocked")}</p>
        ) : item.status === "delivered" ? (
          <p className="rounded-2xl border border-line bg-paper px-4 py-3 text-xs text-muted">
            {t("seller.awaitingBuyer")}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={busy}
              onClick={() => setStatus(nextStatus)}
            >
              {busy ? <Spinner className="h-3 w-3" /> : null}
              {t("seller.nextStep")}: {t(`ostatus.${nextStatus}`)}
            </button>

            {skipStatuses.length ? (
              <>
                <span className="text-[11px] text-muted">{t("seller.skipTo")}</span>
                {skipStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => setStatus(status)}
                  >
                    {t(`ostatus.${status}`)}
                  </button>
                ))}
              </>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen((value) => !value)}>
            {open ? t("common.close") : t("seller.addProgress")}
          </button>
          {canCancel ? (
            <button
              type="button"
              className="btn-danger btn-sm"
              disabled={busy}
              onClick={() => setStatus("cancelled")}
            >
              {t("ostatus.cancelled")}
            </button>
          ) : null}
        </div>

        {open ? (
          <div className="space-y-3 rounded-2xl border border-line p-4">
            <textarea
              className="textarea"
              placeholder={t("common.note")}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <button type="button" className="btn-primary btn-sm" disabled={busy || !note.trim()} onClick={addProgress}>
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
          <div className="rounded-2xl border border-line/70 bg-paper p-4">
            <p className="label mb-0">{t("orders.progress")}</p>
            <ul className="mt-3 space-y-3">
              {item.progressUpdates.map((update) => (
                <li key={update.id} className="border-l-2 border-clay/30 pl-3 text-xs text-muted">
                  <span className="font-medium text-ink">{t(`ostatus.${update.status}`) || update.status}</span>
                  {update.note ? ` — ${update.note}` : ""}
                  <span className="mt-0.5 block text-[11px]">{formatDateTime(update.createdAt, locale)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  );
}
