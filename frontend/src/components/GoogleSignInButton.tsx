"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import type { Role, User } from "@/lib/types";
import { Alert, Field, Spinner } from "./ui";

const GSI_SRC = "https://accounts.google.com/gsi/client";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

type GoogleIdApi = {
  accounts?: {
    id?: {
      initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
      renderButton: (
        parent: HTMLElement,
        options: { type?: string; theme?: string; size?: string; width?: number }
      ) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdApi;
  }
}

/** Google Identity Services скриптийг нэг л удаа ачаална. */
let gsiPromise: Promise<void> | null = null;

function loadGsi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (gsiPromise) return gsiPromise;

  gsiPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("gsi_load_failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gsi_load_failed"));
    document.head.appendChild(script);
  });

  return gsiPromise;
}

/**
 * "Google-ээр нэвтрэх" товч.
 *
 * Google-ийн буцаасан ID токеныг backend руу дамжуулна — backend түүнийг Google
 * дээр баталгаажуулж, и-мэйлийг ТОКЕНООС авна. Хэрэглэгчийн и-мэйлийг клиентээс
 * илгээх нь ямар ч баталгаа болохгүй тул огт илгээхгүй.
 *
 * `NEXT_PUBLIC_GOOGLE_CLIENT_ID` тохируулаагүй бол товч огт харагдахгүй —
 * ажиллахгүй товч харуулснаас нуусан нь дээр.
 */
export default function GoogleSignInButton({
  roles,
  onSuccess,
}: {
  roles?: Role[];
  onSuccess?: (user: User) => void;
}) {
  const { t, locale } = useApp();
  const { loginWithGoogle } = useAuth();
  const holder = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  /*
   * Google утасны дугаар өгдөггүй. Дотоодын худалдан авагчид утас заавал
   * шаардлагатай тул шинэ хэрэглэгч бүртгэхэд backend `phone_required` буцаана.
   * Тэр үед токеныг түр хадгалж, утсыг асуугаад дахин илгээнэ.
   */
  const [pendingCredential, setPendingCredential] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [abroad, setAbroad] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submitCredential(credential: string, extra?: { phone?: string; country?: string }) {
    try {
      const user = await loginWithGoogle({ credential, locale, roles, ...extra });
      setPendingCredential(null);
      onSuccess?.(user);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "phone_required") {
        setPendingCredential(credential);
        setError(null);
        return;
      }
      setPendingCredential(null);
      setError(errorMessage(caught));
    }
  }

  /*
   * Google SDK-д өгсөн callback-ийг солих боломжгүй тул хамгийн сүүлийн
   * хувилбарыг ref-ээр дамжуулна. Эс бөгөөс `submitCredential`-ийг хамаарал
   * болгоход render бүрд Google дахин эхэлж, товч анивчина.
   */
  const submitRef = useRef(submitCredential);
  useEffect(() => {
    submitRef.current = submitCredential;
  });

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    loadGsi()
      .then(() => {
        if (cancelled || !holder.current) return;
        const identity = window.google?.accounts?.id;
        if (!identity) return;

        identity.initialize({
          client_id: CLIENT_ID,
          callback: (response) => {
            if (!response.credential) return;
            setError(null);
            submitRef.current(response.credential);
          },
        });

        // Товчны бичвэр, хэлийг Google өөрөө хуудасны хэлээр сонгоно.
        identity.renderButton(holder.current, { type: "standard", theme: "outline", size: "large", width: 320 });
      })
      .catch(() => {
        if (!cancelled) setError(t("auth.googleUnavailable"));
      });

    return () => {
      cancelled = true;
    };
    // Google-ийг нэг л удаа эхлүүлнэ — хамаарлыг ref барьж байгаа тул энд оруулахгүй.
  }, [t]);

  if (!CLIENT_ID) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10px] tracking-[0.18em] text-muted uppercase">{t("auth.or")}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      {/* Утас асуух үед Google товчийг нуухгүй — хэрэглэгч буцаж болно. */}
      <div ref={holder} className={pendingCredential ? "hidden" : "flex justify-center"} />

      {pendingCredential ? (
        <form
          className="space-y-3 rounded-2xl border border-line bg-paper p-4"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            submitCredential(pendingCredential, abroad ? { country: "OTHER" } : { phone: phone.trim() }).finally(() =>
              setBusy(false)
            );
          }}
        >
          <p className="text-sm font-medium">{t("auth.googlePhoneTitle")}</p>
          <p className="muted text-xs">{t("auth.googlePhoneHint")}</p>

          {!abroad ? (
            <Field label={t("common.phone")} required>
              <input
                className="input"
                required
                autoFocus
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </Field>
          ) : null}

          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={abroad} onChange={(event) => setAbroad(event.target.checked)} />
            {t("auth.googleAbroad")}
          </label>

          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={busy || (!abroad && !phone.trim())}>
              {busy ? <Spinner /> : null}
              {t("common.confirm")}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setPendingCredential(null);
                setPhone("");
                setAbroad(false);
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
