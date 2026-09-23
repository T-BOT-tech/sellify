import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');

assert.match(html, /<title>Sellify — Commerce Operating System<\/title>/, 'frontend title must identify Sellify');
assert.match(html, /id="brandName"><small>SELLIFY<\/small>/, 'static shell brand must identify Sellify');
assert.doesNotMatch(html, /<title>Stall Ledger — Offline Order Book<\/title>/, 'legacy Stall Ledger title must not remain');
assert.doesNotMatch(html, /id="brandName"><small>STALL LEDGER<\/small>/, 'legacy Stall Ledger shell identity must not remain');

console.log('FUX-31 identity regression: PASS');

const requiredNavKeys = ['homeNav','takeOrderNav','queueNav','catalogNav','moreNav','marketNav','tablesNav','kitchenNav','customersNav','accountsNav','warehouseNav','logisticsNav','sourcingNav'];
for (const key of requiredNavKeys) {
  assert.match(html, new RegExp('data-i18n="' + key + '"'), 'primary navigation must expose i18n key: ' + key);
}
const en = fs.readFileSync(new URL('../app/src/i18n/locales/en.js', import.meta.url), 'utf8');
assert.match(en, /brandName:\s*"SELLIFY"/, 'English locale brand identity must be Sellify');
console.log('FUX-31 primary navigation localization regression: PASS');
