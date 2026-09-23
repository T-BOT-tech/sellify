const params = new URLSearchParams(location.search);
const orderId = params.get('order') || '';
const token = params.get('token') || '';
const stateEl = document.getElementById('trackState');
const card = document.getElementById('trackCard');
document.getElementById('trackId').textContent = orderId ? `Order ${orderId.slice(0, 12)}…` : '';
let timer = null;
function esc(v) { const d = document.createElement('div'); d.textContent = String(v ?? ''); return d.innerHTML; }
function money(minor, currency) { const n = Number(minor || 0) / 100; try { return new Intl.NumberFormat(undefined, { style:'currency', currency:currency || 'ETB' }).format(n); } catch { return `${n.toFixed(2)} ${currency || 'ETB'}`; } }
function label(status) { return String(status || 'queued').replaceAll('_',' '); }
function render(data) {
  stateEl.textContent = `Overall status: ${label(data.status)}`;
  card.hidden = false;
  card.innerHTML = `<div class="track-status"><strong>${esc(label(data.status))}</strong><span>Updates automatically</span></div>${(data.sellers || []).map(s => `<div class="track-seller"><div><strong>${esc(s.seller_name)}</strong><div class="muted">${s.item_count} item${s.item_count === 1 ? '' : 's'}</div></div><div class="track-right"><span class="track-pill">${esc(label(s.status))}</span><strong>${money(s.total, s.currency)}</strong></div></div>`).join('')}`;
  if (['completed','cancelled'].includes(data.status) && timer) { clearInterval(timer); timer = null; }
}
async function load() {
  if (!orderId || !token) { stateEl.textContent = 'This tracking link is incomplete.'; return; }
  try {
    const res = await fetch(`/api/marketplace/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`, { headers:{Accept:'application/json'} });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || 'Order not found');
    render(data);
  } catch (e) { stateEl.textContent = e.message || 'Unable to load order status.'; }
}
load();
timer = setInterval(load, 10000);
