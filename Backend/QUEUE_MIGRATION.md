# ExpoCraft Queue Migration

This repo now has the production migration path for moving background work out of
the web process.

## Providers

- `EXPOCRAFT_QUEUE_PROVIDER=local`: in-memory queue for development and single
  process demos.
- `EXPOCRAFT_QUEUE_PROVIDER=rabbitmq`: validates `RABBITMQ_URL` and exposes the
  provider state for deploy checks and metrics. The dedicated worker service is
  responsible for processing background jobs.

## Worker

Run the worker process:

```bash
cd Backend
EXPOCRAFT_QUEUE_PROVIDER=rabbitmq RABBITMQ_URL=amqps://... npm run worker:queue
```

The worker runs reconciliation and escrow release on a controlled interval.
Deploy it as a separate service so web requests stay fast and background jobs
can scale independently.

## Rollout

1. Provision RabbitMQ and set `RABBITMQ_URL`.
2. Deploy the worker service with `npm run worker:queue`.
3. Keep the web service on `EXPOCRAFT_JOBS=false` after the worker is stable.
4. Watch `expocraft_queue_info`, job failure alerts, and worker logs.
5. Roll back by disabling the worker and setting web `EXPOCRAFT_JOBS=true`.
