import type {
  FulfilmentOption,
  FulfilmentPreference,
  InventoryRecord,
  Product,
  RescueEvaluation,
  Store,
} from '../types';
import { formatInr, getFreshnessState } from '../utils/formatters';

/**
 * Documented Sellable Stock Rule:
 * sellableQty = max(0, verifiedQty - reservedQty - safetyBuffer)
 */
export function computeSellableStock(verifiedQty: number, reservedQty: number, safetyBuffer: number): number {
  return Math.max(0, verifiedQty - reservedQty - safetyBuffer);
}

export function rankFulfilmentOptions(
  product: Product,
  stores: Store[],
  inventory: InventoryRecord[],
  preference: FulfilmentPreference,
  requestedQty = 1
): FulfilmentOption[] {
  const eligible: FulfilmentOption[] = [];

  for (const store of stores) {
    if (!store.isOpen) continue;
    const inv = inventory.find((r) => r.storeId === store.id && r.productId === product.id);
    if (!inv || inv.sellableQty < requestedQty) continue;

    const freshness = getFreshnessState(inv.lastVerifiedAt);
    const totalCostInr = product.priceInr * requestedQty + store.deliveryFeeInr;

    let score = 0;
    let reason = '';
    if (preference === 'SAVE_MONEY') {
      score = totalCostInr;
      reason =
        store.deliveryFeeInr === 0
          ? `Lowest total cost (${formatInr(totalCostInr)}) with ₹0 local delivery fee.`
          : `Ranked by lowest total cost (${formatInr(totalCostInr)} including ${formatInr(store.deliveryFeeInr)} delivery).`;
    } else if (preference === 'GET_IT_FASTER') {
      score = store.fulfilmentHours;
      reason = `Fastest configured fulfilment window (${store.fulfilmentHours}h dispatch readiness).`;
    } else {
      score = store.distanceKm;
      reason = `Closest eligible store (${store.distanceKm.toFixed(1)} km from selected locality).`;
    }

    eligible.push({
      store,
      inventory: inv,
      totalCostInr,
      deliveryFeeInr: store.deliveryFeeInr,
      fulfilmentHours: store.fulfilmentHours,
      distanceKm: store.distanceKm,
      freshness: freshness.state,
      score,
      reason,
    });
  }

  eligible.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.distanceKm - b.distanceKm;
  });

  return eligible;
}

export function evaluateProductRescue(
  product: Product,
  preferredStoreId: string,
  stores: Store[],
  products: Product[],
  inventory: InventoryRecord[],
  preference: FulfilmentPreference,
  requestedQty = 1
): RescueEvaluation {
  const rankedExact = rankFulfilmentOptions(product, stores, inventory, preference, requestedQty);
  const preferredOption = rankedExact.find((opt) => opt.store.id === preferredStoreId) || null;

  if (preferredOption) {
    return {
      outcome: 'AVAILABLE_PREFERRED',
      preferredStoreOption: preferredOption,
      alternativeStoreOptions: rankedExact.filter((opt) => opt.store.id !== preferredStoreId),
      compatibleAlternatives: [],
      summary: `Available at your preferred store (${preferredOption.store.name}) with ${preferredOption.inventory.sellableQty} sellable units.`,
    };
  }

  if (rankedExact.length > 0) {
    return {
      outcome: 'RESCUE_OTHER_STORE',
      preferredStoreOption: null,
      alternativeStoreOptions: rankedExact,
      compatibleAlternatives: [],
      summary: `Out of sellable stock at your preferred store. Exact product rescued from ${rankedExact[0].store.name} (${rankedExact.length} network ${rankedExact.length === 1 ? 'store' : 'stores'} available).`,
    };
  }

  // Priority 2: Curated compatible alternative using documented compatibilityGroup
  const compatibleProducts = products.filter(
    (p) => p.id !== product.id && p.compatibilityGroup === product.compatibilityGroup
  );
  const compatibleAlternatives: RescueEvaluation['compatibleAlternatives'] = [];

  for (const altProduct of compatibleProducts) {
    const rankedAlt = rankFulfilmentOptions(altProduct, stores, inventory, preference, requestedQty);
    if (rankedAlt.length > 0) {
      compatibleAlternatives.push({
        product: altProduct,
        bestOption: rankedAlt[0],
      });
    }
  }

  if (compatibleAlternatives.length > 0) {
    return {
      outcome: 'RESCUE_COMPATIBLE_PRODUCT',
      preferredStoreOption: null,
      alternativeStoreOptions: [],
      compatibleAlternatives,
      summary: `No sellable network stock for ${product.name}. Compatible ${product.compatibilityLabel} alternative available at ${compatibleAlternatives[0].bestOption.store.name}.`,
    };
  }

  // Priority 3: Register interest
  return {
    outcome: 'REGISTER_INTEREST',
    preferredStoreOption: null,
    alternativeStoreOptions: [],
    compatibleAlternatives: [],
    summary: `Currently out of sellable stock across all Bengaluru network stores. Register interest to notify Demand Radar.`,
  };
}
