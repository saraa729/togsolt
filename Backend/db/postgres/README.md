# PostgreSQL

Энэ хавтсанд хоёр өөр зориулалттай схем байна.

## 1. `schema.sql` — ажиллаж буй серверийн хадгалалт

Сервер өгөгдлөө нэг JSON баримт болгон хадгална (`app_state` хүснэгт).
`EXPOCRAFT_DB_PROVIDER=postgres` үед энэ горим ажиллана; үндсэн утга нь
`json` буюу локал файл.

```bash
DATABASE_URL=postgres://... npm run db:migrate   # схем үүсгэж, JSON-оо ачаална
DATABASE_URL=postgres://... npm run db:export    # буцааж JSON болгож татна
```

## 2. `relational.sql` — хэвийн хэлбэрт оруулсан загвар (§7)

Шаардлагын баримт бичгийн §7-д тодорхойлсон **харилцан хамаарлат** загвар:
`users`, `shops`, `categories`, `materials`, `products`, `product_materials`,
`custom_requests`, `carts`, `cart_items`, `orders`, `order_shops`, `order_items`,
`shipments`, `escrow_payments`, `ledger_entries`, `payouts`, `disputes`,
`chat_threads`, `chat_messages`, `reviews`, `reports`, `notifications`,
`audit_logs` — гадаад түлхүүр, индекс, CHECK хязгаарлалттай.

```bash
DATABASE_URL=postgres://... npm run db:relational
```

Скрипт нь схемийг дахин үүсгээд (DROP … CASCADE) JSON өгөгдлийг хөрвүүлж,
эцэст нь дэвтрийн нийлбэрийг хэвлэнэ.

### Зорилго

Энэ нь **тайлан, шинжилгээ, цаашид бүрэн шилжих** зориулалттай. Сервер өдөр
тутам JSON дээрээ ажиллаж байгаа тул хоёрын хооронд зөрүү үүсэхээс сэргийлж
шаардлагатай үедээ дахин ажиллуулна.

### Жишээ асуулгууд

```sql
-- Олон урлаачийн захиалга задарсан эсэх (§P1)
SELECT o.id, COUNT(DISTINCT os.shop_id) AS shops, SUM(oi.line_total_amount) AS total
FROM orders o
JOIN order_shops os ON os.order_id = o.id
JOIN order_items oi ON oi.order_shop_id = os.id
GROUP BY o.id;

-- Мөнгө алдагдаагүй эсэх (§NFR-1): шимтгэл + урлаачид = нийт
SELECT SUM(commission_amount) + SUM(seller_receivable_amount) = SUM(line_total_amount)
FROM order_items;

-- Урлаачийн үлдэгдэл = чөлөөлсөн − татсан
SELECT seller_id,
       SUM(amount) FILTER (WHERE kind = 'release_to_seller_balance')
     - COALESCE(SUM(amount) FILTER (WHERE kind = 'payout_scheduled'), 0) AS balance
FROM ledger_entries GROUP BY seller_id;

-- Хос хэлний контент
SELECT name->>'mn', name->>'en', stock_mode FROM products WHERE status = 'active';
```

### Локал туршилт

```bash
docker run -d --name expocraft-pg \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=expocraft \
  -p 55432:5432 postgres:16-alpine

DATABASE_URL=postgres://postgres:test@localhost:55432/expocraft npm run db:relational
```
