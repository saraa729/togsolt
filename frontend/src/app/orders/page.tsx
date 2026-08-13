"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import OrderTimeline from "@/components/OrderTimeline";
import RequireAuth from "@/components/RequireAuth";
import { Alert, EmptyState, Spinner, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatMoney, imageOrPlaceholder } from "@/lib/format";
import type { Order, OrderItem, Product } from "@/lib/types";

/** Захиалгын мөрөнд харуулах каталогийн товч мэдээлэл. */
type CatalogEntry = { title: string; image?: string };

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersView />
    </RequireAuth>
  );
}

function OrdersView() {
  const { t, locale } = useApp();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [catalog, setCatalog] = useState<Record<string, CatalogEntry>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, products] = await Promise.all([
        api.get<{ orders: Order[] }>("/orders"),
        api.get<{ products: Product[] }>("/products", { query: { locale }, token: null }).catch(() => ({ products: [] })),
      ]);
      setOrders((data.orders || []).filter((order) => order.buyerId === user?.id).reverse());
      setCatalog(
        Object.fromEntries(
          (products.products || []).map((product) => [
            product.id,
            { title: product.titleText, image: product.images?.[0] },
          ])
        )
      );
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setLoading(false);
    }
  }, [user?.id, locale]);

  useEffect(() => {
    load();
  }, [load]);

  /*
   * Төлбөрөө дуусгаагүй захиалга. Stripe бол hosted хуудас руу нь буцаана,
   * QPay бол callback хүрээгүй байж болзошгүй тул backend эх сурвалжаас нь
   * дахин асуусны дараа жагсаалтыг сэргээнэ.
   */
  async function resumePayment(orderId: string) {
    setBusy(orderId);
    setMessage(null);
    try {
      const data = await api.get<{ status: string; payment: { redirectUrl?: string | null } }>(
        `/orders/${orderId}/payment`
      );
      if (data.payment?.redirectUrl && data.status === "pending_payment") {
        window.location.href = data.payment.redirectUrl;
        return;
      }
      await load();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(null);
    }
  }

  async function confirmReceived(orderId: string) {
    setBusy(orderId);
    setMessage(null);
    try {
      await api.post(`/orders/${orderId}/confirm-received`);
      setMessage({ tone: "success", text: t("orders.escrowReleased") });
      await load();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <div className="h-8 w-48 rounded-full skeleton" />
        <div className="mt-6 space-y-5">
          <div className="h-56 rounded-3xl skeleton" />
          <div className="h-56 rounded-3xl skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="display text-[28px] leading-tight tracking-tight sm:text-[34px]">{t("orders.title")}</h1>
        {orders.length ? <p className="muted text-sm">{t("orders.count", { count: orders.length })}</p> : null}
      </header>

      {message ? (
        <div className="mt-5">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      ) : null}

      {orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={t("orders.empty")} actionLabel={t("cart.emptyCta")} actionHref="/products" />
        </div>
      ) : (
        <div className="mt-7 space-y-6">
          {orders.map((order) => {
            const items = order.items || [];
            const released = order.escrowStatus === "released";
            const canConfirm = items.some((item) => item.status === "delivered");
            const awaitingPayment = order.status === "pending_payment";
            const paymentFailed = order.status === "payment_failed";

            return (
              <article key={order.id} className="card overflow-hidden">
                <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line bg-paper px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] tracking-tight text-muted">{order.id}</p>
                    <p className="mt-0.5 text-xs text-muted">{formatDateTime(order.createdAt, locale)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <StatusPill status={order.escrowStatus} label={escrowLabel(order.escrowStatus, t)} />
                    {order.payment?.method ? (
                      <span className="text-[10px] font-medium tracking-[0.12em] text-muted uppercase">
                        {order.payment.method}
                      </span>
                    ) : null}
                    <span className="text-lg font-semibold tracking-tight">{formatMoney(order.subtotal, locale)}</span>
                  </div>
                </header>

                <div className="divide-y divide-line/70">
                  {items.map((item) => (
                    <BuyerOrderItemRow
                      key={item.id}
                      item={item}
                      entry={catalog[item.productId]}
                      showLineTotal={items.length > 1}
                      onChanged={load}
                    />
                  ))}
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper/60 px-5 py-4">
                  {awaitingPayment ? (
                    <>
                      <p className="flex items-center gap-2 text-xs font-medium text-clay-dark">
                        <Spinner className="h-3 w-3" />
                        {t("orders.pendingPayment")}
                      </p>
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        disabled={busy === order.id}
                        onClick={() => resumePayment(order.id)}
                      >
                        {t("orders.completePayment")}
                      </button>
                    </>
                  ) : paymentFailed ? (
                    <p className="text-xs font-medium text-red-700">{t("orders.paymentFailed")}</p>
                  ) : released ? (
                    <p className="flex items-center gap-2 text-xs font-medium text-emerald-700">
                      <span aria-hidden>✓</span>
                      {t("orders.confirmDone")}
                    </p>
                  ) : (
                    <>
                      <p className="muted max-w-md text-xs leading-relaxed">
                        {canConfirm ? t("orders.confirmHint") : t("orders.confirmLocked")}
                      </p>
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        disabled={busy === order.id || !canConfirm}
                        onClick={() => confirmReceived(order.id)}
                      >
                        {busy === order.id ? <Spinner className="h-3 w-3" /> : null}
                        {t("orders.confirmReceived")}
                      </button>
                    </>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BuyerOrderItemRow({
  item,
  entry,
  showLineTotal,
  onChanged,
}: {
  item: OrderItem;
  entry?: CatalogEntry;
  showLineTotal: boolean;
  onChanged: () => void;
}) {
  const { t, locale } = useApp();
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function openDispute() {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await api.post("/disputes", { orderItemId: item.id, reason: reason.trim() });
      setDisputeOpen(false);
      setReason("");
      setNote(t("orders.disputeOpened"));
      onChanged();
    } catch (caught) {
      setNote(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function submitReview() {
    setBusy(true);
    try {
      await api.post("/reviews", { orderItemId: item.id, rating, comment });
      setReviewOpen(false);
      setComment("");
      setNote(t("orders.reviewSent"));
      onChanged();
    } catch (caught) {
      setNote(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const canReview = ["delivered", "completed"].includes(item.status);

  return (
    <div className="p-5">
      <div className="flex gap-4">
        <Link href={`/products/${item.productId}`} className="shrink-0">
          <img
            src={imageOrPlaceholder(entry?.image)}
            alt=""
            className="h-18 w-18 rounded-2xl border border-line/70 object-cover"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <Link href={`/products/${item.productId}`} className="font-medium underline-offset-4 hover:underline">
                {entry?.title || item.productId}
              </Link>
              <p className="muted mt-1 text-xs">
                ×{item.quantity} · {item.shippingOption?.label} ·{" "}
                {t(`inv.${item.orderType === "made_to_order" ? "made_to_order" : "ready_made"}`)}
              </p>
              {item.tracking?.trackingCode ? (
                <p className="mt-1 text-xs text-muted">
                  {t("orders.tracking")}:{" "}
                  <span className="font-mono text-ink">
                    {item.tracking.carrier} · {item.tracking.trackingCode}
                  </span>
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <StatusPill status={item.status} label={t(`ostatus.${item.status}`)} />
              {showLineTotal ? <span className="font-semibold">{formatMoney(item.lineTotal, locale)}</span> : null}
            </div>
          </div>
        </div>
      </div>

      <OrderTimeline status={item.status} className="mt-5" />

      {item.progressUpdates?.length ? (
        <div className="mt-4 rounded-2xl border border-line/70 bg-paper p-4">
          <p className="label mb-0">{t("orders.progress")}</p>
          <ul className="mt-3 space-y-3">
            {item.progressUpdates.map((update) => (
              <li key={update.id} className="border-l-2 border-clay/30 pl-3 text-xs text-muted">
                <span className="font-medium text-ink">{t(`ostatus.${update.status}`) || update.status}</span>
                {update.note ? ` — ${update.note}` : ""}
                <span className="mt-0.5 block text-[11px]">{formatDateTime(update.createdAt, locale)}</span>
                {update.media?.length ? (
                  <div className="mt-2 flex gap-1.5">
                    {update.media.map((media: { url?: string }, index: number) => (
                      <img
                        key={index}
                        src={imageOrPlaceholder(media.url)}
                        alt=""
                        loading="lazy"
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {note ? <p className="mt-3 text-xs text-clay">{note}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {canReview ? (
          <button type="button" className="btn-secondary btn-sm" onClick={() => setReviewOpen((value) => !value)}>
            ★ {t("orders.review")}
          </button>
        ) : null}
        {!["cancelled", "disputed"].includes(item.status) ? (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setDisputeOpen((value) => !value)}>
            ⚑ {t("orders.openDispute")}
          </button>
        ) : null}
      </div>

      {reviewOpen ? (
        <div className="mt-3 space-y-3 rounded-2xl border border-line bg-paper p-4">
          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-xs text-muted">{t("orders.rating")}</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`cursor-pointer text-xl leading-none transition-colors ${
                  star <= rating ? "text-gold" : "text-line hover:text-gold/50"
                }`}
                onClick={() => setRating(star)}
                aria-label={`${star}`}
                aria-pressed={star === rating}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            className="textarea"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t("common.details")}
          />
          <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={submitReview}>
            {busy ? <Spinner className="h-3 w-3" /> : null}
            {t("common.send")}
          </button>
        </div>
      ) : null}

      {disputeOpen ? (
        <div className="mt-3 space-y-3 rounded-2xl border border-red-200 bg-red-50/60 p-4">
          <input
            className="input"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("common.reason")}
          />
          <button type="button" className="btn-danger btn-sm" disabled={busy || !reason.trim()} onClick={openDispute}>
            {busy ? <Spinner className="h-3 w-3" /> : null}
            {t("orders.openDispute")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function escrowLabel(status: string, t: (key: string) => string) {
  if (status === "pending") return t("orders.escrowPending");
  if (status === "held") return t("orders.escrowHeld");
  if (status === "released") return t("orders.escrowReleased");
  if (status === "refunded") return t("orders.escrowRefunded");
  if (status === "disputed") return t("orders.escrowDisputed");
  return status;
}
