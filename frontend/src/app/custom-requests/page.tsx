"use client";

import { useCallback, useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { Alert, EmptyState, Spinner, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { CustomRequest } from "@/lib/types";

export default function CustomRequestsPage() {
  return (
    <RequireAuth role="buyer">
      <CustomRequestsView />
    </RequireAuth>
  );
}

function CustomRequestsView() {
  const { t, locale } = useApp();
  const { refreshCart } = useAuth();
  const [requests, setRequests] = useState<CustomRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ customRequests: CustomRequest[] }>("/custom-requests");
      setRequests(data.customRequests || []);
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function acceptQuote(requestId: string) {
    setBusy(requestId);
    try {
      await api.post(`/custom-requests/${requestId}/accept-quote`);
      await load();
      setMessage({ tone: "success", text: t("custom.status.accepted") });
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(null);
    }
  }

  async function addToCart(requestId: string) {
    setBusy(requestId);
    try {
      await api.post(`/cart/custom-requests/${requestId}`, { locale });
      await refreshCart();
      setMessage({ tone: "success", text: t("product.added") });
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(null);
    }
  }

  async function sendMessage(requestId: string) {
    const text = (drafts[requestId] || "").trim();
    if (!text) return;
    setBusy(requestId);
    try {
      await api.post(`/custom-requests/${requestId}/messages`, { message: text });
      setDrafts({ ...drafts, [requestId]: "" });
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
    <div className="page max-w-4xl py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("custom.title")}</h1>
      {message ? (
        <div className="mt-4">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      ) : null}

      {requests.length === 0 ? (
        <div className="mt-8">
          <EmptyState title={t("custom.empty")} actionLabel={t("cart.emptyCta")} actionHref="/products" />
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {requests.map((request) => (
            <article key={request.id} className="card overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{request.message.slice(0, 60)}</p>
                  <p className="muted text-xs">{formatDateTime(request.createdAt, locale)}</p>
                </div>
                <StatusPill status={request.status} label={t(`custom.status.${request.status}`)} />
              </header>

              <div className="space-y-3 p-5">
                {request.quote ? (
                  <div className="rounded-xl bg-clay-soft/40 p-4">
                    <p className="text-sm font-medium">{t("seller.quote")}</p>
                    <p className="mt-1 text-lg font-semibold">{formatMoney(request.quote.price, locale)}</p>
                    <p className="muted text-xs">
                      {t("product.leadTime")}: {request.quote.productionDays} {t("product.days")}
                    </p>
                    {request.quote.note ? <p className="muted mt-1 text-xs">{request.quote.note}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {request.status === "quoted" ? (
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          disabled={busy === request.id}
                          onClick={() => acceptQuote(request.id)}
                        >
                          {busy === request.id ? <Spinner className="h-3 w-3" /> : null}
                          {t("custom.acceptQuote")}
                        </button>
                      ) : null}
                      {request.status === "accepted" ? (
                        <button
                          type="button"
                          className="btn-dark btn-sm"
                          disabled={busy === request.id}
                          onClick={() => addToCart(request.id)}
                        >
                          {t("custom.addToCart")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl bg-paper p-3">
                  {(request.messages || []).map((item) => (
                    <div
                      key={item.id}
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        item.senderRole === "buyer" ? "ml-auto bg-clay text-white" : "bg-surface"
                      }`}
                    >
                      <p>{item.message}</p>
                      <p className={`mt-1 text-[10px] ${item.senderRole === "buyer" ? "text-white/70" : "text-muted"}`}>
                        {formatDateTime(item.createdAt, locale)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    className="input"
                    placeholder={t("custom.messagePlaceholder")}
                    value={drafts[request.id] || ""}
                    onChange={(event) => setDrafts({ ...drafts, [request.id]: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        sendMessage(request.id);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy === request.id}
                    onClick={() => sendMessage(request.id)}
                  >
                    {t("common.send")}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
