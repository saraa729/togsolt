import Link from "next/link";
import ArtisanRotator from "@/components/ArtisanRotator";
import CraftShowcase from "@/components/CraftShowcase";
import LandingShell from "@/components/LandingShell";
import { serverGet } from "@/lib/api";
import { demoHomePayload } from "@/lib/demo-content";
import { demoArtisanImage, LANDING_HERO_IMAGE } from "@/lib/demo-images";
import { resolveImageUrl } from "@/lib/format";
import { translate } from "@/lib/i18n";
import { readPreferences } from "@/lib/prefs";
import { shopCraftLine, shopDisplayName, shopLocationText } from "@/lib/shop-display";
import type { HomePayload, Product, Shop } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Танилцуулга хуудас (нэвтрээгүй зочин). Худалдааны нүүр биш — платформ юу болох,
 * хэрхэн ажилладгийг өгүүлж, нэвтрэх рүү хөтөлнө. Нэвтэрсэн хэрэглэгч `/home` руу орно.
 */
export default async function LandingPage() {
  const { locale, currency } = await readPreferences();
  const t = (key: string) => translate(locale, key);

  const [home, catalog] = await Promise.all([
    serverGet<HomePayload>("/home", { locale, currency }),
    serverGet<{ products: Product[] }>("/products", { locale, currency }),
  ]);

  const fallback = demoHomePayload(locale, currency);
  const artisans = home?.newArtisans?.length ? home.newArtisans : fallback.newArtisans;
  const categories = home?.categories?.length ? home.categories : fallback.categories;
  const products = catalog?.products?.length ? catalog.products : home?.featuredProducts?.length ? home.featuredProducts : fallback.featuredProducts;
  // Эхний 4 нь шууд харагдана; үлдсэнийг нь "Цааш үзэх" дөрвөөр нээнэ.
  const showcase = pickOnePerCategory(products, 12);

  /*
   * Урлаачдыг гурван баганад ээлжлэн хуваарилна (0,3,6… | 1,4,7… | 2,5,8…).
   * Багц бүр өөр урттай болох тул баганууд цаг хугацааны явцад давхцахгүй,
   * ижил хослол дахин дахин давтагдахгүй.
   */
  const portraitColumns = [0, 1, 2].map((column) =>
    artisans
      .filter((_, index) => index % 3 === column)
      .map((shop) => ({
        id: shop.id,
        src:
          resolveImageUrl(
            demoArtisanImage(shop) || shop.artisanProfile?.portraitUrl || shop.logoUrl || shop.bannerUrl
          ) || null,
        name: shopDisplayName(shop),
      }))
  );

  const steps = [
    { n: "01", title: t("lp.how.s1t"), body: t("lp.how.s1b") },
    { n: "02", title: t("lp.how.s2t"), body: t("lp.how.s2b") },
    { n: "03", title: t("lp.how.s3t"), body: t("lp.how.s3b") },
  ];

  return (
    <LandingShell>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="landing-hero relative isolate overflow-hidden">
        <img
          src={LANDING_HERO_IMAGE}
          alt=""
          className="lp-hero-image absolute inset-0 h-full w-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(26,23,20,0.2),rgba(26,23,20,0.82)),radial-gradient(ellipse_at_center,transparent_8%,var(--color-night)_78%)]" />

        <div className="page-wide landing-hero-inner relative flex flex-col items-center justify-center py-14 text-center sm:py-16 lg:py-20">
          <span className="lp-line h-px w-14 bg-sand" />
          <p className="lp-fade-up eyebrow mt-5 text-sand">{t("lp.hero.eyebrow")}</p>

          <h1 className="lp-fade-up lp-delay-1 display mt-6 max-w-4xl text-4xl leading-[1.12] sm:text-5xl lg:text-[68px]">
            {t("lp.hero.title")
              .split("\n")
              .map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
          </h1>

          <p className="lp-fade-up lp-delay-2 mt-7 max-w-xl text-sm leading-relaxed text-white/60">{t("lp.hero.sub")}</p>

          <div className="lp-fade-up lp-delay-3 mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/login" className="btn-pill-sand">
              {t("lp.hero.login")}
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-full border border-white/25 px-7 py-3 text-[11px] font-medium tracking-[0.18em] uppercase transition-colors hover:border-white/60"
            >
              {t("lp.hero.browse")}
            </Link>
          </div>

          <dl className="lp-fade-up lp-delay-4 mt-16 grid w-full max-w-2xl grid-cols-3 gap-6 border-t border-white/15 pt-6">
            {[
              { value: artisans.length, label: t("nav.artisans") },
              { value: products.length, label: t("nav.products") },
              { value: categories.length, label: t("common.category") },
            ].map((stat, index) => (
              <div key={stat.label} className="lp-stat" style={{ animationDelay: `${900 + index * 120}ms` }}>
                <dt className="display text-3xl">{stat.value}</dt>
                <dd className="eyebrow mt-1 text-white/45">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Бидний тухай ─────────────────────────────────── */}
      <section id="about" className="scroll-mt-16 bg-cream text-ink">
        <div className="page-wide lp-reveal grid gap-12 py-20 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-24">
          <div className="lp-section-copy">
            <p className="eyebrow text-ink/50">{t("lp.about.eyebrow")}</p>
            <h2 className="display mt-4 text-3xl leading-snug sm:text-4xl">
              {t("lp.about.title")
                .split("\n")
                .map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
            </h2>
            <p className="mt-6 max-w-lg text-sm leading-relaxed text-ink/70">{t("lp.about.body")}</p>
            <Link href="/artisans" className="rule-link mt-8">
              {t("nav.artisans")} <span className="text-base">⟶</span>
            </Link>
          </div>

          {/* Урлаачдын хөрөг — гурван хэмжээт цомог, эргэлдэнэ */}
          <ArtisanRotator columns={portraitColumns} />
        </div>
      </section>

      {/* ── Хэрхэн ажилладаг ─────────────────────────────── */}
      <section id="how" className="scroll-mt-16">
        <div className="page-wide lp-reveal py-20 lg:py-24">
          <p className="eyebrow text-sand">{t("lp.how.eyebrow")}</p>
          <h2 className="display mt-4 text-3xl sm:text-4xl">{t("lp.how.title")}</h2>

          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {steps.map((step, index) => (
              <div
                key={step.n}
                className="lp-step craft-hover-lift border-t border-white/20 pt-6"
                style={{ animationDelay: `${index * 110}ms` }}
              >
                <span className="display text-sand text-2xl">{step.n}</span>
                <h3 className="display mt-3 text-xl">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/60">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Цуглуулгаас ──────────────────────────────────── */}
      <section id="crafts" className="scroll-mt-16 bg-paper text-ink">
        <div className="page-wide lp-reveal py-20 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-ink/50">{t("lp.crafts.eyebrow")}</p>
              <h2 className="display mt-3 text-3xl sm:text-4xl">{t("lp.crafts.title")}</h2>
            </div>
            <Link href="/products" className="rule-link pb-1">
              {t("home.viewAllCollection")} <span className="text-base">⟶</span>
            </Link>
          </div>
          <div className="mt-5 border-t border-ink/20" />
          <p className="mt-5 max-w-xl text-sm text-muted">{t("lp.crafts.sub")}</p>

          <CraftShowcase products={showcase} />

          {/* Ангиллын мөр */}
          {categories.length ? (
            <div className="mt-12 flex flex-wrap gap-2">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/products?categoryId=${category.id}`}
                  className="lp-chip rounded-full border border-ink/20 px-4 py-2 text-[11px] tracking-[0.16em] uppercase transition-colors hover:border-ink/60"
                >
                  {category.nameText}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* ── Урлаачид ─────────────────────────────────────── */}
      {artisans.length ? (
        <section id="artisans" className="scroll-mt-16">
          <div className="page-wide lp-reveal py-20 lg:py-24">
            <p className="eyebrow text-sand">{t("lp.artisans.eyebrow")}</p>
            <h2 className="display mt-4 text-3xl sm:text-4xl">{t("lp.artisans.title")}</h2>

            <div className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {artisans.slice(0, 4).map((shop, index) => (
                <Link
                  key={shop.id}
                  href={`/shop/${shop.slug}`}
                  className="lp-artisan-card group craft-hover-lift block rounded-sm"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="aspect-[4/5] overflow-hidden bg-night-soft">
                    <ArtisanImage shop={shop} />
                  </div>
                  <p className="mt-3 text-sm">{shop.artisanProfile?.makerName || shopDisplayName(shop)}</p>
                  {shop.artisanProfile?.makerName ? <p className="mt-0.5 text-xs text-white/55">{shopDisplayName(shop)}</p> : null}
                  {shopCraftLine(shop, 3) ? <p className="mt-1 line-clamp-1 text-xs text-sand">{shopCraftLine(shop, 3)}</p> : null}
                  <p className="mt-0.5 text-xs text-white/45">{shopLocationText(shop)}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </LandingShell>
  );
}

/** Ангилал бүрээс нэгийг түүж, танилцуулгад олон төрлийн бүтээл харагдуулна. */
function pickOnePerCategory(items: Product[], limit: number): Product[] {
  const buckets = new Map<string, Product[]>();
  for (const item of items) {
    const bucket = buckets.get(item.categoryId);
    if (bucket) bucket.push(item);
    else buckets.set(item.categoryId, [item]);
  }

  const lists = [...buckets.values()];
  const picked: Product[] = [];
  const depth = Math.max(...lists.map((list) => list.length), 0);

  for (let round = 0; round < depth && picked.length < limit; round += 1) {
    for (const list of lists) {
      if (!list[round]) continue;
      picked.push(list[round]);
      if (picked.length === limit) break;
    }
  }

  return picked;
}

function ArtisanImage({ shop }: { shop: Shop }) {
  const src = resolveImageUrl(demoArtisanImage(shop) || shop.artisanProfile?.portraitUrl || shop.logoUrl || shop.bannerUrl);

  if (!src) {
    return (
      <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#8a3f2b,#b4533a_60%,#6d2f1f)]">
        <span className="display text-3xl text-white/50">{shopDisplayName(shop).slice(0, 1)}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={shopDisplayName(shop)}
      loading="lazy"
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
    />
  );
}
