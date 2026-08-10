'use strict';

import type { CoreServices, Locale, Currency, ServiceFactory } from '../types';

type CartServiceInput = Pick<CoreServices, 'db' | 'id' | 'now' | 'money' | 'addMoney'> & {
  productResponse: (product: any, locale?: Locale, currency?: Currency) => any;
  orderTypeForCartItem: (cartItem: any, product: any) => string;
  shippingInfoForProduct: (product: any, locale?: Locale) => any[];
};

type CartService = {
  getOrCreateCart: (buyerId: string) => any;
  cartResponse: (cart: any, locale?: Locale, currency?: Currency) => any;
};

const createCartService: ServiceFactory<CartServiceInput, CartService> = function createCartService({ db, id, now, money, addMoney, productResponse, orderTypeForCartItem, shippingInfoForProduct }) {
  function getOrCreateCart(buyerId: string) {
    let cart = db.carts.find((item) => item.buyerId === buyerId);
    if (!cart) {
      cart = { id: id('cart'), buyerId, items: [], updatedAt: now() };
      db.carts.push(cart);
    }
    return cart;
  }

  function cartResponse(cart: any, locale: Locale = 'mn', currency: Currency = 'MNT') {
    let subtotal = null;
    const items = cart.items.map((item) => {
      const product = db.products.find((candidate) => candidate.id === item.productId);
      if (!product) return { ...item, unavailable: true };
      const unitPrice = item.quotedPrice || (currency === 'USD' && product.internationalPrice ? product.internationalPrice : product.price);
      const lineTotal = money(unitPrice.amount * item.quantity, unitPrice.currency);
      subtotal = addMoney(subtotal, lineTotal);
      return {
        ...item,
        product: productResponse(product, locale, currency),
        orderType: item.orderType || orderTypeForCartItem(item, product),
        availableShippingOptions: shippingInfoForProduct(product, locale),
        unitPrice,
        lineTotal
      };
    });
    const sellerGroups = [];
    for (const item of items) {
      if (item.unavailable) continue;
      let group = sellerGroups.find((candidate) => candidate.sellerId === item.product.sellerId);
      if (!group) {
        group = {
          sellerId: item.product.sellerId,
          shopId: item.product.shopId,
          shop: item.product.shop,
          items: [],
          subtotal: money(0, item.lineTotal.currency)
        };
        sellerGroups.push(group);
      }
      group.items.push(item);
      group.subtotal = addMoney(group.subtotal, item.lineTotal);
    }
    return { ...cart, items, sellerGroups, totals: { subtotal: subtotal || money(0, currency) } };
  }

  return {
    getOrCreateCart,
    cartResponse
  };
};

module.exports = { createCartService };
