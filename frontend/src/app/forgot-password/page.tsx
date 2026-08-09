"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Field, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";

type ForgotResponse = { ok: boolean; resetToken?: string };

export default function ForgotPasswordPage() {
  const { t } = useApp();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  /*
   * Production дээр backend токеныг буцаадаггүй (и-мэйлээр явна). Хөгжүүлэлтийн
   * үед буцаадаг тул шууд үргэлжлүүлэх холбоос болгож үзүүлнэ.
   */
  const [devToken, setDevToken] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api.post<ForgotResponse>(
        "/auth/forgot-password",
        { email: email.trim().toLowerCase() },
        { token: null }
      );
      setSent(true);
      setDevToken(data.resetToken || null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page max-w-md py-16">
      <div className="card-pad">
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.forgotTitle")}</h1>
        <p className="muted mt-1">{t("auth.forgotIntro")}</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {error ? <Alert tone="error">{error}</Alert> : null}
          {sent ? <Alert tone="success">{t("auth.forgotSent")}</Alert> : null}

          {devToken ? (
            <Alert tone="warn">
              <p>{t("auth.forgotDevToken")}</p>
              <code className="mt-2 block break-all rounded-lg bg-white/60 px-2 py-1 text-xs">{devToken}</code>
              <Link href={`/reset-password?token=${encodeURIComponent(devToken)}`} className="btn-secondary btn-sm mt-3">
                {t("auth.resetTitle")}
              </Link>
            </Alert>
          ) : null}

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

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <Spinner /> : null}
            {t("auth.forgotSubmit")}
          </button>
        </form>

        <Link href="/login" className="muted mt-6 inline-block text-sm hover:text-ink">
          {t("auth.backToLogin")}
        </Link>
      </div>
    </div>
  );
}
