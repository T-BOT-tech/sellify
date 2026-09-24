import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { escapeHtml } from '../utils/index.js';

function baseUrl() {
  return (config.syncUrl || window.location.origin).replace(/\/$/, '');
}

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(config.sessionToken ? { Authorization: `Bearer ${config.sessionToken}` } : {}),
  };
}

async function request(path, options = {}) {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `Request failed (${res.status})`);
  return body;
}

function canView() {
  return Boolean(config.chatId && config.sessionToken && hasPermission(currentStaff?.role || 'owner', 'b2b:quotes:view'));
}

function canManage() {
  return Boolean(config.chatId && config.sessionToken && hasPermission(currentStaff?.role || 'owner', 'b2b:quotes:manage'));
}

export async function loadQuoteFormOptions() {
  const customerSelect = document.getElementById('b2bQuoteCustomer');
  const productSelect = document.getElementById('b2bQuoteProduct');
  if (!customerSelect || !productSelect || !canManage()) return;
  try {
    const [customerData, catalogData] = await Promise.all([
      request(`/tenants/${encodeURIComponent(config.chatId)}/customers?status=active&limit=200`),
      request(`/tenants/${encodeURIComponent(config.chatId)}/catalog`),
    ]);
    const customers = (customerData.customers || []).filter(c => String(c.customerType || '').toLowerCase() === 'business');
    const products = catalogData.products || [];
    customerSelect.innerHTML = '<option value="">Select business customer…</option>' +
      customers.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || c.id)}</option>`).join('');
    productSelect.innerHTML = '<option value="">Select product…</option>' +
      products.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name || p.id)} · ${escapeHtml(String(p.currency || ''))} ${Number(p.price ?? p.priceMinor ?? 0).toLocaleString()}</option>`).join('');
  } catch (error) {
    customerSelect.innerHTML = '<option value="">Could not load quote options</option>';
    productSelect.innerHTML = '<option value="">Could not load products</option>';
    throw error;
  }
}

export async function createQuoteFromUI() {
  if (!canManage()) return;
  const customerId = document.getElementById('b2bQuoteCustomer')?.value || '';
  const productId = document.getElementById('b2bQuoteProduct')?.value || '';
  const quantity = Number(document.getElementById('b2bQuoteQuantity')?.value || 0);
  const notes = document.getElementById('b2bQuoteNotes')?.value.trim() || '';
  const terms = document.getElementById('b2bQuoteTerms')?.value.trim() || '';
  if (!customerId || !productId || !Number.isInteger(quantity) || quantity <= 0) {
    throw new Error('Select a business customer, product, and positive whole quantity.');
  }
  await request(`/tenants/${encodeURIComponent(config.chatId)}/b2b/quotes`, {
    method: 'POST',
    body: JSON.stringify({ customerId, items: [{ productId, quantity }], notes, terms }),
  });
  document.getElementById('b2bQuoteQuantity').value = '1';
  document.getElementById('b2bQuoteNotes').value = '';
  document.getElementById('b2bQuoteTerms').value = '';
  await renderQuotes();
}

function transitionButtons(quote) {
  if (!canManage()) return '';
  const actions = [];
  if (quote.status === 'DRAFT') {
    actions.push(`<button type="button" data-quote-action="SENT" data-quote-id="${escapeHtml(quote.id)}">Send</button>`);
    actions.push(`<button type="button" class="table-remove" data-quote-action="CANCELLED" data-quote-id="${escapeHtml(quote.id)}">Cancel</button>`);
  } else if (quote.status === 'SENT') {
    actions.push(`<button type="button" data-quote-action="ACCEPTED" data-quote-id="${escapeHtml(quote.id)}">Accept</button>`);
    actions.push(`<button type="button" data-quote-action="REJECTED" data-quote-id="${escapeHtml(quote.id)}">Reject</button>`);
    actions.push(`<button type="button" class="table-remove" data-quote-action="CANCELLED" data-quote-id="${escapeHtml(quote.id)}">Cancel</button>`);
  }
  return actions.length ? `<div class="table-actions">${actions.join('')}</div>` : '';
}

export async function renderQuotes() {
  const list = document.getElementById('b2bQuotesList');
  if (!list) return;
  if (!canView()) {
    list.innerHTML = '<div class="empty">B2B quote access is not available for this role.</div>';
    return;
  }
  list.innerHTML = '<div class="empty">Loading quotes…</div>';
  try {
    const data = await request(`/tenants/${encodeURIComponent(config.chatId)}/b2b/quotes?limit=100`);
    const quotes = data.quotes || [];
    if (!quotes.length) {
      list.innerHTML = '<div class="empty">No quotes yet.</div>';
      return;
    }
    list.innerHTML = quotes.map(q => {
      const items = (q.items || []).map(item =>
        `${escapeHtml(item.description || item.productId)} × ${Number(item.quantity)}`
      ).join(', ');
      return `<div class="table-card account-card">
        <div class="account-name">${escapeHtml(q.quoteNumber)} · ${escapeHtml(q.status)}</div>
        <div class="account-contact">Customer ${escapeHtml(q.customerId)} · ${escapeHtml(q.currency)} ${Number(q.totalMinor).toLocaleString()}</div>
        <div class="account-notes">${items || 'No items'}${q.validUntil ? ` · Valid until ${escapeHtml(new Date(q.validUntil).toLocaleDateString())}` : ''}</div>
        ${q.notes ? `<div class="account-notes">${escapeHtml(q.notes)}</div>` : ''}
        ${transitionButtons(q)}
      </div>`;
    }).join('');
  } catch (error) {
    list.innerHTML = `<div class="empty">${escapeHtml(error.message || 'Could not load quotes.')}</div>`;
  }
}

export function bindQuoteUI() {
  const refresh = document.getElementById('b2bQuoteRefresh');
  const create = document.getElementById('b2bQuoteCreate');
  const list = document.getElementById('b2bQuotesList');
  if (refresh) refresh.addEventListener('click', () => renderQuotes());
  if (create) {
    create.addEventListener('click', () => createQuoteFromUI().catch(error => {
      list?.insertAdjacentHTML('afterbegin', `<div class="empty">${escapeHtml(error.message || 'Quote creation failed.')}</div>`);
    }));
  }
  if (list) {
    list.addEventListener('click', async event => {
      const button = event.target.closest('[data-quote-action]');
      if (!button || !canManage()) return;
      try {
        await request(`/tenants/${encodeURIComponent(config.chatId)}/b2b/quotes/${encodeURIComponent(button.dataset.quoteId)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: button.dataset.quoteAction }),
        });
        await renderQuotes();
      } catch (error) {
        list.insertAdjacentHTML('afterbegin', `<div class="empty">${escapeHtml(error.message || 'Quote update failed.')}</div>`);
      }
    });
  }
  loadQuoteFormOptions().catch(() => {});
}
