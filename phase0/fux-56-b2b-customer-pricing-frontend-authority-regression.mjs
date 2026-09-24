import assert from 'node:assert/strict';
import fs from 'node:fs';
const ui=fs.readFileSync('app/src/b2b/customer-pricing.js','utf8');
const html=fs.readFileSync('app/index.html','utf8');
const server=fs.readFileSync('backend/server.js','utf8');
const store=fs.readFileSync('backend/lib/store-sqlite.js','utf8');
assert(ui.includes('/b2b/pricing'));assert(ui.includes("method:'POST'"));assert(ui.includes('b2b:pricing:manage'));assert(!/localStorage|saveJSON/.test(ui));assert(html.includes('b2bCustomerPricingPanel'));assert(server.includes('handleCustomerPricing'));assert(server.includes('b2b:pricing:view'));assert(server.includes('b2b:pricing:manage'));assert(store.includes('customer_pricing_rules'));assert(store.includes('upsertCustomerPricing'));console.log('FUX-56 canonical B2B customer pricing frontend authority regression: PASS');