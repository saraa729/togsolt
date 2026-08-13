'use strict';

require('dotenv').config();

function value(name: string) {
  return String(process.env[name] || '').trim();
}

function isMissing(name: string) {
  return value(name).length === 0 || value(name).startsWith('change-me') || value(name).includes('example.com');
}

function isHttpsUrl(name: string) {
  const current = value(name);
  return current.length > 0 && /^https:\/\//i.test(current);
}

function main() {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeEnv = value('NODE_ENV') || 'development';
  const dbProvider = (value('EXPOCRAFT_DB_PROVIDER') || 'json').toLowerCase();
  const paymentMode = (value('EXPOCRAFT_PAYMENT_MODE') || 'manual').toLowerCase();
  const storageProvider = (value('EXPOCRAFT_STORAGE_PROVIDER') || 'local').toLowerCase();
  const queueProvider = (value('EXPOCRAFT_QUEUE_PROVIDER') || 'local').toLowerCase();

  if (nodeEnv !== 'production') warnings.push(`NODE_ENV is "${nodeEnv}". Production deploy should use NODE_ENV=production.`);
  if (isMissing('JWT_SECRET') || value('JWT_SECRET').length < 32) errors.push('JWT_SECRET must be a real random secret with 32+ characters.');
  if (!['json', 'prisma', 'postgres'].includes(dbProvider)) errors.push('EXPOCRAFT_DB_PROVIDER must be json, prisma, or postgres.');
  if (['prisma', 'postgres'].includes(dbProvider) && isMissing('DATABASE_URL')) errors.push('DATABASE_URL is required for PostgreSQL/Prisma deploys.');
  if (nodeEnv === 'production' && isMissing('REDIS_URL')) errors.push('REDIS_URL is required for production runtime state and rate limits.');
  if (value('REDIS_URL') && !/^rediss?:\/\//i.test(value('REDIS_URL'))) errors.push('REDIS_URL must start with redis:// or rediss://.');
  if (isMissing('EXPOCRAFT_WEB_ORIGIN') && isMissing('FRONTEND_URL')) errors.push('EXPOCRAFT_WEB_ORIGIN or FRONTEND_URL is required.');
  if (isMissing('EXPOCRAFT_PUBLIC_ORIGIN') && isMissing('BACKEND_URL')) warnings.push('EXPOCRAFT_PUBLIC_ORIGIN or BACKEND_URL is not set.');
  if (nodeEnv === 'production') {
    for (const name of ['EXPOCRAFT_WEB_ORIGIN', 'FRONTEND_URL', 'EXPOCRAFT_PUBLIC_ORIGIN', 'BACKEND_URL']) {
      if (value(name) && !isHttpsUrl(name)) warnings.push(`${name} should use https:// in production.`);
    }
  }
  if (value('EXPOCRAFT_SEED') === 'true') warnings.push('EXPOCRAFT_SEED=true should not be used for a real production marketplace.');
  if (nodeEnv === 'production' && storageProvider === 'local') warnings.push('EXPOCRAFT_STORAGE_PROVIDER=local is only suitable for single-instance demos; use R2/S3-compatible object storage for production.');
  if (!['local', 'http', 'cloudinary', 'r2', 's3'].includes(storageProvider)) errors.push('EXPOCRAFT_STORAGE_PROVIDER must be local, http, cloudinary, r2, or s3.');
  if (['r2', 's3'].includes(storageProvider)) {
    for (const name of [
      'EXPOCRAFT_STORAGE_PUBLIC_BASE_URL',
      storageProvider === 'r2' ? 'EXPOCRAFT_R2_ENDPOINT' : 'EXPOCRAFT_S3_ENDPOINT',
      storageProvider === 'r2' ? 'EXPOCRAFT_R2_BUCKET' : 'EXPOCRAFT_S3_BUCKET',
      storageProvider === 'r2' ? 'EXPOCRAFT_R2_ACCESS_KEY_ID' : 'EXPOCRAFT_S3_ACCESS_KEY_ID',
      storageProvider === 'r2' ? 'EXPOCRAFT_R2_SECRET_ACCESS_KEY' : 'EXPOCRAFT_S3_SECRET_ACCESS_KEY'
    ]) {
      if (isMissing(name)) errors.push(`${name} is required when EXPOCRAFT_STORAGE_PROVIDER=${storageProvider}.`);
    }
  }
  if (['http', 'cloudinary'].includes(storageProvider)) {
    for (const name of ['EXPOCRAFT_STORAGE_UPLOAD_URL', 'EXPOCRAFT_STORAGE_PUBLIC_BASE_URL']) {
      if (isMissing(name)) errors.push(`${name} is required when EXPOCRAFT_STORAGE_PROVIDER=${storageProvider}.`);
    }
  }
  if (value('EXPOCRAFT_VIRUS_SCAN_REQUIRED') === 'true' && isMissing('EXPOCRAFT_VIRUS_SCAN_URL')) {
    errors.push('EXPOCRAFT_VIRUS_SCAN_URL is required when EXPOCRAFT_VIRUS_SCAN_REQUIRED=true.');
  }
  if (nodeEnv === 'production' && value('EXPOCRAFT_VIRUS_SCAN_REQUIRED') !== 'true') warnings.push('EXPOCRAFT_VIRUS_SCAN_REQUIRED=true is recommended before public launch.');
  if (!['local', 'rabbitmq'].includes(queueProvider)) errors.push('EXPOCRAFT_QUEUE_PROVIDER must be local or rabbitmq.');
  if (queueProvider === 'rabbitmq' && isMissing('RABBITMQ_URL')) errors.push('RABBITMQ_URL is required when EXPOCRAFT_QUEUE_PROVIDER=rabbitmq.');

  /*
   * Валют бүр өөрийн provider-тэй: USD→Stripe, MNT→QPay. Live горимд ЯДАЖ нэг
   * нь бүрэн тохируулагдсан байх ёстой; дутуу нь тухайн валютын checkout-ыг
   * ажиллуулахгүй (503) тул алдаа биш, анхааруулга болгож мэдэгдэнэ.
   */
  const stripeReady = !isMissing('STRIPE_SECRET_KEY') && !isMissing('STRIPE_WEBHOOK_SECRET');
  const qpayReady = !isMissing('QPAY_CLIENT_ID') && !isMissing('QPAY_CLIENT_SECRET') && !isMissing('QPAY_INVOICE_CODE');

  if (paymentMode === 'live') {
    if (!stripeReady && !qpayReady) {
      errors.push('EXPOCRAFT_PAYMENT_MODE=live requires at least one payment provider: Stripe (STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET) or QPay (QPAY_CLIENT_ID + QPAY_CLIENT_SECRET + QPAY_INVOICE_CODE).');
    }
    if (!stripeReady) warnings.push('Stripe is not configured; USD checkout will return 503.');
    if (!qpayReady) warnings.push('QPay is not configured; MNT checkout will return 503.');
    if (qpayReady && isMissing('QPAY_WEBHOOK_SECRET')) {
      warnings.push('QPAY_WEBHOOK_SECRET is unset; the QPay callback token falls back to JWT_SECRET.');
    }
    if (isMissing('EXPOCRAFT_PUBLIC_API_URL')) {
      warnings.push('EXPOCRAFT_PUBLIC_API_URL is unset; QPay callbacks default to http://localhost:4000 and will not reach this server.');
    }
    if (!isMissing('STRIPE_API_URL')) {
      errors.push('STRIPE_API_URL is a test-only override and must not be set in production.');
    }
  } else {
    warnings.push('EXPOCRAFT_PAYMENT_MODE is not live; currencies without provider credentials fall back to simulated payments that capture instantly.');
  }

  if (value('EXPOCRAFT_BANK_TRANSFER_MODE') === 'api') {
    for (const name of ['EXPOCRAFT_BANK_API_URL', 'EXPOCRAFT_BANK_API_KEY']) {
      if (isMissing(name)) errors.push(`${name} is required when EXPOCRAFT_BANK_TRANSFER_MODE=api.`);
    }
  }

  if (value('SMTP_HOST') && (isMissing('SMTP_FROM') || (value('SMTP_USER') && isMissing('SMTP_PASS')))) {
    errors.push('SMTP_FROM and SMTP_PASS are required for authenticated SMTP.');
  }
  if (value('EXPOCRAFT_CARRIER_API_URL')) {
    if (!isHttpsUrl('EXPOCRAFT_CARRIER_API_URL')) warnings.push('EXPOCRAFT_CARRIER_API_URL should use https:// in production.');
    if (isMissing('EXPOCRAFT_CARRIER_API_KEY')) warnings.push('EXPOCRAFT_CARRIER_API_KEY is empty; carrier requests will be unauthenticated.');
  }
  if (value('EXPOCRAFT_AI_SUGGEST_URL')) {
    if (!isHttpsUrl('EXPOCRAFT_AI_SUGGEST_URL')) warnings.push('EXPOCRAFT_AI_SUGGEST_URL should use https:// in production.');
    if (isMissing('EXPOCRAFT_AI_API_KEY')) warnings.push('EXPOCRAFT_AI_API_KEY is empty; AI suggestion requests will be unauthenticated.');
  }

  for (const warning of warnings) console.warn(`[env:warn] ${warning}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`[env:error] ${error}`);
    process.exit(1);
  }
  console.log('[env:ok] Production environment is deploy-ready.');
}

main();
