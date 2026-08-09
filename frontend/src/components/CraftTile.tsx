import { resolveImageUrl } from "@/lib/format";
import type { Product } from "@/lib/types";

/** Ангилал бүрт өөр өнгө — зураггүй бүтээлийн хавтанг санаатай, эмх цэгцтэй харагдуулна. */
const TINTS: Record<string, { bg: string; ink: string }> = {
  cat_felt: { bg: "#d9cdb9", ink: "#4a4034" },
  cat_wood: { bg: "#c9b096", ink: "#463628" },
  cat_jewelry: { bg: "#ccd2d1", ink: "#333c3b" },
  cat_leather: { bg: "#c3a082", ink: "#432f1e" },
  cat_textile: { bg: "#d7c4bb", ink: "#463330" },
};

const FALLBACK = { bg: "#d5cdc0", ink: "#40382e" };

/** Хээний хувилбарууд — хавтангууд яг адилхан харагдахаас сэргийлнэ. */
const WEAVES = [
  { a: 45, b: -45, gap: 10 },
  { a: 30, b: -60, gap: 14 },
  { a: 60, b: -30, gap: 18 },
  { a: 90, b: 0, gap: 12 },
];

function weaveFor(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  const weave = WEAVES[hash % WEAVES.length];
  return (
    `repeating-linear-gradient(${weave.a}deg, transparent 0 ${weave.gap}px, rgba(255,255,255,0.55) ${weave.gap}px ${weave.gap + 1}px),` +
    `repeating-linear-gradient(${weave.b}deg, transparent 0 ${weave.gap}px, rgba(0,0,0,0.22) ${weave.gap}px ${weave.gap + 1}px)`
  );
}

/**
 * Бүтээлийн зураг. Зураг байхгүй бол ангиллын өнгөтэй, нэрийг нь тээсэн хавтан үзүүлнэ
 * (хуурамч зураг оруулахгүй).
 */
export default function CraftTile({
  product,
  ratio = "aspect-[4/5]",
  className = "",
  showTitle = true,
}: {
  product: Product;
  ratio?: string;
  className?: string;
  /** Доор нь тайлбар бичих бол хавтан дотор нэрийг давхардуулахгүй. */
  showTitle?: boolean;
}) {
  const image = resolveImageUrl(product.images?.[0]);
  const tint = TINTS[product.categoryId] || FALLBACK;

  if (image) {
    return (
      <div className={`${ratio} overflow-hidden bg-cream ${className}`}>
        <img
          src={image}
          alt={product.titleText}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </div>
    );
  }

  return (
    <div
      className={`${ratio} relative overflow-hidden ${className}`}
      style={{ backgroundColor: tint.bg }}
      aria-label={product.titleText}
    >
      <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: weaveFor(product.id) }} />

      {/*
       * Нэр нь хавтангийн доор бичигдэх үед дотор нь төвлөрсөн тэмдэг тавина.
       * Өмнө нь буланд "expocraft" усан тэмдэг байсан нь хавтанг "зураг дутуу"
       * мэт харагдуулдаг байсан — төв тэмдэг нь санаатай хийсэн мэт уншигдана.
       */}
      {!showTitle ? (
        <div className="absolute inset-0 grid place-items-center" aria-hidden>
          <span
            className="grid h-12 w-12 place-items-center rounded-full text-base"
            style={{ border: `1px solid ${tint.ink}2b`, color: `${tint.ink}5c` }}
          >
            ✦
          </span>
        </div>
      ) : null}

      <div className="absolute inset-0 flex flex-col justify-between p-4" style={{ color: tint.ink }}>
        <span className="text-[10px] font-medium tracking-[0.18em] uppercase opacity-70">
          {product.category?.name || ""}
        </span>
        {showTitle ? (
          <span className="display line-clamp-3 text-lg leading-snug">{product.titleText}</span>
        ) : null}
      </div>

      {/* Цөцгий дэвсгэр дээр хавтангийн ирмэгийг мэдэгдэхүйц болгоно. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: `inset 0 0 0 1px ${tint.ink}14` }}
      />
    </div>
  );
}
