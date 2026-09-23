// Phase 10.4 — Customer Domain.
//
// This is deliberately additive. Existing checkout fields (custName/custPhone)
// remain valid, while this module gives them a canonical local Customer record
// and an optional server synchronization path. No order, B2B, or auth rewrite.
import { config, customers, setCustomers } from './state.js';
import { STORAGE_KEYS } from './constants.js';
import { saveJSON } from './storage/json.js';
import { uid } from './utils/index.js';
import { authHeaders } from './auth/tenant.js';
import { hasPermission } from './auth/permissions.js';
import { currentStaff } from './state.js';
import { showToast } from './ui/toast.js';
import { enqueueEvent } from './sync/outbox.js';

function normalize(value = {}) {
  return {
    id: value.id || uid(),
    name: String(value.name || '').trim().slice(0, 200),
    phone: String(value.phone || '').trim().slice(0, 80),
    email: String(value.email || '').trim().slice(0, 254),
    address: String(value.address || '').trim().slice(0, 500),
    taxId: String(value.taxId || '').trim().slice(0, 120),
    notes: String(value.notes || '').trim().slice(0, 1000),
    customerType: value.customerType === 'business' ? 'business' : 'retail',
    status: value.status === 'inactive' ? 'inactive' : 'active',
    source: String(value.source || 'manual').trim().slice(0, 60) || 'manual',
    updatedAt: Date.now(),
  };
}

function persist() { saveJSON(STORAGE_KEYS.customers, customers); }

export function findCustomerById(id) {
  return customers.find(c => String(c.id) === String(id)) || null;
}

export function findCustomerByPhone(phone) {
  const clean = String(phone || '').trim();
  return clean ? customers.find(c => String(c.phone || '').trim() === clean && c.status !== 'inactive') || null : null;
}

export function findCustomerByContact(name, phone) {
  return findCustomerByPhone(phone) || customers.find(c => !phone && c.name && c.name.toLowerCase() === String(name || '').trim().toLowerCase() && c.status !== 'inactive') || null;
}

export function upsertLocalCustomer(input = {}) {
  const value = normalize(input);
  if (!value.name && !value.phone) return null;
  const existing = input.id ? findCustomerById(input.id) : findCustomerByContact(value.name, value.phone);
  if (existing) {
    Object.assign(existing, value, { id: existing.id, createdAt: existing.createdAt || Date.now() });
    persist();
    return existing;
  }
  const record = { ...value, createdAt: Date.now() };
  customers.unshift(record);
  setCustomers(customers);
  persist();
  return record;
}

export function deleteLocalCustomer(id) {
  const next = customers.filter(c => String(c.id) !== String(id));
  setCustomers(next); persist();
}

function baseUrl() { return (config.syncUrl || window.location.origin).replace(/\/$/, ''); }

async function api(path, options = {}) {
  const res = await fetch(`${baseUrl()}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Request failed (${res.status})`);
  return data;
}

export async function syncCustomer(customer) {
  if (!customer || !config.chatId || !config.sessionToken) return null;
  try {
    const data = await api(`/tenants/${encodeURIComponent(config.chatId)}/customers`, { method: 'POST', body: JSON.stringify(customer) });
    const remote = data.customer;
    if (remote) upsertLocalCustomer({ ...customer, id: remote.id, name: remote.name, phone: remote.phone, email: remote.email, address: remote.address, taxId: remote.taxId, notes: remote.notes, customerType: remote.customerType, status: remote.status, source: remote.source });
    return remote || null;
  } catch (error) {
    console.warn('[customers] offline/unavailable; keeping local customer', error);
    return null;
  }
}

export async function loadCustomers({ query = '' } = {}) {
  if (!config.chatId || !config.sessionToken) return customers;
  try {
    const data = await api(`/tenants/${encodeURIComponent(config.chatId)}/customers?q=${encodeURIComponent(query)}`);
    if (Array.isArray(data.customers)) {
      const byId = new Map(customers.map(c => [String(c.id), c]));
      data.customers.forEach(remote => byId.set(String(remote.id), { ...remote, id: String(remote.id) }));
      setCustomers([...byId.values()].sort((a,b) => Number(b.updatedAt || b.updated_at || 0) - Number(a.updatedAt || a.updated_at || 0)));
      persist();
    }
  } catch (error) { console.warn('[customers] could not refresh remote customers', error); }
  return customers;
}

export function openCustomerModal(id = '') {
  if (!hasPermission(currentStaff?.role || 'owner', 'customers:manage')) return;
  const modal = document.getElementById('customerModal');
  if (!modal) return;
  const c = id ? findCustomerById(id) : null;
  modal.dataset.customerId = c?.id || '';
  document.getElementById('customerNameInput').value = c?.name || '';
  document.getElementById('customerPhoneInput').value = c?.phone || '';
  document.getElementById('customerEmailInput').value = c?.email || '';
  document.getElementById('customerAddressInput').value = c?.address || '';
  document.getElementById('customerTaxIdInput').value = c?.taxId || '';
  document.getElementById('customerTypeInput').value = c?.customerType || 'retail';
  document.getElementById('customerNotesInput').value = c?.notes || '';
  modal.style.display = 'flex';
}

export function closeCustomerModal() { const modal = document.getElementById('customerModal'); if (modal) modal.style.display = 'none'; }

export async function saveCustomerModal() {
  const modal = document.getElementById('customerModal');
  const record = upsertLocalCustomer({
    id: modal?.dataset.customerId || undefined,
    name: document.getElementById('customerNameInput')?.value,
    phone: document.getElementById('customerPhoneInput')?.value,
    email: document.getElementById('customerEmailInput')?.value,
    address: document.getElementById('customerAddressInput')?.value,
    taxId: document.getElementById('customerTaxIdInput')?.value,
    customerType: document.getElementById('customerTypeInput')?.value,
    notes: document.getElementById('customerNotesInput')?.value,
    source: 'manual',
  });
  if (!record) { showToast('Customer name or phone is required.'); return; }
  enqueueEvent('customer.upsert', record, { aggregateType: 'customer', aggregateId: record.id });
  await syncCustomer(record);
  closeCustomerModal(); renderCustomers(); showToast('Customer saved.');
}

export async function renderCustomers() {
  const list = document.getElementById('customersList');
  if (!list) return;
  const query = document.getElementById('customerSearchInput')?.value || '';
  await loadCustomers({ query });
  const q = query.trim().toLowerCase();
  const rows = customers.filter(c => !q || [c.name,c.phone,c.email,c.taxId,c.address].some(v => String(v || '').toLowerCase().includes(q)));
  if (!rows.length) { list.innerHTML = '<div class="empty">No customers yet.</div>'; return; }
  list.innerHTML = rows.map(c => `<div class="table-row" style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px;border-bottom:1px solid var(--line);"><div><strong>${escapeHtmlSafe(c.name || 'Unnamed')}</strong><div class="sync-note">${escapeHtmlSafe(c.phone || c.email || '')}${c.customerType === 'business' ? ' · Business' : ''}</div></div><button type="button" class="btn-ghost" onclick="openCustomerModal('${escapeAttrSafe(c.id)}')">Edit</button></div>`).join('');
}
function escapeHtmlSafe(v) { return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); }
function escapeAttrSafe(v) { return escapeHtmlSafe(v); }
