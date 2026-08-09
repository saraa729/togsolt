'use strict';

const fs = require('fs');
const {
  DATA_DIR,
  DEFAULT_COMMISSION_BPS,
  ROLES,
  PRODUCT_STATUS,
  PAYMENT_PROVIDERS
} = require('../config/constants');
const { now, id, money, localize } = require('../utils/core');
const { hashPassword } = require('../auth/security');
const { createStateAdapter } = require('./adapters');

function translationSuggestions(localized = {}) {
  const suggestions = {};
  if (localized.mn && !localized.en) suggestions.en = `[Needs English translation] ${localized.mn}`;
  if (localized.en && !localized.mn) suggestions.mn = `[Монгол орчуулгын санал хэрэгтэй] ${localized.en}`;
  return suggestions;
}

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const adapter = createStateAdapter({ ensureDir });

function initialState() {
  return {
    meta: {
      name: 'ExpoCraft',
      defaultCommissionBps: DEFAULT_COMMISSION_BPS,
      supportedLocales: ['mn', 'en'],
      supportedCurrencies: ['MNT', 'USD'],
      escrowAutoReleaseDays: 7,
      paymentProviders: PAYMENT_PROVIDERS,
      payoutMethods: ['domestic_bank'],
      shippingSettings: {
        domesticCityFee: money(6000, 'MNT'),
        domesticCountrysideFee: money(10000, 'MNT'),
        pickupFee: money(0, 'MNT'),
        internationalBaseFee: money(25, 'USD')
      },
      createdAt: now()
    },
    users: [],
    shops: [],
    categories: [
      { id: 'cat_textile', name: { mn: 'Нэхмэл эдлэл', en: 'Textiles' }, slug: 'textiles' },
      { id: 'cat_leather', name: { mn: 'Арьсан урлал', en: 'Leather craft' }, slug: 'leather-craft' },
      { id: 'cat_jewelry', name: { mn: 'Гоёл чимэглэл', en: 'Jewelry' }, slug: 'jewelry' },
      { id: 'cat_wood', name: { mn: 'Модон урлал', en: 'Wood craft' }, slug: 'wood-craft' },
      { id: 'cat_felt', name: { mn: 'Эсгий урлал', en: 'Felt craft' }, slug: 'felt-craft' }
    ],
    products: [],
    favorites: [],
    follows: [],
    carts: [],
    orders: [],
    orderItems: [],
    customRequests: [],
    conversations: [],
    reviews: [],
    reports: [],
    disputes: [],
    coupons: [],
    contracts: [],
    shipments: [],
    paymentCallbacks: [],
    payoutRequests: [],
    uploads: [],
    fxRates: [
      { pair: 'USD_MNT', rate: 3450, source: 'manual_seed', asOf: now() }
    ],
    learningResources: [],
    refreshTokens: [],
    emailVerificationTokens: [],
    passwordResetTokens: [],
    escrowLedger: [],
    payouts: [],
    reconciliationSnapshots: [],
    auditLogs: []
  };
}

function loadState() {
  ensureDir();
  if (!adapter.exists()) {
    const state = initialState();
    if (process.env.EXPOCRAFT_SEED === 'true') seed(state);
    migrateState(state);
    if (process.env.EXPOCRAFT_SEED === 'true') ensureDemoMarketplace(state);
    saveState(state);
    return state;
  }
  const state = adapter.read();
  if (process.env.EXPOCRAFT_SEED === 'true' && state.users.length === 0) {
    seed(state);
  }
  migrateState(state);
  if (process.env.EXPOCRAFT_SEED === 'true') ensureDemoMarketplace(state);
  saveState(state);
  return state;
}

function saveState(state) {
  adapter.write(state);
}

function seed(state) {
  const admin = createUserRecord('admin@expocraft.mn', 'admin12345', ROLES.ADMIN, 'ExpoCraft Admin');
  const seller = createUserRecord('seller@expocraft.mn', 'seller12345', ROLES.SELLER, 'Nomad Felt Studio');
  const buyer = createUserRecord('buyer@expocraft.mn', 'buyer12345', ROLES.BUYER, 'Demo Buyer');
  state.users.push(admin, seller, buyer);
  ensureDemoMarketplace(state);
}

function ensureDemoMarketplace(state) {
  const portraitUrls = [
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=85',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=900&q=85'
  ];

  const artisans = [
    ['seller@expocraft.mn', 'seller12345', 'Nomad Felt Studio', 'nomad-felt-studio', 'Оюунаа', 'Уламжлалт эсгий урлалыг орчин үеийн хэрэглээнд нийцүүлэн хийдэг гэр бүлийн урлан.', 'A family studio making traditional Mongolian felt craft for modern homes.', ['felt', 'wool'], 'Ulaanbaatar', 'Sukhbaatar', 4.9, 124, 6],
    ['wood@expocraft.mn', 'seller12345', 'Steppe Woodcraft', 'steppe-woodcraft', 'Бат-Эрдэнэ', 'Монгол хээ угалзыг модон эдлэл дээр гараар сийлдэг урлан.', 'A wood studio hand-carving Mongolian patterns into everyday objects.', ['wood'], 'Ulaanbaatar', 'Bayangol', 4.8, 87, 8],
    ['silver@expocraft.mn', 'seller12345', 'Altan Silver Line', 'altan-silver-line', 'Алтантуяа', 'Мөнгөн гоёл, жижиг эдлэлийг уламжлалт дархны аргаар хийдэг.', 'A silversmith studio making jewelry with traditional techniques.', ['silver', 'stone'], 'Darkhan', 'Darkhan', 4.9, 96, 5],
    ['leather@expocraft.mn', 'seller12345', 'Khuree Leather House', 'khuree-leather-house', 'Мөнхбат', 'Арьсан цүнх, түрийвч, бүсийг гараар эсгэж оёдог жижиг урлан.', 'A small leather house cutting and stitching bags, wallets, and belts by hand.', ['leather'], 'Ulaanbaatar', 'Khan-Uul', 4.7, 68, 10],
    ['deel@expocraft.mn', 'seller12345', 'Deel Atelier', 'deel-atelier', 'Сувд', 'Дээл, хантааз, торгон эдлэлийг захиалгаар урладаг ателье.', 'A made-to-order atelier for deels, vests, and silk pieces.', ['silk', 'textile'], 'Ulaanbaatar', 'Chingeltei', 4.8, 73, 12],
    ['textile@expocraft.mn', 'seller12345', 'Gobi Textile Studio', 'gobi-textile-studio', 'Наран', 'Ноос, даавуун гэр ахуйн эдлэлийг зөөлөн өнгө, уламжлалт хээгээр хийдэг.', 'A textile studio using wool, fabric, soft colors, and heritage patterns.', ['wool', 'textile'], 'Umnugovi', 'Dalanzadgad', 4.6, 54, 9],
    ['paint@expocraft.mn', 'seller12345', 'Khangai Brush', 'khangai-brush', 'Энхжин', 'Монгол байгаль, нүүдлийн ахуйг жижиг уран зурагт буулгадаг.', 'A painting studio capturing Mongolian nature and nomadic life.', ['canvas', 'paint'], 'Arkhangai', 'Tsetserleg', 4.7, 41, 14],
    ['bone@expocraft.mn', 'seller12345', 'Tsagaan Bone Craft', 'tsagaan-bone-craft', 'Даваажав', 'Ясан болон эвэр эдлэлийг уламжлалт хэлбэрээр сийлдэг.', 'A bone and horn craft studio carving traditional forms.', ['bone', 'horn'], 'Khuvsgul', 'Murun', 4.8, 38, 11],
    ['ceramic@expocraft.mn', 'seller12345', 'Blue Flame Ceramics', 'blue-flame-ceramics', 'Гэрэл', 'Гараар хэвлэж шатаасан аяга, ваар, гоёлын жижиг эдлэл хийдэг.', 'A ceramic studio shaping and firing cups, vases, and decor by hand.', ['ceramic'], 'Ulaanbaatar', 'Bayanzurkh', 4.6, 44, 7],
    ['felttoy@expocraft.mn', 'seller12345', 'Little Nomad Toys', 'little-nomad-toys', 'Хулан', 'Хүүхдэд зориулсан эсгий тоглоом, амьтан, өлгөөтэй чимэглэл хийдэг.', 'A felt toy studio creating child-friendly toys and hanging ornaments.', ['felt', 'wool'], 'Ulaanbaatar', 'Songinokhairkhan', 4.9, 59, 6]
  ];

  const shopBySlug = new Map((state.shops || []).map((shop) => [shop.slug, shop]));
  const usersByEmail = new Map((state.users || []).map((user) => [user.email, user]));
  const shops = artisans.map(([email, password, displayName, slug, makerName, storyMn, storyEn, materials, city, district, ratingAverage, salesCount, responseTimeHours], index) => {
    let user = usersByEmail.get(email);
    if (!user) {
      user = createUserRecord(email, password, ROLES.SELLER, displayName);
      state.users.push(user);
      usersByEmail.set(email, user);
    }
    if (!user.roles.includes(ROLES.SELLER)) user.roles.push(ROLES.SELLER);

    let shop = shopBySlug.get(slug);
    if (!shop) {
      shop = {
        id: id('shop'),
        sellerId: user.id,
        status: 'verified',
        slug,
        displayName,
        logoUrl: null,
        bannerUrl: null,
        story: { mn: storyMn, en: storyEn },
        city,
        province: city,
        district,
        contact: { phone: `+97699${String(index + 11).padStart(2, '0')}2233`, email },
        seo: { title: `${displayName} | ExpoCraft`, description: storyEn },
        stats: { ratingAverage, ratingCount: 12 + index * 3, salesCount, responseTimeHours },
        materials,
        artisanProfile: {
          makerName,
          portraitUrl: portraitUrls[index % portraitUrls.length],
          process: {
            mn: 'Материалаа сонгож, гараар боловсруулж, уламжлалт хээ болон өөрийн гарын мэдрэмжээр дуусгадаг.',
            en: 'The maker selects materials, works by hand, and finishes each piece with heritage patterns and personal touch.'
          },
          yearsOfExperience: 5 + index,
          socials: { instagram: `@${slug.replace(/-/g, '')}` }
        },
        processMedia: [],
        payout: { method: 'bank', accountName: displayName, accountLast4: String(2026 + index).slice(-4) },
        createdAt: now(),
        verifiedAt: now()
      };
      state.shops.push(shop);
      shopBySlug.set(slug, shop);
    } else {
      shop.status = 'verified';
      shop.sellerId = user.id;
      shop.stats = shop.stats || { ratingAverage, ratingCount: 12, salesCount, responseTimeHours };
      if (!shop.artisanProfile) shop.artisanProfile = { makerName, portraitUrl: null, process: {}, yearsOfExperience: 5 + index, socials: {} };
      if (!shop.artisanProfile.portraitUrl) shop.artisanProfile.portraitUrl = portraitUrls[index % portraitUrls.length];
    }
    return shop;
  });

  const demoProducts = [
    [0, 'cat_felt', 'Эсгий гэрийн чимэглэл', 'Felt ger ornament', 'Гараар эсгийрүүлсэн, уламжлалт хээтэй жижиг гэрийн чимэглэл.', ['wool', 'felt'], ['hand_felting'], 45000, 18, 12, 'ready_made', 2, true],
    [0, 'cat_felt', 'Эсгий ханын өлгүүр', 'Felt wall hanging', 'Ноосон эсгийгээр хийсэн гэрийн дулаан уур амьсгалтай ханын чимэг.', ['wool', 'felt'], ['hand_felting'], 78000, 28, 8, 'limited_stock', 3, true],
    [0, 'cat_felt', 'Нэр хатгамалтай түлхүүрийн оосор', 'Personalized felt keychain', 'Нэр эсвэл богино үг хатгамалж болох жижиг бэлэг.', ['felt', 'thread'], ['embroidery'], 22000, 9, 20, 'made_to_order', 5, true],
    [1, 'cat_wood', 'Модон сийлбэртэй хайрцаг', 'Carved wooden box', 'Монгол хээтэй, гараар сийлсэн дурсгалын хайрцаг.', ['wood'], ['wood_carving'], 145000, 48, 5, 'limited_stock', 4, true],
    [1, 'cat_wood', 'Шатарны гар хийцийн хөлөг', 'Handmade chess board', 'Модон хөлөг, уламжлалт хэлбэртэй жижиг дүрсүүдтэй.', ['wood'], ['wood_carving'], 320000, 105, 3, 'limited_stock', 7, true],
    [1, 'cat_wood', 'Морин хуурын мини тавиур', 'Mini morin khuur stand', 'Морин хуурын хэлбэртэй ширээний жижиг чимэглэл.', ['wood'], ['hand_polishing'], 68000, 24, 10, 'ready_made', 2, true],
    [2, 'cat_jewelry', 'Мөнгөн бөгж оюу чулуутай', 'Silver ring with turquoise', 'Оюу чулуу шигтгэсэн уламжлалт хийцтэй мөнгөн бөгж.', ['silver', 'turquoise'], ['silversmithing'], 185000, 62, 4, 'limited_stock', 5, true],
    [2, 'cat_jewelry', 'Мөнгөн бугуйвч', 'Silver bracelet', 'Гараар дарж хийсэн хээтэй мөнгөн бугуйвч.', ['silver'], ['silversmithing'], 260000, 82, 3, 'limited_stock', 6, true],
    [2, 'cat_jewelry', 'Шүрэн ээмэг', 'Coral earrings', 'Мөнгөн суурьтай, шүрэн шигтгээтэй жижиг ээмэг.', ['silver', 'coral'], ['stone_setting'], 98000, 35, 7, 'ready_made', 3, true],
    [3, 'cat_leather', 'Арьсан гар цүнх', 'Leather handbag', 'Гараар оёсон, өдөр тутам хэрэглэх арьсан цүнх.', ['leather'], ['hand_stitching'], 285000, 90, 6, 'made_to_order', 10, true],
    [3, 'cat_leather', 'Монгол хээтэй түрийвч', 'Patterned wallet', 'Дардастай хээтэй, жижиг арьсан түрийвч.', ['leather'], ['embossing'], 72000, 26, 12, 'ready_made', 2, true],
    [3, 'cat_leather', 'Гараар хийсэн бүс', 'Handmade belt', 'Бөх оёдолтой, сонгодог хүрэн арьсан бүс.', ['leather'], ['hand_stitching'], 89000, 30, 9, 'made_to_order', 6, true],
    [4, 'cat_textile', 'Торгон дээл', 'Silk deel', 'Захиалгаар оёх торгон дээл, уламжлалт эсгүүртэй.', ['silk', 'textile'], ['tailoring'], 650000, 210, 2, 'made_to_order', 14, true],
    [4, 'cat_textile', 'Хантааз', 'Traditional vest', 'Дээл дээр давхарлах, хээтэй даавуун хантааз.', ['textile'], ['tailoring'], 240000, 80, 4, 'made_to_order', 9, true],
    [4, 'cat_textile', 'Торгон алчуур', 'Silk scarf', 'Монгол хээтэй зөөлөн торгон алчуур.', ['silk'], ['sewing'], 58000, 21, 15, 'ready_made', 2, true],
    [5, 'cat_textile', 'Ноосон ширээний бүтээлэг', 'Wool table runner', 'Гэрийн ширээнд тохирох уламжлалт хээтэй ноосон бүтээлэг.', ['wool', 'textile'], ['weaving'], 120000, 42, 8, 'limited_stock', 4, true],
    [5, 'cat_textile', 'Даавуун дэрний уут', 'Patterned cushion cover', 'Гараар оёсон хээтэй дэрний уут.', ['textile'], ['sewing'], 46000, 17, 18, 'ready_made', 2, true],
    [6, 'cat_textile', 'Хангайн жижиг зураг', 'Khangai miniature painting', 'Монгол байгалийг жижиг хэмжээтэй зурагт буулгасан бүтээл.', ['canvas', 'paint'], ['painting'], 135000, 45, 4, 'one_of_one', 3, true],
    [6, 'cat_textile', 'Нүүдэлчин айлын зураг', 'Nomadic family painting', 'Нүүдлийн ахуйг дулаан өнгөөр зурсан ганц хувь бүтээл.', ['canvas', 'paint'], ['painting'], 220000, 72, 1, 'one_of_one', 5, true],
    [7, 'cat_wood', 'Ясан хөөрөгний халбага', 'Bone snuff bottle spoon', 'Ясаар нарийн сийлсэн жижиг эдлэл.', ['bone'], ['bone_carving'], 52000, 18, 8, 'limited_stock', 4, true],
    [7, 'cat_wood', 'Эвэр сийлбэртэй сам', 'Horn carved comb', 'Эвэр материалаар хийсэн гар сийлбэртэй сам.', ['horn'], ['carving'], 64000, 22, 7, 'ready_made', 3, true],
    [8, 'cat_textile', 'Гар хийцийн аяга', 'Handmade ceramic cup', 'Гараар хэвлэж шатаасан өдөр тутмын аяга.', ['ceramic'], ['ceramics'], 38000, 14, 16, 'ready_made', 2, true],
    [8, 'cat_textile', 'Цэнхэр паалантай ваар', 'Blue glazed vase', 'Цэнхэр паалантай, ширээний жижиг ваар.', ['ceramic'], ['glazing'], 92000, 32, 6, 'limited_stock', 5, true],
    [9, 'cat_felt', 'Эсгий тэмээ тоглоом', 'Felt camel toy', 'Хүүхдэд зориулсан зөөлөн эсгий тэмээ.', ['felt', 'wool'], ['hand_felting'], 39000, 15, 14, 'ready_made', 3, true],
    [9, 'cat_felt', 'Өлгөөтэй эсгий од', 'Hanging felt star', 'Хүүхдийн өрөө болон баярын чимэглэлд тохирох эсгий од.', ['felt'], ['hand_felting'], 18000, 7, 25, 'ready_made', 2, true]
  ];

  const productTitles = new Set((state.products || []).map((product) => localize(product.title, 'mn')));
  for (const [shopIndex, categoryId, titleMn, titleEn, descriptionMn, materials, techniques, priceMnt, priceUsd, stock, inventoryType, productionDays, touristGift] of demoProducts) {
    if (productTitles.has(titleMn)) continue;
    const shop = shops[shopIndex];
    state.products.push({
      id: id('prd'),
      sellerId: shop.sellerId,
      shopId: shop.id,
      status: 'active',
      categoryId,
      title: { mn: titleMn, en: titleEn },
      description: { mn: descriptionMn, en: titleEn },
      story: {
        mn: `${shop.displayName} урлангийн ${materials.join(', ')} материалаар хийсэн гар урлалын бүтээл.`,
        en: `A handmade piece from ${shop.displayName} using ${materials.join(', ')}.`
      },
      materials,
      techniques,
      styles: ['traditional', 'souvenir'],
      images: [],
      price: money(priceMnt, 'MNT'),
      internationalPrice: money(priceUsd, 'USD'),
      stock,
      inventoryType,
      productionDays,
      weightGram: 120 + shopIndex * 35,
      dimensionsCm: { width: 10 + shopIndex, height: 8 + shopIndex, depth: 5 },
      shipsInternationally: true,
      touristGift,
      shippingProfile: {
        domestic: { city: true, countryside: true, pickup: true },
        international: { postal: true, customsNote: { mn: 'Гар урлалын жижиг илгээмж.', en: 'Small handmade craft parcel.' } }
      },
      customEnabled: inventoryType === 'made_to_order',
      customOptions: inventoryType === 'made_to_order' ? ['color', 'size', 'name'] : [],
      createdAt: now(),
      updatedAt: now()
    });
    productTitles.add(titleMn);
  }
}

function migrateState(state) {
  if (!state.refreshTokens) state.refreshTokens = [];
  if (!state.emailVerificationTokens) state.emailVerificationTokens = [];
  if (!state.passwordResetTokens) state.passwordResetTokens = [];
  if (!state.escrowLedger) state.escrowLedger = [];
  if (!state.favorites) state.favorites = [];
  if (!state.follows) state.follows = [];
  if (!state.conversations) state.conversations = [];
  if (!state.reviews) state.reviews = [];
  if (!state.reports) state.reports = [];
  if (!state.disputes) state.disputes = [];
  if (!state.coupons) state.coupons = [];
  if (!state.contracts) state.contracts = [];
  if (!state.shipments) state.shipments = [];
  if (!state.paymentCallbacks) state.paymentCallbacks = [];
  if (!state.payoutRequests) state.payoutRequests = [];
  if (!state.uploads) state.uploads = [];
  if (!state.reconciliationSnapshots) state.reconciliationSnapshots = [];
  if (!state.fxRates) state.fxRates = [{ pair: 'USD_MNT', rate: 3450, source: 'manual_migration', asOf: now() }];
  if (!state.learningResources) state.learningResources = [];
  if (!state.meta.escrowAutoReleaseDays) state.meta.escrowAutoReleaseDays = 7;
  if (!state.meta.paymentProviders) state.meta.paymentProviders = PAYMENT_PROVIDERS;
  if (!state.meta.payoutMethods) state.meta.payoutMethods = ['domestic_bank'];
  if (!state.meta.shippingSettings) {
    state.meta.shippingSettings = {
      domesticCityFee: money(6000, 'MNT'),
      domesticCountrysideFee: money(10000, 'MNT'),
      pickupFee: money(0, 'MNT'),
      internationalBaseFee: money(25, 'USD')
    };
  }
  for (const user of state.users || []) {
    if (!user.roles) user.roles = [user.role || ROLES.BUYER];
    if (!user.role) user.role = user.roles[0];
    if (!user.authProviders) user.authProviders = ['email'];
    if (!Object.prototype.hasOwnProperty.call(user, 'phone')) user.phone = null;
    if (!user.country) user.country = 'MN';
    if (!Object.prototype.hasOwnProperty.call(user, 'emailVerified')) user.emailVerified = user.authProviders?.includes('google') || false;
  }
  for (const shop of state.shops || []) {
    if (!Object.prototype.hasOwnProperty.call(shop, 'logoUrl')) shop.logoUrl = null;
    if (!Object.prototype.hasOwnProperty.call(shop, 'bannerUrl')) shop.bannerUrl = null;
    if (!shop.province) shop.province = shop.city || 'Ulaanbaatar';
    if (!Object.prototype.hasOwnProperty.call(shop, 'district')) shop.district = null;
    if (!shop.contact) shop.contact = { phone: null, email: null };
    if (!shop.seo) shop.seo = { title: `${shop.displayName} | ExpoCraft`, description: localize(shop.story, 'mn') || localize(shop.story, 'en') };
    if (!shop.stats) shop.stats = { ratingAverage: 0, ratingCount: 0, salesCount: 0, responseTimeHours: null };
    if (!shop.artisanProfile) {
      shop.artisanProfile = {
        makerName: shop.displayName,
        portraitUrl: null,
        process: {},
        yearsOfExperience: 0,
        socials: {}
      };
    }
    if (!shop.processMedia) shop.processMedia = [];
  }
  for (const product of state.products || []) {
    if (!product.inventoryType) product.inventoryType = product.customEnabled ? 'made_to_order' : 'limited_stock';
    if (!Object.prototype.hasOwnProperty.call(product, 'productionDays')) product.productionDays = product.inventoryType === 'made_to_order' ? 10 : 2;
    if (!product.techniques) product.techniques = [];
    if (product.techniques.length === 0 && (product.materials || []).includes('felt')) product.techniques = ['hand_felting'];
    if (!product.techniqueDescription) product.techniqueDescription = {};
    if (!product.processMedia) product.processMedia = [];
    if (!product.size) product.size = product.dimensionsCm || null;
    if (!Object.prototype.hasOwnProperty.call(product, 'touristGift') || (product.shipsInternationally && product.internationalPrice && product.touristGift === false)) {
      product.touristGift = Boolean(product.shipsInternationally && product.internationalPrice);
    }
    if (!product.shippingProfile) {
      product.shippingProfile = {
        domestic: { city: true, countryside: true, pickup: true },
        international: { postal: Boolean(product.shipsInternationally), customsNote: {} }
      };
    }
    if (!product.translationSuggestions) {
      product.translationSuggestions = {
        title: translationSuggestions(product.title),
        description: translationSuggestions(product.description),
        story: translationSuggestions(product.story),
        techniqueDescription: translationSuggestions(product.techniqueDescription)
      };
    }
    if (!PRODUCT_STATUS.includes(product.status)) product.status = product.stock === 0 ? 'sold' : 'active';
  }
  for (const item of state.orderItems || []) {
    if (!item.progressUpdates) item.progressUpdates = [];
    if (!item.reviewIds) item.reviewIds = [];
  }
}

function createUserRecord(email, password, role, name) {
  const roles = Array.isArray(role) ? role : [role];
  return {
    id: id('usr'),
    email: String(email).toLowerCase(),
    passwordHash: hashPassword(password),
    roles,
    role: roles[0],
    name,
    authProviders: ['email'],
    phone: null,
    country: 'MN',
    locale: 'mn',
    emailVerified: false,
    createdAt: now(),
    lastLoginAt: null
  };
}

module.exports = {
  initialState,
  loadState,
  saveState,
  createUserRecord
};
