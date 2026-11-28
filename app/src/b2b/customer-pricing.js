import { config, products, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { showToast } from '../ui/toast.js';
import { escapeHtml, escapeAttr } from '../utils/index.js';

function baseUrl() {
  return (config.syncUrl || window.location.origin).replace(/\/$/, '');
}

function headers() {
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.sessionToken };
}

function canManage() {
  return !!config.sessionToken && !!config.chatId
    && hasPermission(currentStaff?.role || config.tenantRole || config.role || 'owner', 'b2b:pricing:manage');
}

async function api(path, options = {}) {
  const res = await fetch(baseUrl() + path, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || ('Request failed (' + res.status + ')'));
  return data;
}

function customerOptions(customers = []) {
  const businessCustomers = customers.filter(customer =>
    String(customer?.customerType || customer?.customer_type || '').toLowerCase() === 'business'
      && String(customer?.status || 'active').toLowerCase() === 'active'
  );
  return '<option value="">Select business customer…</option>' + businessCustomers.map(customer =>
    '<option value="' + escapeAttr(customer.id) + '">'
      + escapeHtml(customer.name || customer.business_name || customer.id)
      + '</option>'
  ).join('');
}

function productOptions() {
  return '<option value="">Select product…</option>' + products.map(product =>
    '<option value="' + escapeAttr(product.id) + '">'
      + escapeHtml(product.name || product.id) + ' — ' + String(product.price ?? '')
      + '</option>'
  ).join('');
}

async function loadBusinessCustomers() {
  const select = document.getElementById('b2bPricingCustomer');
  const chatId = String(config.chatId || '');
  const sessionToken = String(config.sessionToken || '');
  if (!select || !chatId || !sessionToken) return;

  select.innerHTML = '<option value="">Loading business customers…</option>';
  try {
    // Customer pricing rules reference canonical customers.id values.
    // Legacy local B2B account records are tier-assignment records and are not valid
    // customer foreign keys for the canonical B2B pricing API.
    const data = await api('/tenants/' + encodeURIComponent(chatId) + '/customers?status=active&limit=200');
    if (String(config.chatId || '') !== chatId || String(config.sessionToken || '') !== sessionToken) return;
    select.innerHTML = customerOptions(Array.isArray(data.customers) ? data.customers : []);
  } catch (error) {
    if (String(config.chatId || '') !== chatId || String(config.sessionToken || '') !== sessionToken) return;
    select.innerHTML = '<option value="">Could not load business customers</option>';
    const list = document.getElementById('b2bCustomerPricingList');
    if (list) list.innerHTML = '<div class="hint">' + escapeHtml(error.message || 'Could not load business customers.') + '</div>';
  }
}

export async function loadCustomerPricing() {
  const list = document.getElementById('b2bCustomerPricingList');
  const chatId = String(config.chatId || '');
  const sessionToken = String(config.sessionToken || '');
  if (!list || !chatId || !sessionToken) return;
  list.innerHTML = '<div class="hint">Loading canonical customer pricing…</div>';
  try {
    const data = await api('/tenants/' + encodeURIComponent(chatId) + '/b2b/pricing?limit=200');
    // A tenant/session switch can occur while the request is in flight. Never
    // render one organization's negotiated prices in another tenant's panel.
    if (String(config.chatId || '') !== chatId || String(config.sessionToken || '') !== sessionToken) return;
    const rows = data.pricing || [];
    list.innerHTML = rows.length ? rows.map(rule =>
      '<div class="table-card">'
        + '<div class="account-name">' + escapeHtml(rule.customerName || rule.customerId)
        + ' · ' + escapeHtml(rule.productName || rule.productId) + '</div>'
        + '<div class="account-tier-badge">' + escapeHtml(String(rule.priceMinor))
        + ' ' + escapeHtml(rule.currency) + ' · ' + escapeHtml(rule.status) + '</div>'
        + '<div class="hint">' + escapeHtml(rule.updatedAt || rule.updated_at || '') + '</div>'
      + '</div>'
    ).join('') : '<div class="empty">No customer-specific pricing rules.</div>';
  } catch (error) {
    if (String(config.chatId || '') !== chatId || String(config.sessionToken || '') !== sessionToken) return;
    list.innerHTML = '<div class="hint">' + escapeHtml(error.message || 'Could not load pricing rules.') + '</div>';
  }
}

export async function saveCustomerPricing() {
  if (!canManage()) {
    showToast('B2B pricing management permission required');
    return;
  }
  const customerId = document.getElementById('b2bPricingCustomer')?.value || '';
  const productId = document.getElementById('b2bPricingProduct')?.value || '';
  const priceMinor = Number(document.getElementById('b2bPricingPrice')?.value);
  const reason = document.getElementById('b2bPricingReason')?.value.trim() || '';
  if (!customerId || !productId || !Number.isInteger(priceMinor) || priceMinor < 0) {
    showToast('Select a canonical business customer and product and enter a valid integer price');
    return;
  }
  try {
    await api('/tenants/' + encodeURIComponent(config.chatId) + '/b2b/pricing', {
      method: 'POST',
      body: JSON.stringify({ customerId, productId, priceMinor, reason }),
    });
    showToast('Customer pricing saved ✓');
    await loadCustomerPricing();
  } catch (error) {
    showToast(error.message || 'Could not save customer pricing');
  }
}

export function renderCustomerPricingPanel() {
  const panel = document.getElementById('b2bCustomerPricingPanel');
  if (!panel) return;
  if (!config.sessionToken || !config.chatId) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  panel.innerHTML = '<div class="settings-section-label">Customer-specific B2B pricing</div>'
    + '<div class="sync-note">Prices are stored and enforced by the canonical B2B pricing API. This panel does not create a local pricing ledger.</div>'
    + '<div class="customer-fields" style="margin-bottom:12px;">'
    + '<select id="b2bPricingCustomer">' + customerOptions() + '</select>'
    + '<select id="b2bPricingProduct">' + productOptions() + '</select>'
    + '<input id="b2bPricingPrice" type="number" min="0" step="1" placeholder="Price (minor units)">'
    + '<input id="b2bPricingReason" type="text" placeholder="Reason (optional)">'
    + '<button id="b2bPricingSave" class="btn-secondary" type="button" style="width:auto;padding:8px 12px;">Save price</button>'
    + '</div><div id="b2bCustomerPricingList" class="tables-grid"></div>';
  document.getElementById('b2bPricingSave')?.addEventListener('click', saveCustomerPricing);
  loadBusinessCustomers();
  loadCustomerPricing();
}
