"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/lib/auth-context";
import type { Role } from "@/lib/types";

export default function RequireAuth({
  role,
  children,
}: {
  role?: Role | Role[];
  children: React.ReactNode;
}) {
  const { t } = useApp();
  const { user, ready, hasRole } = useAuth();
  const pathname = usePathname() || "/";

  if (!ready) {
    return (
      <div className="page py-14">
        <div className="card h-64 skeleton" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page max-w-md py-20 text-center">
        <div className="card-pad">
          <p className="text-lg font-medium">{t("auth.requireLogin")}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn-primary">
              {t("nav.login")}
            </Link>
            <Link href="/register" className="btn-secondary">
              {t("nav.register")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const roles = role ? (Array.isArray(role) ? role : [role]) : [];
  if (roles.length > 0 && !roles.some((item) => hasRole(item))) {
    return (
      <div className="page max-w-md py-20 text-center">
        <div className="card-pad">
          <p className="text-lg font-medium">{t("auth.forbidden")}</p>
          <Link href="/home" className="btn-secondary mt-5">
            {t("nav.home")}
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
