"use client";

import DashboardNav from "@/components/DashboardNav";
import RequireAuth from "@/components/RequireAuth";
import { useApp } from "@/lib/app-context";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useApp();

  const items = [
    { href: "/admin", label: t("admin.overview") },
    { href: "/admin/verifications", label: t("admin.verifications") },
    { href: "/admin/products", label: t("admin.products") },
    { href: "/admin/orders", label: t("admin.orders") },
    { href: "/admin/disputes", label: t("admin.disputes") },
    { href: "/admin/reports", label: t("admin.reports") },
    { href: "/admin/payouts", label: t("admin.payouts") },
    { href: "/admin/users", label: t("admin.users") },
    { href: "/admin/settings", label: t("admin.settings") },
  ];

  return (
    <RequireAuth role="admin">
      <div className="page-wide grid gap-6 py-10 lg:grid-cols-[220px_1fr]">
        <DashboardNav title={t("admin.title")} items={items} />
        <div className="min-w-0">{children}</div>
      </div>
    </RequireAuth>
  );
}
