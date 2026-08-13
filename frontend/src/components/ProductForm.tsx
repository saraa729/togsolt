"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import type { Category, InventoryType, Product } from "@/lib/types";
import ImageUploader from "./ImageUploader";
import { Alert, Field, Spinner } from "./ui";

const INVENTORY_TYPES: InventoryType[] = ["ready_made", "limited_stock", "one_of_one", "made_to_order"];

export default function ProductForm({ product }: { product?: Product }) {
  const { t, locale } = useApp();
  const router = useRouter();
  const editing = Boolean(product);

  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    categoryId: product?.categoryId || "",
    titleMn: product?.title?.mn || "",
    titleEn: product?.title?.en || "",
    descriptionMn: product?.description?.mn || "",
    descriptionEn: product?.description?.en || "",
    techniqueMn: (product as any)?.techniqueDescription?.mn || "",
    techniqueEn: (product as any)?.techniqueDescription?.en || "",
    priceMnt: product?.price?.currency === "MNT" ? String(product.price.amount) : "",
    priceUsd: product?.internationalPrice ? String(product.internationalPrice.amount) : "",
    inventoryType: (product?.inventoryType || "limited_stock") as InventoryType,
    stock: String(product?.stock ?? 1),
    productionDays: String(product?.productionDays ?? 7),
    materials: (product?.materials || []).join(", "),
    techniques: (product?.techniques || []).join(", "),
    styles: (product?.styles || []).join(", "),
    images: (product?.images || []).join("\n"),
    weightGram: String(product?.weightGram ?? ""),
    shipsInternationally: Boolean(product?.shipsInternationally),
    customEnabled: Boolean(product?.customEnabled),
  });
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    api
      .get<{ categories: Category[] }>("/categories", { query: { locale }, token: null })
      .then((data) => {
        setCategories(data.categories || []);
        setForm((prev) => ({ ...prev, categoryId: prev.categoryId || data.categories?.[0]?.id || "" }));
      })
      .catch(() => undefined);
  }, [locale]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function localized(mn: string, en: string) {
    const value: Record<string, string> = {};
    if (mn.trim()) value.mn = mn.trim();
    if (en.trim()) value.en = en.trim();
    return value;
  }

  function listOf(value: string) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function askAi() {
    setAiBusy(true);
    try {
      const data = await api.post<{ suggestions: any }>("/ai/products/suggest", {
        title: form.titleMn || form.titleEn,
        description: form.descriptionMn || form.descriptionEn,
        mn: form.descriptionMn,
      });
      const suggestions = data.suggestions || {};
      const category = categories.find((item) => item.slug === suggestions.categorySlug);
      setForm((prev) => ({
        ...prev,
        categoryId: category?.id || prev.categoryId,
        materials: prev.materials || (suggestions.materials || []).join(", "),
        techniques: prev.techniques || (suggestions.techniques || []).join(", "),
        descriptionEn: prev.descriptionEn || suggestions.translation?.en || "",
      }));
      setMessage({ tone: "success", text: t("seller.aiSuggest") });
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setAiBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const payload: Record<string, unknown> = {
      categoryId: form.categoryId,
      title: localized(form.titleMn, form.titleEn),
      description: localized(form.descriptionMn, form.descriptionEn),
      price: { amount: Number(form.priceMnt || 0), currency: "MNT" },
      internationalPrice: form.priceUsd ? { amount: Number(form.priceUsd), currency: "USD" } : null,
      inventoryType: form.inventoryType,
      stock: Number(form.stock || 0),
      productionDays: Number(form.productionDays || 7),
      materials: listOf(form.materials),
      techniques: listOf(form.techniques),
      styles: listOf(form.styles),
      images: form.images
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
      weightGram: Number(form.weightGram || 0),
      shipsInternationally: form.shipsInternationally,
      customEnabled: form.customEnabled,
    };

    const technique = localized(form.techniqueMn, form.techniqueEn);
    if (Object.keys(technique).length) payload.techniqueDescription = technique;

    try {
      if (editing && product) {
        await api.patch(`/seller/products/${product.id}`, payload);
        setMessage({ tone: "success", text: t("common.saved") });
      } else {
        await api.post("/products", payload);
        router.push("/seller/products");
      }
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{editing ? t("common.update") : t("seller.newProduct")}</h1>
        <button type="button" className="btn-secondary btn-sm" disabled={aiBusy} onClick={askAi}>
          {aiBusy ? <Spinner className="h-3 w-3" /> : "✦"} {t("seller.aiSuggest")}
        </button>
      </div>

      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      <section className="card-pad space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("seller.titleMn")} required>
            <input className="input" required value={form.titleMn} onChange={(event) => update("titleMn", event.target.value)} />
          </Field>
          <Field label={t("seller.titleEn")} hint={t("common.optional")}>
            <input className="input" value={form.titleEn} onChange={(event) => update("titleEn", event.target.value)} />
          </Field>
          <Field label={t("seller.descMn")} required>
            <textarea className="textarea" required value={form.descriptionMn} onChange={(event) => update("descriptionMn", event.target.value)} />
          </Field>
          <Field label={t("seller.descEn")} hint={t("common.optional")}>
            <textarea className="textarea" value={form.descriptionEn} onChange={(event) => update("descriptionEn", event.target.value)} />
          </Field>
          <Field label={t("seller.techniqueMn")}>
            <textarea className="textarea" value={form.techniqueMn} onChange={(event) => update("techniqueMn", event.target.value)} />
          </Field>
          <Field label={t("seller.techniqueEn")}>
            <textarea className="textarea" value={form.techniqueEn} onChange={(event) => update("techniqueEn", event.target.value)} />
          </Field>
        </div>
      </section>

      <section className="card-pad space-y-4">
        <h2 className="font-medium">{t("products.filters.inventory")}</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {INVENTORY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                update("inventoryType", type);
                if (type === "one_of_one") update("stock", "1");
                if (type === "limited_stock" && Number(form.stock) < 1) update("stock", "5");
              }}
              className={`cursor-pointer rounded-xl border p-3 text-left text-sm transition-colors ${
                form.inventoryType === type ? "border-clay bg-clay-soft/50" : "border-line"
              }`}
            >
              {t(`inv.${type}`)}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label={t("seller.stock")}
            hint={form.inventoryType === "made_to_order" ? t("common.optional") : undefined}
          >
            <input
              className="input"
              inputMode="numeric"
              disabled={form.inventoryType === "one_of_one"}
              value={form.inventoryType === "one_of_one" ? "1" : form.stock}
              onChange={(event) => update("stock", event.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Field label={t("seller.productionDays")}>
            <input
              className="input"
              inputMode="numeric"
              value={form.productionDays}
              onChange={(event) => update("productionDays", event.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Field label={`${t("product.weight")} (g)`}>
            <input
              className="input"
              inputMode="numeric"
              value={form.weightGram}
              onChange={(event) => update("weightGram", event.target.value.replace(/\D/g, ""))}
            />
          </Field>
        </div>
      </section>

      <section className="card-pad space-y-4">
        <h2 className="font-medium">{t("common.price")}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("seller.priceMnt")} required>
            <input
              className="input"
              required
              inputMode="numeric"
              value={form.priceMnt}
              onChange={(event) => update("priceMnt", event.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Field label={t("seller.priceUsd")} hint={t("common.optional")}>
            <input
              className="input"
              inputMode="decimal"
              placeholder="0.00"
              value={form.priceUsd}
              // Доллар цент дэмждэг: цэгийг зөвшөөрөх ба зөвхөн НЭГ цэг, 2 орон.
              onChange={(event) =>
                update("priceUsd", (event.target.value.replace(/[^\d.]/g, "").match(/^\d*\.?\d{0,2}/) || [""])[0])
              }
            />
          </Field>
          <Field label={t("common.category")} required>
            <select className="input" required value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nameText}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="card-pad space-y-4">
        <h2 className="font-medium">{t("common.details")}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("seller.materialsHint")}>
            <input className="input" value={form.materials} onChange={(event) => update("materials", event.target.value)} placeholder="felt, wool" />
          </Field>
          <Field label={t("seller.techniquesHint")}>
            <input className="input" value={form.techniques} onChange={(event) => update("techniques", event.target.value)} placeholder="hand_felting" />
          </Field>
          <Field label={`${t("common.details")} / styles`}>
            <input className="input" value={form.styles} onChange={(event) => update("styles", event.target.value)} placeholder="traditional" />
          </Field>
        </div>
        <ImageUploader
          label={t("common.image")}
          urls={form.images.split("\n").map((item) => item.trim()).filter(Boolean)}
          onChange={(next) => update("images", next.join("\n"))}
        />
        <Field label={t("seller.imagesHint")}>
          <textarea
            className="textarea"
            value={form.images}
            onChange={(event) => update("images", event.target.value)}
            placeholder="https://images.unsplash.com/photo-…"
          />
        </Field>
        <div className="flex flex-wrap gap-5">
          {(
            [
              ["shipsInternationally", t("seller.shipsIntl")],
              ["customEnabled", t("seller.customEnabled")],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-clay"
                checked={form[key] as boolean}
                onChange={(event) => update(key, event.target.checked as never)}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Spinner /> : null}
          {editing ? t("common.save") : t("seller.publish")}
        </button>
        <button type="button" className="btn-ghost" onClick={() => router.push("/seller/products")}>
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
