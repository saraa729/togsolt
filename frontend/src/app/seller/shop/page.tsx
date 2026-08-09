"use client";

import ShopForm from "@/components/ShopForm";
import { EmptyState } from "@/components/ui";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";

export default function SellerShopPage() {
  const { t } = useApp();
  const { shop } = useAuth();

  if (!shop) {
    return (
      <div className="space-y-4">
        <EmptyState title={t("seller.createShopTitle")} description={t("seller.createShopHint")} />
        <ShopForm onSaved={() => window.location.reload()} />
      </div>
    );
  }

  return <ShopForm shop={shop} />;
}
