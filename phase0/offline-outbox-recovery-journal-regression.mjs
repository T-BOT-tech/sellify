import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const outbox = await readFile(new URL('../app/src/sync/outbox.js', import.meta.url), 'utf8');
const hydrate = await readFile(new URL('../app/src/storage/hydrate.js', import.meta.url), 'utf8');

const recoveryKey = 'sellify.outbox.recovery.v1';
assert.ok(outbox.includes(recoveryKey), 'outbox writes must use a versioned recovery journal key');
assert.ok(hydrate.includes(recoveryKey), 'startup hydration must read the same recovery journal key');

const persistMatch = outbox.match(/function persist\(\) \{([\s\S]*?)\n\}/);
assert.ok(persistMatch, 'outbox must expose the expected persistence boundary');
const persistBody = persistMatch[1];
assert.ok(
  persistBody.indexOf('localStorage.setItem') >= 0
    && persistBody.indexOf('localStorage.setItem') < persistBody.indexOf('saveJSON'),
  'the synchronous recovery journal must be written before the asynchronous IndexedDB save'
);
assert.match(persistBody, /JSON\.stringify\(outboxEvents\)/);
assert.match(persistBody, /catch \(error\)/, 'journal storage failures must not prevent the existing IndexedDB path');
assert.match(persistBody, /localStorage\.removeItem\('sellify\.outbox\.recovery\.v1'\)/, 'a failed journal update must attempt to remove the stale snapshot so it cannot resurrect completed work');

const restoreMatch = hydrate.match(/function restoreOutboxRecoveryJournal\(\) \{([\s\S]*?)\n\}/);
assert.ok(restoreMatch, 'startup hydration must provide a recovery-journal restore boundary');
assert.match(restoreMatch[1], /JSON\.parse\(raw\)/);
assert.match(restoreMatch[1], /Array\.isArray\(recovered\)/, 'invalid journal shapes must not replace the outbox');
assert.match(restoreMatch[1], /setOutboxEvents\(recovered\)/);
assert.match(restoreMatch[1], /saveJSON\(STORAGE_KEYS\.outboxEvents, recovered\)/);

// IndexedDB may overwrite the synchronously loaded state, so recovery must run
// after that application as well as when IndexedDB is unavailable.
assert.match(
  hydrate,
  /if \(isIdbUnavailable\(\)\) \{[\s\S]*?restoreOutboxRecoveryJournal\(\);/,
  'the recovery journal must also be used when IndexedDB cannot be opened'
);
assert.match(
  hydrate,
  /apply\(STORAGE_KEYS\.outboxEvents, outboxEvents, v => setOutboxEvents\(v\)\);\s*restoreOutboxRecoveryJournal\(\);/,
  'journal recovery must run after the IndexedDB snapshot is applied'
);
assert.match(
  hydrate,
  /catch \(e\) \{\s*console\.error\('IndexedDB hydration read failed[^']*', e\);\s*restoreOutboxRecoveryJournal\(\);/,
  'journal recovery must run when IndexedDB hydration throws, not only when IndexedDB is marked unavailable'
);


const commandSuccessMatch = outbox.match(/await flushCommand\(command\);([\s\S]*?)processed \+= 1;/);
assert.ok(commandSuccessMatch, 'command success path must be present');
assert.match(
  commandSuccessMatch[1],
  /setOutboxEvents\(outboxEvents\.filter\(event => event\.eventId !== command\.eventId\)\);\s*persist\(\);/,
  'successful commands must be removed from the recovery snapshot before persisting'
);
assert.match(
  outbox,
  /const pending = getPendingCommands\(commandType\)\.filter\(command => command\.tenantChatId === activeTenant\)/,
  'command replay must remain restricted to the active tenant'
);
assert.match(
  outbox,
  /String\(e\.tenantChatId \|\| e\.payload\?\.tenantChatId \|\| ''\) === activeTenant/,
  'event replay must remain restricted to the active tenant'
);

console.log('PASS: offline outbox recovery journal write ordering, hydration failure recovery, completed-command cleanup, and tenant-bound replay guards');
