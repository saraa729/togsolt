"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, EmptyState, Field, Spinner, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatAmount, formatDate } from "@/lib/format";
import type { Coupon } from "@/lib/types";

export default function SellerCouponsPage() {
  const { t, locale } = useApp();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [usageLimit, setUsageLimit] = useState("100");
  const [expiresAt, setExpiresAt] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ coupons: Coupon[] }>("/seller/coupons");
      setCoupons(data.coupons || []);
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api.post("/seller/coupons", {
        code: code.trim().toUpperCase(),
        type,
        value: Number(value),
        currency: "MNT",
        minSubtotal: minSubtotal ? { amount: Number(minSubtotal), currency: "MNT" } : undefined,
        usageLimit: Number(usageLimit || 100),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      setCode("");
      setValue("");
      setMinSubtotal("");
      setExpiresAt("");
      setMessage({ tone: "success", text: t("seller.couponCreated") });
      await load();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="card h-64 skeleton" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("seller.coupons")}</h1>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      <section className="card-pad space-y-4">
        <h2 className="font-medium">{t("seller.newCoupon")}</h2>

        <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
          <Field label={t("seller.couponCode")} required>
            <input
              className="input uppercase"
              required
              placeholder="ZUN2026"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </Field>

          <Field label={t("seller.couponType")} required>
            <select
              className="input"
              value={type}
              onChange={(event) => setType(event.target.value as "percent" | "amount")}
            >
              <option value="percent">{t("seller.couponPercent")}</option>
              <option value="amount">{t("seller.couponAmount")}</option>
            </select>
          </Field>

          <Field label={t("seller.couponValue")} required>
            <input
              className="input"
              type="number"
              required
              min={1}
              max={type === "percent" ? 100 : undefined}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </Field>

          <Field label={t("seller.couponMinSubtotal")}>
            <input
              className="input"
              type="number"
              min={0}
              step={1000}
              value={minSubtotal}
              onChange={(event) => setMinSubtotal(event.target.value)}
            />
          </Field>

          <Field label={t("seller.couponUsageLimit")}>
            <input
              className="input"
              type="number"
              min={1}
              value={usageLimit}
              onChange={(event) => setUsageLimit(event.target.value)}
            />
          </Field>

          <Field label={t("seller.couponExpiresAt")}>
            <input
              className="input"
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </Field>

          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Spinner /> : null}
              {t("seller.couponCreate")}
            </button>
          </div>
        </form>
      </section>

      {coupons.length === 0 ? (
        <EmptyState title={t("seller.couponEmpty")} />
      ) : (
        <div className="space-y-3">
          {coupons.map((coupon) => (
            <article key={coupon.id} className="card-pad">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono font-medium tracking-wider">{coupon.code}</p>
                  <p className="muted mt-1 text-sm">
                    {coupon.type === "percent"
                      ? `${coupon.value}%`
                      : formatAmount(coupon.value, coupon.currency)}
                    {coupon.minSubtotal ? ` · ≥ ${formatAmount(coupon.minSubtotal.amount, coupon.currency)}` : ""}
                    {coupon.expiresAt ? ` · ${formatDate(coupon.expiresAt, locale)}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <StatusPill status={coupon.status} />
                  <p className="muted mt-1 text-xs">
                    {t("seller.couponUsage", { used: coupon.usedCount, limit: coupon.usageLimit })}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
