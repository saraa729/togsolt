"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import type { Shop } from "@/lib/types";
import ImageUploader from "./ImageUploader";
import { Alert, Field, Spinner } from "./ui";

export default function ShopForm({ shop, onSaved }: { shop?: Shop | null; onSaved?: () => void }) {
  const { t } = useApp();
  const { refreshMe } = useAuth();
  const editing = Boolean(shop);

  const [form, setForm] = useState({
    displayName: shop?.displayName || "",
    storyMn: shop?.story?.mn || "",
    storyEn: shop?.story?.en || "",
    city: shop?.city || "Улаанбаатар",
    province: shop?.province || "Улаанбаатар",
    district: shop?.district || "",
    logoUrl: shop?.logoUrl || "",
    bannerUrl: shop?.bannerUrl || "",
    makerName: shop?.artisanProfile?.makerName || "",
    portraitUrl: shop?.artisanProfile?.portraitUrl || "",
    processMn: shop?.artisanProfile?.process?.mn || "",
    processEn: shop?.artisanProfile?.process?.en || "",
    years: String(shop?.artisanProfile?.yearsOfExperience ?? ""),
    phone: shop?.contact?.phone || "",
    email: shop?.contact?.email || "",
    facebook: shop?.contact?.facebook || "",
    instagram: shop?.contact?.instagram || "",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const story: Record<string, string> = {};
    if (form.storyMn.trim()) story.mn = form.storyMn.trim();
    if (form.storyEn.trim()) story.en = form.storyEn.trim();

    const process: Record<string, string> = {};
    if (form.processMn.trim()) process.mn = form.processMn.trim();
    if (form.processEn.trim()) process.en = form.processEn.trim();

    const payload: Record<string, unknown> = {
      displayName: form.displayName.trim(),
      story,
      city: form.city.trim(),
      province: form.province.trim() || form.city.trim(),
      district: form.district.trim() || null,
      logoUrl: form.logoUrl.trim() || null,
      bannerUrl: form.bannerUrl.trim() || null,
      contact: {
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        facebook: form.facebook.trim() || null,
        instagram: form.instagram.trim() || null,
      },
      artisanProfile: {
        makerName: form.makerName.trim() || form.displayName.trim(),
        portraitUrl: form.portraitUrl.trim() || null,
        ...(Object.keys(process).length ? { process } : {}),
        yearsOfExperience: Number(form.years || 0),
      },
    };

    try {
      if (editing) await api.patch("/seller/shop", payload);
      else await api.post("/seller/shop", payload);
      await refreshMe();
      setMessage({ tone: "success", text: t("common.saved") });
      onSaved?.();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card-pad space-y-5">
      <div>
        <h2 className="font-medium">{editing ? t("seller.myShop") : t("seller.createShopTitle")}</h2>
        {!editing ? <p className="muted mt-1">{t("seller.createShopHint")}</p> : null}
      </div>

      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("seller.shopName")} required>
          <input className="input" required value={form.displayName} onChange={(event) => update("displayName", event.target.value)} />
        </Field>
        <Field label={t("seller.makerName")}>
          <input className="input" value={form.makerName} onChange={(event) => update("makerName", event.target.value)} />
        </Field>
        <Field label={t("seller.city")} required>
          <input className="input" required value={form.city} onChange={(event) => update("city", event.target.value)} />
        </Field>
        <Field label={t("seller.district")}>
          <input className="input" value={form.district} onChange={(event) => update("district", event.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("seller.storyMn")} required>
          <textarea className="textarea" required value={form.storyMn} onChange={(event) => update("storyMn", event.target.value)} />
        </Field>
        <Field label={t("seller.storyEn")} hint={t("common.optional")}>
          <textarea className="textarea" value={form.storyEn} onChange={(event) => update("storyEn", event.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`${t("shop.process")} (MN)`}>
          <textarea className="textarea" value={form.processMn} onChange={(event) => update("processMn", event.target.value)} />
        </Field>
        <Field label={`${t("shop.process")} (EN)`}>
          <textarea className="textarea" value={form.processEn} onChange={(event) => update("processEn", event.target.value)} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <ImageUploader
            label={t("seller.logo")}
            multiple={false}
            urls={form.logoUrl ? [form.logoUrl] : []}
            onChange={(next) => update("logoUrl", next[0] || "")}
          />
          <input
            className="input mt-2"
            value={form.logoUrl}
            onChange={(event) => update("logoUrl", event.target.value)}
            placeholder="https://…"
          />
        </div>
        <div>
          <ImageUploader
            label={t("seller.banner")}
            multiple={false}
            urls={form.bannerUrl ? [form.bannerUrl] : []}
            onChange={(next) => update("bannerUrl", next[0] || "")}
          />
          <input
            className="input mt-2"
            value={form.bannerUrl}
            onChange={(event) => update("bannerUrl", event.target.value)}
            placeholder="https://…"
          />
        </div>
        <div>
          <ImageUploader
            label={t("seller.portrait")}
            multiple={false}
            urls={form.portraitUrl ? [form.portraitUrl] : []}
            onChange={(next) => update("portraitUrl", next[0] || "")}
          />
          <input
            className="input mt-2"
            value={form.portraitUrl}
            onChange={(event) => update("portraitUrl", event.target.value)}
            placeholder="https://…"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={t("seller.years")}>
          <input className="input" inputMode="numeric" value={form.years} onChange={(event) => update("years", event.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label={t("common.phone")}>
          <input className="input" value={form.phone} onChange={(event) => update("phone", event.target.value)} />
        </Field>
        <Field label={t("common.email")}>
          <input className="input" value={form.email} onChange={(event) => update("email", event.target.value)} />
        </Field>
        <Field label="Facebook">
          <input className="input" value={form.facebook} onChange={(event) => update("facebook", event.target.value)} />
        </Field>
      </div>

      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? <Spinner /> : null}
        {editing ? t("common.save") : t("common.create")}
      </button>
    </form>
  );
}
