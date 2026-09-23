import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');

assert.match(html, /<title>Sellify — Commerce Operating System<\/title>/, 'frontend title must identify Sellify');
assert.match(html, /id="brandName"><small>SELLIFY<\/small>/, 'static shell brand must identify Sellify');
assert.doesNotMatch(html, /<title>Stall Ledger — Offline Order Book<\/title>/, 'legacy Stall Ledger title must not remain');
assert.doesNotMatch(html, /id="brandName"><small>STALL LEDGER<\/small>/, 'legacy Stall Ledger shell identity must not remain');

console.log('FUX-31 identity regression: PASS');
