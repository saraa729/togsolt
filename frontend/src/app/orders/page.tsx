"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { Alert, EmptyState, Spinner, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatMoney, imageOrPlaceholder } from "@/lib/format";
import type { Order, OrderItem, Product } from "@/lib/types";

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
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [data, catalog] = await Promise.all([
        api.get<{ orders: Order[] }>("/orders"),
        api.get<{ products: Product[] }>("/products", { query: { locale }, token: null }).catch(() => ({ products: [] })),
      ]);
      setOrders((data.orders || []).filter((order) => order.buyerId === user?.id).reverse());
      setTitles(Object.fromEntries((catalog.products || []).map((product) => [product.id, product.titleText])));
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setLoading(false);
    }
  }, [user?.id, locale]);

  useEffect(() => {
    load();
  }, [load]);

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
      <div className="page py-12">
        <div className="card h-64 skeleton" />
      </div>
    );
  }

  return (
    <div className="page-wide py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("orders.title")}</h1>
      {message ? (
        <div className="mt-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      ) : null}

      {orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={t("orders.empty")} actionLabel={t("cart.emptyCta")} actionHref="/products" />
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {orders.map((order) => (
            <article key={order.id} className="card overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-5 py-3">
                <div>
                  <p className="font-mono text-xs text-muted">{order.id}</p>
                  <p className="muted text-xs">{formatDateTime(order.createdAt, locale)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={order.escrowStatus} label={escrowLabel(order.escrowStatus, t)} />
                  <span className="badge-neutral">{order.payment?.method?.toUpperCase()}</span>
                  <span className="font-semibold">{formatMoney(order.subtotal, locale)}</span>
                </div>
              </header>

              <div className="divide-y divide-line/70">
                {(order.items || []).map((item) => (
                  <BuyerOrderItemRow key={item.id} item={item} title={titles[item.productId]} onChanged={load} />
                ))}
              </div>

              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
                <p className="muted text-xs">{t("orders.confirmHint")}</p>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={busy === order.id || !(order.items || []).some((item) => item.status === "delivered")}
                  onClick={() => confirmReceived(order.id)}
                >
                  {busy === order.id ? <Spinner className="h-3 w-3" /> : null}
                  {t("orders.confirmReceived")}
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function BuyerOrderItemRow({
  item,
  title,
  onChanged,
}: {
  item: OrderItem;
  title?: string;
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/products/${item.productId}`} className="font-medium hover:underline">
            {title || item.productId}
          </Link>
          <p className="muted mt-0.5 text-xs">
            ×{item.quantity} · {item.shippingOption?.label} · {t(`inv.${item.orderType === "made_to_order" ? "made_to_order" : "ready_made"}`)}
          </p>
          {item.tracking?.trackingCode ? (
            <p className="muted mt-1 text-xs">
              {t("orders.tracking")}: {item.tracking.carrier} · {item.tracking.trackingCode}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={item.status} label={t(`ostatus.${item.status}`)} />
          <StatusPill status={item.escrowStatus} label={escrowLabel(item.escrowStatus, t)} />
          <span className="font-semibold">{formatMoney(item.lineTotal, locale)}</span>
        </div>
      </div>

      <Timeline status={item.status} t={t} />

      {item.progressUpdates?.length ? (
        <div className="mt-3 rounded-xl bg-paper p-3">
          <p className="text-xs font-medium">{t("orders.progress")}</p>
          <ul className="mt-2 space-y-2">
            {item.progressUpdates.map((update) => (
              <li key={update.id} className="text-xs text-muted">
                <span className="font-medium text-ink">{t(`ostatus.${update.status}`) || update.status}</span> —{" "}
                {update.note || "—"} · {formatDateTime(update.createdAt, locale)}
                {update.media?.length ? (
                  <div className="mt-1 flex gap-1">
                    {update.media.map((media: any, index: number) => (
                      <img
                        key={index}
                        src={imageOrPlaceholder(media.url)}
                        alt=""
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

      {note ? (
        <p className="mt-3 text-xs text-clay">{note}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
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
        <div className="mt-3 space-y-2 rounded-xl border border-line p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{t("orders.rating")}</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`cursor-pointer text-lg ${star <= rating ? "text-gold" : "text-line"}`}
                onClick={() => setRating(star)}
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
        <div className="mt-3 space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
          <input
            className="input"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("common.reason")}
          />
          <button type="button" className="btn-danger btn-sm" disabled={busy} onClick={openDispute}>
            {busy ? <Spinner className="h-3 w-3" /> : null}
            {t("orders.openDispute")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

const FLOW = ["paid", "accepted", "making", "shipped", "delivered", "completed"];

function Timeline({ status, t }: { status: string; t: (key: string) => string }) {
  if (["cancelled", "disputed"].includes(status)) return null;
  const activeIndex = FLOW.indexOf(status);
  return (
    <ol className="mt-4 flex flex-wrap items-center gap-1 text-[11px]">
      {FLOW.map((step, index) => (
        <li key={step} className="flex items-center gap-1">
          <span
            className={`rounded-full px-2 py-1 ${
              index <= activeIndex ? "bg-clay text-white" : "bg-paper text-muted"
            }`}
          >
            {t(`ostatus.${step}`)}
          </span>
          {index < FLOW.length - 1 ? <span className="text-line">→</span> : null}
        </li>
      ))}
    </ol>
  );
}

function escrowLabel(status: string, t: (key: string) => string) {
  if (status === "held") return t("orders.escrowHeld");
  if (status === "released") return t("orders.escrowReleased");
  if (status === "refunded") return t("orders.escrowRefunded");
  if (status === "disputed") return t("orders.escrowDisputed");
  return status;
}
