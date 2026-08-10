'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DATA_FILE = path.join(ROOT, 'data', 'expo-store.json');
const SOURCE_DIR = path.join(ROOT, '..', 'buteeluud');
const UPLOAD_DIR = path.join(ROOT, 'data', 'uploads');

const PRODUCT_IMAGE_FILES: Record<string, string[]> = {
  'Felt ger ornament': ['product_felt_ger_ornament.jpeg'],
  'Felt wall hanging': ['product_felt_wall_hanging.avif'],
  'Personalized felt keychain': ['product_personalized_felt_keychain.jpeg'],
  'Carved wooden box': ['product_carved_wooden_box.avif'],
  'Handmade chess board': ['product_handmade_chess_board.avif'],
  'Mini morin khuur stand': ['product_mini_morin_khuur_stand.webp'],
  'Silver ring with turquoise': ['product_silver_ring.webp'],
  'Silver bracelet': ['product_silver_bracelet.webp'],
  'Coral earrings': ['product_coral_earrings.jpeg'],
  'Leather handbag': ['product_leather_handbag.webp'],
  'Patterned wallet': ['product_patterned_wallet.jpg'],
  'Handmade belt': ['product_handmade_belt.webp'],
  'Silk deel': ['product_silk_deel.jpg'],
  'Traditional vest': ['product_traditional_vest.jpg'],
  'Silk scarf': ['product_silk_scarf.avif'],
  'Wool table runner': ['product_wool_table_runner.avif'],
  'Patterned cushion cover': ['product_patterned_cushion_cover.webp'],
  'Khangai miniature painting': ['product_khangai_miniature_painting.jpg'],
  'Nomadic family painting': ['product_nomadic_family_painting.jpeg'],
  'Bone snuff bottle spoon': ['product_bone_snuff_bottle_spoon.jpg'],
  'Horn carved comb': ['product_horn_carved_comb.jpeg'],
  'Handmade ceramic cup': ['product_handmade_ceramic_cup.jpg'],
  'Blue glazed vase': ['product_blue_glazed_vase.jpg'],
  'Felt camel toy': ['product_felt_camel_toy.jpeg'],
  'Hanging felt star': ['product_hanging_felt_star.jpeg']
};

const SOURCE_BY_TARGET: Record<string, string> = {
  'product_felt_ger_ornament.jpeg': 'OIP.o4fsVQkv_2-BNBc9GFqC3wHaHa.jpeg',
  'product_felt_wall_hanging.avif': 'il_1588xN.7664643174_af2t.jpg.avif',
  'product_personalized_felt_keychain.jpeg': 'OIP.o4fsVQkv_2-BNBc9GFqC3wHaHa.jpeg',
  'product_carved_wooden_box.avif': 'il_fullxfull.5198433449_imyu.jpg.avif',
  'product_handmade_chess_board.avif': 'il_fullxfull.6963128889_mkm9.jpg.avif',
  'product_mini_morin_khuur_stand.webp': 'f4268ff9-c6e2-492e-9add-1c2d3f350d90.ddced8d25d09b22fbace2a2720ff5ac8.jpeg.webp',
  'product_silver_ring.webp': 'R2314-C75-A_1737501124522.jpg.webp',
  'product_silver_bracelet.webp': 'Women-925-Sterling-Silver-Charm-Bracelet-Jewelry_6a953c84-75c5-45b4-94d2-f3c1bfdf2006.e73a8db51e83d88f39d8403e5f66c8cb.jpeg.webp',
  'product_coral_earrings.jpeg': 'OIP.HAmhf8vp6Qvm5-duuLB4ewHaHz.jpeg',
  'product_leather_handbag.webp': 'New-Arrival-Women-Genuine-Leather-Embossed-Tote-Handbag-Casual-Travel-Messenger-Shoulder-Bag-Large-Capacity-Crossbody.jpg.webp',
  'product_patterned_wallet.jpg': 'f_30129792_1661411405140_bg_processed.jpg',
  'product_handmade_belt.webp': 'il_fullxfull.6088643256_fxxm.jpg.webp',
  'product_silk_deel.jpg': '2bd550d46e5a9d42f8822135770a61d9.jpg',
  'product_traditional_vest.jpg': '476159870_1166932974783105_3705463902193970861_n.jpg',
  'product_silk_scarf.avif': 'il_1080xN.6469909251_nea5.jpg.avif',
  'product_wool_table_runner.avif': 'il_1588xN.7664643174_af2t.jpg.avif',
  'product_patterned_cushion_cover.webp': 'ali-linen-pink-patterned-cushion-cover-sc1017-45b.webp',
  'product_khangai_miniature_painting.jpg': '1653825275_bfc4f342e8941cf80430.jpg',
  'product_nomadic_family_painting.jpeg': 'OIP.4EuMZzaies-qeRZInQoBjgHaEg.jpeg',
  'product_bone_snuff_bottle_spoon.jpg': '136313.jpg',
  'product_horn_carved_comb.jpeg': 'OIP.FS-t-qPMllt2zM98Q37AqQHaHa.jpeg',
  'product_handmade_ceramic_cup.jpg': '9647ddd2f2fca3f24b189aadfc90a304.jpg',
  'product_blue_glazed_vase.jpg': 'f_30129792_1661411405140_bg_processed.jpg',
  'product_felt_camel_toy.jpeg': 'OIP.V2JPXr8oLZYpK1lYB9dgtgHaHa.jpeg',
  'product_hanging_felt_star.jpeg': 'OIP.o4fsVQkv_2-BNBc9GFqC3wHaHa.jpeg'
};

function main() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  for (const [target, source] of Object.entries(SOURCE_BY_TARGET)) {
    const sourcePath = path.join(SOURCE_DIR, source);
    if (!fs.existsSync(sourcePath)) throw new Error(`Missing source image: ${sourcePath}`);
    fs.copyFileSync(sourcePath, path.join(UPLOAD_DIR, target));
  }

  const state = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  for (const product of state.products || []) {
    const title = product.title?.en;
    const files = PRODUCT_IMAGE_FILES[title];
    if (!files) continue;
    product.images = files.map((file) => `/uploads/${file}`);
    product.updatedAt = new Date().toISOString();
  }
  fs.writeFileSync(DATA_FILE, `${JSON.stringify(state, null, 2)}\n`);

  const count = Object.keys(PRODUCT_IMAGE_FILES).length;
  console.log(`Assigned product images for ${count} products.`);
}

main();
