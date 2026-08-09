"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { Alert, Field, Spinner } from "@/components/ui";
import { api, errorMessage, setTokens } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { formatDate } from "@/lib/format";

export default function AccountPage() {
  return (
    <RequireAuth>
      <AccountView />
    </RequireAuth>
  );
}

function AccountView() {
  const { t, locale } = useApp();
  const { user, hasRole, refreshMe } = useAuth();
  const [form, setForm] = useState({ name: "", phone: "", country: "MN" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user) setForm({ name: user.name || "", phone: user.phone || "", country: user.country || "MN" });
  }, [user]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api.patch("/me", { name: form.name, phone: form.phone || null, country: form.country, locale });
      await refreshMe();
      setMessage({ tone: "success", text: t("account.profileSaved") });
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  async function becomeSeller() {
    setBusy(true);
    try {
      const response = await api.post<{ user: typeof user; accessToken?: string; refreshToken?: string }>("/me/roles/seller");
      if (response.accessToken && response.refreshToken) {
        setTokens(response.accessToken, response.refreshToken);
      }
      await refreshMe();
      setMessage({ tone: "success", text: t("common.saved") });
    } catch (caught) {
      setMessage({ tone: "error", text: errorMessage(caught) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page max-w-3xl py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("account.title")}</h1>

      <div className="mt-6 grid gap-5">
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}

        <section className="card-pad">
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-pine text-lg font-semibold text-white">
              {(user?.name || "?").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <p className="font-medium">{user?.name}</p>
              <p className="muted text-xs">{user?.email}</p>
            </div>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {(user?.roles || []).map((role) => (
                <span key={role} className="badge-neutral">
                  {t(`common.${role}`)}
                </span>
              ))}
            </div>
          </div>
          <p className="muted mt-4 text-xs">
            {t("common.date")}: {formatDate(user?.createdAt, locale)} · {user?.emailVerified ? "✓" : "✗"} email
          </p>
        </section>

        <form onSubmit={save} className="card-pad space-y-4">
          <h2 className="font-medium">{t("account.title")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("common.name")} required>
              <input className="input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label={t("common.phone")}>
              <input className="input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </Field>
            <Field label={t("checkout.country")}>
              <select className="input" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })}>
                <option value="MN">Монгол (MN)</option>
                <option value="US">United States</option>
                <option value="DE">Germany</option>
                <option value="JP">Japan</option>
                <option value="KR">Korea</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label={t("common.email")}>
              <input className="input" value={user?.email || ""} disabled />
            </Field>
          </div>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? <Spinner /> : null}
            {t("common.save")}
          </button>
        </form>

        {!hasRole("seller") ? (
          <section className="card-pad bg-clay-soft/40">
            <h2 className="font-medium">{t("account.becomeSeller")}</h2>
            <p className="muted mt-1">{t("account.becomeSellerHint")}</p>
            <button type="button" className="btn-primary mt-4" disabled={busy} onClick={becomeSeller}>
              {t("account.becomeSeller")}
            </button>
          </section>
        ) : (
          <section className="card-pad">
            <h2 className="font-medium">{t("nav.seller")}</h2>
            <Link href="/seller" className="btn-secondary mt-3">
              {t("seller.title")}
            </Link>
          </section>
        )}

        <section className="grid gap-3 sm:grid-cols-3">
          <Link href="/orders" className="card-pad hover:bg-paper">
            <p className="font-medium">{t("nav.orders")}</p>
            <p className="muted text-xs">{t("orders.title")}</p>
          </Link>
          <Link href="/favorites" className="card-pad hover:bg-paper">
            <p className="font-medium">{t("nav.favorites")}</p>
            <p className="muted text-xs">{t("favorites.title")}</p>
          </Link>
          <Link href="/custom-requests" className="card-pad hover:bg-paper">
            <p className="font-medium">{t("nav.custom")}</p>
            <p className="muted text-xs">{t("custom.title")}</p>
          </Link>
        </section>
      </div>
    </div>
  );
}
