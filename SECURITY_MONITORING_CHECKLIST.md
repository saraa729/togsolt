# ExpoCraft Security, Monitoring, Backup Checklist

Энэ файл public launch-ийн өмнөх final review-д ашиглагдана.

## Security Gate

- [ ] `JWT_SECRET` 32+ тэмдэгт, random, production-only.
- [ ] `NODE_ENV=production`.
- [ ] `DATABASE_URL` managed PostgreSQL, public internet unrestricted биш.
- [ ] `REDIS_URL` managed Redis/Key Value, multi-instance runtime-д хэрэглэгдэж байгаа.
- [ ] Admin account-д MFA/SSO policy батлагдсан.
- [ ] Payment/R2/SMTP/API secrets git-д байхгүй.
- [ ] Secrets rotation owner + calendar тогтсон.
- [ ] Upload bucket public write off.
- [ ] Upload write зөвхөн backend signed/API key-р явна.
- [ ] `EXPOCRAFT_VIRUS_SCAN_REQUIRED=true`.
- [ ] Virus scan endpoint production дээр reachable.
- [ ] CORS зөвхөн production frontend domain-оор хязгаарласан.
- [ ] Rate limit Redis-backed.
- [ ] Dependency audit reviewed.
- [ ] Public launch pentest эсвэл security review хийсэн.

## Monitoring Gate

- [ ] Backend `/health` alert.
- [ ] Backend `/metrics/prometheus` scrape.
- [ ] Render/Vercel deployment failure alert.
- [ ] HTTP 5xx spike alert.
- [ ] Payment webhook failure alert.
- [ ] Escrow/reconciliation job failure alert.
- [ ] Payout queue SLA alert.
- [ ] Dispute queue SLA alert.
- [ ] Backup stale alert.
- [ ] Admin audit export хадгалах workflow.

## Backup Gate

- [ ] Managed Postgres automatic backup enabled.
- [ ] Backup retention 14-30 days.
- [ ] Logical backup job configured.
- [ ] Backup storage encrypted.
- [ ] Monthly restore drill scheduled.
- [ ] Restore runbook owner assigned.

## Release Gate

- [ ] Backend build pass.
- [ ] Frontend build pass.
- [ ] Backend env check pass.
- [ ] Production readiness reviewed.
- [ ] Domain SSL valid.
- [ ] Google OAuth production origins added.
- [ ] Payment test transaction passed.
- [ ] R2 image upload test passed.
- [ ] Legal docs approved.

