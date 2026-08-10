# ExpoCraft Deploy Now

Одоогийн repo production deploy-д бэлэн болсон хэсэг:

- Frontend: `frontend/` folder, Vercel config: `frontend/vercel.json`
- Backend: `Backend/` folder, Render Blueprint: `render.yaml`
- PostgreSQL + Redis: Render Blueprint дээр автоматаар үүснэ
- Google OAuth Client ID: env template-д орсон

Public live URL-г repo дотроос ганцаараа үүсгэх боломжгүй хэсэг:

- Render account/repo import эсвэл Render API key
- Vercel project root сонгох dashboard action
- Domain provider DNS access
- Stripe/QPay merchant live keys
- Cloudflare R2 bucket/access keys
- Legal/escrow professional sign-off

Алхам бүрийн дэлгэрэнгүй owner/checklist: `PRODUCTION_LAUNCH_CHECKLIST.md`

## 1. Backend deploy: Render

1. Render Dashboard -> New -> Blueprint.
2. Энэ repo-г холбоно.
3. `render.yaml`-г сонгоно.
4. Дараах env-үүдийг бөглөнө:

```text
EXPOCRAFT_WEB_ORIGIN=https://expocraft.mn
FRONTEND_URL=https://expocraft.mn
EXPOCRAFT_PUBLIC_ORIGIN=https://api.expocraft.mn
BACKEND_URL=https://api.expocraft.mn
EXPOCRAFT_CORS_ORIGINS=https://expocraft.mn,https://www.expocraft.mn
GOOGLE_CLIENT_ID=727216094961-nmhhimemqnqopfe440u5d7rd53rpae83.apps.googleusercontent.com
```

Public upload хийх бол Render env дээр нэм:

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
```

Real payment асаах бол:

```text
EXPOCRAFT_PAYMENT_MODE=live
STRIPE_SECRET_KEY=<live-secret>
STRIPE_WEBHOOK_SECRET=<live-webhook-secret>
STRIPE_PUBLISHABLE_KEY=<live-publishable>
QPAY_MERCHANT_ID=<merchant-id>
QPAY_CLIENT_ID=<client-id>
QPAY_CLIENT_SECRET=<client-secret>
QPAY_INVOICE_CODE=<invoice-code>
QPAY_WEBHOOK_SECRET=<webhook-secret>
```

5. Deploy дууссаны дараа backend health шалгана:

```text
https://<render-backend-url>/health
```

Custom domain ашиглавал:

```text
https://api.expocraft.mn/health
```

## 2. Frontend deploy: Vercel

1. Vercel -> Add New Project.
2. Repo import хийнэ.
3. Root Directory: `frontend`
4. Framework: Next.js
5. Environment Variables:

```text
NEXT_PUBLIC_API_URL=https://api.expocraft.mn
API_URL=https://api.expocraft.mn
NEXT_PUBLIC_SITE_URL=https://expocraft.mn
NEXT_PUBLIC_GOOGLE_CLIENT_ID=727216094961-nmhhimemqnqopfe440u5d7rd53rpae83.apps.googleusercontent.com
```

Render default URL-аар түр deploy хийх бол `https://api.expocraft.mn`-ийн оронд
Render-ийн backend URL-аа тавина.

## 3. Google OAuth production

Google Cloud Console -> OAuth Client -> Authorized JavaScript origins:

```text
https://expocraft.mn
https://www.expocraft.mn
```

Local test-д зөвхөн:

```text
http://localhost:3000
```

`192.168...` raw IP-г Google OAuth авахгүй.

## 4. Deploy gate

Доорх хоёр build pass болсон:

```text
Backend: npm run build
Frontend: npm run build
```

Public URL гарсны дараах smoke test:

```text
GET https://api.expocraft.mn/health
GET https://expocraft.mn/login
Google login
Products page
Cart add
Checkout manual payment
```

Security/monitoring final gate: `SECURITY_MONITORING_CHECKLIST.md`
Legal draft docs:

- `docs/legal/TERMS_OF_SERVICE.md`
- `docs/legal/SELLER_AGREEMENT.md`
- `docs/legal/ESCROW_REFUND_POLICY.md`
- `docs/legal/PRIVACY_POLICY.md`
