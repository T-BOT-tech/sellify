// Tenant identity/session bootstrap for the authenticated seller surface.
// Telegram initData is the first-party identity proof; the backend exchanges
// it for a short-lived device session. Standalone devices use owner-approved
// one-time pairing codes. The PWA never stores or sends tenant-wide API keys.
import { STORAGE_KEYS } from '../constants.js';
import { config, setConfig, products, setProducts, orders, setOrders, staffList, setStaffList, currentStaff, setCurrentStaff, b2bAccounts, setB2bAccounts, customers, setCustomers, inventoryMovements, setInventoryMovements, organizationLocations, setOrganizationLocations, inventoryBalances, setInventoryBalances, outboxEvents, setOutboxEvents, pricingTiers, setPricingTiers, volumeDiscountTiers, setVolumeDiscountTiers, warehouseLocations, setWarehouseLocations, stockTransactions, setStockTransactions } from '../state.js';
import { saveJSON, saveJSONAsync, loadJSONAsync } from '../storage/json.js';
import { getActivePlatform } from '../platform/index.js';
import { uid } from '../utils/index.js';
import { toMinorUnits } from '../utils/money.js';
import { markCatalogDirty } from '../products/catalog.js';
import { guessLocationDefaults } from '../config/locale-defaults.js';
import { t } from '../ui/i18n.js';

function baseUrl() {
  return (config.syncUrl || window.location.origin).replace(/\/$/, '');
}

function initData() {
  const platform = getActivePlatform();
  return typeof platform.getInitData === 'function' ? platform.getInitData() : '';
}

async function request(path, options = {}) {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Request failed (${res.status})`);
  return data;
}

function persistAuth(data, membership = null) {
  const next = { ...config };
  if (data.session?.token) {
    next.sessionToken = data.session.token;
    next.sessionExpiresAt = data.session.expiresAt || '';
    next.chatId = data.session.chatId || membership?.chatId || next.chatId;
    next.tenantRole = data.session.role || membership?.role || 'owner';
    next.authRoles = Array.isArray(data.session.roles) ? data.session.roles : [next.tenantRole];
    next.contextualRoles = Array.isArray(data.session.contextualRoles) ? data.session.contextualRoles : [];
    // Needed so this device can recognize itself in the device list
    // (ui/settings.js's renderDeviceList) and self-revoke without an
    // owner/manager role — see server.js's handleRevokeDevice for the
    // matching self-vs-other check on the backend side.
    next.deviceId = data.session.deviceId || next.deviceId;
    next.organizationId = data.session.organizationId || next.organizationId || '';
    next.locationId = data.session.locationId || next.locationId || '';
  }
  if (data.user) next.authUser = data.user;
  if (membership) {
    next.chatId = membership.chatId;
    next.tenantId = membership.tenantId;
    next.tenantRole = membership.role;
    if (membership.sellerName) next.sellerName = membership.sellerName;
  }
  setConfig(next);
  saveJSON(STORAGE_KEYS.config, next);
  return next;
}

async function loadCanonicalTenantCurrency() {
  if (!config.chatId || !config.sessionToken) return null;
  const chatId = String(config.chatId);
  const sessionToken = String(config.sessionToken);
  try {
    const data = await request(`/tenants/${encodeURIComponent(chatId)}`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    // Ignore late responses from a business/session that is no longer active.
    if (String(config.chatId) !== chatId || String(config.sessionToken) !== sessionToken) return null;
    const currency = String(data?.tenant?.currency || data?.tenant?.branding?.currency || '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return null;
    const next = { ...config, currencyCode: currency, branding: data.tenant?.branding || config.branding || {} };
    setConfig(next);
    saveJSON(STORAGE_KEYS.config, next);
    return currency;
  } catch {
    // Keep the last known cache during offline startup; callers for a brand-new
    // business seed ETB first because that is the backend's canonical fallback.
    return null;
  }
}

function showWizard({ user, memberships = [] }) {
  const modal = document.getElementById('onboardingModal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.getElementById('onboardingTelegram')?.style.setProperty('display', 'block');
  document.getElementById('onboardingPair')?.style.setProperty('display', 'none');
  document.getElementById('onboardingInvite')?.style.setProperty('display', 'none');
  document.getElementById('onboardingFirstProduct')?.style.setProperty('display', 'none');
  document.getElementById('onboardingDone')?.style.setProperty('display', 'none');
  const tz = document.getElementById('onboardingTimezone');
  if (tz && !tz.value) tz.value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  // Best-effort country/currency prefill from the device's timezone — see
  // config/locale-defaults.js. Only fills blank fields, never overwrites
  // something the user already typed/picked (e.g. on a re-render after a
  // failed submit), and a miss just leaves the field at its plain default.
  const guessed = guessLocationDefaults();
  const countryInput = document.getElementById('onboardingCountry');
  if (countryInput && !countryInput.value && guessed.country) countryInput.value = guessed.country;
  const name = document.getElementById('onboardingUserName');
  if (name) name.textContent = user?.displayName || 'Telegram account';
  const existing = document.getElementById('onboardingExisting');
  const create = document.getElementById('onboardingCreate');
  if (memberships.length && existing && create) {
    existing.style.display = '';
    create.style.display = 'none';
    const select = document.getElementById('onboardingTenantSelect');
    if (select) {
      select.innerHTML = memberships.map(m => `<option value="${String(m.chatId).replace(/"/g, '&quot;')}">${String(m.sellerName || 'Unnamed business').replace(/</g, '&lt;')}</option>`).join('');
    }
  } else if (existing && create) {
    existing.style.display = 'none';
    create.style.display = '';
  }
}

export function closeOnboarding() {
  const modal = document.getElementById('onboardingModal');
  if (modal) modal.style.display = 'none';
}


const pendingBusinessTemplateKey = chatId =>
  `ledger_business_template_pending_v1:${encodeURIComponent(String(chatId))}`;

async function loadBusinessTemplateConfig() {
  if (!config.sessionToken || !config.chatId) return null;
  const chatId = String(config.chatId);
  const sessionToken = String(config.sessionToken);
  const stillActive = () =>
    String(config.chatId) === chatId && String(config.sessionToken) === sessionToken;
  try {
    const data = await request(`/tenants/${encodeURIComponent(chatId)}/business-template`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    // Do not let a late response from a previous tenant/session overwrite the
    // currently selected business on a device that switched while it was loading.
    if (!stillActive()) return null;
    const saved = data.businessTemplate;
    if (saved) {
      const next = { ...config, businessTemplate: saved.templateKey, businessTemplateSchemaVersion: saved.schemaVersion || 1 };
      setConfig(next);
      saveJSON(STORAGE_KEYS.config, next);
      // A canonical server value wins over any stale local retry marker.
      await saveJSONAsync(pendingBusinessTemplateKey(chatId), null);
      return saved;
    }

    // Retry only an explicitly recorded, tenant-scoped onboarding write. Never
    // infer server intent from the general device config cache.
    const pending = await loadJSONAsync(pendingBusinessTemplateKey(chatId), null);
    if (!stillActive()) return null;
    if (!pending || String(pending.tenantId) !== chatId || typeof pending.templateKey !== 'string') return null;
    await request(`/tenants/${encodeURIComponent(chatId)}/business-template`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ templateKey: pending.templateKey }),
    });
    if (!stillActive()) return null;
    const next = { ...config, businessTemplate: pending.templateKey, businessTemplateSchemaVersion: pending.schemaVersion || 1 };
    setConfig(next);
    saveJSON(STORAGE_KEYS.config, next);
    await saveJSONAsync(pendingBusinessTemplateKey(chatId), null);
    return { templateKey: pending.templateKey, schemaVersion: pending.schemaVersion || 1 };
  } catch {
    // Offline or an older backend: retain the tenant-scoped marker for a later retry.
    return null;
  }
}

const tenantStateKey = chatId => `ledger_tenant_state_v1:${encodeURIComponent(String(chatId))}`;
const tenantStateFields = [
  ['products', () => products, setProducts, STORAGE_KEYS.products, []],
  ['orders', () => orders, setOrders, STORAGE_KEYS.orders, []],
  ['staff', () => staffList, setStaffList, STORAGE_KEYS.staff, []],
  ['activeStaff', () => currentStaff, setCurrentStaff, STORAGE_KEYS.activeStaff, null],
  ['b2bAccounts', () => b2bAccounts, setB2bAccounts, STORAGE_KEYS.b2bAccounts, []],
  ['customers', () => customers, setCustomers, STORAGE_KEYS.customers, []],
  ['inventoryMovements', () => inventoryMovements, setInventoryMovements, STORAGE_KEYS.inventoryMovements, []],
  ['organizationLocations', () => organizationLocations, setOrganizationLocations, STORAGE_KEYS.organizationLocations, []],
  ['inventoryBalances', () => inventoryBalances, setInventoryBalances, STORAGE_KEYS.inventoryBalances, []],
  ['outboxEvents', () => outboxEvents, setOutboxEvents, STORAGE_KEYS.outboxEvents, []],
  ['pricingTiers', () => pricingTiers, setPricingTiers, STORAGE_KEYS.pricingTiers, []],
  ['volumeDiscountTiers', () => volumeDiscountTiers, setVolumeDiscountTiers, STORAGE_KEYS.volumeDiscounts, []],
  ['warehouseLocations', () => warehouseLocations, setWarehouseLocations, STORAGE_KEYS.warehouseLocations, []],
  ['stockTransactions', () => stockTransactions, setStockTransactions, STORAGE_KEYS.stockTransactions, []],
];

async function preserveTenantState(chatId) {
  const tenantId = String(chatId || '');
  if (!tenantId) return false;
  const state = Object.fromEntries(tenantStateFields.map(([name, getValue]) => [name, structuredClone(getValue())]));
  return saveJSONAsync(tenantStateKey(tenantId), { tenantId, state, updatedAt: Date.now() });
}

export async function restoreTenantStateForTenant(chatId) {
  const tenantId = String(chatId || '');
  if (!tenantId || String(config.chatId || '') !== tenantId) return false;
  const snapshot = await loadJSONAsync(tenantStateKey(tenantId), null);
  if (String(config.chatId || '') !== tenantId) return false;
  if (!snapshot || String(snapshot.tenantId) !== tenantId || !snapshot.state || typeof snapshot.state !== 'object') return false;

  // Persist the full target snapshot before exposing it in shared in-memory
  // state. If any write fails, roll back already-written shared keys so a
  // restart cannot hydrate a mixture of two businesses.
  const entries = tenantStateFields
    .filter(([name]) => Object.prototype.hasOwnProperty.call(snapshot.state, name))
    .map(([name, getValue, setter, storageKey]) => ({
      name, getValue, setter, storageKey,
      target: snapshot.state[name],
      previous: structuredClone(getValue()),
    }));
  const written = [];
  for (const entry of entries) {
    if (String(config.chatId || '') !== tenantId) {
      for (const prior of written.reverse()) await saveJSONAsync(prior.storageKey, prior.previous);
      return false;
    }
    const saved = await saveJSONAsync(entry.storageKey, entry.target);
    if (!saved) {
      let rollbackOk = true;
      for (const prior of written.reverse()) {
        if (!(await saveJSONAsync(prior.storageKey, prior.previous))) rollbackOk = false;
      }
      if (!rollbackOk) throw new Error('Could not roll back partially restored tenant state');
      throw new Error('Could not durably restore tenant state; synchronization was stopped');
    }
    written.push(entry);
  }
  if (String(config.chatId || '') !== tenantId) {
    let rollbackOk = true;
    for (const prior of written.reverse()) {
      if (!(await saveJSONAsync(prior.storageKey, prior.previous))) rollbackOk = false;
    }
    if (!rollbackOk) throw new Error('Could not roll back tenant state after identity changed');
    return false;
  }
  for (const entry of entries) entry.setter(entry.target);
  return true;
}

async function clearSharedTenantCaches() {
  for (const [, , setter, storageKey, emptyValue] of tenantStateFields) {
    setter(emptyValue);
    const saved = await saveJSONAsync(storageKey, emptyValue);
    if (!saved) {
      await restoreTenantStateForTenant(config.chatId);
      throw new Error('Could not safely clear local business data for tenant switch');
    }
  }
}

export async function selectOnboardingTenant() {
  const select = document.getElementById('onboardingTenantSelect');
  if (!select?.value) return;
  const data = await request('/auth/select-tenant', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.sessionToken}` },
    body: JSON.stringify({ chatId: select.value, deviceName: 'Telegram Mini App' }),
  });
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('sellify:tenant-changing'));
  if (config.chatId && !(await preserveTenantState(config.chatId))) {
    showToast(t('storageFull'));
    return;
  }
  await clearSharedTenantCaches();
  persistAuth(data, data.membership);
  await loadCanonicalTenantCurrency();
  await loadBusinessTemplateConfig();
  closeOnboarding();
  window.location.reload();
}

// Persistent tenant-switcher affordance (Settings header) — the fix for
// the silent single-tenant bypass: bootstrapTenantAuth() skips the wizard
// entirely once a user has exactly one membership, and stays skipped even
// after they pick up a second one (e.g. via submitSettingsInvite above), so
// nothing ever tells them which business they're currently in or offers a
// way off it. This renders on every Settings open — not gated behind
// onboarding — so the current business is always visible, and a switcher
// only appears once there's actually somewhere else to switch to.
export async function renderTenantSwitcher() {
  const current = document.getElementById('tenantSwitcherCurrent');
  const controls = document.getElementById('tenantSwitcherControls');
  const select = document.getElementById('tenantSwitcherSelect');
  const status = document.getElementById('tenantSwitcherStatus');
  if (!current) return;
  current.textContent = config.sellerName || 'No business selected';
  if (status) status.textContent = '';
  if (controls) controls.style.display = 'none';
  if (!config.sessionToken) return; // standalone/paired device with no session yet — nothing to switch between
  let memberships = [];
  try {
    memberships = (await request('/auth/tenants', { headers: authHeaders() })).memberships || [];
  } catch (error) {
    // Non-fatal: the current-business line above still renders correctly
    // from local config even if this fetch fails (offline, expired token).
    return;
  }
  if (memberships.length < 2 || !select || !controls) return;
  select.innerHTML = memberships.map(m => {
    const label = String(m.sellerName || 'Unnamed business').replace(/</g, '&lt;');
    const selected = m.chatId === config.chatId ? ' selected' : '';
    return `<option value="${String(m.chatId).replace(/"/g, '&quot;')}"${selected}>${label}${m.chatId === config.chatId ? ' (current)' : ''}</option>`;
  }).join('');
  controls.style.display = 'flex';
}

export async function switchActiveTenant() {
  const select = document.getElementById('tenantSwitcherSelect');
  const status = document.getElementById('tenantSwitcherStatus');
  const chatId = select?.value;
  if (!chatId) return;
  if (chatId === config.chatId) {
    if (status) status.textContent = "You're already viewing this business.";
    return;
  }
  if (status) status.textContent = 'Switching…';
  try {
    const data = await request('/auth/select-tenant', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ chatId, deviceName: 'Sellify device' }),
    });
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('sellify:tenant-changing'));
    if (config.chatId && !(await preserveTenantState(config.chatId))) {
      showToast(t('storageFull'));
      return;
    }
    await clearSharedTenantCaches();
    persistAuth(data, data.membership);
    await loadCanonicalTenantCurrency();
    await loadBusinessTemplateConfig();
    window.location.reload();
  } catch (error) {
    if (status) status.textContent = error.message || 'Could not switch businesses.';
  }
}

export async function createOnboardingTenant() {
  const sellerName = document.getElementById('onboardingBusinessName')?.value.trim();
  const templateSelect = document.getElementById('onboardingBusinessTemplate');
  const selectedTemplate = templateSelect?.value || 'retail-shop';
  const selectedTemplateOption = templateSelect?.selectedOptions?.[0];
  const businessType = selectedTemplateOption?.dataset?.businessType || document.getElementById('onboardingBusinessType')?.value || 'retail';
  const country = document.getElementById('onboardingCountry')?.value.trim() || '';
  const timezone = document.getElementById('onboardingTimezone')?.value || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const status = document.getElementById('onboardingStatus');
  if (!sellerName) {
    if (status) status.textContent = 'Business name is required.';
    return;
  }
  if (status) status.textContent = 'Creating your business…';
  try {
    const data = await request('/auth/tenants', {
      method: 'POST',
      body: JSON.stringify({ sellerName, businessType, country, timezone, deviceName: 'Telegram Mini App', challengeToken: window.__SELLIFY_ONBOARDING_CHALLENGE || '' }),
    });
    const persisted = persistAuth(data, data.membership);
    // New tenants use the same ETB fallback as the canonical organization row.
    const initialConfig = { ...persisted, currencyCode: 'ETB' };
    setConfig(initialConfig);
    saveJSON(STORAGE_KEYS.config, initialConfig);
    await loadCanonicalTenantCurrency();
    // Keep a local copy for fast startup, but make the tenant API authoritative
    // so the chosen template follows the business across paired devices.
    const nextConfig = { ...config, businessTemplate: selectedTemplate, businessTemplateSchemaVersion: 1 };
    setConfig(nextConfig);
    saveJSON(STORAGE_KEYS.config, nextConfig);
    let templateSyncError = null;
    const templateTenantId = String(config.chatId || '');
    const pendingTemplate = {
      tenantId: templateTenantId,
      templateKey: selectedTemplate,
      schemaVersion: 1,
      updatedAt: Date.now(),
    };
    try {
      if (!templateTenantId || !(await saveJSONAsync(pendingBusinessTemplateKey(templateTenantId), pendingTemplate))) {
        throw new Error('Could not persist pending business template sync');
      }
      await request(`/tenants/${encodeURIComponent(templateTenantId)}/business-template`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ templateKey: selectedTemplate }),
      });
      if (String(config.chatId || '') !== templateTenantId) {
        throw new Error('Business changed before template sync completed');
      }
      await saveJSONAsync(pendingBusinessTemplateKey(templateTenantId), null);
    } catch (error) {
      templateSyncError = error;
    }
    showFirstProductStep(sellerName);
    if (templateSyncError && status) {
      status.textContent = 'Business created, but its template could not sync to the server. Check your connection and retry template setup in Settings.';
    }
  } catch (error) {
    if (status) status.textContent = error.message || 'Could not create the business.';
  }
}

// Step 5 of the wizard: optional, skippable first product. Deliberately
// not routed through the main catalog form (addProduct() in
// products/catalog.js) — that form assumes the rest of the app chrome is
// already rendered, which isn't true yet mid-onboarding. This writes the
// same minimal product shape directly.
function showFirstProductStep(sellerName) {
  const modal = document.getElementById('onboardingModal');
  if (!modal) return;
  document.getElementById('onboardingTelegram')?.style.setProperty('display', 'none');
  document.getElementById('onboardingPair')?.style.setProperty('display', 'none');
  document.getElementById('onboardingInvite')?.style.setProperty('display', 'none');
  const step = document.getElementById('onboardingFirstProduct');
  if (step) step.style.display = 'block';
  const heading = document.getElementById('onboardingFirstProductBiz');
  if (heading) heading.textContent = sellerName || '';
  const status = document.getElementById('onboardingStatus');
  if (status) status.textContent = '';
}

export function applyOnboardingBusinessTemplate(template) {
  const select = document.getElementById('onboardingBusinessTemplate');
  const option = select?.selectedOptions?.[0];
  const businessType = option?.dataset?.businessType || 'other';
  const legacyType = document.getElementById('onboardingBusinessType');
  if (legacyType) legacyType.value = businessType;
}

export function toggleOnboardingItemType(itemType) {
  const isService = itemType === 'service';
  const stockWrap = document.getElementById('onboardingProdStockWrap');
  const nameLabel = document.getElementById('onboardingItemNameLabel');
  const nameInput = document.getElementById('onboardingProdName');
  if (stockWrap) stockWrap.style.display = isService ? 'none' : '';
  if (nameLabel) nameLabel.textContent = isService ? 'Service name' : 'Product name';
  if (nameInput) nameInput.placeholder = isService ? 'Haircut or consultation' : 'Coffee';
}

export async function addOnboardingProduct() {
  const nameInput = document.getElementById('onboardingProdName');
  const priceInput = document.getElementById('onboardingProdPrice');
  const stockInput = document.getElementById('onboardingProdStock');
  const itemType = document.getElementById('onboardingItemType')?.value === 'service' ? 'service' : 'product';
  const status = document.getElementById('onboardingStatus');
  const name = nameInput?.value.trim();
  const priceMajor = parseFloat(priceInput?.value);
  if (!name || !Number.isFinite(priceMajor) || priceMajor < 0) {
    if (status) status.textContent = 'Enter an item name and a valid price.';
    return;
  }
  const stockRaw = itemType === 'product' ? stockInput?.value.trim() : '';
  const stock = stockRaw ? Math.max(0, parseInt(stockRaw, 10) || 0) : undefined;
  const priceMinor = toMinorUnits(priceMajor, config.currencyCode);
  if (!Number.isSafeInteger(priceMinor) || priceMinor < 0 || priceMinor > 2147483647) {
    if (status) status.textContent = 'Price is outside the supported range for this business currency.';
    return;
  }
  const newProd = {
    id: uid(),
    name,
    item_type: itemType,
    price: priceMinor,
    _priceMinor: true,
    ...(itemType === 'product' && stock !== undefined ? { stock } : {}),
    updated_at: Date.now(),
  };
  setProducts([...products, newProd]);
  const locallySaved = await saveJSONAsync(STORAGE_KEYS.products, products);
  if (!locallySaved) {
    if (status) status.textContent = 'Local storage failed. The offering is only in this session; keep this page open and retry before leaving.';
    return;
  }
  await markCatalogDirty();
  showOnboardingDone();

  // The first offering is persisted before we attempt remote sync. Push it through
  // the canonical catalog endpoint now when online; the startup catalog pull
  // is not an upload path. Dynamic import avoids a static cycle because the
  // catalog sync module uses authHeaders from this module.
  if (!config.syncUrl || !config.chatId) {
    if (status) status.textContent = 'Saved on this device. Connect this business to sync the offering.';
    return;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (status) status.textContent = 'Saved on this device. You are offline; use Sync now when connected.';
    return;
  }
  try {
    const { syncCatalog } = await import('../sync/catalog.js');
    const syncMessage = await syncCatalog();
    // syncCatalog handles its own network errors and returns a translated
    // failure message instead of throwing. Detect that result explicitly so
    // onboarding never leaves the impression that a failed push succeeded.
    if (status) {
      status.textContent = syncMessage === t('catalogSyncFailed')
        ? 'Saved on this device, but not synced yet. Use Sync now to retry.'
        : (syncMessage || 'Offering sync attempted. Check Sync now if it is still pending.');
    }
  } catch {
    // Keep the local offering and dirty state. A later manual sync can retry.
    if (status) status.textContent = 'Saved on this device, but not synced yet. Use Sync now to retry.';
  }
}

export function skipOnboardingProduct() {
  showOnboardingDone();
}

function showOnboardingDone() {
  document.getElementById('onboardingFirstProduct')?.style.setProperty('display', 'none');
  const done = document.getElementById('onboardingDone');
  if (done) done.style.display = 'block';
  const name = document.getElementById('onboardingDoneBiz');
  if (name) name.textContent = config.sellerName || '';
}

export function finishOnboarding() {
  closeOnboarding();
  window.location.reload();
}


export async function pairThisDevice() {
  const token = document.getElementById('pairingCode')?.value.trim();
  const status = document.getElementById('onboardingStatus');
  if (!token) { if (status) status.textContent = 'Enter the pairing code from the owner device.'; return; }
  if (status) status.textContent = 'Connecting this device…';
  try {
    const data = await request('/auth/pair', {
      method: 'POST',
      body: JSON.stringify({ token, deviceName: 'Sellify web device' }),
    });
    persistAuth(data, data.membership);
    await loadCanonicalTenantCurrency();
    await loadBusinessTemplateConfig();
    closeOnboarding();
    window.location.reload();
  } catch (error) {
    if (status) status.textContent = error.message || 'Could not pair this device.';
  }
}

export function showPairing() {
  const modal = document.getElementById('onboardingModal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.getElementById('onboardingTelegram')?.style.setProperty('display', 'none');
  document.getElementById('onboardingInvite')?.style.setProperty('display', 'none');
  document.getElementById('onboardingPair')?.style.setProperty('display', 'block');
  const create = document.getElementById('onboardingCreate');
  const existing = document.getElementById('onboardingExisting');
  if (create) create.style.display = 'none';
  if (existing) existing.style.display = 'none';
  const name = document.getElementById('onboardingUserName');
  if (name) name.textContent = 'Standalone / paired device';
}

// A staff member with their own Telegram account joins via an invite code
// (see createStaffInvite/acceptStaffInvite below) instead of pairing a
// device — this is the same "Welcome to Sellify" entry point, just a
// different identity path than "create a new business."
export function showJoinByInvite() {
  const modal = document.getElementById('onboardingModal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.getElementById('onboardingTelegram')?.style.setProperty('display', 'none');
  document.getElementById('onboardingPair')?.style.setProperty('display', 'none');
  document.getElementById('onboardingInvite')?.style.setProperty('display', 'block');
}

export async function submitStaffInvite() {
  const token = document.getElementById('staffInviteCode')?.value.trim();
  const status = document.getElementById('onboardingStatus');
  if (!token) { if (status) status.textContent = 'Enter the invite code from the owner.'; return; }
  if (status) status.textContent = 'Joining…';
  await acceptStaffInvite(token);
}

// Telegram-specific today: main.js's boot sequence now calls this based on
// the active adapter's authMode === 'silent' capability flag (see
// platform/telegram.js), not a hardcoded platform id — but this function's
// *implementation* still only knows Telegram's exchange (getInitData() +
// POST /auth/telegram, which verifies Telegram's HMAC signature scheme).
// When a second 'silent' adapter arrives, it won't have Telegram initData
// or match that endpoint's verification — this function will need to
// branch on getActivePlatform().id internally (or the exchange should move
// onto the adapter itself, e.g. platform.silentAuth(request)), not before.
export async function bootstrapTenantAuth() {
  if (config.sessionToken && config.sessionExpiresAt && Date.parse(config.sessionExpiresAt) > Date.now() + 30_000) {
    await loadCanonicalTenantCurrency();
    await loadBusinessTemplateConfig();
    return { authenticated: true };
  }
  const raw = initData();
  if (!raw) return { authenticated: false, reason: 'no-telegram-identity' };
  try {
    const data = await request('/auth/telegram', { method: 'POST', body: JSON.stringify({ initData: raw }) });
    const memberships = Array.isArray(data.memberships) ? data.memberships : [];
    if (data.session && memberships.length === 1) {
      persistAuth(data, memberships[0]);
      await loadCanonicalTenantCurrency();
      await loadBusinessTemplateConfig();
      return { authenticated: true };
    }
    if (data.challenge?.token) window.__SELLIFY_ONBOARDING_CHALLENGE = data.challenge.token;
    showWizard({ user: data.user, memberships });
    return { authenticated: false, onboarding: true };
  } catch (error) {
    console.error('[Auth] Telegram authentication failed:', error);
    const status = document.getElementById('onboardingStatus');
    if (status) status.textContent = error.message || 'Authentication failed.';
    showWizard({ user: null, memberships: [] });
    return { authenticated: false, error };
  }
}

export async function createDevicePairing(role = 'cashier') {
  const status = document.getElementById('pairingAdminStatus');
  try {
    const data = await request('/auth/pairing', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ role }),
    });
    if (status) status.textContent = `One-time code: ${data.token} (expires ${new Date(data.expiresAt).toLocaleTimeString()})`;
    return data;
  } catch (error) {
    if (status) status.textContent = error.message || 'Could not create pairing code.';
    return null;
  }
}

export function authHeaders() {
  return config.sessionToken ? { Authorization: `Bearer ${config.sessionToken}` } : {};
}

// Invites add a *person* (their own Telegram account) rather than a
// device — for staff who aren't standing next to the owner's phone to
// scan a pairing code. createStaffInvite is owner/manager-only, same as
// createDevicePairing; acceptStaffInvite is what the invited person runs
// from their own session.
export async function createStaffInvite(role = 'cashier') {
  const status = document.getElementById('pairingAdminStatus');
  try {
    const data = await request('/auth/invites', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ role }),
    });
    if (status) status.textContent = `Invite code: ${data.token} (expires ${new Date(data.expiresAt).toLocaleString()}) — send this to the staff member; they redeem it from their own Telegram account.`;
    return data;
  } catch (error) {
    if (status) status.textContent = error.message || 'Could not create invite.';
    return null;
  }
}

// statusElId lets callers target wherever the code was entered — the
// onboarding modal's shared status line during first-run join, or a
// Settings-local status line for submitSettingsInvite() below.
export async function acceptStaffInvite(token, statusElId = 'onboardingStatus') {
  const status = document.getElementById(statusElId);
  const raw = initData();
  if (!raw) { if (status) status.textContent = 'Open this invite link from within Telegram.'; return null; }
  try {
    const data = await request('/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token, initData: raw, deviceName: 'Telegram Mini App' }),
    });
    persistAuth(data, data.membership);
    await loadCanonicalTenantCurrency();
    // Redeeming an invite you're already covered by (same or lower role)
    // is a real outcome, not a generic success — say so instead of just
    // silently switching context. Give it a moment on screen before the
    // reload wipes the modal; ordinary first-time joins skip the delay.
    let delay = 0;
    if (status) {
      if (data.roleChanged) {
        status.textContent = `Your role here has been upgraded to ${data.membership?.role || 'a new role'}. Switching you in…`;
        delay = 1600;
      } else if (data.alreadyMember) {
        status.textContent = `You're already part of ${data.membership?.sellerName || 'this business'}. Switching you in…`;
        delay = 1600;
      }
    }
    const finish = () => { closeOnboarding(); window.location.reload(); };
    if (delay) setTimeout(finish, delay); else finish();
    return data;
  } catch (error) {
    if (status) status.textContent = error.message || 'Could not accept this invite.';
    return null;
  }
}

// Settings-side entry point for the gap flagged in the Milestone 2 review:
// a user who already has a session (owns or works at one business) has no
// onboarding path to redeem an invite into a *second* tenant, since the
// wizard is skipped entirely once they have exactly one membership. This
// hits the same /auth/accept-invite endpoint as the onboarding "Join with
// invite code" panel, just from Settings, with its own status line instead
// of the (hidden, closed) onboarding modal's. On success it switches the
// active session to the newly joined tenant, same as selectOnboardingTenant.
export async function submitSettingsInvite() {
  const token = document.getElementById('settingsInviteCode')?.value.trim();
  const status = document.getElementById('settingsInviteStatus');
  if (!token) { if (status) status.textContent = 'Enter the invite code you were sent.'; return; }
  if (status) status.textContent = 'Joining…';
  await acceptStaffInvite(token, 'settingsInviteStatus');
}

export async function listStaffInvites(chatId = config.chatId) {
  return (await request(`/tenants/${encodeURIComponent(chatId)}/invites`, { headers: authHeaders() })).invites;
}

export async function revokeStaffInvite(token) {
  return request('/auth/invites/revoke', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ token }) });
}

// ---------- paired devices ----------
// The owner/manager-facing counterpart to createDevicePairing() above:
// createDevicePairing() issues a *code* to bring a new device on; this
// section is for looking at devices already brought on and taking them
// back off. See ui/settings.js's renderDeviceList() for how this is
// rendered, and index.html's "Paired devices" block for the markup.

export async function listDevices(chatId = config.chatId) {
  return (await request(`/tenants/${encodeURIComponent(chatId)}/devices`, { headers: authHeaders() })).devices;
}

// deviceId === undefined revokes nothing — callers always pass an
// explicit id from a rendered list row, never a bare "current device"
// shorthand, so a stray call can't accidentally sign out the wrong thing.
export async function revokeDeviceById(deviceId) {
  if (!deviceId) throw new Error('deviceId is required');
  return request('/auth/devices/revoke', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ deviceId }) });
}
