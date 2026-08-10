# ExpoCraft Escrow, Refund, and Dispute Policy Draft

> Draft only. Escrow/payment live mode асаахаас өмнө Монгол Улсын холбогдох
> хууль, санхүүгийн зохицуулалт, payment provider-ийн нөхцөлтэй нийцүүлэн
> баталгаажуулна.

## 1. Escrow Flow

1. Худалдан авагч checkout хийж төлбөр төлнө.
2. Төлбөр ExpoCraft-ийн platform account дээр баталгаажна.
3. Захиалга урлаач тус бүрээр `OrderShop` болж сална.
4. Урлаач захиалгыг баталж, илгээнэ.
5. Худалдан авагч хүлээн авснаа баталгаажуулна эсвэл auto-complete хугацаа дуусна.
6. Комисс суутгагдаж, урлаачийн balance-д орлого шилжинэ.
7. Урлаач payout хүсэлт гаргана.

## 2. Auto-complete

Tracking delivered болсон эсвэл худалдан авагч маргаан нээгээгүй тохиолдолд
N хоногийн дараа захиалга автоматаар дууссан төлөвт орж болно. N хоногийг
platform settings дээр тодорхойлно.

## 3. Refund Eligibility

Refund боломжтой нөхцөл:

- Бараа илгээгдээгүй.
- Бараа ирээгүй.
- Захиалсан бүтээгдэхүүнээс ноцтой өөр.
- Гэмтэлтэй ирсэн бөгөөд нотлох зураг/баримт байгаа.

Refund боломжгүй байж болох нөхцөл:

- Захиалгаар хийсэн бүтээл buyer-approved stage-ээс хойш цуцлагдсан.
- Худалдан авагч буруу хаяг өгсөн.
- Бүтээгдэхүүний тайлбарт тодорхой дурдсан онцлогийг defect гэж үзсэн.

## 4. Dispute Freeze

Маргаан нээгдсэн үед тухайн `OrderShop`-ийн escrow release болон payout
түр царцана. Admin шийдвэр гарсны дараа ledger дээр refund, release, commission
adjustment бичилт хийгдэнэ.

## 5. Evidence

Худалдан авагч болон урлаач дараах баримтыг оруулж болно:

- Захиалгын зураг.
- Сав баглаа боодлын зураг.
- Tracking мэдээлэл.
- Чатын screenshot/файл.
- Хэмжээ, өнгө, материалын зөрүүг харуулсан зураг.

## 6. Admin Resolution

Admin дараах шийдвэрүүдийн нэгийг гаргана:

- Full refund.
- Partial refund.
- Seller release.
- Replacement/rework.
- Buyer return required.

## 7. Ledger Rule

Бүх refund, commission, seller earning, payout хөдөлгөөн ledger entry-ээр
бичигдэнэ. Balance нь ledger-ийн нийлбэрээр тооцогдоно.

