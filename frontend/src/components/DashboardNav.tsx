"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { classNames } from "@/lib/format";

export default function DashboardNav({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname() || "";

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <p className="px-2 pb-3 text-xs font-semibold tracking-wide text-muted uppercase">{title}</p>
      <nav className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== items[0].href && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={classNames(
                "shrink-0 rounded-xl px-3 py-2 text-sm transition-colors",
                active ? "bg-clay text-white" : "text-muted hover:bg-paper hover:text-ink"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
