"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import type { User } from "@/lib/types";
import { Alert, Field, Spinner } from "./ui";

/**
 * Нэвтрэх форм. `onSuccess` өгөөгүй бол зүгээр л auth context шинэчлэгдэж,
 * дуудсан хэсэг өөрөө шийднэ.
 */
export default function LoginForm({ onSuccess }: { onSuccess?: (user: User) => void }) {
  const { t } = useApp();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Хуудас SSR-ээр гарч ирсэн ч JS ачаалж дуусаагүй бол `onSubmit` хараахан
   * холбогдоогүй байдаг. Тэр үед товч дарвал хөтөч native submit хийж хуудсыг
   * дахин ачаалаад бичсэнийг арчина — хэрэглэгчид "юу ч болсонгүй" мэт харагдана.
   * Тиймээс hydration дуустал товчийг идэвхгүй байлгана.
   */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(email.trim().toLowerCase(), password);
      onSuccess?.(user);
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="space-y-4">
        {error ? <Alert tone="error">{error}</Alert> : null}

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

        <Field label={t("common.password")} required>
          <input
            className="input"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <button type="submit" className="btn-primary w-full" disabled={busy || !hydrated}>
          {busy || !hydrated ? <Spinner /> : null}
          {hydrated ? t("auth.loginTitle") : t("common.loading")}
        </button>

        <p className="text-center">
          <Link href="/forgot-password" className="link text-xs">
            {t("auth.forgotLink")}
          </Link>
        </p>
      </form>
    </div>
  );
}
