"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert, Field, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";

function ResetPasswordView() {
  const { t } = useApp();
  const router = useRouter();
  const params = useSearchParams();

  // Токеныг и-мэйлийн холбоосоос авна, гэхдээ гараар ч оруулж болно.
  const [token, setToken] = useState(params.get("token") || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError(t("auth.resetMismatch"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/reset-password", { token: token.trim(), password }, { token: null });
      setDone(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page max-w-md py-16">
      <div className="card-pad">
        <h1 className="display text-xl">{t("auth.resetTitle")}</h1>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {error ? <Alert tone="error">{error}</Alert> : null}
          {done ? <Alert tone="success">{t("auth.resetDone")}</Alert> : null}

          <Field label={t("auth.resetToken")} required>
            <input
              className="input"
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </Field>

          <Field label={t("auth.resetNewPassword")} required>
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

          <Field label={t("auth.resetConfirm")} required>
            <input
              className="input"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </Field>

          <button type="submit" className="btn-primary w-full" disabled={busy || done}>
            {busy ? <Spinner /> : null}
            {t("auth.resetSubmit")}
          </button>
        </form>

        <p className="muted mt-6 text-center text-xs">
          <Link href="/login" className="link">
            {t("auth.backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="page max-w-md py-16">
          <div className="card h-96 skeleton" />
        </div>
      }
    >
      <ResetPasswordView />
    </Suspense>
  );
}
