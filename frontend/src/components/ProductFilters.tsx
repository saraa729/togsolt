"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";

export type ProductFacets = {
  categories: { id: string; nameText: string }[];
  materials: string[];
  techniques: string[];
  inventoryTypes: string[];
};

/** UI-аар удирдагддаг шүүлтүүрүүд — backend `GET /products` эдгээрийг бүгдийг дэмждэг. */
const FIELDS = [
  "q",
  "categoryId",
  "material",
  "technique",
  "inventoryType",
  "location",
  "minPrice",
  "maxPrice",
  "international",
] as const;

/**
 * UI-д харагдахгүй ч URL-д хадгалагдах ёстой шүүлтүүрүүд. Эдгээр нь дэлгүүрийн
 * хуудас, урлаачийн профайлаас ирдэг линкээр орж ирдэг — хайлт хийхэд эдгээрийг
 * алдвал хэрэглэгч огт хүсээгүй өргөн үр дүн рүү шидэгдэнэ.
 */
const PASSTHROUGH = ["shopId", "sellerId", "style"] as const;

/** Хайлтын хайрцагнаас гадуурх шүүлтүүрүүд — тэмдэглэгээний тоололд ордог. */
const ADVANCED = FIELDS.filter((field) => field !== "q");

function pick(source: Record<string, string>, keys: readonly string[]) {
  const out: Record<string, string> = {};
  for (const key of keys) if (source[key]) out[key] = source[key];
  return out;
}

export default function ProductFilters({ facets }: { facets: ProductFacets }) {
  const { t } = useApp();
  const router = useRouter();
  const params = useSearchParams();

  /** URL дэх бүх параметр — UI-д байхгүй нь ч мөн адил. */
  const current = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [key, value] of params?.entries() || []) if (value) out[key] = value;
    return out;
  }, [params]);

  const [form, setForm] = useState<Record<string, string>>(() => pick(current, FIELDS));
  const [open, setOpen] = useState(() => ADVANCED.some((field) => current[field]));

  /*
   * URL нь гаднаас ч өөрчлөгдөж болно — хөтчийн буцах товч, ангиллын линк,
   * дэлгүүрийн "бүх бүтээл" холбоос. Тэр үед талбарууд URL-тэй тааруулж
   * шинэчлэгдэхгүй бол дэлгэц дээрх утга ба үр дүн зөрнө.
   */
  useEffect(() => {
    setForm(pick(current, FIELDS));
  }, [current]);

  const activeCount = ADVANCED.filter((field) => form[field]).length;

  function update(key: string, value: string) {
    setForm((prev) => {
      const next = { ...prev };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
  }

  /** Бүх шүүлтүүрийг нэг дор URL руу бичнэ — аль нэгийг нь ч алдахгүй. */
  function apply(event?: React.FormEvent) {
    event?.preventDefault();
    const search = new URLSearchParams();
    for (const key of PASSTHROUGH) if (current[key]) search.set(key, current[key]);
    for (const key of FIELDS) {
      const value = (form[key] || "").trim();
      if (value) search.set(key, value);
    }
    router.push(`/products${search.toString() ? `?${search}` : ""}`);
  }

  /** Дэлгүүр/урлаачийн хүрээг хэвээр үлдээж, зөвхөн шүүлтүүрийг цэвэрлэнэ. */
  function clearAll() {
    const search = new URLSearchParams();
    for (const key of PASSTHROUGH) if (current[key]) search.set(key, current[key]);
    setForm({});
    router.push(`/products${search.toString() ? `?${search}` : ""}`);
  }

  const hasAnything = FIELDS.some((field) => form[field]);

  return (
    <form onSubmit={apply} className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t("common.search")}</span>
          <input
            className="input"
            value={form.q || ""}
            onChange={(event) => update("q", event.target.value)}
            placeholder={t("products.searchPlaceholder")}
          />
        </label>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            {open ? t("products.filters.hide") : t("products.filters.more")}
            {activeCount > 0 ? (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-clay px-1.5 text-xs text-white">
                {activeCount}
              </span>
            ) : null}
          </button>
          {hasAnything ? (
            <button type="button" className="btn-secondary" onClick={clearAll}>
              {t("common.clear")}
            </button>
          ) : null}
          <button type="submit" className="btn-primary">
            {t("common.search")}
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="label">{t("products.filters.category")}</span>
            <select
              className="input"
              value={form.categoryId || ""}
              onChange={(event) => update("categoryId", event.target.value)}
            >
              <option value="">{t("common.all")}</option>
              {facets.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nameText}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">{t("products.filters.material")}</span>
            <select
              className="input"
              value={form.material || ""}
              onChange={(event) => update("material", event.target.value)}
            >
              <option value="">{t("common.all")}</option>
              {facets.materials.map((material) => (
                <option key={material} value={material}>
                  {t(`mat.${material}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">{t("products.filters.technique")}</span>
            <select
              className="input"
              value={form.technique || ""}
              onChange={(event) => update("technique", event.target.value)}
            >
              <option value="">{t("common.all")}</option>
              {facets.techniques.map((technique) => (
                <option key={technique} value={technique}>
                  {t(`tech.${technique}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">{t("products.filters.inventory")}</span>
            <select
              className="input"
              value={form.inventoryType || ""}
              onChange={(event) => update("inventoryType", event.target.value)}
            >
              <option value="">{t("common.all")}</option>
              {facets.inventoryTypes.map((type) => (
                <option key={type} value={type}>
                  {t(`inv.${type}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">{t("products.filters.location")}</span>
            <input
              className="input"
              value={form.location || ""}
              onChange={(event) => update("location", event.target.value)}
              placeholder={t("products.filters.locationPlaceholder")}
            />
          </label>

          {/* Хоёр талбарыг нэг <label>-д багтаах боломжгүй тул тус бүрд нь aria-label өгөв. */}
          <div role="group" aria-label={t("products.filters.price")}>
            <span className="label">{t("products.filters.price")}</span>
            <div className="flex items-center gap-2">
              <input
                className="input"
                type="number"
                min="0"
                inputMode="numeric"
                value={form.minPrice || ""}
                onChange={(event) => update("minPrice", event.target.value)}
                placeholder={t("products.filters.min")}
                aria-label={`${t("products.filters.price")} — ${t("products.filters.min")}`}
              />
              <span className="text-muted">—</span>
              <input
                className="input"
                type="number"
                min="0"
                inputMode="numeric"
                value={form.maxPrice || ""}
                onChange={(event) => update("maxPrice", event.target.value)}
                placeholder={t("products.filters.max")}
                aria-label={`${t("products.filters.price")} — ${t("products.filters.max")}`}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 sm:col-span-2 lg:col-span-3">
            <input
              type="checkbox"
              className="size-4 accent-clay"
              checked={form.international === "true"}
              onChange={(event) => update("international", event.target.checked ? "true" : "")}
            />
            <span className="text-sm">{t("products.filters.international")}</span>
          </label>

          <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
            <button type="submit" className="btn-primary">
              {t("products.apply")}
            </button>
            {activeCount > 0 ? (
              <button type="button" className="btn-secondary" onClick={clearAll}>
                {t("products.filters.clearAll")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </form>
  );
}
