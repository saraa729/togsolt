"use client";

import { useCallback, useEffect, useState } from "react";
import ShopCard from "@/components/ShopCard";
import RequireAuth from "@/components/RequireAuth";
import { EmptyState } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import type { Shop } from "@/lib/types";

export default function FollowingPage() {
  return (
    <RequireAuth role="buyer">
      <FollowingView />
    </RequireAuth>
  );
}

function FollowingView() {
  const { t, locale } = useApp();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await api.get<{ shops: Shop[] }>("/follows/shops", { query: { locale } }).catch(() => ({ shops: [] }));
    setShops(data.shops || []);
    setLoading(false);
  }, [locale]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="page-wide py-10">
        <div className="h-9 w-60 rounded-full skeleton" />
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-64 rounded-2xl skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-wide py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="display text-[28px] leading-tight tracking-tight sm:text-[34px]">{t("following.title")}</h1>
        {shops.length ? <p className="muted text-sm">{t("following.count", { count: shops.length })}</p> : null}
      </header>

      {shops.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="◎"
            title={t("following.empty")}
            description={t("following.emptyHint")}
            actionLabel={t("nav.artisans")}
            actionHref="/artisans"
          />
        </div>
      ) : (
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => (
            <ShopCard key={shop.id} shop={shop} />
          ))}
        </div>
      )}
    </div>
  );
}
