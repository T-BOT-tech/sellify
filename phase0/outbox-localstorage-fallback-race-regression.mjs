import assert from 'node:assert/strict';
import {
  OUTBOX_FALLBACK_LOG_PREFIX,
  appendOutboxRecoveryOperations,
  removeOutboxRecoveryOperations,
  resetOutboxRecoveryBaseline,
  restoreOutboxRecoveryOperations,
} from '../app/src/sync/outbox-recovery-journal.js';

const SNAPSHOT_KEY = 'sellify.outbox.recovery.v1';
function fakeStorage() {
  const values = new Map();
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    key(index) { return [...values.keys()][index] ?? null; },
    get length() { return values.size; },
  };
}
function compareText(left, right) { return left === right ? 0 : left < right ? -1 : 1; }

// Characterize the unsupported environment: both simulated tabs read the same
// pre-write value, then each replaces that shared snapshot. Tab B loses A.
{
  const values = new Map();
  let reads = 0;
  const storage = {
    getItem(key) {
      if (key === SNAPSHOT_KEY && reads++ < 2) return null;
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) { values.set(key, String(value)); },
  };
  function naiveMergeWrite(addition) {
    const shared = JSON.parse(storage.getItem(SNAPSHOT_KEY) || '[]');
    storage.setItem(SNAPSHOT_KEY, JSON.stringify([...shared, addition]));
  }
  naiveMergeWrite({ eventId: 'from-tab-A' });
  naiveMergeWrite({ eventId: 'from-tab-B' });
  assert.deepEqual(JSON.parse(values.get(SNAPSHOT_KEY)).map(event => event.eventId), ['from-tab-B']);
}

// Actual production append-only helper: independent writers use distinct keys,
// so an interleaved write cannot overwrite the other writer's operation.
{
  const storage = fakeStorage();
  const eventA = { eventId: 'A', tenantChatId: 'tenant-1', status: 'pending' };
  const eventB = { eventId: 'B', tenantChatId: 'tenant-2', status: 'pending' };
  resetOutboxRecoveryBaseline([]);
  appendOutboxRecoveryOperations([eventA], { storage, writerId: 'tab-A' });
  resetOutboxRecoveryBaseline([]); // model tab B's independent in-memory baseline
  appendOutboxRecoveryOperations([eventB], { storage, writerId: 'tab-B' });
  const restored = restoreOutboxRecoveryOperations({ storage, events: [] });
  assert.deepEqual(restored.events.map(event => event.eventId), ['A', 'B']);
  assert.equal(storage.values.size, 2, 'each independent operation must have its own durable storage key');
  assert.equal(removeOutboxRecoveryOperations(restored.keys, { storage }), true);
  const migrated = restoreOutboxRecoveryOperations({ storage, events: restored.events });
  assert.deepEqual(migrated.keys, [], 'successfully migrated records should be removable by their exact keys');
  assert.deepEqual(migrated.events.map(event => event.eventId), ['A', 'B']);
}

// Tombstones prevent a stale legacy snapshot or an older put from resurrecting
// an event that another writer removed.
{
  const storage = fakeStorage();
  const done = { eventId: 'done', status: 'pending' };
  resetOutboxRecoveryBaseline([]);
  appendOutboxRecoveryOperations([done], { storage, writerId: 'writer-a' });
  resetOutboxRecoveryBaseline([done]);
  appendOutboxRecoveryOperations([], { storage, writerId: 'writer-b' });
  storage.setItem(`${OUTBOX_FALLBACK_LOG_PREFIX}stale-put`, JSON.stringify({
    version: 1, operationId: 'writer-c:1', writerId: 'writer-c', sequence: 1,
    counter: 1, eventId: 'done', kind: 'put', event: done,
  }));
  const restored = restoreOutboxRecoveryOperations({ storage, events: [done] });
  assert.deepEqual(restored.events, []);
}

// Equal Lamport counters resolve deterministically by writer ID, independent
// of localStorage key insertion order.
{
  function seed(reverse) {
    const storage = fakeStorage();
    const records = [
      { version: 1, operationId: 'writer-z:1', writerId: 'writer-z', sequence: 1, counter: 9, eventId: 'same', kind: 'put', event: { eventId: 'same', status: 'failed' } },
      { version: 1, operationId: 'writer-a:1', writerId: 'writer-a', sequence: 1, counter: 9, eventId: 'same', kind: 'put', event: { eventId: 'same', status: 'pending' } },
    ];
    for (const record of reverse ? records.reverse() : records) {
      storage.setItem(`${OUTBOX_FALLBACK_LOG_PREFIX}${record.operationId}`, JSON.stringify(record));
    }
    return restoreOutboxRecoveryOperations({ storage, events: [] }).events;
  }
  assert.deepEqual(seed(false), seed(true));
  assert.equal(seed(false)[0].status, 'failed');
}

// A multi-operation append can fail after an earlier operation reached storage.
// The successful prefix must remain durable, and retrying the same snapshot must
// recover every event even if it appends a duplicate put for the prefix.
{
  const storage = fakeStorage();
  const originalSetItem = storage.setItem.bind(storage);
  let logWrites = 0;
  let failOnce = true;
  storage.setItem = (key, value) => {
    if (key.startsWith(OUTBOX_FALLBACK_LOG_PREFIX) && ++logWrites === 2 && failOnce) {
      failOnce = false;
      throw new Error('injected quota/write failure after first append');
    }
    originalSetItem(key, value);
  };
  const events = [
    { eventId: 'partial-A', status: 'pending' },
    { eventId: 'partial-B', status: 'pending' },
  ];
  resetOutboxRecoveryBaseline([]);
  assert.throws(() => appendOutboxRecoveryOperations(events, {
    storage, writerId: 'partial-writer', logger: { error() {} },
  }), /injected quota\/write failure/);
  assert.equal([...storage.values.keys()].filter(key => key.startsWith(OUTBOX_FALLBACK_LOG_PREFIX)).length, 1,
    'the successful append prefix must not be rolled back or overwritten');

  const retried = appendOutboxRecoveryOperations(events, {
    storage, writerId: 'partial-writer', logger: { error() {} },
  });
  assert.equal(retried.operationCount, 2, 'retry should write the full current snapshot delta');
  const restored = restoreOutboxRecoveryOperations({ storage, events: [] });
  assert.deepEqual(restored.events.map(event => event.eventId), ['partial-A', 'partial-B'],
    'replay must recover all events after a partial append and retry');
}

// Malformed or unsupported records are ignored without making valid records
// inaccessible.
{
  const storage = fakeStorage();
  storage.setItem(`${OUTBOX_FALLBACK_LOG_PREFIX}valid`, JSON.stringify({
    version: 1, operationId: 'tab-a:1', writerId: 'tab-a', sequence: 1,
    counter: 1, eventId: 'valid', kind: 'put', event: { eventId: 'valid' },
  }));
  storage.setItem(`${OUTBOX_FALLBACK_LOG_PREFIX}bad-json`, '{bad json');
  storage.setItem(`${OUTBOX_FALLBACK_LOG_PREFIX}bad-shape`, JSON.stringify({ version: 7, eventId: 'ignored' }));
  storage.setItem(`${OUTBOX_FALLBACK_LOG_PREFIX}mismatched-key`, JSON.stringify({
    version: 1, operationId: 'different-key', writerId: 'tab-b', sequence: 1,
    counter: 1, eventId: 'spoofed', kind: 'put', event: { eventId: 'spoofed' },
  }));
  storage.setItem(`${OUTBOX_FALLBACK_LOG_PREFIX}zero-counter`, JSON.stringify({
    version: 1, operationId: 'zero-counter', writerId: 'tab-c', sequence: 1,
    counter: 0, eventId: 'zero-counter-event', kind: 'put', event: { eventId: 'zero-counter-event' },
  }));
  assert.deepEqual(restoreOutboxRecoveryOperations({ storage, events: [] }).events.map(event => event.eventId), ['valid'],
    'records with mismatched key identity or invalid revision counters must not be replayed');
}

console.log('PASS: naive lost-update characterization, production append-only concurrent additions, tombstone replay, deterministic conflict resolution, and malformed-record handling');
