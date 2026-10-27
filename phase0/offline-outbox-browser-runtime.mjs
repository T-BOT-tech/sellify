import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    if (pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><meta charset="utf-8"><title>Sellify outbox browser regression</title>');
      return;
    }
    // Match the production browser-module boundary: only exact, reviewed
    // browser-safe backend policy modules and the declarative shared manifest
    // may be served. Never expose the backend tree or persistent data.
    const backendModules = new Set([
      'lib/authorization.js',
      'lib/country-security-expansion.js',
      'lib/country-security-isolation.js',
      'lib/payments/channel-registry.js',
      'lib/payments/provider-errors.js',
      'lib/payments/provider-registry.js',
      'lib/resource-action-registry.js',
      'lib/security-context.js',
      'lib/tenant-isolation.js',
    ]);
    const sharedModules = new Set(['vertical-pack-manifests.js']);
    let filePath;
    if (pathname.startsWith('/app/src/')) {
      filePath = path.resolve(root, `.${pathname}`);
      if (!filePath.startsWith(path.join(root, 'app', 'src') + path.sep)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
    } else if (pathname.startsWith('/backend/')) {
      const relativePath = pathname.slice('/backend/'.length);
      if (!backendModules.has(relativePath)) {
        console.error('Browser regression server rejected backend module path:', pathname);
        res.writeHead(404).end('Not found');
        return;
      }
      filePath = path.resolve(root, 'backend', relativePath);
      if (!filePath.startsWith(path.join(root, 'backend') + path.sep)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
    } else if (pathname.startsWith('/shared/')) {
      const relativePath = pathname.slice('/shared/'.length);
      if (!sharedModules.has(relativePath)) {
        console.error('Browser regression server rejected shared module path:', pathname);
        res.writeHead(404).end('Not found');
        return;
      }
      filePath = path.resolve(root, 'shared', relativePath);
      if (!filePath.startsWith(path.join(root, 'shared') + path.sep)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
    } else {
      console.error('Browser regression server rejected module path:', pathname);
      res.writeHead(404).end('Not found');
      return;
    }
    let body;
    try {
      body = await readFile(filePath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        console.error('Browser regression module file missing:', pathname, filePath);
        res.writeHead(404).end('Module file not found');
        return;
      }
      throw error;
    }
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
    res.end(body);
  } catch (error) {
    console.error('Browser regression server request failed:', req.url, error);
    res.writeHead(500).end(String(error));
  }
});

const listen = () => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
let browser;
try {
  const port = await listen();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  context.on('page', page => {
    page.on('pageerror', error => console.error('Browser page error:', error));
    page.on('console', message => {
      if (message.type() === 'error') console.error('Browser console error:', message.text());
    });
  });
  const first = await context.newPage();
  const second = await context.newPage();
  const base = `http://127.0.0.1:${port}`;
  await Promise.all([first.goto(base), second.goto(base)]);
  await first.evaluate(async () => {
    localStorage.clear();
    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase('ledger_db');
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('database deletion blocked'));
    });
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  });
  await second.evaluate(() => Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }));

  const preparePage = page => page.evaluate(async () => {
    const idb = await import('/app/src/storage/idb.js');
    const journal = await import('/app/src/sync/outbox-recovery-journal.js');
    journal.resetOutboxRecoveryBaseline([]);
    journal.resetOutboxIndexedDbBaseline([]);
    return true;
  });
  await Promise.all([preparePage(first), preparePage(second)]);

  const enqueue = (page, eventId) => page.evaluate(async id => {
    // Exercise the production enqueue -> persist path, not a test-only
    // reimplementation of the transaction sequence.
    const outbox = await import('/app/src/sync/outbox.js');
    outbox.enqueueEvent('browser-runtime-regression', { source: id }, { eventId: id });
  }, eventId);

  // Separate page realms share origin storage but run the real outbox module.
  await Promise.all([enqueue(first, 'browser-tab-A'), enqueue(second, 'browser-tab-B')]);
  const waitForConcurrentCommit = await first.evaluate(async () => {
    const idb = await import('/app/src/storage/idb.js');
    const journal = await import('/app/src/sync/outbox-recovery-journal.js');
    const deadline = Date.now() + 10000;
    let events = [];
    let marker = null;
    let snapshot = null;
    while (Date.now() < deadline) {
      events = await idb.idbGet('ledger_outbox_events') || [];
      marker = await idb.idbGet(journal.OUTBOX_RECOVERY_COMMIT_KEY);
      snapshot = JSON.parse(localStorage.getItem(journal.OUTBOX_RECOVERY_KEY) || 'null');
      const ids = events.map(event => event.eventId).sort();
      if (ids.includes('browser-tab-A') && ids.includes('browser-tab-B')) {
        return {
          indexedDbIds: ids,
          journalIds: (snapshot?.events || []).map(event => event.eventId).sort(),
          markerMatchesJournal: marker?.journalWritten === true && marker?.attemptId === snapshot?.snapshotId,
        };
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return {
      indexedDbIds: events.map(event => event.eventId).sort(),
      journalIds: (snapshot?.events || []).map(event => event.eventId).sort(),
      markerMatchesJournal: marker?.journalWritten === true && marker?.attemptId === snapshot?.snapshotId,
    };
  });
  const concurrent = waitForConcurrentCommit;
  assert.deepEqual(concurrent.indexedDbIds, ['browser-tab-A', 'browser-tab-B']);
  assert.deepEqual(concurrent.journalIds, ['browser-tab-A', 'browser-tab-B']);
  assert.equal(concurrent.markerMatchesJournal, true);

  // An already-open tab must observe another tab's committed snapshot without reload.
  await enqueue(second, 'cross-tab-visible-event');
  const visible = await first.evaluate(async () => {
    const deadline = Date.now() + 10000;
    const state = await import('/app/src/state.js');
    while (Date.now() < deadline) {
      if (state.outboxEvents.some(event => event.eventId === 'cross-tab-visible-event')) {
        return state.outboxEvents.map(event => event.eventId).sort();
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    return state.outboxEvents.map(event => event.eventId).sort();
  });
  assert.ok(visible.includes('cross-tab-visible-event'), 'open tab should reconcile a peer tab event without reload');

  assert.ok(visible.includes('browser-tab-A'), 'reconciliation should preserve local pending events');

  // A peer may complete an event while this tab still holds a stale copy
  // whose retry metadata changes. Completion must win without dropping other
  // independent pending work.
  const staleRemoval = await first.evaluate(async () => {
    const { mergeOutboxSnapshots } = await import('/app/src/sync/outbox-recovery-journal.js');
    const previous = [
      { eventId: 'completed-in-peer-tab', status: 'pending', attempts: 0 },
      { eventId: 'unrelated-pending-event', status: 'pending', attempts: 0 },
    ];
    const local = [
      { eventId: 'completed-in-peer-tab', status: 'pending', attempts: 1, lastError: 'stale retry' },
      { eventId: 'unrelated-pending-event', status: 'pending', attempts: 1, lastError: 'temporary failure' },
    ];
    const shared = [
      { eventId: 'unrelated-pending-event', status: 'pending', attempts: 0 },
    ];
    const merged = mergeOutboxSnapshots(previous, local, shared);
    return {
      ids: merged.map(event => event.eventId).sort(),
      unrelatedAttempts: merged.find(event => event.eventId === 'unrelated-pending-event')?.attempts,
    };
  });
  assert.deepEqual(staleRemoval.ids, ['unrelated-pending-event'], 'a stale local retry must not resurrect an event removed by a peer');
  assert.equal(staleRemoval.unrelatedAttempts, 1, 'independent pending work should retain local retry metadata');
  // An updater failure after the journal write must abort the IDB value and marker.
  const aborted = await first.evaluate(async () => {
    const idb = await import('/app/src/storage/idb.js');
    const journal = await import('/app/src/sync/outbox-recovery-journal.js');
    const markerBefore = await idb.idbGet(journal.OUTBOX_RECOVERY_COMMIT_KEY);
    journal.resetOutboxRecoveryBaseline([]);
    let journalWrite;
    await assertRejects(idb.idbUpdateAndSet('ledger_outbox_events', () => {
      journalWrite = journal.writeOutboxRecoveryJournal(
        [{ eventId: 'interrupted-event', status: 'pending' }],
        { onMerged: () => {} },
      );
      throw new Error('intentional transaction abort');
    }, journal.OUTBOX_RECOVERY_COMMIT_KEY, () => ({
      version: 1, attemptId: journalWrite.attemptId,
      previousSnapshotId: journalWrite.previousSnapshotId, journalWritten: journalWrite.written,
    })));
    const markerAfter = await idb.idbGet(journal.OUTBOX_RECOVERY_COMMIT_KEY);
    const snapshot = JSON.parse(localStorage.getItem(journal.OUTBOX_RECOVERY_KEY));
    return {
      markerUnchanged: JSON.stringify(markerAfter) === JSON.stringify(markerBefore),
      journalHasInterruptedEvent: snapshot.events.some(event => event.eventId === 'interrupted-event'),
    };
    async function assertRejects(promise) {
      try { await promise; } catch { return; }
      throw new Error('Expected IndexedDB update to reject');
    }
  });
  assert.equal(aborted.markerUnchanged, true);
  assert.equal(aborted.journalHasInterruptedEvent, true);

  // Reload into a fresh module realm and verify the uncommitted journal is recoverable.
  await second.reload();
  const recovered = await second.evaluate(async () => {
    const idb = await import('/app/src/storage/idb.js');
    const journal = await import('/app/src/sync/outbox-recovery-journal.js');
    const marker = await idb.idbGet(journal.OUTBOX_RECOVERY_COMMIT_KEY);
    let restored = null;
    const didRestore = journal.restoreOutboxRecoveryJournal({
      indexedDbCommit: marker,
      setOutboxEvents: events => { restored = events; },
      saveOutbox: () => {},
    });
    return { didRestore, ids: (restored || []).map(event => event.eventId).sort() };
  });
  assert.equal(recovered.didRestore, true);
  assert.deepEqual(recovered.ids, ['browser-tab-A', 'browser-tab-B', 'cross-tab-visible-event', 'interrupted-event']);

  // A full recovery-journal quota must not make an otherwise available IndexedDB write disappear.
  // Simulate quota only for the journal key; IndexedDB remains writable.
  const quota = await first.evaluate(async () => {
    const idb = await import('/app/src/storage/idb.js');
    const journal = await import('/app/src/sync/outbox-recovery-journal.js');
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === journal.OUTBOX_RECOVERY_KEY) {
        const error = new DOMException('Storage quota exceeded', 'QuotaExceededError');
        throw error;
      }
      return originalSetItem.call(this, key, value);
    };
    try {
      const outbox = await import('/app/src/sync/outbox.js');
      outbox.enqueueEvent('browser-runtime-regression', { source: 'quota' }, { eventId: 'quota-journal-event' });
      const deadline = Date.now() + 10000;
      let events = [];
      let marker = null;
      while (Date.now() < deadline) {
        events = await idb.idbGet('ledger_outbox_events') || [];
        marker = await idb.idbGet(journal.OUTBOX_RECOVERY_COMMIT_KEY);
        if (events.some(event => event.eventId === 'quota-journal-event')) break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return {
        eventPersistedInIndexedDb: events.some(event => event.eventId === 'quota-journal-event'),
        markerRecordsJournalWriteFailure: marker?.version === 1 && marker?.journalWritten === false,
        priorJournalPreserved: Boolean(localStorage.getItem(journal.OUTBOX_RECOVERY_KEY)),
      };
    } finally {
      Storage.prototype.setItem = originalSetItem;
    }
  });
  assert.equal(quota.eventPersistedInIndexedDb, true);
  assert.equal(quota.markerRecordsJournalWriteFailure, true);
  assert.equal(quota.priorJournalPreserved, true);

  // Use a fresh browser context so concurrent enqueue activity from the
  // preceding multi-tab test cannot mutate this migration-failure fixture.
  const migrationContext = await browser.newContext();
  const migrationBrowserErrors = [];
  migrationContext.on('page', page => {
    page.on('pageerror', error => {
      migrationBrowserErrors.push(error.message);
      console.error('Migration test browser page error:', error);
    });
    page.on('console', message => {
      if (message.type() === 'error') {
        migrationBrowserErrors.push(message.text());
        console.error('Migration test browser console error:', message.text());
      }
    });
  });
  const migrationPage = await migrationContext.newPage();
  await migrationPage.goto(base);
  const migrationAbort = await migrationPage.evaluate(async () => {
    const listFallbackKeys = () => Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter(key => typeof key === 'string' && key.startsWith('sellify.outbox.recovery.log.v1:'));
    const journal = await import('/app/src/sync/outbox-recovery-journal.js');
    journal.resetOutboxRecoveryBaseline([]);
    const event = {
      eventId: 'fallback-migration-abort-event',
      status: 'pending',
      payload: { source: 'migration-abort-regression' },
    };
    journal.appendOutboxRecoveryOperations([event], {
      storage: localStorage,
      writerId: 'migration-abort-regression-writer',
    });
    const logKeysBefore = listFallbackKeys();
    if (!logKeysBefore.length) throw new Error('Expected append-only recovery record before migration');

    const hydration = await import('/app/src/storage/hydrate.js');
    const idb = await import('/app/src/storage/idb.js');
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === 'ledger_outbox_events'
          && Array.isArray(value)
          && value.some(item => item.eventId === event.eventId)) {
        throw new DOMException('Injected append-log checkpoint failure', 'UnknownError');
      }
      return originalPut.call(this, value, key);
    };
    try {
      await hydration.hydrateFromIndexedDB();
    } finally {
      IDBObjectStore.prototype.put = originalPut;
    }

    const keysAfterAbort = listFallbackKeys();
    if (!logKeysBefore.every(key => keysAfterAbort.includes(key))) {
      throw new Error(`Append-only recovery records were removed after an aborted checkpoint: before=${JSON.stringify(logKeysBefore)}, after=${JSON.stringify(keysAfterAbort)}`);
    }

    await hydration.hydrateFromIndexedDB();
    const keysAfterRetry = listFallbackKeys();
    const persisted = await idb.idbGet('ledger_outbox_events') || [];
    const fallbackRecords = keysAfterRetry.map(key => ({
      key,
      value: localStorage.getItem(key),
    }));
    return {
      logCountBefore: logKeysBefore.length,
      logCountAfterAbort: keysAfterAbort.length,
      logCountAfterRetry: keysAfterRetry.length,
      eventPersisted: persisted.some(item => item.eventId === event.eventId),
      persistedEventIds: persisted.map(item => item.eventId),
      inMemoryEventIds: (await import('/app/src/state.js')).outboxEvents?.map(item => item.eventId) || [],
      fallbackRecords,
    };
  });
  assert.ok(migrationAbort.logCountBefore > 0, 'migration test must begin with a durable append-log record');
  assert.ok(migrationAbort.logCountAfterAbort >= migrationAbort.logCountBefore, 'failed checkpoint must retain append-log records');
  assert.equal(migrationAbort.eventPersisted, true,
    `retry must checkpoint the pending event into IndexedDB; diagnostics=${JSON.stringify(migrationAbort)}`);
  assert.equal(migrationAbort.logCountAfterRetry, 0, 'append-log records may be removed only after successful checkpoint');

  // If IndexedDB checkpoint succeeds but localStorage cleanup fails, a durable
  // IndexedDB checkpoint ledger must prevent stale operation replay on reboot.
  const cleanupFailure = await migrationPage.evaluate(async () => {
    const journal = await import('/app/src/sync/outbox-recovery-journal.js');
    const hydration = await import('/app/src/storage/hydrate.js');
    const idb = await import('/app/src/storage/idb.js');
    const eventId = 'fallback-cleanup-failure-event';
    journal.resetOutboxRecoveryBaseline([]);
    journal.appendOutboxRecoveryOperations([{ eventId, status: 'pending', attempts: 0 }], {
      storage: localStorage, writerId: 'cleanup-failure-regression-writer',
    });
    const originalRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (typeof key === 'string' && key.startsWith('sellify.outbox.recovery.log.v1:')) {
        throw new DOMException('Injected cleanup failure', 'UnknownError');
      }
      return originalRemoveItem.call(this, key);
    };
    try {
      await hydration.hydrateFromIndexedDB();
    } finally {
      Storage.prototype.removeItem = originalRemoveItem;
    }
    const keysRemain = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
      .filter(key => typeof key === 'string' && key.startsWith('sellify.outbox.recovery.log.v1:'));
    const checkpointIds = await idb.idbGet(journal.OUTBOX_FALLBACK_CHECKPOINT_KEY) || [];
    const journalSnapshot = JSON.parse(localStorage.getItem(journal.OUTBOX_RECOVERY_KEY));
    await idb.idbSet('ledger_outbox_events', [{ eventId, status: 'completed', attempts: 7 }]);
    await idb.idbSet(journal.OUTBOX_RECOVERY_COMMIT_KEY, {
      version: 1, journalWritten: false, previousSnapshotId: journalSnapshot.snapshotId,
    });
    await hydration.hydrateFromIndexedDB();
    const stored = await idb.idbGet('ledger_outbox_events') || [];
    return {
      staleLogRetained: keysRemain.some(key => localStorage.getItem(key)?.includes(eventId)),
      operationCheckpointed: checkpointIds.some(id => keysRemain.some(key => key.endsWith(id))),
      storedEvent: stored.find(event => event.eventId === eventId) || null,
    };
  });
  assert.equal(cleanupFailure.staleLogRetained, true, 'injected cleanup failure should leave the operation record behind');
  assert.equal(cleanupFailure.operationCheckpointed, true, 'successful checkpoint must durably identify the operation');
  assert.deepEqual(cleanupFailure.storedEvent, { eventId: 'fallback-cleanup-failure-event', status: 'completed', attempts: 7 },
    'later hydration must not replay the stale append-log over newer IndexedDB data');
  await migrationContext.close();

  console.log('PASS: concurrent browser pages preserve outbox events; aborted recovery and migration writes remain recoverable.');
  await context.close();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await close();
}
