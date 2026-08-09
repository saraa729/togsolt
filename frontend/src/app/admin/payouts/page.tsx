"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, EmptyState, Spinner, Stat, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { PayoutRequest } from "@/lib/types";

type Queues = {
  sellerVerification: unknown[];
  contentModeration: unknown[];
  disputes: unknown[];
  payoutQueue: { id: string; sellerId: string; amount: any; status: string; createdAt: string }[];
  payoutRequests: PayoutRequest[];
};

export default function AdminPayoutsPage() {
  const { t, locale } = useApp();
  const [queues, setQueues] = useState<Queues | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<Queues>("/admin/queues");
      setQueues(data);
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function review(requestId: string, status: "approved" | "rejected" | "paid") {
    setBusy(requestId);
    setMessage(null);
    try {
      await api.patch(`/admin/payout-requests/${requestId}`, { status });
      setMessage({ tone: "success", text: t("common.saved") });
      await load();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(null);
    }
  }

  async function runBatch(action: "payouts" | "escrow") {
    setBusy(action);
    setMessage(null);
    try {
      if (action === "payouts") await api.post("/admin/payouts/run", { currency: "MNT" });
      else await api.post("/admin/escrow/auto-release", {});
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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.payouts")}</h1>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("admin.verifications")} value={queues?.sellerVerification.length ?? 0} />
        <Stat label={t("admin.reports")} value={queues?.contentModeration.length ?? 0} />
        <Stat label={t("admin.disputes")} value={queues?.disputes.length ?? 0} />
        <Stat label={t("admin.payouts")} value={queues?.payoutRequests.length ?? 0} hint={`${queues?.payoutQueue.length ?? 0} batch`} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={busy === "payouts"} onClick={() => runBatch("payouts")}>
          {busy === "payouts" ? <Spinner /> : null}
          {t("admin.runPayouts")}
        </button>
        <button type="button" className="btn-dark" disabled={busy === "escrow"} onClick={() => runBatch("escrow")}>
          {busy === "escrow" ? <Spinner /> : null}
          {t("admin.autoRelease")}
        </button>
      </div>

      <section>
        <h2 className="pb-3 font-medium">{t("seller.payoutHistory")}</h2>
        {(queues?.payoutRequests.length ?? 0) === 0 ? (
          <EmptyState title={t("common.empty")} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t("common.seller")}</th>
                  <th>{t("common.total")}</th>
                  <th>{t("common.status")}</th>
                  <th>{t("common.date")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {queues?.payoutRequests.map((request) => (
                  <tr key={request.id}>
                    <td className="font-mono text-xs">{request.id}</td>
                    <td className="font-mono text-xs">{request.sellerId}</td>
                    <td>{formatMoney(request.amount, locale)}</td>
                    <td>
                      <StatusPill status={request.status} />
                    </td>
                    <td className="text-xs text-muted">{formatDateTime(request.createdAt, locale)}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          disabled={busy === request.id}
                          onClick={() => review(request.id, "approved")}
                        >
                          {busy === request.id ? <Spinner className="h-3 w-3" /> : null}
                          {t("admin.approve")}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          disabled={busy === request.id}
                          onClick={() => review(request.id, "rejected")}
                        >
                          {t("admin.reject")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(queues?.payoutQueue.length ?? 0) > 0 ? (
        <section>
          <h2 className="pb-3 font-medium">Batch queue</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t("common.seller")}</th>
                  <th>{t("common.total")}</th>
                  <th>{t("common.status")}</th>
                </tr>
              </thead>
              <tbody>
                {queues?.payoutQueue.map((payout) => (
                  <tr key={payout.id}>
                    <td className="font-mono text-xs">{payout.id}</td>
                    <td className="font-mono text-xs">{payout.sellerId}</td>
                    <td>{formatMoney(payout.amount, locale)}</td>
                    <td>
                      <StatusPill status={payout.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
