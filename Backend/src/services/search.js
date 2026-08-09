'use strict';

function normalize(value) {
  return String(value || '').toLowerCase().normalize('NFKD');
}

function createSearchService({ db, localize }) {
  async function searchProducts({ q, locale, currency, filters, productResponse }) {
    const provider = String(process.env.EXPOCRAFT_SEARCH_PROVIDER || 'local').toLowerCase();
    if (provider !== 'local' && process.env.EXPOCRAFT_SEARCH_URL) {
      const response = await fetch(`${process.env.EXPOCRAFT_SEARCH_URL.replace(/\/$/, '')}/indexes/products/search`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.EXPOCRAFT_SEARCH_KEY ? { authorization: `Bearer ${process.env.EXPOCRAFT_SEARCH_KEY}` } : {})
        },
        body: JSON.stringify({ q, filter: filters })
      });
      if (response.ok) {
        const data = await response.json();
        const ids = new Set((data.hits || []).map((item) => item.id));
        return db.products.filter((product) => ids.has(product.id)).map((product) => productResponse(product, locale, currency));
      }
    }

    const query = normalize(q);
    const scored = db.products.map((product) => {
      const shop = db.shops.find((item) => item.id === product.shopId);
      const haystack = normalize([
        localize(product.title, 'mn'),
        localize(product.title, 'en'),
        localize(product.description, 'mn'),
        localize(product.description, 'en'),
        product.materials?.join(' '),
        product.techniques?.join(' '),
        shop?.displayName,
        shop?.city
      ].join(' '));
      const score = query ? query.split(/\s+/).filter(Boolean).reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0) : 1;
      return { product, score };
    }).filter((item) => item.score > 0);
    scored.sort((a, b) => b.score - a.score || new Date(b.product.updatedAt || b.product.createdAt).getTime() - new Date(a.product.updatedAt || a.product.createdAt).getTime());
    return scored.map((item) => productResponse(item.product, locale, currency));
  }

  return { searchProducts };
}

module.exports = { createSearchService };
