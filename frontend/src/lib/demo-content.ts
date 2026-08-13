import type { Category, Currency, HomePayload, Locale, Product, Shop } from "./types";

export const demoCategories: Category[] = [
  { id: "felt", slug: "felt", name: { mn: "Эсгий", en: "Felt" }, nameText: "Эсгий" },
  { id: "wood", slug: "wood", name: { mn: "Модон урлал", en: "Woodcraft" }, nameText: "Модон урлал" },
  { id: "silver", slug: "silver", name: { mn: "Мөнгөн эдлэл", en: "Silver" }, nameText: "Мөнгөн эдлэл" },
  { id: "textile", slug: "textile", name: { mn: "Нэхмэл", en: "Textile" }, nameText: "Нэхмэл" },
  { id: "leather", slug: "leather", name: { mn: "Арьсан эдлэл", en: "Leather" }, nameText: "Арьсан эдлэл" },
];

export const demoArtisans: Shop[] = [
  {
    id: "shop-felt",
    sellerId: "seller-felt",
    slug: "nomad-felt-studio",
    status: "verified",
    displayName: "Nomad Felt Studio",
    city: "Улаанбаатар",
    province: "Улаанбаатар",
    verified: true,
    artisanProfile: { makerName: "Сарантуяа", yearsOfExperience: 12 },
    materials: ["эсгий", "ноос"],
  },
  {
    id: "shop-wood",
    sellerId: "seller-wood",
    slug: "steppe-woodcraft",
    status: "verified",
    displayName: "Steppe Woodcraft",
    city: "Хархорин",
    province: "Өвөрхангай",
    verified: true,
    artisanProfile: { makerName: "Бат-Эрдэнэ", yearsOfExperience: 18 },
    materials: ["мод"],
  },
  {
    id: "shop-silver",
    sellerId: "seller-silver",
    slug: "altan-silver-line",
    status: "verified",
    displayName: "Altan Silver Line",
    city: "Дархан",
    province: "Дархан-Уул",
    verified: true,
    artisanProfile: { makerName: "Алтанчимэг", yearsOfExperience: 15 },
    materials: ["мөнгө", "шүр"],
  },
  {
    id: "shop-leather",
    sellerId: "seller-leather",
    slug: "khuree-leather-house",
    status: "verified",
    displayName: "Khuree Leather House",
    city: "Улаанбаатар",
    province: "Улаанбаатар",
    verified: true,
    artisanProfile: { makerName: "Энхтүвшин", yearsOfExperience: 10 },
    materials: ["арьс"],
  },
];

export const demoProducts: Product[] = [
  product("felt-ger", "felt", "shop-felt", "nomad-felt-studio", "Эсгий гэр чимэглэл", "Felt ger ornament", 45000, "/images/expocraft/artisan-felt.png"),
  product("wood-box", "wood", "shop-wood", "steppe-woodcraft", "Сийлбэртэй модон хайрцаг", "Carved wooden box", 125000, "/images/expocraft/artisan-wood.png"),
  product("silver-ring", "silver", "shop-silver", "altan-silver-line", "Мөнгөн бөгж", "Silver ring", 98000, "/images/expocraft/artisan-silver.png"),
  product("leather-wallet", "leather", "shop-leather", "khuree-leather-house", "Арьсан түрийвч", "Leather wallet", 76000, "/images/expocraft/artisan-leather.png"),
  product("textile-runner", "textile", "shop-felt", "nomad-felt-studio", "Хээтэй ширээний бүтээлэг", "Patterned table runner", 68000, "/images/expocraft/artisan-textile.png"),
  product("bone-spoon", "wood", "shop-wood", "steppe-woodcraft", "Ясан хөөрөгний халбага", "Bone snuff bottle spoon", 52000, "/images/expocraft/artisan-bone.png"),
  product("ceramic-cup", "felt", "shop-felt", "nomad-felt-studio", "Гараар хийсэн аяга", "Handmade ceramic cup", 39000, "/images/expocraft/artisan-ceramic.png"),
  product("toy-camel", "felt", "shop-felt", "nomad-felt-studio", "Эсгий тэмээн тоглоом", "Felt camel toy", 34000, "/images/expocraft/artisan-toys.png"),
];

export function demoHomePayload(locale: Locale, currency: Currency): HomePayload {
  return {
    locale,
    currency,
    touristMode: false,
    featuredProducts: demoProducts,
    newArtisans: demoArtisans,
    categories: demoCategories.map((category) => ({
      ...category,
      nameText: category.name[locale] || category.name.mn || category.slug,
    })),
    traditionSections: [],
  };
}

function product(
  id: string,
  categoryId: string,
  shopId: string,
  shopSlug: string,
  mn: string,
  en: string,
  amount: number,
  image: string
): Product {
  const shop = demoArtisans.find((item) => item.id === shopId);
  return {
    id,
    sellerId: shop?.sellerId || "seller-demo",
    shopId,
    status: "active",
    categoryId,
    title: { mn, en },
    description: { mn, en },
    titleText: mn,
    descriptionText: mn,
    materials: shop?.materials || [],
    images: [image],
    price: { amount, currency: "MNT" },
    stock: 4,
    inventoryType: "ready_made",
    shipsInternationally: true,
    touristGift: true,
    shop: { id: shopId, slug: shopSlug, displayName: shop?.displayName || "ExpoCraft" },
    createdAt: new Date(2026, 0, Number(id.length)).toISOString(),
  };
}
