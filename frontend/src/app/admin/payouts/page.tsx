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
  slaAlerts?: { severity: "warning" | "critical"; queue: string; entityId: string; ageHours: number; message: string }[];
};

export default function AdminPayoutsPage() {
  const { t, locale } = useApp();
  const [queues, setQueues] = useState<Queues | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [settlements, setSettlements] = useState<Record<string, { transactionRef: string; note: string }>>({});
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
      const settlement = settlements[requestId] || { transactionRef: "", note: "" };
      await api.patch(`/admin/payout-requests/${requestId}`, {
        status,
        ...(status === "paid" ? settlement : {}),
      });
      setMessage({ tone: "success", text: t("common.saved") });
      await load();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(null);
    }
  }

  function settlementValue(requestId: string) {
    return settlements[requestId] || { transactionRef: "", note: "" };
  }

  function updateSettlement(requestId: string, patch: Partial<{ transactionRef: string; note: string }>) {
    setSettlements((current) => ({
      ...current,
      [requestId]: { ...(current[requestId] || { transactionRef: "", note: "" }), ...patch },
    }));
  }

  function bankText(request: PayoutRequest) {
    const account = request.bankAccount || {};
    return [account.bankName, account.accountNumber || account.accountLast4, account.accountName].filter(Boolean).join(" · ") || "-";
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

      {(queues?.slaAlerts?.length ?? 0) > 0 ? (
        <section className="card">
          <div className="flex items-center justify-between gap-3 pb-3">
            <h2 className="font-medium">{t("admin.slaAlerts")}</h2>
            <StatusPill status={`${queues?.slaAlerts?.filter((item) => item.severity === "critical").length || 0} critical`} />
          </div>
          <div className="grid gap-2">
            {queues?.slaAlerts?.slice(0, 8).map((alert) => (
              <div key={`${alert.queue}-${alert.entityId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-paper px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{alert.queue}</p>
                  <p className="muted text-xs">{alert.entityId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="muted text-xs">{alert.ageHours}h</span>
                  <StatusPill status={alert.severity} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
                  <th>Банк</th>
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
                    <td className="text-xs text-muted">{bankText(request)}</td>
                    <td>
                      <StatusPill status={request.status} />
                    </td>
                    <td className="text-xs text-muted">{formatDateTime(request.createdAt, locale)}</td>
                    <td>
                      <div className="grid min-w-72 gap-2">
                        <input
                          className="input"
                          value={settlementValue(request.id).transactionRef}
                          onChange={(event) => updateSettlement(request.id, { transactionRef: event.target.value })}
                          placeholder="Гүйлгээний дугаар"
                        />
                        <input
                          className="input"
                          value={settlementValue(request.id).note}
                          onChange={(event) => updateSettlement(request.id, { note: event.target.value })}
                          placeholder={t("common.note")}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          disabled={busy === request.id || request.status !== "requested"}
                          onClick={() => review(request.id, "approved")}
                        >
                          {busy === request.id ? <Spinner className="h-3 w-3" /> : null}
                          {t("admin.approve")}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          disabled={busy === request.id || request.status !== "requested"}
                          onClick={() => review(request.id, "rejected")}
                        >
                          {t("admin.reject")}
                        </button>
                        <button
                          type="button"
                          className="btn-dark btn-sm"
                          disabled={busy === request.id || !settlementValue(request.id).transactionRef.trim()}
                          onClick={() => review(request.id, "paid")}
                        >
                          {t("ostatus.paid")}
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
