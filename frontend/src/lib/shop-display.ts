import type { Shop } from "@/lib/types";

const SHOP_NAMES: Record<string, string> = {
  "nomad-felt-studio": "Нүүдэл Эсгий Урлан",
  "steppe-woodcraft": "Талын Модон Урлал",
  "altan-silver-line": "Алтан Мөнгөн Урлан",
  "khuree-leather-house": "Хүрээ Арьсан Урлан",
  "deel-atelier": "Дээл Урлах Ателье",
  "gobi-textile-studio": "Говийн Нэхмэл Урлан",
  "khangai-brush": "Хангайн Бийр Урлан",
  "tsagaan-bone-craft": "Цагаан Ясан Сийлбэр",
  "blue-flame-ceramics": "Хөх Дөл Керамик",
  "little-nomad-toys": "Бяцхан Нүүдэлчин Тоглоом",
};

const PLACE_NAMES: Record<string, string> = {
  Ulaanbaatar: "Улаанбаатар",
  Sukhbaatar: "Сүхбаатар",
  Bayangol: "Баянгол",
  Darkhan: "Дархан",
  "Khan-Uul": "Хан-Уул",
  Chingeltei: "Чингэлтэй",
  Umnugovi: "Өмнөговь",
  Dalanzadgad: "Даланзадгад",
  Arkhangai: "Архангай",
  Tsetserleg: "Цэцэрлэг",
  Khuvsgul: "Хөвсгөл",
  Murun: "Мөрөн",
  Bayanzurkh: "Баянзүрх",
  Songinokhairkhan: "Сонгинохайрхан",
};

export function shopDisplayName(shop: Shop) {
  return SHOP_NAMES[shop.slug] || shop.displayName;
}

export function shopLocationText(shop: Shop) {
  const province = localPlace(shop.province || shop.city);
  const district = localPlace(shop.district);
  return [province, district].filter(Boolean).join(", ") || localPlace(shop.city) || "";
}

export function shopCraftLine(shop: Shop, limit = 4) {
  return [...(shop.categoryNames || []), ...(shop.materials || [])]
    .filter(Boolean)
    .slice(0, limit)
    .join(" · ");
}

function localPlace(value?: string | null) {
  if (!value) return "";
  return PLACE_NAMES[value] || value;
}
