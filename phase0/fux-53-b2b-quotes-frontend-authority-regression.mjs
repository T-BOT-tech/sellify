// FUX-53 — B2B Quotes frontend authority boundary regression.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync('app/src/b2b/ui.js', 'utf8');
const quotes = fs.readFileSync('app/src/b2b/quotes.js', 'utf8');
const html = fs.readFileSync('app/index.html', 'utf8');
const permissions = fs.readFileSync('app/src/auth/permissions.js', 'utf8');
const state = fs.readFileSync('app/src/state.js', 'utf8');
const outbox = fs.readFileSync('app/src/sync/outbox.js', 'utf8');

assert(!/quote[s]?\s*=\s*\[/.test(ui), 'B2B UI must not introduce a local quote ledger');
assert(!/localStorage.*quote/i.test(ui), 'B2B UI must not persist quotes directly in localStorage');
assert(outbox.includes('enqueueCommand'), 'Existing command outbox remains available for unknown/offline quote commands');
assert(state.includes('config'), 'B2B quote API integration can use canonical session configuration');

console.log('FUX-53 B2B Quotes frontend authority boundary regression: PASS');
console.log('Canonical backend quote authority remains the required integration target.');

assert(quotes.includes("/b2b/quotes"), 'Quotes UI must call the canonical B2B quotes API');
assert(quotes.includes("method: 'POST'"), 'Quotes UI must create quotes through POST');
assert(quotes.includes("method: 'PATCH'"), 'Quotes UI must transition quotes through PATCH');
assert(quotes.includes('Authorization'), 'Quotes UI must send the canonical session authorization');
assert(quotes.includes('b2b:quotes:view'), 'Quotes UI must gate read access');
assert(quotes.includes('b2b:quotes:manage'), 'Quotes UI must gate mutation access');
assert(html.includes('b2bQuotesList'), 'Accounts workspace must expose the canonical quotes projection');
assert(permissions.includes('b2b:quotes:view') && permissions.includes('b2b:quotes:manage'), 'Frontend permission vocabulary must include quote capabilities');
assert(!/localStorage.*quote/i.test(quotes), 'Quotes UI must not persist quote records directly in localStorage');
assert(!/quote[s]?\s*=\s*\[/.test(quotes), 'Quotes UI must not introduce a local quote ledger');

console.log('FUX-53 canonical B2B Quotes frontend integration assertions: PASS');
