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
import { marketplaceCart, setMarketplaceCart } from './cart.js';
import { renderMarketplace } from './listings.js';
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

export async function submitMarketplaceOrder() {
  const entries = Object.values(marketplaceCart);
  if (entries.length === 0) return;

  const custName = (document.getElementById('marketCustName').value || '').trim() || 'Telegram Buyer';
  const custPhone = (document.getElementById('marketCustPhone').value || '').trim();

  const items = entries.map(e => ({
    listing_id: e.listing.listing_id,
    seller_id: e.listing.seller_id,
    // Phase 2: item_id is what the backend's /api/marketplace/checkout
    // actually looks products up by (seller_id + item_id against that
    // seller's own catalog) — it was missing from this payload entirely,
    // which would have made every real checkout fail once the backend
    // stopped silently accepting whatever the client sent. price is still
    // included for the Telegram/local-queue fallback paths below, which
    // don't get server-side revalidation, but the direct-API path ignores
    // it and recomputes from the seller's current catalog price instead.
    item_id: e.listing.item_id,
    vendor_code: e.listing.vendor_code,
    name: e.listing.title,
    price: e.listing.price,
    qty: e.qty,
    category: e.listing.category
  }));

  const total = entries.reduce((s, e) => s + (e.qty * e.listing.price), 0);

  // 1. If running in Telegram WebApp, sendData payload directly
  const twaPayload = {
    type: 'marketplace',
    is_marketplace: true,
    customer_name: custName,
    customer_phone: custPhone,
    total: total,
    items: items
  };
  const twaResult = getActivePlatform().submitOrder(twaPayload);
  if (twaResult && twaResult.ok) {
    setMarketplaceCart({});
    closeMarketCheckoutModal();
    renderMarketplace();
    showToast('Dispatched multi-vendor order to Telegram! 🚀');
    return;
  }

  // 2. Direct API Checkout
  const syncBase = config.syncUrl || window.location.origin;
  try {
    const res = await fetch(`${syncBase.replace(/\/$/, '')}/api/marketplace/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyer_id: currentStaff ? currentStaff.id : 'web_user',
        customer_name: custName,
        customer_phone: custPhone,
        items: items
      })
    });

    if (res.ok) {
      const order = await res.json();
      setMarketplaceCart({});
      closeMarketCheckoutModal();
      renderMarketplace();
      showToast(`Master Order #${order.marketplace_order_id} split into ${order.sub_orders.length} tickets! ✅`);
      switchTab('queue');
      return;
    }
  } catch (e) {
    console.warn('Network offline, queueing locally:', e);
  }

  // Fallback: save to local queue
  const localOrder = {
    id: 'MPO_' + uid(),
    items: items,
    total: total,
    customer_name: custName,
    customer_phone: custPhone,
    status: 'queued',
    created_at: Date.now(),
    created_by_role: 'buyer',
    created_by_user: custName,
    // Phase 4: items/total here are already integer minor units (from
    // e.listing.price, itself minor-unit per utils/money.js's convention).
    _moneyMinor: true,
  };
  orders.unshift(localOrder);
  saveJSON(STORAGE_KEYS.orders, orders);

  setMarketplaceCart({});
  closeMarketCheckoutModal();
  renderMarketplace();
  showToast('Multi-vendor order saved to local queue ✅');
  switchTab('queue');
}
