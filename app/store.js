import { applyTelegramBuyerChrome, getTelegramBuyerProfile, getTelegramInitData, isTelegramWebApp, hasTelegramCapability } from './src/telegram-buyer-storefront.js';

const state = { products: [], query: '', category: 'ALL', branding: null, cart: {}, storefront: null, telegram: false, telegramBuyer: null, orderIdempotencyKey: null };
const pathParts = location.pathname.split('/').filter(Boolean);
const chatId = pathParts[0] === 'store' ? decodeURIComponent(pathParts[1] || '') : new URLSearchParams(location.search).get('store') || '';

function esc(value) { const d = document.createElement('div'); d.textContent = String(value ?? ''); return d.innerHTML; }
function money(minor, currency) {
  const amount = Number(minor || 0) / 100;
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'ETB', maximumFractionDigits: 2 }).format(amount); }
  catch { return `${amount.toFixed(2)} ${currency || 'ETB'}`; }
}
function setBranding(b, sellerName) {
  state.branding = b || {};
  const name = state.branding.business_name || sellerName || 'Sellify Store';
  document.title = `${name} — Sellify`;
  document.getElementById('storeName').textContent = name;
  if (state.branding.primary_color && /^#[0-9a-f]{6}$/i.test(state.branding.primary_color)) {
    document.documentElement.style.setProperty('--brand', state.branding.primary_color);
  }
  if (state.branding.logo_url && /^https?:\/\//i.test(state.branding.logo_url)) {
    const img = document.getElementById('storeLogo'); img.src = state.branding.logo_url; img.style.display = 'block';
  }
}
function categories() { return ['ALL', ...new Set(state.products.map(p => p.category || 'General'))]; }
function renderPills() {
  document.getElementById('categoryPills').innerHTML = categories().map(cat => `<button class="pill ${cat === state.category ? 'active' : ''}" data-cat="${esc(cat)}">${esc(cat === 'ALL' ? 'All' : cat)}</button>`).join('');
  document.querySelectorAll('.pill').forEach(btn => btn.addEventListener('click', () => { state.category = btn.dataset.cat; render(); }));
}
function render() {
  renderPills();
  const q = state.query.toLowerCase();
  const filtered = state.products.filter(p => {
    const cat = p.category || 'General';
    return (state.category === 'ALL' || cat === state.category) && (!q || `${p.name} ${cat} ${(p.tags || []).join(' ')}`.toLowerCase().includes(q));
  });
  const stateEl = document.getElementById('storeState');
  const grid = document.getElementById('storeGrid');
  if (!filtered.length) { stateEl.textContent = state.products.length ? 'No products match your search.' : 'This store has no published products yet.'; grid.innerHTML = ''; return; }
  stateEl.textContent = `${filtered.length} product${filtered.length === 1 ? '' : 's'}`;
  grid.innerHTML = filtered.map(p => {
    const image = p.image || p.image_url;
    const available = p.stock == null || Number(p.stock) > 0;
    const qty = Number(state.cart[p.id] || 0);
    return `<article class="card">
      ${image && /^https?:\/\//i.test(image) ? `<img class="photo" src="${esc(image)}" alt="${esc(p.name)}" loading="lazy">` : '<div class="photo-placeholder" aria-hidden="true">◼</div>'}
      <div class="body"><div class="name">${esc(p.name)}</div><div class="category">${esc(p.category || 'General')}</div><div class="price">${money(p.price, state.branding?.currency || 'ETB')} ${p.unit ? `<span class="unit">/ ${esc(p.unit)}</span>` : ''}</div><div class="availability ${available ? 'available' : 'unavailable'}">${available ? 'Available' : 'Out of stock'}</div>${available ? `<div class="buy-row"><button class="add-btn" data-add="${esc(p.id)}">${qty ? `Add more · ${qty}` : 'Add to cart'}</button></div>` : ''}</div>
    </article>`;
  }).join('');
  grid.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => addToCart(btn.dataset.add)));
  updateCartBar();
}
function getProduct(id) { return state.products.find(p => p.id === id); }
function addToCart(id) { const p = getProduct(id); if (!p) return; const max = p.stock == null ? Infinity : Math.max(0, Number(p.stock)); const next = Math.min(Number(state.cart[id] || 0) + 1, max); if (next > 0) state.cart[id] = next; render(); }
function updateCartBar() {
  const entries = Object.entries(state.cart).map(([id, qty]) => ({ product: getProduct(id), qty })).filter(x => x.product && x.qty > 0);
  const bar = document.getElementById('cartBar'); if (!bar) return;
  if (!entries.length) { bar.style.display = 'none'; return; }
  const total = entries.reduce((sum, x) => sum + x.product.price * x.qty, 0);
  document.getElementById('cartSummary').textContent = `${entries.reduce((s,x)=>s+x.qty,0)} item${entries.length === 1 && entries[0].qty === 1 ? '' : 's'} · ${money(total, state.branding?.currency || 'ETB')}`;
  bar.style.display = 'flex';
}
function openCheckout() {
  if (state.telegram && !hasTelegramCapability(state.storefront, 'checkout')) return;
  const entries = Object.entries(state.cart).map(([id, qty]) => ({ product: getProduct(id), qty })).filter(x => x.product && x.qty > 0);
  if (!entries.length) return;
  const modal = document.getElementById('checkoutModal');
  document.getElementById('checkoutItems').innerHTML = entries.map(({product, qty}) => `<div class="checkout-line"><span>${qty}× ${esc(product.name)}</span><strong>${money(product.price * qty, state.branding?.currency || 'ETB')}</strong></div>`).join('');
  document.getElementById('checkoutTotal').textContent = money(entries.reduce((s,x)=>s+x.product.price*x.qty,0), state.branding?.currency || 'ETB');
  modal.style.display = 'flex';
}
function closeCheckout() { document.getElementById('checkoutModal').style.display = 'none'; }
async function submitCheckout() {
  const entries = Object.entries(state.cart).map(([id, qty]) => ({ product: getProduct(id), qty })).filter(x => x.product && x.qty > 0);
  const profile = state.telegram ? (state.telegramBuyer || getTelegramBuyerProfile()) : null;
  const name = document.getElementById('buyerName').value.trim() || profile?.name || ''; const phone = document.getElementById('buyerPhone').value.trim();
  if (!name) { document.getElementById('checkoutError').textContent = 'Please enter your name.'; return; }
  const btn = document.getElementById('submitOrder'); btn.disabled = true; document.getElementById('checkoutError').textContent = '';
  try {
    const idempotencyKey = state.orderIdempotencyKey || (state.orderIdempotencyKey = crypto.randomUUID());
    const res = await fetch('/api/marketplace/checkout', { method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json','Idempotency-Key':idempotencyKey}, body: JSON.stringify({ buyer_id: profile?.id || 'web_buyer', customer_name:name, customer_phone:phone, telegram_storefront_chat_id: state.telegram ? chatId : undefined, telegram_init_data: state.telegram ? getTelegramInitData() : undefined, items: entries.map(x => ({ seller_id: chatId, item_id:x.product.id, qty:x.qty })) }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || 'Unable to place order.');
    state.cart = {}; state.orderIdempotencyKey = null; closeCheckout(); render();
    document.getElementById('successText').textContent = `Order ${data.marketplace_order_id.slice(0,8)}… received. The seller has your request.`;
    const track = document.getElementById('trackOrder');
    track.href = `/track?order=${encodeURIComponent(data.marketplace_order_id)}&token=${encodeURIComponent(data.tracking_token || '')}`;
    track.style.display = data.tracking_token ? 'block' : 'none';
    document.getElementById('successModal').style.display = 'flex';
  } catch (err) { document.getElementById('checkoutError').textContent = err.message || 'Unable to place order.'; } finally { btn.disabled = false; }
}
async function loadTelegramOrders() {
  if (!state.telegram || !hasTelegramCapability(state.storefront, 'order_status')) return;
  const modal = document.getElementById('ordersModal'); const stateEl = document.getElementById('ordersState'); const list = document.getElementById('ordersList');
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
  document.getElementById('closeOrders').focus();
  stateEl.textContent = 'Loading orders…'; list.innerHTML = '';
  try {
    const res = await fetch(`/api/telegram-storefront/${encodeURIComponent(chatId)}/orders`, { headers: { Accept: 'application/json', 'X-Telegram-Init-Data': getTelegramInitData() } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || 'Unable to load orders.');
    const orders = Array.isArray(data.orders) ? data.orders : [];
    stateEl.textContent = orders.length ? `${orders.length} recent order${orders.length === 1 ? '' : 's'}` : 'No orders found for this store.';
    list.innerHTML = orders.map(o => `<article class="card" style="margin:10px 0;padding:12px"><strong>Order ${esc(String(o.marketplace_order_id).slice(0,8))}…</strong><div style="margin-top:6px;color:var(--muted);font-size:12px">${esc(o.status || 'queued')} · ${money(o.total_minor, o.currency)}</div>${(o.sellers || []).map(x => `<div style="margin-top:6px;font-size:12px">Seller order: ${esc(x.seller_order_id)} · ${esc(x.status || 'queued')}</div>`).join('')}<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="fulfillment-btn" data-fulfillment-order="${esc(o.marketplace_order_id)}">Delivery & returns</button><button class="fulfillment-btn" data-appointment-order="${esc(o.marketplace_order_id)}">Appointments</button></div></article>`).join('');
    list.querySelectorAll('[data-fulfillment-order]').forEach(btn => btn.addEventListener('click', () => loadTelegramFulfillment(btn.dataset.fulfillmentOrder)));
    list.querySelectorAll('[data-appointment-order]').forEach(btn => btn.addEventListener('click', () => loadTelegramAppointments(btn.dataset.appointmentOrder)));
  } catch (e) { stateEl.textContent = e.message || 'Unable to load orders.'; list.innerHTML = ''; }
}

async function loadTelegramAppointments(marketplaceOrderId, notice = '') {
  const panel = document.getElementById('appointmentsState');
  panel.style.display = 'block'; panel.textContent = 'Loading appointment information…';
  try {
    const endpoint = `/api/telegram-storefront/${encodeURIComponent(chatId)}/orders/${encodeURIComponent(marketplaceOrderId)}/service-bookings`;
    const headers = { Accept: 'application/json', 'X-Telegram-Init-Data': getTelegramInitData() };
    const res = await fetch(endpoint, { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || 'Unable to load appointments.');
    const lines = Array.isArray(data.order?.serviceLines) ? data.order.serviceLines : [];
    const bookings = Array.isArray(data.bookings) ? data.bookings : [];
    const lineLabel = line => line.name || line.title || line.product_name || line.item_name || line.item_id || line.product_id || 'Service';
    const bookingCards = bookings.map(b => `<article class="customer-appointment-card"><div class="customer-appointment-card-head"><strong>${esc(b.status || 'UNKNOWN')}</strong><span class="customer-appointment-status">${esc(b.appointment_mode || 'Appointment')}</span></div><div class="customer-appointment-service">${esc(lineLabel(lines.find(x => String(x.item_id ?? x.product_id ?? x.id ?? '') === String(b.service_item_id)) || {}))}</div><div class="customer-appointment-time">${esc(new Date(b.requested_start).toLocaleString())} – ${esc(new Date(b.requested_end).toLocaleString())}</div>${b.service_resource_name ? `<div class="customer-appointment-detail">Committed resource: ${esc(b.service_resource_name)}</div>` : ''}${b.status_reason ? `<div class="customer-appointment-detail">${esc(b.status_reason)}</div>` : ''}${Array.isArray(b.allowed_actions) && b.allowed_actions.includes('CANCEL') ? `<button class="fulfillment-btn customer-appointment-cancel" data-cancel-booking="${esc(b.id)}" data-booking-version="${esc(b.version)}">Cancel request</button>` : ''}</article>`).join('');
    const options = lines.map(line => {
      const id = line.item_id ?? line.product_id ?? line.id;
      return id == null ? '' : `<option value="${esc(id)}">${esc(lineLabel(line))}</option>`;
    }).join('');
    panel.innerHTML = `<section class="customer-appointments" aria-labelledby="customerAppointmentsTitle">${notice ? `<div class="customer-appointment-notice" role="status">${esc(notice)}</div>` : ''}<div class="customer-appointment-section-head"><div><strong id="customerAppointmentsTitle">Appointments</strong><p>Manage appointment requests for services in this order.</p></div><span class="customer-appointment-count">${bookings.length}</span></div><div class="customer-appointment-list">${bookingCards || '<div class="customer-appointment-empty">No appointment requests yet.</div>'}</div>${options ? `<form id="customerAppointmentForm" class="customer-appointment-form"><div class="customer-appointment-form-head"><strong>Request an appointment</strong><p>Choose a service and a time that works for you.</p></div><div class="customer-appointment-fields"><label>Service<select name="service_item_id" required>${options}</select></label><label>Start (your device local time)<input name="requested_start" type="datetime-local" required></label><label>End (your device local time)<input name="requested_end" type="datetime-local" required></label><label>Appointment type<select name="appointment_mode"><option value="ON_SITE">At provider location</option><option value="CUSTOMER_LOCATION">At my location</option><option value="REMOTE">Remote</option></select></label><label class="customer-appointment-note-field">Note (optional)<input name="customer_note" maxlength="500" placeholder="Anything the provider should know"></label></div><div class="customer-appointment-actions"><button id="checkAppointmentFeasibility" class="fulfillment-btn customer-appointment-check" type="button">Check time</button><button class="submit customer-appointment-submit" type="submit">Send appointment request</button></div><div id="appointmentFeasibilityState" class="customer-appointment-feasibility" role="status">Check the selected time before sending your request.</div><div id="appointmentRequestError" class="error" role="alert"></div><p class="customer-appointment-advisory">Times are converted from your device local timezone. A request is not a confirmed appointment. The provider must accept it and commit a resource. No time is reserved by submitting this request.</p></form>` : '<div class="customer-appointment-empty customer-appointment-no-service">This order has no appointment-based service lines.</div>'}</section>`;
    panel.querySelectorAll('[data-cancel-booking]').forEach(button => {
      button.addEventListener('click', async () => {
        if (!window.confirm('Cancel this appointment request?')) return;
        button.disabled = true;
        try {
          button.dataset.cancelIdempotencyKey ||= crypto.randomUUID();
          const response = await fetch(`${endpoint}/${encodeURIComponent(button.dataset.cancelBooking)}/cancel`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': button.dataset.cancelIdempotencyKey },
            body: JSON.stringify({ expected_version: Number(button.dataset.bookingVersion) }),
          });
          const result = await response.json().catch(() => ({}));
          if ([409, 412].includes(response.status)) {
            await loadTelegramAppointments(marketplaceOrderId, 'Appointment details changed. The current status has been refreshed; review it before retrying.');
            return;
          }
          if (!response.ok) throw new Error(result?.error?.message || 'Unable to cancel appointment.');
          await loadTelegramAppointments(marketplaceOrderId, result.message || 'Appointment cancelled.');
        } catch (error) {
          button.disabled = false;
          panel.insertAdjacentHTML('afterbegin', `<div class="error" role="alert">${esc(!navigator.onLine ? 'Offline: cancellation was not queued. Reconnect and retry.' : (error.message || 'Unable to cancel appointment.'))}</div>`);
        }
      });
    });
    const form = document.getElementById('customerAppointmentForm');
    if (form) {
      const feasibilityState = document.getElementById('appointmentFeasibilityState');
      const checkButton = document.getElementById('checkAppointmentFeasibility');
      const getRequestedWindow = () => {
        const values = new FormData(form);
        const startValue = String(values.get('requested_start') || '');
        const endValue = String(values.get('requested_end') || '');
        const start = new Date(startValue), end = new Date(endValue);
        if (!startValue || !endValue || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
          throw new Error('Choose a valid start and end time; the end must be later than the start.');
        }
        return { values, start, end };
      };
      form.addEventListener('input', () => { delete form.dataset.appointmentIdempotencyKey; });
      form.addEventListener('change', () => { delete form.dataset.appointmentIdempotencyKey; });
      checkButton.addEventListener('click', async () => {
        checkButton.disabled = true;
        feasibilityState.textContent = 'Checking declared hours and existing commitments…';
        feasibilityState.dataset.state = 'UNKNOWN';
        try {
          const { values, start, end } = getRequestedWindow();
          const params = new URLSearchParams({
            service_item_id: String(values.get('service_item_id')),
            start: start.toISOString(),
            end: end.toISOString(),
          });
          const response = await fetch(`/api/telegram-storefront/${encodeURIComponent(chatId)}/orders/${encodeURIComponent(marketplaceOrderId)}/service-feasibility?${params}`, { headers });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result?.error?.message || 'Unable to check this time.');
          const assessment = result.feasibility || {};
          feasibilityState.dataset.state = assessment.state || 'UNKNOWN';
          const zone = assessment.timeZone ? ` · ${assessment.timeZone}` : '';
          if (assessment.state === 'FEASIBLE') feasibilityState.textContent = `Likely feasible based on declared hours and current commitments${zone}. This is not a reservation.`;
          else if (assessment.state === 'CONFLICT') feasibilityState.textContent = 'No matching resource currently fits this time. Choose another interval.';
          else feasibilityState.textContent = `Availability is unknown${zone}. You may still send a request for provider review; no availability is guaranteed.`;
        } catch (error) {
          feasibilityState.dataset.state = 'UNKNOWN';
          feasibilityState.textContent = !navigator.onLine ? 'Offline: time feasibility cannot be checked until you reconnect.' : (error.message || 'Time feasibility is unknown.');
        } finally { checkButton.disabled = false; }
      });
      form.querySelectorAll('[name="service_item_id"],[name="requested_start"],[name="requested_end"]').forEach(input => {
        input.addEventListener('change', () => {
          feasibilityState.dataset.state = '';
          feasibilityState.textContent = 'Selection changed. Check the new time before sending your request.';
        });
      });
      form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const errorEl = document.getElementById('appointmentRequestError');
      const values = new FormData(form);
      const checkedState = feasibilityState.dataset.state || '';
      if (!['FEASIBLE', 'UNKNOWN'].includes(checkedState)) {
        errorEl.textContent = checkedState === 'CONFLICT'
          ? 'This time has a known conflict. Choose another interval and check again.'
          : 'Check the selected time before sending your appointment request.';
        return;
      }
      const startValue = String(values.get('requested_start') || '');
      const endValue = String(values.get('requested_end') || '');
      const start = new Date(startValue), end = new Date(endValue);
      if (!startValue || !endValue || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        errorEl.textContent = 'Choose a valid start and end time; the end must be later than the start.';
        return;
      }
      button.disabled = true; errorEl.textContent = '';
      try {
        const idempotencyKey = form.dataset.appointmentIdempotencyKey || (form.dataset.appointmentIdempotencyKey = crypto.randomUUID());
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
          body: JSON.stringify({
            service_item_id: values.get('service_item_id'),
            requested_start: start.toISOString(),
            requested_end: end.toISOString(),
            appointment_mode: values.get('appointment_mode'),
            customer_note: values.get('customer_note'),
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.error?.message || 'Unable to submit appointment request.');
        await loadTelegramAppointments(marketplaceOrderId, result.message || 'Appointment request received. Status: REQUESTED.');
      } catch (error) {
        errorEl.textContent = !navigator.onLine ? 'Offline: appointment requests are not queued. Reconnect and retry.' : (error.message || 'Unable to submit appointment request. Please retry.');
        button.disabled = false;
      }
      });
    }
  } catch (error) {
    panel.innerHTML = `<div role="alert">${esc(error.message || 'Unable to load appointment information.')}</div>`;
  }
}

async function loadTelegramFulfillment(orderId) {
  const stateEl=document.getElementById('fulfillmentState');
  stateEl.style.display='block'; stateEl.textContent='Loading delivery information…';
  try {
    const res=await fetch(`/api/telegram-storefront/${encodeURIComponent(chatId)}/orders/${encodeURIComponent(orderId)}/fulfillment`,{headers:{Accept:'application/json','X-Telegram-Init-Data':getTelegramInitData()}});
    const data=await res.json().catch(()=>({})); if(!res.ok) throw new Error(data?.error?.message||'Unable to load delivery information.');
    const o=data.order||{}; const rows=(o.fulfillments||[]).map(f=>`<div style="margin-top:8px;padding:10px;border:1px solid var(--line);border-radius:10px"><strong>${esc(f.status||'pending')}</strong><div style="margin-top:4px;font-size:12px;color:var(--muted)">${esc(f.fulfillmentType||'delivery')}${f.trackingReference?` · Tracking: ${esc(f.trackingReference)}`:''}</div>${f.proof?`<div style="margin-top:4px;font-size:12px">Proof available: ${esc(f.proof.type||'document')}</div>`:''}</div>`).join('');
    stateEl.innerHTML=`<strong>Delivery</strong>${rows||'<div style="margin-top:6px">No fulfillment details are available yet.</div>'}<div style="margin-top:10px;font-size:12px;color:var(--muted)">${o.returns?.supported?'Return request available through the existing returns authority.':'Returns are currently handled by the seller’s existing returns workflow.'}</div>`;
  } catch(e){stateEl.textContent=e.message||'Unable to load delivery information.';}
}

async function load() {
  if (!chatId || !/^[A-Za-z0-9_.:-]{1,128}$/.test(chatId)) { document.getElementById('storeState').textContent = 'Invalid store link.'; return; }
  state.telegram = isTelegramWebApp();
  if (state.telegram) applyTelegramBuyerChrome();
  try {
    if (state.telegram) {
      const sr = await fetch(`/api/telegram-storefront/${encodeURIComponent(chatId)}`, { headers: { Accept: 'application/json' } });
      const sd = await sr.json().catch(() => ({}));
      if (!sr.ok) throw new Error(sd?.error?.message || 'Telegram storefront is not published');
      state.storefront = sd.storefront || null;
      const initData = getTelegramInitData();
      if (!initData) throw new Error('Telegram buyer authentication is unavailable. Please reopen this store from Telegram.');
      const br = await fetch(`/api/telegram-storefront/${encodeURIComponent(chatId)}/buyer-session`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ initData }) });
      const bd = await br.json().catch(() => ({}));
      if (!br.ok) throw new Error(bd?.error?.message || 'Telegram buyer verification is unavailable');
      state.telegramBuyer = bd.buyer || null;
    }
    const res = await fetch(`/catalog/${encodeURIComponent(chatId)}`, { headers: { Accept: 'application/json' } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || 'Store not found');
    // Public Viewer deliberately publishes only marketplace-listed products.
    state.products = Array.isArray(data.products) ? data.products.filter(p => p && p.marketplace_listed === true) : [];
    setBranding(data.branding, data.seller_name);
    document.getElementById('storeStatus').textContent = state.telegram ? (state.products.length ? 'Telegram storefront · Open' : 'Telegram storefront · No products published') : (state.products.length ? 'Open for browsing' : 'No products published');
    if (state.telegram && !hasTelegramCapability(state.storefront, 'checkout')) document.getElementById('cartBar').style.display = 'none';
    render();
    if (state.telegram && hasTelegramCapability(state.storefront, 'order_status')) document.getElementById('telegramOrders').style.display = 'block';
  } catch (err) {
    document.getElementById('storeState').textContent = err.message || 'Unable to load this store.';
    document.getElementById('storeStatus').textContent = 'Store unavailable';
  }
}
document.getElementById('storeSearch').addEventListener('input', e => { state.query = e.target.value.trim(); render(); });
load();

document.getElementById('openCart').addEventListener('click', openCheckout);
document.getElementById('closeCheckout').addEventListener('click', closeCheckout);
document.getElementById('submitOrder').addEventListener('click', submitCheckout);
document.getElementById('closeSuccess').addEventListener('click', () => { document.getElementById('successModal').style.display = 'none'; });

document.getElementById('openOrders').addEventListener('click', loadTelegramOrders);
const ordersModal = document.getElementById('ordersModal');
function closeOrdersModal() {
  ordersModal.style.display = 'none';
  ordersModal.setAttribute('aria-hidden', 'true');
  document.getElementById('openOrders').focus();
}
document.getElementById('closeOrders').addEventListener('click', closeOrdersModal);
ordersModal.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeOrdersModal();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = [...ordersModal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(element => element.getClientRects().length > 0);
  if (!focusable.length) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || document.activeElement === ordersModal)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
