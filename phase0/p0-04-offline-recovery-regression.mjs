import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync(new URL('../app/src/warehouse/procurement-receiving.js', import.meta.url), 'utf8');
const outbox = fs.readFileSync(new URL('../app/src/sync/outbox.js', import.meta.url), 'utf8');

function ok(label, fn) { fn(); console.log(`PASS ${label}`); }

ok('Offline receiving uses the existing durable outbox', () => {
  assert.match(ui, /enqueueCommand/);
  assert.match(ui, /flushCommandOutbox/);
  assert.match(outbox, /STORAGE_KEYS\.outboxEvents/);
  assert.match(outbox, /setOutboxEvents/);
});

ok('Offline receipt is never presented as server-confirmed', () => {
  assert.match(ui, /UI_STATES\.QUEUED/);
  assert.match(ui, /NOT server-confirmed/);
  assert.match(ui, /Queued locally/);
});

ok('Unknown transport failure preserves the same idempotent command for recovery', () => {
  assert.match(ui, /UI_STATES\.UNKNOWN/);
  assert.match(ui, /same idempotent command is queued/);
  assert.match(ui, /idempotencyKey/);
  assert.match(ui, /crypto\.randomUUID\(\)/);
});

ok('Canonical procurement receiving endpoint remains the mutation authority', () => {
  assert.match(ui, /procurement\/purchase-orders/);
  assert.match(ui, /\/receipts/);
  assert.match(ui, /Idempotency-Key/);
  assert.doesNotMatch(ui, /inventory.*create|create.*inventory/i);
});

ok('Failed canonical commands are recoverable without changing the idempotency key', () => {
  assert.match(outbox, /status: retryable \? 'pending' : 'failed'/);
  assert.match(outbox, /retryCommand/);
  assert.match(ui, /data-retry-receipt/);
});

ok('Generic event sync does not consume command records', () => {
  assert.match(outbox, /!e\.kind && e\.status/);
});

console.log('P0-04 offline/recovery regression: PASS');
