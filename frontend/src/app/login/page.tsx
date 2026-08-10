"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import LoginForm from "@/components/LoginForm";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import type { User } from "@/lib/types";

function LoginView() {
  const { t } = useApp();
  const { user, ready } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params?.get("next") || "";

  function defaultRedirect(user: User) {
    const roles = user.roles || [];
    if (roles.includes("admin")) return "/admin";
    if (roles.includes("seller")) return "/seller";
    return "/home";
  }

  // Нэвтэрсний дараа `?next=` байвал түүнийг хүндэтгэнэ, үгүй бол тухайн
  // хэрэглэгчийн эрх дээр үндэслэн админ/урлаач таб руу үсрэнэ.
  function afterLogin(_user: User) {
    router.push(next || defaultRedirect(_user));
  }

  // Аль хэдийн нэвтэрсэн бол формыг дахин үзүүлэхгүй.
  useEffect(() => {
    if (ready && user) router.replace(next || defaultRedirect(user));
  }, [ready, user, next, router]);

  if (ready && user) return <div className="page max-w-md py-16" />;

  return (
    <div className="page max-w-md py-16">
      <div className="text-center">
        <p className="display text-2xl tracking-[0.28em] lowercase">expocraft</p>
        <p className="eyebrow mt-3 text-muted">{t("brand.tagline")}</p>
      </div>

      <div className="card-pad mt-8">
        <h1 className="display text-xl">{t("auth.loginTitle")}</h1>
        <div className="mt-5 space-y-5">
          <LoginForm onSuccess={afterLogin} />
          <GoogleSignInButton onSuccess={afterLogin} />
        </div>

        <p className="muted mt-6 text-center text-xs">
          {t("auth.noAccount")}{" "}
          <Link href="/register" className="link">
            {t("nav.register")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="page max-w-md py-16">
          <div className="card h-96 skeleton" />
        </div>
      }
    >
      <LoginView />
    </Suspense>
  );
}
