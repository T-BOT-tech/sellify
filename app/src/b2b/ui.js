// b2b/ui.js
// Phase 6 extraction (see modularization plan §5): wholesale/B2B UI — the
// Order-tab account picker, the Accounts tab (list + add/edit modal), and
// the Settings-tab pricing-tier/volume-discount renderers — moved out of
// main.js unchanged.
//
// NOTE on the `../main.js` import below: switchTab, renderProducts,
// showToast, and t all still live in main.js (or are re-exported through
// it) at this phase. Importing them back from main.js creates a harmless
// circular import, the same temporary pattern storage/json.js established —
// see that file for the fuller explanation.
import { escapeHtml, escapeAttr, uid } from '../utils/index.js';
import { b2bAccounts, setB2bAccounts, pricingTiers, volumeDiscountTiers, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import {
  selectedB2BAccountId, setSelectedB2BAccountId, isWholesaleEnabled,
  getB2BAccountById, saveB2BAccounts
} from './accounts.js';
import {
  getPricingTierById, savePricingTiers, saveVolumeDiscountTiers
} from './pricing.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { renderProducts } from '../products/render.js';
import { t } from '../ui/i18n.js';
import { switchTab } from '../ui/tabs.js';
import { showToast } from '../ui/toast.js';
import { renderPurchaseOrders, bindPurchaseOrderUI } from './purchase-orders.js';
import { renderCreditTerms, bindCreditTermsUI } from './credit-terms.js';
import { renderReceivables, bindReceivableUI } from './accounts-receivable.js';
import { renderInvoices, bindInvoiceUI } from './invoices.js';
import { renderQuotes, bindQuoteUI } from './quotes.js';
import { renderCustomerPricingPanel } from './customer-pricing.js';

export function applyWholesaleUI() {
  const enabled = isWholesaleEnabled();
  const navBtn = document.getElementById('navAccounts');
  if (navBtn) navBtn.style.display = enabled ? '' : 'none';

  const activeAccounts = document.getElementById('tab-accounts');
  if (!enabled && activeAccounts && activeAccounts.style.display === 'block') {
    switchTab('order');
  }
  renderOrderAccountSelect();
}

export function renderOrderAccountSelect() {
  const sel = document.getElementById('orderAccountSelect');
  if (!sel) return;
  if (!isWholesaleEnabled() || b2bAccounts.length === 0) {
    sel.style.display = 'none';
    setSelectedB2BAccountId(null);
    return;
  }
  sel.style.display = 'block';
  sel.innerHTML = `<option value="">${t('orderAccountNone')}</option>` +
    b2bAccounts.map(a => {
      const tier = getPricingTierById(a.pricing_tier_id);
      const tierLabel = tier ? ` — ${tier.name} (${tier.discountPct}% off)` : '';
      return `<option value="${a.id}" ${a.id === selectedB2BAccountId ? 'selected' : ''}>${escapeHtml(a.business_name)}${escapeHtml(tierLabel)}</option>`;
    }).join('');
}

export function onOrderAccountChange(val) {
  setSelectedB2BAccountId(val || null);
  renderProducts(); // recomputes prices for the newly selected account's tier and re-renders the summary
}

export function renderAccountTierOptions(selectEl, selectedTierId) {
  if (!selectEl) return;
  selectEl.innerHTML = `<option value="">${t('retailTierName')}</option>` +
    pricingTiers.map(tier => `<option value="${tier.id}" ${tier.id === selectedTierId ? 'selected' : ''}>${escapeHtml(tier.name)} (${tier.discountPct}% off)</option>`).join('');
}

export function renderAccounts() {
  const list = document.getElementById('accountsList');
  if (!list) return;
  if (b2bAccounts.length === 0) {
    list.innerHTML = `<div class="empty">No B2B accounts yet. Tap "+ Add account" to create one.</div>`;
    renderPurchaseOrders();
    renderCreditTerms();
    renderReceivables();
    renderInvoices();
    renderQuotes();
    return;
  }
  list.innerHTML = b2bAccounts.map(a => {
    const tier = getPricingTierById(a.pricing_tier_id);
    const tierLabel = tier ? `${escapeHtml(tier.name)} · ${tier.discountPct}% off` : t('retailTierName');
    return `
    <div class="table-card account-card">
      <div class="account-name">${escapeHtml(a.business_name)}</div>
      ${a.contact_name ? `<div class="account-contact">${escapeHtml(a.contact_name)}${a.phone ? ' · ' + escapeHtml(a.phone) : ''}</div>` : (a.phone ? `<div class="account-contact">${escapeHtml(a.phone)}</div>` : '')}
      <div class="account-tier-badge">${tierLabel}</div>
      ${a.notes ? `<div class="account-notes" title="${escapeAttr(a.notes)}">${escapeHtml(a.notes)}</div>` : ''}
      <div class="table-actions">
        <button type="button" class="table-edit" onclick="openAccountModal('edit', '${a.id}')">${t('edit')}</button>
        <button type="button" class="table-remove" onclick="removeAccount('${a.id}')">${t('remove')}</button>
      </div>
    </div>`;
  }).join('');
  renderPurchaseOrders();
  renderCreditTerms();
  renderReceivables();
  renderInvoices();
  renderQuotes();
  renderCustomerPricingPanel();
}

let accountModalEditingId = null;
export function openAccountModal(mode, accountId) {
  accountModalEditingId = mode === 'edit' ? accountId : null;
  const account = accountModalEditingId ? getB2BAccountById(accountModalEditingId) : null;
  document.getElementById('accountEditModalTitle').textContent = mode === 'edit' ? t('edit') + ': ' + (account ? account.business_name : '') : t('addAccount');
  document.getElementById('accountEditBusinessName').value = account ? account.business_name : '';
  document.getElementById('accountEditContactName').value = account ? (account.contact_name || '') : '';
  document.getElementById('accountEditPhone').value = account ? (account.phone || '') : '';
  document.getElementById('accountEditNotes').value = account ? (account.notes || '') : '';
  renderAccountTierOptions(document.getElementById('accountEditTier'), account ? account.pricing_tier_id : '');
  document.getElementById('accountEditModal').style.display = 'flex';
}

export function closeAccountModal() {
  document.getElementById('accountEditModal').style.display = 'none';
  accountModalEditingId = null;
}

// Phase 3 fix (see modularization plan §5, Phase 3): B2B account CRUD and
// pricing/volume-discount settings had no permission gate — grouped under
// a new b2b:manage permission (manager+), same treatment as
// paymethods:manage for payment methods.
export function saveAccountModal() {
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'b2b:manage')) return;
  const businessName = document.getElementById('accountEditBusinessName').value.trim();
  if (!businessName) { showToast(t('validNamePrice')); return; }
  const contactName = document.getElementById('accountEditContactName').value.trim();
  const phone = document.getElementById('accountEditPhone').value.trim();
  const notes = document.getElementById('accountEditNotes').value.trim();
  const tierId = document.getElementById('accountEditTier').value || undefined;

  if (accountModalEditingId) {
    setB2bAccounts(b2bAccounts.map(a => a.id === accountModalEditingId
      ? { ...a, business_name: businessName, contact_name: contactName || undefined, phone: phone || undefined, notes: notes || undefined, pricing_tier_id: tierId }
      : a));
  } else {
    b2bAccounts.push({
      id: uid(),
      business_name: businessName,
      contact_name: contactName || undefined,
      phone: phone || undefined,
      notes: notes || undefined,
      pricing_tier_id: tierId,
      created_at: Date.now()
    });
  }
  saveB2BAccounts();
  renderAccounts();
  renderOrderAccountSelect();
  closeAccountModal();
}

export function removeAccount(accountId) {
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'b2b:manage')) return;
  if (!confirm(t('confirmDeleteAccount'))) return;
  setB2bAccounts(b2bAccounts.filter(a => a.id !== accountId));
  saveB2BAccounts();
  if (selectedB2BAccountId === accountId) setSelectedB2BAccountId(null);
  renderAccounts();
  renderOrderAccountSelect();
  showToast(t('accountDeleted'));
}

// ---------- Wholesale / B2B: pricing tier settings ----------
export function renderPricingTiersSettings() {
  const container = document.getElementById('pricingTiersList');
  if (!container) return;
  if (pricingTiers.length === 0) {
    container.innerHTML = `<div class="hint">No tiers yet — add one below (e.g. "Wholesale", 15% off).</div>`;
    return;
  }
  container.innerHTML = pricingTiers.map((tier, idx) => `
    <div class="paymethod-row">
      <span class="pm-name">${escapeHtml(tier.name)} — ${tier.discountPct}% off</span>
      <button type="button" class="pm-remove" onclick="removePricingTier(${idx})" title="Remove"><svg class="icon icon-sm"><use href="#i-close"/></svg></button>
    </div>
  `).join('');
}

export function addPricingTier() {
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'b2b:manage')) return;
  const nameInput = document.getElementById('newTierName');
  const discInput = document.getElementById('newTierDiscount');
  const name = nameInput.value.trim();
  const discountPct = Math.max(0, Math.min(100, parseFloat(discInput.value) || 0));
  if (!name) return;
  pricingTiers.push({ id: 'tier_' + name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(), name, discountPct });
  savePricingTiers();
  nameInput.value = '';
  discInput.value = '';
  renderPricingTiersSettings();
}

export function removePricingTier(idx) {
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'b2b:manage')) return;
  const tier = pricingTiers[idx];
  if (!tier) return;
  const inUse = b2bAccounts.some(a => a.pricing_tier_id === tier.id);
  pricingTiers.splice(idx, 1);
  savePricingTiers();
  renderPricingTiersSettings();
  if (inUse) showToast(t('tierInUseWarning'));
}

export function onWholesaleToggle(checked) {
  document.getElementById('wholesaleTierSection').style.display = checked ? 'block' : 'none';
}

// ---------- Volume discounts: settings ----------
export function renderVolumeDiscountSettings() {
  const container = document.getElementById('volumeDiscountList');
  if (!container) return;
  if (volumeDiscountTiers.length === 0) {
    container.innerHTML = `<div class="hint">No quantity breaks yet — add one below (e.g. 10+ units, 5% off).</div>`;
    return;
  }
  const sorted = [...volumeDiscountTiers].sort((a, b) => a.minQty - b.minQty);
  container.innerHTML = sorted.map(tier => {
    const idx = volumeDiscountTiers.indexOf(tier);
    return `
    <div class="paymethod-row">
      <span class="pm-name">${tier.minQty}+ units — ${tier.discountPct}% off</span>
      <button type="button" class="pm-remove" onclick="removeVolumeDiscountTier(${idx})" title="Remove"><svg class="icon icon-sm"><use href="#i-close"/></svg></button>
    </div>`;
  }).join('');
}

export function addVolumeDiscountTier() {
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'b2b:manage')) return;
  const qtyInput = document.getElementById('newVolMinQty');
  const discInput = document.getElementById('newVolDiscount');
  const minQty = Math.max(1, parseInt(qtyInput.value, 10) || 0);
  const discountPct = Math.max(0, Math.min(100, parseFloat(discInput.value) || 0));
  if (!minQty || !discountPct) return;
  volumeDiscountTiers.push({ id: 'vd_' + minQty + '_' + Date.now(), minQty, discountPct });
  saveVolumeDiscountTiers();
  qtyInput.value = '';
  discInput.value = '';
  renderVolumeDiscountSettings();
}

export function removeVolumeDiscountTier(idx) {
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'b2b:manage')) return;
  volumeDiscountTiers.splice(idx, 1);
  saveVolumeDiscountTiers();
  renderVolumeDiscountSettings();
}

export function onVolumeDiscountToggle(checked) {
  document.getElementById('volumeDiscountSection').style.display = checked ? 'block' : 'none';
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { bindPurchaseOrderUI(); bindCreditTermsUI(); bindReceivableUI(); bindInvoiceUI(); bindQuoteUI(); }, { once: true }); else { bindPurchaseOrderUI(); bindCreditTermsUI(); bindReceivableUI(); bindInvoiceUI(); bindQuoteUI(); }
