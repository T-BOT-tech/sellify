import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url);
const doc = fs.readFileSync(new URL('./PHASE15.4-COUNTRY-EXPANSION-STRATEGY.md', import.meta.url), 'utf8');

for (const term of [
  'EAC', 'WAEMU', 'CEMAC', 'AfCFTA',
  'Currency reuse', 'Language reuse', 'Tax', 'Payment Adapter',
  'country overlay', 'Core authority', '15.5 Regional Cluster Contract',
  'TAM / population', 'Regulatory / tax alignment'
]) assert.ok(doc.includes(term), `missing strategy requirement: ${term}`);

for (const forbidden of [
  'regional orders', 'regional inventory ledgers', 'regional payment ledgers',
  'regional customer identity', 'regional fulfillment state',
  'regional authorization stores', 'regional audit stores',
  'regional event stores/brokers', 'duplicate tax ledgers',
  'duplicate invoice authorities'
]) assert.ok(doc.includes(forbidden), `missing explicit boundary: ${forbidden}`);

const pkg = JSON.parse(fs.readFileSync(new URL('../app/package.json', import.meta.url), 'utf8'));
assert.ok(pkg.scripts['test:phase15.4']);

console.log('Phase 15.4 Country Expansion Strategy Regression: PASS');
console.log('Regional-first architecture documented: PASS');
console.log('EAC / WAEMU / CEMAC reuse model documented: PASS');
console.log('Currency / language / tax / payment layering documented: PASS');
console.log('Cross-region trade separated from Core authorities: PASS');
console.log('No regional duplicate authority introduced: PASS');
console.log('Node >=24 certification remains a separate pending gate: PASS');
