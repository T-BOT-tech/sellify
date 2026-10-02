// sync/orders.js
// Phase 5 extraction (see modularization plan §5): the queued-order push to
// /sync/:chatId — moved out of main.js unchanged.
import { STORAGE_KEYS } from '../constants.js';
import { config, orders, setOrders } from '../state.js';
import { saveJSON } from '../storage/json.js';
import { authHeaders as tenantAuthHeaders } from '../auth/tenant.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { applyStoreBranding } from '../ui/branding.js';
import { t } from '../ui/i18n.js';
import { renderAll } from '../ui/render.js';
import { refreshPaymentProjection, ensurePaymentForSyncedOrder } from '../payments/projection.js';

// Seller sync is authenticated with a tenant-scoped device session.
// Tenant-wide API keys are not sent by the PWA.
async function pullServerOrders() {
  if (!config.syncUrl || !config.chatId || !config.sessionToken) return;
  try {
    const res = await fetch(`${config.syncUrl.replace(/\/$/, '')}/orders/${encodeURIComponent(config.chatId)}?limit=200`, {
      headers: authHeaders(),
    });
    if (!res.ok) return;
    const data = await res.json();
    const incoming = Array.isArray(data.orders) ? data.orders : [];
    if (!incoming.length) return;

    // Server is authoritative for synced/marketplace order state. Merge by
    // local id rather than replacing the local queue, so offline orders and
    // local-only metadata (cash/payment proof/kitchen fields) are preserved.
    const incomingById = new Map(incoming.filter(o => o?.id != null).map(o => [String(o.id), o]));
    const merged = orders.map(local => {
      const remote = incomingById.get(String(local?.id));
      if (!remote) return local;
      return { ...local, ...remote, _localPaymentProof: local.payment_proof || local._localPaymentProof };
    });
    const existingIds = new Set(merged.map(o => String(o?.id)));
    const fresh = incoming.filter(o => o?.id != null && !existingIds.has(String(o.id)));
    setOrders([...fresh, ...merged].sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0)));
    saveJSON(STORAGE_KEYS.orders, orders);
    renderAll();
    await refreshPaymentProjection();
    renderAll();
  } catch (e) {
    console.log('[Sync] Pulling server order feed failed (will retry next sync):', e);
  }
}

async function pullNewOrders() {
  if (!config.syncUrl || !config.chatId || !config.sessionToken) return;
  try {
    const res = await fetch(`${config.syncUrl.replace(/\/$/, '')}/sync/${config.chatId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return;
    const data = await res.json();
    const incoming = Array.isArray(data.new_orders) ? data.new_orders : [];
    if (incoming.length === 0) return;
    const existingIds = new Set(orders.map(o => o.id));
    const fresh = incoming.filter(o => o && o.id != null && !existingIds.has(o.id));
    if (fresh.length === 0) return;
    setOrders([...fresh, ...orders]);
    saveJSON(STORAGE_KEYS.orders, orders);
    renderAll();
  } catch (e) {
    console.log('[Sync] Pulling new orders failed (will retry next sync):', e);
  }
}

export async function syncOrders() {
  const queued = orders.filter(o => o.status === 'queued');
  if (queued.length === 0) {
    await pullServerOrders();
    await pullNewOrders();
    return null;
  }

  try {
    const res = await fetch(`${config.syncUrl.replace(/\/$/, '')}/sync/${config.chatId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ orders: queued }),
    });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const data = await res.json();
    if (data.branding) {
      applyStoreBranding(data.branding);
    }

    const resultMap = Object.fromEntries((data.results || []).map(r => [r.local_id, r]));
    setOrders(orders.map(o => {
      const result = resultMap[o.id];
      if (result && result.status === 'synced') {
        return { ...o, status: 'synced', server_order_id: result.order_id };
      }
      // Phase 4: the backend now validates each order's line items before
      // accepting it (see saveQueuedOrders in backend/lib/store.js) and
      // can come back with 'rejected' for one that doesn't have any valid
      // items — that's not a transient failure worth retrying forever
      // (it'll never validate), so it's marked distinctly rather than
      // falling into the same "still queued, bump retry count" bucket a
      // network hiccup gets.
      if (result && result.status === 'rejected') {
        return { ...o, status: 'sync_rejected', sync_error: result.error || 'Rejected by server' };
      }
      // W5: still queued after this attempt — record it so the ticket can
      // show real provenance ("queued 4m ago, 2 retry attempts") instead
      // of a bare "queued" badge that gives no sense of whether sync is
      // actually stuck or just hasn't run yet.
      if (queued.some(q => q.id === o.id)) {
        return { ...o, sync_attempts: (o.sync_attempts || 0) + 1, last_sync_attempt_at: Date.now() };
      }
      return o;
    }));
    saveJSON(STORAGE_KEYS.orders, orders);
    renderAll();
    const syncedOrders = orders.filter(o => resultMap[o.id]?.status === 'synced' && o.server_order_id);
    for (const order of syncedOrders) { try { await ensurePaymentForSyncedOrder(order); } catch (error) { console.warn('[Payment] Canonical payment creation deferred:', error?.code || error?.message || error); } }
    await pullServerOrders();
    await pullNewOrders();
    const count = (data && data.results && Array.isArray(data.results)) ? data.results.length : 0;
    return `${count} ${t('orderSyncedMsg')}`;
  } catch (e) {
    console.error(e);
    setOrders(orders.map(o => queued.some(q => q.id === o.id)
      ? { ...o, sync_attempts: (o.sync_attempts || 0) + 1, last_sync_attempt_at: Date.now() }
      : o));
    saveJSON(STORAGE_KEYS.orders, orders);
    renderAll();
    return t('orderSyncFailed');
  }
}
