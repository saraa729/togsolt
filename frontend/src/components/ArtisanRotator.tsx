"use client";

import { useEffect, useRef, useState } from "react";

export type ArtisanFrame = {
  id: string;
  src: string | null;
  name: string;
};

/** Нэг зураг хэдэн миллисекунд харагдах вэ. */
const PERIOD_MS = 5000;
/** Багана хоорондын хоцролт — гурвуулаа нэг зэрэг солигдвол анивчсан мэт харагдана. */
const STAGGER_MS = 1700;
/** Уусан солигдох хугацаа. */
const FADE_MS = 1200;

/**
 * "Бидний тухай" хэсгийн гурван хөрөг. Багана бүр өөрийн урлаачдын багцыг
 * тойрон эргэлдэнэ — багцууд огтлолцдоггүй тул нэг урлаач хоёр баганад зэрэг
 * гарахгүй.
 *
 * Эргэлт нь зөвхөн хэсэг дэлгэц дээр харагдаж байх үед ажиллана; мөн
 * `prefers-reduced-motion` тохиргоотой хэрэглэгчид огт эргэлдэхгүй, эхний
 * зураг хөдөлгөөнгүй үлдэнэ.
 */
export default function ArtisanRotator({ columns }: { columns: ArtisanFrame[][] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Харагдахаас нь өмнө таймер асаахгүй — эхлэхдээ зогссон байна.
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => setPaused(!entry.isIntersecting),
      { threshold: 0.2 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="grid grid-cols-3 gap-3 sm:gap-4">
      {columns.map((frames, index) => (
        <RotatingPortrait
          key={index}
          frames={frames}
          tall={index === 1}
          index={index}
          paused={paused}
        />
      ))}
    </div>
  );
}

function RotatingPortrait({
  frames,
  tall,
  index,
  paused,
}: {
  frames: ArtisanFrame[];
  tall: boolean;
  index: number;
  paused: boolean;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (paused || frames.length <= 1) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    // Багана бүр өөр цагт эхэлж, дараа нь ижил давтамжтай үргэлжилнэ.
    const kickoff = setTimeout(() => {
      setActive((current) => (current + 1) % frames.length);
      interval = setInterval(() => {
        setActive((current) => (current + 1) % frames.length);
      }, PERIOD_MS);
    }, index * STAGGER_MS);

    return () => {
      clearTimeout(kickoff);
      if (interval) clearInterval(interval);
    };
  }, [paused, frames.length, index]);

  const shape = tall ? "aspect-[3/5]" : "mt-6 aspect-[3/4]";

  if (frames.length === 0) {
    return (
      <div
        className={`lp-portrait ${shape} bg-[linear-gradient(135deg,#e0d6c6,#cbbca6)]`}
        style={{ animationDelay: `${index * 140}ms` }}
      />
    );
  }

  return (
    <div
      className={`lp-portrait relative overflow-hidden bg-night ${shape}`}
      style={{ animationDelay: `${index * 140}ms` }}
    >
      {frames.map((frame, position) => (
        <Frame key={frame.id} frame={frame} active={position === active} eager={position === 0} />
      ))}
    </div>
  );
}

function Frame({ frame, active, eager }: { frame: ArtisanFrame; active: boolean; eager: boolean }) {
  /*
   * Бүх зураг давхарлан байрлаж, зөвхөн идэвхтэй нь харагдана. Ингэснээр
   * солигдох үед хоосон зай үүсэхгүй — хуучин нь бүдгэрэх зуур шинэ нь тодорно.
   */
  const common = "absolute inset-0 h-full w-full transition-[opacity,transform] ease-out";
  const state = active ? "opacity-100 scale-100" : "opacity-0 scale-105";

  if (!frame.src) {
    return (
      <div
        aria-hidden={!active}
        className={`${common} ${state} grid place-items-center bg-[linear-gradient(135deg,#8a3f2b,#b4533a_60%,#6d2f1f)]`}
        style={{ transitionDuration: `${FADE_MS}ms` }}
      >
        <span className="display text-3xl text-white/50">{frame.name.slice(0, 1)}</span>
      </div>
    );
  }

  return (
    <img
      src={frame.src}
      alt={active ? frame.name : ""}
      aria-hidden={!active}
      loading={eager ? "eager" : "lazy"}
      className={`${common} ${state} object-cover`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    />
  );
}
