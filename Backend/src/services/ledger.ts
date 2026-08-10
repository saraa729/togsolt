'use strict';

import type { CoreServices, Money, ServiceFactory } from '../types';

type LedgerServiceInput = Pick<CoreServices, 'db' | 'audit' | 'id' | 'now' | 'money' | 'addMoney'>;
type LedgerService = Record<string, (...args: any[]) => any>;

const createLedgerService: ServiceFactory<LedgerServiceInput, LedgerService> = function createLedgerService({ db, audit, id, now, money, addMoney }) {
  function addEscrowEntry(orderId: string, orderItemId: string | null, sellerId: string | null, type: string, amount: Money, note?: string) {
    const entry = {
      id: id('esc'),
      orderId,
      orderItemId,
      sellerId,
      type,
      amount,
      currency: amount.currency,
      note,
      createdAt: now()
    };
    db.escrowLedger.push(entry);
    return entry;
  }

  function sumLedger(predicate: (entry: any) => boolean) {
    const totals = {};
    for (const entry of db.escrowLedger.filter(predicate)) {
      const currency = entry.amount.currency;
      totals[currency] = (totals[currency] || 0) + entry.amount.amount;
    }
    return totals;
  }

  function ledgerBalances(sellerId: string | null = null) {
    const sellerReleased = sumLedger((entry) => entry.type === 'release_to_seller_balance' && (!sellerId || entry.sellerId === sellerId));
    const sellerPayouts = sumLedger((entry) => entry.type === 'payout_scheduled' && (!sellerId || entry.sellerId === sellerId));
    const sellerBalance = {};
    for (const currency of new Set([...Object.keys(sellerReleased), ...Object.keys(sellerPayouts)])) {
      sellerBalance[currency] = (sellerReleased[currency] || 0) - (sellerPayouts[currency] || 0);
    }
    return {
      escrowHeld: sumLedger((entry) => entry.type === 'hold_buyer_payment' && (!sellerId || entry.sellerId === sellerId)),
      sellerReleased,
      sellerPayouts,
      sellerBalance,
      platformCommission: sumLedger((entry) => entry.type === 'reserve_platform_commission' && (!sellerId || entry.sellerId === sellerId)),
      refunds: sumLedger((entry) => entry.type === 'refund_to_buyer' && (!sellerId || entry.sellerId === sellerId))
    };
  }

  function reconciliationForDate(dateText?: string) {
    const date = dateText || now().slice(0, 10);
    const entries = db.escrowLedger.filter((entry) => entry.createdAt.slice(0, 10) === date);
    return {
      date,
      entryCount: entries.length,
      byType: entries.reduce((acc, entry) => {
        acc[entry.type] = acc[entry.type] || {};
        acc[entry.type][entry.amount.currency] = (acc[entry.type][entry.amount.currency] || 0) + entry.amount.amount;
        return acc;
      }, {}),
      balances: ledgerBalances()
    };
  }

  function syncOrderEscrowStatus(orderId: string) {
    const order = db.orders.find((candidate) => candidate.id === orderId);
    if (!order) return null;
    const items = db.orderItems.filter((item) => item.orderId === orderId);
    if (items.length === 0) return order;
    if (items.every((item) => item.escrowStatus === 'released')) {
      order.escrowStatus = 'released';
      order.status = 'completed';
    } else if (items.every((item) => item.escrowStatus === 'refunded')) {
      order.escrowStatus = 'refunded';
      order.status = 'refunded';
    } else if (items.some((item) => item.escrowStatus === 'disputed')) {
      order.escrowStatus = 'disputed';
      order.status = 'disputed';
    } else {
      order.escrowStatus = 'held';
      order.status = 'paid';
    }
    return order;
  }

  function freezeEscrowForOrderItem(item: any, actorId: string, reason?: string) {
    if (!['held', 'released'].includes(item.escrowStatus)) return null;
    item.escrowStatus = 'disputed';
    item.status = 'disputed';
    const entry = addEscrowEntry(item.orderId, item.id, item.sellerId, 'freeze_escrow_dispute', item.lineTotal, reason || 'Escrow frozen by dispute.');
    audit(actorId, 'freeze_escrow', 'order_item', item.id, { escrowEntryId: entry.id });
    syncOrderEscrowStatus(item.orderId);
    return entry;
  }

  function releaseEscrowForOrderItem(item: any, actorId: string) {
    if (!['held', 'disputed'].includes(item.escrowStatus)) return null;
    item.escrowStatus = 'released';
    item.escrowReleasedAt = now();
    if (item.status === 'delivered') item.status = 'completed';
    if (!item.salesCountedAt) {
      const shop = db.shops.find((candidate) => candidate.id === item.shopId);
      if (shop) {
        shop.stats = shop.stats || {};
        shop.stats.salesCount = Number(shop.stats.salesCount || 0) + item.quantity;
      }
      const product = db.products.find((candidate) => candidate.id === item.productId);
      if (product) product.salesCount = Number(product.salesCount || 0) + item.quantity;
      item.salesCountedAt = now();
    }
    /*
     * Гэрээтэй захиалга дуусахад үлдсэн үе шатууд төлөгдсөнд тооцогдоно.
     * Escrow чөлөөлөгдөх нь мөнгө урлаачид очсон гэсэн үг тул гэрээ биелсэн.
     * Энд байрлуулсан шалтгаан: гараар баталгаажуулах болон автомат чөлөөлөх
     * хоёр зам хоёулаа энэ функцээр дамждаг.
     */
    if (item.customRequestId) {
      const contract = db.contracts.find((candidate) => candidate.customRequestId === item.customRequestId);
      if (contract && contract.status !== 'cancelled') {
        for (const milestone of contract.depositSchedule || []) {
          if (milestone.status !== 'paid') {
            milestone.status = 'paid';
            milestone.paidAt = now();
          }
        }
        contract.status = 'completed';
        contract.completedAt = now();
        contract.updatedAt = now();
        audit(actorId, 'contract_completed', 'contract', contract.id, { orderItemId: item.id });
      }
    }

    const entry = addEscrowEntry(item.orderId, item.id, item.sellerId, 'release_to_seller_balance', item.sellerReceivable, 'Released after delivery confirmation.');
    audit(actorId, 'release_escrow', 'order_item', item.id, { escrowEntryId: entry.id });
    return entry;
  }

  function refundEscrowForOrderItem(item: any, actorId: string, reason = 'Order item cancelled before delivery.') {
    if (!['held', 'disputed'].includes(item.escrowStatus)) return null;
    item.escrowStatus = 'refunded';
    item.escrowReleasedAt = null;
    const entry = addEscrowEntry(item.orderId, item.id, item.sellerId, 'refund_to_buyer', item.lineTotal, reason);
    audit(actorId, 'refund_escrow', 'order_item', item.id, { escrowEntryId: entry.id });
    return entry;
  }

  return {
    addEscrowEntry,
    ledgerBalances,
    reconciliationForDate,
    freezeEscrowForOrderItem,
    releaseEscrowForOrderItem,
    refundEscrowForOrderItem,
    syncOrderEscrowStatus
  };
};

module.exports = { createLedgerService };
