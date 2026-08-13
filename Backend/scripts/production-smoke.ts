'use strict';

require('dotenv').config();

const DEFAULT_TIMEOUT_MS = 10000;

type SmokeCheck = {
  path: string;
  name: string;
  validate: (response: Response, body: string) => void;
};

function baseUrl() {
  const value = String(
    process.env.SMOKE_BASE_URL ||
    process.env.EXPOCRAFT_PUBLIC_ORIGIN ||
    process.env.BACKEND_URL ||
    ''
  ).trim();
  if (!value) {
    throw new Error('Set SMOKE_BASE_URL, EXPOCRAFT_PUBLIC_ORIGIN, or BACKEND_URL before running production smoke checks.');
  }
  return value.replace(/\/$/, '');
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.SMOKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function runCheck(root: string, check: SmokeCheck) {
  const response = await fetchWithTimeout(`${root}${check.path}`);
  const body = await response.text();
  check.validate(response, body);
  console.log(`[smoke:ok] ${check.name} ${check.path}`);
}

function assertStatus(response: Response, body: string, expected = 200) {
  if (response.status !== expected) {
    throw new Error(`Expected HTTP ${expected}, got ${response.status}: ${body.slice(0, 200)}`);
  }
}

async function main() {
  const root = baseUrl();
  const checks: SmokeCheck[] = [
    {
      name: 'health',
      path: '/health',
      validate(response, body) {
        assertStatus(response, body);
        const data = JSON.parse(body);
        if (data.ok !== true) throw new Error('/health did not return ok=true.');
      }
    },
    {
      name: 'openapi',
      path: '/docs/openapi.json',
      validate(response, body) {
        assertStatus(response, body);
        const data = JSON.parse(body);
        if (data.openapi !== '3.0.3') throw new Error('/docs/openapi.json did not return OpenAPI 3.0.3.');
      }
    },
    {
      name: 'prometheus',
      path: '/metrics/prometheus',
      validate(response, body) {
        assertStatus(response, body);
        if (!body.includes('expocraft_http_requests_total')) {
          throw new Error('/metrics/prometheus is missing expocraft_http_requests_total.');
        }
      }
    }
  ];

  for (const check of checks) {
    await runCheck(root, check);
  }
  console.log(`[smoke:ok] production smoke checks passed for ${root}`);
}

main().catch((error) => {
  console.error(`[smoke:error] ${error.message}`);
  process.exit(1);
});
