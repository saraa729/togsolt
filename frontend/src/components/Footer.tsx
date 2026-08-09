"use client";

import Link from "next/link";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";

export default function Footer() {
  const { t } = useApp();
  const { user } = useAuth();

  const columns = [
    {
      title: t("footer.links"),
      items: [
        { href: user ? "/home" : "/", label: t("nav.home") },
        { href: "/products", label: t("nav.products") },
        { href: "/artisans", label: t("nav.artisans") },
        { href: "/tourist", label: t("nav.tourist") },
      ],
    },
    {
      title: t("footer.information"),
      items: [
        { href: "/register?role=seller", label: t("auth.asSeller") },
        { href: "/seller", label: t("nav.seller") },
        { href: "/orders", label: t("nav.orders") },
        { href: "/custom-requests", label: t("nav.custom") },
      ],
    },
    {
      title: t("footer.social"),
      items: [
        { href: "https://facebook.com", label: "Facebook" },
        { href: "https://instagram.com", label: "Instagram" },
        { href: "https://twitter.com", label: "Twitter" },
      ],
    },
  ];

  return (
    <footer className="bg-night text-white">
      <div className="page-wide grid gap-10 py-16 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <p className="display text-2xl tracking-[0.28em] lowercase text-sand">expocraft</p>
          <p className="mt-5 text-sm text-white/60">{t("footer.museumLine")}</p>
          <p className="mt-1 text-sm text-white/60">{t("top.address")}</p>
          <p className="mt-1 text-sm text-white/60">+976 (11) 123 45 45</p>
        </div>

        {columns.map((column) => (
          <div key={column.title}>
            <p className="eyebrow text-sand">{column.title}</p>
            <ul className="mt-5 space-y-3 text-[11px] tracking-[0.16em] uppercase">
              {column.items.map((item) => (
                <li key={item.href + item.label}>
                  <Link href={item.href} className="text-white/60 transition-opacity hover:opacity-100 hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="page-wide flex flex-wrap items-center justify-between gap-3 py-5 text-[10px] tracking-[0.16em] text-white/40 uppercase">
          <span className="flex items-center gap-3 text-sm">
            <span>𝕏</span>
            <span>◎</span>
            <span>f</span>
          </span>
          <span>
            ExpoCraft © {new Date().getFullYear()} · {t("footer.rights")}
          </span>
        </div>
      </div>
    </footer>
  );
}
