"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";
import type { Category } from "@/lib/types";

const INVENTORY_TYPES = ["ready_made", "limited_stock", "one_of_one", "made_to_order"] as const;

export default function ProductFilters({
  categories,
  materials,
  techniques,
}: {
  categories: Category[];
  materials: string[];
  techniques: string[];
}) {
  const { t } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const initial = useMemo(() => Object.fromEntries(params?.entries() || []), [params]);
  const [form, setForm] = useState<Record<string, string>>({
    q: initial.q || "",
    categoryId: initial.categoryId || "",
    material: initial.material || "",
    technique: initial.technique || "",
    inventoryType: initial.inventoryType || "",
    location: initial.location || "",
    minPrice: initial.minPrice || "",
    maxPrice: initial.maxPrice || "",
    international: initial.international || "",
  });

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function apply(event?: React.FormEvent) {
    event?.preventDefault();
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(form)) {
      if (value) search.set(key, value);
    }
    router.push(`/products${search.toString() ? `?${search}` : ""}`);
  }

  function reset() {
    setForm({
      q: "",
      categoryId: "",
      material: "",
      technique: "",
      inventoryType: "",
      location: "",
      minPrice: "",
      maxPrice: "",
      international: "",
    });
    router.push("/products");
  }

  return (
    <form onSubmit={apply} className="card-pad sticky top-24 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-medium">{t("common.filter")}</p>
        <button type="button" className="btn-ghost btn-sm" onClick={reset}>
          {t("common.clear")}
        </button>
      </div>

      <label className="block">
        <span className="label">{t("common.search")}</span>
        <input
          className="input"
          value={form.q}
          onChange={(event) => update("q", event.target.value)}
          placeholder={t("products.searchPlaceholder")}
        />
      </label>

      <label className="block">
        <span className="label">{t("products.filters.category")}</span>
        <select className="input" value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}>
          <option value="">{t("common.all")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.nameText}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="label">{t("products.filters.material")}</span>
        <select className="input" value={form.material} onChange={(event) => update("material", event.target.value)}>
          <option value="">{t("common.all")}</option>
          {materials.map((material) => (
            <option key={material} value={material}>
              {material}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="label">{t("products.filters.technique")}</span>
        <select className="input" value={form.technique} onChange={(event) => update("technique", event.target.value)}>
          <option value="">{t("common.all")}</option>
          {techniques.map((technique) => (
            <option key={technique} value={technique}>
              {technique}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="label">{t("products.filters.inventory")}</span>
        <select
          className="input"
          value={form.inventoryType}
          onChange={(event) => update("inventoryType", event.target.value)}
        >
          <option value="">{t("common.all")}</option>
          {INVENTORY_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`inv.${type}`)}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="label">{t("products.filters.price")}</span>
        <div className="flex items-center gap-2">
          <input
            className="input"
            inputMode="numeric"
            placeholder={t("products.filters.min")}
            value={form.minPrice}
            onChange={(event) => update("minPrice", event.target.value.replace(/\D/g, ""))}
          />
          <span className="text-muted">–</span>
          <input
            className="input"
            inputMode="numeric"
            placeholder={t("products.filters.max")}
            value={form.maxPrice}
            onChange={(event) => update("maxPrice", event.target.value.replace(/\D/g, ""))}
          />
        </div>
      </div>

      <label className="block">
        <span className="label">{t("products.filters.location")}</span>
        <input
          className="input"
          value={form.location}
          onChange={(event) => update("location", event.target.value)}
          placeholder="Улаанбаатар, Баянхонгор…"
        />
      </label>

      <div className="space-y-2 border-t border-line pt-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-clay)]"
            checked={form.international === "true"}
            onChange={(event) => update("international", event.target.checked ? "true" : "")}
          />
          {t("products.filters.international")}
        </label>
      </div>

      <button type="submit" className="btn-primary w-full">
        {t("products.apply")}
      </button>
    </form>
  );
}
