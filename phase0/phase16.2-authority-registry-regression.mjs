// Phase 16.2 — Canonical Authority Registry regression gate.
import assert from 'node:assert/strict';
import {
  PLATFORM_AUTHORITY_REGISTRY_VERSION,
  listPlatformAuthorities,
  getPlatformAuthority,
  resolveAuthorityForCapability,
  platformAuthorityRegistryContract,
  assertNoPlatformAuthorityClaim,
} from '../app/src/platform/authority-registry.js';

let pass = 0;
let fail = 0;
function check(name, fn) {
  try { fn(); console.log(`PASS ${name}`); pass += 1; }
  catch (error) { console.error(`FAIL ${name}: ${error.message}`); fail += 1; }
}

check('contract version is stable 1.0', () => assert.equal(PLATFORM_AUTHORITY_REGISTRY_VERSION, '1.0'));
check('canonical authority count is 14', () => assert.equal(listPlatformAuthorities().length, 14));
check('supplier network authority exists', () => assert.equal(getPlatformAuthority('supplier_network').authority, 'supplier_network'));
check('commerce authority exists', () => assert.equal(getPlatformAuthority('commerce').authority, 'commerce'));
check('inventory points to canonical stock mutation authority', () => assert.match(getPlatformAuthority('inventory').source, /app\/src\/warehouse\/inventory\.js#applyStockChange/));
check('payments remains existing payment authority', () => assert.equal(getPlatformAuthority('payments').execution, 'existing_domain_authority'));
check('customers points to canonical customer module', () => assert.equal(getPlatformAuthority('customers').source, 'app/src/customers.js'));
check('locations remains organization/location authority', () => assert.equal(getPlatformAuthority('locations').authority, 'locations'));
check('fulfillment points to canonical fulfillment module', () => assert.equal(getPlatformAuthority('fulfillment').source, 'app/src/logistics/fulfillment.js'));
check('documents preserves existing B2B invoice authority', () => assert.match(getPlatformAuthority('documents').source, /store-sqlite\.js#invoices/));
check('events remains existing event boundary', () => assert.match(getPlatformAuthority('events').source, /event-boundary\.js/));
check('supplier network profile resolves to supplier network authority', () => assert.equal(resolveAuthorityForCapability('supplier-network.profile').authority, 'supplier_network'));
check('commerce orders resolve to commerce authority', () => assert.equal(resolveAuthorityForCapability('commerce.orders').authority, 'commerce'));
check('inventory stock resolves to inventory authority', () => assert.equal(resolveAuthorityForCapability('inventory.stock').authority, 'inventory'));
check('payments core resolves to payments authority', () => assert.equal(resolveAuthorityForCapability('payments.core').authority, 'payments'));
check('customers identity resolves to customers authority', () => assert.equal(resolveAuthorityForCapability('customers.identity').authority, 'customers'));
check('locations scope resolves to locations authority', () => assert.equal(resolveAuthorityForCapability('locations.scope').authority, 'locations'));
check('fulfillment operations resolves to fulfillment authority', () => assert.equal(resolveAuthorityForCapability('fulfillment.operations').authority, 'fulfillment'));
check('documents invoices resolve to documents authority', () => assert.equal(resolveAuthorityForCapability('documents.invoices').authority, 'documents'));
check('audit history resolves to audit authority', () => assert.equal(resolveAuthorityForCapability('audit.history').authority, 'audit'));
check('country configuration resolves to country authority', () => assert.equal(resolveAuthorityForCapability('country.configuration').authority, 'country'));
check('vertical configuration resolves to vertical authority', () => assert.equal(resolveAuthorityForCapability('vertical.configuration').authority, 'vertical'));
check('versioned events resolves to events authority', () => assert.equal(resolveAuthorityForCapability('events.versioned').authority, 'events'));
check('unknown authority fails closed', () => assert.throws(() => getPlatformAuthority('regional-commerce'), /Unknown platform authority/));
check('unknown capability authority resolution fails closed', () => assert.throws(() => resolveAuthorityForCapability('regional-commerce.orders'), /No canonical authority/));
check('platform registry declares no persistence', () => assert.equal(platformAuthorityRegistryContract().persistence, 'none'));
check('platform registry keeps central authorization', () => assert.equal(platformAuthorityRegistryContract().authorization, 'backend/lib/authorization.js'));
check('platform registry cannot claim database ownership', () => assert.throws(() => assertNoPlatformAuthorityClaim({ ownsDatabase: true }), /ownsDatabase/));
check('platform registry cannot claim ledger ownership', () => assert.throws(() => assertNoPlatformAuthorityClaim({ ownsLedger: true }), /ownsLedger/));
check('platform registry cannot claim event store ownership', () => assert.throws(() => assertNoPlatformAuthorityClaim({ ownsEventStore: true }), /ownsEventStore/));
check('platform registry cannot claim authorization ownership', () => assert.throws(() => assertNoPlatformAuthorityClaim({ ownsAuthorization: true }), /ownsAuthorization/));
check('authority definitions are cloned and cannot mutate registry', () => {
  const authority = getPlatformAuthority('commerce');
  assert.throws(() => { authority.domains.push('x'); }, /object is not extensible|Cannot add property/);
  assert.equal(getPlatformAuthority('commerce').domains.includes('x'), false);
});

console.log(`Phase 16.2 authority registry: ${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
