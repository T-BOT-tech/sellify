import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'SELLIFY_AI_HANDOFF.md',
  'package.json',
  'app/src/state.js',
  'app/src/config/currency.js',
  'app/src/config/locale-defaults.js',
  'app/src/config/payment-methods.js',
  'app/src/utils/money.js',
  'app/src/i18n/translations.js',
  'backend/lib/store-sqlite.js',
  'backend/lib/payments/provider-registry.js',
  'backend/lib/payments/channel-registry.js',
  'phase0/PHASE14.0-COUNTRY-PACK-BASELINE.md',
];
for (const rel of required) assert(fs.existsSync(path.join(root, rel)), `Missing baseline artifact: ${rel}`);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(pkg.engines?.node, '>=24', 'Node >=24 requirement changed');

const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const state = read('app/src/state.js');
const localeDefaults = read('app/src/config/locale-defaults.js');
const provider = read('backend/lib/payments/provider-registry.js');
const store = read('backend/lib/store-sqlite.js');
const money = read('app/src/utils/money.js');
const docs = read('phase0/PHASE14.0-COUNTRY-PACK-BASELINE.md');

assert(/currencyCode:\s*'INR'/.test(state), 'Existing currency config authority changed');
assert(localeDefaults.includes("Africa/Addis_Ababa") && localeDefaults.includes("ETB"), 'Existing Ethiopia locale hint missing');
assert(provider.includes("'telebirr'") && provider.includes("'cbe'"), 'Existing payment provider identifiers missing');
assert(store.includes('country TEXT') && store.includes('currency TEXT'), 'Organization country/currency authority missing');
assert(money.includes('const DECIMAL_PLACES'), 'Existing money contract missing');
assert(docs.includes('No country persistence schema is introduced'), 'Baseline boundary weakened');
assert(docs.includes('No payment provider is enabled'), 'Provider activation boundary weakened');

const forbidden = [
  'countryTaxStore', 'countryPaymentStore', 'countryInvoiceStore',
  'countryAuthorizationStore', 'countryInventoryStore', 'countryOrderStore',
];
for (const token of forbidden) assert(!docs.includes(token), `Duplicate country authority introduced: ${token}`);

console.log('Phase 14.0 Country Pack Baseline Lock Regression: PASS');
console.log('Existing country / currency / locale / payment authorities preserved: PASS');
console.log('Ethiopia scope recorded without claiming implementation: PASS');
console.log('Country-specific persistence / core duplication: BLOCKED');
console.log('Node >=24 requirement preserved: PASS');
