'use strict';

const path = require('path');

const PORT = Number(process.env.PORT || 4000);
const DATA_DIR = path.resolve(process.env.EXPOCRAFT_DATA_DIR || path.join(process.cwd(), 'data'));
const DATA_FILE = path.join(DATA_DIR, 'expo-store.json');
const UPLOAD_DIR = path.resolve(process.env.EXPOCRAFT_UPLOAD_DIR || path.join(DATA_DIR, 'uploads'));
const NODE_ENV = process.env.NODE_ENV || 'development';
const DB_PROVIDER = String(process.env.EXPOCRAFT_DB_PROVIDER || 'json').toLowerCase();
const WEB_ORIGIN = (process.env.EXPOCRAFT_WEB_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
const PUBLIC_ORIGIN = (process.env.EXPOCRAFT_PUBLIC_ORIGIN || process.env.BACKEND_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const CORS_ORIGINS = (process.env.EXPOCRAFT_CORS_ORIGINS || WEB_ORIGIN)
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function validateProductionEnv() {
  if (NODE_ENV !== 'production') return;
  const missing: string[] = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-change-me' || process.env.JWT_SECRET.length < 32) {
    missing.push('JWT_SECRET (32+ chars random secret)');
  }
  if (['postgres', 'prisma'].includes(DB_PROVIDER) && !process.env.DATABASE_URL) {
    missing.push('DATABASE_URL');
  }
  if (!process.env.EXPOCRAFT_WEB_ORIGIN && !process.env.FRONTEND_URL) {
    missing.push('EXPOCRAFT_WEB_ORIGIN or FRONTEND_URL');
  }
  if (missing.length > 0) {
    throw new Error(`[expocraft] Missing production environment: ${missing.join(', ')}`);
  }
}
validateProductionEnv();
const DEFAULT_COMMISSION_BPS = Number(process.env.COMMISSION_BPS || 1200);

const ROLES = {
  ADMIN: 'admin',
  SELLER: 'seller',
  BUYER: 'buyer'
};

// `pending_payment` — мөр үүссэн ч төлбөр батлагдаагүй; урлаач хараахан хөндөхгүй.
const ORDER_ITEM_STATUS = ['pending_payment', 'paid', 'accepted', 'making', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed'];
const CUSTOM_STATUS = ['requested', 'quoted', 'accepted', 'rejected', 'expired'];
const INVENTORY_TYPES = ['ready_made', 'limited_stock', 'one_of_one', 'made_to_order'];
const PRODUCT_STATUS = ['active', 'sold', 'hidden'];
// `pending` — захиалга үүссэн ч provider төлбөрийг батлаагүй байгаа үе.
const ESCROW_STATUS = ['pending', 'not_required', 'held', 'released', 'refunded', 'disputed'];
// `simulated` — тохируулсан provider байхгүй үеийн dev горим (live үед хоригдоно).
const PAYMENT_PROVIDERS = {
  MNT: ['qpay', 'simulated'],
  USD: ['stripe', 'simulated']
};
const DISPUTE_STATUS = ['open', 'frozen', 'resolved_refund', 'resolved_release', 'rejected'];
const REPORT_STATUS = ['open', 'reviewing', 'resolved', 'dismissed'];
const CONTRACT_STATUS = ['draft', 'sent', 'accepted', 'in_progress', 'completed', 'cancelled'];

module.exports = {
  PORT,
  DATA_DIR,
  DATA_FILE,
  UPLOAD_DIR,
  NODE_ENV,
  DB_PROVIDER,
  WEB_ORIGIN,
  PUBLIC_ORIGIN,
  CORS_ORIGINS,
  JWT_SECRET,
  DEFAULT_COMMISSION_BPS,
  ROLES,
  ORDER_ITEM_STATUS,
  CUSTOM_STATUS,
  INVENTORY_TYPES,
  PRODUCT_STATUS,
  ESCROW_STATUS,
  PAYMENT_PROVIDERS,
  DISPUTE_STATUS,
  REPORT_STATUS,
  CONTRACT_STATUS
};
