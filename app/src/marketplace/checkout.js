// marketplace/checkout.js
// Phase 6 extraction (see modularization plan §5): the multi-vendor
// checkout modal (grouped by seller) and its three submit paths — Telegram
// WebApp sendData, direct API, local-queue fallback — moved out of main.js
// unchanged.
//
// NOTE on the `../main.js` import below: switchTab and showToast still live
// in main.js at this phase. Importing them back from main.js creates a
// harmless circular import, the same temporary pattern storage/json.js
// established — see that file for the fuller explanation.
//
// Phase 9 update (see modularization plan §5): the first submit path used
// to call `window.Telegram.WebApp.sendData` directly (a second copy of the
// same call orders/checkout.js made). It now reuses
// platform/telegram.js's submitOrder() through getActivePlatform() instead
// of duplicating the sendData/try-catch logic here — same for the buyer's
// name auto-fill, which used to read `window.TWA_CUSTOMER_NAME` directly.
import { uid, escapeHtml } from '../utils/index.js';
import { formatMoney } from '../utils/money.js';
import { STORAGE_KEYS } from '../constants.js';
import { config, currentStaff, orders } from '../state.js';
import { saveJSON } from '../storage/json.js';
import { idbGet, idbSet } from '../storage/idb.js';
import { marketplaceCart, setMarketplaceCart } from './cart.js';
import { marketplaceListings, renderMarketplace } from './listings.js';
import { getActivePlatform } from '../platform/index.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { switchTab } from '../ui/tabs.js';
import { showToast } from '../ui/toast.js';

export function openMarketCheckoutModal() {
  const entries = Object.values(marketplaceCart);
  if (entries.length === 0) return;

  const container = document.getElementById('marketCartGroupedContainer');
  const totalDisplay = document.getElementById('marketModalTotal');
  const custInput = document.getElementById('marketCustName');
  const parcelFields = document.getElementById('marketServiceDeliveryFields');
  const needsParcelDetails = entries.some(entry => {
    const listing = marketplaceListings.find(item => item.listing_id === entry.listing.listing_id) || entry.listing;
    return isParcelDeliveryListing(listing);
  });
  if (parcelFields) parcelFields.style.display = needsParcelDetails ? 'block' : 'none';
  for (const fieldId of ['marketServicePickup', 'marketServiceDestination']) {
    const field = document.getElementById(fieldId);
    if (field) field.required = needsParcelDetails;
  }

  const profile = getActivePlatform().getCustomerProfile();
  if (profile && profile.name && custInput && !custInput.value) {
    custInput.value = profile.name;
  }

  // Group items by vendor
  const grouped = {};
  let grandTotal = 0;
  let curr = 'ETB';

  entries.forEach(e => {
    const sId = e.listing.seller_id;
    const sName = e.listing.seller_name || 'Store';
    const vCode = e.listing.vendor_code || sId;
    curr = e.listing.currency || curr;

    if (!grouped[sId]) {
      grouped[sId] = { seller_name: sName, vendor_code: vCode, items: [], sub_total: 0 };
    }
    const itemTotal = e.qty * e.listing.price;
    grouped[sId].items.push({ name: e.listing.title, qty: e.qty, price: e.listing.price, total: itemTotal });
    grouped[sId].sub_total += itemTotal;
    grandTotal += itemTotal;
  });

  if (container) {
    container.innerHTML = Object.entries(grouped).map(([sId, g]) => `
      <div class="vendor-group-card">
        <div class="vendor-group-head">
          <span><svg class="icon icon-sm"><use href="#i-store"/></svg> ${escapeHtml(g.seller_name)} (${escapeHtml(g.vendor_code)})</span>
          <span style="color:var(--teal); font-family:var(--mono);">${formatMoney(g.sub_total)} ${curr}</span>
        </div>
        ${g.items.map(it => `
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
            <span>${it.qty}× ${escapeHtml(it.name)}</span>
            <span style="font-family:var(--mono);">${formatMoney(it.total)} ${curr}</span>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  if (totalDisplay) {
    totalDisplay.innerText = `${formatMoney(grandTotal)} ${curr}`;
  }

  document.getElementById('marketCheckoutModal').style.display = 'flex';
}

export function closeMarketCheckoutModal() {
  document.getElementById('marketCheckoutModal').style.display = 'none';
}

function isParcelDeliveryListing(listing) {
  const profile = String(listing?.service_profile || listing?.serviceProfile || '').trim().toUpperCase();
  return listing?.item_type === 'service' && ['B2C_DELIVERY', 'P2P_DELIVERY'].includes(profile);
}

const MARKETPLACE_INTENT_KEY = STORAGE_KEYS.marketplaceCheckoutIntents;

async function readPendingMarketplaceIntent() {
  try {
    const stored = await idbGet(MARKETPLACE_INTENT_KEY);
    if (stored) return stored;
  } catch (error) {}
  try { return JSON.parse(localStorage.getItem(MARKETPLACE_INTENT_KEY) || 'null'); }
  catch (error) { return null; }
}

async function writePendingMarketplaceIntent(intent) {
  try {
    await idbSet(MARKETPLACE_INTENT_KEY, intent);
    try { localStorage.removeItem(MARKETPLACE_INTENT_KEY); } catch (error) {}
  } catch (error) {
    localStorage.setItem(MARKETPLACE_INTENT_KEY, JSON.stringify(intent));
  }
}

async function clearPendingMarketplaceIntent() {
  try { await idbSet(MARKETPLACE_INTENT_KEY, null); } catch (error) {}
  try { localStorage.removeItem(MARKETPLACE_INTENT_KEY); } catch (error) {}
}

function cartMatchesIntent(intent) {
  if (!intent?.request || !Array.isArray(intent.request.items)) return false;
  const entries = Object.values(marketplaceCart);
  if (entries.length !== intent.request.items.length) return false;
  const requested = new Map(intent.request.items.map(item => [String(item.listing_id), item]));
  return entries.every(entry => {
    const item = requested.get(String(entry.listing.listing_id));
    return item && Number(item.qty) === Number(entry.qty);
  });
}

async function postMarketplaceCheckoutIntent(intent) {
  const syncBase = config.syncUrl || window.location.origin;
  const response = await fetch(`${syncBase.replace(/\/$/, '')}/api/marketplace/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': intent.idempotencyKey },
    body: JSON.stringify(intent.request),
  });
  if (!response.ok) {
    // A definitive client error did not create a checkout. Preserve intent on
    // timeouts/rate limits because the outcome may still be ambiguous.
    if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
      await clearPendingMarketplaceIntent();
    }
    throw Object.assign(new Error(`Marketplace checkout responded ${response.status}`), { status: response.status });
  }
  const order = await response.json();
  await clearPendingMarketplaceIntent();
  return order;
}

/** Retry the exact unresolved checkout with its original idempotency key. */
export async function retryPendingMarketplaceCheckouts() {
  const intent = await readPendingMarketplaceIntent();
  if (!intent?.idempotencyKey || !intent?.request) return null;
  try {
    const order = await postMarketplaceCheckoutIntent(intent);
    if (cartMatchesIntent(intent)) {
      setMarketplaceCart({});
      renderMarketplace();
    }
    showToast(`Marketplace order #${order.marketplace_order_id} recovered successfully.`);
    return order;
  } catch (error) {
    console.warn('Marketplace checkout recovery deferred:', error);
    return null;
  }
}

async function submitMarketplaceOrderOnce() {
  const entries = Object.values(marketplaceCart);
  if (entries.length === 0) return;

  // Do not create a second order while a prior checkout has an ambiguous outcome.
  if (await readPendingMarketplaceIntent()) {
    await retryPendingMarketplaceCheckouts();
    return;
  }

  const custName = (document.getElementById('marketCustName').value || '').trim() || 'Telegram Buyer';
  const custPhone = (document.getElementById('marketCustPhone').value || '').trim();
  const items = entries.map(e => {
    const listing = marketplaceListings.find(l => l.listing_id === e.listing.listing_id) || e.listing;
    return {
      listing_id: listing.listing_id,
      seller_id: listing.seller_id,
      item_id: listing.item_id,
      vendor_code: listing.vendor_code,
      name: listing.title,
      price: listing.price,
      qty: e.qty,
      category: listing.category,
      // Transport metadata only; backend catalog is authoritative.
      item_type: listing.item_type === 'service' ? 'service' : 'product',
    };
  });
  const parcelListing = entries
    .map(entry => marketplaceListings.find(item => item.listing_id === entry.listing.listing_id) || entry.listing)
    .find(isParcelDeliveryListing);
  let serviceDelivery = null;
  if (parcelListing) {
    const pickupDetails = (document.getElementById('marketServicePickup')?.value || '').trim();
    const destinationDetails = (document.getElementById('marketServiceDestination')?.value || '').trim();
    const customerNote = (document.getElementById('marketServiceNote')?.value || '').trim();
    if (!pickupDetails || !destinationDetails) {
      showToast('Enter pickup and destination details for parcel delivery.');
      return;
    }
    serviceDelivery = {
      pickup_details: pickupDetails,
      destination_details: destinationDetails,
      ...(customerNote ? { customer_note: customerNote } : {}),
    };
  }
  const request = {
    buyer_id: currentStaff ? currentStaff.id : 'web_user',
    customer_name: custName,
    customer_phone: custPhone,
    items,
    ...(serviceDelivery ? { service_delivery: serviceDelivery } : {}),
  };
  const intent = { idempotencyKey: 'marketplace-' + uid(), request, createdAt: Date.now() };

  // Telegram is a separate handoff. Never also POST via the API after sendData succeeds.
  const twaPayload = {
    type: 'marketplace',
    is_marketplace: true,
    idempotency_key: intent.idempotencyKey,
    customer_name: custName,
    customer_phone: custPhone,
    ...(serviceDelivery ? { service_delivery: serviceDelivery } : {}),
    total: items.reduce((sum, item) => sum + (item.qty * item.price), 0),
    items,
  };
  const twaResult = getActivePlatform().submitOrder(twaPayload);
  if (twaResult && twaResult.ok) {
    setMarketplaceCart({});
    closeMarketCheckoutModal();
    renderMarketplace();
    showToast('Marketplace order sent to Telegram for processing.');
    return;
  }

  // Persist the exact API request before the network side effect. If the
  // response is lost, retries reuse this key and payload after reload/reconnect.
  try {
    await writePendingMarketplaceIntent(intent);
  } catch (error) {
    showToast('Could not save checkout for safe retry. Please check device storage and try again.');
    return;
  }

  try {
    const order = await postMarketplaceCheckoutIntent(intent);
    setMarketplaceCart({});
    closeMarketCheckoutModal();
    renderMarketplace();
    showToast(`Master Order #${order.marketplace_order_id} split into ${order.sub_orders.length} tickets! ✅`);
    switchTab('queue');
  } catch (error) {
    console.warn('Marketplace checkout request did not complete:', error);
    if (Number(error?.status) >= 400 && Number(error?.status) < 500 && error.status !== 408 && error.status !== 429) {
      showToast(`Checkout was rejected (HTTP ${error.status}). Review your cart and try again.`);
      return;
    }
    showToast('Checkout outcome is pending. Your order is saved and will retry safely when online.');
  }
}

// Prevent rapid taps or concurrent UI events from creating separate intents
// before the durable pending-intent write has completed.
let marketplaceCheckoutSubmission = null;
export function submitMarketplaceOrder() {
  if (marketplaceCheckoutSubmission) return marketplaceCheckoutSubmission;
  marketplaceCheckoutSubmission = submitMarketplaceOrderOnce().finally(() => {
    marketplaceCheckoutSubmission = null;
  });
  return marketplaceCheckoutSubmission;
}
