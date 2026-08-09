"use client";

import DashboardNav from "@/components/DashboardNav";
import RequireAuth from "@/components/RequireAuth";
import { useApp } from "@/lib/app-context";

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const { t } = useApp();

  const items = [
    { href: "/seller", label: t("seller.overview") },
    { href: "/seller/products", label: t("seller.myProducts") },
    { href: "/seller/products/new", label: t("seller.newProduct") },
    { href: "/seller/orders", label: t("seller.orders") },
    { href: "/seller/custom-requests", label: t("seller.customRequests") },
    { href: "/seller/coupons", label: t("seller.coupons") },
    { href: "/seller/balance", label: t("seller.balance") },
    { href: "/seller/shop", label: t("seller.myShop") },
  ];

  return (
    <RequireAuth role="seller">
      <div className="page-wide grid gap-6 py-10 lg:grid-cols-[220px_1fr]">
        <DashboardNav title={t("seller.title")} items={items} />
        <div className="min-w-0">{children}</div>
      </div>
    </RequireAuth>
  );
}
