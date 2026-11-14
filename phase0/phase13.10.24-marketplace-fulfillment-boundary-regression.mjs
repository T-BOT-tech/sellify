import assert from 'node:assert/strict';
import fs from 'node:fs';

const store = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const inventoryStart = store.indexOf('function applyCoreFulfillmentInventoryConsequence(');
const inventoryEnd = store.indexOf('\nfunction hasCourierLocationGrant', inventoryStart);
assert.ok(inventoryStart >= 0 && inventoryEnd > inventoryStart, 'canonical inventory consequence must remain discoverable');
const inventory = store.slice(inventoryStart, inventoryEnd);
assert.match(inventory, /if \(marketplaceOrder\) return \[\]/,
  'Marketplace checkout is the canonical SALE owner; courier completion must not deduct again');

assert.match(store, /function isCanonicalMarketplaceOrderRow\(orderRow\)/, 'Marketplace classification must use canonical SQL order markers');

const assignmentTransitionStart = store.indexOf('export async function transitionDeliveryAssignment(');
const assignmentTransitionEnd = store.indexOf('export async function transitionOrderFulfillment(', assignmentTransitionStart + 40);
assert.ok(assignmentTransitionStart >= 0 && assignmentTransitionEnd > assignmentTransitionStart);
const assignmentTransition = store.slice(assignmentTransitionStart, assignmentTransitionEnd);
assert.match(assignmentTransition, /SELECT o\.server_order_id, o\.order_json,[\s\S]*?o\.marketplace_order_id, o\.is_marketplace/,
  'courier completion transaction must reload canonical Marketplace SQL markers before applying inventory consequences');

const transitionStart = store.indexOf('export async function transitionOrderFulfillment(');
const transitionEnd = store.indexOf('export function coreFulfillmentContract()', transitionStart);
assert.ok(transitionStart >= 0 && transitionEnd > transitionStart);
const transition = store.slice(transitionStart, transitionEnd);
const replay = transition.indexOf('const priorCommand = db.prepare');
const marketplaceGuard = transition.indexOf('MARKETPLACE_CORE_FULFILLMENT_UNSUPPORTED');
const newCommand = transition.indexOf('const freshCommandFingerprint');
assert.ok(replay >= 0 && marketplaceGuard > replay && marketplaceGuard < newCommand,
  'committed generic fulfillment retries must replay before unsupported Marketplace mutation is rejected');

const marketplaceTest = fs.readFileSync(new URL('./phase11.4-marketplace-integrity-regression.mjs', import.meta.url), 'utf8');
for (const marker of [
  'phase13-10-24-marketplace-assignment',
  'phase13-10-24-marketplace-accept',
  'phase13-10-24-marketplace-start',
  'phase13-10-24-marketplace-delivered',
  'MARKETPLACE_CORE_FULFILLMENT_UNSUPPORTED',
  'Marketplace checkout SALE must remain the only inventory movement',
]) assert.ok(marketplaceTest.includes(marker), 'Marketplace runtime regression missing ' + marker);

console.log('Phase 13.10.24 Marketplace fulfillment boundary regression: PASS');
