import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  OUTBOX_RECOVERY_KEY,
  OUTBOX_RECOVERY_COMMIT_KEY,
  getOutboxIndexedDbBaseline,
  getOutboxRecoveryBaseline,
  mergeOutboxSnapshots,
  resetOutboxIndexedDbBaseline,
  resetOutboxRecoveryBaseline,
  sameOutboxSnapshot,
  restoreOutboxRecoveryJournal,
  withOutboxPersistenceLock,
  writeOutboxRecoveryJournal,
} from '../app/src/sync/outbox-recovery-journal.js';

const outbox = await readFile(new URL('../app/src/sync/outbox.js', import.meta.url), 'utf8');
const hydrate = await readFile(new URL('../app/src/storage/hydrate.js', import.meta.url), 'utf8');
const journal = await readFile(new URL('../app/src/sync/outbox-recovery-journal.js', import.meta.url), 'utf8');
const idb = await readFile(new URL('../app/src/storage/idb.js', import.meta.url), 'utf8');

assert.equal(OUTBOX_RECOVERY_KEY, 'sellify.outbox.recovery.v1');
assert.equal(OUTBOX_RECOVERY_COMMIT_KEY, 'ledger_outbox_recovery_commit_v1');

// Browser Web Locks must serialize the journal write and its matching IDB
// marker as one exclusive persistence sequence across tabs.
{
  let tail = Promise.resolve();
  let active = 0;
  let maxActive = 0;
  const lockManager = {
    request(name, options, callback) {
      assert.equal(name, 'sellify-outbox-persistence-v1');
      assert.equal(options.mode, 'exclusive');
      const next = tail.then(() => callback());
      tail = next.catch(() => {});
      return next;
    },
  };
  const work = () => withOutboxPersistenceLock(async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active -= 1;
  }, lockManager);
  await Promise.all([work(), work(), work()]);
  assert.equal(maxActive, 1, 'concurrent persistence callbacks must not overlap under the exclusive lock');
}
{
  let called = false;
  const result = withOutboxPersistenceLock(() => { called = true; return 'fallback'; }, null);
  assert.equal(called, true, 'browsers without Web Locks must retain the synchronous fallback path');
  assert.equal(result, 'fallback');
}
// Without Web Locks, async persistence callbacks must still serialize within
// this tab so a later journal/IDB marker pair cannot overtake an earlier one.
{
  let active = 0;
  let maxActive = 0;
  const order = [];
  const work = label => withOutboxPersistenceLock(async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    order.push(`start:${label}`);
    await new Promise(resolve => setTimeout(resolve, 5));
    order.push(`end:${label}`);
    active -= 1;
  }, null);
  await Promise.all([work('first'), work('second'), work('third')]);
  assert.equal(maxActive, 1, 'lockless async persistence callbacks in one tab must not overlap');
  assert.deepEqual(order, [
    'start:first', 'end:first',
    'start:second', 'end:second',
    'start:third', 'end:third',
  ], 'lockless persistence callbacks must retain invocation order');
}
// A rejected lockless operation must not poison the queue or let the next
// persistence callback overtake the unfinished operation. A synchronous callback
// arriving during an async write is queued too, then retains its own result.
{
  const order = [];
  const first = withOutboxPersistenceLock(async () => {
    order.push('start:first-fails');
    await new Promise(resolve => setTimeout(resolve, 5));
    order.push('end:first-fails');
    throw new Error('simulated persistence failure');
  }, null);
  const second = withOutboxPersistenceLock(() => {
    order.push('second-sync-callback');
    return 'second-result';
  }, null);
  const [firstResult, secondResult] = await Promise.allSettled([first, second]);
  assert.equal(firstResult.status, 'rejected', 'the original persistence failure must remain observable');
  assert.match(firstResult.reason.message, /simulated persistence failure/);
  assert.deepEqual(secondResult, { status: 'fulfilled', value: 'second-result' },
    'a failed operation must not poison later queued persistence work');
  assert.deepEqual(order, ['start:first-fails', 'end:first-fails', 'second-sync-callback'],
    'queued callbacks must wait for a failed operation to settle before running');
}

assert.ok(outbox.includes("if (isIdbUnavailable())"),
  'the IndexedDB-unavailable fallback must remain present');
assert.ok(outbox.includes("journalWrite = writeOutboxRecoveryJournal(localEvents"),
  'the recovery journal write must run inside the IndexedDB transaction updater');

assert.ok(idb.includes("typeof additionalWrite.value === 'function'"),
  'the transaction helper must support a commit marker derived after the updater runs');
assert.ok(idb.includes("export function idbUpdateAndSet(key, updater, sidecarKey, sidecarValue)"),
  'the transaction helper must expose an atomic outbox-plus-marker write');
assert.match(idb, /export function idbGetAll\(keys\)[\s\S]*?db\.transaction\(IDB_STORE_NAME, 'readonly'\)[\s\S]*?for \(const key of keys\)[\s\S]*?tx\.oncomplete = \(\) => resolve\(values\)/,
  'hydration must read the outbox and its commit marker from one readonly snapshot');
assert.match(outbox, /idbUpdateAndSet\\(STORAGE_KEYS\\.outboxEvents, storedEvents =>[\\s\\S]*?mergeOutboxSnapshots\\(indexedDbBaseline, localEvents, Array\\.isArray\\(storedEvents\\) \\? storedEvents : \\]\\)[\\s\\S]*?OUTBOX_RECOVERY_COMMIT_KEY, \\(\\) => \\(\\{[\\s\\S]*?journalWritten: journalWrite\\.written/,
  'the outbox commit must atomically record whether its transaction-serialized journal replacement succeeded');
assert.match(idb, /request\.onerror = \(\) => \{\s*try \{ tx\.abort\(\); \} catch \{\}\s*reject\(request\.error \|\| new Error\('IndexedDB update read failed for ' \+ key\)\);\s*\};[\s\S]*?tx\.oncomplete = \(\) => resolve\(nextValue\);\s*tx\.onerror = \(\) => reject\(tx\.error \|\| new Error\('IndexedDB update failed for ' \+ key\)\);\s*tx\.onabort = \(\) => reject\(tx\.error \|\| new Error\('IndexedDB update transaction aborted for ' \+ key\)\);/,
  'IDB read errors, transaction errors, and aborts must reject idbUpdate so the outbox fallback runs instead of hanging');
assert.match(outbox, /\.catch\(error => \{[\s\S]*?Atomic IndexedDB outbox update failed; falling back to saveJSON[\s\S]*?saveJSON\(STORAGE_KEYS\.outboxEvents, outboxEvents\);/,
  'an IndexedDB transaction failure must persist the current outbox, not a snapshot captured before newer same-tab mutations');
assert.match(outbox, /const indexedDbBaseline = getOutboxIndexedDbBaseline\(\) \|\| localEvents;[\s\S]*?mergeOutboxSnapshots\(indexedDbBaseline, localEvents, Array\.isArray\(storedEvents\) \? storedEvents : \[\]\)/,
  'IndexedDB reconciliation must use a baseline independent from the synchronously updated recovery journal');
assert.match(outbox, /\.then\(merged => \{\s*resetOutboxIndexedDbBaseline\(merged\);/,
  'the IndexedDB baseline must advance only after the atomic IndexedDB transaction commits');
assert.match(outbox, /if \(sameOutboxSnapshot\(outboxEvents, localEvents\)\) \{\s*setOutboxEvents\(merged\);/,
  'an IndexedDB completion must not replace newer same-tab mutations to an existing event');
assert.doesNotMatch(outbox, /currentIds\.length === savedIds\.length && currentIds\.every/,
  'matching event IDs alone must not be treated as an unchanged snapshot');

// Same event IDs are not sufficient evidence that the live state is unchanged:
// retry metadata, status, payload, and other fields can change while IDB commits.
{
  const before = [{ eventId: 'same-event', status: 'pending', attempts: 0 }];
  const unchangedClone = [{ eventId: 'same-event', status: 'pending', attempts: 0 }];
  const changedExistingEvent = [{ eventId: 'same-event', status: 'failed', attempts: 1 }];
  assert.equal(sameOutboxSnapshot(before, unchangedClone), true,
    'equal full snapshots may be replaced by the committed merged snapshot');
  assert.equal(sameOutboxSnapshot(before, changedExistingEvent), false,
    'a same-ID status/attempt mutation must be preserved while a transaction is in flight');
  assert.equal(sameOutboxSnapshot(before, [{ eventId: 'same-event', status: 'pending', attempts: 0, lastError: null }]), false,
    'adding or clearing metadata is also a mutation even when IDs are unchanged');
}
 
// Baselines must not share nested payload references with live event objects.
// An in-place payload edit otherwise mutates both "before" and "now", hiding
// the delta from the three-way merge and risking loss of the local change.
{
  const liveEvent = { eventId: 'nested-payload', status: 'pending', payload: { amount: 10, details: { sku: 'A' } } };
  resetOutboxRecoveryBaseline([liveEvent]);
  liveEvent.payload.details.sku = 'B';
  const baseline = [{ eventId: 'nested-payload', status: 'pending', payload: { amount: 10, details: { sku: 'A' } } }];
  const merged = mergeOutboxSnapshots(baseline, [liveEvent], baseline);
  assert.equal(merged[0].payload.details.sku, 'B',
    'nested in-place payload edits must remain visible against an immutable baseline');
  const exposedBaseline = getOutboxRecoveryBaseline();
  assert.equal(exposedBaseline[0].payload.details.sku, 'A',
    'reading a baseline must not expose nested references that can mutate its stored snapshot');
}
assert.match(hydrate, /restoreRecoveryJournal\(\{/,
  'hydration must use the tested recovery journal implementation');
assert.match(hydrate, /idbGetAll\(\[\.\.\.Object\.values\(STORAGE_KEYS\), OUTBOX_RECOVERY_COMMIT_KEY\]\)/,
  'hydration must read the recovery commit marker in the same snapshot as the outbox');
assert.match(hydrate, /apply\(STORAGE_KEYS\.outboxEvents, outboxEvents, v => setOutboxEvents\(v\)\);\s*resetOutboxIndexedDbBaseline\(Array\.isArray\(fromIdb\[STORAGE_KEYS\.outboxEvents\]\)[\s\S]*?restoreOutboxRecoveryJournal\(\{\s*indexedDbCommit: Array\.isArray\(fromIdb\[STORAGE_KEYS\.outboxEvents\]\)[\s\S]*?fromIdb\[OUTBOX_RECOVERY_COMMIT_KEY\]/,
  'successful hydration must compare journal recovery against the atomically loaded IndexedDB commit marker');
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

// IDB reconciliation must retain the pre-journal delta: a completed item is
// deleted from the journal synchronously, then removed from the still-stale IDB
// value when its transaction commits.
{
  const storage = fakeStorage({ [OUTBOX_RECOVERY_KEY]: JSON.stringify(stale) });
  resetOutboxRecoveryBaseline(stale);
  resetOutboxIndexedDbBaseline(stale);
  const committedOutbox = [];
  assert.equal(writeOutboxRecoveryJournal(committedOutbox, { storage, logger: quietLogger }).written, true);
  assert.deepEqual(JSON.parse(storage.getItem(OUTBOX_RECOVERY_KEY)).events, []);
  assert.deepEqual(getOutboxIndexedDbBaseline(), stale,
    'writing the localStorage journal must not advance the last committed IndexedDB baseline');
  const idbAfterDelete = mergeOutboxSnapshots(getOutboxIndexedDbBaseline(), committedOutbox, stale);
  assert.deepEqual(idbAfterDelete, [], 'the IDB transaction must not resurrect an entry just removed from the recovery journal');
}

// When hydration recovers an entry missing from IndexedDB, the separate empty
// IDB baseline makes the recovered entry a local addition to be committed.
{
  const storage = fakeStorage({ [OUTBOX_RECOVERY_KEY]: JSON.stringify(latest) });
  resetOutboxRecoveryBaseline([]);
  resetOutboxIndexedDbBaseline([]);
  let recoveredOutbox = [];
  assert.equal(restoreOutboxRecoveryJournal({
    storage,
    setOutboxEvents: value => { recoveredOutbox = value; },
    saveOutbox() {},
    logger: quietLogger,
  }), true);
  const idbAfterRecovery = mergeOutboxSnapshots(getOutboxIndexedDbBaseline(), recoveredOutbox, []);
  assert.deepEqual(idbAfterRecovery, latest,
    'the next IDB transaction must persist entries recovered from the journal instead of dropping them as stale');
}

// Successful write persists the exact current snapshot synchronously.
{
  const storage = fakeStorage();
  assert.equal(writeOutboxRecoveryJournal(latest, { storage, logger: quietLogger }).written, true);
  assert.deepEqual(JSON.parse(storage.getItem(OUTBOX_RECOVERY_KEY)).events, latest);
}

// A failed replacement must preserve the last known-good snapshot. Removing
// it could lose unrelated pending work if IndexedDB also fails before exit.
{
  const storage = fakeStorage();
  resetOutboxRecoveryBaseline(stale);
  const initialWrite = writeOutboxRecoveryJournal(stale, { storage, logger: quietLogger });
  assert.equal(initialWrite.written, true);
  storage.setItem = () => { throw new Error('quota exceeded'); };
  let removals = 0;
  storage.removeItem = () => { removals += 1; };
  const failedWrite = writeOutboxRecoveryJournal(latest, { storage, logger: quietLogger });
  assert.equal(failedWrite.written, false);
  assert.equal(removals, 0, 'failed replacement must not delete the last known-good journal');
  assert.deepEqual(JSON.parse(storage.getItem(OUTBOX_RECOVERY_KEY)).events, stale);

  // If IndexedDB commits after the journal replacement failed, its atomic
  // marker must prevent the stale journal from overriding the committed state.
  let hydrated = [];
  const restoredAfterCommit = restoreOutboxRecoveryJournal({
    storage,
    setOutboxEvents: value => { hydrated = value; },
    saveOutbox() {},
    logger: quietLogger,
    indexedDbCommit: {
      version: 1,
      attemptId: failedWrite.attemptId,
      previousSnapshotId: failedWrite.previousSnapshotId,
      journalWritten: false,
    },
  });
  assert.equal(restoredAfterCommit, false, 'a committed IDB update supersedes the journal version that failed to update');
  assert.deepEqual(hydrated, [], 'successful IDB hydration must keep its newer committed outbox');
}

// A journal written ahead of an interrupted IDB transaction remains recoverable.
{
  const storage = fakeStorage();
  resetOutboxRecoveryBaseline(stale);
  const priorWrite = writeOutboxRecoveryJournal(stale, { storage, logger: quietLogger });
  const nextWrite = writeOutboxRecoveryJournal(latest, { storage, logger: quietLogger });
  assert.equal(nextWrite.written, true);
  let recovered = [];
  assert.equal(restoreOutboxRecoveryJournal({
    storage,
    setOutboxEvents: value => { recovered = value; },
    saveOutbox() {},
    logger: quietLogger,
    indexedDbCommit: {
      version: 1,
      attemptId: priorWrite.attemptId,
      previousSnapshotId: null,
      journalWritten: true,
    },
  }), true, 'a journal newer than the last successful IDB marker must be recovered');
  assert.deepEqual(recovered, latest);
}

// A transient shared-journal read failure must not overwrite a snapshot
// that may contain another tab's newer work.
{
  const storage = fakeStorage({ [OUTBOX_RECOVERY_KEY]: JSON.stringify(stale) });
  storage.getItem = () => { throw new Error('temporary read failure'); };
  let writes = 0;
  storage.setItem = () => { writes += 1; };
  assert.equal(writeOutboxRecoveryJournal(latest, { storage, logger: quietLogger }).written, false);
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
{
  const completed = { eventId: 'completed-command', kind: 'command', status: 'pending', attempts: 0 };
  const staleRetry = { ...completed, attempts: 1, lastAttemptAt: 123 };
  const merged = mergeOutboxSnapshots([completed], [staleRetry], []);
  assert.deepEqual(merged, [],
    'a stale retry/update must not resurrect an event another tab removed after completion');
}

// Concurrent edits to one event merge by field against the common baseline.
// A local payload edit and a shared retry update are independent and both survive.
{
  const baseline = [{
    eventId: 'same-event', status: 'pending', attempts: 0,
    payload: { amount: 10 }, lastError: null,
  }];
  const local = [{
    eventId: 'same-event', status: 'pending', attempts: 0,
    payload: { amount: 12 }, lastError: null,
  }];
  const shared = [{
    eventId: 'same-event', status: 'pending', attempts: 1,
    payload: { amount: 10 }, lastError: 'temporary network failure',
  }];
  const merged = mergeOutboxSnapshots(baseline, local, shared);
  assert.deepEqual(merged, [{
    eventId: 'same-event', status: 'pending', attempts: 1,
    payload: { amount: 12 }, lastError: 'temporary network failure',
  }], 'independent local and shared fields must not overwrite each other');
}

// A divergent edit to the same field uses an explicit deterministic policy:
// retain the shared journal field while preserving local-only field changes.
{
  const baseline = [{ eventId: 'same-event', status: 'pending', attempts: 0, lastError: null }];
  const local = [{ eventId: 'same-event', status: 'failed', attempts: 1, lastError: 'local error' }];
  const shared = [{ eventId: 'same-event', status: 'rejected', attempts: 2, lastError: 'shared error' }];
  const merged = mergeOutboxSnapshots(baseline, local, shared);
  assert.deepEqual(merged, [{
    eventId: 'same-event', status: 'rejected', attempts: 2, lastError: 'shared error',
  }], 'same-field conflicts must resolve deterministically to the shared snapshot');
}

// A property removed locally must be removed only when the shared snapshot did
// not independently change that property.
{
  const baseline = [{ eventId: 'same-event', status: 'pending', lastError: 'old' }];
  const local = [{ eventId: 'same-event', status: 'pending' }];
  const shared = [{ eventId: 'same-event', status: 'pending', lastError: 'new shared error', attempts: 1 }];
  const merged = mergeOutboxSnapshots(baseline, local, shared);
  assert.deepEqual(merged, [{
    eventId: 'same-event', status: 'pending', lastError: 'new shared error', attempts: 1,
  }], 'a local deletion must not erase an independently changed shared field');
}

// Keep the production helper's catch boundaries visible to this contract test.
assert.doesNotMatch(journal, /storage\.removeItem\(OUTBOX_RECOVERY_KEY\)/, 'failed journal replacement must preserve the last known-good snapshot');
assert.match(journal, /function parseRecoverySnapshot\(raw\)[\s\S]*?if \(Array\.isArray\(parsed\)\) return \{ events: parsed, snapshotId: null \}/,
  'recovery must continue accepting legacy array snapshots while recognizing versioned journal records');
assert.match(journal, /snapshot = mergeOutboxSnapshots\(baseline, events, shared\)/,
  'journal writes must merge local mutations into the latest shared snapshot');

const commandSuccessMatch = outbox.match(/await flushCommand\(command\);([\s\S]*?)processed \+= 1;/);
assert.ok(commandSuccessMatch, 'command success path must be present');
assert.match(commandSuccessMatch[1],
  /setOutboxEvents\(outboxEvents\.filter\(event => event\.eventId !== command\.eventId\)\);\s*persist\(\);/,
  'successful commands must be removed from the recovery snapshot before persisting');

console.log('PASS: outbox journal write/read, last-known-good preservation, stale-journal commit precedence, interrupted-commit recovery, invalid-data handling, and tenant-bound replay guards');
