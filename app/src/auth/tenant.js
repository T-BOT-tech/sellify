// Tenant identity/session bootstrap for the authenticated seller surface.
// Telegram initData is the first-party identity proof; the backend exchanges
// it for a short-lived device session. Standalone devices use owner-approved
// one-time pairing codes. The PWA never stores or sends tenant-wide API keys.
import { STORAGE_KEYS } from '../constants.js';
import { config, setConfig, products, setProducts } from '../state.js';
import { saveJSON } from '../storage/json.js';
import { getActivePlatform } from '../platform/index.js';
import { uid } from '../utils/index.js';
import { toMinorUnits } from '../utils/money.js';
import { markCatalogDirty } from '../products/catalog.js';
import { guessLocationDefaults } from '../config/locale-defaults.js';

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
  const currencySelect = document.getElementById('onboardingCurrency');
  if (currencySelect && guessed.currency && Array.from(currencySelect.options).some(o => o.value === guessed.currency)) {
    currencySelect.value = guessed.currency;
  }
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

export async function selectOnboardingTenant() {
  const select = document.getElementById('onboardingTenantSelect');
  if (!select?.value) return;
  const data = await request('/auth/select-tenant', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.sessionToken}` },
    body: JSON.stringify({ chatId: select.value, deviceName: 'Telegram Mini App' }),
  });
  persistAuth(data, data.membership);
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
    persistAuth(data, data.membership);
    window.location.reload();
  } catch (error) {
    if (status) status.textContent = error.message || 'Could not switch businesses.';
  }
}

export async function createOnboardingTenant() {
  const sellerName = document.getElementById('onboardingBusinessName')?.value.trim();
  const businessType = document.getElementById('onboardingBusinessType')?.value || 'retail';
  const country = document.getElementById('onboardingCountry')?.value.trim() || '';
  const currency = document.getElementById('onboardingCurrency')?.value || 'ETB';
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
      body: JSON.stringify({ sellerName, businessType, country, currency, timezone, deviceName: 'Telegram Mini App', challengeToken: window.__SELLIFY_ONBOARDING_CHALLENGE || '' }),
    });
    persistAuth(data, data.membership);
    showFirstProductStep(sellerName);
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

export function addOnboardingProduct() {
  const nameInput = document.getElementById('onboardingProdName');
  const priceInput = document.getElementById('onboardingProdPrice');
  const stockInput = document.getElementById('onboardingProdStock');
  const status = document.getElementById('onboardingStatus');
  const name = nameInput?.value.trim();
  const priceMajor = parseFloat(priceInput?.value);
  if (!name || !Number.isFinite(priceMajor) || priceMajor < 0) {
    if (status) status.textContent = 'Enter a product name and a valid price.';
    return;
  }
  const stockRaw = stockInput?.value.trim();
  const stock = stockRaw ? Math.max(0, parseInt(stockRaw, 10) || 0) : undefined;
  const newProd = {
    id: uid(),
    name,
    price: toMinorUnits(priceMajor, config.currencyCode),
    _priceMinor: true,
    stock,
    updated_at: Date.now(),
  };
  setProducts([...products, newProd]);
  saveJSON(STORAGE_KEYS.products, products);
  markCatalogDirty();
  showOnboardingDone();
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
  if (config.sessionToken && config.sessionExpiresAt && Date.parse(config.sessionExpiresAt) > Date.now() + 30_000) return { authenticated: true };
  const raw = initData();
  if (!raw) return { authenticated: false, reason: 'no-telegram-identity' };
  try {
    const data = await request('/auth/telegram', { method: 'POST', body: JSON.stringify({ initData: raw }) });
    const memberships = Array.isArray(data.memberships) ? data.memberships : [];
    if (data.session && memberships.length === 1) {
      persistAuth(data, memberships[0]);
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
