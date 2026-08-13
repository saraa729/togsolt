"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import type { Role, User } from "@/lib/types";
import { Alert, Field, Spinner } from "./ui";

const GSI_SRC = "https://accounts.google.com/gsi/client";
const DEFAULT_GOOGLE_CLIENT_ID = "727216094961-nmhhimemqnqopfe440u5d7rd53rpae83.apps.googleusercontent.com";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
const GOOGLE_LOCAL_ORIGIN = process.env.NEXT_PUBLIC_GOOGLE_LOCAL_ORIGIN || "http://localhost:3000";

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

function isBlockedRawIpOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    const isIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
    const isLocalhostIp = hostname === "127.0.0.1" || hostname === "0.0.0.0";
    return isIpv4 && !isLocalhostIp;
  } catch {
    return false;
  }
}

function localhostUrl(): string {
  if (typeof window === "undefined") return `${GOOGLE_LOCAL_ORIGIN}/login`;
  const target = new URL(window.location.pathname + window.location.search + window.location.hash, GOOGLE_LOCAL_ORIGIN);
  return target.toString();
}

/**
 * "Google-ээр нэвтрэх" товч.
 *
 * Google-ийн буцаасан ID токеныг backend руу дамжуулна — backend түүнийг Google
 * дээр баталгаажуулж, и-мэйлийг ТОКЕНООС авна. Хэрэглэгчийн и-мэйлийг клиентээс
 * илгээх нь ямар ч баталгаа болохгүй тул огт илгээхгүй.
 *
 * `NEXT_PUBLIC_GOOGLE_CLIENT_ID` байхгүй үед demo Client ID ашиглана.
 * Raw IP дээр Google OAuth ажилладаггүй тул Google товчийг харагдуулаад
 * дарахад localhost руу шилжүүлнэ.
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
  const [googleReady, setGoogleReady] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState("");
  const isRawIpOrigin = isBlockedRawIpOrigin(currentOrigin);

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
    setCurrentOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!currentOrigin) return;
    if (isBlockedRawIpOrigin(currentOrigin)) {
      setGoogleLoading(false);
      setGoogleReady(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setGoogleLoading(true);

    loadGsi()
      .then(() => {
        if (cancelled || !holder.current) return;
        const identity = window.google?.accounts?.id;
        if (!identity) {
          setGoogleLoading(false);
          setError(t("auth.googleUnavailable"));
          return;
        }

        try {
          identity.initialize({
            client_id: CLIENT_ID,
            callback: (response) => {
              if (!response.credential) return;
              setError(null);
              submitRef.current(response.credential);
            },
          });

          // Strict Mode/dev refresh үед давхар renderButton үүсэхээс хамгаална.
          holder.current.innerHTML = "";
          // Товчны бичвэр, хэлийг Google өөрөө хуудасны хэлээр сонгоно.
          identity.renderButton(holder.current, { type: "standard", theme: "outline", size: "large", width: 320 });
          window.requestAnimationFrame(() => {
            if (cancelled || !holder.current) return;
            const rendered = holder.current.childElementCount > 0;
            setGoogleReady(rendered);
            setGoogleLoading(false);
            if (!rendered) setError(t("auth.googleOriginHint", { origin: currentOrigin }));
          });
        } catch {
          setGoogleLoading(false);
          setError(t("auth.googleOriginHint", { origin: currentOrigin }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGoogleLoading(false);
          setError(t("auth.googleUnavailable"));
        }
      });

    return () => {
      cancelled = true;
    };
    // Google-ийг нэг л удаа эхлүүлнэ — хамаарлыг ref барьж байгаа тул энд оруулахгүй.
  }, [currentOrigin, t]);

  if (!currentOrigin) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10px] tracking-[0.18em] text-muted uppercase">{t("auth.or")}</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {isRawIpOrigin ? (
        <button type="button" className="btn-secondary w-full justify-center" onClick={() => window.location.assign(localhostUrl())}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface text-xs font-semibold">
            G
          </span>
          {t("auth.google")}
        </button>
      ) : null}

      {!isRawIpOrigin && !pendingCredential && (!googleReady || googleLoading) ? (
        <button type="button" className="btn-secondary w-full justify-center" disabled>
          {googleLoading ? <Spinner /> : null}
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface text-xs font-semibold">
            G
          </span>
          {t("auth.google")}
        </button>
      ) : null}

      {/* Утас асуух үед Google товчийг нуухгүй — хэрэглэгч буцаж болно. */}
      {!isRawIpOrigin ? (
        <div ref={holder} className={pendingCredential ? "hidden" : "flex min-h-11 justify-center"} />
      ) : null}

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
