# ExpoCraft Provider Contracts

This document tells external providers exactly what ExpoCraft sends and expects.
All provider URLs should be HTTPS in production. Backend calls use
`EXPOCRAFT_PROVIDER_TIMEOUT_MS` with a 10 second default.

## Object Storage: R2/S3

Backend uploads directly with AWS Signature V4 `PUT`.

Required env:

```bash
EXPOCRAFT_STORAGE_PROVIDER=r2
EXPOCRAFT_R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
EXPOCRAFT_R2_BUCKET=expocraft-uploads
EXPOCRAFT_R2_REGION=auto
EXPOCRAFT_R2_ACCESS_KEY_ID=<access-key>
EXPOCRAFT_R2_SECRET_ACCESS_KEY=<secret-key>
EXPOCRAFT_STORAGE_PUBLIC_BASE_URL=https://cdn.expocraft.mn
```

Security posture:

- Bucket public write: off.
- Backend has write permission.
- CDN/public base URL has read-only access.
- Uploaded image URLs are stored as public CDN URLs.

## Virus Scan Provider

Backend calls the scanner before saving an upload.

Request:

```http
POST <EXPOCRAFT_VIRUS_SCAN_URL>
Authorization: Bearer <EXPOCRAFT_VIRUS_SCAN_TOKEN>
Content-Type: <uploaded-file-content-type>
X-File-Name: <uploaded-file-name>
```

Body is the raw uploaded file bytes.

Accepted clean response:

```json
{ "status": "clean", "clean": true, "id": "scan_123" }
```

Rejected response:

```json
{ "status": "infected", "clean": false }
```

If `EXPOCRAFT_VIRUS_SCAN_REQUIRED=true`, scanner failures block uploads.

## Carrier Rates Provider

Backend endpoint: `POST /shipping/estimate`

Provider request:

```http
POST <EXPOCRAFT_CARRIER_API_URL>/rates
Authorization: Bearer <EXPOCRAFT_CARRIER_API_KEY>
Content-Type: application/json
```

Payload:

```json
{
  "destinationCountry": "US",
  "currency": "USD",
  "totalWeightGram": 500,
  "lines": [
    {
      "productId": "prd_...",
      "title": "Felt ornament",
      "quantity": 1,
      "weightGram": 500,
      "value": { "amount": 35, "currency": "USD" },
      "hsCode": "9703.00",
      "customsDescription": "Handmade felt ornament",
      "originCountry": "MN"
    }
  ],
  "fallbackEstimate": {}
}
```

Provider response:

```json
{
  "provider": "carrier_name",
  "estimate": {
    "shipping": { "amount": 32, "currency": "USD" },
    "taxEstimate": { "amount": 2.8, "currency": "USD" },
    "dutiesNote": "Final duties are collected by destination customs.",
    "requiredDocuments": ["commercial_invoice", "customs_declaration_cn23"]
  }
}
```

If no carrier provider is configured, ExpoCraft returns a rule-based fallback.

## AI Suggestion Provider

Backend endpoint: `POST /ai/products/suggest`

Provider request:

```http
POST <EXPOCRAFT_AI_SUGGEST_URL>
Authorization: Bearer <EXPOCRAFT_AI_API_KEY>
Content-Type: application/json
```

Payload is the seller's product draft, for example:

```json
{
  "title": "felt souvenir",
  "mn": "Эсгий бэлэг",
  "description": "Hand felted ornament",
  "imageHints": ["red", "wool"]
}
```

Provider response:

```json
{
  "suggestions": {
    "categorySlug": "felt-craft",
    "materials": ["felt", "wool"],
    "techniques": ["hand_felting"],
    "translation": { "en": "Felt gift" },
    "tags": ["handmade", "mongolian-craft"]
  }
}
```

If no AI provider is configured, ExpoCraft returns rule-based fallback
suggestions.

## RabbitMQ Worker

Required env:

```bash
EXPOCRAFT_QUEUE_PROVIDER=rabbitmq
RABBITMQ_URL=amqps://USER:PASSWORD@HOST/VHOST
EXPOCRAFT_WORKER_INTERVAL_MS=60000
```

Deploy the web service and worker service separately. Keep background jobs out
of the web service when the worker is live.
