"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { Alert, EmptyState, PageHeader, Spinner, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Contract } from "@/lib/types";

export default function ContractsPage() {
  return (
    <RequireAuth>
      <ContractsView />
    </RequireAuth>
  );
}

function ContractsView() {
  const { t, locale } = useApp();
  const { user } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ contracts: Contract[] }>("/contracts");
      setContracts(data.contracts || []);
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function accept(contractId: string) {
    setBusy(contractId);
    setMessage(null);
    try {
      await api.post(`/contracts/${contractId}/accept`);
      setMessage({ tone: "success", text: t("contract.accepted") });
      await load();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="card h-64 skeleton" />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title={t("contract.mine")} />
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      {contracts.length === 0 ? (
        <EmptyState title={t("contract.empty")} actionLabel={t("nav.custom")} actionHref="/custom-requests" />
      ) : (
        <div className="mt-4 space-y-4">
          {contracts.map((contract) => {
            // Зөвхөн худалдан авагч, зөвхөн хүлээгдэж буй гэрээг зөвшөөрнө.
            const canAccept = contract.buyerId === user?.id && contract.status !== "accepted";

            return (
              <article key={contract.id} className="card-pad space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{t("contract.title")}</p>
                    <p className="muted mt-0.5 text-xs">{formatDateTime(contract.createdAt, locale)}</p>
                  </div>
                  <StatusPill status={contract.status} label={t(`contract.status.${contract.status}`)} />
                </div>

                <div>
                  <p className="label">{t("contract.scope")}</p>
                  <p className="mt-1 text-sm">{contract.scope}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="label">{t("contract.total")}</p>
                    <p className="mt-1 font-medium">{formatMoney(contract.total, locale)}</p>
                  </div>
                  <div>
                    <p className="label">{t("contract.leadDays")}</p>
                    <p className="mt-1 font-medium">{t("contract.days", { count: contract.leadDays })}</p>
                  </div>
                </div>

                {contract.depositSchedule?.length ? (
                  <div>
                    <p className="label">{t("contract.schedule")}</p>
                    <ul className="mt-2 space-y-1.5">
                      {contract.depositSchedule.map((milestone) => (
                        <li
                          key={milestone.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm"
                        >
                          <span>{milestone.label}</span>
                          <span className="flex items-center gap-3">
                            <span className="muted">
                              {milestone.percent}% ·{" "}
                              {formatMoney(
                                {
                                  amount: Math.round((contract.total.amount * milestone.percent) / 100),
                                  currency: contract.total.currency,
                                },
                                locale
                              )}
                            </span>
                            <StatusPill
                              status={milestone.status === "paid" ? "released" : "held"}
                              label={t(`contract.milestone.${milestone.status}`, milestone.status)}
                            />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {canAccept ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busy === contract.id}
                      onClick={() => accept(contract.id)}
                    >
                      {busy === contract.id ? <Spinner /> : null}
                      {t("contract.accept")}
                    </button>
                    <p className="muted text-xs">{t("contract.payNote")}</p>
                  </div>
                ) : contract.status === "accepted" ? (
                  // Зөвшөөрсөн — одоо сагснаас төлнө.
                  <Link href="/custom-requests" className="btn-secondary">
                    {t("custom.addToCart")}
                  </Link>
                ) : contract.orderId ? (
                  <Link href="/orders" className="btn-secondary">
                    {t("contract.viewOrder")}
                  </Link>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
