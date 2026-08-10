# ExpoCraft Production Runbook

Энэ файл нь production deploy хийхэд repo талаас бэлэн байх ёстой зүйлсийг нэг дор барина. Domain, SSL, payment, legal, bank, carrier, app-store approval зэрэг гаднын эрхтэй ажлыг тухайн үйлчилгээний дансаар баталгаажуулна.

## 1. Deploy Gate

Доорх командууд бүгд pass болсны дараа deploy хийнэ.

```bash
cd Backend
npm test
npm run env:check

cd ../frontend
npm run build
```

Minimum production env:

- `NODE_ENV=production`
- `JWT_SECRET` 32+ тэмдэгт random
- `DATABASE_URL` managed PostgreSQL
- `REDIS_URL` managed Redis
- `EXPOCRAFT_WEB_ORIGIN=https://expocraft.mn`
- `EXPOCRAFT_PUBLIC_ORIGIN=https://api.expocraft.mn`
- `EXPOCRAFT_CORS_ORIGINS=https://expocraft.mn`
- `EXPOCRAFT_STORAGE_PROVIDER=r2` эсвэл S3-compatible object storage
- `EXPOCRAFT_VIRUS_SCAN_REQUIRED=true`
- `EXPOCRAFT_VIRUS_SCAN_URL=<scanner endpoint>`

## 2. Frontend: Vercel

Repo-д [frontend/vercel.json](frontend/vercel.json) орсон. Vercel project үүсгэхдээ:

1. `frontend` folder-ийг Vercel project root болгоно.
2. Environment:
   - `NEXT_PUBLIC_API_URL=https://api.expocraft.mn`
   - `API_URL=https://api.expocraft.mn`
   - `NEXT_PUBLIC_SITE_URL=https://expocraft.mn`
3. Domain:
   - `expocraft.mn` болон `www.expocraft.mn` нэмнэ.
   - Vercel DNS record зааврыг domain provider дээр тохируулна.
   - SSL issued болсон эсэхийг шалгана.

## 3. Backend: Render/Fly/Railway

Repo root дээр [render.yaml](render.yaml) орсон. Render дээр Blueprint sync хийвэл:

1. `expocraft-backend` web service үүснэ.
2. `expocraft-postgres` managed PostgreSQL үүснэ.
3. `expocraft-redis` Render Key Value буюу Redis-compatible store үүснэ.
4. Backend build command: `npm ci && npm run prisma:generate && npm run build`.
5. Backend start command: `npm start`.
6. Health check: `GET /health`.
7. Domain: `api.expocraft.mn`.
8. SSL: hosting platform automatic TLS.
9. Autoscale хийвэл `REDIS_URL` Render Key Value-оос автоматаар орно.

Blueprint дээр secret/public domain env-үүдийг `sync: false` болгосон тул Render Dashboard дээр initial sync хийхдээ дараахыг бөглөнө:

- `EXPOCRAFT_WEB_ORIGIN=https://expocraft.mn`
- `FRONTEND_URL=https://expocraft.mn`
- `EXPOCRAFT_PUBLIC_ORIGIN=https://api.expocraft.mn`
- `BACKEND_URL=https://api.expocraft.mn`
- `EXPOCRAFT_CORS_ORIGINS=https://expocraft.mn`
- Payment/bank/Google/SMTP secret-үүдийг live хэрэглэх үед бөглөнө.

## 4. Database Backup

Managed Postgres automatic backup-ийг асаана. Нэмэлт logical backup:

```bash
cd Backend
DATABASE_URL=... BACKUP_DIR=/secure/backups npm run backup:postgres
```

Recommended:

- Daily backup, retention 14-30 days.
- Monthly restore drill.
- Backup storage encrypted, app server-аас тусдаа bucket/account.
- Prometheus дээр `expocraft_last_backup_timestamp_seconds` metric-ийг exporter/job-оор update хийнэ.

## 5. Monitoring

Expose:

- `GET /metrics`
- `GET /metrics/prometheus`

Alert rules: [Backend/monitoring/alerts.yml](Backend/monitoring/alerts.yml)

Minimum alerts:

- Backend down
- HTTP error spike
- Job failure
- Admin queue SLA critical
- Production runtime store Redis биш байх
- Backup stale

## 6. Legal / Escrow Gate

Код escrow ledger flow-той боловч live launch-ийн өмнө дараах баримт бичгийг мэргэжлийн зөвлөхөөр баталгаажуулна.

- Худалдан авагчийн Terms of Service: `docs/legal/TERMS_OF_SERVICE.md`
- Урлаачийн Seller Agreement: `docs/legal/SELLER_AGREEMENT.md`
- Escrow/settlement/refund policy: `docs/legal/ESCROW_REFUND_POLICY.md`
- Privacy policy: `docs/legal/PRIVACY_POLICY.md`
- Payout KYC/AML-light checklist
- Tax invoice/e-barimt шаардлага
- Бусдын мөнгө түр хадгалах/дамжуулах эрх зүйн статус

Launch gate: legal sign-off байхгүй үед payment mode-г `manual` эсвэл limited pilot байлгана.

## 7. Security Gate

- Production secrets rotation schedule: 90 хоног.
- `REDIS_URL` enabled.
- `EXPOCRAFT_VIRUS_SCAN_REQUIRED=true`.
- Object storage bucket public write off, signed/server-only write on.
- Upload CDN public read only.
- Admin MFA эсвэл SSO policy.
- Pentest before public launch.
- Dependency audit review before release.
- Final checklist: `SECURITY_MONITORING_CHECKLIST.md`

Check current production readiness score:

```bash
cd Backend
npm run production:readiness
```

## 8. Operations SLA

Backend `/admin/queues` болон `/admin/ops/alerts` дараах queue SLA-г гаргана.

- Seller verification: warning 24h, critical 48h
- Moderation report: warning 12h, critical 24h
- Dispute: warning 24h, critical 72h
- Payout: warning 24h, critical 72h

Audit export:

```bash
GET /admin/audit-logs/export
```

## 9. International Shipping / Customs

Estimate endpoint:

```bash
POST /shipping/estimate
```

Энэ нь HS code, customs description, origin country, weight, tax estimate, required docs-ыг буцаана. Live launch-ийн өмнө carrier API, final tariff source, customs broker policy-г холбож баталгаажуулна.

Carrier provider холбох env:

- `EXPOCRAFT_CARRIER_API_URL`
- `EXPOCRAFT_CARRIER_API_KEY`

Эдгээр байвал backend `/shipping/estimate` дээр provider-ийн `/rates`
endpoint рүү хүсэлт явуулж, үгүй бол demo fallback estimate буцаана.

## 10. Mobile Native

`mobile/` хавтаст Expo/React Native эхлэл scaffold орсон. Энэ нь production
store release биш, web API-тэй холбогдох minimum native demo.

- Login/register/refresh
- Product browse/search
- Cart/checkout
- Orders
- Messages via Socket.io
- Seller order status update

App Store/Play Store build, signing, privacy labels нь тусдаа release workstream.

## 11. Object Storage

Production upload-д `EXPOCRAFT_STORAGE_PROVIDER=r2` эсвэл `s3` ашиглана.
Backend нь AWS Signature V4 PUT хийдэг тул bucket дээр public write асаах
шаардлагагүй. Public read-ийг CDN/domain-аар гаргана.

Required R2 env:

- `EXPOCRAFT_STORAGE_PROVIDER=r2`
- `EXPOCRAFT_R2_ENDPOINT`
- `EXPOCRAFT_R2_BUCKET`
- `EXPOCRAFT_R2_REGION=auto`
- `EXPOCRAFT_R2_ACCESS_KEY_ID`
- `EXPOCRAFT_R2_SECRET_ACCESS_KEY`
- `EXPOCRAFT_STORAGE_PUBLIC_BASE_URL`
- `EXPOCRAFT_VIRUS_SCAN_REQUIRED=true`
- `EXPOCRAFT_VIRUS_SCAN_URL`

## 12. AI / Recommendation Provider

Default recommendation нь favorites, follows, purchases, views, shop quality,
availability, freshness, tourist fit дээр суурилсан hybrid scoring.

External AI suggestion provider холбох env:

- `EXPOCRAFT_AI_SUGGEST_URL`
- `EXPOCRAFT_AI_API_KEY`

Эдгээр байвал `/ai/products/suggest` provider рүү явна, үгүй бол rule-based
fallback санал буцаана.

## 13. RabbitMQ

Current app нь in-process jobs + HTTP/SSE/Socket.io event flow-той. Production
queue migration хийхэд:

- `EXPOCRAFT_QUEUE_PROVIDER=rabbitmq`
- `RABBITMQ_URL`
- worker service
- escrow auto-release, reconciliation, email/notification jobs-ыг consumer
  болгож салгах migration хэрэгтэй.

Энэ нь deployment config биш, backend architecture migration тул тусдаа
ажлын үе шат гэж тооцно.
