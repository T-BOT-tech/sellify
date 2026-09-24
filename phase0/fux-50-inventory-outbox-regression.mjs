// FUX-50 — inventory outbox/replay regression.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const ledger = fs.readFileSync('app/src/warehouse/ledger.js', 'utf8');
const outbox = fs.readFileSync('app/src/sync/outbox.js', 'utf8');
const store = fs.readFileSync('backend/lib/store-sqlite.js', 'utf8');

function check(condition, message) {
  assert.ok(condition, message);
  console.log('PASS:', message);
}

check(ledger.includes("enqueueEvent('inventory.movement.record', event"), 'offline inventory movement enters the durable event outbox');
check(ledger.includes('eventId: event.eventId'), 'queued inventory event preserves its eventId');
check(ledger.includes("eventId: input.eventId || eventId()"), 'online and offline paths create one stable event identity');
check(ledger.includes('if (!res.ok) throw new Error'), 'HTTP application failures are not silently converted to synced state');
check(ledger.includes('catch'), 'inventory transport boundary has an exception path');

check(outbox.includes("const id = String(eventId ||"), 'outbox de-duplicates events by eventId');
check(outbox.includes("status: 'pending'"), 'new outbox work is explicitly pending');
check(outbox.includes("result.status === 'processed' ? 'synced' : 'rejected'"), 'server result distinguishes synced from rejected');
check(outbox.includes('lastError: error.message'), 'transport failures retain diagnostic error state');
check(outbox.includes("e.status !== 'synced' && e.status !== 'rejected'"), 'unsuccessful transport work remains eligible for retry');

check(store.includes("if (eventType === 'inventory.movement.record')"), 'backend sync event boundary explicitly handles inventory movements');
check(store.includes("SELECT * FROM sync_events WHERE event_id = ?"), 'backend replay is keyed by eventId');
check(store.includes("code: 'EVENT_ID_REUSED'"), 'reusing an eventId with a different payload is rejected');
check(store.includes("SELECT * FROM inventory_movements WHERE event_id = ?"), 'inventory application is idempotent at the ledger boundary');
check(store.includes('if (existing) return inventoryMovementFromRow(existing);'), 'duplicate inventory replay returns the canonical existing movement');

console.log('FUX-50 inventory outbox/replay regression: PASS');
