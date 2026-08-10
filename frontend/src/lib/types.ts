export type Locale = "mn" | "en";
export type Currency = "MNT" | "USD";

export type Money = { amount: number; currency: Currency };
export type Localized = { mn?: string; en?: string };

export type Role = "admin" | "seller" | "buyer";

export type User = {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  role?: Role;
  phone?: string | null;
  country?: string;
  locale?: Locale;
  disabled?: boolean;
  emailVerified?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
};

export type ShippingOption = { code: string; label: string; customsNote?: string };

export type ArtisanProfile = {
  makerName?: string;
  portraitUrl?: string | null;
  process?: Localized;
  processText?: string;
  yearsOfExperience?: number;
  socials?: Record<string, string>;
};

export type ShopStats = {
  ratingAverage?: number;
  ratingCount?: number;
  salesCount?: number;
  responseTimeHours?: number | null;
};

export type Shop = {
  id: string;
  sellerId: string;
  slug: string;
  status: "pending_verification" | "verified" | "rejected";
  displayName: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  story?: Localized;
  storyText?: string;
  city?: string;
  province?: string;
  district?: string | null;
  contact?: { phone?: string | null; email?: string | null; facebook?: string | null; instagram?: string | null };
  stats?: ShopStats;
  materials?: string[];
  artisanProfile?: ArtisanProfile | null;
  processMedia?: { type: "image" | "video"; url: string; captionText?: string }[];
  verified?: boolean;
  verifiedBadge?: string | null;
  verifiedAt?: string | null;
  productCount?: number;
  categoryNames?: string[];
  productSamples?: Product[];
  products?: Product[];
  seo?: { title?: string; description?: string };
  seller?: User;
  verificationNote?: string;
  payout?: any;
  createdAt?: string;
};

export type InventoryType = "ready_made" | "limited_stock" | "one_of_one" | "made_to_order";

export type Product = {
  id: string;
  sellerId: string;
  shopId: string;
  status: "active" | "sold" | "hidden";
  categoryId: string;
  title: Localized;
  description: Localized;
  story?: Localized;
  titleText: string;
  descriptionText: string;
  storyText?: string;
  techniqueText?: string;
  materials: string[];
  techniques?: string[];
  styles?: string[];
  images: string[];
  processMedia?: { type: "image" | "video"; url: string }[];
  price: Money;
  internationalPrice?: Money | null;
  stock: number;
  inventoryType: InventoryType;
  productionDays?: number;
  weightGram?: number;
  size?: string | Record<string, number> | null;
  dimensionsCm?: string | Record<string, number> | null;
  shipsInternationally?: boolean;
  touristGift?: boolean;
  touristGiftLabel?: string | null;
  shippingInfo?: ShippingOption[];
  customEnabled?: boolean;
  customOptions?: string[];
  shop?: Partial<Shop> | null;
  category?: { id: string; slug: string; name: string } | null;
  /** Хөнгөн хураангуй. Сэтгэгдлийн бичвэрийг `/products/:id/reviews`-аас авна. */
  reviewSummary?: { count: number; average: number };
  relatedProducts?: Product[];
  createdAt?: string;
  updatedAt?: string;
};

export type ProductReview = {
  id: string;
  rating: number;
  comment: string;
  images: string[];
  /** Зөвхөн эхний нэр — нийтэд бүтэн нэр харуулахгүй. */
  reviewerName: string;
  createdAt: string;
};

export type Category = { id: string; slug: string; name: Localized; nameText?: string };

export type CartItem = {
  id: string;
  productId: string;
  quantity: number;
  orderType: "ready_made" | "made_to_order" | "custom";
  shippingOption?: string | null;
  customRequestId?: string | null;
  customization?: any;
  product: Product;
  availableShippingOptions: ShippingOption[];
  unitPrice: Money;
  lineTotal: Money;
  unavailable?: boolean;
};

export type CartSellerGroup = {
  sellerId: string;
  shopId: string;
  shop?: Partial<Shop> | null;
  items: CartItem[];
  subtotal: Money;
};

export type Cart = {
  id: string;
  buyerId: string;
  items: CartItem[];
  sellerGroups: CartSellerGroup[];
  totals: { subtotal: Money };
};

export type OrderItemStatus =
  | "paid"
  | "accepted"
  | "making"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled"
  | "disputed";

export type OrderItem = {
  id: string;
  orderId: string;
  sellerId: string;
  shopId: string;
  productId: string;
  customRequestId?: string | null;
  quantity: number;
  orderType: string;
  productionDays?: number;
  shippingOption: ShippingOption;
  unitPrice: Money;
  /** Купоноор энэ мөрд ногдсон хөнгөлөлт. `lineTotal` нь аль хэдийн хасагдсан. */
  discount?: Money | null;
  lineTotal: Money;
  commission: Money;
  sellerReceivable: Money;
  escrowStatus: "held" | "released" | "refunded" | "disputed";
  status: OrderItemStatus;
  progressUpdates?: { id: string; status: string; note: string; media: any[]; createdAt: string }[];
  tracking?: { carrier?: string | null; trackingCode?: string | null } | null;
  deliveredAt?: string | null;
  payoutId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Order = {
  id: string;
  buyerId: string;
  status: string;
  currency: Currency;
  payment: { method: string; status: string; providerRef: string; capturedAt: string };
  escrowStatus: string;
  lifecycle: string[];
  shippingAddress: Record<string, any>;
  destinationCountry: string;
  sellerGroups: any[];
  subtotal: Money;
  commissionTotal: Money;
  sellerTotal: Money;
  createdAt: string;
  items?: OrderItem[];
  buyer?: User;
  /** Купон хэрэглэсэн бол — `subtotal` нь хөнгөлөлт хассан дүн. */
  coupon?: { id: string; code: string; sellerId: string; discount: Money } | null;
};

export type CustomRequestMessage = {
  id: string;
  senderId: string;
  senderRole: Role;
  message: string;
  attachments?: { type: string; url: string; name?: string | null }[];
  createdAt: string;
};

export type CustomRequest = {
  id: string;
  buyerId: string;
  sellerId: string;
  productId: string;
  status: "requested" | "quoted" | "accepted" | "rejected" | "expired";
  message: string;
  messages: CustomRequestMessage[];
  referenceImages?: string[];
  options?: Record<string, any>;
  quote?: { price: Money; productionDays: number; note?: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type Conversation = {
  id: string;
  buyerId: string;
  sellerId: string;
  orderItemId?: string | null;
  messages: CustomRequestMessage[];
  buyer?: User;
  seller?: User;
  createdAt: string;
  updatedAt: string;
};

export type Dispute = {
  id: string;
  orderId: string;
  orderItemId: string;
  openedBy: string;
  sellerId: string;
  buyerId: string;
  reason: string;
  status: string;
  evidence: any[];
  resolution?: any;
  order?: Order;
  orderItem?: OrderItem;
  createdAt: string;
};

export type Report = {
  id: string;
  reporterId: string;
  entityType: string;
  entityId: string;
  reason: string;
  details?: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  moderationNote?: string | null;
  reporter?: User;
  product?: Product | null;
  shop?: Shop | null;
  createdAt: string;
};

export type PayoutRequest = {
  id: string;
  sellerId: string;
  status: string;
  amount: Money;
  method: string;
  bankAccount?: any;
  payoutId?: string | null;
  receipt?: any;
  note?: string;
  adminNote?: string;
  approvedAt?: string;
  rejectedAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type Balances = {
  escrowHeld: Record<string, number>;
  sellerReleased: Record<string, number>;
  sellerPayouts: Record<string, number>;
  sellerBalance: Record<string, number>;
  platformCommission: Record<string, number>;
  refunds: Record<string, number>;
};

export type AdminOverview = {
  users: number;
  sellers: number;
  verifiedShops: number;
  products: number;
  orders: number;
  customRequests: number;
  grossByCurrency: Record<string, number>;
  commissionByCurrency: Record<string, number>;
  balances: Balances;
  funnel: { viewed: number; cart: number; paid: number; completed: number };
  segmentBreakdown: { domesticOrders: number; internationalOrders: number };
  activeDisputes: number;
  openReports: number;
  escrowHeld: number;
  escrowReleased: number;
  pendingPayoutItems: number;
};

export type HomePayload = {
  locale: Locale;
  currency: Currency;
  touristMode: boolean;
  featuredProducts: Product[];
  newArtisans: Shop[];
  categories: Category[];
  traditionSections: { id: string; titleText: string; descriptionText: string }[];
};

export type AuditLog = {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: any;
  createdAt: string;
};

export type Coupon = {
  id: string;
  sellerId: string;
  code: string;
  type: "percent" | "amount";
  value: number;
  currency: Currency;
  minSubtotal?: Money | null;
  startsAt: string;
  expiresAt?: string | null;
  usageLimit: number;
  usedCount: number;
  status: string;
  createdAt: string;
};

export type ContractMilestone = {
  id: string;
  label: string;
  due: string;
  percent: number;
  status: "pending" | "paid" | string;
  paidAt?: string | null;
};

export type Contract = {
  id: string;
  customRequestId: string;
  sellerId: string;
  buyerId: string;
  status: "draft" | "sent" | "accepted" | "in_progress" | "completed" | "cancelled";
  scope: string;
  total: Money;
  leadDays: number;
  depositSchedule: ContractMilestone[];
  acceptedAt?: string | null;
  /** Төлбөр хийгдсэний дараа холбогдоно. */
  orderId?: string | null;
  orderItemId?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};
