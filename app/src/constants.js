// constants.js
// Phase 1 — pure, static data. None of this reads `config`/`products`/`orders`
// or calls into any feature code, so it's safe to extract before state.js
// exists (see modularization plan, Rule 1 and §5 Phase 1).
//
// NICHE_PRESETS, BUSINESS_MODELS, and PERMISSIONS are intentionally left in
// main.js for now — the plan schedules those into config/niche.js and
// auth/permissions.js respectively in Phase 3, alongside the code that
// actually consumes them.

export const STORAGE_KEYS = {
  config: 'ledger_config',
  products: 'ledger_products',
  orders: 'ledger_orders',
  staff: 'ledger_staff',
  activeStaff: 'ledger_active_staff',
  orderViewMode: 'ledger_order_view_mode',
  b2bAccounts: 'ledger_b2b_accounts',
  pricingTiers: 'ledger_pricing_tiers',
  volumeDiscounts: 'ledger_volume_discounts',
  stockTransactions: 'ledger_stock_transactions',
  warehouseLocations: 'ledger_warehouse_locations',
  customers: 'ledger_customers',
  inventoryMovements: 'ledger_inventory_movements',
  organizationLocations: 'ledger_organization_locations',
  inventoryBalances: 'ledger_inventory_balances',
  outboxEvents: 'ledger_outbox_events'
};

// One-time localStorage -> IndexedDB migration flag key.
export const LEDGER_MIGRATION_FLAG_KEY = 'ledger_migrated_v1';

// IndexedDB key/value wrapper config (see storage/idb.js, extracted in Phase 2).
export const IDB_DB_NAME = 'ledger_db';
export const IDB_DB_VERSION = 1;
export const IDB_STORE_NAME = 'kv';

// Currency
export const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', KES: 'KSh ', ETB: 'Br ', NGN: '₦', GHS: 'GH₵', TZS: 'TSh ', UGX: 'USh ', ZAR: 'R ', XOF: 'CFA ', XAF: 'FCFA ', ZMW: 'ZK ', BIF: 'FBu ', CDF: 'FC ', RWF: 'FRw ', SOS: 'Sh ', SSP: '£ ' };

// Payment methods
export const DEFAULT_PAYMENT_METHODS = [
  { id: 'cash', name: 'Cash', enabled: true, type: 'cash', details: '' },
  { id: 'bank_transfer', name: 'Bank Transfer', enabled: true, type: 'bank', details: '' },
  { id: 'mobile_money', name: 'Mobile Money', enabled: true, type: 'digital', details: '' }
];

export const defaultSyncServerUrl = (window.__APP_CONFIG__ && window.__APP_CONFIG__.SYNC_SERVER_URL) ? window.__APP_CONFIG__.SYNC_SERVER_URL : '';

// Default menu course categories offered in Restaurant mode (mirrors NICHE_PRESETS.categories for retail).
export const RESTAURANT_COURSES = ['Starters', 'Mains', 'Desserts', 'Beverages', 'Sides'];

// Kitchen ticket priority ordering (lower sorts first).
export const PRIORITY_ORDER = { urgent: 0, normal: 1, low: 2 };
