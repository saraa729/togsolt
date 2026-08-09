"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { formatDate, formatMoney, formatSize, imageOrPlaceholder } from "@/lib/format";
import type { Product, ProductReview } from "@/lib/types";
import ProductCard from "./ProductCard";
import { Alert, Spinner, Stars } from "./ui";

export default function ProductDetailClient({ product }: { product: Product }) {
  const { t, locale, currency } = useApp();
  const { user, hasRole, refreshCart } = useAuth();
  const router = useRouter();

  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [shippingOption, setShippingOption] = useState(product.shippingInfo?.[0]?.code || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [favorite, setFavorite] = useState(false);

  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const images = product.images?.length ? product.images : [""];
  const isBuyer = hasRole("buyer");
  const soldOut = product.status === "sold" || (product.inventoryType !== "made_to_order" && product.stock <= 0);
  const maxQuantity = product.inventoryType === "one_of_one" ? 1 : product.inventoryType === "made_to_order" ? 99 : product.stock;

  useEffect(() => {
    if (!isBuyer) return;
    api
      .get<{ products: Product[] }>("/favorites/products", { query: { locale, currency } })
      .then((data) => setFavorite(data.products.some((item) => item.id === product.id)))
      .catch(() => undefined);
  }, [isBuyer, product.id, locale, currency]);

  async function addToCart() {
    if (!user) return router.push(`/login?next=/products/${product.id}`);
    setBusy(true);
    setMessage(null);
    try {
      await api.post("/cart/items", {
        productId: product.id,
        quantity,
        shippingOption: shippingOption || undefined,
        locale,
        currency,
      });
      await refreshCart();
      setMessage({ tone: "success", text: t("product.added") });
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function buyNow() {
    await addToCart();
    router.push("/cart");
  }

  async function toggleFavorite() {
    if (!user) return router.push(`/login?next=/products/${product.id}`);
    try {
      if (favorite) await api.del(`/favorites/products/${product.id}`);
      else await api.post(`/favorites/products/${product.id}`);
      setFavorite(!favorite);
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    }
  }

  async function sendCustomRequest() {
    if (!user) return router.push(`/login?next=/products/${product.id}`);
    if (!customText.trim()) return;
    setBusy(true);
    try {
      await api.post("/custom-requests", { productId: product.id, message: customText.trim() });
      setCustomText("");
      setCustomOpen(false);
      setMessage({ tone: "success", text: t("product.customSent") });
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function sendReport() {
    if (!user) return router.push(`/login?next=/products/${product.id}`);
    if (!reportReason.trim()) return;
    setBusy(true);
    try {
      await api.post("/reports", { entityType: "product", entityId: product.id, reason: reportReason.trim() });
      setReportReason("");
      setReportOpen(false);
      setMessage({ tone: "success", text: t("product.reportSent") });
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-wide py-10">
      <nav className="muted mb-6 flex flex-wrap items-center gap-2 text-xs">
        <Link href="/" className="hover:text-ink">
          {t("nav.home")}
        </Link>
        <span>/</span>
        <Link href="/products" className="hover:text-ink">
          {t("nav.products")}
        </Link>
        {product.category ? (
          <>
            <span>/</span>
            <Link href={`/products?categoryId=${product.category.id}`} className="hover:text-ink">
              {product.category.name}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Gallery */}
        <div>
          <div className="card overflow-hidden">
            <img
              src={imageOrPlaceholder(images[activeImage])}
              alt={product.titleText}
              className="aspect-square w-full object-cover"
            />
          </div>
          {images.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={`h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 ${
                    index === activeImage ? "border-clay" : "border-line"
                  }`}
                >
                  <img src={imageOrPlaceholder(image)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}

          {product.processMedia?.length ? (
            <div className="mt-6">
              <h3 className="font-medium">{t("shop.process")}</h3>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {product.processMedia.map((media, index) => (
                  <img
                    key={index}
                    src={imageOrPlaceholder(media.url)}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full rounded-xl object-cover"
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Info */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-clay">{t(`inv.${product.inventoryType}`)}</span>
            {product.shipsInternationally ? <span className="badge-pine">✈ {t("home.trustGlobal")}</span> : null}
          </div>

          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{product.titleText}</h1>

          {product.shop ? (
            <Link href={`/shop/${product.shop.slug}`} className="mt-3 inline-flex items-center gap-2 text-sm">
              <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-pine text-xs font-semibold text-white">
                {product.shop.artisanProfile?.portraitUrl ? (
                  <img
                    src={imageOrPlaceholder(product.shop.artisanProfile.portraitUrl)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (product.shop.displayName || "?").slice(0, 1)
                )}
              </span>
              <span className="font-medium hover:underline">{product.shop.displayName}</span>
              {product.shop.verified ? <span className="badge bg-emerald-50 text-emerald-700">✓</span> : null}
              <Stars value={product.shop.stats?.ratingAverage || 0} />
            </Link>
          ) : null}

          <p className="mt-5 text-3xl font-semibold">{formatMoney(product.price, locale)}</p>
          {product.internationalPrice && currency === "MNT" ? (
            <p className="muted mt-1 text-xs">
              {t("seller.priceUsd")}: {formatMoney(product.internationalPrice, locale)}
            </p>
          ) : null}

          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">{product.descriptionText}</p>

          <div className="mt-5 grid gap-2 text-sm">
            {product.inventoryType === "made_to_order" ? (
              <Row label={t("product.leadTime")} value={`${product.productionDays || 0} ${t("product.days")}`} />
            ) : product.inventoryType === "one_of_one" ? (
              <Row label={t("products.filters.inventory")} value={t("inv.one_of_one")} />
            ) : (
              <Row label={t("products.filters.inventory")} value={`${product.stock} ${t("product.stockLeft")}`} />
            )}
            {product.materials?.length ? <Row label={t("product.materials")} value={product.materials.join(", ")} /> : null}
            {product.techniques?.length ? <Row label={t("common.technique")} value={product.techniques.join(", ")} /> : null}
            {formatSize(product.size) ? <Row label={t("product.size")} value={formatSize(product.size)} /> : null}
            {product.weightGram ? <Row label={t("product.weight")} value={`${product.weightGram} g`} /> : null}
          </div>

          {/* Shipping */}
          {product.shippingInfo?.length ? (
            <div className="mt-6">
              <p className="label">{t("product.shipping")}</p>
              <div className="grid gap-2">
                {product.shippingInfo.map((option) => (
                  <label
                    key={option.code}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors ${
                      shippingOption === option.code ? "border-clay bg-clay-soft/40" : "border-line"
                    }`}
                  >
                    <input
                      type="radio"
                      name="shipping"
                      className="mt-0.5 h-4 w-4 accent-[var(--color-clay)]"
                      checked={shippingOption === option.code}
                      onChange={() => setShippingOption(option.code)}
                    />
                    <span>
                      <span className="block font-medium">{option.label}</span>
                      {option.customsNote ? <span className="muted block text-xs">{option.customsNote}</span> : null}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {/* Actions */}
          <div className="mt-6 space-y-3">
            {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

            {soldOut ? (
              <Alert tone="warn">{t("product.soldOut")}</Alert>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center rounded-full border border-line bg-surface">
                  <button
                    type="button"
                    className="cursor-pointer px-3 py-2 text-lg leading-none"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm">{quantity}</span>
                  <button
                    type="button"
                    className="cursor-pointer px-3 py-2 text-lg leading-none disabled:opacity-40"
                    disabled={quantity >= maxQuantity}
                    onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
                  >
                    +
                  </button>
                </div>
                <button type="button" className="btn-primary px-6" disabled={busy} onClick={addToCart}>
                  {busy ? <Spinner /> : null}
                  {t("product.addToCart")}
                </button>
                <button type="button" className="btn-dark px-6" disabled={busy} onClick={buyNow}>
                  {t("product.buyNow")}
                </button>
                <button type="button" className="btn-secondary" onClick={toggleFavorite}>
                  {favorite ? "♥" : "♡"} {favorite ? t("product.unfavorite") : t("product.favorite")}
                </button>
              </div>
            )}

            {!user ? <p className="muted text-xs">{t("product.loginToBuy")}</p> : null}
          </div>

          {/* Custom order */}
          {product.customEnabled ? (
            <div className="card-pad mt-6 bg-clay-soft/40">
              <p className="font-medium">{t("product.customTitle")}</p>
              <p className="muted mt-1">{t("product.customHint")}</p>
              {customOpen ? (
                <div className="mt-3 space-y-3">
                  <textarea
                    className="textarea"
                    value={customText}
                    onChange={(event) => setCustomText(event.target.value)}
                    placeholder={t("custom.messagePlaceholder")}
                  />
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary" disabled={busy} onClick={sendCustomRequest}>
                      {busy ? <Spinner /> : null}
                      {t("product.customSend")}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setCustomOpen(false)}>
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn-secondary mt-3" onClick={() => setCustomOpen(true)}>
                  {t("product.customTitle")}
                </button>
              )}
            </div>
          ) : null}

          {/* Story / technique */}
          {product.storyText ? (
            <section className="mt-8">
              <h2 className="font-medium">{t("product.story")}</h2>
              <p className="muted mt-2 whitespace-pre-line">{product.storyText}</p>
            </section>
          ) : null}
          {product.techniqueText ? (
            <section className="mt-6">
              <h2 className="font-medium">{t("product.technique")}</h2>
              <p className="muted mt-2 whitespace-pre-line">{product.techniqueText}</p>
            </section>
          ) : null}

          {/* Artisan */}
          {product.shop ? (
            <section className="card-pad mt-8">
              <h2 className="font-medium">{t("product.aboutArtisan")}</h2>
              <p className="muted mt-2 line-clamp-4">{product.shop.storyText}</p>
              <Link href={`/shop/${product.shop.slug}`} className="btn-secondary mt-4">
                {t("product.visitShop")}
              </Link>
            </section>
          ) : null}

          {/* Report */}
          <div className="mt-6">
            {reportOpen ? (
              <div className="card-pad space-y-3">
                <input
                  className="input"
                  placeholder={t("common.reason")}
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value)}
                />
                <div className="flex gap-2">
                  <button type="button" className="btn-danger btn-sm" disabled={busy} onClick={sendReport}>
                    {t("common.send")}
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setReportOpen(false)}>
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setReportOpen(true)}>
                ⚑ {t("product.report")}
              </button>
            )}
          </div>
        </div>
      </div>

      <ProductReviews productId={product.id} summary={product.reviewSummary} />

      {product.relatedProducts?.length ? (
        <section className="mt-16">
          <h2 className="section-title pb-5">{t("product.related")}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {product.relatedProducts.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Худалдан авагчдын сэтгэгдэл.
 *
 * Жагсаалтын хариу хөнгөн байхын тулд бүтээгдэхүүн дээр зөвхөн хураангуй ирдэг —
 * бичвэрийг тусад нь `/products/:id/reviews`-аас татна. Сэтгэгдэлгүй үед
 * хэсгийг огт үзүүлэхгүй (хоосон блок харуулахгүй).
 */
function ProductReviews({
  productId,
  summary,
}: {
  productId: string;
  summary?: { count: number; average: number };
}) {
  const { t, locale } = useApp();
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get<{ reviews: ProductReview[] }>(`/products/${productId}/reviews`, { token: null })
      .then((data) => {
        if (active) setReviews(data.reviews || []);
      })
      .catch(() => {
        if (active) setReviews([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId]);

  if (loading && !summary?.count) return null;
  if (!reviews.length) return null;

  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-baseline gap-3 pb-5">
        <h2 className="section-title">{t("product.reviews")}</h2>
        <span className="flex items-center gap-2 text-sm text-muted">
          <Stars value={summary?.average || 0} />
          {t("product.reviewCount", { count: reviews.length })}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {reviews.map((review) => (
          <article key={review.id} className="card-pad">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{review.reviewerName}</span>
              <Stars value={review.rating} />
            </div>
            {review.comment ? <p className="mt-2 text-sm leading-relaxed">{review.comment}</p> : null}
            <p className="muted mt-2 text-xs">{formatDate(review.createdAt, locale)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-line/60 pb-2">
      <span className="w-40 shrink-0 text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
