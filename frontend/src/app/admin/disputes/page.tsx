"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, EmptyState, Spinner, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Dispute } from "@/lib/types";

export default function AdminDisputesPage() {
  const { t, locale } = useApp();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ disputes: Dispute[] }>("/admin/disputes");
      setDisputes((data.disputes || []).slice().reverse());
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resolve(disputeId: string, decision: "refund_buyer" | "release_seller" | "reject") {
    setBusy(disputeId);
    setMessage(null);
    try {
      await api.post(`/admin/disputes/${disputeId}/resolve`, { decision, note: notes[disputeId] || "" });
      setMessage({ tone: "success", text: t("common.saved") });
      await load();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="card h-64 skeleton" />;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.disputes")}</h1>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      {disputes.length === 0 ? (
        <EmptyState title={t("common.empty")} />
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => {
            const settled = !["open", "frozen"].includes(dispute.status);
            return (
              <article key={dispute.id} className="card-pad space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{dispute.reason}</p>
                    <p className="muted text-xs">
                      {dispute.orderId} · {dispute.orderItemId} · {formatDateTime(dispute.createdAt, locale)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={dispute.status} />
                    {dispute.orderItem ? (
                      <span className="font-semibold">{formatMoney(dispute.orderItem.lineTotal, locale)}</span>
                    ) : null}
                  </div>
                </div>

                {dispute.resolution ? (
                  <Alert tone="info">
                    {dispute.resolution.decision} — {dispute.resolution.note || "—"}
                  </Alert>
                ) : null}

                {!settled ? (
                  <>
                    <input
                      className="input"
                      placeholder={t("common.note")}
                      value={notes[dispute.id] || ""}
                      onChange={(event) => setNotes({ ...notes, [dispute.id]: event.target.value })}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        disabled={busy === dispute.id}
                        onClick={() => resolve(dispute.id, "refund_buyer")}
                      >
                        {busy === dispute.id ? <Spinner className="h-3 w-3" /> : null}
                        {t("admin.refundBuyer")}
                      </button>
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        disabled={busy === dispute.id}
                        onClick={() => resolve(dispute.id, "release_seller")}
                      >
                        {t("admin.releaseSeller")}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        disabled={busy === dispute.id}
                        onClick={() => resolve(dispute.id, "reject")}
                      >
                        {t("admin.dismiss")}
                      </button>
                    </div>
                  </>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
