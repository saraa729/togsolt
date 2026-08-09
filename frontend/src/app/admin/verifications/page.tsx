"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, EmptyState, Spinner, StatusPill } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { formatDate, imageOrPlaceholder, initials } from "@/lib/format";
import type { Shop } from "@/lib/types";

const FILTERS = ["pending_verification", "verified", "rejected", ""] as const;

export default function AdminVerificationsPage() {
  const { t, locale } = useApp();
  const [shops, setShops] = useState<Shop[]>([]);
  const [filter, setFilter] = useState<string>("pending_verification");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ shops: Shop[] }>("/admin/seller-verifications", {
        query: filter ? { status: filter } : {},
      });
      setShops(data.shops || []);
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(shopId: string, status: "verified" | "rejected", note?: string) {
    setBusy(shopId);
    setMessage(null);
    try {
      await api.patch(`/admin/shops/${shopId}/verification`, { status, note });
      setMessage({ tone: "success", text: t("common.saved") });
      await load();
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.verifications")}</h1>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <button
            key={value || "all"}
            type="button"
            className={filter === value ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
            onClick={() => setFilter(value)}
          >
            {value === "" ? t("common.all") : value === "pending_verification" ? t("shop.pending") : value === "verified" ? t("shop.verified") : t("admin.reject")}
          </button>
        ))}
      </div>

      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

      {loading ? (
        <div className="card h-64 skeleton" />
      ) : shops.length === 0 ? (
        <EmptyState title={t("common.empty")} />
      ) : (
        <div className="space-y-4">
          {shops.map((shop) => (
            <article key={shop.id} className="card-pad">
              <div className="flex flex-wrap items-start gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-pine text-sm font-semibold text-white">
                  {shop.logoUrl || shop.artisanProfile?.portraitUrl ? (
                    <img
                      src={imageOrPlaceholder(shop.logoUrl || shop.artisanProfile?.portraitUrl)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials(shop.displayName)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{shop.displayName}</p>
                    <StatusPill status={shop.status} />
                  </div>
                  <p className="muted text-xs">
                    {shop.seller?.email} · {[shop.province, shop.district].filter(Boolean).join(", ")} ·{" "}
                    {formatDate(shop.createdAt, locale)}
                  </p>
                  <p className="muted mt-2 line-clamp-3">{shop.story?.mn || shop.story?.en || "—"}</p>
                  {shop.status === "verified" ? (
                    <Link href={`/shop/${shop.slug}`} className="link mt-2 inline-block text-xs">
                      /shop/{shop.slug}
                    </Link>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={busy === shop.id || shop.status === "verified"}
                    onClick={() => review(shop.id, "verified")}
                  >
                    {busy === shop.id ? <Spinner className="h-3 w-3" /> : null}
                    {t("admin.approve")}
                  </button>
                  <button
                    type="button"
                    className="btn-danger btn-sm"
                    disabled={busy === shop.id || shop.status === "rejected"}
                    onClick={() => review(shop.id, "rejected", "Гар урлалын шаардлага хангаагүй")}
                  >
                    {t("admin.reject")}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
