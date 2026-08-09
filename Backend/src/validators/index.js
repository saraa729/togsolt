'use strict';

function createValidators({ db, httpError, INVENTORY_TYPES, PAYMENT_PROVIDERS }) {
  function assertText(value, field, min = 1) {
    if (typeof value !== 'string' || value.trim().length < min) {
      throw httpError(422, 'validation_error', `${field} is required.`);
    }
    return value.trim();
  }

  function assertLocalized(value, field) {
    if (!value || typeof value !== 'object' || (!value.mn && !value.en)) {
      throw httpError(422, 'validation_error', `${field} must include mn or en text.`);
    }
    return {
      mn: value.mn ? String(value.mn).trim() : undefined,
      en: value.en ? String(value.en).trim() : undefined
    };
  }

  function translationSuggestions(localized = {}) {
    const suggestions = {};
    if (localized.mn && !localized.en) suggestions.en = `[Needs English translation] ${localized.mn}`;
    if (localized.en && !localized.mn) suggestions.mn = `[Монгол орчуулгын санал хэрэгтэй] ${localized.en}`;
    return suggestions;
  }

  function localizedPayload(value, field) {
    const localized = assertLocalized(value, field);
    return {
      value: localized,
      translationSuggestions: translationSuggestions(localized)
    };
  }

  function assertPositiveInt(value, field) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1) throw httpError(422, 'validation_error', `${field} must be a positive integer.`);
    return number;
  }

  function assertMoneyAmount(value, field, { allowZero = false } = {}) {
    const number = Number(value);
    if (!Number.isFinite(number) || (allowZero ? number < 0 : number <= 0)) {
      throw httpError(422, 'validation_error', `${field} must be a ${allowZero ? 'non-negative' : 'positive'} number.`);
    }
    return number;
  }

  function assertSupportedLocale(locale = 'mn') {
    if (!db.meta.supportedLocales.includes(locale)) throw httpError(422, 'unsupported_locale', 'Unsupported locale.');
    return locale;
  }

  function assertSupportedCurrency(currency = 'MNT') {
    if (!db.meta.supportedCurrencies.includes(currency)) throw httpError(422, 'unsupported_currency', 'Unsupported currency.');
    return currency;
  }

  function assertPaymentProvider(currency, provider) {
    const allowed = PAYMENT_PROVIDERS[currency] || [];
    if (!allowed.includes(provider)) {
      throw httpError(422, 'unsupported_payment_provider', `${provider} is not supported for ${currency}.`, { allowed });
    }
    return provider;
  }

  function normalizeInventory(body) {
    const inventoryType = body.inventoryType || body.inventoryMode || (body.customEnabled ? 'made_to_order' : 'limited_stock');
    if (!INVENTORY_TYPES.includes(inventoryType)) throw httpError(422, 'invalid_inventory_type', 'Invalid inventoryType.');
    const stock = Number(body.stock || 0);
    if (!Number.isInteger(stock) || stock < 0) throw httpError(422, 'invalid_stock', 'stock must be a non-negative integer.');
    if (inventoryType === 'one_of_one' && stock > 1) throw httpError(422, 'one_of_one_stock', 'one_of_one products can only have stock 0 or 1.');
    if (inventoryType === 'limited_stock' && stock < 1) throw httpError(422, 'limited_stock_required', 'limited_stock products must have stock.');
    return {
      inventoryType,
      stock: inventoryType === 'made_to_order' ? Number(body.capacity || stock || 9999) : stock,
      productionDays: Number(body.productionDays || (inventoryType === 'ready_made' ? 2 : 10))
    };
  }

  return {
    assertText,
    assertLocalized,
    translationSuggestions,
    localizedPayload,
    assertPositiveInt,
    assertMoneyAmount,
    assertSupportedLocale,
    assertSupportedCurrency,
    assertPaymentProvider,
    normalizeInventory
  };
}

module.exports = { createValidators };
