// orders/checkout.js
// Phase 4 extraction (see modularization plan §5): order finalization — the
// Telegram Mini App checkout path and the local-queue saveOrder() path both
// funnel into the same `orders` array — moved out of main.js unchanged.
//
// Phase 9 update (see modularization plan §5): checkoutTelegramWebApp()
// still builds the order payload here (that part isn't Telegram-specific),
// but the buyer-profile lookup and the actual "send it" call now go through
// getActivePlatform() instead of reaching into `window.Telegram`/
// `window.TWA_USER` directly — see platform/telegram.js.
//
// NOTE on the setter calls below (setCurrentTenderedAmount, setPendingProofMeta,
// setSelectedOrderTableId, setSelectedOrderCourse, setSelectedB2BAccountId,
// setSelectedFulfillmentType): saveOrder() resets several pieces of
// in-progress-order state that live in other modules once the order is
// saved. currentTenderedAmount (orders/cart.js) and pendingProofMeta
// (orders/payment-proof.js) have setters from their Phase 4 homes.
// selectedOrderTableId / selectedOrderCourse (restaurant/tables.js),
// selectedB2BAccountId (b2b/accounts.js), and selectedFulfillmentType
// (logistics/fulfillment.js) have owned that state and its setters since
// Phase 6 — imported directly below as of Phase 8.
import { uid } from '../utils/index.js';
import { STORAGE_KEYS } from '../constants.js';
import {
  config, currentOrder, currentOrderNotes, currentStaff, orders,
  products, setCurrentOrder, setCurrentOrderNotes
} from '../state.js';
import { isRestaurant } from '../config/niche.js';
import { saveJSON } from '../storage/json.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { getB2BAccountById, isWholesaleEnabled, selectedB2BAccountId, setSelectedB2BAccountId } from '../b2b/accounts.js';
import { effectiveUnitPrice, getPricingTierById } from '../b2b/pricing.js';
import { isLogisticsEnabled, selectedFulfillmentType, setSelectedFulfillmentType } from '../logistics/fulfillment.js';
import { restaurantTables, saveTables, selectedOrderCourse, selectedOrderTableId, setSelectedOrderTableId, setSelectedOrderCourse } from '../restaurant/tables.js';
import { t } from '../ui/i18n.js';
import { renderAll } from '../ui/render.js';
import { switchTab } from '../ui/tabs.js';
import { showToast } from '../ui/toast.js';
import { currentTenderedAmount, setCurrentTenderedAmount } from './cart.js';
import { setPendingProofMeta } from './payment-proof.js';
// Phase 9 extraction (see modularization plan §5): checkoutTelegramWebApp()
// used to reach into `window.Telegram.WebApp` and `window.TWA_USER`/
// `window.TWA_CUSTOMER_NAME` directly for the buyer profile and the
// sendData call. Both now go through the active platform adapter — see
// platform/telegram.js for where that logic actually lives today.
import { getActivePlatform } from '../platform/index.js';
import { upsertLocalCustomer, syncCustomer } from '../customers.js';

export function checkoutTelegramWebApp() {
  const items = Object.entries(currentOrder).map(([id, qty]) => {
    const p = products.find(p => p.id === id);
    if (!p) return null;
    const note = currentOrderNotes[id];
    return { id: p.id, name: note ? `${p.name} (${note})` : p.name, qty, price: effectiveUnitPrice(p, qty) };
  }).filter(Boolean);
  if (items.length === 0) return;

  const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);
  const custNameInput = document.getElementById('custName').value.trim();
  const profile = getActivePlatform().getCustomerProfile();
  const custName = custNameInput || (profile && profile.name) || 'Telegram Customer';
  const custPhone = document.getElementById('custPhone').value.trim();

  const payload = {
    items,
    total,
    customer_name: custName,
    customer_phone: custPhone,
    customer_id: profile ? profile.id : null,
    source: 'Telegram Mini App (TWA)'
  };

  const result = getActivePlatform().submitOrder(payload);
  if (result && result.ok) {
    showToast("Order submitted to Telegram! 💬");
    recordTelegramSentOrder(items, total, custName, custPhone);
    return;
  }

  // Fallback: save to local queue
  saveOrder();
}

export function recordTelegramSentOrder(items, total, custName, custPhone) {
  const customerRecord = upsertLocalCustomer({
    name: document.getElementById('custName')?.value.trim(),
    phone: document.getElementById('custPhone')?.value.trim(),
    source: 'order',
  });
  const order = {
    id: uid(),
    ...(customerRecord ? { customer_id: customerRecord.id } : {}),
    items,
    total,
    customer_name: custName,
    customer_phone: custPhone,
    cash_tendered: null,
    change_due: null,
    payment_method_id: 'telegram',
    payment_method_name: 'Telegram',
    payment_proof: null,
    status: 'synced',
    source: 'Telegram Mini App (TWA)',
    created_at: Date.now(),
    created_by_role: currentStaff ? currentStaff.role : 'owner',
    created_by_user: currentStaff ? currentStaff.name : 'Owner',
    // Phase 4: item/total prices here are already integer minor units
    // (effectiveUnitPrice always returns minor units — see b2b/pricing.js)
    // — this marker tells the money migration (storage/migration.js) this
    // record never needs re-converting.
    _moneyMinor: true,
  };
  orders.unshift(order);
  saveJSON(STORAGE_KEYS.orders, orders);
  if (customerRecord) syncCustomer(customerRecord).catch(() => {});

  setCurrentOrder({});
  setCurrentOrderNotes({});
  setCurrentTenderedAmount(null);
  document.getElementById('custName').value = '';
  document.getElementById('custPhone').value = '';
  renderAll();
}

export function saveOrder(payMethodId, proofMeta) {
  const items = Object.entries(currentOrder).map(([id, qty]) => {
    const p = products.find(p => p.id === id);
    if (!p) return null; // product may have been removed (e.g. by a catalog sync) since it was added to the cart
    const note = currentOrderNotes[id];
    return { id: p.id, name: note ? `${p.name} (${note})` : p.name, qty, price: effectiveUnitPrice(p, qty) };
  }).filter(Boolean);
  if (items.length === 0) return;

  const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);

  let cashTendered = null;
  let changeDue = null;
  const resolvedMethodId = payMethodId || 'cash';
  const methodMeta = (config.paymentMethods || []).find(pm => pm.id === resolvedMethodId);
  if (!methodMeta || methodMeta.type === 'cash') {
    if (currentTenderedAmount !== null && !isNaN(currentTenderedAmount)) {
      // Phase 4: currentTenderedAmount is already an integer minor-unit
      // amount (converted once in orders/cart.js's onCashInput) — no
      // reparse needed here.
      cashTendered = currentTenderedAmount;
      changeDue = Math.max(0, cashTendered - total);
    }
  }

  const order = {
    id: uid(),
    items,
    total,
    customer_name: document.getElementById('custName').value.trim(),
    customer_phone: document.getElementById('custPhone').value.trim(),
    cash_tendered: cashTendered,
    change_due: changeDue,
    payment_method_id: resolvedMethodId,
    payment_method_name: methodMeta ? methodMeta.name : 'Cash',
    payment_proof: proofMeta || null,
    status: 'queued',
    created_at: Date.now(),
    created_by_role: currentStaff ? currentStaff.role : 'owner',
    created_by_user: currentStaff ? currentStaff.name : 'Owner',
    // Phase 4: see recordTelegramSentOrder's note above — every value on
    // this order is already an integer minor-unit amount at creation.
    _moneyMinor: true,
  };
  if (isRestaurant()) {
    const table = selectedOrderTableId ? restaurantTables.find(t => t.id === selectedOrderTableId) : null;
    order.table_id = table ? table.id : undefined;
    order.table_number = table ? table.number : undefined;
    order.kitchen_status = 'pending';
    order.priority = 'normal';
    order.course = selectedOrderCourse || undefined;
    if (table) {
      table.status = 'occupied';
      saveTables();
    }
  }
  if (isWholesaleEnabled() && selectedB2BAccountId) {
    const account = getB2BAccountById(selectedB2BAccountId);
    if (account) {
      const tier = getPricingTierById(account.pricing_tier_id);
      order.b2b_account_id = account.id;
      order.b2b_account_name = account.business_name;
      order.pricing_tier_id = tier ? tier.id : undefined;
      order.pricing_tier_name = tier ? tier.name : undefined;
    }
  }
  if (isLogisticsEnabled() && selectedFulfillmentType) {
    order.fulfillment_type = selectedFulfillmentType;
    order.fulfillment_status = 'pending';
    if (selectedFulfillmentType === 'delivery') {
      order.delivery_address = (document.getElementById('fulfillmentAddress').value || '').trim() || undefined;
    } else if (selectedFulfillmentType === 'pickup') {
      order.pickup_location = document.getElementById('fulfillmentPickupLocation').value || undefined;
    }
    const scheduledEl = document.getElementById('fulfillmentScheduledTime');
    order.scheduled_time = scheduledEl && scheduledEl.value ? scheduledEl.value : undefined;
  }
  orders.unshift(order);
  saveJSON(STORAGE_KEYS.orders, orders);

  setCurrentOrder({});
  setCurrentOrderNotes({});
  setCurrentTenderedAmount(null);
  setPendingProofMeta(null);
  setSelectedOrderTableId(null);
  setSelectedOrderCourse(null);
  setSelectedB2BAccountId(null);
  setSelectedFulfillmentType(null);
  document.getElementById('custName').value = '';
  document.getElementById('custPhone').value = '';
  renderAll();
  showToast(t('orderSaved'));
  switchTab('queue');
}
