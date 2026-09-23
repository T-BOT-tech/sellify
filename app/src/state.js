// state.js
// Phase 2 extraction (see modularization plan §5, and Rule 1 in §1).
//
// Single source of truth for the state that's shared across more than one
// still-to-be-split area of the app (storage/hydration, sync, settings,
// staff/PIN, cart/checkout). ES modules are singletons — a module imported
// from ten files is the same module instance every time — so every other
// module can `import` these *same* live bindings and reproduce the current
// closure model exactly, with no event bus, store, or Promise-wrapped
// getters/setters.
//
// Live-binding caveat (see plan §1): importers can READ these directly and
// see updates, but a full reassignment (`orders = orders.filter(...)`, which
// this app does constantly) can only happen inside this file — that's what
// the setters below are for. Push/splice/property-mutation on the
// arrays/objects themselves works fine from any importing module without a
// setter.
//
// Variables that are reassigned only within a single not-yet-extracted
// section of main.js (e.g. modal-editing ids, marketplace cart, restaurant
// table selection) deliberately stay local to main.js for now — they move
// into their own feature module in Phase 6 of the plan, alongside the code
// that owns them. What's here is exactly the set of variables that
// storage/hydrate.js, storage/persistence.js, and other cross-cutting code
// already need to reach into.

import {
  STORAGE_KEYS, DEFAULT_PAYMENT_METHODS, defaultSyncServerUrl
} from './constants.js';
import { loadJSON, saveJSON } from './storage/json.js';
import { migrateProductMoney, migrateOrderMoney } from './storage/migration.js';

export let config = loadJSON(STORAGE_KEYS.config, {
  sellerName: '', chatId: '', syncUrl: defaultSyncServerUrl, lang: 'en',
  currencyCode: 'INR', currencySymbol: '', niche: '', businessModel: 'retail',
  paymentMethods: DEFAULT_PAYMENT_METHODS.map(pm => ({ ...pm })),
  wholesaleEnabled: false,
  volumeDiscountEnabled: false,
  warehouseEnabled: false,
  logisticsEnabled: false
});
if (config.niche === undefined) config.niche = '';
if (!config.businessModel) config.businessModel = 'retail';
if (config.wholesaleEnabled === undefined) config.wholesaleEnabled = false;
if (config.volumeDiscountEnabled === undefined) config.volumeDiscountEnabled = false;
if (config.warehouseEnabled === undefined) config.warehouseEnabled = false;
if (config.logisticsEnabled === undefined) config.logisticsEnabled = false;
if (!config.syncUrl && defaultSyncServerUrl) {
  config.syncUrl = defaultSyncServerUrl;
}
if (!Array.isArray(config.paymentMethods) || config.paymentMethods.length === 0) {
  config.paymentMethods = DEFAULT_PAYMENT_METHODS.map(pm => ({ ...pm }));
}
if (!config.currencyCode) config.currencyCode = 'INR';
export function setConfig(next) { config = next; }

export let products = loadJSON(STORAGE_KEYS.products, []);
export function setProducts(next) { products = next; }
// Phase 4: migrate any legacy float-major-unit prices to integer minor
// units on load — see storage/migration.js's money-migration section for
// why this runs here AND again in storage/hydrate.js after IndexedDB
// hydration, instead of behind a single flag.
if (migrateProductMoney(products)) saveJSON(STORAGE_KEYS.products, products);

export let orders = loadJSON(STORAGE_KEYS.orders, []);
export function setOrders(next) { orders = next; }
if (migrateOrderMoney(orders)) saveJSON(STORAGE_KEYS.orders, orders);

// orderViewMode has an existing HTML-facing action also named
// `setOrderViewMode` (the click handler behind the list/grid toggle, still
// in main.js — it saves to storage and re-renders). To avoid a name clash,
// the raw state setter here is named `setOrderViewModeValue`; the click
// handler calls this one internally.
export let orderViewMode = loadJSON(STORAGE_KEYS.orderViewMode, 'list');
export function setOrderViewModeValue(next) { orderViewMode = next; }

// Phase 3 fix (see modularization plan §5, Phase 3): this used to seed
// every fresh install with the same three hardcoded PINs (1234/2222/0000),
// which is a default-credential problem, not just a weak one — a fixed
// PIN shared across every deployment is guessable without ever touching
// this specific device. Fresh installs now seed with no PIN at all;
// auth/pin.js's ensureStaffPinsHashed() (run once at boot, see main.js)
// generates a random one per station and hashes it in, then shows it to
// whoever's running the app that first time — same "shown once, then
// gone" treatment the invite-code flow already uses.
export let staffList = loadJSON(STORAGE_KEYS.staff, [
  { id: 'owner_1', name: 'Store Owner', role: 'owner' },
  { id: 'mgr_1', name: 'Store Manager', role: 'manager' },
  { id: 'cashier_1', name: 'Cashier Station 1', role: 'cashier' }
]);
export function setStaffList(next) { staffList = next; }

export let currentStaff = loadJSON(STORAGE_KEYS.activeStaff, { id: 'owner_1', name: 'Store Owner', role: 'owner' });
export function setCurrentStaff(next) { currentStaff = next; }

// currentOrder / currentOrderNotes: the in-progress cart for the Order tab.
// { productId: qty } and { productId: "no onions, extra spicy" }
// respectively — see modularization plan §1's Rule 1 example.
export let currentOrder = {};
export function setCurrentOrder(next) { currentOrder = next; }

export let currentOrderNotes = {};
export function setCurrentOrderNotes(next) { currentOrderNotes = next; }

export let b2bAccounts = loadJSON(STORAGE_KEYS.b2bAccounts, []);
export function setB2bAccounts(next) { b2bAccounts = next; }

// Phase 10.4 — canonical local customer registry. Customer records are kept
// locally first so checkout remains fully offline; the server API becomes the
// authoritative shared copy when connectivity/authentication is available.
export let customers = loadJSON(STORAGE_KEYS.customers, []);
export function setCustomers(next) { customers = next; }

// Phase 10.5 — canonical local inventory movement projection. The existing
// stockTransactions array remains the compatibility/UI history while this
// collection becomes the append-only movement stream used for sync.
export let inventoryMovements = loadJSON(STORAGE_KEYS.inventoryMovements, []);
export function setInventoryMovements(next) { inventoryMovements = next; }

// Phase 10.6 — cached canonical Organization → Location registry. The
// legacy warehouseLocations array remains a bin/storage-location UI bridge.
export let organizationLocations = loadJSON(STORAGE_KEYS.organizationLocations, []);
export function setOrganizationLocations(next) { organizationLocations = next; }

// Phase 10.6 — cached server-derived ledger balances, keyed by product/location.
export let inventoryBalances = loadJSON(STORAGE_KEYS.inventoryBalances, []);
export function setInventoryBalances(next) { inventoryBalances = next; }

// Phase 10.7 — durable local outbox for offline domain events.
export let outboxEvents = loadJSON(STORAGE_KEYS.outboxEvents, []);
export function setOutboxEvents(next) { outboxEvents = next; }

export let pricingTiers = loadJSON(STORAGE_KEYS.pricingTiers, [
  { id: 'tier_wholesale_a', name: 'Wholesale A', discountPct: 10 },
  { id: 'tier_wholesale_b', name: 'Wholesale B', discountPct: 20 }
]);
export function setPricingTiers(next) { pricingTiers = next; }

export let volumeDiscountTiers = loadJSON(STORAGE_KEYS.volumeDiscounts, [
  { id: 'vd_10', minQty: 10, discountPct: 5 },
  { id: 'vd_50', minQty: 50, discountPct: 10 }
]);
export function setVolumeDiscountTiers(next) { volumeDiscountTiers = next; }

export let warehouseLocations = loadJSON(STORAGE_KEYS.warehouseLocations, []);
export function setWarehouseLocations(next) { warehouseLocations = next; }

export let stockTransactions = loadJSON(STORAGE_KEYS.stockTransactions, []);
export function setStockTransactions(next) { stockTransactions = next; }
