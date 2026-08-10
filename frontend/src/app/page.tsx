import Link from "next/link";
import CraftShowcase from "@/components/CraftShowcase";
import LandingShell from "@/components/LandingShell";
import { serverGet } from "@/lib/api";
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

  const artisans = home?.newArtisans ?? [];
  const categories = home?.categories ?? [];
  const products = catalog?.products ?? home?.featuredProducts ?? [];
  // Эхний 4 нь шууд харагдана; үлдсэнийг нь "Цааш үзэх" дөрвөөр нээнэ.
  const showcase = pickOnePerCategory(products, 12);

  const steps = [
    { n: "01", title: t("lp.how.s1t"), body: t("lp.how.s1b") },
    { n: "02", title: t("lp.how.s2t"), body: t("lp.how.s2b") },
    { n: "03", title: t("lp.how.s3t"), body: t("lp.how.s3b") },
  ];

  return (
    <LandingShell>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden">
        <img
          src={LANDING_HERO_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        />
        <svg className="absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <pattern id="lp-alkhan" width="64" height="64" patternUnits="userSpaceOnUse">
              <path
                d="M6 58 V6 H58 V44 H20 V20 H44 V32"
                fill="none"
                stroke="var(--color-sand)"
                strokeWidth="2"
                opacity="0.16"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lp-alkhan)" />
        </svg>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(26,23,20,0.2),rgba(26,23,20,0.82)),radial-gradient(ellipse_at_center,transparent_8%,var(--color-night)_78%)]" />

        <div className="page-wide relative flex min-h-[560px] flex-col items-center justify-center py-24 text-center lg:min-h-[640px]">
          <span className="h-px w-14 bg-sand" />
          <p className="eyebrow mt-5 text-sand">{t("lp.hero.eyebrow")}</p>

          <h1 className="display mt-6 max-w-4xl text-4xl leading-[1.12] sm:text-5xl lg:text-[68px]">
            {t("lp.hero.title")
              .split("\n")
              .map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
          </h1>

          <p className="mt-7 max-w-xl text-sm leading-relaxed text-white/60">{t("lp.hero.sub")}</p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
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

          <dl className="mt-16 grid w-full max-w-2xl grid-cols-3 gap-6 border-t border-white/15 pt-6">
            {[
              { value: artisans.length, label: t("nav.artisans") },
              { value: products.length, label: t("nav.products") },
              { value: categories.length, label: t("common.category") },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="display text-3xl">{stat.value}</dt>
                <dd className="eyebrow mt-1 text-white/45">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Бидний тухай ─────────────────────────────────── */}
      <section id="about" className="scroll-mt-16 bg-cream text-ink">
        <div className="page-wide grid gap-12 py-20 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:py-24">
          <div>
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

          {/* Урлаачдын хөрөг — гурван хэмжээт цомог */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {artisans.slice(0, 3).map((shop, index) => (
              <PortraitPanel key={shop.id} shop={shop} tall={index === 1} />
            ))}
            {artisans.length === 0
              ? [0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className={`${index === 1 ? "aspect-[3/5]" : "mt-6 aspect-[3/4]"} bg-[linear-gradient(135deg,#e0d6c6,#cbbca6)]`}
                  />
                ))
              : null}
          </div>
        </div>
      </section>

      {/* ── Хэрхэн ажилладаг ─────────────────────────────── */}
      <section id="how" className="scroll-mt-16">
        <div className="page-wide py-20 lg:py-24">
          <p className="eyebrow text-sand">{t("lp.how.eyebrow")}</p>
          <h2 className="display mt-4 text-3xl sm:text-4xl">{t("lp.how.title")}</h2>

          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.n} className="border-t border-white/20 pt-6">
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
        <div className="page-wide py-20 lg:py-24">
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
                  className="rounded-full border border-ink/20 px-4 py-2 text-[11px] tracking-[0.16em] uppercase transition-colors hover:border-ink/60"
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
          <div className="page-wide py-20 lg:py-24">
            <p className="eyebrow text-sand">{t("lp.artisans.eyebrow")}</p>
            <h2 className="display mt-4 text-3xl sm:text-4xl">{t("lp.artisans.title")}</h2>

            <div className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {artisans.slice(0, 4).map((shop) => (
                <Link key={shop.id} href={`/shop/${shop.slug}`} className="group block">
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

      {/* ── Төгсгөлийн уриалга ───────────────────────────── */}
      <section className="page-wide py-24 text-center lg:py-28">
        <span className="mx-auto block h-px w-14 bg-sand" />
        <h2 className="display mt-8 text-3xl sm:text-4xl">{t("lp.cta.title")}</h2>
        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-white/60">{t("lp.cta.sub")}</p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login" className="btn-pill-sand">
            {t("lp.hero.login")}
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-full border border-white/25 px-7 py-3 text-[11px] font-medium tracking-[0.18em] uppercase transition-colors hover:border-white/60"
          >
            {t("lp.cta.register")}
          </Link>
        </div>

        <Link href="/register?role=seller" className="rule-link mt-8 text-white/45 hover:text-white">
          {t("lp.cta.seller")} <span className="text-base">⟶</span>
        </Link>
      </section>
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

function PortraitPanel({ shop, tall }: { shop: Shop; tall: boolean }) {
  return (
    <div className={tall ? "aspect-[3/5] overflow-hidden bg-night" : "mt-6 aspect-[3/4] overflow-hidden bg-night"}>
      <ArtisanImage shop={shop} />
    </div>
  );
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
