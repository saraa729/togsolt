# ExpoCraft Deploy Environment

Production deploy хийхдээ secret-үүдийг git-д commit хийхгүй. Доорх template-үүдийг deploy platform дээр environment variables болгон оруулна.

## Backend

Template: `Backend/.env.example`

Required minimum:

```bash
NODE_ENV=production
PORT=4000
JWT_SECRET=<openssl rand -base64 48>
EXPOCRAFT_WEB_ORIGIN=https://expocraft.mn
EXPOCRAFT_PUBLIC_ORIGIN=https://api.expocraft.mn
EXPOCRAFT_PUBLIC_API_URL=https://api.expocraft.mn
EXPOCRAFT_CORS_ORIGINS=https://expocraft.mn
EXPOCRAFT_SEED=false
EXPOCRAFT_PROVIDER_TIMEOUT_MS=10000
EXPOCRAFT_DB_PROVIDER=postgres
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/expocraft?schema=public
REDIS_URL=redis://USER:PASSWORD@HOST:6379/0
EXPOCRAFT_POSTGRES_RELATIONAL_SYNC=true
EXPOCRAFT_STORAGE_PROVIDER=r2
EXPOCRAFT_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
EXPOCRAFT_R2_BUCKET=expocraft-uploads
EXPOCRAFT_R2_REGION=auto
EXPOCRAFT_R2_ACCESS_KEY_ID=<r2-access-key>
EXPOCRAFT_R2_SECRET_ACCESS_KEY=<r2-secret-key>
EXPOCRAFT_STORAGE_PUBLIC_BASE_URL=https://cdn.expocraft.mn
EXPOCRAFT_VIRUS_SCAN_REQUIRED=true
EXPOCRAFT_VIRUS_SCAN_URL=https://...
EXPOCRAFT_PAYMENT_MODE=manual
EXPOCRAFT_BANK_TRANSFER_MODE=manual
EXPOCRAFT_QUEUE_PROVIDER=local
```

Generate `JWT_SECRET`:

```bash
openssl rand -base64 48
```

Check backend env before deploy:

```bash
cd Backend
npm run env:check
npm run smoke:providers
npm run smoke:monitoring
```

If real payment is enabled:

```bash
EXPOCRAFT_PAYMENT_MODE=live
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
QPAY_MERCHANT_ID=...
QPAY_CLIENT_ID=...
QPAY_CLIENT_SECRET=...
QPAY_INVOICE_CODE=...
QPAY_WEBHOOK_SECRET=...
```

If bank API payout is enabled:

```bash
EXPOCRAFT_BANK_TRANSFER_MODE=api
EXPOCRAFT_BANK_API_URL=...
EXPOCRAFT_BANK_API_KEY=...
```

Without bank API credentials, use the admin manual payout workflow: approve request, transfer in internet bank, then record the transaction reference as paid.

If RabbitMQ worker migration is enabled:

```bash
EXPOCRAFT_QUEUE_PROVIDER=rabbitmq
RABBITMQ_URL=amqps://USER:PASSWORD@HOST/VHOST
EXPOCRAFT_WORKER_INTERVAL_MS=60000
```

Carrier provider:

```bash
EXPOCRAFT_CARRIER_API_URL=https://carrier-provider.example
EXPOCRAFT_CARRIER_API_KEY=<carrier-api-key>
```

AI suggestion provider:

```bash
EXPOCRAFT_AI_SUGGEST_URL=https://ai-provider.example/suggest
EXPOCRAFT_AI_API_KEY=<ai-api-key>
```

Provider payload/response contracts:

```text
Backend/PROVIDER_CONTRACTS.md
```

If mobile store releases are complete, set these only in the release audit environment used for readiness reporting:

```bash
EXPOCRAFT_MOBILE_IOS_RELEASED=true
EXPOCRAFT_MOBILE_ANDROID_RELEASED=true
```

## Backup & Monitoring

PostgreSQL logical backup:

```bash
cd Backend
DATABASE_URL=... BACKUP_DIR=/secure/backups npm run backup:postgres
```

Restore drill:

```bash
cd Backend
DATABASE_URL=... BACKUP_FILE=/secure/backups/expocraft-YYYY-MM-DD.sql.gz npm run restore:postgres
```

Prometheus scrape:

```text
https://api.expocraft.mn/metrics/prometheus
```

Alert rules:

```text
Backend/monitoring/alerts.yml
```

## Frontend

Template: `frontend/.env.example`

Required minimum:

```bash
NEXT_PUBLIC_API_URL=https://api.expocraft.mn
API_URL=https://api.expocraft.mn
NEXT_PUBLIC_SITE_URL=https://expocraft.mn
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_GOOGLE_LOCAL_ORIGIN=https://expocraft.mn
```

`NEXT_PUBLIC_GOOGLE_CLIENT_ID` must match backend `GOOGLE_CLIENT_ID`. Leave both empty if Google sign-in is not being used.

## Step-by-step Dashboard Order

Use:

```text
DEPLOY_STEPS.md
```

It lists the exact Render and Vercel dashboard order and the env values that
must be pasted into each service.
