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
EXPOCRAFT_CORS_ORIGINS=https://expocraft.mn
EXPOCRAFT_SEED=false
EXPOCRAFT_DB_PROVIDER=postgres
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/expocraft?schema=public
REDIS_URL=redis://USER:PASSWORD@HOST:6379/0
EXPOCRAFT_POSTGRES_RELATIONAL_SYNC=true
EXPOCRAFT_STORAGE_PROVIDER=r2
EXPOCRAFT_STORAGE_UPLOAD_URL=https://...
EXPOCRAFT_STORAGE_PUBLIC_BASE_URL=https://cdn.expocraft.mn
EXPOCRAFT_STORAGE_TOKEN=...
EXPOCRAFT_VIRUS_SCAN_REQUIRED=true
EXPOCRAFT_VIRUS_SCAN_URL=https://...
EXPOCRAFT_PAYMENT_MODE=manual
EXPOCRAFT_BANK_TRANSFER_MODE=manual
```

Generate `JWT_SECRET`:

```bash
openssl rand -base64 48
```

Check backend env before deploy:

```bash
cd Backend
npm run env:check
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

## Backup & Monitoring

PostgreSQL logical backup:

```bash
cd Backend
DATABASE_URL=... BACKUP_DIR=/secure/backups npm run backup:postgres
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
```

`NEXT_PUBLIC_GOOGLE_CLIENT_ID` must match backend `GOOGLE_CLIENT_ID`. Leave both empty if Google sign-in is not being used.
