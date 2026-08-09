import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductDetailClient from "@/components/ProductDetailClient";
import { serverGet } from "@/lib/api";
import { readPreferences } from "@/lib/prefs";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { id: string };

async function loadProduct(id: string) {
  const { locale, currency } = await readPreferences();
  const data = await serverGet<{ product: Product }>(`/products/${id}`, { locale, currency });
  return data?.product ?? null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const product = await loadProduct(id);
  if (!product) return { title: "Бүтээл олдсонгүй / Product not found" };
  const description = (product.descriptionText || product.storyText || "").slice(0, 180);
  return {
    title: `${product.titleText} — ${product.shop?.displayName ?? "ExpoCraft"}`,
    description,
    alternates: { canonical: `/products/${product.id}` },
    openGraph: {
      title: product.titleText,
      description,
      images: product.images?.length ? [{ url: product.images[0] }] : undefined,
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const product = await loadProduct(id);
  if (!product) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.titleText,
    description: product.descriptionText,
    image: product.images,
    material: product.materials?.join(", "),
    brand: { "@type": "Brand", name: product.shop?.displayName },
    offers: {
      "@type": "Offer",
      price: product.price.amount,
      priceCurrency: product.price.currency,
      availability: product.status === "active" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductDetailClient product={product} />
    </>
  );
}
