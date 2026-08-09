'use strict';

const path = require('path');

const PORT = Number(process.env.PORT || 4000);
const DATA_DIR = process.env.EXPOCRAFT_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'expo-store.json');
const UPLOAD_DIR = process.env.EXPOCRAFT_UPLOAD_DIR || path.join(DATA_DIR, 'uploads');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.warn('[expocraft] WARNING: JWT_SECRET is not set. Falling back to an insecure default secret in production.');
}
const DEFAULT_COMMISSION_BPS = Number(process.env.COMMISSION_BPS || 1200);

const ROLES = {
  ADMIN: 'admin',
  SELLER: 'seller',
  BUYER: 'buyer'
};

const ORDER_ITEM_STATUS = ['paid', 'accepted', 'making', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed'];
const CUSTOM_STATUS = ['requested', 'quoted', 'accepted', 'rejected', 'expired'];
const INVENTORY_TYPES = ['ready_made', 'limited_stock', 'one_of_one', 'made_to_order'];
const PRODUCT_STATUS = ['active', 'sold', 'hidden'];
const ESCROW_STATUS = ['not_required', 'held', 'released', 'refunded', 'disputed'];
const PAYMENT_PROVIDERS = {
  MNT: ['qpay'],
  USD: ['stripe']
};
const DISPUTE_STATUS = ['open', 'frozen', 'resolved_refund', 'resolved_release', 'rejected'];
const REPORT_STATUS = ['open', 'reviewing', 'resolved', 'dismissed'];
const CONTRACT_STATUS = ['draft', 'sent', 'accepted', 'in_progress', 'completed', 'cancelled'];

module.exports = {
  PORT,
  DATA_DIR,
  DATA_FILE,
  UPLOAD_DIR,
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
