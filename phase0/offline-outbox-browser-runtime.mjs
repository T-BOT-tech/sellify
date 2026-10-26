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
  assert.deepEqual(recovered.ids, ['browser-tab-A', 'browser-tab-B', 'interrupted-event']);

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

  console.log('PASS: concurrent browser pages preserve outbox events and aborted writes remain recoverable.');
  await context.close();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await close();
}
