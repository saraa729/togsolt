# ExpoCraft — Frontend

Монголын гар урлалын олон урлаачтай зах (Etsy загвар). Next.js 15 (App Router) + React 19 + TypeScript + Tailwind v4.
Backend: `../Backend` (Node.js, порт `4000`).

## Ажиллуулах

```bash
# 1) Backend (өөр терминал дээр)
cd ../Backend
EXPOCRAFT_SEED=true npm start          # http://localhost:4000

# 2) Frontend
npm install
cp .env.example .env.local             # шаардлагатай бол API хаягаа солино
npm run dev                            # http://localhost:3000
```

Production build:

```bash
npm run build && npm start
```

> `next build`-ийг `next dev` ажиллаж байхад зэрэг бүү ажиллуул — хоёулаа `.next` хавтас хуваалцдаг.

## Демо хаягууд (seed)

| Эрх | Имэйл | Нууц үг |
|---|---|---|
| Admin | `admin@expocraft.mn` | `admin12345` |
| Seller | `seller@expocraft.mn` | `seller12345` |
| Buyer | `buyer@expocraft.mn` | `buyer12345` |

`/login` хуудсан дээр демо хаяг дээр дарахад форм автоматаар бөглөгдөнө.

## Нэвтрэлтийн хаалт (landing gate)

Нүүр хуудас (`/`) нэвтрэлтээр хаалттай: зочин зөвхөн **лого + нэвтрэх** хэсгийг харна
([LandingGate](src/components/LandingGate.tsx)), толгой/хөл нуугдана ([Chrome](src/components/Chrome.tsx)).
Нэвтэрмэгц нүүр хуудсын бүх агуулга гарч, бүх үйлдэл ажиллана.

SEO индексжилт (NFR-4, FR-2.2) хадгалагдана. Бүх хуудсыг хаах бол `Chrome`, `LandingGate` доторх
`pathname === "/"` нөхцөлийг өөрчил.

## Хуудсууд

**Нээлттэй (SSR + SEO)**

| Зам | Тайлбар |
|---|---|
| `/` | Нүүр: онцлох бүтээл, ангилал, шинэ урлаачид, уламжлалын хэсэг |
| `/products` | Хайлт + шүүлтүүр (ангилал, материал, техник, нөөцийн горим, үнэ, байршил, олон улсын хүргэлт) |
| `/products/[id]` | Бүтээлийн дэлгэрэнгүй: галерей, нөөцийн горим, хүргэлт, захиалгаар хийх хүсэлт, JSON-LD |
| `/shop/[slug]` | Урлаачийн дэлгүүр: түүх, процесс, бүтээлүүд, үнэлгээ, JSON-LD |
| `/artisans` | Баталгаажсан урлаачдын жагсаалт |

**Худалдан авагч**

`/cart` · `/checkout` · `/orders` · `/favorites` · `/custom-requests` · `/messages` · `/account`

**Урлаач** (`seller` эрх)

`/seller` (тойм / дэлгүүр үүсгэх) · `/seller/products` · `/seller/products/new` · `/seller/products/[id]` ·
`/seller/orders` · `/seller/custom-requests` · `/seller/balance` · `/seller/shop`

**Админ** (`admin` эрх)

`/admin` (GMV, комисс, funnel, сегмент, ledger) · `/admin/verifications` · `/admin/products` · `/admin/orders` ·
`/admin/disputes` · `/admin/reports` · `/admin/payouts` · `/admin/users` · `/admin/settings`

## Хэрэгжсэн үндсэн урсгалууд

- **Олон худалдагчийн сагс (P1):** сагс урлаач тус бүрээр бүлэглэгдэж, checkout нэг төлбөрөөр хийгдэнэ
- **Escrow (P2):** төлбөр `held` → худалдан авагч хүлээж авснаа баталгаажуулах → `released`; маргаан үүсгэвэл царцана
- **Нөөцийн гурван горим (P3):** `one_of_one` / `limited_stock` / `made_to_order` (leadTime-тай)
- **Өвөрмөц захиалга:** бүтээлээс хүсэлт → урлаач үнэ санал болгох → зөвшөөрөх → сагсанд нэмэх
- **Хос хэл (P5):** MN/EN сэлгэх (cookie), MNT/USD валют сэлгэх; SSR хуудсууд cookie-г уншина
- **Төлбөр:** QPay (₮) / Stripe ($) — валютаар автоматаар сонгогдоно
- **Итгэл:** үнэлгээ, гомдол мэдүүлэх, баталгаажсан урлаачийн тэмдэг
- **Realtime:** мессежийг Socket.io (`/socket.io`) room/presence/typing event-ээр шууд хүлээн авна

## Дизайн (museum editorial)

Landing page нь музейн editorial хэв маягтай: хар толгой/хөл, төвд serif wordmark, hairline зураас,
том serif гарчиг, cream туузан хэсэг, masonry цуглуулгын сүлжээ.

- **Гарчгийн фонт:** Lora (`.display` класс). Playfair Display-д **кирилл дэд олонлог байхгүй** тул
  ашиглаж болохгүй.
- **⚠️ Фонтын урхи:** display фонтыг Tailwind-ийн `@theme { --font-* }` дотор бүү тодорхойл —
  v4-ийн `--font-*` namespace давхарласан `var()`-ыг задалдаггүй тул фонт чимээгүй үйлчлэхгүй болно.
  `globals.css` дотор энгийн `.display { font-family: var(--font-lora), … }` класс байх ёстой.
- **Өнгө:** `night` (#17140f), `cream` (#efe8dc), `sand` (#d8c39b), `paper`, `clay` (терракот акцент).
- **Зураггүй бүтээл:** [CraftTile](src/components/CraftTile.tsx) ангиллын өнгө + алхан хээтэй хавтан
  үзүүлнэ (хуурамч зураг ашиглахгүй). Урлаачид жинхэнэ зургаа байршуулмагц сүлжээ фото болно.

## Бүтэц

```
src/
  app/            # App Router хуудсууд (нээлттэй хуудсууд server component)
  components/     # Header, Footer, ProductCard, ShopForm, ProductForm, ui.tsx …
  lib/
    api.ts        # fetch wrapper, JWT + refresh rotation
    auth-context  # хэрэглэгч, дэлгүүр, сагсны тоо
    app-context   # locale / currency / t()
    i18n.ts       # MN + EN толь
    types.ts      # backend-ийн хариуны типүүд
    prefs.ts      # server component-ийн cookie унших
```

## Тэмдэглэл

- Access/refresh token нь `localStorage`-д хадгалагдаж, 401 үед автоматаар `POST /auth/refresh`-ээр сэргээгддэг.
- Зургийг `next/image`-гүйгээр (`unoptimized`) үзүүлдэг тул дурын CDN URL ажиллана.
- Хэл/валют cookie (`expocraft_locale`, `expocraft_currency`) дээр хадгалагдаж, SSR хуудсууд үүнийг уншина.
