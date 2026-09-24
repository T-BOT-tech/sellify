// FUX-53 — B2B Quotes frontend authority boundary regression.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync('app/src/b2b/ui.js', 'utf8');
const state = fs.readFileSync('app/src/state.js', 'utf8');
const outbox = fs.readFileSync('app/src/sync/outbox.js', 'utf8');

assert(!/quote[s]?\s*=\s*\[/.test(ui), 'B2B UI must not introduce a local quote ledger');
assert(!/localStorage.*quote/i.test(ui), 'B2B UI must not persist quotes directly in localStorage');
assert(outbox.includes('enqueueCommand'), 'Existing command outbox remains available for unknown/offline quote commands');
assert(state.includes('config'), 'B2B quote API integration can use canonical session configuration');

console.log('FUX-53 B2B Quotes frontend authority boundary regression: PASS');
console.log('Canonical backend quote authority remains the required integration target.');
