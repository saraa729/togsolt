"use client";

import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import type { Role, User } from "@/lib/types";
import { Alert } from "./ui";

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
          callback: async (response) => {
            if (!response.credential) return;
            try {
              const user = await loginWithGoogle({ credential: response.credential, locale, roles });
              onSuccess?.(user);
            } catch (caught) {
              setError(errorMessage(caught));
            }
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
  }, [loginWithGoogle, locale, roles, onSuccess, t]);

  if (!CLIENT_ID) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[10px] tracking-[0.18em] text-muted uppercase">{t("auth.or")}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <div ref={holder} className="flex justify-center" />
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
