// FUX-55 — canonical seller storefront channel + Telegram seller configuration UI.
import { config } from '../state.js';
import { hasPermission } from '../auth/permissions.js';

const CAPABILITIES = ['browse','search','product','cart','checkout','order_status'];
function baseUrl() { return (config.syncUrl || window.location.origin).replace(/\/$/, ''); }
function authHeaders() { return { 'Content-Type': 'application/json', Authorization: `Bearer ${config.sessionToken}` }; }
function canManage() {
  return !!config.sessionToken && !!config.chatId &&
    hasPermission(config.tenantRole || config.role || 'owner', 'settings:configure');
}
function esc(value) {
  return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
async function api(path, options={}) {
  const res = await fetch(`${baseUrl()}${path}`, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Request failed (${res.status})`);
  return data;
}
export async function loadSellerStorefrontChannels() {
  if (!canManage()) return null;
  const [channels, telegram] = await Promise.all([
    api(`/tenants/${encodeURIComponent(config.chatId)}/storefront-channels`),
    api(`/tenants/${encodeURIComponent(config.chatId)}/telegram-storefront`),
  ]);
  return { channels: channels.channels || [], storefront: telegram.storefront || null };
}
export async function saveTelegramStorefront() {
  const status = document.getElementById('telegramStorefrontStatus');
  if (!canManage()) { if (status) status.textContent = 'Only owners and managers can configure channels.'; return; }
  const enteredRef = document.getElementById('telegramCredentialRef')?.value.trim() || '';
  const body = {
    botId: document.getElementById('telegramBotId')?.value.trim() || '',
    botUsername: document.getElementById('telegramBotUsername')?.value.trim() || '',
    ...(enteredRef ? { credentialRef: enteredRef } : {}),
    webappUrl: document.getElementById('telegramWebappUrl')?.value.trim() || '',
    status: document.getElementById('telegramStorefrontState')?.value || 'CONFIGURED',
    enabledCapabilities: [...document.querySelectorAll('[data-telegram-cap]:checked')].map(el => el.value),
  };
  if (enteredRef && !enteredRef.startsWith('secret://')) {
    if (status) status.textContent = 'Credential reference must use secret://. Never paste a raw Telegram bot token here.';
    return;
  }
  if (status) status.textContent = 'Saving…';
  try {
    const data = await api(`/tenants/${encodeURIComponent(config.chatId)}/telegram-storefront`, { method: 'PATCH', body: JSON.stringify(body) });
    renderTelegramStorefront(data.storefront);
    if (status) status.textContent = 'Telegram storefront configuration saved ✓';
  } catch (error) { if (status) status.textContent = error.message || 'Could not save Telegram configuration.'; }
}
export async function verifyTelegramStorefrontChannel() {
  const status = document.getElementById('telegramStorefrontStatus');
  if (!canManage()) { if (status) status.textContent = 'Only owners and managers can verify channels.'; return; }
  if (status) status.textContent = 'Verifying with Telegram…';
  try {
    const data = await api(`/tenants/${encodeURIComponent(config.chatId)}/telegram-storefront/verify`, { method: 'POST', body: '{}' });
    renderTelegramStorefront(data.storefront);
    if (status) status.textContent = 'Telegram bot verified ✓';
  } catch (error) { if (status) status.textContent = error.message || 'Telegram verification failed.'; }
}
export async function publishTelegramStorefrontChannel() {
  const status = document.getElementById('telegramStorefrontStatus');
  if (!canManage()) { if (status) status.textContent = 'Only owners and managers can publish channels.'; return; }
  if (status) status.textContent = 'Publishing…';
  try {
    const data = await api(`/tenants/${encodeURIComponent(config.chatId)}/telegram-storefront`, { method: 'PATCH', body: JSON.stringify({ status: 'PUBLISHED' }) });
    renderTelegramStorefront(data.storefront);
    if (status) status.textContent = 'Telegram storefront published ✓';
  } catch (error) { if (status) status.textContent = error.message || 'Could not publish Telegram storefront.'; }
}
export function renderTelegramStorefront(storefront) {
  const panel = document.getElementById('telegramStorefrontPanel');
  if (!panel) return;
  const s = storefront || {};
  const caps = Array.isArray(s.enabledCapabilities) ? s.enabledCapabilities : CAPABILITIES;
  const state = String(s.status || 'DRAFT').toUpperCase();
  const canPublish = ['VERIFIED','PUBLISHED','PAUSED'].includes(state);
  panel.innerHTML = `
    <div class="settings-section-label">Telegram seller channel</div>
    <div class="hint">Configure the canonical Telegram storefront channel. Sellify stores only a <code>secret://</code> credential reference; the actual bot token stays with the secure credential provider.</div>
    <label for="telegramBotId">Bot ID <span class="hint">(optional)</span></label>
    <input id="telegramBotId" value="${esc(s.botId || '')}" maxlength="120">
    <label for="telegramBotUsername">Bot username <span class="hint">(optional)</span></label>
    <input id="telegramBotUsername" value="${esc(s.botUsername || '')}" maxlength="120">
    <label for="telegramCredentialRef">Credential reference</label>
    <input id="telegramCredentialRef" value="" placeholder="${s.credentialRef ? 'Credential configured — enter a new secret:// reference only to replace it' : 'secret://telegram/your-reference'}" maxlength="512" autocomplete="off">
    <div class="hint">Do not enter a raw bot token. Leave blank to keep the existing configured reference.</div>
    <label for="telegramWebappUrl">Telegram Web App URL</label>
    <input id="telegramWebappUrl" type="url" value="${esc(s.webappUrl || '')}" maxlength="2048" placeholder="https://example.com/store">
    <label for="telegramStorefrontState">Channel state</label>
    <select id="telegramStorefrontState">
      <option value="DRAFT">DRAFT</option><option value="CONFIGURED">CONFIGURED</option><option value="PAUSED">PAUSED</option><option value="UNPUBLISHED">UNPUBLISHED</option>
    </select>
    <div class="hint">Verification is a separate server-authorized step. Publishing is allowed only after verification.</div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:10px 0;">
      ${CAPABILITIES.map(cap => `<label style="margin:0;"><input type="checkbox" data-telegram-cap value="${cap}" ${caps.includes(cap) ? 'checked' : ''}> ${esc(cap)}</label>`).join('')}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn-secondary" type="button" onclick="saveTelegramStorefront()">Save configuration</button>
      <button class="btn-secondary" type="button" onclick="verifyTelegramStorefrontChannel()">Verify bot</button>
      <button class="btn-primary" type="button" onclick="publishTelegramStorefrontChannel()" ${canPublish ? '' : 'disabled'}>Publish</button>
    </div>
    <div id="telegramStorefrontStatus" class="hint" role="status" aria-live="polite" style="margin-top:8px;"></div>`;
  const select = document.getElementById('telegramStorefrontState');
  if (select) select.value = ['DRAFT','CONFIGURED','PAUSED','UNPUBLISHED'].includes(state) ? state : 'CONFIGURED';
}
export async function renderSellerStorefrontChannelsPanel() {
  const panel = document.getElementById('sellerStorefrontChannelsPanel');
  if (!panel) return;
  if (!canManage()) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  panel.innerHTML = '<div class="hint">Loading seller channels…</div>';
  try {
    const data = await loadSellerStorefrontChannels();
    renderTelegramStorefront(data?.storefront);
  } catch (error) {
    panel.innerHTML = `<div class="settings-section-label">Seller channels</div><div class="hint">${esc(error.message || 'Could not load seller channels.')}</div>`;
  }
}
