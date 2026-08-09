"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, EmptyState, Spinner, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatDateTime } from "@/lib/format";
import type { Report } from "@/lib/types";

const FILTERS = ["", "open", "reviewing", "resolved", "dismissed"] as const;

export default function AdminReportsPage() {
  const { t, locale } = useApp();
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ reports: Report[] }>("/admin/reports", {
        query: status ? { status } : {},
      });
      setReports((data.reports || []).slice().reverse());
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function moderate(reportId: string, nextStatus: string, action?: string) {
    setBusy(reportId);
    try {
      await api.patch(`/admin/reports/${reportId}`, { status: nextStatus, action });
      setMessage({ tone: "success", text: t("common.saved") });
      await load();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.reports")}</h1>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <button
            key={value || "all"}
            type="button"
            className={status === value ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
            onClick={() => setStatus(value)}
          >
            {value === "" ? t("common.all") : value}
          </button>
        ))}
      </div>

      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      {loading ? (
        <div className="card h-64 skeleton" />
      ) : reports.length === 0 ? (
        <EmptyState title={t("common.empty")} />
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <article key={report.id} className="card-pad space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{report.reason}</p>
                  <p className="muted text-xs">
                    {report.entityType} · {report.entityId} · {report.reporter?.email} ·{" "}
                    {formatDateTime(report.createdAt, locale)}
                  </p>
                  {report.product ? <p className="muted mt-1 text-xs">→ {report.product.titleText}</p> : null}
                  {report.details ? <p className="muted mt-2">{report.details}</p> : null}
                </div>
                <StatusPill status={report.status} />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={busy === report.id}
                  onClick={() => moderate(report.id, "reviewing")}
                >
                  {busy === report.id ? <Spinner className="h-3 w-3" /> : null}
                  reviewing
                </button>
                <button
                  type="button"
                  className="btn-danger btn-sm"
                  disabled={busy === report.id}
                  onClick={() => moderate(report.id, "resolved", "hide_product")}
                >
                  {t("admin.hideProduct")}
                </button>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={busy === report.id}
                  onClick={() => moderate(report.id, "resolved")}
                >
                  resolved
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  disabled={busy === report.id}
                  onClick={() => moderate(report.id, "dismissed")}
                >
                  {t("admin.dismiss")}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
