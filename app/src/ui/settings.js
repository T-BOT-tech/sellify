// ui/settings.js
// Phase 7 extraction (see modularization plan §5): niche selection,
// business-model switching, and the Settings modal open/save — moved out
// of main.js unchanged. applyBusinessModelUI() calls switchTab('order')
// and ui/tabs.js's switchTab() doesn't call back in here, so that edge is
// one-directional; the only cycle is with ui/render.js (renderAll()),
// which — as elsewhere in this migration — is fine because it's only ever
// invoked from inside a function body, never at module-init time.
import { escapeHtml } from '../utils/index.js';
import { STORAGE_KEYS } from '../constants.js';
import { config, setConfig, currentStaff } from '../state.js';
import { saveJSON } from '../storage/json.js';
import {
  NICHE_PRESETS, getNichePreset, BUSINESS_MODELS, getBusinessModel, isRestaurant
} from '../config/niche.js';
import { renderPaymentMethodsSettings } from '../config/payment-methods.js';
import { renderProductFormSelects } from '../products/catalog.js';
import { renderCategoryPills } from '../products/search-filter.js';
import { renderCatalog } from '../products/catalog.js';
import { renderPricingTiersSettings, renderVolumeDiscountSettings } from '../b2b/ui.js';
import { renderOrderTableSelect, renderOrderCourseSelect } from '../restaurant/tables.js';
import { updateKitchenBadge } from '../restaurant/kitchen.js';
import { updateStorageInfoDisplay } from '../storage/persistence.js';
import { renderTenantSwitcher, listDevices, revokeDeviceById } from '../auth/tenant.js';
import { hasPermission } from '../auth/permissions.js';
import { getLang } from './i18n.js';
import { showToast } from './toast.js';
import { t } from './i18n.js';
import { switchTab } from './tabs.js';
import { renderAll } from './render.js';
import { applyStoreBranding } from './branding.js';
import { renderRoleAccessPanel, renderPermissionRoleScopeMatrix } from '../authorization/role-catalog.js';
import { renderScopeContextPanel } from '../authorization/scope-context.js';
import { renderConditionsApprovalPanel } from '../authorization/conditions-approval.js';
import { renderApprovalDelegationPanel } from '../authorization/approval-delegation.js';
import { renderIamCertificationPanel } from '../authorization/iam-certification.js';
import { renderMembershipAdministration } from '../authorization/membership-admin.js';
import { renderPackEntitlementPanel } from '../authorization/pack-entitlement.js';
import { renderPackReadinessPanel } from '../authorization/pack-readiness.js';
import { renderPackRecoveryPanel } from '../authorization/pack-recovery.js';
import { renderPackAuditPanel } from '../authorization/pack-audit.js';
import { renderPackSecurityPanel } from '../authorization/pack-security.js';
import { renderPackAccessibilityLocalizationPanel } from '../authorization/pack-accessibility-localization.js';
import { renderPackAnalyticsPanel } from '../authorization/pack-analytics.js';
import { renderPackExperimentationPanel } from '../authorization/pack-experimentation.js';
import { renderPackTraceabilityPanel } from '../authorization/pack-traceability.js';
import { renderCompliancePanel } from '../compliance/ui.js';
import { renderCustomerPricingPanel } from '../b2b/customer-pricing.js';
import { renderSellerStorefrontChannelsPanel } from '../channels/storefront.js';

export function renderNicheSelect() {
  const sel = document.getElementById('setNiche');
  if (!sel) return;
  const options = ['<option value="">— Choose your business type —</option>'];
  Object.keys(NICHE_PRESETS).forEach(key => {
    options.push(`<option value="${key}">${escapeHtml(NICHE_PRESETS[key].title)}</option>`);
  });
  sel.innerHTML = options.join('');
  sel.value = config.niche || '';
}

export function onNicheChange(nicheKey) {
  config.niche = nicheKey || '';
  saveJSON(STORAGE_KEYS.config, config);
  renderProductFormSelects();
  renderCategoryPills();
  renderCatalog();
  const preset = getNichePreset();
  if (preset) {
    showToast(`${preset.title} taxonomy applied ✅`);
  }
}

export function updateNicheFieldVisibility() {
  const wrap = document.getElementById('nicheFieldWrap');
  const modelSel = document.getElementById('setBusinessModel');
  const model = BUSINESS_MODELS[modelSel ? modelSel.value : config.businessModel] || BUSINESS_MODELS.retail;
  if (wrap) wrap.style.display = model.showNiche ? 'block' : 'none';
}

export function onBusinessModelChange(modelKey) {
  config.businessModel = BUSINESS_MODELS[modelKey] ? modelKey : 'retail';
  saveJSON(STORAGE_KEYS.config, config);
  updateNicheFieldVisibility();
  applyBusinessModelUI();
  showToast(`${getBusinessModel().label} mode applied ✅`);
}

export function applyBusinessModelUI() {
  const model = getBusinessModel();
  const restaurant = isRestaurant();

  const navTables = document.getElementById('navTables');
  const navKitchen = document.getElementById('navKitchen');
  if (navTables) navTables.style.display = restaurant ? '' : 'none';
  if (navKitchen) navKitchen.style.display = restaurant ? '' : 'none';

  const catalogLabel = document.getElementById('navCatalogLabel');
  if (catalogLabel) catalogLabel.textContent = model.catalogNav;
  const catalogHeading = document.querySelector('#tab-catalog h2');
  if (catalogHeading) catalogHeading.textContent = model.catalogHeading;
  const nameInput = document.getElementById('newProdName');
  if (nameInput) nameInput.placeholder = model.itemNamePlaceholder;

  const tableSelect = document.getElementById('orderTableSelect');
  if (tableSelect) {
    tableSelect.style.display = restaurant ? 'block' : 'none';
    if (restaurant) renderOrderTableSelect();
  }

  const courseSelect = document.getElementById('orderCourseSelect');
  if (courseSelect) {
    courseSelect.style.display = restaurant ? 'block' : 'none';
    if (restaurant) renderOrderCourseSelect();
  }

  // If we just left restaurant mode while on a restaurant-only tab, fall back to Order.
  const activeTables = document.getElementById('tab-tables');
  const activeKitchen = document.getElementById('tab-kitchen');
  if (!restaurant && ((activeTables && activeTables.style.display === 'block') || (activeKitchen && activeKitchen.style.display === 'block'))) {
    switchTab('order');
  }

  updateKitchenBadge();
}

export function openSettings() {
  document.getElementById('setSellerName').value = config.sellerName || '';
  document.getElementById('setSyncUrl').value = config.syncUrl || '';
  document.getElementById('setLang').value = getLang();
  const modelSel = document.getElementById('setBusinessModel');
  if (modelSel) modelSel.value = config.businessModel || 'retail';
  updateNicheFieldVisibility();
  renderNicheSelect();
  renderStorefrontBranding();
  renderRoleAccessPanel();
  renderPermissionRoleScopeMatrix().catch(() => {});
  renderScopeContextPanel().catch(() => {});
  renderConditionsApprovalPanel().catch(() => {});
  renderApprovalDelegationPanel().catch(() => {});
  renderIamCertificationPanel().catch(() => {});
  renderPackEntitlementPanel();
  renderPackReadinessPanel();
  renderPackRecoveryPanel();
  renderPackAuditPanel().catch(() => {});
  renderPackSecurityPanel();
  renderPackAccessibilityLocalizationPanel();
  renderPackAnalyticsPanel().catch(() => {});
  renderPackExperimentationPanel();
  renderPackTraceabilityPanel();
  renderMembershipAdministration().catch(() => {});
  renderCompliancePanel().catch(() => {});
  renderCustomerPricingPanel();
  renderSellerStorefrontChannelsPanel().catch(() => {});

  const codeSel = document.getElementById('setCurrencyCode');
  const symInput = document.getElementById('setCurrencySymbol');
  codeSel.dataset.currencyHydrated = 'false';
  codeSel.dataset.currencyEdited = 'false';
  codeSel.value = /^[A-Z]{3}$/.test(String(config.currencyCode || '').toUpperCase()) ? String(config.currencyCode).toUpperCase() : 'ETB';
  symInput.value = config.currencySymbol || '';
  symInput.style.display = 'block';
  // A saved device setting is only a cache. Hydrate the active business's
  // canonical organization currency before treating a selection as intent.
  if (config.chatId && config.sessionToken) {
    const activeChatId = String(config.chatId);
    const activeSessionToken = String(config.sessionToken);
    const base = (config.syncUrl || window.location.origin).replace(/\/$/, '');
    fetch(`${base}/tenants/${encodeURIComponent(activeChatId)}`, {
      headers: { Authorization: `Bearer ${activeSessionToken}` },
    }).then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `Currency load failed (${res.status})`);
      if (String(config.chatId) !== activeChatId || String(config.sessionToken) !== activeSessionToken) return;
      const canonicalCode = String(data?.tenant?.currency || data?.tenant?.branding?.currency || 'ETB').toUpperCase();
      if (!/^[A-Z]{3}$/.test(canonicalCode)) return;
      codeSel.dataset.currencyHydrated = 'true';
      if (codeSel.dataset.currencyEdited !== 'true') {
        codeSel.value = canonicalCode;
        setConfig({ ...config, currencyCode: canonicalCode, branding: data.tenant?.branding || config.branding || {} });
        saveJSON(STORAGE_KEYS.config, config);
      }
    }).catch(() => {
      // Keep cached settings visible offline, but saveSettings will not use
      // an unverified cached value to change the canonical business currency.
    });
  }

  renderPaymentMethodsSettings();

  const wholesaleCheckbox = document.getElementById('setWholesaleEnabled');
  if (wholesaleCheckbox) wholesaleCheckbox.checked = !!config.wholesaleEnabled;
  const tierSection = document.getElementById('wholesaleTierSection');
  if (tierSection) tierSection.style.display = config.wholesaleEnabled ? 'block' : 'none';
  renderPricingTiersSettings();

  const volDiscountCheckbox = document.getElementById('setVolumeDiscountEnabled');
  if (volDiscountCheckbox) volDiscountCheckbox.checked = !!config.volumeDiscountEnabled;
  const volDiscountSection = document.getElementById('volumeDiscountSection');
  if (volDiscountSection) volDiscountSection.style.display = config.volumeDiscountEnabled ? 'block' : 'none';
  renderVolumeDiscountSettings();

  const warehouseCheckbox = document.getElementById('setWarehouseEnabled');
  if (warehouseCheckbox) warehouseCheckbox.checked = !!config.warehouseEnabled;

  const logisticsCheckbox = document.getElementById('setLogisticsEnabled');
  if (logisticsCheckbox) logisticsCheckbox.checked = !!config.logisticsEnabled;

  document.getElementById('settingsModal').classList.add('open');
  updateStorageInfoDisplay();
  renderTenantSwitcher().catch(() => {}); // best-effort; current-business line still renders from local config on failure
  renderDeviceList().catch(() => {}); // best-effort; see function body for the offline/no-session cases it already handles without throwing
}

// Owner/manager-only list of every device paired to this business, each
// with a "Revoke" button — the counterpart to the "Add device" pairing
// code generator right above it in the Settings markup. A device can
// always see and revoke *itself* here too (signing this browser out),
// even on a cashier/staff session — see revokeDeviceInList()'s
// self-vs-other split, which mirrors the same rule the backend enforces
// in POST /auth/devices/revoke.
export async function renderDeviceList() {
  const wrap = document.getElementById('deviceListWrap');
  const list = document.getElementById('deviceList');
  const status = document.getElementById('deviceListStatus');
  if (!wrap || !list) return;

  // No session at all (standalone device that's never paired, or a
  // pre-auth install) — nothing to list, hide the section entirely
  // rather than show an empty list with a confusing "no devices" state.
  if (!config.sessionToken) { wrap.style.display = 'none'; return; }

  const canManageOthers = hasPermission(currentStaff.role, 'devices:manage');
  wrap.style.display = 'block';
  if (status) status.textContent = 'Loading devices…';
  list.innerHTML = '';

  let devices = [];
  try {
    devices = await listDevices(config.chatId);
  } catch (error) {
    // Owner/manager-only endpoint on the backend — a cashier/staff role
    // hitting this without devices:manage gets a 403, which is expected,
    // not a real error. Anything else (offline, expired token) also just
    // hides the list rather than showing a scary error in Settings.
    wrap.style.display = canManageOthers ? 'block' : 'none';
    if (status) status.textContent = canManageOthers ? 'Could not load devices right now.' : '';
    return;
  }

  if (status) status.textContent = '';
  if (!devices.length) {
    list.innerHTML = '<div class="hint">No paired devices yet.</div>';
    return;
  }

  list.innerHTML = devices.map(d => {
    const isThisDevice = config.deviceId && d.id === config.deviceId;
    const seen = d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : '—';
    const statusLabel = d.status === 'revoked'
      ? 'Revoked'
      : d.hasLiveSession ? 'Active' : 'Signed out (expired)';
    // Only a live, non-revoked device is worth offering a Revoke button
    // for — revoking an already-expired/revoked one would just be a
    // confusing no-op click.
    const canRevoke = d.hasLiveSession && (canManageOthers || isThisDevice);
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);gap:8px;">
        <div style="min-width:0;">
          <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(d.name || 'Unnamed device')}${isThisDevice ? ' <span class="hint">(this device)</span>' : ''}</div>
          <div class="hint">${statusLabel} · last seen ${escapeHtml(seen)}</div>
        </div>
        ${canRevoke ? `<button class="btn-secondary" onclick="revokeDeviceInList('${d.id}')" style="flex-shrink:0;">Revoke</button>` : ''}
      </div>`;
  }).join('');
}

export async function revokeDeviceInList(deviceId) {
  const status = document.getElementById('deviceListStatus');
  const isSelf = config.deviceId && deviceId === config.deviceId;
  const confirmMsg = isSelf
    ? 'Sign out this device? You will need a new pairing code (or invite) to reconnect it.'
    : 'Revoke this device? It will be signed out immediately and will need a new pairing code (or invite) to reconnect.';
  if (!confirm(confirmMsg)) return;
  if (status) status.textContent = 'Revoking…';
  try {
    await revokeDeviceById(deviceId);
    if (isSelf) {
      // config.sessionToken is now dead on the server. Clear the local
      // auth fields (not the whole config — sellerName/currency/etc. are
      // still valid) and reload so the app re-runs its normal
      // no-valid-session bootstrap instead of continuing to send a token
      // the server will reject on every subsequent call.
      setConfig({ ...config, sessionToken: '', sessionExpiresAt: '', deviceId: '' });
      saveJSON(STORAGE_KEYS.config, config);
      window.location.reload();
      return;
    }
    await renderDeviceList();
    if (status) status.textContent = 'Device revoked.';
  } catch (error) {
    if (status) status.textContent = error.message || 'Could not revoke that device.';
  }
}

export function renderStorefrontBranding() {
  const branding = config.branding && typeof config.branding === 'object' ? config.branding : {};
  const name = document.getElementById('setBrandName');
  const color = document.getElementById('setBrandColor');
  const colorText = document.getElementById('setBrandColorText');
  const logo = document.getElementById('setBrandLogoUrl');
  if (!name) return;
  name.value = branding.business_name || config.sellerName || '';
  const primary = /^#[0-9a-fA-F]{6}$/.test(branding.primary_color || '') ? branding.primary_color : '#00897b';
  if (color) color.value = primary;
  if (colorText) colorText.value = primary.toUpperCase();
  if (logo) logo.value = branding.logo_url || '';
  updateBrandingPreview();
}

export function updateBrandingPreview() {
  const preview = document.getElementById('brandingPreview');
  const name = document.getElementById('setBrandName')?.value.trim() || 'Your business';
  const color = document.getElementById('setBrandColorText')?.value.trim() || '#00897B';
  const logo = document.getElementById('setBrandLogoUrl')?.value.trim();
  if (!preview) return;
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#00897B';
  preview.innerHTML = `<div class="branding-preview-bar" style="--preview-brand:${safeColor}">${logo ? `<img src="${logo.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" alt="" onerror="this.style.display='none'">` : ''}<strong>${escapeHtml(name)}</strong></div><div class="hint">Customer-facing preview</div>`;
}

export async function saveStorefrontBranding() {
  const status = document.getElementById('brandingSaveStatus');
  const name = document.getElementById('setBrandName')?.value.trim() || '';
  const color = document.getElementById('setBrandColorText')?.value.trim().toUpperCase() || '#00897B';
  const logo = document.getElementById('setBrandLogoUrl')?.value.trim() || '';
  if (!name) { if (status) status.textContent = 'Storefront name is required.'; return; }
  if (!/^#[0-9A-F]{6}$/.test(color)) { if (status) status.textContent = 'Use a 6-digit hex color, for example #00897B.'; return; }
  if (logo) {
    try { const u = new URL(logo); if (!['http:', 'https:'].includes(u.protocol)) throw new Error(); }
    catch { if (status) status.textContent = 'Logo URL must start with http:// or https://.'; return; }
  }
  if (!config.chatId || !config.sessionToken) { if (status) status.textContent = 'Sign in to a business before editing branding.'; return; }
  if (!hasPermission(config.tenantRole || currentStaff?.role, 'settings:configure')) { if (status) status.textContent = 'Only owners and managers can edit branding.'; return; }
  if (status) status.textContent = 'Saving branding…';
  try {
    const base = (config.syncUrl || window.location.origin).replace(/\/$/, '');
    const res = await fetch(`${base}/tenants/${encodeURIComponent(config.chatId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.sessionToken}` },
      body: JSON.stringify({ sellerName: name, branding: { business_name: name, primary_color: color, ...(logo ? { logo_url: logo } : {}) } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `Save failed (${res.status})`);
    const next = { ...config, sellerName: name, branding: data.tenant?.branding || { business_name: name, primary_color: color, ...(logo ? { logo_url: logo } : {}) } };
    setConfig(next);
    saveJSON(STORAGE_KEYS.config, next);
    applyStoreBranding(next.branding);
    renderAll();
    if (status) status.textContent = 'Branding saved ✓';
    showToast('Storefront branding saved ✓');
  } catch (error) {
    if (status) status.textContent = error.message || 'Could not save branding.';
  }
}

export function onCurrencyCodeChange() {
  const codeSel = document.getElementById('setCurrencyCode');
  const symInput = document.getElementById('setCurrencySymbol');
  if (codeSel) codeSel.dataset.currencyEdited = 'true';
  // A custom display symbol belongs to the previous currency choice.
  if (symInput) symInput.value = '';
}

export async function saveSettings() {
  const codeSel = document.getElementById('setCurrencyCode');
  const symInput = document.getElementById('setCurrencySymbol');
  const requestedCurrency = String(codeSel.value || '').toUpperCase();
  const currencyWasEdited = codeSel.dataset.currencyEdited === 'true';
  let canonicalCurrency = /^[A-Z]{3}$/.test(String(config.currencyCode || '').toUpperCase()) ? String(config.currencyCode).toUpperCase() : 'ETB';
  let canonicalBranding = config.branding || {};

  // Authenticated business currency always comes from the backend. Only an
  // explicit selector change may request a currency update; stale local
  // defaults must never silently rewrite an existing organization's currency.
  if (config.chatId && config.sessionToken) {
    try {
      const activeChatId = String(config.chatId);
      const activeSessionToken = String(config.sessionToken);
      const base = (config.syncUrl || window.location.origin).replace(/\/$/, '');
      const response = await fetch(`${base}/tenants/${encodeURIComponent(activeChatId)}`, {
        headers: { Authorization: `Bearer ${activeSessionToken}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || `Currency load failed (${response.status})`);
      if (String(config.chatId) !== activeChatId || String(config.sessionToken) !== activeSessionToken) {
        throw new Error('Active business changed. Reopen Settings and try again.');
      }
      canonicalCurrency = String(data?.tenant?.currency || data?.tenant?.branding?.currency || 'ETB').toUpperCase();
      canonicalBranding = data?.tenant?.branding || canonicalBranding;
      if (!/^[A-Z]{3}$/.test(canonicalCurrency)) throw new Error('The business has an invalid canonical currency.');
      if (currencyWasEdited && requestedCurrency && requestedCurrency !== canonicalCurrency) {
        const update = await fetch(`${base}/tenants/${encodeURIComponent(activeChatId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${activeSessionToken}` },
          body: JSON.stringify({ branding: { currency: requestedCurrency } }),
        });
        const updated = await update.json().catch(() => ({}));
        if (!update.ok) throw new Error(updated?.error?.message || `Currency update failed (${update.status})`);
        // A tenant switch may happen while the PATCH is in flight. Do not let
        // the old tenant's response overwrite the newly active local config.
        if (String(config.chatId) !== activeChatId || String(config.sessionToken) !== activeSessionToken) {
          throw new Error('Active business changed. Reopen Settings and try again.');
        }
        canonicalCurrency = String(updated?.tenant?.currency || updated?.tenant?.branding?.currency || requestedCurrency).toUpperCase();
        canonicalBranding = updated?.tenant?.branding || canonicalBranding;
      }
    } catch (error) {
      showToast(error.message || 'Could not verify the business currency. Nothing was saved.');
      return;
    }
  } else if (requestedCurrency && !/^[A-Z]{3}$/.test(requestedCurrency)) {
    showToast('Choose a valid three-letter currency code.');
    return;
  } else if (requestedCurrency) {
    canonicalCurrency = requestedCurrency;
  }

  const nicheSel = document.getElementById('setNiche');
  const modelSel = document.getElementById('setBusinessModel');
  setConfig({
    ...config,
    sellerName: document.getElementById('setSellerName').value.trim(),
    syncUrl: document.getElementById('setSyncUrl').value.trim(),
    lang: document.getElementById('setLang').value,
    businessModel: modelSel && BUSINESS_MODELS[modelSel.value] ? modelSel.value : (config.businessModel || 'retail'),
    niche: nicheSel ? nicheSel.value : (config.niche || ''),
    currencyCode: canonicalCurrency,
    currencySymbol: symInput.value.trim(),
    branding: canonicalBranding,
    paymentMethods: config.paymentMethods,
    wholesaleEnabled: !!(document.getElementById('setWholesaleEnabled') && document.getElementById('setWholesaleEnabled').checked),
    volumeDiscountEnabled: !!(document.getElementById('setVolumeDiscountEnabled') && document.getElementById('setVolumeDiscountEnabled').checked),
    warehouseEnabled: !!(document.getElementById('setWarehouseEnabled') && document.getElementById('setWarehouseEnabled').checked),
    logisticsEnabled: !!(document.getElementById('setLogisticsEnabled') && document.getElementById('setLogisticsEnabled').checked),
  });
  saveJSON(STORAGE_KEYS.config, config);
  document.getElementById('settingsModal').classList.remove('open');
  renderAll();
  showToast(t('settingsSaved'));
}
