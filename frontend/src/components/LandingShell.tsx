"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import { classNames } from "@/lib/format";

/**
 * Танилцуулга хуудасны бүрхүүл. Ерөнхий Header/Footer-ийг ашиглахгүй —
 * зочинд зориулсан хөнгөн nav, нэвтрэх товч л байна.
 * Нэвтэрсэн хэрэглэгчийг өөрийнх нь нүүр (/home) рүү шилжүүлнэ.
 */
export default function LandingShell({ children }: { children: React.ReactNode }) {
  const { t, locale, setLocale } = useApp();
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && user) router.replace("/home");
  }, [ready, user, router]);

  // Шилжих хооронд танилцуулгыг эрээ цээргүй харуулахгүй.
  if (ready && user) return <div className="min-h-screen bg-night" />;

  return (
    <div className="flex min-h-screen flex-col bg-night text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-night/80 backdrop-blur-md">
        <div className="page-wide flex h-16 items-center gap-6 py-0">
          <Link href="/" className="display text-xl tracking-[0.28em] lowercase text-sand">
            expocraft
          </Link>

          <div className="ml-auto flex items-center gap-4">
            <div className="hidden items-center gap-2 text-[11px] tracking-[0.16em] uppercase sm:flex">
              {(["mn", "en"] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLocale(code)}
                  className={classNames(
                    "cursor-pointer transition-colors",
                    locale === code ? "text-white" : "text-white/40 hover:text-white"
                  )}
                >
                  {code}
                </button>
              ))}
            </div>
            <Link
              href="/register"
              className="hidden text-[11px] tracking-[0.18em] text-white/55 uppercase transition-colors hover:text-white sm:block"
            >
              {t("nav.register")}
            </Link>
            <Link href="/login" className="btn-pill-sand px-6 py-2.5">
              {t("lp.hero.login")}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/10">
        <div className="page-wide flex flex-wrap items-center justify-between gap-4 py-8 text-[10px] tracking-[0.16em] text-white/40 uppercase">
          <span className="display text-base tracking-[0.28em] lowercase text-sand">expocraft</span>
          <span>{t("top.address")}</span>
          <span>
            © {new Date().getFullYear()} · {t("footer.rights")}
          </span>
        </div>
      </footer>
    </div>
  );
}
