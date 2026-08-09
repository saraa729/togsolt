"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, EmptyState, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatAmount, formatDateTime } from "@/lib/format";
import type { AuditLog, Balances } from "@/lib/types";

type Reconciliation = {
  date: string;
  entryCount: number;
  byType: Record<string, Record<string, number>>;
  balances: Record<string, Record<string, number>>;
};

type LedgerEntry = {
  id: string;
  orderId: string;
  orderItemId: string | null;
  sellerId: string | null;
  type: string;
  amount: { amount: number; currency: string };
  note?: string;
  createdAt: string;
};

export default function AdminSettingsPage() {
  const { t, locale } = useApp();
  const [commissionBps, setCommissionBps] = useState("1200");
  const [escrowDays, setEscrowDays] = useState("7");
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [busy, setBusy] = useState(false);
  const [jobBusy, setJobBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const [reconciliationData, ledgerData, logsData, balanceData] = await Promise.all([
      api.get<{ reconciliation: Reconciliation }>("/admin/reconciliation/daily").catch(() => null),
      api.get<{ entries: LedgerEntry[] }>("/admin/escrow-ledger").catch(() => ({ entries: [] })),
      api.get<{ auditLogs: AuditLog[] }>("/admin/audit-logs").catch(() => ({ auditLogs: [] })),
      api.get<{ balances: Balances }>("/admin/balances").catch(() => null),
    ]);
    setReconciliation(reconciliationData?.reconciliation || null);
    setLedger((ledgerData.entries || []).slice(-40).reverse());
    setLogs((logsData.auditLogs || []).slice(0, 40));
    setBalances(balanceData?.balances || null);
    setLoading(false);
  }, []);

  /** Escrow чөлөөлөлт / өдрийн тооцоог гараар ажиллуулж, дараа нь дэлгэцээ шинэчилнэ. */
  async function runJob(name: string) {
    setJobBusy(name);
    setMessage(null);
    try {
      await api.post(`/admin/jobs/${name}/run`);
      setMessage({ tone: "success", text: t("admin.jobDone") });
      await load();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setJobBusy(null);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api.patch("/admin/settings", {
        defaultCommissionBps: Number(commissionBps),
        escrowAutoReleaseDays: Number(escrowDays),
      });
      setMessage({ tone: "success", text: t("common.saved") });
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.settings")}</h1>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      <form onSubmit={saveSettings} className="card-pad space-y-4">
        <h2 className="font-medium">{t("admin.settings")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">{t("admin.commissionRate")}</span>
            <input
              className="input"
              inputMode="numeric"
              value={commissionBps}
              onChange={(event) => setCommissionBps(event.target.value.replace(/\D/g, ""))}
            />
            <span className="mt-1 block text-xs text-muted">
              {(Number(commissionBps || 0) / 100).toFixed(2)}% (500–1500 bps)
            </span>
          </label>
          <label className="block">
            <span className="label">{t("admin.escrowDays")}</span>
            <input
              className="input"
              inputMode="numeric"
              value={escrowDays}
              onChange={(event) => setEscrowDays(event.target.value.replace(/\D/g, ""))}
            />
          </label>
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Spinner /> : null}
          {t("common.save")}
        </button>
      </form>

      <section className="card-pad">
        <h2 className="font-medium">{t("admin.platformBalances")}</h2>
        {loading ? (
          <div className="mt-3 h-20 skeleton rounded-xl" />
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <BalanceTile label={t("admin.escrowHeld")} amounts={balances?.escrowHeld} />
            <BalanceTile label={t("admin.sellerPayable")} amounts={balances?.sellerBalance} />
            <BalanceTile label={t("admin.commissionEarned")} amounts={balances?.platformCommission} />
          </div>
        )}
      </section>

      <section className="card-pad space-y-3">
        <h2 className="font-medium">{t("admin.jobs")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { name: "escrow_auto_release", label: t("admin.jobEscrow") },
              { name: "daily_reconciliation", label: t("admin.jobReconciliation") },
            ] as const
          ).map((job) => (
            <div
              key={job.name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2"
            >
              <span className="text-sm">{job.label}</span>
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={jobBusy === job.name}
                onClick={() => runJob(job.name)}
              >
                {jobBusy === job.name ? <Spinner className="h-3 w-3" /> : null}
                {t("admin.jobRun")}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="card-pad">
        <h2 className="font-medium">{t("admin.reconciliation")}</h2>
        {loading ? (
          <div className="mt-3 h-20 skeleton rounded-xl" />
        ) : reconciliation ? (
          <>
            <p className="muted mt-1 text-xs">
              {reconciliation.date} · {reconciliation.entryCount} entries
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.entries(reconciliation.byType || {}).map(([type, amounts]) => (
                <div key={type} className="flex justify-between rounded-xl bg-paper px-3 py-2 text-sm">
                  <span className="text-muted">{type}</span>
                  <span className="font-medium">
                    {Object.entries(amounts)
                      .map(([currency, amount]) => formatAmount(amount, currency))
                      .join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="muted mt-2">{t("common.empty")}</p>
        )}
      </section>

      <section>
        <h2 className="pb-3 font-medium">{t("admin.ledger")}</h2>
        {ledger.length === 0 ? (
          <EmptyState title={t("common.empty")} />
        ) : (
          <div className="table-wrap max-h-96 overflow-y-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>{t("common.order")}</th>
                  <th>{t("common.total")}</th>
                  <th>{t("common.date")}</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((entry) => (
                  <tr key={entry.id}>
                    <td className="text-xs font-medium">{entry.type}</td>
                    <td className="font-mono text-xs">{entry.orderId}</td>
                    <td>{formatAmount(entry.amount?.amount, entry.amount?.currency || "MNT")}</td>
                    <td className="text-xs text-muted">{formatDateTime(entry.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="pb-3 font-medium">{t("admin.audit")}</h2>
        {logs.length === 0 ? (
          <EmptyState title={t("common.empty")} />
        ) : (
          <div className="table-wrap max-h-96 overflow-y-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Actor</th>
                  <th>{t("common.date")}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-xs font-medium">{log.action}</td>
                    <td className="text-xs">
                      {log.entityType} · <span className="font-mono">{log.entityId}</span>
                    </td>
                    <td className="font-mono text-xs">{log.actorId || "system"}</td>
                    <td className="text-xs text-muted">{formatDateTime(log.createdAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** Валют бүрээр задалсан үлдэгдэл — хоосон бол зураас. */
function BalanceTile({ label, amounts }: { label: string; amounts?: Record<string, number> }) {
  const entries = Object.entries(amounts || {}).filter(([, amount]) => amount !== 0);
  return (
    <div className="rounded-xl bg-paper px-3 py-3">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1.5 font-medium">
        {entries.length
          ? entries.map(([currency, amount]) => formatAmount(amount, currency)).join(" · ")
          : "—"}
      </p>
    </div>
  );
}
