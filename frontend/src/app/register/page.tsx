"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { Alert, Field, Spinner } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { classNames } from "@/lib/format";
import type { Role } from "@/lib/types";

function RegisterForm() {
  const { t, locale } = useApp();
  const { register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [role, setRole] = useState<Role>(params.get("role") === "seller" ? "seller" : "buyer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("MN");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        country,
        locale,
        roles: role === "seller" ? ["buyer", "seller"] : ["buyer"],
      });
      router.push(role === "seller" ? "/seller" : "/home");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page max-w-lg py-14">
      <div className="card-pad">
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.registerTitle")}</h1>
        <p className="muted mt-1">{t("brand.tagline")}</p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-paper p-1">
          {(["buyer", "seller"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              className={classNames(
                "cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                role === value ? "bg-surface text-ink shadow-sm" : "text-muted"
              )}
            >
              {value === "buyer" ? t("auth.asBuyer") : t("auth.asSeller")}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {error ? <Alert tone="error">{error}</Alert> : null}

          <Field label={t("common.name")} required>
            <input className="input" required value={name} onChange={(event) => setName(event.target.value)} />
          </Field>

          <Field label={t("common.email")} required>
            <input
              className="input"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field label={t("common.password")} hint={t("auth.passwordHint")} required>
            <input
              className="input"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("checkout.country")}>
              <select className="input" value={country} onChange={(event) => setCountry(event.target.value)}>
                <option value="MN">Монгол (MN)</option>
                <option value="US">United States (US)</option>
                <option value="DE">Germany (DE)</option>
                <option value="JP">Japan (JP)</option>
                <option value="KR">Korea (KR)</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label={t("common.phone")} hint={country === "MN" ? t("auth.phoneHint") : t("common.optional")}>
              <input
                className="input"
                value={phone}
                required={country === "MN"}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+976 99112233"
              />
            </Field>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <Spinner /> : null}
            {t("auth.registerTitle")}
          </button>
        </form>

        <div className="mt-5">
          <GoogleSignInButton
            roles={role === "seller" ? ["buyer", "seller"] : ["buyer"]}
            onSuccess={() => router.push(role === "seller" ? "/seller" : "/home")}
          />
        </div>

        {role === "seller" ? (
          <p className="muted mt-4 rounded-xl bg-paper p-3 text-xs">{t("seller.createShopHint")}</p>
        ) : null}

        <p className="muted mt-5 text-center">
          {t("auth.hasAccount")}{" "}
          <Link href="/login" className="link">
            {t("nav.login")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="page max-w-lg py-14"><div className="card h-96 skeleton" /></div>}>
      <RegisterForm />
    </Suspense>
  );
}
