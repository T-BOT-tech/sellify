import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  OUTBOX_RECOVERY_KEY,
  mergeOutboxSnapshots,
  restoreOutboxRecoveryJournal,
  writeOutboxRecoveryJournal,
} from '../app/src/sync/outbox-recovery-journal.js';

const outbox = await readFile(new URL('../app/src/sync/outbox.js', import.meta.url), 'utf8');
const hydrate = await readFile(new URL('../app/src/storage/hydrate.js', import.meta.url), 'utf8');
const journal = await readFile(new URL('../app/src/sync/outbox-recovery-journal.js', import.meta.url), 'utf8');

assert.equal(OUTBOX_RECOVERY_KEY, 'sellify.outbox.recovery.v1');
assert.match(outbox, /writeOutboxRecoveryJournal\(outboxEvents, \{\s*onMerged: merged => setOutboxEvents\(merged\),?\s*\}\);\s*saveJSON\(STORAGE_KEYS\.outboxEvents, outboxEvents\);/,
  'the reconciled synchronous recovery journal must be written before the asynchronous IndexedDB save');
assert.match(hydrate, /restoreRecoveryJournal\(\{/,
  'hydration must use the tested recovery journal implementation');
assert.match(hydrate, /apply\(STORAGE_KEYS\.outboxEvents, outboxEvents, v => setOutboxEvents\(v\)\);\s*restoreOutboxRecoveryJournal\(\);/,
  'journal recovery must run after the IndexedDB snapshot is applied');
assert.match(hydrate, /if \(isIdbUnavailable\(\)\) \{\s*restoreOutboxRecoveryJournal\(\);/,
  'journal recovery must also run when IndexedDB is unavailable');
assert.match(hydrate, /catch \(e\) \{\s*console\.error\('IndexedDB hydration read failed[^']*', e\);\s*restoreOutboxRecoveryJournal\(\);/,
  'journal recovery must run when IndexedDB hydration throws');
assert.match(outbox, /const pending = getPendingCommands\(commandType\)\.filter\(command => command\.tenantChatId === activeTenant\)/,
  'command replay must remain restricted to the active tenant');
assert.match(outbox, /String\(e\.tenantChatId \|\| e\.payload\?\.tenantChatId \|\| ''\) === activeTenant/,
  'event replay must remain restricted to the active tenant');

// Behavioral tests use deterministic storage adapters, exercising the real
// production helper without needing to import the browser app singleton.
function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}
const quietLogger = { error() {} };
const stale = [{ eventId: 'completed-command', kind: 'command', status: 'pending' }];
const latest = [{ eventId: 'new-command', kind: 'command', status: 'pending' }];

// Successful write persists the exact current snapshot synchronously.
{
  const storage = fakeStorage();
  assert.equal(writeOutboxRecoveryJournal(latest, { storage, logger: quietLogger }), true);
  assert.deepEqual(JSON.parse(storage.getItem(OUTBOX_RECOVERY_KEY)), latest);
}

// A failed write attempts to delete a stale snapshot so completed work cannot
// be resurrected. The normal persistence caller can still continue to saveJSON.
{
  const storage = fakeStorage({ [OUTBOX_RECOVERY_KEY]: JSON.stringify(stale) });
  storage.setItem = () => { throw new Error('quota exceeded'); };
  assert.equal(writeOutboxRecoveryJournal(latest, { storage, logger: quietLogger }), false);
  assert.equal(storage.getItem(OUTBOX_RECOVERY_KEY), null);
}

// If both write and cleanup fail, failure is contained and explicitly best-effort.
{
  const storage = fakeStorage({ [OUTBOX_RECOVERY_KEY]: JSON.stringify(stale) });
  storage.setItem = () => { throw new Error('quota exceeded'); };
  storage.removeItem = () => { throw new Error('storage blocked'); };
  assert.doesNotThrow(() => writeOutboxRecoveryJournal(latest, { storage, logger: quietLogger }));
  assert.deepEqual(JSON.parse(storage.getItem(OUTBOX_RECOVERY_KEY)), stale);
}

// A transient shared-journal read failure must not overwrite a snapshot
// that may contain another tab's newer work.
{
  const storage = fakeStorage({ [OUTBOX_RECOVERY_KEY]: JSON.stringify(stale) });
  storage.getItem = () => { throw new Error('temporary read failure'); };
  let writes = 0;
  storage.setItem = () => { writes += 1; };
  assert.equal(writeOutboxRecoveryJournal(latest, { storage, logger: quietLogger }), false);
  assert.equal(writes, 0, 'a failed read must not write a possibly stale replacement snapshot');
}

// Recovery overrides an older state (representing stale IndexedDB hydration),
// then mirrors the recovered snapshot through the provided persistence adapter.
{
  const storage = fakeStorage({ [OUTBOX_RECOVERY_KEY]: JSON.stringify(latest) });
  let state = stale;
  let saved = null;
  assert.equal(restoreOutboxRecoveryJournal({
    storage,
    setOutboxEvents: value => { state = value; },
    saveOutbox: value => { saved = value; },
    logger: quietLogger,
  }), true);
  assert.deepEqual(state, latest);
  assert.deepEqual(saved, latest);
}

// Invalid JSON, non-array JSON, and absent journals never replace current state.
for (const raw of ['{broken', JSON.stringify({ eventId: 'not-an-array' }), null]) {
  const storage = raw === null ? fakeStorage() : fakeStorage({ [OUTBOX_RECOVERY_KEY]: raw });
  let calls = 0;
  assert.equal(restoreOutboxRecoveryJournal({
    storage,
    setOutboxEvents: () => { calls += 1; },
    saveOutbox: () => { calls += 1; },
    logger: quietLogger,
  }), false);
  assert.equal(calls, 0);
}

// Storage read failures are contained and do not mutate application state.
{
  const storage = fakeStorage();
  storage.getItem = () => { throw new Error('storage blocked'); };
  let calls = 0;
  assert.equal(restoreOutboxRecoveryJournal({
    storage,
    setOutboxEvents: () => { calls += 1; },
    saveOutbox: () => { calls += 1; },
    logger: quietLogger,
  }), false);
  assert.equal(calls, 0);
}

// Deterministic stale-tab regressions: unrelated concurrent additions survive,
// explicit removals beat stale copies, and an unchanged stale tab cannot
// resurrect an item another tab has already removed.
{
  const baseline = [
    { eventId: 'shared-existing', status: 'pending' },
  ];
  const tabA = [
    { eventId: 'shared-existing', status: 'pending' },
    { eventId: 'tab-a-new', status: 'pending' },
  ];
  const sharedAfterTabB = [
    { eventId: 'shared-existing', status: 'pending' },
    { eventId: 'tab-b-new', status: 'pending' },
  ];
  const merged = mergeOutboxSnapshots(baseline, tabA, sharedAfterTabB);
  assert.deepEqual(new Set(merged.map(event => event.eventId)),
    new Set(['shared-existing', 'tab-a-new', 'tab-b-new']));
}
{
  const completed = { eventId: 'completed-command', kind: 'command', status: 'pending' };
  const unrelated = { eventId: 'other-command', kind: 'command', status: 'pending' };
  const merged = mergeOutboxSnapshots([completed, unrelated], [unrelated], [completed, unrelated]);
  assert.deepEqual(merged, [unrelated], 'a local completion must remove the completed event from the shared snapshot');
}
{
  const completed = { eventId: 'completed-command', kind: 'command', status: 'pending' };
  const merged = mergeOutboxSnapshots([completed], [completed], [],);
  assert.deepEqual(merged, [], 'an unchanged stale tab must not resurrect a completed command');
}

// Keep the production helper's catch boundaries visible to this contract test.
assert.match(journal, /storage\.removeItem\(OUTBOX_RECOVERY_KEY\)/);
assert.match(journal, /if \(!Array\.isArray\(recovered\)\) return false/);
assert.match(journal, /snapshot = mergeOutboxSnapshots\(baseline, events, shared\)/,
  'journal writes must merge local mutations into the latest shared snapshot');

const commandSuccessMatch = outbox.match(/await flushCommand\(command\);([\s\S]*?)processed \+= 1;/);
assert.ok(commandSuccessMatch, 'command success path must be present');
assert.match(commandSuccessMatch[1],
  /setOutboxEvents\(outboxEvents\.filter\(event => event\.eventId !== command\.eventId\)\);\s*persist\(\);/,
  'successful commands must be removed from the recovery snapshot before persisting');

console.log('PASS: behavioral outbox journal write, read-failure preservation, stale-snapshot cleanup, restore/mirror, invalid-data handling, storage failures, and tenant-bound replay guards');
