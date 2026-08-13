# ExpoCraft Render/Vercel Deployment Steps

This is the click-by-click order for setting production environment variables.
Secrets must be entered only in provider dashboards, never committed to git.

## 1. Render Backend

1. Render Dashboard -> New -> Blueprint.
2. Connect this Git repo.
3. Select root `render.yaml`.
4. Confirm services:
   - `expocraft-backend`
   - `expocraft-worker`
   - `expocraft-postgres`
   - `expocraft-redis`
5. Fill these backend env values:

```bash
EXPOCRAFT_WEB_ORIGIN=https://<vercel-domain>
FRONTEND_URL=https://<vercel-domain>
EXPOCRAFT_PUBLIC_ORIGIN=https://<render-backend-domain>
EXPOCRAFT_PUBLIC_API_URL=https://<render-backend-domain>
BACKEND_URL=https://<render-backend-domain>
EXPOCRAFT_CORS_ORIGINS=https://<vercel-domain>
```

6. Fill storage/scanner env when ready:

```bash
EXPOCRAFT_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
EXPOCRAFT_R2_BUCKET=expocraft-uploads
EXPOCRAFT_R2_ACCESS_KEY_ID=<r2-access-key>
EXPOCRAFT_R2_SECRET_ACCESS_KEY=<r2-secret-key>
EXPOCRAFT_STORAGE_PUBLIC_BASE_URL=https://cdn.expocraft.mn
EXPOCRAFT_VIRUS_SCAN_URL=https://<scanner-url>
EXPOCRAFT_VIRUS_SCAN_TOKEN=<scanner-token>
```

7. Fill optional providers when ready:

```bash
EXPOCRAFT_CARRIER_API_URL=https://<carrier-provider>
EXPOCRAFT_CARRIER_API_KEY=<carrier-key>
EXPOCRAFT_AI_SUGGEST_URL=https://<ai-provider>
EXPOCRAFT_AI_API_KEY=<ai-key>
RABBITMQ_URL=amqps://USER:PASSWORD@HOST/VHOST
```

8. After deploy, run:

```bash
cd Backend
SMOKE_BASE_URL=https://<render-backend-domain> npm run smoke:production
```

## 2. Vercel Frontend

1. Vercel -> Add New Project.
2. Import this Git repo.
3. Root Directory: `frontend`.
4. Framework: Next.js.
5. Set env:

```bash
NEXT_PUBLIC_API_URL=https://<render-backend-domain>
API_URL=https://<render-backend-domain>
NEXT_PUBLIC_SITE_URL=https://<vercel-domain>
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<google-client-id>
NEXT_PUBLIC_GOOGLE_LOCAL_ORIGIN=https://<vercel-domain>
```

6. Deploy.
7. Smoke check:

```bash
curl -I https://<vercel-domain>/login
curl -I https://<vercel-domain>/products
```

## 3. Final Local Verification

Before switching traffic to a public domain:

```bash
cd Backend
npm test
npm run production:readiness
npm run smoke:monitoring
npm run smoke:providers

cd ../frontend
npm run lint
npm run build
```
