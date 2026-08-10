"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ProductForm from "@/components/ProductForm";
import { Alert } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import type { Product } from "@/lib/types";

export default function EditProductPage() {
  const { t, locale, currency } = useApp();
  const params = useParams<{ id: string }>();
  const productId = typeof params?.id === "string" ? params.id : "";
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) {
      setProduct(null);
      setLoading(false);
      return;
    }
    api
      .get<{ products: Product[] }>("/seller/products", { query: { locale, currency } })
      .then((data) => setProduct((data.products || []).find((item) => item.id === productId) || null))
      .catch((caught) => setError(errorMessage(caught)))
      .finally(() => setLoading(false));
  }, [productId, locale, currency]);

  if (loading) return <div className="card h-96 skeleton" />;
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!product) return <Alert tone="warn">{t("common.empty")}</Alert>;

  return <ProductForm product={product} />;
}
