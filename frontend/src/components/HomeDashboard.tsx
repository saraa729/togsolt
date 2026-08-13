"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import CraftTile from "@/components/CraftTile";
import RequireAuth from "@/components/RequireAuth";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { demoArtisanImage } from "@/lib/demo-images";
import { formatMoney, initials, resolveImageUrl } from "@/lib/format";
import { shopCraftLine, shopDisplayName, shopLocationText } from "@/lib/shop-display";
import type { Category, Locale, Product, Shop } from "@/lib/types";

type Props = {
  recommended: Product[];
  fresh: Product[];
  categories: Category[];
  artisans: Shop[];
};

/**
 * Нэвтэрсэн хэрэглэгчийн нүүр — агуулга төвтэй, бүтэн өргөнөөр давхарласан бүтэц.
 *
 * Бүтцийн шийдвэрүүд:
 *   • Хажуу багана байхгүй. Тэр нь худалдааны хуудсыг админ самбар мэт харагдуулж,
 *     баганын өндөр таарахгүйгээс доод талд хоосон зай үүсгэдэг байсан.
 *   • Шуурхай холбоосын хавтангууд байхгүй. Захиалга/Хадгалсан/Сагс/Профайл бүгд
 *     толгойн цэсэнд аль хэдийн байгаа тул давхардаж байсан.
 *   • Хувийн мэдээлэл (мэндчилгээ, сагс, хайлт) нэг нимгэн мөрөнд багтана.
 *   • Хэсэг бүр бүтэн өргөн: ангилал → санал болгох → шинэ → урлаач → escrow.
 */
export default function HomeDashboard(props: Props) {
  return (
    <RequireAuth>
      <Dashboard {...props} />
    </RequireAuth>
  );
}

function Dashboard({ recommended, fresh, categories, artisans }: Props) {
  const { t, locale } = useApp();
  const { user, hasRole, cartCount } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");

  const firstName = user?.name?.split(" ")[0] || "";

  const roleChip = hasRole("admin")
    ? t("hp.roleAdmin")
    : hasRole("seller")
      ? t("hp.roleSeller")
      : t("hp.roleBuyer");

  const consoles = [
    hasRole("seller") ? { href: "/seller", label: t("hp.quick.seller") } : null,
    hasRole("admin") ? { href: "/admin", label: t("hp.quick.admin") } : null,
  ].filter(Boolean) as { href: string; label: string }[];

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/products?q=${encodeURIComponent(value)}` : "/products");
  }

  return (
    <div className="page-wide space-y-10 py-8">
      {/*
       * ── Хувийн мөр ───────────────────────────────────
       * Хар градиент самбар байсныг цайвар editorial мөр болгов: цөцгий өнгийн
       * хуудсан дээр бараан хавтан хамгийн чанга элемент болчихдог байсан ч
       * дотор нь мэндчилгээнээс өөр юу ч байгаагүй. Одоо жин нь агуулгад очно.
       */}
      <section className="animate-rise flex flex-col gap-5 border-b border-line pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="eyebrow text-muted">{roleChip}</p>
          <h1 className="display mt-2 truncate text-[1.75rem] leading-tight sm:text-4xl">
            {t("hp.welcome")}
            {firstName ? `, ${firstName}` : ""}
          </h1>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {cartCount > 0 ? (
            <Link href="/cart" className="rule-link shrink-0 text-clay">
              {cartCount} {t("hp.cartLine")} ⟶
            </Link>
          ) : null}

          <form
            onSubmit={submitSearch}
            className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-1 pl-4 transition-colors focus-within:border-clay/50 lg:w-80"
          >
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted/70"
              placeholder={t("hp.searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              type="submit"
              className="shrink-0 cursor-pointer rounded-full bg-clay px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-clay-dark"
            >
              {t("common.search")}
            </button>
          </form>
        </div>
      </section>

      {/* Урлаач / админы самбар — эрхтэй хүнд л гарна */}
      {consoles.length ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {consoles.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="craft-hover-lift flex items-center justify-between gap-3 rounded-2xl border border-clay/25 bg-clay-soft px-5 py-4 hover:border-clay/50"
            >
              <span className="truncate text-sm font-medium text-clay-dark">{item.label}</span>
              <span className="shrink-0 text-clay-dark">⟶</span>
            </Link>
          ))}
        </section>
      ) : null}

      {/* ── Ангилал ──────────────────────────────────────── */}
      {categories.length ? (
        <section>
          <SectionHead title={t("hp.categories")} href="/products" label={t("common.viewAll")} />
          <div className="mt-5 flex flex-wrap gap-2.5">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/products?categoryId=${category.id}`}
                className="craft-hover-lift rounded-full border border-line bg-surface px-5 py-2.5 text-sm hover:border-clay/50 hover:bg-clay-soft hover:text-clay-dark"
              >
                {category.nameText || category.name?.mn}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Санал болгох слайдер ─────────────────────────── */}
      <ProductRail
        title={t("hp.forYou")}
        sub={t("hp.forYouSub")}
        href="/products"
        label={t("common.viewAll")}
        emptyText={t("common.empty")}
        products={recommended}
        locale={locale}
      />

      {/* ── Шинээр нэмэгдсэн ─────────────────────────────── */}
      <section>
        <SectionHead title={t("hp.fresh")} href="/products" label={t("common.viewAll")} />

        {fresh.length ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {fresh.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="group craft-hover-lift flex gap-4 rounded-2xl border border-line bg-surface p-4 hover:border-clay/40 hover:bg-paper"
              >
                <div className="w-20 shrink-0 overflow-hidden rounded-xl">
                  <CraftTile product={product} ratio="aspect-square" showTitle={false} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="line-clamp-2 text-sm leading-snug font-medium">{product.titleText}</p>
                  <p className="mt-1 truncate text-xs text-muted">{product.shop?.displayName}</p>
                  <p className="mt-auto pt-2 text-sm font-semibold">{formatMoney(product.price, locale)}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyLine text={t("common.empty")} />
        )}
      </section>

      {/* ── Урлаачид ─────────────────────────────────────── */}
      {artisans.length ? (
        <section>
          <SectionHead title={t("hp.follow")} href="/artisans" label={t("common.viewAll")} />

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {artisans.slice(0, 4).map((shop) => (
              <Link
                key={shop.id}
                href={`/shop/${shop.slug}`}
                className="craft-hover-lift flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-clay/40 hover:bg-paper"
              >
                <Avatar shop={shop} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{shop.artisanProfile?.makerName || shopDisplayName(shop)}</span>
                  <span className="block truncate text-xs text-muted">{shopDisplayName(shop)}</span>
                  <span className="mt-1 block line-clamp-1 text-xs font-medium text-clay-dark">
                    {shopCraftLine(shop, 3) || shopLocationText(shop) || "—"}
                  </span>
                </span>
                {shop.verified ? <span className="shrink-0 text-xs text-pine">✓</span> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* ── Escrow тайлбар — нимгэн бүтэн өргөний зурвас ── */}
      <section className="craft-hover-lift flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t("hp.escrowTitle")}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{t("hp.escrowBody")}</p>
        </div>
        <Link href="/orders" className="btn-secondary shrink-0">
          {t("hp.escrowLink")}
        </Link>
      </section>
    </div>
  );
}

/**
 * Бүтээлийн слайдер — нэг мөрөнд байрлаж, сумаар нэг дэлгэцээр гүйнэ.
 * Гар утсанд хуруугаар шүүрдэх нь өөрөө ажиллана (native overflow-x + snap).
 */
function ProductRail({
  title,
  sub,
  href,
  label,
  emptyText,
  products,
  locale,
}: {
  title: string;
  sub?: string;
  href: string;
  label: string;
  emptyText: string;
  products: Product[];
  locale: Locale;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    // 2px тэвчих зай — дэд пикселийн бөөрөнхийлөлтөөс болж сум хэзээ ч унтрахгүй байхаас сэргийлнэ.
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    sync();
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sync, products.length]);

  function page(direction: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  }

  if (!products.length) {
    return (
      <section>
        <SectionHead title={title} sub={sub} href={href} label={label} />
        <EmptyLine text={emptyText} />
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="display text-xl sm:text-2xl">{title}</h2>

        <div className="flex items-center gap-4">
          <Link href={href} className="rule-link text-clay">
            {label} ⟶
          </Link>
          <div className="flex gap-1.5">
            <RailArrow direction="prev" disabled={atStart} onClick={() => page(-1)} />
            <RailArrow direction="next" disabled={atEnd} onClick={() => page(1)} />
          </div>
        </div>

        {sub ? <p className="w-full text-xs text-muted">{sub}</p> : null}
      </div>

      <div
        ref={scroller}
        onScroll={sync}
        className="scrollbar-none mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            className="group craft-hover-lift w-[calc(50%-0.5rem)] shrink-0 snap-start rounded-2xl sm:w-[calc(33.333%-0.667rem)] lg:w-[calc(25%-0.75rem)] xl:w-[calc(20%-0.8rem)]"
          >
            <div className="overflow-hidden rounded-2xl border border-line transition-shadow group-hover:shadow-md">
              <CraftTile product={product} ratio="aspect-[4/5]" showTitle={false} />
            </div>
            <p className="mt-3 line-clamp-2 text-sm leading-snug font-medium">{product.titleText}</p>
            <p className="mt-1 text-sm text-muted">{formatMoney(product.price, locale)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function RailArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const { t } = useApp();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? t("hp.railPrev") : t("hp.railNext")}
      className="grid h-7 w-7 cursor-pointer place-items-center rounded-full border border-line bg-surface text-xs text-ink transition-colors hover:border-clay/50 hover:bg-clay-soft hover:text-clay-dark disabled:cursor-not-allowed disabled:border-line disabled:bg-surface disabled:text-muted/35 disabled:hover:bg-surface"
    >
      {direction === "prev" ? "‹" : "›"}
    </button>
  );
}

/**
 * Хэсгийн толгой — гарчиг, тайлбар, баруун талд бүгдийг үзэх.
 * Гарчиг нь serif: толгойн `expocraft` тэмдэг болон танилцуулга хуудастай нэг хэлээр.
 */
function SectionHead({ title, sub, href, label }: { title: string; sub?: string; href: string; label: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="display text-xl sm:text-2xl">{title}</h2>
      <Link href={href} className="rule-link text-clay">
        {label} ⟶
      </Link>
      {sub ? <p className="w-full text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="mt-5 rounded-2xl border border-line bg-surface px-5 py-10 text-center text-sm text-muted">
      {text}
    </div>
  );
}

function Avatar({ shop }: { shop: Shop }) {
  const src = resolveImageUrl(demoArtisanImage(shop) || shop.artisanProfile?.portraitUrl || shop.logoUrl);

  if (!src) {
    return (
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-paper text-xs font-medium text-muted">
        {initials(shopDisplayName(shop))}
      </span>
    );
  }

  return <img src={src} alt={shopDisplayName(shop)} className="h-10 w-10 shrink-0 rounded-full object-cover" />;
}
