"use client";

import Link from "next/link";
import { classNames } from "@/lib/format";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={classNames(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
      aria-hidden
    />
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? <p className="muted mt-1 max-w-2xl">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-paper text-xl">✦</div>
      <p className="font-medium">{title}</p>
      {description ? <p className="muted max-w-md">{description}</p> : null}
      {actionLabel && actionHref ? (
        <Link href={actionHref} className="btn-primary mt-1">
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && onAction ? (
        <button type="button" className="btn-primary mt-1" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "success" | "warn";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    info: "border-line bg-paper text-ink",
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <div className={classNames("rounded-xl border px-4 py-3 text-sm", tones[tone])} role="status">
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {required ? <span className="text-clay"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card-pad">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="muted mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

export function Stars({ value = 0, size = "sm" }: { value?: number; size?: "sm" | "md" }) {
  const rounded = Math.round(value);
  return (
    <span className={classNames("inline-flex items-center gap-0.5", size === "md" ? "text-base" : "text-xs")}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rounded ? "text-gold" : "text-line"}>
          ★
        </span>
      ))}
    </span>
  );
}

/*
 * Төлвийн өнгө нь захиалгын явцыг дагаж "дүүрдэг" — эхэндээ зөвхөн хүрээтэй,
 * дундуураа шаргал, эцэст нь бүтэн шавартай улаан. Ногоон өнгө хэрэглэхгүй:
 * сайтын дулаан өнгөний системд (clay / gold / sand) таардаггүй.
 */
/** Эхэлсэн — тэмдэглэгдсэн ч ажил хараахан эхлээгүй. */
const CLAY_OUTLINE = "badge border border-clay/30 text-clay-dark";
/** Дууссан — эцсийн, эерэг төлөв. */
const CLAY_SOLID = "badge bg-clay text-white";
const RED = "badge bg-red-50 text-red-700";

const STATUS_TONES: Record<string, string> = {
  paid: CLAY_OUTLINE,
  accepted: CLAY_OUTLINE,
  making: "badge-gold",
  shipped: "badge-gold",
  delivered: "badge-clay",
  completed: CLAY_SOLID,
  cancelled: "badge-neutral",
  disputed: RED,
  held: "badge-gold",
  released: CLAY_SOLID,
  refunded: "badge-neutral",
  verified: CLAY_SOLID,
  pending_verification: "badge-gold",
  rejected: RED,
  active: CLAY_SOLID,
  hidden: "badge-neutral",
  sold: "badge-clay",
  open: "badge-gold",
  reviewing: "badge-gold",
  resolved: CLAY_SOLID,
  dismissed: "badge-neutral",
  frozen: RED,
  requested: "badge-gold",
  quoted: CLAY_OUTLINE,
  approved: CLAY_SOLID,
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return <span className={STATUS_TONES[status] || "badge-neutral"}>{label || status}</span>;
}
