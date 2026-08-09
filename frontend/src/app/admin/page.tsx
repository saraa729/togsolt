"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, PageHeader, Stat } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatAmount } from "@/lib/format";
import type { AdminOverview } from "@/lib/types";

const ACTIONS = [
  { href: "/admin/verifications", labelKey: "admin.verifications", color: "bg-sand/20 text-sand" },
  { href: "/admin/products", labelKey: "admin.products", color: "bg-clay-soft text-clay-dark" },
  { href: "/admin/orders", labelKey: "admin.orders", color: "bg-pine-soft text-pine" },
  { href: "/admin/disputes", labelKey: "admin.disputes", color: "bg-amber-100 text-amber-900" },
  { href: "/admin/reports", labelKey: "admin.reports", color: "bg-cream text-night" },
  { href: "/admin/payouts", labelKey: "admin.payouts", color: "bg-gold-soft text-gold" },
  { href: "/admin/users", labelKey: "admin.users", color: "bg-paper text-ink" },
  { href: "/admin/settings", labelKey: "admin.settings", color: "bg-white text-ink" },
];

export default function AdminOverviewPage() {
  const { t } = useApp();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<AdminOverview>("/admin/reports/overview")
      .then(setOverview)
      .catch((caught) => setError(errorMessage(caught)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="card h-96 skeleton" />;
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!overview) return null;

  const funnel = overview.funnel;
  const maxFunnel = Math.max(funnel.viewed, funnel.cart, funnel.paid, funnel.completed, 1);

  return (
    <div className="space-y-8">
      <PageHeader title={t("admin.title")} subtitle={t("admin.subtitle")} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("admin.gmv")} value={formatAmount(overview.grossByCurrency?.MNT, "MNT")} hint={formatAmount(overview.grossByCurrency?.USD, "USD")} />
        <Stat
          label={t("admin.commissionIncome")}
          value={formatAmount(overview.commissionByCurrency?.MNT, "MNT")}
          hint={formatAmount(overview.commissionByCurrency?.USD, "USD")}
        />
        <Stat label={t("common.order")} value={overview.orders} hint={`${overview.customRequests} ${t("custom.title")}`} />
        <Stat label={t("nav.artisans")} value={overview.verifiedShops} hint={`${overview.sellers} ${t("seller.title")}`} />
      </section>

      <section className="rounded-3xl border border-line bg-surface p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-muted">{t("admin.quickActions")}</p>
            <h2 className="text-xl font-semibold tracking-tight">{t("admin.actionPanel")}</h2>
          </div>
          <Link href="/admin/settings" className="btn-secondary">
            {t("admin.manageSettings")}
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`rounded-3xl border border-line p-4 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${action.color}`}
            >
              {t(action.labelKey)}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="grid gap-4">
          <section className="card-pad">
            <h2 className="font-medium">{t("admin.funnel")}</h2>
            <div className="mt-4 space-y-3">
              {(
                [
                  ["viewed", funnel.viewed],
                  ["cart", funnel.cart],
                  ["paid", funnel.paid],
                  ["completed", funnel.completed],
                ] as const
              ).map(([key, value]) => (
                <div key={key}>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted uppercase tracking-[0.18em]">{t(`admin.funnelStep.${key}`)}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-paper">
                    <div className="h-full rounded-full bg-clay" style={{ width: `${(value / maxFunnel) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card-pad">
            <h2 className="font-medium">{t("admin.metrics")}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-paper p-4">
                <p className="text-xs text-muted">{t("admin.activeDisputes")}</p>
                <p className="mt-2 text-2xl font-semibold">{overview.activeDisputes}</p>
              </div>
              <div className="rounded-2xl bg-paper p-4">
                <p className="text-xs text-muted">{t("admin.openReports")}</p>
                <p className="mt-2 text-2xl font-semibold">{overview.openReports}</p>
              </div>
              <div className="rounded-2xl bg-paper p-4">
                <p className="text-xs text-muted">{t("admin.pendingPayouts")}</p>
                <p className="mt-2 text-2xl font-semibold">{overview.pendingPayoutItems}</p>
              </div>
              <div className="rounded-2xl bg-paper p-4">
                <p className="text-xs text-muted">{t("admin.customRequests")}</p>
                <p className="mt-2 text-2xl font-semibold">{overview.customRequests}</p>
              </div>
            </div>
          </section>
        </div>

        <section className="card-pad">
          <h2 className="font-medium">{t("admin.segments")}</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl bg-paper p-4">
              <p className="text-xs text-muted">{t("admin.domesticOrders")}</p>
              <p className="mt-2 text-2xl font-semibold">{overview.segmentBreakdown.domesticOrders}</p>
            </div>
            <div className="rounded-2xl bg-paper p-4">
              <p className="text-xs text-muted">{t("admin.internationalOrders")}</p>
              <p className="mt-2 text-2xl font-semibold">{overview.segmentBreakdown.internationalOrders}</p>
            </div>
          </div>

          <div className="mt-6 border-t border-line pt-4 text-sm">
            <h3 className="font-medium">{t("admin.ledgerTitle")}</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <LedgerRow label={t("seller.escrowHeldLabel")} values={overview.balances?.escrowHeld} />
              <LedgerRow label={t("seller.releasedLabel")} values={overview.balances?.sellerReleased} />
              <LedgerRow label={t("seller.commissionLabel")} values={overview.balances?.platformCommission} />
              <LedgerRow label={t("orders.escrowRefunded")} values={overview.balances?.refunds} />
            </dl>
            <p className="muted mt-3 text-xs">
              {t("admin.pendingPayouts")}: {overview.pendingPayoutItems}
            </p>
          </div>
        </section>
      </section>
    </div>
  );
}

function LedgerRow({ label, values }: { label: string; values?: Record<string, number> }) {
  const entries = Object.entries(values || {});
  return (
    <div className="flex justify-between gap-3 border-b border-line/60 pb-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">
        {entries.length === 0 ? "—" : entries.map(([currency, amount]) => formatAmount(amount, currency)).join(" · ")}
      </dd>
    </div>
  );
}
