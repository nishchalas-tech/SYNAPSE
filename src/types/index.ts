export type UserRole = 'CUSTOMER' | 'STORE_MANAGER' | 'NETWORK_ADMIN';

export type ProductCategory = 'Laptops' | 'Monitors' | 'Keyboards' | 'Mice' | 'Headphones';

export type FulfilmentPreference = 'SAVE_MONEY' | 'GET_IT_FASTER' | 'SHOP_NEARBY';

export type OrderStatus =
  | 'CONFIRMED'
  | 'PICK_PENDING'
  | 'READY_FOR_DISPATCH'
  | 'REASSIGNED'
  | 'EXCEPTION'
  | 'COMPLETED';

export type PickTaskStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REASSIGNED' | 'EXCEPTION';

export type DemandSignalOutcome =
  | 'UNMATCHED_SEARCH'
  | 'OUT_OF_STOCK_NEARBY'
  | 'REGISTERED_INTEREST'
  | 'RESCUED_ALTERNATIVE';

export type TransferStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type FreshnessState = 'FRESH' | 'AGING' | 'STALE';

export interface AuthSession {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  assignedStoreId?: string;
  city: string;
  preferredStoreId: string;
  authMode: 'FIREBASE_GOOGLE' | 'DEMO_LOCAL';
  emailVerified: boolean;
}

export interface Store {
  id: string;
  name: string;
  locality: string;
  city: string;
  address: string;
  distanceKm: number;
  fulfilmentHours: number;
  deliveryFeeInr: number;
  isOpen: boolean;
  managerName: string;
  managerEmail: string;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: ProductCategory;
  priceInr: number;
  description: string;
  imageUrl: string;
  compatibilityGroup: string;
  compatibilityLabel: string;
  specs: ProductSpec[];
  tags: string[];
}

export interface InventoryRecord {
  id: string;
  storeId: string;
  productId: string;
  recordedQty: number;
  verifiedQty: number;
  reservedQty: number;
  sellableQty: number;
  safetyBuffer: number;
  lastVerifiedAt: string;
  lastVerifiedBy: string;
  discrepancyReason?: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  productId: string;
  storeId: string;
  quantity: number;
  fulfilmentPreference: FulfilmentPreference;
  addedAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  imageUrl: string;
  unitPriceInr: number;
  quantity: number;
}

export interface OrderTimelineEntry {
  id: string;
  status: string;
  title: string;
  description: string;
  storeName?: string;
  timestamp: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  storeId: string;
  storeName: string;
  fulfilmentPreference: FulfilmentPreference;
  fulfilmentNote: string;
  status: OrderStatus;
  subtotalInr: number;
  deliveryFeeInr: number;
  totalInr: number;
  items: OrderItem[];
  timeline: OrderTimelineEntry[];
  createdAt: string;
  updatedAt: string;
  isSeeded?: boolean;
}

export interface PickTask {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  storeId: string;
  storeName: string;
  productId: string;
  productName: string;
  quantity: number;
  status: PickTaskStatus;
  rejectionReason?: string;
  reassignedFromStoreId?: string;
  createdAt: string;
  updatedAt: string;
  isSeeded?: boolean;
}

export interface StockVerification {
  id: string;
  storeId: string;
  productId: string;
  productName: string;
  recordedQty: number;
  verifiedQty: number;
  previousSellableQty: number;
  newSellableQty: number;
  discrepancyDelta: number;
  discrepancyReason?: string;
  verifiedBy: string;
  verifiedByUid: string;
  createdAt: string;
  isSeeded?: boolean;
}

export interface DemandSignal {
  id: string;
  userId: string;
  query: string;
  inferredCategory: string;
  inferredProductId?: string;
  locality: string;
  outcome: DemandSignalOutcome;
  createdAt: string;
  isSeeded?: boolean;
}

export interface TransferRecommendation {
  id: string;
  sourceStoreId: string;
  sourceStoreName: string;
  destinationStoreId: string;
  destinationStoreName: string;
  productId: string;
  productName: string;
  recommendedQty: number;
  reason: string;
  sourceSellableQty: number;
  destinationSellableQty: number;
  demandSignalCount: number;
  status: TransferStatus;
  createdAt: string;
  updatedAt: string;
  isSeeded?: boolean;
}

export interface TransferDecision {
  id: string;
  recommendationId: string;
  sourceStoreId: string;
  sourceStoreName: string;
  destinationStoreId: string;
  destinationStoreName: string;
  productId: string;
  productName: string;
  quantity: number;
  decision: 'APPROVED' | 'REJECTED';
  notes: string;
  decidedBy: string;
  createdAt: string;
  isSeeded?: boolean;
}

export interface NetworkActivity {
  id: string;
  actorUid: string;
  actorRole: UserRole;
  actorName: string;
  eventType:
    | 'ORDER_PLACED'
    | 'INVENTORY_CHANGED'
    | 'PICK_ACCEPTED'
    | 'PICK_REJECTED'
    | 'ORDER_REASSIGNED'
    | 'FULFILMENT_EXCEPTION'
    | 'DEMAND_SIGNAL_RECORDED'
    | 'TRANSFER_APPROVED'
    | 'TRANSFER_REJECTED';
  storeId?: string;
  summary: string;
  createdAt: string;
  isSeeded?: boolean;
}

export interface NetworkState {
  stores: Store[];
  products: Product[];
  inventory: InventoryRecord[];
  cart: CartItem[];
  orders: Order[];
  pickTasks: PickTask[];
  verifications: StockVerification[];
  demandSignals: DemandSignal[];
  transferRecommendations: TransferRecommendation[];
  transferDecisions: TransferDecision[];
  activityLogs: NetworkActivity[];
  registeredInterests: string[];
}

export interface FulfilmentOption {
  store: Store;
  inventory: InventoryRecord;
  totalCostInr: number;
  deliveryFeeInr: number;
  fulfilmentHours: number;
  distanceKm: number;
  freshness: FreshnessState;
  score: number;
  reason: string;
}

export interface RescueEvaluation {
  outcome: 'AVAILABLE_PREFERRED' | 'RESCUE_OTHER_STORE' | 'RESCUE_COMPATIBLE_PRODUCT' | 'REGISTER_INTEREST';
  preferredStoreOption: FulfilmentOption | null;
  alternativeStoreOptions: FulfilmentOption[];
  compatibleAlternatives: Array<{
    product: Product;
    bestOption: FulfilmentOption;
  }>;
  summary: string;
}
