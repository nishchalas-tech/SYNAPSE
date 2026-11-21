import React, { createContext, useCallback, useContext, useState } from 'react';
import {
  syncDemandSignalToFirestore,
  syncOrderAndTaskToFirestore,
  syncTransferDecisionToFirestore,
  syncVerificationToFirestore,
} from '../services/firestoreSync';
import { computeSellableStock, rankFulfilmentOptions } from '../services/fulfilmentService';
import { loadNetworkState, resetNetworkState, saveNetworkState } from '../services/networkRepository';
import type {
  AuthSession,
  DemandSignal,
  DemandSignalOutcome,
  FulfilmentPreference,
  NetworkActivity,
  NetworkState,
  Order,
  PickTask,
  StockVerification,
  TransferDecision,
} from '../types';
import { getPreferenceLabel } from '../utils/formatters';

interface CheckoutPayload {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  session: AuthSession | null;
}

interface ActionResult<T = undefined> {
  ok: boolean;
  message: string;
  data?: T;
}

interface NetworkContextValue {
  state: NetworkState;
  addToCart: (productId: string, storeId: string, preference: FulfilmentPreference, qty?: number) => ActionResult;
  updateCartQuantity: (cartItemId: string, quantity: number) => ActionResult;
  removeFromCart: (cartItemId: string) => void;
  placeDemoOrder: (payload: CheckoutPayload) => ActionResult<Order>;
  submitStockVerification: (input: {
    storeId: string;
    productId: string;
    verifiedQty: number;
    discrepancyReason?: string;
    session: AuthSession;
  }) => ActionResult<StockVerification>;
  acceptPickTask: (taskId: string, session: AuthSession) => ActionResult;
  rejectPickTask: (taskId: string, reason: string, session: AuthSession) => ActionResult<{
    reassignedStoreName?: string;
    exception: boolean;
  }>;
  recordDemandSignal: (input: {
    query: string;
    inferredCategory: string;
    inferredProductId?: string;
    locality: string;
    outcome: DemandSignalOutcome;
    session: AuthSession | null;
  }) => void;
  registerProductInterest: (productId: string, productName: string, locality: string, session: AuthSession | null) => void;
  approveTransfer: (recommendationId: string, notes: string, session: AuthSession) => ActionResult;
  rejectTransfer: (recommendationId: string, notes: string, session: AuthSession) => ActionResult;
  resetDemoData: () => void;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NetworkState>(() => loadNetworkState());

  const commit = useCallback((updater: (prev: NetworkState) => NetworkState) => {
    setState((prev) => {
      const next = updater(prev);
      saveNetworkState(next);
      return next;
    });
  }, []);

  const addToCart = useCallback(
    (productId: string, storeId: string, preference: FulfilmentPreference, qty = 1): ActionResult => {
      const inv = state.inventory.find((r) => r.productId === productId && r.storeId === storeId);
      const store = state.stores.find((s) => s.id === storeId);
      if (!inv || !store) {
        return { ok: false, message: 'Selected store inventory record was not found.' };
      }

      const existingSameStore = state.cart.find((c) => c.productId === productId && c.storeId === storeId);
      const desiredQty = (existingSameStore?.quantity || 0) + qty;
      if (desiredQty > inv.sellableQty) {
        return {
          ok: false,
          message: `Only ${inv.sellableQty} sellable units available at ${store.name}.`,
        };
      }

      // Single-store fulfilment cart discipline (no split shipments)
      const hasDifferentStore = state.cart.some((c) => c.storeId !== storeId);
      if (hasDifferentStore) {
        return {
          ok: false,
          message:
            'Your cart currently holds items fulfilled by a different store. Clear or checkout your current cart first to keep a single-store fulfilment promise.',
        };
      }

      commit((prev) => {
        const idx = prev.cart.findIndex((c) => c.productId === productId && c.storeId === storeId);
        const nextCart = [...prev.cart];
        if (idx >= 0) {
          nextCart[idx] = {
            ...nextCart[idx],
            quantity: nextCart[idx].quantity + qty,
            fulfilmentPreference: preference,
          };
        } else {
          nextCart.push({
            id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            productId,
            storeId,
            quantity: qty,
            fulfilmentPreference: preference,
            addedAt: new Date().toISOString(),
          });
        }
        return { ...prev, cart: nextCart };
      });

      return { ok: true, message: `Added to cart from ${store.name}.` };
    },
    [state.cart, state.inventory, state.stores, commit]
  );

  const updateCartQuantity = useCallback(
    (cartItemId: string, quantity: number): ActionResult => {
      if (quantity < 1) {
        commit((prev) => ({
          ...prev,
          cart: prev.cart.filter((c) => c.id !== cartItemId),
        }));
        return { ok: true, message: 'Item removed from cart.' };
      }
      const item = state.cart.find((c) => c.id === cartItemId);
      if (!item) return { ok: false, message: 'Cart item not found.' };
      const inv = state.inventory.find((r) => r.productId === item.productId && r.storeId === item.storeId);
      if (!inv || quantity > inv.sellableQty) {
        return {
          ok: false,
          message: `Maximum ${inv?.sellableQty ?? 0} sellable units available at selected store.`,
        };
      }
      commit((prev) => ({
        ...prev,
        cart: prev.cart.map((c) => (c.id === cartItemId ? { ...c, quantity } : c)),
      }));
      return { ok: true, message: 'Quantity updated.' };
    },
    [state.cart, state.inventory, commit]
  );

  const removeFromCart = useCallback(
    (cartItemId: string) => {
      commit((prev) => ({
        ...prev,
        cart: prev.cart.filter((c) => c.id !== cartItemId),
      }));
    },
    [commit]
  );

  const placeDemoOrder = useCallback(
    (payload: CheckoutPayload): ActionResult<Order> => {
      if (state.cart.length === 0) {
        return { ok: false, message: 'Your cart is empty.' };
      }

      const targetStoreId = state.cart[0].storeId;
      const targetPreference = state.cart[0].fulfilmentPreference;
      const store = state.stores.find((s) => s.id === targetStoreId);
      if (!store) {
        return { ok: false, message: 'Fulfilment store could not be resolved.' };
      }

      // Live re-check of sellable stock before order creation
      for (const cartItem of state.cart) {
        const inv = state.inventory.find(
          (r) => r.storeId === cartItem.storeId && r.productId === cartItem.productId
        );
        const prod = state.products.find((p) => p.id === cartItem.productId);
        if (!inv || inv.sellableQty < cartItem.quantity) {
          return {
            ok: false,
            message: `Stock changed for ${prod?.name || cartItem.productId} at ${store.name}. Only ${
              inv?.sellableQty ?? 0
            } sellable units remain.`,
          };
        }
      }

      const nowIso = new Date().toISOString();
      const orderId = `ord-${Date.now()}`;
      const orderNumber = `SYN-2026-${String(1003 + state.orders.length)}`;
      const customerId = payload.session?.uid || 'demo-customer-1';

      const orderItems = state.cart.map((c) => {
        const prod = state.products.find((p) => p.id === c.productId)!;
        return {
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          imageUrl: prod.imageUrl,
          unitPriceInr: prod.priceInr,
          quantity: c.quantity,
        };
      });

      const subtotalInr = orderItems.reduce((sum, item) => sum + item.unitPriceInr * item.quantity, 0);
      const deliveryFeeInr = store.deliveryFeeInr;
      const totalInr = subtotalInr + deliveryFeeInr;

      const newOrder: Order = {
        id: orderId,
        orderNumber,
        customerId,
        customerName: payload.customerName.trim(),
        customerEmail: payload.customerEmail.trim(),
        customerPhone: payload.customerPhone.trim(),
        shippingAddress: payload.shippingAddress.trim(),
        city: payload.city.trim(),
        storeId: store.id,
        storeName: store.name,
        fulfilmentPreference: targetPreference,
        fulfilmentNote: `Assigned to ${store.name} via ${getPreferenceLabel(targetPreference)} (${store.fulfilmentHours}h readiness, ${store.distanceKm.toFixed(1)} km).`,
        status: 'PICK_PENDING',
        subtotalInr,
        deliveryFeeInr,
        totalInr,
        items: orderItems,
        timeline: [
          {
            id: `tl-${Date.now()}-1`,
            status: 'CONFIRMED',
            title: 'Demo Order Placed',
            description: `Sellable stock verified and reserved at ${store.name}.`,
            storeName: store.name,
            timestamp: nowIso,
          },
          {
            id: `tl-${Date.now()}-2`,
            status: 'PICK_PENDING',
            title: 'Store Pick Task Dispatched',
            description: `Waiting for ${store.name} manager confirmation.`,
            storeName: store.name,
            timestamp: nowIso,
          },
        ],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const createdTasks: PickTask[] = orderItems.map((item, index) => ({
        id: `task-${Date.now()}-${index}`,
        orderId,
        orderNumber,
        customerId,
        storeId: store.id,
        storeName: store.name,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        status: 'PENDING',
        createdAt: nowIso,
        updatedAt: nowIso,
      }));

      const activity: NetworkActivity = {
        id: `act-${Date.now()}`,
        actorUid: customerId,
        actorRole: 'CUSTOMER',
        actorName: payload.customerName.trim(),
        eventType: 'ORDER_PLACED',
        storeId: store.id,
        summary: `Placed demo order ${orderNumber} (${orderItems.length} SKU) assigned to ${store.name}.`,
        createdAt: nowIso,
      };

      commit((prev) => {
        const nextInventory = prev.inventory.map((inv) => {
          const orderedLine = orderItems.find(
            (i) => i.productId === inv.productId && store.id === inv.storeId
          );
          if (!orderedLine) return inv;
          const nextReserved = inv.reservedQty + orderedLine.quantity;
          const nextSellable = computeSellableStock(inv.verifiedQty, nextReserved, inv.safetyBuffer);
          return {
            ...inv,
            reservedQty: nextReserved,
            sellableQty: nextSellable,
            updatedAt: nowIso,
          };
        });

        return {
          ...prev,
          inventory: nextInventory,
          cart: [],
          orders: [newOrder, ...prev.orders],
          pickTasks: [...createdTasks, ...prev.pickTasks],
          activityLogs: [activity, ...prev.activityLogs],
        };
      });

      if (payload.session) {
        void syncOrderAndTaskToFirestore(payload.session, newOrder, createdTasks).catch((err) => {
          console.warn('Order Firestore sync deferred:', err);
        });
      }

      return { ok: true, message: `Demo order ${orderNumber} placed.`, data: newOrder };
    },
    [state.cart, state.inventory, state.orders.length, state.products, state.stores, commit]
  );

  const submitStockVerification = useCallback(
    (input: {
      storeId: string;
      productId: string;
      verifiedQty: number;
      discrepancyReason?: string;
      session: AuthSession;
    }): ActionResult<StockVerification> => {
      if (input.verifiedQty < 0 || !Number.isInteger(input.verifiedQty)) {
        return { ok: false, message: 'Physical count must be a non-negative whole number.' };
      }
      const inv = state.inventory.find(
        (r) => r.storeId === input.storeId && r.productId === input.productId
      );
      const prod = state.products.find((p) => p.id === input.productId);
      const store = state.stores.find((s) => s.id === input.storeId);
      if (!inv || !prod || !store) {
        return { ok: false, message: 'Inventory record not found.' };
      }

      const discrepancyDelta = input.verifiedQty - inv.recordedQty;
      if (discrepancyDelta !== 0 && (!input.discrepancyReason || !input.discrepancyReason.trim())) {
        return {
          ok: false,
          message: 'Please provide a discrepancy reason when physical count differs from recorded stock.',
        };
      }

      const nowIso = new Date().toISOString();
      const newSellableQty = computeSellableStock(input.verifiedQty, inv.reservedQty, inv.safetyBuffer);

      const verification: StockVerification = {
        id: `ver-${Date.now()}`,
        storeId: input.storeId,
        productId: input.productId,
        productName: prod.name,
        recordedQty: inv.recordedQty,
        verifiedQty: input.verifiedQty,
        previousSellableQty: inv.sellableQty,
        newSellableQty,
        discrepancyDelta,
        discrepancyReason: input.discrepancyReason?.trim() || undefined,
        verifiedBy: input.session.displayName,
        verifiedByUid: input.session.uid,
        createdAt: nowIso,
      };

      const activity: NetworkActivity = {
        id: `act-${Date.now()}`,
        actorUid: input.session.uid,
        actorRole: input.session.role,
        actorName: input.session.displayName,
        eventType: 'INVENTORY_CHANGED',
        storeId: input.storeId,
        summary: `Stock Whisperer verification at ${store.locality} for ${prod.name}: ${inv.recordedQty} recorded, ${input.verifiedQty} verified, ${newSellableQty} sellable.`,
        createdAt: nowIso,
      };

      commit((prev) => ({
        ...prev,
        inventory: prev.inventory.map((r) =>
          r.id === inv.id
            ? {
                ...r,
                verifiedQty: input.verifiedQty,
                sellableQty: newSellableQty,
                lastVerifiedAt: nowIso,
                lastVerifiedBy: input.session.displayName,
                discrepancyReason: input.discrepancyReason?.trim() || undefined,
                updatedAt: nowIso,
              }
            : r
        ),
        verifications: [verification, ...prev.verifications],
        activityLogs: [activity, ...prev.activityLogs],
      }));

      void syncVerificationToFirestore(input.session, verification).catch(() => undefined);

      return { ok: true, message: 'Physical stock verification saved.', data: verification };
    },
    [state.inventory, state.products, state.stores, commit]
  );

  const acceptPickTask = useCallback(
    (taskId: string, session: AuthSession): ActionResult => {
      const task = state.pickTasks.find((t) => t.id === taskId);
      if (!task) return { ok: false, message: 'Pick task not found.' };
      if (session.role === 'STORE_MANAGER' && session.assignedStoreId && session.assignedStoreId !== task.storeId) {
        return { ok: false, message: 'Managers can only operate on their assigned store.' };
      }
      if (task.status !== 'PENDING') {
        return { ok: false, message: 'Only pending pick tasks can be accepted.' };
      }

      const nowIso = new Date().toISOString();
      const activity: NetworkActivity = {
        id: `act-${Date.now()}`,
        actorUid: session.uid,
        actorRole: session.role,
        actorName: session.displayName,
        eventType: 'PICK_ACCEPTED',
        storeId: task.storeId,
        summary: `Accepted pick task for ${task.orderNumber} (${task.productName} x${task.quantity}) at ${task.storeName}.`,
        createdAt: nowIso,
      };

      commit((prev) => ({
        ...prev,
        pickTasks: prev.pickTasks.map((t) =>
          t.id === taskId ? { ...t, status: 'ACCEPTED', updatedAt: nowIso } : t
        ),
        orders: prev.orders.map((o) =>
          o.id === task.orderId
            ? {
                ...o,
                status: 'READY_FOR_DISPATCH',
                updatedAt: nowIso,
                timeline: [
                  ...o.timeline,
                  {
                    id: `tl-${Date.now()}`,
                    status: 'READY_FOR_DISPATCH',
                    title: 'Pick Confirmed by Store Manager',
                    description: `${task.quantity} unit(s) verified and staged for dispatch at ${task.storeName}.`,
                    storeName: task.storeName,
                    timestamp: nowIso,
                  },
                ],
              }
            : o
        ),
        activityLogs: [activity, ...prev.activityLogs],
      }));

      return { ok: true, message: `Pick task accepted for ${task.orderNumber}.` };
    },
    [state.pickTasks, commit]
  );

  const rejectPickTask = useCallback(
    (
      taskId: string,
      reason: string,
      session: AuthSession
    ): ActionResult<{ reassignedStoreName?: string; exception: boolean }> => {
      if (!reason.trim()) {
        return { ok: false, message: 'A rejection reason is mandatory.' };
      }
      const task = state.pickTasks.find((t) => t.id === taskId);
      if (!task) return { ok: false, message: 'Pick task not found.' };
      if (session.role === 'STORE_MANAGER' && session.assignedStoreId && session.assignedStoreId !== task.storeId) {
        return { ok: false, message: 'Managers can only operate on their assigned store.' };
      }
      if (task.status !== 'PENDING') {
        return { ok: false, message: 'Only pending pick tasks can be rejected.' };
      }

      const product = state.products.find((p) => p.id === task.productId);
      const order = state.orders.find((o) => o.id === task.orderId);
      if (!product || !order) {
        return { ok: false, message: 'Associated order or product not found.' };
      }

      const nowIso = new Date().toISOString();

      // Step 1: Release original demo reservation and evaluate alternative stores
      const candidateStores = state.stores.filter((s) => s.id !== task.storeId);
      const rankedAlternatives = rankFulfilmentOptions(
        product,
        candidateStores,
        state.inventory,
        order.fulfilmentPreference,
        task.quantity
      );
      const chosenAlt = rankedAlternatives[0] || null;

      if (chosenAlt) {
        const altStore = chosenAlt.store;
        const newTask: PickTask = {
          id: `task-${Date.now()}-reassigned`,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          storeId: altStore.id,
          storeName: altStore.name,
          productId: task.productId,
          productName: task.productName,
          quantity: task.quantity,
          status: 'PENDING',
          reassignedFromStoreId: task.storeId,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        const rejectActivity: NetworkActivity = {
          id: `act-${Date.now()}-rej`,
          actorUid: session.uid,
          actorRole: session.role,
          actorName: session.displayName,
          eventType: 'PICK_REJECTED',
          storeId: task.storeId,
          summary: `Rejected pick task for ${order.orderNumber} at ${task.storeName} (${reason.trim()}). Original reservation released.`,
          createdAt: nowIso,
        };

        const reassignActivity: NetworkActivity = {
          id: `act-${Date.now()}-rea`,
          actorUid: session.uid,
          actorRole: session.role,
          actorName: session.displayName,
          eventType: 'ORDER_REASSIGNED',
          storeId: altStore.id,
          summary: `Adaptive Fulfilment reassigned ${order.orderNumber} to ${altStore.name} (${altStore.fulfilmentHours}h readiness).`,
          createdAt: nowIso,
        };

        commit((prev) => {
          const nextInventory = prev.inventory.map((inv) => {
            if (inv.storeId === task.storeId && inv.productId === task.productId) {
              const nextReserved = Math.max(0, inv.reservedQty - task.quantity);
              const nextSellable = computeSellableStock(inv.verifiedQty, nextReserved, inv.safetyBuffer);
              return { ...inv, reservedQty: nextReserved, sellableQty: nextSellable, updatedAt: nowIso };
            }
            if (inv.storeId === altStore.id && inv.productId === task.productId) {
              const nextReserved = inv.reservedQty + task.quantity;
              const nextSellable = computeSellableStock(inv.verifiedQty, nextReserved, inv.safetyBuffer);
              return { ...inv, reservedQty: nextReserved, sellableQty: nextSellable, updatedAt: nowIso };
            }
            return inv;
          });

          return {
            ...prev,
            inventory: nextInventory,
            pickTasks: [
              newTask,
              ...prev.pickTasks.map((t) =>
                t.id === taskId
                  ? { ...t, status: 'REASSIGNED' as const, rejectionReason: reason.trim(), updatedAt: nowIso }
                  : t
              ),
            ],
            orders: prev.orders.map((o) =>
              o.id === order.id
                ? {
                    ...o,
                    storeId: altStore.id,
                    storeName: altStore.name,
                    status: 'REASSIGNED',
                    fulfilmentNote: `Reassigned from ${task.storeName} to ${altStore.name} after store pick rejection (${reason.trim()}).`,
                    updatedAt: nowIso,
                    timeline: [
                      ...o.timeline,
                      {
                        id: `tl-${Date.now()}-rej`,
                        status: 'REASSIGNED',
                        title: `Reassigned to ${altStore.name}`,
                        description: `${task.storeName} could not fulfil (${reason.trim()}). Stock reserved at ${altStore.name} (${altStore.fulfilmentHours}h readiness).`,
                        storeName: altStore.name,
                        timestamp: nowIso,
                      },
                    ],
                  }
                : o
            ),
            activityLogs: [reassignActivity, rejectActivity, ...prev.activityLogs],
          };
        });

        return {
          ok: true,
          message: `Pick rejected. Reservation released and order reassigned to ${altStore.name}.`,
          data: { reassignedStoreName: altStore.name, exception: false },
        };
      }

      // No eligible alternative store found -> clear exception state
      const exceptionActivity: NetworkActivity = {
        id: `act-${Date.now()}-exc`,
        actorUid: session.uid,
        actorRole: session.role,
        actorName: session.displayName,
        eventType: 'FULFILMENT_EXCEPTION',
        storeId: task.storeId,
        summary: `Fulfilment exception on ${order.orderNumber}: rejected at ${task.storeName} (${reason.trim()}), no eligible alternative store found.`,
        createdAt: nowIso,
      };

      commit((prev) => {
        const nextInventory = prev.inventory.map((inv) => {
          if (inv.storeId === task.storeId && inv.productId === task.productId) {
            const nextReserved = Math.max(0, inv.reservedQty - task.quantity);
            const nextSellable = computeSellableStock(inv.verifiedQty, nextReserved, inv.safetyBuffer);
            return { ...inv, reservedQty: nextReserved, sellableQty: nextSellable, updatedAt: nowIso };
          }
          return inv;
        });

        return {
          ...prev,
          inventory: nextInventory,
          pickTasks: prev.pickTasks.map((t) =>
            t.id === taskId
              ? { ...t, status: 'EXCEPTION' as const, rejectionReason: reason.trim(), updatedAt: nowIso }
              : t
          ),
          orders: prev.orders.map((o) =>
            o.id === order.id
              ? {
                  ...o,
                  status: 'EXCEPTION',
                  fulfilmentNote: `Fulfilment paused: ${task.storeName} rejected pick (${reason.trim()}) and no alternate store had sufficient sellable stock.`,
                  updatedAt: nowIso,
                  timeline: [
                    ...o.timeline,
                    {
                      id: `tl-${Date.now()}-exc`,
                      status: 'EXCEPTION',
                      title: 'Fulfilment Exception — Network Action Required',
                      description: `${task.storeName} could not fulfil (${reason.trim()}). No alternative store has sufficient sellable stock.`,
                      storeName: task.storeName,
                      timestamp: nowIso,
                    },
                  ],
                }
              : o
          ),
          activityLogs: [exceptionActivity, ...prev.activityLogs],
        };
      });

      return {
        ok: true,
        message: 'Pick rejected. No alternate store qualified; order moved to Fulfilment Exception.',
        data: { exception: true },
      };
    },
    [state.inventory, state.orders, state.pickTasks, state.products, state.stores, commit]
  );

  const recordDemandSignal = useCallback(
    (input: {
      query: string;
      inferredCategory: string;
      inferredProductId?: string;
      locality: string;
      outcome: DemandSignalOutcome;
      session: AuthSession | null;
    }) => {
      const cleanQuery = input.query.trim();
      if (!cleanQuery) return;
      const nowIso = new Date().toISOString();
      const userId = input.session?.uid || 'demo-customer-1';

      const signal: DemandSignal = {
        id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        userId,
        query: cleanQuery,
        inferredCategory: input.inferredCategory,
        inferredProductId: input.inferredProductId,
        locality: input.locality,
        outcome: input.outcome,
        createdAt: nowIso,
      };

      const activity: NetworkActivity = {
        id: `act-${Date.now()}`,
        actorUid: userId,
        actorRole: input.session?.role || 'CUSTOMER',
        actorName: input.session?.displayName || 'Customer',
        eventType: 'DEMAND_SIGNAL_RECORDED',
        summary: `Demand Radar captured "${cleanQuery}" (${input.outcome}) in ${input.locality}.`,
        createdAt: nowIso,
      };

      commit((prev) => {
        const recentDuplicate = prev.demandSignals.find(
          (s) =>
            s.query.toLowerCase() === cleanQuery.toLowerCase() &&
            s.outcome === input.outcome &&
            Date.now() - new Date(s.createdAt).getTime() < 20000
        );
        if (recentDuplicate) return prev;
        return {
          ...prev,
          demandSignals: [signal, ...prev.demandSignals],
          activityLogs: [activity, ...prev.activityLogs],
        };
      });

      if (input.session) {
        void syncDemandSignalToFirestore(input.session, signal).catch(() => undefined);
      }
    },
    [commit]
  );

  const registerProductInterest = useCallback(
    (productId: string, productName: string, locality: string, session: AuthSession | null) => {
      commit((prev) => {
        if (prev.registeredInterests.includes(productId)) return prev;
        return {
          ...prev,
          registeredInterests: [...prev.registeredInterests, productId],
        };
      });
      recordDemandSignal({
        query: productName,
        inferredCategory: state.products.find((p) => p.id === productId)?.category || 'General',
        inferredProductId: productId,
        locality,
        outcome: 'REGISTERED_INTEREST',
        session,
      });
    },
    [commit, recordDemandSignal, state.products]
  );

  const approveTransfer = useCallback(
    (recommendationId: string, notes: string, session: AuthSession): ActionResult => {
      const rec = state.transferRecommendations.find((r) => r.id === recommendationId);
      if (!rec) return { ok: false, message: 'Transfer recommendation not found.' };
      if (rec.status !== 'PENDING') return { ok: false, message: 'Recommendation already processed.' };

      const srcInv = state.inventory.find(
        (i) => i.storeId === rec.sourceStoreId && i.productId === rec.productId
      );
      if (!srcInv || srcInv.sellableQty < rec.recommendedQty) {
        return {
          ok: false,
          message: `Insufficient sellable stock at ${rec.sourceStoreName} (${srcInv?.sellableQty ?? 0} available).`,
        };
      }

      const nowIso = new Date().toISOString();
      const decision: TransferDecision = {
        id: `tdec-${Date.now()}`,
        recommendationId: rec.id,
        sourceStoreId: rec.sourceStoreId,
        sourceStoreName: rec.sourceStoreName,
        destinationStoreId: rec.destinationStoreId,
        destinationStoreName: rec.destinationStoreName,
        productId: rec.productId,
        productName: rec.productName,
        quantity: rec.recommendedQty,
        decision: 'APPROVED',
        notes: notes.trim() || 'Approved for inter-store rebalancing.',
        decidedBy: session.displayName,
        createdAt: nowIso,
      };

      const activity: NetworkActivity = {
        id: `act-${Date.now()}`,
        actorUid: session.uid,
        actorRole: session.role,
        actorName: session.displayName,
        eventType: 'TRANSFER_APPROVED',
        storeId: rec.destinationStoreId,
        summary: `Approved transfer of ${rec.recommendedQty}x ${rec.productName} from ${rec.sourceStoreName} to ${rec.destinationStoreName}.`,
        createdAt: nowIso,
      };

      const updatedRec = { ...rec, status: 'APPROVED' as const, updatedAt: nowIso };

      commit((prev) => ({
        ...prev,
        inventory: prev.inventory.map((inv) => {
          if (inv.storeId === rec.sourceStoreId && inv.productId === rec.productId) {
            const nextRecorded = Math.max(0, inv.recordedQty - rec.recommendedQty);
            const nextVerified = Math.max(0, inv.verifiedQty - rec.recommendedQty);
            const nextSellable = computeSellableStock(nextVerified, inv.reservedQty, inv.safetyBuffer);
            return {
              ...inv,
              recordedQty: nextRecorded,
              verifiedQty: nextVerified,
              sellableQty: nextSellable,
              updatedAt: nowIso,
            };
          }
          if (inv.storeId === rec.destinationStoreId && inv.productId === rec.productId) {
            const nextRecorded = inv.recordedQty + rec.recommendedQty;
            const nextVerified = inv.verifiedQty + rec.recommendedQty;
            const nextSellable = computeSellableStock(nextVerified, inv.reservedQty, inv.safetyBuffer);
            return {
              ...inv,
              recordedQty: nextRecorded,
              verifiedQty: nextVerified,
              sellableQty: nextSellable,
              lastVerifiedAt: nowIso,
              lastVerifiedBy: `Transfer from ${rec.sourceStoreName}`,
              updatedAt: nowIso,
            };
          }
          return inv;
        }),
        transferRecommendations: prev.transferRecommendations.map((r) =>
          r.id === rec.id ? updatedRec : r
        ),
        transferDecisions: [decision, ...prev.transferDecisions],
        activityLogs: [activity, ...prev.activityLogs],
      }));

      void syncTransferDecisionToFirestore(session, updatedRec, decision).catch(() => undefined);

      return {
        ok: true,
        message: `Approved demo transfer of ${rec.recommendedQty} units to ${rec.destinationStoreName}.`,
      };
    },
    [state.inventory, state.transferRecommendations, commit]
  );

  const rejectTransfer = useCallback(
    (recommendationId: string, notes: string, session: AuthSession): ActionResult => {
      const rec = state.transferRecommendations.find((r) => r.id === recommendationId);
      if (!rec) return { ok: false, message: 'Transfer recommendation not found.' };
      if (rec.status !== 'PENDING') return { ok: false, message: 'Recommendation already processed.' };

      const nowIso = new Date().toISOString();
      const decision: TransferDecision = {
        id: `tdec-${Date.now()}`,
        recommendationId: rec.id,
        sourceStoreId: rec.sourceStoreId,
        sourceStoreName: rec.sourceStoreName,
        destinationStoreId: rec.destinationStoreId,
        destinationStoreName: rec.destinationStoreName,
        productId: rec.productId,
        productName: rec.productName,
        quantity: rec.recommendedQty,
        decision: 'REJECTED',
        notes: notes.trim() || 'Declined by Network Administrator.',
        decidedBy: session.displayName,
        createdAt: nowIso,
      };

      const activity: NetworkActivity = {
        id: `act-${Date.now()}`,
        actorUid: session.uid,
        actorRole: session.role,
        actorName: session.displayName,
        eventType: 'TRANSFER_REJECTED',
        storeId: rec.destinationStoreId,
        summary: `Rejected transfer recommendation for ${rec.productName} (${rec.sourceStoreName} -> ${rec.destinationStoreName}).`,
        createdAt: nowIso,
      };

      const updatedRec = { ...rec, status: 'REJECTED' as const, updatedAt: nowIso };

      commit((prev) => ({
        ...prev,
        transferRecommendations: prev.transferRecommendations.map((r) =>
          r.id === rec.id ? updatedRec : r
        ),
        transferDecisions: [decision, ...prev.transferDecisions],
        activityLogs: [activity, ...prev.activityLogs],
      }));

      void syncTransferDecisionToFirestore(session, updatedRec, decision).catch(() => undefined);

      return { ok: true, message: 'Transfer recommendation rejected and logged.' };
    },
    [state.transferRecommendations, commit]
  );

  const resetDemoData = useCallback(() => {
    const fresh = resetNetworkState();
    setState(fresh);
  }, []);

  return (
    <NetworkContext.Provider
      value={{
        state,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        placeDemoOrder,
        submitStockVerification,
        acceptPickTask,
        rejectPickTask,
        recordDemandSignal,
        registerProductInterest,
        approveTransfer,
        rejectTransfer,
        resetDemoData,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error('useNetwork must be used within NetworkProvider');
  return ctx;
}
