"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, EmptyState, Spinner, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { CustomRequest } from "@/lib/types";

export default function SellerCustomRequestsPage() {
  const { t } = useApp();
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ customRequests: CustomRequest[] }>("/seller/custom-requests");
      setRequests(data.customRequests || []);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="card h-64 skeleton" />;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t("seller.customRequests")}</h1>
      {error ? <Alert tone="error">{error}</Alert> : null}

      {requests.length === 0 ? (
        <EmptyState title={t("custom.empty")} />
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({ request, onChanged }: { request: CustomRequest; onChanged: () => void }) {
  const { t, locale } = useApp();
  const [price, setPrice] = useState(String(request.quote?.price.amount || ""));
  const [days, setDays] = useState(String(request.quote?.productionDays || 7));
  const [note, setNote] = useState(request.quote?.note || "");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function sendQuote() {
    if (!price) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.patch(`/seller/custom-requests/${request.id}`, {
        status: "quoted",
        message: reply || undefined,
        quote: {
          price: { amount: Number(price), currency: "MNT" },
          productionDays: Number(days || 7),
          note,
        },
      });
      setReply("");
      setMessage({ tone: "success", text: t("common.saved") });
      onChanged();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      await api.patch(`/seller/custom-requests/${request.id}`, { status: "rejected", message: reply || undefined });
      onChanged();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  /** Батлагдсан үнийн саналаас гэрээ үүсгэж, худалдан авагч руу илгээнэ. */
  async function sendContract() {
    if (!request.quote) {
      setMessage({ tone: "error", text: t("contract.needsQuote") });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api.post(`/seller/custom-requests/${request.id}/contract`, { status: "sent" });
      setMessage({ tone: "success", text: t("contract.sent") });
      onChanged();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await api.post(`/custom-requests/${request.id}/messages`, { message: reply.trim() });
      setReply("");
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
        <div>
          <p className="text-sm font-medium">{request.message.slice(0, 70)}</p>
          <p className="muted text-xs">{formatDateTime(request.createdAt, locale)}</p>
        </div>
        <StatusPill status={request.status} label={t(`custom.status.${request.status}`)} />
      </header>

      <div className="space-y-3 p-5">
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

        <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl bg-paper p-3">
          {(request.messages || []).map((item) => (
            <div
              key={item.id}
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                item.senderRole === "seller" ? "ml-auto bg-pine text-white" : "bg-surface"
              }`}
            >
              <p>{item.message}</p>
              <p className={`mt-1 text-[10px] ${item.senderRole === "seller" ? "text-white/70" : "text-muted"}`}>
                {formatDateTime(item.createdAt, locale)}
              </p>
            </div>
          ))}
        </div>

        {request.quote ? (
          <p className="muted text-xs">
            {t("seller.quote")}: {formatMoney(request.quote.price, locale)} · {request.quote.productionDays}{" "}
            {t("product.days")}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className="input"
            inputMode="numeric"
            placeholder={t("seller.priceMnt")}
            value={price}
            onChange={(event) => setPrice(event.target.value.replace(/\D/g, ""))}
          />
          <input
            className="input"
            inputMode="numeric"
            placeholder={t("seller.productionDays")}
            value={days}
            onChange={(event) => setDays(event.target.value.replace(/\D/g, ""))}
          />
          <input
            className="input"
            placeholder={t("common.note")}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        <textarea
          className="textarea"
          placeholder={t("custom.messagePlaceholder")}
          value={reply}
          onChange={(event) => setReply(event.target.value)}
        />

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={sendQuote}>
            {busy ? <Spinner className="h-3 w-3" /> : null}
            {t("seller.sendQuote")}
          </button>
          <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={sendMessage}>
            {t("common.send")}
          </button>
          {/* Гэрээ нь батлагдсан үнийн саналаас үүсдэг тул санал өгөөгүй бол идэвхгүй. */}
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={busy || !request.quote}
            title={request.quote ? undefined : t("contract.needsQuote")}
            onClick={sendContract}
          >
            {t("contract.send")}
          </button>
          <button type="button" className="btn-danger btn-sm" disabled={busy} onClick={reject}>
            {t("custom.status.rejected")}
          </button>
        </div>
      </div>
    </article>
  );
}
