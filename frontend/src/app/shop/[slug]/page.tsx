import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ContactArtisanButton from "@/components/ContactArtisanButton";
import ProductCard from "@/components/ProductCard";
import ShopFollowButton from "@/components/ShopFollowButton";
import { Stars } from "@/components/ui";
import { serverGet } from "@/lib/api";
import { demoArtisanImage } from "@/lib/demo-images";
import { imageOrPlaceholder, initials } from "@/lib/format";
import { translate } from "@/lib/i18n";
import { readPreferences } from "@/lib/prefs";
import { shopDisplayName, shopLocationText } from "@/lib/shop-display";
import type { Shop } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { slug: string };

async function loadShop(slug: string) {
  const { locale, currency } = await readPreferences();
  const data = await serverGet<{ shop: Shop }>(`/shop/${slug}`, { locale, currency });
  return data?.shop ?? null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const shop = await loadShop(slug);
  if (!shop) return { title: "Дэлгүүр олдсонгүй / Shop not found" };
  const displayName = shopDisplayName(shop);
  const demoImage = demoArtisanImage(shop);
  const heroImage = demoImage || shop.bannerUrl;
  return {
    title: `${displayName} | ExpoCraft`,
    description: (shop.seo?.description || shop.storyText || "").slice(0, 180),
    alternates: { canonical: `/shop/${shop.slug}` },
    openGraph: {
      title: displayName,
      description: (shop.storyText || "").slice(0, 180),
      images: heroImage ? [{ url: heroImage }] : undefined,
    },
  };
}

export default async function ShopPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const { locale } = await readPreferences();
  const t = (key: string) => translate(locale, key);
  const shop = await loadShop(slug);
  if (!shop) notFound();

  const demoImage = demoArtisanImage(shop);
  const heroImage = demoImage || shop.bannerUrl;
  const portrait = demoImage || shop.artisanProfile?.portraitUrl || shop.logoUrl;
  const products = shop.products ?? [];
  const displayName = shopDisplayName(shop);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: displayName,
    description: shop.storyText,
    image: heroImage || shop.logoUrl || undefined,
    address: { "@type": "PostalAddress", addressLocality: shop.city, addressRegion: shop.province, addressCountry: "MN" },
    aggregateRating: shop.stats?.ratingCount
      ? { "@type": "AggregateRating", ratingValue: shop.stats.ratingAverage, reviewCount: shop.stats.ratingCount }
      : undefined,
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="h-48 w-full bg-clay-soft sm:h-64">
        {heroImage ? (
          <img src={imageOrPlaceholder(heroImage)} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>

      <div className="page-wide">
        <div className="-mt-14 flex flex-wrap items-end gap-5 pb-8">
          <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-3xl border-4 border-paper bg-pine text-2xl font-semibold text-white">
            {portrait ? (
              <img src={imageOrPlaceholder(portrait)} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              initials(displayName)
            )}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{displayName}</h1>
              {shop.verified ? (
                <span className="badge bg-emerald-50 text-emerald-700">✓ {t("shop.verified")}</span>
              ) : (
                <span className="badge-gold">{t("shop.pending")}</span>
              )}
            </div>
            <p className="muted mt-1">
              {shopLocationText(shop)}
              {shop.artisanProfile?.makerName ? ` · ${shop.artisanProfile.makerName}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <ContactArtisanButton sellerId={shop.sellerId} next={`/shop/${shop.slug}`} />
            <ShopFollowButton shopId={shop.id} slug={shop.slug} />
          </div>
        </div>

        <div className="grid gap-4 pb-10 sm:grid-cols-4">
          <div className="card-pad">
            <p className="text-xs text-muted">{t("shop.rating")}</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
              {(shop.stats?.ratingAverage ?? 0).toFixed(1)}
              <Stars value={shop.stats?.ratingAverage || 0} />
            </p>
            <p className="muted text-xs">{shop.stats?.ratingCount || 0} үнэлгээ</p>
          </div>
          <div className="card-pad">
            <p className="text-xs text-muted">{t("shop.sales")}</p>
            <p className="mt-1 text-lg font-semibold">{shop.stats?.salesCount ?? 0}</p>
          </div>
          <div className="card-pad">
            <p className="text-xs text-muted">{t("shop.responseTime")}</p>
            <p className="mt-1 text-lg font-semibold">
              {shop.stats?.responseTimeHours ? `${shop.stats.responseTimeHours}${t("shop.hours")}` : "—"}
            </p>
          </div>
          <div className="card-pad">
            <p className="text-xs text-muted">{t("shop.products")}</p>
            <p className="mt-1 text-lg font-semibold">{shop.productCount ?? products.length}</p>
          </div>
        </div>

        <div className="grid gap-8 pb-14 lg:grid-cols-[1fr_320px]">
          <div>
            <h2 className="section-title pb-4">{t("shop.products")}</h2>
            {products.length === 0 ? (
              <div className="card grid place-items-center px-6 py-16 text-center">
                <p className="muted">{t("common.empty")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} compact />
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            {shop.storyText ? (
              <section className="card-pad">
                <h3 className="font-medium">{t("shop.story")}</h3>
                <p className="muted mt-2 whitespace-pre-line">{shop.storyText}</p>
              </section>
            ) : null}

            {shop.artisanProfile?.processText ? (
              <section className="card-pad">
                <h3 className="font-medium">{t("shop.process")}</h3>
                <p className="muted mt-2 whitespace-pre-line">{shop.artisanProfile.processText}</p>
              </section>
            ) : null}

            {shop.processMedia?.length ? (
              <section className="card-pad">
                <h3 className="font-medium">{t("shop.process")}</h3>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {shop.processMedia.map((media, index) => (
                    <img
                      key={index}
                      src={imageOrPlaceholder(media.url)}
                      alt={media.captionText || ""}
                      loading="lazy"
                      className="aspect-square w-full rounded-xl object-cover"
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {shop.materials?.length ? (
              <section className="card-pad">
                <h3 className="font-medium">{t("product.materials")}</h3>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {shop.materials.map((material) => (
                    <span key={material} className="badge-neutral">
                      {material}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {shop.contact ? (
              <section className="card-pad">
                <h3 className="font-medium">{t("shop.contact")}</h3>
                <ul className="muted mt-2 space-y-1">
                  {shop.contact.phone ? <li>☎ {shop.contact.phone}</li> : null}
                  {shop.contact.email ? <li>✉ {shop.contact.email}</li> : null}
                  {shop.contact.facebook ? <li>f {shop.contact.facebook}</li> : null}
                  {shop.contact.instagram ? <li>ig {shop.contact.instagram}</li> : null}
                </ul>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
