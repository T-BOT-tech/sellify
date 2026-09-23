// orders/cart.js
// Phase 4 extraction (see modularization plan §5): the in-progress cart —
// quantity stepper, cash-tendered/change calculation, the sticky cart bar,
// and the order-summary panel — moved out of main.js unchanged.
// currentTenderedAmount is local cart state owned here and exported with a
// setter (Rule 1's pattern) since orders/checkout.js needs to reset it to
// null once an order is saved.
//
// NOTE on the imports below: this file and products/render.js import each
// other (patchProductCard here, updateOrderSummary there) — see
// products/render.js for why that's a genuine coupling, not an accident.
// It also imports checkoutTelegramWebApp from ./checkout.js purely to hand
// it to Telegram's MainButton.onClick as a callback reference; checkout.js
// does not import anything back from here except via that same kind of
// reference, so this edge is one-directional in practice even though both
// files are in `orders/`. effectiveUnitPrice and t still live in main.js at
// this phase (see storage/json.js for the circular-import-with-main
// explanation this reuses).
//
// Phase 9 update (see modularization plan §5): updateOrderSummary() used to
// show/hide/label Telegram's MainButton directly. That now goes through
// getActivePlatform().showPrimaryAction()/hidePrimaryAction() — a
// generalized "primary action button" any adapter can implement — instead
// of a raw `window.Telegram.WebApp.MainButton` check. The #twaCheckoutBtn
// visibility check just below it is intentionally left as a direct
// Telegram check — it wasn't one of the call sites this phase's
// modularization plan calls out for extraction (see the platform/telegram.js
// top-of-file comment for the same scoping note).
import { CS } from '../config/currency.js';
import { escapeHtml } from '../utils/index.js';
import { toMinorUnits, formatMoney } from '../utils/money.js';
import { products, currentOrder, currentOrderNotes } from '../state.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { effectiveUnitPrice } from '../b2b/pricing.js';
import { t } from '../ui/i18n.js';
import { patchProductCard } from '../products/render.js';
import { checkoutTelegramWebApp } from './checkout.js';
import { getActivePlatform } from '../platform/index.js';

export let currentTenderedAmount = null;
export function setCurrentTenderedAmount(next) { currentTenderedAmount = next; }

export function setCashTendered(val) {
  currentTenderedAmount = val;
  updateOrderSummary();
}

export function updateCartStickyBar(itemCount, total) {
  const bar = document.getElementById('cartStickyBar');
  if (!bar) return;
  const orderTab = document.getElementById('tab-order');
  const onOrderTab = orderTab && orderTab.style.display !== 'none';
  if (!onOrderTab || itemCount === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';
  // No i18n string here on purpose — the bar already has a cart icon and
  // the number reads fine on its own ("3" next to a cart glyph) without
  // adding an "item(s)" key across all 7 locales for one label.
  document.getElementById('cartStickyCount').textContent = `${itemCount}×`;
  document.getElementById('cartStickyTotal').textContent = `${CS()}${formatMoney(total)}`;
}

export function scrollToOrderSummary() {
  const target = document.getElementById('orderSummary');
  if (!target) return;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

export function onCashInput(valStr) {
  const trimmed = valStr.trim();
  if (trimmed === '') {
    currentTenderedAmount = null;
  } else {
    // Phase 4: the field is a major-unit text input (the cashier types
    // "500" or "19.99"); currentTenderedAmount itself is stored in
    // integer minor units like every other money value in the app, so it
    // converts once here at the input boundary.
    const parsed = parseFloat(trimmed);
    currentTenderedAmount = Number.isFinite(parsed) ? toMinorUnits(parsed) : NaN;
  }
  updateChangeDisplay();
  const buttons = document.querySelectorAll('.quick-cash-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
}

export function updateChangeDisplay() {
  const container = document.getElementById('changeDisplayContainer');
  if (!container) return;

  const items = Object.entries(currentOrder).map(([id, qty]) => {
    const p = products.find(p => p.id === id);
    return p ? { qty, price: effectiveUnitPrice(p, qty) } : null;
  }).filter(Boolean);

  const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);

  if (currentTenderedAmount === null || isNaN(currentTenderedAmount)) {
    container.innerHTML = '';
    return;
  }

  // Phase 4: both operands are already integer minor units — no reparse
  // needed (currentTenderedAmount was converted once, in onCashInput).
  const diff = currentTenderedAmount - total;

  if (diff >= 0) {
    container.innerHTML = `
      <div class="change-display ok">
        <span>${t('changeDue')}</span>
        <span class="amt">${CS()}${formatMoney(diff)}</span>
      </div>`;
  } else {
    container.innerHTML = `
      <div class="change-display warn">
        <span>${t('cashShort')}</span>
        <span><span class="amt">${CS()}${formatMoney(Math.abs(diff))}</span> <small style="font-size:11px; font-weight:600;">(${t('insufficientCash')})</small></span>
      </div>`;
  }
}

export function changeQty(productId, delta) {
  const newQty = Math.max(0, (currentOrder[productId] || 0) + delta);
  if (newQty === 0) { delete currentOrder[productId]; delete currentOrderNotes[productId]; }
  else currentOrder[productId] = newQty;
  patchProductCard(productId);
  updateOrderSummary();
}

export function updateOrderSummary() {
  const summary = document.getElementById('orderSummary');
  const saveBtn = document.getElementById('saveOrderBtn');
  const twaBtn = document.getElementById('twaCheckoutBtn');
  const items = Object.entries(currentOrder).map(([id, qty]) => {
    const p = products.find(p => p.id === id);
    if (!p) return null;
    const note = currentOrderNotes[id];
    return { name: note ? `${p.name} (${note})` : p.name, qty, price: effectiveUnitPrice(p, qty) };
  }).filter(Boolean);

  if (items.length === 0) {
    summary.style.display = 'none';
    saveBtn.disabled = true;
    if (twaBtn) twaBtn.style.display = 'none';
    getActivePlatform().hidePrimaryAction();
    currentTenderedAmount = null;
    updateCartStickyBar(0, 0);
    return;
  }
  const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);
  const totalItemCount = items.reduce((sum, i) => sum + i.qty, 0);
  updateCartStickyBar(totalItemCount, total);
  // Phase 4: currentTenderedAmount is stored in minor units; the input
  // field itself is a major-unit text field, so it's converted back for
  // display (fromMinorUnits) — using toMinorUnits' inverse rather than
  // showing the raw minor-unit integer in a field labeled with a
  // currency symbol.
  const tenderedVal = (currentTenderedAmount !== null && !isNaN(currentTenderedAmount))
    ? (currentTenderedAmount / 100)
    : '';
  // Quick-cash denomination buttons are major-unit currency notes
  // (₹50/₹100/...); converted to minor units once here so the comparison
  // against currentTenderedAmount and the value passed to setCashTendered
  // both stay in the same unit as everything else.
  const denominations = [50, 100, 200, 500, 1000].map(toMinorUnits);

  summary.style.display = 'block';
  summary.innerHTML = items.map(i =>
    `<div class="item-row" style="display:flex;justify-content:space-between;"><span>${i.qty} × ${escapeHtml(i.name)}</span><span>${CS()}${formatMoney(i.qty * i.price)}</span></div>`
  ).join('') +
  `<div class="total-row"><span>${t('total')}</span><span>${CS()}${formatMoney(total)}</span></div>` +
  `<div class="cash-calc">
    <div class="cash-title">${t('cashTendered')}</div>
    <div class="quick-cash-btns">
      <button type="button" class="quick-cash-btn ${currentTenderedAmount === total ? 'active' : ''}" onclick="setCashTendered(${total})">${t('exact')}</button>
      ${denominations.map(d => `<button type="button" class="quick-cash-btn ${currentTenderedAmount === d ? 'active' : ''}" onclick="setCashTendered(${d})">${CS()}${formatMoney(d)}</button>`).join('')}
    </div>
    <div class="cash-input-row">
      <input type="number" step="0.01" id="cashTenderedInput" placeholder="${t('tenderedPlaceholder')}" value="${tenderedVal}" oninput="onCashInput(this.value)">
    </div>
    <div id="changeDisplayContainer"></div>
  </div>`;
  saveBtn.disabled = false;

  // Telegram WebApp integration
  const isInsideTelegram = window.Telegram && window.Telegram.WebApp && (window.Telegram.WebApp.initData || window.Telegram.WebApp.version);
  if (twaBtn) {
    twaBtn.style.display = isInsideTelegram ? 'block' : 'none';
  }
  getActivePlatform().showPrimaryAction({
    label: `🛍️ Checkout (${formatMoney(total)} ${CS()})`,
    onClick: checkoutTelegramWebApp
  });

  updateChangeDisplay();
}
