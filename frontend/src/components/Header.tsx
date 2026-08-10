"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { classNames, initials } from "@/lib/format";

export default function Header() {
  const { t, locale, currency, setLocale, setCurrency } = useApp();
  const { user, hasRole, logout, cartCount, ready } = useAuth();
  const pathname = usePathname() || "";
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  
  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // Нэвтэрсэн хэрэглэгчийн "нүүр" бол `/home`; зочны нүүр бол танилцуулга `/`.
  const homeHref = user ? "/home" : "/";

  const leftNav = [
    { href: homeHref, label: t("nav.home") },
    { href: "/products", label: t("nav.products") },
    { href: "/artisans", label: t("nav.artisans") },
  ];
  const rightNav = user
    ? [
        { href: "/orders", label: t("nav.orders") },
        { href: "/favorites", label: t("nav.favorites") },
      ]
    : [
        { href: "/register?role=seller", label: t("auth.asSeller") },
      ];

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/products?q=${encodeURIComponent(value)}` : "/products");
    setSearchOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-cream text-ink shadow-sm">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 flex h-16 items-center gap-4">
        {/* Mobile menu */}
        <button
          type="button"
          className="cursor-pointer text-lg text-ink lg:hidden"
          aria-label={t("nav.menu")}
          onClick={() => setMenuOpen((value) => !value)}
          aria-expanded={menuOpen}
        >
          {menuOpen ? "✕" : "☰"}
        </button>

        <nav role="navigation" className="hidden flex-1 items-center gap-7 text-[11px] tracking-[0.18em] uppercase lg:flex">
          {leftNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={classNames(
                "whitespace-nowrap transition-colors hover:text-clay-dark",
                pathname === item.href ? "text-night" : "text-muted"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href={homeHref}
          aria-label={t("nav.home")}
          className="display mx-auto text-2xl tracking-[0.3em] lowercase sm:text-[26px]"
          style={{ letterSpacing: "0.28em" }}
        >
          expocraft
        </Link>

        <div className="hidden flex-1 items-center justify-end gap-7 text-[11px] tracking-[0.18em] uppercase lg:flex">
          {rightNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-muted transition-colors hover:text-clay-dark"
            >
              {item.label}
            </Link>
          ))}

          <Link href="/cart" className="relative text-muted transition-colors hover:text-clay-dark">
            {t("nav.cart")}
            {cartCount > 0 ? (
              <span className="absolute -top-2 -right-3 grid h-4 min-w-4 place-items-center rounded-full bg-sand px-1 text-[9px] font-semibold text-night">
                {cartCount}
              </span>
            ) : null}
          </Link>

          {!ready ? (
            <span className="h-4 w-16 rounded bg-white/10" />
          ) : user ? (
            <div className="relative">
              {/* Цэсний холбоосуудаас ялгарсан профайл товч — том үсгээр хашгирахгүй. */}
              <button
                type="button"
                className="flex cursor-pointer items-center gap-2 rounded-full border border-line bg-paper py-1 pr-3 pl-1 tracking-normal normal-case transition-colors hover:bg-surface"
                onClick={() => setAccountOpen((value) => !value)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-clay text-[10px] font-semibold text-white">
                  {initials(user.name)}
                </span>
                <span className="max-w-24 truncate text-xs font-medium text-ink">{user.name.split(" ")[0]}</span>
                <span className="text-[9px] text-muted">▾</span>
              </button>
              {accountOpen ? (
                <div className="absolute right-0 mt-3 w-60 overflow-hidden rounded-lg bg-night-soft py-1 text-[11px] tracking-[0.14em] shadow-2xl">
                  <div className="border-b border-white/10 px-4 py-3 tracking-normal normal-case">
                    <p className="truncate text-xs font-medium text-white">{user.name}</p>
                    <p className="truncate text-[11px] text-white/45">{user.email}</p>
                  </div>
                  <MenuLink href="/account">{t("nav.account")}</MenuLink>
                  <MenuLink href="/orders">{t("nav.orders")}</MenuLink>
                  <MenuLink href="/favorites">{t("nav.favorites")}</MenuLink>
                  <MenuLink href="/custom-requests">{t("nav.custom")}</MenuLink>
                  <MenuLink href="/contracts">{t("contract.mine")}</MenuLink>
                  <MenuLink href="/messages">{t("nav.messages")}</MenuLink>
                  {hasRole("seller") ? <MenuLink href="/seller">{t("nav.seller")}</MenuLink> : null}
                  {hasRole("admin") ? <MenuLink href="/admin">{t("nav.admin")}</MenuLink> : null}
                  <button
                    type="button"
                    className="mt-1 w-full cursor-pointer border-t border-white/10 px-4 py-2.5 text-left text-sand uppercase hover:bg-white/5"
                    onClick={async () => {
                      setAccountOpen(false);
                      await logout();
                      router.push("/");
                    }}
                  >
                    {t("nav.logout")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
          <Link href="/login" className="text-muted transition-colors hover:text-clay-dark">
              {t("nav.login")}
            </Link>
          )}
        </div>

        {/* Mobile right side */}
          <Link href="/cart" className="relative text-lg lg:hidden text-ink" aria-label={t("nav.cart")}>
          🛒
          {cartCount > 0 ? (
            <span className="absolute -top-1 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-sand px-1 text-[9px] font-semibold text-night">
              {cartCount}
            </span>
          ) : null}
        </Link>
      </div>

      {/* Search drawer */}
      {searchOpen ? (
        <div className="border-t border-line bg-paper">
          <form onSubmit={submitSearch} className="mx-auto w-full max-w-7xl px-4 sm:px-6 flex items-center gap-3 py-4">
            <input
              autoFocus
              className="flex-1 border-b border-line bg-transparent pb-2 text-sm text-ink outline-none placeholder:text-muted"
              placeholder={t("products.searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" className="btn-pill-sand">
              {t("common.search")}
            </button>
          </form>
        </div>
      ) : null}

      {/* Mobile drawer */}
      {menuOpen ? (
        <div className="border-t border-line bg-paper lg:hidden">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 space-y-4 py-5">
            <form onSubmit={submitSearch} className="flex gap-2">
              <input
                className="flex-1 border-b border-white/20 bg-transparent pb-2 text-sm text-white outline-none placeholder:text-white/40"
                placeholder={t("products.searchPlaceholder")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="submit" className="btn-pill-sand px-4 py-2">
                ⌕
              </button>
            </form>

            <nav className="grid gap-1 text-[11px] tracking-[0.18em] uppercase">
              {[...leftNav, ...rightNav, { href: "/cart", label: t("nav.cart") }].map((item) => (
                <Link key={item.href} href={item.href} className="py-2 text-white/75">
                  {item.label}
                </Link>
              ))}
              {user ? (
                <>
                  <Link href="/account" className="py-2 text-white/75">
                    {t("nav.account")}
                  </Link>
                  {hasRole("seller") ? (
                    <Link href="/seller" className="py-2 text-white/75">
                      {t("nav.seller")}
                    </Link>
                  ) : null}
                  {hasRole("admin") ? (
                    <Link href="/admin" className="py-2 text-white/75">
                      {t("nav.admin")}
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="cursor-pointer py-2 text-left text-sand uppercase"
                    onClick={async () => {
                      await logout();
                      router.push("/");
                    }}
                  >
                    {t("nav.logout")}
                  </button>
                </>
              ) : (
                <Link href="/login" className="py-2 text-sand">
                  {t("nav.login")}
                </Link>
              )}
            </nav>

            <div className="flex items-center gap-4 border-t border-white/10 pt-4 text-[11px] tracking-[0.14em] uppercase">
              {(["mn", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={classNames("cursor-pointer", locale === code ? "text-white" : "text-white/50")}
                >
                  {code}
                </button>
              ))}
              <span className="text-white/20">|</span>
              {(["MNT", "USD"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCurrency(code)}
                  className={classNames("cursor-pointer", currency === code ? "text-white" : "text-white/50")}
                >
                  {code === "MNT" ? "₮" : "$"}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block px-4 py-2.5 text-white/75 uppercase hover:bg-white/5 hover:text-white">
      {children}
    </Link>
  );
}
