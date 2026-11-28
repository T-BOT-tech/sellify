import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync('app/src/b2b/customer-pricing.js', 'utf8');
const html = fs.readFileSync('app/index.html', 'utf8');
const server = fs.readFileSync('backend/server.js', 'utf8');
const store = fs.readFileSync('backend/lib/store-sqlite.js', 'utf8');

assert(ui.includes('/b2b/pricing'), 'customer pricing must use the canonical B2B pricing API');
assert(ui.includes("method: 'POST'"), 'customer pricing mutations must use the canonical API');
assert(ui.includes('b2b:pricing:manage'), 'customer pricing mutations must be permission-gated');
assert(!/localStorage|saveJSON/.test(ui), 'the UI must not persist a local pricing ledger');

// Customer pricing references canonical customers.id, not legacy local B2B
// account IDs. The selector must load tenant-scoped canonical customers and
// include only active business customers.
assert(!ui.includes('b2bAccounts'), 'legacy local B2B account IDs must not be sent as canonical customer IDs');
assert(ui.includes('/customers?status=active&limit=200'), 'selector must load active canonical tenant customers');
assert(ui.includes('customerType') && ui.includes("'business'"), 'selector must restrict options to business customers');
assert(ui.includes('Could not load business customers'), 'selector must expose canonical customer loading failures');

assert(html.includes('b2bCustomerPricingPanel'), 'Accounts workspace must expose the canonical customer pricing panel');
assert(server.includes('handleCustomerPricing'), 'backend must expose the canonical customer pricing handler');
assert(server.includes('handleCustomersList') && server.includes('customers:view'), 'canonical customer selection must use the authenticated customer API');
assert(server.includes('b2b:pricing:view') && server.includes('b2b:pricing:manage'), 'backend must enforce B2B pricing permissions');
assert(store.includes('customer_pricing_rules') && store.includes('upsertCustomerPricing'), 'backend store must own customer pricing records');
assert(store.includes('assertBusinessCustomer'), 'backend must validate canonical business customer identity');

console.log('FUX-56 canonical B2B customer pricing frontend authority regression: PASS');
