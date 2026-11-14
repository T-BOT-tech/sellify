import { applyTelegramBuyerChrome, getTelegramBuyerProfile, getTelegramInitData, isTelegramWebApp, hasTelegramCapability } from './src/telegram-buyer-storefront.js';
import { serviceLocalDateTimeToIso } from './src/verticals/services/service-window-assessment-contract.js';

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
function buyerRequestKey(prefix) {
  const id = globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2));
  return 'tg-service-' + prefix + '-' + id;
}
function formatAppointmentTime(value, timeZone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '—');
  try {
    return new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short',...(timeZone?{timeZone}:{})}).format(date);
  } catch { return date.toLocaleString(); }
}
function telegramAppointmentBase(orderId) {
  return `/api/telegram-storefront/${encodeURIComponent(chatId)}/orders/${encodeURIComponent(orderId)}/service-appointments`;
}
function telegramBuyerHeaders(extra = {}) {
  return { Accept:'application/json','Content-Type':'application/json','X-Telegram-Init-Data':getTelegramInitData(),...extra };
}
function openTelegramServiceAppointmentDialog({marketplaceOrderId,sellerOrderId,serviceItemId,serviceName,timeZone}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'service-appointment-request-dialog';
  dialog.style.cssText = 'width:min(94vw,520px);max-height:88vh;overflow:auto;border:1px solid var(--line);border-radius:16px;padding:18px;';
  dialog.innerHTML = `
    <form method="dialog" style="display:grid;gap:12px;">
      <h2 style="margin:0;">Request an appointment</h2>
      <div class="hint">${esc(serviceName)} · Seller timezone: ${esc(timeZone || 'not provided')}</div>
      <label>Start date and time<input name="start" type="datetime-local" required></label>
      <label>End date and time<input name="end" type="datetime-local" required></label>
      <label>Appointment type<select name="mode"><option value="ON_SITE">At provider</option><option value="CUSTOMER_LOCATION">At my location</option><option value="REMOTE">Remote</option></select></label>
      <label>Note (optional)<textarea name="note" maxlength="500" rows="3" placeholder="Anything the provider should know"></textarea></label>
      <div data-assessment-state class="state" role="status" aria-live="polite">Choose a time and check its current feasibility.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" class="fulfillment-btn" data-check-time>Check time</button>
        <button type="button" class="submit" data-send-request disabled>Send request</button>
        <button type="button" class="fulfillment-btn" data-close-dialog>Close</button>
      </div>
    </form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  const stateEl = dialog.querySelector('[data-assessment-state]');
  const checkButton = dialog.querySelector('[data-check-time]');
  const sendButton = dialog.querySelector('[data-send-request]');
  form.addEventListener('submit',event=>event.preventDefault());
  let activeCreateKey = null;
  let activeCreateStorageKey = null;
  let assessedWindowKey = null;
  const windowKey = window => JSON.stringify({service_item_id:serviceItemId,requested_start:window.requested_start,requested_end:window.requested_end});
  const readWindow = () => {
    if (!timeZone) throw new Error('Seller timezone is not configured. The request was not sent.');
    const start = serviceLocalDateTimeToIso(form.elements.start.value,timeZone);
    const end = serviceLocalDateTimeToIso(form.elements.end.value,timeZone);
    if (Date.parse(end) <= Date.parse(start)) throw new Error('End time must be later than start time.');
    return { service_item_id:serviceItemId, requested_start:start, requested_end:end, seller_order_id:sellerOrderId };
  };
  checkButton.addEventListener('click',async()=>{
    checkButton.disabled=true; stateEl.textContent='Checking current resource windows…';
    try {
      const payload=readWindow();
      const response=await fetch(telegramAppointmentBase(marketplaceOrderId)+'/assessment',{
        method:'POST',headers:telegramBuyerHeaders(),body:JSON.stringify(payload),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data?.error?.message||'Could not check appointment feasibility.');
      const assessmentState=data.assessment?.state;
      assessedWindowKey=windowKey(payload);
      sendButton.disabled=false;
      if(assessmentState==='FEASIBLE') stateEl.textContent='Potentially feasible: a resource window appears to fit. This is not a reservation or confirmation.';
      else if(assessmentState==='UNAVAILABLE') stateEl.textContent='No current resource window appears free. You may still send a request for seller review; it will not be confirmed.';
      else stateEl.textContent='Availability is UNKNOWN. You may still send a request for seller review; no slot is reserved.';
    } catch(error) { assessedWindowKey=null; sendButton.disabled=true; stateEl.textContent=error.message||'Availability is UNKNOWN. The request has not been sent.'; }
    finally { checkButton.disabled=false; }
  });
  [form.elements.start,form.elements.end].forEach(input=>input.addEventListener('input',()=>{
    assessedWindowKey=null; sendButton.disabled=true;
    stateEl.textContent='Time changed. Check the new time before sending the request.';
  }));
  sendButton.addEventListener('click',async()=>{
    sendButton.disabled=true; stateEl.textContent='Sending appointment request…';
    try {
      const appointmentWindow=readWindow();
      if(assessedWindowKey!==windowKey(appointmentWindow)) throw new Error('Check the selected time before sending the appointment request.');
      const payload={...appointmentWindow,appointment_mode:form.elements.mode.value,customer_note:form.elements.note.value.trim()};
      const storageKey='sellify:telegram-service-appointment:'+marketplaceOrderId+':'+sellerOrderId+':'+serviceItemId+':'+encodeURIComponent(JSON.stringify(payload));
      if(activeCreateStorageKey!==storageKey){
        let storedKey=null; try{storedKey=sessionStorage.getItem(storageKey)}catch{}
        activeCreateKey=storedKey||buyerRequestKey('create');
        activeCreateStorageKey=storageKey;
      }
      try{sessionStorage.setItem(storageKey,activeCreateKey)}catch{}
      const response=await fetch(telegramAppointmentBase(marketplaceOrderId),{
        method:'POST',headers:telegramBuyerHeaders({'Idempotency-Key':activeCreateKey}),
        body:JSON.stringify(payload),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data?.error?.message||'Appointment request could not be sent.');
      try{sessionStorage.removeItem(storageKey)}catch{}
      dialog.close(); dialog.remove();
      await loadTelegramOrders();
      const state=document.getElementById('ordersState');
      if(state) state.textContent='Appointment request sent. It is pending seller review; no resource slot is confirmed yet.';
    } catch(error) {
      stateEl.textContent=(error instanceof TypeError?'Offline — request not sent. Reconnect and retry.':error.message||'Request not sent.');
      sendButton.disabled=false;
    }
  });
  dialog.querySelector('[data-close-dialog]').addEventListener('click',()=>{dialog.close();dialog.remove();});
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.showModal();
}
async function cancelTelegramServiceAppointment(button) {
  button.disabled=true;
  const orderId=button.dataset.marketplaceOrder;
  button.dataset.idempotencyKey=button.dataset.idempotencyKey||buyerRequestKey('cancel');
  try {
    const response=await fetch(telegramAppointmentBase(orderId)+'/'+encodeURIComponent(button.dataset.bookingId),{
      method:'PATCH',
      headers:telegramBuyerHeaders({'Idempotency-Key':button.dataset.idempotencyKey}),
      body:JSON.stringify({
        seller_order_id:button.dataset.sellerOrder,
        expected_version:Number(button.dataset.version),
        reason:'Cancelled by customer',
      }),
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data?.error?.message||'Appointment could not be cancelled.');
    await loadTelegramOrders();
    const state=document.getElementById('ordersState');
    if(state) state.textContent='Appointment request cancelled.';
  } catch(error) {
    const state=document.getElementById('ordersState');
    if(state) state.textContent=(error instanceof TypeError?'Offline — cancellation not sent. Reconnect and retry.':error.message||'Cancellation not sent.');
    button.disabled=false;
  }
}
async function loadTelegramOrders() {
  if (!state.telegram || !hasTelegramCapability(state.storefront, 'order_status')) return;
  const modal = document.getElementById('ordersModal'); const stateEl = document.getElementById('ordersState'); const list = document.getElementById('ordersList');
  modal.style.display = 'flex'; stateEl.textContent = 'Loading orders…'; list.innerHTML = '';
  try {
    const res = await fetch(`/api/telegram-storefront/${encodeURIComponent(chatId)}/orders`, { headers: { Accept: 'application/json', 'X-Telegram-Init-Data': getTelegramInitData() } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || 'Unable to load orders.');
    const orders = Array.isArray(data.orders) ? data.orders : [];
    const appointmentsEnabled = hasTelegramCapability(state.storefront,'service_appointments');
    stateEl.textContent = orders.length ? `${orders.length} recent order${orders.length === 1 ? '' : 's'}` : 'No orders found for this store.';
    list.innerHTML = orders.map(o => `<article class="card" style="margin:10px 0;padding:12px"><strong>Order ${esc(String(o.marketplace_order_id).slice(0,8))}…</strong><div style="margin-top:6px;color:var(--muted);font-size:12px">${esc(o.status || 'queued')} · ${money(o.total_minor, o.currency)}</div>${(o.sellers || []).map(seller => `
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--line);">
        <div style="font-size:12px;">Seller order: ${esc(seller.seller_order_id)} · ${esc(seller.status || 'queued')}</div>
        ${appointmentsEnabled && (seller.service_items||[]).length ? `
          <div style="margin-top:8px;font-weight:600;">Service appointments</div>
          ${(seller.service_appointments||[]).length ? (seller.service_appointments||[]).map(appointment => `
            <div style="margin-top:6px;padding:8px;border:1px solid var(--line);border-radius:9px;">
              <strong>${esc(appointment.status)}</strong>
              <div class="hint">${esc((seller.service_items||[]).find(item=>item.id===appointment.service_item_id)?.name||appointment.service_item_id)} · ${esc(formatAppointmentTime(appointment.requested_start,seller.time_zone))} – ${esc(formatAppointmentTime(appointment.requested_end,seller.time_zone))}</div>
              ${['REQUESTED','ACCEPTED','CONFIRMED'].includes(String(appointment.status).toUpperCase()) ? `<button class="fulfillment-btn" data-cancel-appointment data-marketplace-order="${esc(o.marketplace_order_id)}" data-seller-order="${esc(seller.seller_order_id)}" data-booking-id="${esc(appointment.id)}" data-version="${esc(appointment.version)}">Cancel request</button>` : ''}
            </div>`).join('') : '<div class="hint" style="margin-top:6px;">No appointment requests yet.</div>'}
          ${(seller.service_items||[]).map(item => `<button class="fulfillment-btn" style="margin-top:8px" data-request-appointment data-marketplace-order="${esc(o.marketplace_order_id)}" data-seller-order="${esc(seller.seller_order_id)}" data-service-item="${esc(item.id)}" data-service-name="${esc(item.name)}" data-time-zone="${esc(seller.time_zone||'')}">Request ${esc(item.name)} appointment</button>`).join('')}
        ` : ''}
      </div>`).join('')}
      <button class="fulfillment-btn" style="margin-top:10px" data-fulfillment-order="${esc(o.marketplace_order_id)}">Delivery & returns</button></article>`).join('');
    list.querySelectorAll('[data-fulfillment-order]').forEach(btn => btn.addEventListener('click', () => loadTelegramFulfillment(btn.dataset.fulfillmentOrder)));
    list.querySelectorAll('[data-request-appointment]').forEach(btn => btn.addEventListener('click',()=>openTelegramServiceAppointmentDialog({
      marketplaceOrderId:btn.dataset.marketplaceOrder,sellerOrderId:btn.dataset.sellerOrder,
      serviceItemId:btn.dataset.serviceItem,serviceName:btn.dataset.serviceName,timeZone:btn.dataset.timeZone,
    })));
    list.querySelectorAll('[data-cancel-appointment]').forEach(btn => btn.addEventListener('click',()=>cancelTelegramServiceAppointment(btn)));
  } catch (e) { stateEl.textContent = e.message || 'Unable to load orders.'; list.innerHTML = ''; }
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
document.getElementById('closeOrders').addEventListener('click', () => { document.getElementById('ordersModal').style.display = 'none'; });
