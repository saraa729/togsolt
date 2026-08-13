"use client";

import { useApp } from "@/lib/app-context";

/**
 * Захиалгын явцын алхмууд. Урлаач болон худалдан авагчийн хуудас хоёулаа
 * ижил дүрсийг харна — ингэснээр "хаана явааг" нэг ижил байдлаар уншина.
 *
 * `paid → delivered` хүртэлх шат нь урлаачийн хариуцлага, `completed` нь
 * худалдан авагч баталгаажуулснаар л ирнэ.
 */
export const ORDER_FLOW = ["paid", "accepted", "making", "shipped", "delivered", "completed"] as const;

/** Урлаач урагш л явна — одоогийн төлөвөөс хойших алхмууд. */
export function nextSellerStatuses(status: string): string[] {
  const sellerFlow = ["paid", "accepted", "making", "shipped", "delivered"];
  const index = sellerFlow.indexOf(status);
  if (index < 0) return [];
  return sellerFlow.slice(index + 1);
}

export default function OrderTimeline({ status, className = "" }: { status: string; className?: string }) {
  const { t } = useApp();
  if (["cancelled", "disputed"].includes(status)) return null;
  const activeIndex = ORDER_FLOW.indexOf(status as (typeof ORDER_FLOW)[number]);

  return (
    <div className={`overflow-x-auto pb-1 ${className}`}>
      <ol className="flex min-w-130">
        {ORDER_FLOW.map((step, index) => {
          const done = index < activeIndex;
          const current = index === activeIndex;
          return (
            <li key={step} className="relative flex flex-1 flex-col items-center gap-2 px-1 text-center">
              {index < ORDER_FLOW.length - 1 ? (
                <span
                  aria-hidden
                  className={`absolute top-1.5 left-1/2 h-0.5 w-full ${done ? "bg-clay" : "bg-line"}`}
                />
              ) : null}
              <span
                aria-hidden
                className={`relative z-10 h-3.5 w-3.5 rounded-full border-2 transition-colors ${
                  done
                    ? "border-clay bg-clay"
                    : current
                      ? "border-clay bg-surface ring-4 ring-clay/15"
                      : "border-line bg-surface"
                }`}
              />
              <span
                className={`text-[10px] leading-tight ${
                  current ? "font-semibold text-ink" : done ? "text-ink/70" : "text-muted"
                }`}
                aria-current={current ? "step" : undefined}
              >
                {t(`ostatus.${step}`)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
