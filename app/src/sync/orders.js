// sync/orders.js
// Phase 5 extraction (see modularization plan §5): the queued-order push to
// /sync/:chatId — moved out of main.js unchanged.
import { STORAGE_KEYS } from '../constants.js';
import { config, orders, setOrders } from '../state.js';
import { saveJSON } from '../storage/json.js';
import { authHeaders } from '../auth/tenant.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { applyStoreBranding } from '../ui/branding.js';
import { t } from '../ui/i18n.js';
import { renderAll } from '../ui/render.js';
import { refreshPaymentProjection, ensurePaymentForSyncedOrder, isCanonicalLinkageOnlyPayment } from '../payments/projection.js';
import { getPayments } from '../payments/state.js';

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

async function ensureAndPersistPaymentLinkage(order) {
  try {
    const result = await ensurePaymentForSyncedOrder(order);
    const payment = result && result.payment;
    const paymentId = String((payment && (payment.id || payment.paymentId || payment.payment_id)) || '').trim();
    if (!paymentId) return result;
    const intentId = String((payment && (payment.paymentIntentId || payment.payment_intent_id || payment.intentId)) || '').trim() || null;
    const linkageOnly = isCanonicalLinkageOnlyPayment(payment);
    const localId = String(order && order.id != null ? order.id : '');
    const serverOrderId = String((order && (order.server_order_id || order.serverOrderId)) || '');
    let changed = false;
    setOrders(orders.map(current => {
      const matches = (localId && String(current && current.id != null ? current.id : '') === localId)
        || (serverOrderId && String((current && (current.server_order_id || current.serverOrderId)) || '') === serverOrderId);
      if (!matches) return current;
      const existing = current.payment_linkage || {};
      if (String(existing.payment_id || '') === paymentId
          && String(existing.payment_intent_id || '') === String(intentId || '')
          && String(existing.status || '').toUpperCase() === 'LINKED'
          && Boolean(existing.canonical_linkage_only) === linkageOnly) return current;
      changed = true;
      return {
        ...current,
        payment_linkage: {
          status: 'LINKED',
          payment_id: paymentId,
          payment_intent_id: intentId,
          ...(linkageOnly ? { canonical_linkage_only: true } : {}),
        },
      };
    }));
    if (changed) {
      saveJSON(STORAGE_KEYS.orders, orders);
      renderAll();
    }
    return result;
  } catch (error) {
    // Retry linkage/status recovery on a later sync; local proof never establishes financial state.
    console.warn('[Payment] Canonical payment/linkage recovery deferred:', error && (error.code || error.message) || error);
    return null;
  }
}

async function retryMissingPaymentLinkages() {
  const candidates = orders.filter(order => order
    && (order.server_order_id || order.serverOrderId)
    && order.status !== 'queued' && order.status !== 'sync_rejected'
    && (String((order.payment_linkage && order.payment_linkage.status) || '').toUpperCase() !== 'LINKED'
      || !String((order.payment_linkage && order.payment_linkage.payment_id) || '').trim()
      || Boolean(order.payment_linkage && order.payment_linkage.canonical_linkage_only)));
  for (const order of candidates) await ensureAndPersistPaymentLinkage(order);
}

export async function syncOrders() {
  // Offline/local-first orders stay queued until an authenticated sync session is ready.
  // Do not count a missing configuration as a failed network attempt.
  if (!config.syncUrl || !config.chatId || !config.sessionToken) return null;
  const queued = orders.filter(o => o.status === 'queued');
  if (queued.length === 0) {
    await pullServerOrders();
    await pullNewOrders();
    // Recover accepted orders whose canonical payment linkage was deferred.
    await retryMissingPaymentLinkages();
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
        // The authenticated sync acknowledgement is the canonical linkage
        // boundary. Persist identity only; payment_state in this response is
        // not cached as financial truth and remains Payment Core-owned.
        const paymentLinkage = result.payment_id
          ? {
              status: 'LINKED',
              payment_id: String(result.payment_id),
              payment_intent_id: result.payment_intent_id ? String(result.payment_intent_id) : null,
            }
          : o.payment_linkage;
        return {
          ...o,
          status: 'synced',
          server_order_id: result.order_id,
          ...(paymentLinkage ? { payment_linkage: paymentLinkage } : {}),
        };
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
    for (const order of syncedOrders) await ensureAndPersistPaymentLinkage(order);
    await pullServerOrders();
    await pullNewOrders();
    await retryMissingPaymentLinkages();
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
