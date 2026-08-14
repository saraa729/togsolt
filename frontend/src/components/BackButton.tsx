"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";

/**
 * Буцах товч нь хоёр горимтой:
 *
 *   1. Хөтчийн түүх байвал `router.back()` — хэрэглэгчийн ирсэн замаар буцна
 *   2. Түүх байхгүй бол (шууд линк, шинэ таб, QR-аар орсон) эцэг зам руу шилжинэ
 *
 * Хоёр дахь горимгүй бол шууд линкээр орж ирсэн хэрэглэгчид товч дарахад
 * юу ч болохгүй — Next.js-ийн `back()` хийх түүх байхгүй үед чимээгүй унтардаг.
 */

/** Товч харуулахгүй хуудсууд — эдгээр нь өөрсдөө хамгийн дээд түвшин. */
const ROOT_ROUTES = new Set(["/", "/home", "/seller", "/admin"]);

/**
 * Замын бүтцээс эцгийг нь таах нь бүх тохиолдолд зөв гарахгүй:
 *
 *   • `/shop/[slug]` — `/shop` гэсэн хуудас БАЙХГҮЙ (404). Дэлгүүрийн жагсаалт
 *     нь `/artisans`. Энэ нь QR эсвэл хуваалцсан холбоосоор шууд орж ирсэн
 *     зочинд хамгийн их тохиолддог — тэдэнд хөтчийн түүх байхгүй.
 *   • `/checkout` — бүтцээр нь бол `/home`, гэвч хэрэглэгчийн ирсэн газар нь сагс.
 */
const PARENT_OVERRIDES: Record<string, string> = {
  "/shop": "/artisans",
  "/checkout": "/cart",
};

/** `/products/abc` → `/products`, `/seller/orders` → `/seller` */
export function parentRoute(pathname: string): string {
  if (PARENT_OVERRIDES[pathname]) return PARENT_OVERRIDES[pathname];

  const segments = pathname.split("/").filter(Boolean);
  const parent = segments.length <= 1 ? "/home" : `/${segments.slice(0, -1).join("/")}`;
  return PARENT_OVERRIDES[parent] || parent;
}

export default function BackButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { t } = useApp();
  const [hasHistory, setHasHistory] = useState(false);

  /*
   * `window.history.length` нь зөвхөн клиент дээр уншигдана. Хуудас солигдох
   * бүрд дахин шалгана — SPA шилжилтэд түүхийн урт өснө.
   */
  useEffect(() => {
    setHasHistory(window.history.length > 1);
  }, [pathname]);

  if (ROOT_ROUTES.has(pathname)) return null;

  function goBack() {
    if (hasHistory) router.back();
    else router.push(parentRoute(pathname));
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={t("common.back")}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:border-clay/40 hover:text-ink ${className}`}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
      {t("common.back")}
    </button>
  );
}
