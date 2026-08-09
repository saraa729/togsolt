"use client";

import ProductForm from "@/components/ProductForm";
import { Alert } from "@/components/ui";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";

export default function NewProductPage() {
  const { t } = useApp();
  const { shop } = useAuth();

  if (!shop) return <Alert tone="warn">{t("seller.createShopHint")}</Alert>;
  if (shop.status !== "verified") return <Alert tone="warn">{t("seller.noVerifiedYet")}</Alert>;

  return <ProductForm />;
}
