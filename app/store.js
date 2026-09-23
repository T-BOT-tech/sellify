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
  modal.style.display = 'flex'; stateEl.textContent = 'Loading orders…'; list.innerHTML = '';
  try {
    const res = await fetch(`/api/telegram-storefront/${encodeURIComponent(chatId)}/orders`, { headers: { Accept: 'application/json', 'X-Telegram-Init-Data': getTelegramInitData() } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || 'Unable to load orders.');
    const orders = Array.isArray(data.orders) ? data.orders : [];
    stateEl.textContent = orders.length ? `${orders.length} recent order${orders.length === 1 ? '' : 's'}` : 'No orders found for this store.';
    list.innerHTML = orders.map(o => `<article class="card" style="margin:10px 0;padding:12px"><strong>Order ${esc(String(o.marketplace_order_id).slice(0,8))}…</strong><div style="margin-top:6px;color:var(--muted);font-size:12px">${esc(o.status || 'queued')} · ${money(o.total_minor, o.currency)}</div>${(o.sellers || []).map(x => `<div style="margin-top:6px;font-size:12px">Seller order: ${esc(x.seller_order_id)} · ${esc(x.status || 'queued')}</div>`).join('')}<button class="fulfillment-btn" style="margin-top:10px" data-fulfillment-order="${esc(o.marketplace_order_id)}">Delivery & returns</button></article>`).join('');
    list.querySelectorAll('[data-fulfillment-order]').forEach(btn => btn.addEventListener('click', () => loadTelegramFulfillment(btn.dataset.fulfillmentOrder)));
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
