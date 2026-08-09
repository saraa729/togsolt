'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { request: appRequest } = require('./helpers');

process.env.EXPOCRAFT_DATA_DIR = path.join(os.tmpdir(), `expocraft-test-${Date.now()}`);
process.env.EXPOCRAFT_SEED = 'true';

const { handle } = require('../app');

function startServer() {
  return Promise.resolve({
    address: () => ({ port: 0 }),
    close: (callback) => {
      if (typeof callback === 'function') callback();
      return Promise.resolve();
    }
  });
}

async function request(_baseUrl, method, pathName, body, token, headers = {}) {
  return appRequest(handle, { method, pathName, body, token, headers });
}

test('auth aliases return 200 for login and register routes', async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const loginInfo = await request(baseUrl, 'GET', '/login');
    assert.equal(loginInfo.status, 200);
    assert.equal(loginInfo.body.endpoint, '/login');

    const registerInfo = await request(baseUrl, 'GET', '/register');
    assert.equal(registerInfo.status, 200);
    assert.equal(registerInfo.body.endpoint, '/register');

    const apiLoginInfo = await request(baseUrl, 'GET', '/api/auth/login');
    assert.equal(apiLoginInfo.status, 200);
    assert.equal(apiLoginInfo.body.endpoint, '/api/auth/login');

    const apiRegisterInfo = await request(baseUrl, 'GET', '/api/auth/register');
    assert.equal(apiRegisterInfo.status, 200);
    assert.equal(apiRegisterInfo.body.endpoint, '/api/auth/register');

    const login = await request(baseUrl, 'POST', '/login', { email: 'buyer@expocraft.mn', password: 'buyer12345' });
    assert.equal(login.status, 200);
    assert.ok(login.body.token);

    const register = await request(baseUrl, 'POST', '/api/auth/register', {
      email: 'alias-buyer@expocraft.mn',
      password: 'buyer12345',
      name: 'Alias Buyer',
      phone: '+97699000001'
    });
    assert.equal(register.status, 200);
    assert.equal(register.body.user.email, 'alias-buyer@expocraft.mn');
  } finally {
    server.close();
  }
});

test('buyer payment is held in escrow, released after delivery, then paid out', async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await request(baseUrl, 'POST', '/auth/login', { email: 'buyer@expocraft.mn', password: 'buyer12345' });
    assert.equal(login.status, 200);
    const sellerLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'seller@expocraft.mn', password: 'seller12345' });
    assert.equal(sellerLogin.status, 200);
    const adminLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'admin@expocraft.mn', password: 'admin12345' });
    assert.equal(adminLogin.status, 200);

    const products = await request(baseUrl, 'GET', '/products?currency=MNT');
    assert.equal(products.status, 200);
    assert.ok(products.body.products.length >= 20);

    const productId = products.body.products[0].id;
    const cart = await request(baseUrl, 'POST', '/cart/items', { productId, quantity: 2 }, login.body.token);
    assert.equal(cart.status, 200);
    assert.equal(cart.body.cart.items[0].quantity, 2);

    const checkout = await request(baseUrl, 'POST', '/checkout', {
      currency: 'MNT',
      shippingAddress: { country: 'MN', city: 'Ulaanbaatar', line1: 'Demo address' }
    }, login.body.token);
    assert.equal(checkout.status, 200);
    assert.equal(checkout.body.order.status, 'paid');
    assert.equal(checkout.body.order.escrowStatus, 'held');
    assert.equal(checkout.body.orderItems.length, 1);
    assert.equal(checkout.body.orderItems[0].escrowStatus, 'held');
    assert.equal(checkout.body.order.commissionTotal.amount, 10800);

    const itemId = checkout.body.orderItems[0].id;
    const delivered = await request(baseUrl, 'PATCH', `/seller/order-items/${itemId}/status`, { status: 'delivered' }, sellerLogin.body.token);
    assert.equal(delivered.status, 200);
    assert.equal(delivered.body.orderItem.escrowStatus, 'held');

    const confirm = await request(baseUrl, 'POST', `/orders/${checkout.body.order.id}/confirm-received`, {}, login.body.token);
    assert.equal(confirm.status, 200);
    assert.equal(confirm.body.released[0].type, 'release_to_seller_balance');

    const payout = await request(baseUrl, 'POST', '/admin/payouts/run', { currency: 'MNT' }, adminLogin.body.token);
    assert.equal(payout.status, 200);
    assert.equal(payout.body.payouts.length, 1);
    assert.equal(payout.body.payouts[0].amount.amount, 79200);

    const ledger = await request(baseUrl, 'GET', `/admin/escrow-ledger?orderId=${checkout.body.order.id}`, null, adminLogin.body.token);
    assert.equal(ledger.status, 200);
    assert.equal(ledger.body.entries.length, 5);

    const balances = await request(baseUrl, 'GET', '/admin/balances', null, adminLogin.body.token);
    assert.equal(balances.status, 200);
    assert.equal(balances.body.balances.sellerBalance.MNT, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('disputes freeze escrow and admin can refund with ledger reconciliation', async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const buyerLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'buyer@expocraft.mn', password: 'buyer12345' });
    const sellerLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'seller@expocraft.mn', password: 'seller12345' });
    const adminLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'admin@expocraft.mn', password: 'admin12345' });
    const products = await request(baseUrl, 'GET', '/products?currency=MNT');
    const productId = products.body.products[0].id;

    await request(baseUrl, 'POST', '/cart/items', { productId, quantity: 1 }, buyerLogin.body.token);
    const checkout = await request(baseUrl, 'POST', '/checkout', {
      currency: 'MNT',
      shippingAddress: { country: 'MN', city: 'Ulaanbaatar', line1: 'Demo address' }
    }, buyerLogin.body.token);
    const itemId = checkout.body.orderItems[0].id;
    await request(baseUrl, 'PATCH', `/seller/order-items/${itemId}/status`, { status: 'delivered' }, sellerLogin.body.token);

    const dispute = await request(baseUrl, 'POST', '/disputes', {
      orderItemId: itemId,
      reason: 'Item did not match the photos',
      evidence: [{ type: 'image', url: 'https://example.com/evidence.jpg' }]
    }, buyerLogin.body.token);
    assert.equal(dispute.status, 200);
    assert.equal(dispute.body.dispute.status, 'frozen');
    assert.equal(dispute.body.escrowEntry.type, 'freeze_escrow_dispute');

    const resolved = await request(baseUrl, 'POST', `/admin/disputes/${dispute.body.dispute.id}/resolve`, {
      decision: 'refund_buyer',
      note: 'Refund approved'
    }, adminLogin.body.token);
    assert.equal(resolved.status, 200);
    assert.equal(resolved.body.dispute.status, 'resolved_refund');
    assert.equal(resolved.body.escrowEntry.type, 'refund_to_buyer');

    const reconciliation = await request(baseUrl, 'GET', `/admin/reconciliation/daily?date=${new Date().toISOString().slice(0, 10)}`, null, adminLogin.body.token);
    assert.equal(reconciliation.status, 200);
    assert.ok(reconciliation.body.reconciliation.entryCount >= 5);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('chat reviews reports moderation and admin dashboard are available', async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const buyerLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'buyer@expocraft.mn', password: 'buyer12345' });
    const sellerLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'seller@expocraft.mn', password: 'seller12345' });
    const adminLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'admin@expocraft.mn', password: 'admin12345' });
    const products = await request(baseUrl, 'GET', '/products?currency=MNT');
    const product = products.body.products[0];

    await request(baseUrl, 'POST', '/cart/items', { productId: product.id, quantity: 1 }, buyerLogin.body.token);
    const checkout = await request(baseUrl, 'POST', '/checkout', {
      currency: 'MNT',
      shippingAddress: { country: 'MN', city: 'Ulaanbaatar', line1: 'Demo address' }
    }, buyerLogin.body.token);
    const itemId = checkout.body.orderItems[0].id;

    const conversation = await request(baseUrl, 'POST', '/conversations', {
      sellerId: product.sellerId,
      orderItemId: itemId
    }, buyerLogin.body.token);
    assert.equal(conversation.status, 200);
    const message = await request(baseUrl, 'POST', `/conversations/${conversation.body.conversation.id}/messages`, {
      message: 'Can you send a process photo?',
      attachments: [{ type: 'image', url: 'https://example.com/question.jpg' }]
    }, buyerLogin.body.token);
    assert.equal(message.status, 200);
    assert.equal(message.body.message.attachments.length, 1);

    await request(baseUrl, 'PATCH', `/seller/order-items/${itemId}/status`, { status: 'delivered' }, sellerLogin.body.token);
    await request(baseUrl, 'POST', `/orders/${checkout.body.order.id}/confirm-received`, {}, buyerLogin.body.token);
    const review = await request(baseUrl, 'POST', '/reviews', {
      orderItemId: itemId,
      rating: 5,
      comment: 'Beautiful handmade work',
      images: ['https://example.com/review.jpg']
    }, buyerLogin.body.token);
    assert.equal(review.status, 200);
    assert.equal(review.body.review.rating, 5);

    const report = await request(baseUrl, 'POST', '/reports', {
      entityType: 'product',
      entityId: product.id,
      reason: 'Looks mass-produced',
      details: 'Please verify handmade authenticity'
    }, buyerLogin.body.token);
    assert.equal(report.status, 200);

    const moderated = await request(baseUrl, 'PATCH', `/admin/reports/${report.body.report.id}`, {
      status: 'resolved',
      note: 'Hidden pending review'
    }, adminLogin.body.token);
    assert.equal(moderated.status, 200);
    assert.equal(moderated.body.report.status, 'resolved');

    const queues = await request(baseUrl, 'GET', '/admin/queues', null, adminLogin.body.token);
    assert.equal(queues.status, 200);
    assert.ok(Array.isArray(queues.body.disputes));

    const settings = await request(baseUrl, 'PATCH', '/admin/settings', { defaultCommissionBps: 1000, escrowAutoReleaseDays: 5 }, adminLogin.body.token);
    assert.equal(settings.status, 200);
    assert.equal(settings.body.settings.defaultCommissionBps, 1000);

    const overview = await request(baseUrl, 'GET', '/admin/reports/overview', null, adminLogin.body.token);
    assert.equal(overview.status, 200);
    assert.ok(overview.body.funnel.paid >= 1);

    const audit = await request(baseUrl, 'GET', '/admin/audit-logs', null, adminLogin.body.token);
    assert.equal(audit.status, 200);
    assert.ok(audit.body.auditLogs.length >= 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('discovery supports search filters, tourist mode, favorites, and follows', async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const buyerLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'buyer@expocraft.mn', password: 'buyer12345' });
    assert.equal(buyerLogin.status, 200);

    const home = await request(baseUrl, 'GET', '/home?locale=en&currency=USD&tourist=true');
    assert.equal(home.status, 200);
    assert.equal(home.body.touristMode, true);
    assert.ok(home.body.featuredProducts.length >= 1);
    assert.equal(home.body.featuredProducts[0].touristGiftLabel, 'Unique gift from Mongolia');

    const search = await request(baseUrl, 'GET', '/products?locale=en&currency=USD&q=felt&material=wool&technique=hand_felting&location=Ulaanbaatar&tourist=true&minPrice=1&maxPrice=100');
    assert.equal(search.status, 200);
    assert.ok(search.body.products.length >= 1);

    const product = search.body.products[0];
    const favorite = await request(baseUrl, 'POST', `/favorites/products/${product.id}`, {}, buyerLogin.body.token);
    assert.equal(favorite.status, 200);

    const favorites = await request(baseUrl, 'GET', '/favorites/products?locale=en&currency=USD', null, buyerLogin.body.token);
    assert.equal(favorites.status, 200);
    assert.ok(favorites.body.products.some((item) => item.id === product.id));

    const follow = await request(baseUrl, 'POST', `/follows/shops/${product.shopId}`, {}, buyerLogin.body.token);
    assert.equal(follow.status, 200);

    const tourist = await request(baseUrl, 'GET', '/tourist/home');
    assert.equal(tourist.status, 200);
    assert.equal(tourist.body.locale, 'en');
    assert.ok(tourist.body.shippingGuide.internationalPost);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('cart groups multiple sellers and seller can add made-to-order progress media', async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const adminLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'admin@expocraft.mn', password: 'admin12345' });
    const buyerLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'buyer@expocraft.mn', password: 'buyer12345' });
    const firstSeller = await request(baseUrl, 'POST', '/auth/login', { email: 'seller@expocraft.mn', password: 'seller12345' });
    assert.equal(adminLogin.status, 200);
    assert.equal(buyerLogin.status, 200);
    assert.equal(firstSeller.status, 200);

    const sellerRegister = await request(baseUrl, 'POST', '/auth/register', {
      role: 'seller',
      email: 'second-seller@example.com',
      password: 'sellerpass123',
      name: 'Second Seller',
      phone: '+97699002233'
    });
    assert.equal(sellerRegister.status, 200);

    const shop = await request(baseUrl, 'POST', '/seller/shop', {
      displayName: 'Leather Road',
      story: { mn: 'Арьсан урлалын урлан', en: 'Leather craft studio' },
      city: 'Ulaanbaatar',
      artisanProfile: { process: { en: 'Hand cutting and stitching leather.' } }
    }, sellerRegister.body.token);
    assert.equal(shop.status, 200);

    const verify = await request(baseUrl, 'POST', `/admin/sellers/${sellerRegister.body.user.id}/verify`, {}, adminLogin.body.token);
    assert.equal(verify.status, 200);

    const secondProduct = await request(baseUrl, 'POST', '/products', {
      categoryId: 'cat_leather',
      title: { en: 'Made-to-order leather bookmark' },
      description: { en: 'Personalized leather bookmark.' },
      materials: ['leather'],
      techniques: ['hand_stitching'],
      price: { amount: 25000, currency: 'MNT' },
      stock: 0,
      inventoryType: 'made_to_order',
      productionDays: 14
    }, sellerRegister.body.token);
    assert.equal(secondProduct.status, 200);

    const products = await request(baseUrl, 'GET', '/products?currency=MNT');
    const seeded = products.body.products.find((product) => product.shop.slug === 'nomad-felt-studio');
    assert.ok(seeded);

    const firstCart = await request(baseUrl, 'POST', '/cart/items', {
      productId: seeded.id,
      quantity: 1,
      shippingOption: 'domestic_city'
    }, buyerLogin.body.token);
    assert.equal(firstCart.status, 200);

    const secondCart = await request(baseUrl, 'POST', '/cart/items', {
      productId: secondProduct.body.product.id,
      quantity: 1,
      shippingOption: 'pickup'
    }, buyerLogin.body.token);
    assert.equal(secondCart.status, 200);
    assert.equal(secondCart.body.cart.sellerGroups.length, 2);

    const checkout = await request(baseUrl, 'POST', '/checkout', {
      currency: 'MNT',
      shippingAddress: { country: 'MN', city: 'Ulaanbaatar', line1: 'Demo address' }
    }, buyerLogin.body.token);
    assert.equal(checkout.status, 200);
    assert.equal(checkout.body.orderItems.length, 2);
    assert.ok(checkout.body.orderItems.some((item) => item.orderType === 'made_to_order' && item.productionDays === 14));

    const madeToOrderItem = checkout.body.orderItems.find((item) => item.sellerId === sellerRegister.body.user.id);
    const progress = await request(baseUrl, 'POST', `/seller/order-items/${madeToOrderItem.id}/progress`, {
      note: 'Cutting started',
      media: [{ type: 'image', url: 'https://example.com/progress.jpg', caption: { en: 'Leather cut by hand' } }]
    }, sellerRegister.body.token);
    assert.equal(progress.status, 200);
    assert.equal(progress.body.orderItem.progressUpdates.length, 1);

    const accepted = await request(baseUrl, 'PATCH', `/seller/order-items/${madeToOrderItem.id}/status`, { status: 'accepted' }, sellerRegister.body.token);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.orderItem.status, 'accepted');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('seller verification gates product publishing', async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const register = await request(baseUrl, 'POST', '/auth/register', {
      role: 'seller',
      email: 'new-seller@example.com',
      password: 'sellerpass123',
      name: 'New Seller',
      phone: '+97699001122'
    });
    assert.equal(register.status, 200);

    const shop = await request(baseUrl, 'POST', '/seller/shop', {
      displayName: 'New Workshop',
      story: { mn: 'Шинэ урлан', en: 'New workshop' },
      city: 'Ulaanbaatar'
    }, register.body.token);
    assert.equal(shop.status, 200);

    const product = await request(baseUrl, 'POST', '/products', {
      categoryId: 'cat_wood',
      title: { mn: 'Модон аяга', en: 'Wooden cup' },
      description: { mn: 'Гараар хийсэн', en: 'Handmade' },
      price: { amount: 30000, currency: 'MNT' },
      stock: 3,
      inventoryType: 'ready_made'
    }, register.body.token);
    assert.equal(product.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('auth supports refresh rotation and multi-role seller onboarding', async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const register = await request(baseUrl, 'POST', '/auth/register', {
      roles: ['buyer'],
      email: 'buyer-seller@example.com',
      password: 'buyerpass123',
      name: 'Buyer Seller',
      phone: '+97688112233'
    });
    assert.equal(register.status, 200);
    assert.ok(register.body.accessToken);
    assert.ok(register.body.refreshToken);
    assert.deepEqual(register.body.user.roles, ['buyer']);

    const sellerRole = await request(baseUrl, 'POST', '/me/roles/seller', {}, register.body.accessToken);
    assert.equal(sellerRole.status, 200);
    assert.ok(sellerRole.body.user.roles.includes('seller'));

    const rotated = await request(baseUrl, 'POST', '/auth/refresh', { refreshToken: register.body.refreshToken });
    assert.equal(rotated.status, 200);
    assert.notEqual(rotated.body.refreshToken, register.body.refreshToken);

    const reused = await request(baseUrl, 'POST', '/auth/refresh', { refreshToken: register.body.refreshToken });
    assert.equal(reused.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('FR-1 registration, RBAC, JWT, Google, and locale rules are enforced', async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const missingDomesticPhone = await request(baseUrl, 'POST', '/auth/register', {
      email: 'missing-phone@example.com',
      password: 'buyer12345',
      name: 'Missing Phone',
      country: 'MN'
    });
    assert.equal(missingDomesticPhone.status, 422);
    assert.equal(missingDomesticPhone.body.error.code, 'phone_required');

    const overseasBuyer = await request(baseUrl, 'POST', '/auth/register', {
      email: 'overseas-buyer@example.com',
      password: 'buyer12345',
      name: 'Overseas Buyer',
      country: 'US',
      locale: 'en'
    });
    assert.equal(overseasBuyer.status, 200);
    assert.deepEqual(overseasBuyer.body.user.roles, ['buyer']);
    assert.equal(overseasBuyer.body.user.locale, 'en');
    assert.equal(overseasBuyer.body.user.phone, null);

    const invalidRole = await request(baseUrl, 'POST', '/auth/register', {
      email: 'bad-role@example.com',
      password: 'buyer12345',
      name: 'Bad Role',
      phone: '+97699001122',
      role: 'admin'
    });
    assert.equal(invalidRole.status, 422);
    assert.equal(invalidRole.body.error.code, 'invalid_role');

    /*
     * Google нэвтрэлт нь Google-ийн гарын үсэгтэй ID токен шаарддаг. Хүсэлтийн
     * биед бичсэн и-мэйлд итгэдэггүй болсныг баталгаажуулна — өмнө нь тэгдэг
     * байсан нь дурын и-мэйлээр нэвтрэх боломж олгож байсан.
     */
    const googleWithoutCredential = await request(baseUrl, 'POST', '/auth/google', {
      email: 'google-spoof@example.com',
      name: 'Spoofed',
      country: 'JP'
    });
    assert.equal(googleWithoutCredential.status, 422);
    assert.equal(googleWithoutCredential.body.error.code, 'validation_error');

    const googleForgedCredential = await request(baseUrl, 'POST', '/auth/google', {
      credential: 'not-a-real-google-id-token'
    });
    // GOOGLE_CLIENT_ID тохируулаагүй бол 503, тохируулсан бол Google татгалзаж 401.
    assert.ok([401, 503].includes(googleForgedCredential.status));

    // Баталгаагүй Google хүсэлт хэрэглэгч үүсгэсэн бол тэр и-мэйлээр нэвтрэх
    // оролдлого "credentials" алдаа өгөх ёстой — акаунт огт үүсээгүй байна.
    const spoofLogin = await request(baseUrl, 'POST', '/auth/login', {
      email: 'google-spoof@example.com',
      password: 'buyer12345'
    });
    assert.equal(spoofLogin.status, 401);

    // Дотоодын худалдан авагчид утас заавал шаардах дүрэм хэвээрээ.
    const domesticNoPhone = await request(baseUrl, 'POST', '/auth/register', {
      email: 'domestic-no-phone@example.com',
      password: 'buyer12345',
      name: 'Domestic No Phone',
      country: 'MN'
    });
    assert.equal(domesticNoPhone.status, 422);
    assert.equal(domesticNoPhone.body.error.code, 'phone_required');

    const sellerRole = await request(baseUrl, 'POST', '/me/roles/seller', {}, overseasBuyer.body.accessToken);
    assert.equal(sellerRole.status, 200);
    assert.deepEqual(sellerRole.body.user.roles, ['buyer', 'seller']);

    const tokenPayload = JSON.parse(Buffer.from(overseasBuyer.body.accessToken.split('.')[1], 'base64url').toString('utf8'));
    assert.deepEqual(tokenPayload.roles, ['buyer']);
    assert.ok(tokenPayload.exp > Math.floor(Date.now() / 1000));

    const product = await request(baseUrl, 'POST', '/products', {
      title: { mn: 'Орчуулга шалгах бүтээл' },
      description: { en: 'English-only description' },
      categoryId: 'cat_felt',
      materials: ['felt'],
      techniques: ['hand_felting'],
      price: { amount: 10000, currency: 'MNT' },
      stock: 1,
      inventoryType: 'one_of_one'
    }, overseasBuyer.body.accessToken);
    assert.equal(product.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('public shop page exposes SEO, artisan profile, products, and translation suggestions', async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const sellerLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'seller@expocraft.mn', password: 'seller12345' });
    assert.equal(sellerLogin.status, 200);

    const created = await request(baseUrl, 'POST', '/products', {
      categoryId: 'cat_wood',
      title: { mn: 'Ганц хувь модон аяга' },
      description: { mn: 'Хус модоор гараар зорсон аяга.' },
      techniqueDescription: { mn: 'Гараар зорж, тосон өнгөлгөө хийсэн.' },
      materials: ['wood'],
      techniques: ['hand_carving'],
      images: ['https://example.com/cup.jpg'],
      price: { amount: 65000, currency: 'MNT' },
      stock: 1,
      inventoryType: 'one_of_one',
      productionDays: 1
    }, sellerLogin.body.token);
    assert.equal(created.status, 200);
    assert.equal(created.body.product.translationSuggestions.title.en, '[Needs English translation] Ганц хувь модон аяга');

    const shop = await request(baseUrl, 'GET', '/shop/nomad-felt-studio?locale=mn&currency=MNT');
    assert.equal(shop.status, 200);
    assert.equal(shop.body.shop.seo.title, 'Nomad Felt Studio | ExpoCraft');
    assert.equal(shop.body.shop.artisanProfile.makerName, 'Оюунаа');
    assert.ok(shop.body.shop.products.some((product) => product.id === created.body.product.id));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('FR-2 through FR-8 MVP acceptance flow is covered end to end', async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const stamp = Date.now();
    const adminLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'admin@expocraft.mn', password: 'admin12345' });
    const buyerLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'buyer@expocraft.mn', password: 'buyer12345' });
    const sellerRegister = await request(baseUrl, 'POST', '/auth/register', {
      role: 'seller',
      email: `fr-seller-${stamp}@example.com`,
      password: 'sellerpass123',
      name: 'FR Artisan',
      phone: '+97699110022'
    });
    assert.equal(adminLogin.status, 200);
    assert.equal(buyerLogin.status, 200);
    assert.equal(sellerRegister.status, 200);

    const pendingShop = await request(baseUrl, 'POST', '/seller/shop', {
      displayName: `FR Felt Studio ${stamp}`,
      story: { mn: 'Эсгий урлалын түүхтэй урлан.', en: 'A felt studio with a craft story.' },
      city: 'Ulaanbaatar',
      province: 'Ulaanbaatar',
      district: 'Sukhbaatar',
      logoUrl: 'https://example.com/logo.png',
      bannerUrl: 'https://example.com/banner.png',
      materials: ['felt', 'wool'],
      responseTimeHours: 6,
      artisanProfile: {
        makerName: 'FR Maker',
        process: { mn: 'Ноосоо гараар боловсруулна.', en: 'The wool is prepared by hand.' },
        yearsOfExperience: 9
      },
      processMedia: [{ type: 'video', url: 'https://example.com/process.mp4', caption: { mn: 'Ажлын явц', en: 'Process' } }]
    }, sellerRegister.body.token);
    assert.equal(pendingShop.status, 200);
    assert.equal(pendingShop.body.shop.status, 'pending_verification');
    assert.equal(pendingShop.body.shop.stats.responseTimeHours, 6);

    const queuesBefore = await request(baseUrl, 'GET', '/admin/queues', null, adminLogin.body.token);
    assert.ok(queuesBefore.body.sellerVerification.some((shop) => shop.id === pendingShop.body.shop.id));

    const verified = await request(baseUrl, 'PATCH', `/admin/shops/${pendingShop.body.shop.id}/verification`, {
      status: 'verified',
      note: 'Handmade process verified'
    }, adminLogin.body.token);
    assert.equal(verified.status, 200);
    assert.equal(verified.body.shop.status, 'verified');

    const limitedProduct = await request(baseUrl, 'POST', '/products', {
      categoryId: 'cat_felt',
      title: { mn: 'FR эсгий өлгүүр', en: 'FR felt wall hanging' },
      description: { mn: 'Гараар эсгийрүүлсэн.', en: 'Hand felted.' },
      story: { mn: 'Урлаачийн түүхтэй.', en: 'Made with an artisan story.' },
      techniqueDescription: { mn: 'Нойтон эсгийрүүлэлт.', en: 'Wet felting.' },
      materials: ['felt', 'wool'],
      techniques: ['hand_felting'],
      images: ['https://example.com/fr-limited.jpg'],
      processMedia: [{ type: 'image', url: 'https://example.com/fr-process.jpg', caption: { mn: 'Ноос', en: 'Wool' } }],
      price: { amount: 100000, currency: 'MNT' },
      internationalPrice: { amount: 35, currency: 'USD' },
      stock: 2,
      inventoryType: 'limited_stock',
      weightGram: 500,
      size: { width: 20, height: 30, unit: 'cm' },
      shipsInternationally: true,
      touristGift: true
    }, sellerRegister.body.token);
    assert.equal(limitedProduct.status, 200);

    const madeToOrder = await request(baseUrl, 'POST', '/products', {
      categoryId: 'cat_felt',
      title: { mn: 'FR нэртэй түлхүүрийн оосор', en: 'FR personalized keychain' },
      description: { mn: 'Нэр хатгамалтай.', en: 'Personalized embroidery.' },
      materials: ['felt'],
      techniques: ['embroidery'],
      images: ['https://example.com/fr-custom.jpg'],
      price: { amount: 40000, currency: 'MNT' },
      internationalPrice: { amount: 15, currency: 'USD' },
      stock: 0,
      capacity: 20,
      inventoryType: 'made_to_order',
      productionDays: 10,
      shipsInternationally: true,
      touristGift: true,
      customEnabled: true
    }, sellerRegister.body.token);
    assert.equal(madeToOrder.status, 200);
    assert.equal(madeToOrder.body.product.inventoryType, 'made_to_order');

    const uniqueProduct = await request(baseUrl, 'POST', '/products', {
      categoryId: 'cat_wood',
      title: { mn: 'FR ганц модон аяга', en: 'FR one-of-one wooden cup' },
      description: { mn: 'Ганц хувь.', en: 'One of one.' },
      materials: ['wood'],
      techniques: ['wood_carving'],
      images: ['https://example.com/fr-unique.jpg'],
      price: { amount: 70000, currency: 'MNT' },
      stock: 1,
      inventoryType: 'one_of_one'
    }, sellerRegister.body.token);
    assert.equal(uniqueProduct.status, 200);

    const shopPage = await request(baseUrl, 'GET', `/shop/${pendingShop.body.shop.slug}?locale=en&currency=USD`);
    assert.equal(shopPage.status, 200);
    assert.equal(shopPage.body.shop.verified, true);
    assert.equal(shopPage.body.shop.verifiedBadge, 'Verified artisan');
    assert.equal(shopPage.body.shop.artisanProfile.processText, 'The wool is prepared by hand.');
    assert.equal(shopPage.body.shop.processMedia[0].captionText, 'Process');

    const search = await request(baseUrl, 'GET', `/products?locale=en&currency=USD&q=felt&material=felt&technique=hand_felting&shopId=${pendingShop.body.shop.id}&location=Ulaanbaatar&tourist=true&international=true&minPrice=1&maxPrice=100`);
    assert.equal(search.status, 200);
    assert.ok(search.body.products.some((product) => product.id === limitedProduct.body.product.id));
    assert.equal(search.body.products.find((product) => product.id === limitedProduct.body.product.id).touristGiftLabel, 'Unique gift from Mongolia');

    const favorite = await request(baseUrl, 'POST', `/favorites/products/${limitedProduct.body.product.id}`, {}, buyerLogin.body.token);
    const follow = await request(baseUrl, 'POST', `/follows/shops/${pendingShop.body.shop.id}`, {}, buyerLogin.body.token);
    assert.equal(favorite.status, 200);
    assert.equal(follow.status, 200);
    const unfavorite = await request(baseUrl, 'DELETE', `/favorites/products/${limitedProduct.body.product.id}`, null, buyerLogin.body.token);
    const unfollow = await request(baseUrl, 'DELETE', `/follows/shops/${pendingShop.body.shop.id}`, null, buyerLogin.body.token);
    assert.equal(unfavorite.status, 200);
    assert.equal(unfollow.status, 200);

    const customRequest = await request(baseUrl, 'POST', '/custom-requests', {
      productId: madeToOrder.body.product.id,
      message: 'Can you embroider my name?',
      referenceImages: ['https://example.com/ref.jpg'],
      attachments: [{ type: 'image', url: 'https://example.com/chat.jpg', name: 'chat.jpg' }]
    }, buyerLogin.body.token);
    assert.equal(customRequest.status, 200);
    assert.equal(customRequest.body.customRequest.referenceImages.length, 1);
    assert.equal(customRequest.body.customRequest.messages[0].attachments.length, 1);

    const quote = await request(baseUrl, 'PATCH', `/seller/custom-requests/${customRequest.body.customRequest.id}`, {
      status: 'quoted',
      message: 'Yes, I can make it.',
      attachments: [{ type: 'image', url: 'https://example.com/quote.jpg' }],
      quote: { price: { amount: 18, currency: 'USD' }, productionDays: 12 }
    }, sellerRegister.body.token);
    assert.equal(quote.status, 200);
    const acceptQuote = await request(baseUrl, 'POST', `/custom-requests/${customRequest.body.customRequest.id}/accept-quote`, {}, buyerLogin.body.token);
    assert.equal(acceptQuote.status, 200);

    await request(baseUrl, 'POST', '/cart/items', {
      productId: limitedProduct.body.product.id,
      quantity: 1,
      shippingOption: 'international_post',
      destinationCountry: 'US',
      locale: 'en',
      currency: 'USD'
    }, buyerLogin.body.token);
    const customCart = await request(baseUrl, 'POST', `/cart/custom-requests/${customRequest.body.customRequest.id}`, {
      shippingOption: 'international_post',
      destinationCountry: 'US',
      locale: 'en'
    }, buyerLogin.body.token);
    assert.equal(customCart.status, 200);
    assert.equal(customCart.body.cart.sellerGroups.length >= 1, true);

    const checkout = await request(baseUrl, 'POST', '/checkout', {
      currency: 'USD',
      paymentMethod: 'stripe',
      shippingAddress: { country: 'US', city: 'Seattle', line1: 'Demo international address' }
    }, buyerLogin.body.token);
    assert.equal(checkout.status, 200);
    assert.equal(checkout.body.order.payment.method, 'stripe');
    assert.equal(checkout.body.order.escrowStatus, 'held');
    assert.equal(checkout.body.order.sellerGroups.length, 1);
    assert.ok(checkout.body.orderItems.some((item) => item.orderType === 'custom' && item.productionDays === 12));

    const uniqueCart = await request(baseUrl, 'POST', '/cart/items', {
      productId: uniqueProduct.body.product.id,
      quantity: 1,
      locale: 'mn',
      currency: 'MNT'
    }, buyerLogin.body.token);
    assert.equal(uniqueCart.status, 200);
    const uniqueCheckout = await request(baseUrl, 'POST', '/checkout', {
      currency: 'MNT',
      paymentMethod: 'qpay',
      shippingAddress: { country: 'MN', city: 'Ulaanbaatar', line1: 'Demo address' }
    }, buyerLogin.body.token);
    assert.equal(uniqueCheckout.status, 200);
    const soldUnique = await request(baseUrl, 'GET', `/admin/products?status=sold`, null, adminLogin.body.token);
    assert.ok(soldUnique.body.products.some((product) => product.id === uniqueProduct.body.product.id));

    const orderItem = checkout.body.orderItems.find((item) => item.orderType === 'custom');
    const progress = await request(baseUrl, 'POST', `/seller/order-items/${orderItem.id}/progress`, {
      note: 'Embroidery started',
      media: [{ type: 'image', url: 'https://example.com/progress.jpg', caption: { en: 'Progress photo' } }]
    }, sellerRegister.body.token);
    assert.equal(progress.status, 200);
    assert.equal(progress.body.progressUpdate.media[0].caption.en, 'Progress photo');

    const delivered = await request(baseUrl, 'PATCH', `/seller/order-items/${orderItem.id}/status`, { status: 'delivered' }, sellerRegister.body.token);
    assert.equal(delivered.status, 200);
    const confirmed = await request(baseUrl, 'POST', `/orders/${checkout.body.order.id}/confirm-received`, {}, buyerLogin.body.token);
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.released[0].type, 'release_to_seller_balance');
    assert.equal(confirmed.body.order.status, 'paid');

    const review = await request(baseUrl, 'POST', '/reviews', {
      orderItemId: orderItem.id,
      rating: 5,
      comment: 'Excellent custom craft',
      images: ['https://example.com/review.jpg']
    }, buyerLogin.body.token);
    assert.equal(review.status, 200);

    const report = await request(baseUrl, 'POST', '/reports', {
      entityType: 'product',
      entityId: madeToOrder.body.product.id,
      reason: 'Please verify handmade process',
      details: 'Trust check'
    }, buyerLogin.body.token);
    assert.equal(report.status, 200);
    const moderated = await request(baseUrl, 'PATCH', `/admin/reports/${report.body.report.id}`, {
      status: 'resolved',
      action: 'hide_product',
      note: 'Moderated'
    }, adminLogin.body.token);
    assert.equal(moderated.status, 200);

    const balances = await request(baseUrl, 'GET', `/admin/balances?sellerId=${sellerRegister.body.user.id}`, null, adminLogin.body.token);
    assert.equal(balances.status, 200);
    assert.ok(balances.body.balances.sellerBalance.USD > 0);
    const reconciliation = await request(baseUrl, 'GET', `/admin/reconciliation/daily?date=${new Date().toISOString().slice(0, 10)}`, null, adminLogin.body.token);
    assert.equal(reconciliation.status, 200);
    assert.ok(reconciliation.body.reconciliation.byType.release_to_seller_balance.USD > 0);

    const overview = await request(baseUrl, 'GET', '/admin/reports/overview', null, adminLogin.body.token);
    assert.equal(overview.status, 200);
    assert.ok(overview.body.verifiedShops >= 1);
    assert.ok(overview.body.segmentBreakdown.internationalOrders >= 1);
    assert.ok(overview.body.openReports >= 0);

    const audit = await request(baseUrl, 'GET', '/admin/audit-logs', null, adminLogin.body.token);
    assert.equal(audit.status, 200);
    for (const action of ['review_seller_verification', 'create_product', 'checkout', 'release_escrow', 'create_review', 'moderate_report']) {
      assert.ok(audit.body.auditLogs.some((log) => log.action === action), `missing audit action ${action}`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('phase two APIs cover coupons contracts logistics AI and idempotent payment callbacks', async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const buyerLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'buyer@expocraft.mn', password: 'buyer12345' });
    const sellerLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'seller@expocraft.mn', password: 'seller12345' });
    assert.equal(buyerLogin.status, 200);
    assert.equal(sellerLogin.status, 200);

    const coupon = await request(baseUrl, 'POST', '/seller/coupons', { code: 'FELT10', type: 'percent', value: 10 }, sellerLogin.body.token);
    assert.equal(coupon.status, 200);
    const validate = await request(baseUrl, 'POST', '/coupons/validate', { code: 'felt10' }, buyerLogin.body.token);
    assert.equal(validate.status, 200);
    assert.equal(validate.body.discountPreview, '10%');

    const products = await request(baseUrl, 'GET', '/products?currency=MNT');
    const customProduct = products.body.products.find((product) => product.customEnabled);
    const custom = await request(baseUrl, 'POST', '/custom-requests', {
      productId: customProduct.id,
      message: 'Please make this with a red pattern'
    }, buyerLogin.body.token);
    assert.equal(custom.status, 200);
    const quote = await request(baseUrl, 'PATCH', `/seller/custom-requests/${custom.body.customRequest.id}`, {
      status: 'quoted',
      quote: { price: { amount: 90000, currency: 'MNT' }, productionDays: 12 }
    }, sellerLogin.body.token);
    assert.equal(quote.status, 200);
    const contract = await request(baseUrl, 'POST', `/seller/custom-requests/${custom.body.customRequest.id}/contract`, {
      scope: 'Red-pattern felt ornament with buyer-approved preview'
    }, sellerLogin.body.token);
    assert.equal(contract.status, 200);
    assert.equal(contract.body.contract.depositSchedule.length, 2);
    const acceptedContract = await request(baseUrl, 'POST', `/contracts/${contract.body.contract.id}/accept`, {}, buyerLogin.body.token);
    assert.equal(acceptedContract.status, 200);
    assert.equal(acceptedContract.body.contract.status, 'accepted');

    await request(baseUrl, 'POST', '/cart/items', { productId: customProduct.id, quantity: 1 }, buyerLogin.body.token);
    const checkout = await request(baseUrl, 'POST', '/checkout', {
      currency: 'MNT',
      shippingAddress: { country: 'MN', city: 'Ulaanbaatar', line1: 'Demo address' }
    }, buyerLogin.body.token);
    assert.equal(checkout.status, 200);
    const itemId = checkout.body.orderItems[0].id;

    const shipment = await request(baseUrl, 'PATCH', `/seller/order-items/${itemId}/shipment`, {
      carrier: 'Mongol Post EMS',
      trackingCode: 'EMS123',
      status: 'shipped'
    }, sellerLogin.body.token);
    assert.equal(shipment.status, 200);
    const tracking = await request(baseUrl, 'POST', '/webhooks/logistics/tracking', {
      trackingCode: 'EMS123',
      status: 'in_transit',
      location: 'Ulaanbaatar'
    });
    assert.equal(tracking.status, 200);
    assert.equal(tracking.body.shipment.status, 'in_transit');

    const ai = await request(baseUrl, 'POST', '/ai/products/suggest', {
      title: 'felt souvenir',
      mn: 'Эсгий бэлэг'
    }, sellerLogin.body.token);
    assert.equal(ai.status, 200);
    assert.equal(ai.body.suggestions.categorySlug, 'felt-craft');

    const webhookOne = await request(baseUrl, 'POST', '/webhooks/payments/qpay', {
      eventId: 'qpay_evt_1',
      orderId: checkout.body.order.id,
      amount: 45000,
      currency: 'MNT',
      status: 'paid'
    });
    const webhookTwo = await request(baseUrl, 'POST', '/webhooks/payments/qpay', {
      eventId: 'qpay_evt_1',
      orderId: checkout.body.order.id,
      amount: 45000,
      currency: 'MNT',
      status: 'paid'
    });
    assert.equal(webhookOne.status, 200);
    assert.equal(webhookOne.body.idempotent, false);
    assert.equal(webhookTwo.status, 200);
    assert.equal(webhookTwo.body.idempotent, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('seller income is isolated and payout request uses released balance', async () => {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const buyerLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'buyer@expocraft.mn', password: 'buyer12345' });
    const sellerLogin = await request(baseUrl, 'POST', '/auth/login', { email: 'seller@expocraft.mn', password: 'seller12345' });
    const otherSeller = await request(baseUrl, 'POST', '/auth/register', {
      role: 'seller',
      email: 'idor-seller@example.com',
      password: 'sellerpass123',
      name: 'Other Seller',
      phone: '+97688001122'
    });
    assert.equal(otherSeller.status, 200);

    const products = await request(baseUrl, 'GET', '/products?currency=MNT');
    const product = products.body.products[0];
    await request(baseUrl, 'POST', '/cart/items', { productId: product.id, quantity: 1 }, buyerLogin.body.token);
    const checkout = await request(baseUrl, 'POST', '/checkout', {
      currency: 'MNT',
      shippingAddress: { country: 'MN', city: 'Ulaanbaatar', line1: 'Demo address' }
    }, buyerLogin.body.token);
    const itemId = checkout.body.orderItems[0].id;

    const forbidden = await request(baseUrl, 'PATCH', `/seller/order-items/${itemId}/status`, { status: 'accepted' }, otherSeller.body.token);
    assert.equal(forbidden.status, 404);

    await request(baseUrl, 'PATCH', `/seller/order-items/${itemId}/status`, { status: 'delivered' }, sellerLogin.body.token);
    await request(baseUrl, 'POST', `/orders/${checkout.body.order.id}/confirm-received`, {}, buyerLogin.body.token);
    const payoutRequest = await request(baseUrl, 'POST', '/seller/payout-requests', { currency: 'MNT', amount: 39600 }, sellerLogin.body.token);
    assert.equal(payoutRequest.status, 200);
    assert.equal(payoutRequest.body.payoutRequest.amount.amount, 39600);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
