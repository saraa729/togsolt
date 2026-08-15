"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { formatDate, formatMoney, formatSize, imageOrPlaceholder } from "@/lib/format";
import type { Product, ProductReview } from "@/lib/types";
import ContactArtisanButton from "./ContactArtisanButton";
import ProductCard from "./ProductCard";
import { Alert, Spinner, Stars } from "./ui";

export default function ProductDetailClient({ product }: { product: Product }) {
  const { t, locale, currency } = useApp();
  const { user, hasRole, refreshCart } = useAuth();
  const router = useRouter();

  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
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
        locale,
        currency,
      });
      await refreshCart();
      setMessage({ tone: "success", text: t("product.added") });
      return true;
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addAndOpenCart() {
    const added = await addToCart();
    if (added) router.push("/cart");
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

  const availability =
    product.inventoryType === "made_to_order"
      ? `${t("product.leadTime")}: ${product.productionDays || 0} ${t("product.days")}`
      : product.inventoryType === "one_of_one"
        ? t("inv.one_of_one")
        : `${product.stock} ${t("product.stockLeft")}`;

  return (
    <div className="page-wide py-8">
      <nav className="muted mb-6 flex flex-wrap items-center gap-2 text-xs">
        <Link href="/" className="transition-colors hover:text-ink">
          {t("nav.home")}
        </Link>
        <span className="text-line">/</span>
        <Link href="/products" className="transition-colors hover:text-ink">
          {t("nav.products")}
        </Link>
        {product.category ? (
          <>
            <span className="text-line">/</span>
            <Link href={`/products?categoryId=${product.category.id}`} className="transition-colors hover:text-ink">
              {product.category.name}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="mx-auto grid max-w-6xl items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] xl:gap-12">
        {/* Зургийн галерей — багана богино тул том дэлгэц дээр наалдана */}
        <section className="w-full space-y-3 lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-sm">
            <img
              src={imageOrPlaceholder(images[activeImage])}
              alt={product.titleText}
              className="aspect-[5/4] max-h-135 w-full object-contain"
            />
          </div>

          {images.length > 1 ? (
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  aria-label={`${index + 1}`}
                  aria-current={index === activeImage}
                  className={`h-18 w-18 shrink-0 cursor-pointer overflow-hidden rounded-2xl border bg-surface transition ${
                    index === activeImage
                      ? "border-clay ring-2 ring-clay/25"
                      : "border-line opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={imageOrPlaceholder(image)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}

          {product.processMedia?.length ? (
            <div className="rounded-3xl border border-line bg-surface p-4">
              <h3 className="label mb-0">{t("shop.process")}</h3>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {product.processMedia.slice(0, 4).map((media, index) => (
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
        </section>

        <section className="w-full space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge-clay">{t(`inv.${product.inventoryType}`)}</span>
            </div>

            <h1 className="display mt-3 text-[28px] leading-[1.15] tracking-tight sm:text-[34px]">{product.titleText}</h1>

            {product.shop ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Link
                  href={`/shop/${product.shop.slug}`}
                  className="group inline-flex items-center gap-2.5 text-sm transition-colors hover:text-clay-dark"
                >
                  <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-pine text-xs font-semibold text-white">
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
                  <span className="font-medium underline-offset-4 group-hover:underline">
                    {product.shop.displayName}
                  </span>
                  {product.shop.verified ? (
                    <span className="text-emerald-700" title="verified">
                      ✓
                    </span>
                  ) : null}
                  <Stars value={product.shop.stats?.ratingAverage || 0} />
                </Link>
                <ContactArtisanButton
                  sellerId={product.sellerId}
                  next={`/products/${product.id}`}
                  className="btn-secondary btn-sm"
                />
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[32px] leading-none font-semibold tracking-tight">{formatMoney(product.price, locale)}</p>
              <span className="rounded-full bg-paper px-3 py-1 text-[11px] font-medium text-muted">{availability}</span>
            </div>
            {product.internationalPrice && currency === "MNT" ? (
              <p className="muted mt-2 text-xs">
                {t("seller.priceUsd")}: {formatMoney(product.internationalPrice, locale)}
              </p>
            ) : null}

            <p className="mt-4 border-t border-line/70 pt-4 text-sm leading-relaxed whitespace-pre-line text-ink/80">
              {product.descriptionText}
            </p>

            {product.materials?.length || product.techniques?.length || formatSize(product.size) || product.weightGram ? (
              <dl className="mt-4 divide-y divide-line/60 border-t border-line/70 text-xs">
                {product.materials?.length ? <Row label={t("product.materials")} value={formatTerms(product.materials)} /> : null}
                {product.techniques?.length ? <Row label={t("common.technique")} value={formatTerms(product.techniques)} /> : null}
                {formatSize(product.size) ? <Row label={t("product.size")} value={formatSize(product.size)} /> : null}
                {product.weightGram ? <Row label={t("product.weight")} value={`${product.weightGram} g`} /> : null}
              </dl>
            ) : null}

            <div className="mt-5 space-y-3 border-t border-line/70 pt-5">
              {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

              {soldOut ? (
                <Alert tone="warn">{t("product.soldOut")}</Alert>
              ) : (
                <>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-12 shrink-0 items-center gap-1 rounded-full border border-line bg-paper px-1.5">
                      <button
                        type="button"
                        className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-lg leading-none transition-colors hover:bg-surface disabled:opacity-40"
                        disabled={quantity <= 1}
                        onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-semibold tabular-nums">{quantity}</span>
                      <button
                        type="button"
                        className="grid h-9 w-9 cursor-pointer place-items-center rounded-full text-lg leading-none transition-colors hover:bg-surface disabled:opacity-40"
                        disabled={quantity >= maxQuantity}
                        onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      className="btn-primary h-12 flex-1 px-4 text-sm"
                      disabled={busy}
                      onClick={addToCart}
                    >
                      {busy ? <Spinner /> : null}
                      {t("product.addToCart")}
                    </button>

                    <button
                      type="button"
                      className={`grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-full border transition-colors ${
                        favorite ? "border-clay bg-clay-soft text-clay-dark" : "border-line bg-surface text-muted hover:text-clay"
                      }`}
                      onClick={toggleFavorite}
                      aria-pressed={favorite}
                      aria-label={favorite ? t("product.unfavorite") : t("product.favorite")}
                      title={favorite ? t("product.unfavorite") : t("product.favorite")}
                    >
                      <HeartIcon filled={favorite} />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn-dark h-11 w-full text-sm"
                    disabled={busy}
                    onClick={addAndOpenCart}
                  >
                    {t("product.addAndViewCart")}
                  </button>
                </>
              )}

              {!user ? <p className="muted text-center text-xs">{t("product.loginToBuy")}</p> : null}
            </div>
          </div>

          {product.customEnabled ? (
            <div className="rounded-3xl border border-clay/20 bg-clay-soft/35 p-5 text-sm">
              <p className="font-medium">{t("product.customTitle")}</p>
              <p className="muted mt-1 text-xs leading-relaxed">{t("product.customHint")}</p>
              {customOpen ? (
                <div className="mt-3 space-y-3">
                  <textarea
                    className="textarea"
                    value={customText}
                    onChange={(event) => setCustomText(event.target.value)}
                    placeholder={t("custom.messagePlaceholder")}
                  />
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary btn-sm" disabled={busy} onClick={sendCustomRequest}>
                      {busy ? <Spinner /> : null}
                      {t("product.customSend")}
                    </button>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setCustomOpen(false)}>
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn-secondary btn-sm mt-3" onClick={() => setCustomOpen(true)}>
                  {t("product.customTitle")}
                </button>
              )}
            </div>
          ) : null}

          {reportOpen ? (
            <div className="space-y-3 rounded-3xl border border-line bg-surface p-4">
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
            <button type="button" className="btn-ghost btn-sm -ml-3" onClick={() => setReportOpen(true)}>
              ⚑ {t("product.report")}
            </button>
          )}
        </section>
      </div>

      {product.storyText || product.techniqueText || product.shop ? (
        <section className="mx-auto mt-14 grid max-w-6xl gap-4 lg:grid-cols-3">
          {product.storyText ? <DetailBlock title={t("product.story")} body={product.storyText} /> : null}
          {product.techniqueText ? <DetailBlock title={t("product.technique")} body={product.techniqueText} /> : null}
          {product.shop ? (
            <article className="flex flex-col rounded-3xl border border-line bg-surface p-5">
              <h2 className="text-base font-medium">{t("product.aboutArtisan")}</h2>
              <p className="muted mt-2 line-clamp-4 flex-1 text-sm leading-relaxed">{product.shop.storyText}</p>
              <Link href={`/shop/${product.shop.slug}`} className="btn-secondary btn-sm mt-4 self-start">
                {t("product.visitShop")}
              </Link>
            </article>
          ) : null}
        </section>
      ) : null}

      <ProductReviews productId={product.id} summary={product.reviewSummary} />

      {product.relatedProducts?.length ? <RelatedProducts product={product} className="mt-16" /> : null}
    </div>
  );
}

function RelatedProducts({ product, className = "" }: { product: Product; className?: string }) {
  const { t } = useApp();

  return (
    <section className={`scroll-mt-24 ${className}`}>
      <h2 className="section-title pb-5">{t("product.related")}</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {product.relatedProducts?.slice(0, 4).map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    </section>
  );
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-3xl border border-line bg-surface p-5">
      <h2 className="text-base font-medium">{title}</h2>
      <p className="muted mt-2 text-sm leading-relaxed whitespace-pre-line">{body}</p>
    </article>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-5 w-5"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20.5 4.4 13a4.7 4.7 0 0 1 0-6.6 4.6 4.6 0 0 1 6.5 0l1.1 1.1 1.1-1.1a4.6 4.6 0 0 1 6.5 0 4.7 4.7 0 0 1 0 6.6Z" />
    </svg>
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
    <section className="mt-16 scroll-mt-24">
      <div className="flex flex-wrap items-baseline gap-3 pb-5">
        <h2 className="section-title">{t("product.reviews")}</h2>
        <span className="flex items-center gap-2 text-sm text-muted">
          <Stars value={summary?.average || 0} />
          {t("product.reviewCount", { count: reviews.length })}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => (
          <article key={review.id} className="rounded-3xl border border-line/70 bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{review.reviewerName}</span>
              <Stars value={review.rating} />
            </div>
            {review.comment ? <p className="mt-2 text-sm leading-relaxed">{review.comment}</p> : null}
            <p className="muted mt-3 text-xs">{formatDate(review.createdAt, locale)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[118px_1fr] sm:gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

function formatTerms(values: string[]): string {
  return values.map((value) => formatTerm(value)).join(", ");
}

function formatTerm(value: string): string {
  const text = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : value;
}
