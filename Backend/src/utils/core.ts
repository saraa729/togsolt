'use strict';

const crypto = require('crypto');
import type { Currency } from '../types';

type HttpError = Error & { status?: number; code?: string; details?: unknown };

function now() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

/*
 * ── Мөнгөний нарийвчлал ───────────────────────────────────────────────────
 *
 * Валют бүр өөрийн бутархайн оронтой: төгрөг бүхэл, доллар 2 оронтой. Өмнө нь
 * бүх дүнг `Math.round` хийдэг байсан тул $9.99 → $10, $12.50 → $13 болж
 * центийг устгадаг байв.
 *
 * Дүнг ҮРГЭЛЖ энэ функцээр дамжуулж бөөрөнхийлнө — ингэснээр 0.1+0.2 маягийн
 * хөвөгч таслалын хуримтлагдах алдаа мөр бүр дээр таслагдана.
 */
const ZERO_DECIMAL_CURRENCIES = new Set(['MNT', 'JPY', 'KRW', 'VND', 'CLP', 'ISK', 'UGX', 'XAF', 'XOF', 'XPF']);

function currencyDecimals(currency: Currency = 'MNT'): number {
  return ZERO_DECIMAL_CURRENCIES.has(String(currency)) ? 0 : 2;
}

/** Тухайн валютын нарийвчлалд тааруулж бөөрөнхийлсөн тоо (Money биш). */
function roundAmount(amount: number, currency: Currency = 'MNT'): number {
  const factor = 10 ** currencyDecimals(currency);
  // `Number.EPSILON` нэмэлт нь 1.005 мэт хоёрдмол утгыг дээш нь зөв бөөрөнхийлнө.
  return Math.round((Number(amount) + Number.EPSILON) * factor) / factor;
}

function money(amount: number, currency: Currency = 'MNT') {
  return { amount: roundAmount(amount, currency), currency };
}

/** Хувь (basis point) тооцоод валютын нарийвчлалаар бөөрөнхийлнө. */
function percentOfMoney(value: { amount: number; currency: Currency }, bps: number) {
  return money((Number(value.amount) * Number(bps)) / 10000, value.currency);
}

function httpError(status: number, code: string, message: string, details?: unknown) {
  const err = new Error(message) as HttpError;
  err.status = status;
  err.code = code;
  err.details = details;
  return err;
}

function addMoney(a, b) {
  if (!a) return money(b.amount, b.currency);
  if (a.currency !== b.currency) throw httpError(400, 'currency_mismatch', 'Currency mismatch in money operation.');
  return money(a.amount + b.amount, a.currency);
}

function percentBps(value, bps) {
  return Math.round((value * bps) / 10000);
}

function localize(value, locale = 'mn') {
  if (!value || typeof value !== 'object') return value;
  return value[locale] || value.mn || value.en || Object.values(value)[0];
}

async function readJson(req, maxBytes = 1 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw httpError(413, 'payload_too_large', 'Request body is too large.');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw httpError(400, 'invalid_json', 'Request body must be valid JSON.');
  }
}

async function readRaw(req, maxBytes = 5 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw httpError(413, 'payload_too_large', 'Request body is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = {
  now,
  id,
  money,
  addMoney,
  percentBps,
  percentOfMoney,
  roundAmount,
  currencyDecimals,
  httpError,
  localize,
  readJson,
  readRaw
};
