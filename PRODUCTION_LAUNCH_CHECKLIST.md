# ExpoCraft Production Launch Checklist

Энэ checklist нь local demo-г жинхэнэ public website болгох үед ашиглана.
Account, domain, payment, legal approval зэрэг гаднын эрх шаарддаг ажлыг
repo дотроос бүрэн автоматаар хийж болохгүй.

## Current Status

| Хэсэг | Төлөв | Хариуцагч | Тайлбар |
|---|---:|---|---|
| Frontend build | Done | Codex | `frontend npm run build` pass |
| Backend build | Done | Codex | `Backend npm run build` pass |
| Vercel config | Done | Codex | `frontend/vercel.json` |
| Render blueprint | Done | Codex | `render.yaml` |
| Production env templates | Done | Codex + User | Secret утгыг user account-аас авна |
| Vercel live URL | Blocked | User | Vercel project/root сонгох эрх хэрэгтэй |
| Render live backend URL | Blocked | User | Render account/repo import хэрэгтэй |
| Managed PostgreSQL/Redis | Blocked | User | Render Blueprint үүсгэхэд автоматаар гарна |
| Domain + SSL | Blocked | User | Domain DNS owner action хэрэгтэй |
| Stripe/QPay live mode | Blocked | User | Merchant/API key хэрэгтэй |
| Cloudflare R2 upload | Blocked | User | R2 bucket/access key хэрэгтэй |
| Legal/escrow approval | Blocked | User + lawyer | Draft байгаа, мэргэжлийн баталгаажуулалт хэрэгтэй |
| Monitoring/security gate | Done repo-side | Codex + User | Smoke/config байгаа, external dashboards хэрэгтэй |
| Provider contracts | Done repo-side | Codex | `Backend/PROVIDER_CONTRACTS.md` |
| Render/Vercel env steps | Done repo-side | Codex | `DEPLOY_STEPS.md` |

## 1. Render Backend

User хийх:

1. Render Dashboard -> New -> Blueprint.
2. Энэ Git repo-г холбоно.
3. Root дээрх `render.yaml`-г сонгоно.
4. `expocraft-backend`, `expocraft-postgres`, `expocraft-redis` үүсэхийг шалгана.
5. Deploy дуусмагц backend URL-аа тэмдэглэнэ:

```text
https://expocraft-backend-xxxx.onrender.com
```

Render дээр заавал бөглөх env:

```text
EXPOCRAFT_WEB_ORIGIN=https://<vercel-frontend-domain>
FRONTEND_URL=https://<vercel-frontend-domain>
EXPOCRAFT_PUBLIC_ORIGIN=https://<render-backend-domain>
EXPOCRAFT_PUBLIC_API_URL=https://<render-backend-domain>
BACKEND_URL=https://<render-backend-domain>
EXPOCRAFT_CORS_ORIGINS=https://<vercel-frontend-domain>
GOOGLE_CLIENT_ID=727216094961-nmhhimemqnqopfe440u5d7rd53rpae83.apps.googleusercontent.com
```

Custom domain ашиглах бол:

```text
api.expocraft.mn -> Render backend service
```

Smoke test:

```bash
curl https://<render-backend-domain>/health
```

## 2. Vercel Frontend

User хийх:

1. Vercel -> Add New Project.
2. Repo import хийнэ.
3. Root Directory: `frontend`.
4. Framework: Next.js.
5. Environment Variables нэмнэ:

```text
NEXT_PUBLIC_API_URL=https://<render-backend-domain>
API_URL=https://<render-backend-domain>
NEXT_PUBLIC_SITE_URL=https://<vercel-frontend-domain>
NEXT_PUBLIC_GOOGLE_CLIENT_ID=727216094961-nmhhimemqnqopfe440u5d7rd53rpae83.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_LOCAL_ORIGIN=https://<vercel-frontend-domain>
```

Deploy дуусмагц:

```bash
curl -I https://<vercel-frontend-domain>/login
```

## 3. Domain + SSL

User хийх:

1. Domain provider дээр DNS record нэмнэ.
2. `expocraft.mn` болон `www.expocraft.mn`-ийг Vercel project дээр нэмнэ.
3. `api.expocraft.mn`-ийг Render backend дээр нэмнэ.
4. SSL issued/valid болсон эсэхийг dashboard дээр шалгана.

Suggested DNS:

```text
expocraft.mn      -> Vercel A/CNAME instruction
www.expocraft.mn  -> Vercel CNAME instruction
api.expocraft.mn  -> Render CNAME instruction
```

## 4. Production Secrets

User хийх:

1. `JWT_SECRET`: `openssl rand -base64 48`
2. Render env дээр `JWT_SECRET` generate эсвэл manually add.
3. Vercel env дээр frontend public values тавина.
4. Secret утгуудыг git-д commit хийхгүй.

Secret rotation:

- JWT/Payment/Storage/API keys: 90 хоног тутам.
- Team member солигдвол шууд rotate.

## 5. Payment Live Mode

User хийх:

Stripe:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PUBLISHABLE_KEY
```

QPay:

```text
QPAY_MERCHANT_ID
QPAY_CLIENT_ID
QPAY_CLIENT_SECRET
QPAY_INVOICE_CODE
QPAY_WEBHOOK_SECRET
```

Backend env switch:

```text
EXPOCRAFT_PAYMENT_MODE=live
```

Live mode асаахаас өмнөх gate:

- Terms of Service approved.
- Seller Agreement approved.
- Refund/dispute policy approved.
- Test payment -> webhook -> ledger -> escrow -> release flow шалгасан.

## 6. Cloudflare R2 Upload

User хийх:

1. Cloudflare R2 bucket үүсгэнэ.
2. Public write off.
3. Access key үүсгэнэ.
4. CDN/public custom domain тохируулна.
5. Virus scan endpoint сонгоно.

Backend env:

```text
EXPOCRAFT_STORAGE_PROVIDER=r2
EXPOCRAFT_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
EXPOCRAFT_R2_BUCKET=<bucket>
EXPOCRAFT_R2_REGION=auto
EXPOCRAFT_R2_ACCESS_KEY_ID=<access-key>
EXPOCRAFT_R2_SECRET_ACCESS_KEY=<secret>
EXPOCRAFT_STORAGE_PUBLIC_BASE_URL=https://cdn.expocraft.mn
EXPOCRAFT_VIRUS_SCAN_REQUIRED=true
EXPOCRAFT_VIRUS_SCAN_URL=<scanner-endpoint>
EXPOCRAFT_VIRUS_SCAN_TOKEN=<scanner-token>
```

## 7. Legal / Escrow Terms

Repo-д draft байгаа:

- `docs/legal/TERMS_OF_SERVICE.md`
- `docs/legal/SELLER_AGREEMENT.md`
- `docs/legal/ESCROW_REFUND_POLICY.md`
- `docs/legal/PRIVACY_POLICY.md`
- `docs/legal/ESCROW_COMPLIANCE_CHECKLIST.md`

User хийх:

1. Монгол дахь payment/escrow эрх зүйн зөвлөхөөр баталгаажуулна.
2. Platform бусдын мөнгийг түр хадгалах/дамжуулах боломжтой эсэхийг тодруулна.
3. Live payment mode асаахаас өмнө terms-ийг frontend footer/register/checkout дээр link болгоно.

## 8. Monitoring / Backup / Security

User хийх:

1. Render service health alerts асаана.
2. Postgres automatic backup асаана.
3. Monthly restore drill хийнэ.
4. Sentry/Log drain эсвэл dashboard monitoring холбоно.
5. Admin MFA/SSO policy тогтооно.
6. Public launch-ийн өмнө dependency audit + pentest хийлгэнэ.

Repo-д байгаа:

- `Backend/monitoring/alerts.yml`
- `Backend/scripts/backup-postgres.sh`
- `Backend/scripts/restore-postgres.sh`
- `Backend/scripts/monitoring-smoke.ts`
- `Backend/scripts/provider-config-smoke.ts`
- `Backend/scripts/production-readiness.ts`
- `SECURITY_MONITORING_CHECKLIST.md`

Repo-side checks:

```bash
cd Backend
npm run smoke:monitoring
npm run smoke:providers
```

## 9. Final Launch Smoke Test

Доорх бүгд pass бол public demo launch гэж үзнэ:

```text
GET https://api.expocraft.mn/health -> 200
GET https://expocraft.mn/login -> 200
Google login works
Products page loads
Shop page loads
Add to cart works
Checkout creates payment/order
Admin can see order
Seller can see order
Payout request can be created
Upload image works with R2
Metrics endpoint reachable by monitoring
Backup job completes
```
