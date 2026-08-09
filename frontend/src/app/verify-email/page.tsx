"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Alert, Field, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";

function VerifyEmailView() {
  const { t } = useApp();
  const params = useSearchParams();
  const [token, setToken] = useState(params.get("token") || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const verify = useCallback(async (value: string) => {
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/verify-email", { token: value.trim() }, { token: null });
      setDone(true);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  /*
   * И-мэйлийн холбоосоор ирсэн бол хэрэглэгчээр товч даруулах шаардлагагүй —
   * шууд баталгаажуулна. `useRef` нь StrictMode-ийн давхар дуудлагаас хамгаална.
   */
  const autoRan = useRef(false);
  useEffect(() => {
    const initial = params.get("token");
    if (initial && !autoRan.current) {
      autoRan.current = true;
      verify(initial);
    }
  }, [params, verify]);

  return (
    <div className="page max-w-md py-16">
      <div className="card-pad">
        <h1 className="display text-xl">{t("auth.verifyTitle")}</h1>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            verify(token);
          }}
          className="mt-5 space-y-4"
        >
          {error ? <Alert tone="error">{error}</Alert> : null}
          {done ? <Alert tone="success">{t("auth.verifyDone")}</Alert> : null}

          <Field label={t("auth.resetToken")} required>
            <input
              className="input"
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </Field>

          <button type="submit" className="btn-primary w-full" disabled={busy || done}>
            {busy ? <Spinner /> : null}
            {t("auth.verifySubmit")}
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

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="page max-w-md py-16">
          <div className="card h-96 skeleton" />
        </div>
      }
    >
      <VerifyEmailView />
    </Suspense>
  );
}
