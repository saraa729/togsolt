"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/app-context";

export default function ProductFilters() {
  const { t } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const initial = useMemo(() => Object.fromEntries(params?.entries() || []), [params]);
  const [query, setQuery] = useState(initial.q || "");

  function apply(event?: React.FormEvent) {
    event?.preventDefault();
    const search = new URLSearchParams();
    const value = query.trim();
    if (value) search.set("q", value);
    router.push(`/products${search.toString() ? `?${search}` : ""}`);
  }

  function reset() {
    setQuery("");
    router.push("/products");
  }

  return (
    <form onSubmit={apply} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 sm:flex-row sm:items-center">
      <label className="min-w-0 flex-1">
        <span className="sr-only">{t("common.search")}</span>
        <input
          className="input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("products.searchPlaceholder")}
        />
      </label>

      <div className="flex shrink-0 gap-2">
        {query || initial.q ? (
          <button type="button" className="btn-secondary" onClick={reset}>
            {t("common.clear")}
          </button>
        ) : null}
        <button type="submit" className="btn-primary">
          {t("common.search")}
        </button>
      </div>
    </form>
  );
}
