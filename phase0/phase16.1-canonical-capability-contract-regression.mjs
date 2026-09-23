import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getPlatformCapability,
  listPlatformCapabilities,
  definePlatformCapability,
  resolveCapabilityAction,
  platformCapabilityContract,
  isPlatformCapability,
} from '../app/src/platform/capability-contract.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let checks = 0;
const ok = (v, m) => { checks += 1; assert.equal(Boolean(v), true, m); };
const eq = (a, b, m) => { checks += 1; assert.deepEqual(a, b, m); };

const capabilities = listPlatformCapabilities();
ok(capabilities.length >= 10, 'canonical capability registry exists');
for (const required of [
  'commerce.orders', 'commerce.products', 'inventory.stock', 'payments.core',
  'customers.identity', 'locations.scope', 'fulfillment.operations',
  'documents.invoices', 'audit.history', 'country.configuration',
  'vertical.configuration', 'events.versioned',
]) ok(capabilities.includes(required), `required capability exists: ${required}`);

const orders = getPlatformCapability('commerce.orders');
eq(orders.authority, 'commerce', 'orders authority remains commerce');
eq(orders.resource, 'orders', 'orders resource is canonical');
ok(orders.actions.includes('create'), 'orders create action declared');
eq(orders.persistence, undefined, 'registry metadata does not expose persistence');

const resolved = resolveCapabilityAction('commerce.orders', 'create');
eq(resolved.authorizationAction, 'orders:create', 'capability action maps to existing authorization vocabulary');
eq(resolved.status, 'available', 'core capability is available');

const custom = definePlatformCapability({
  capability: 'test.example',
  authority: 'commerce',
  resource: 'orders',
  actions: ['view'],
  authorityModule: 'existing test authority',
  status: 'available',
});
ok(isPlatformCapability(custom), 'valid custom capability satisfies contract');
assert.throws(() => definePlatformCapability({
  capability: 'bad.persistence', authority: 'commerce', resource: 'orders', actions: ['view'],
  authorityModule: 'x', status: 'available', database: 'new-store',
}), /persistence|storage/i); checks += 1;
assert.throws(() => definePlatformCapability({
  capability: 'bad.auth', authority: 'commerce', resource: 'orders', actions: ['view'],
  authorityModule: 'x', status: 'available', ownsAuthorization: true,
}), /forbidden authority/i); checks += 1;
assert.throws(() => resolveCapabilityAction('commerce.orders', 'manage'), /Unsupported action/); checks += 1;

const contract = platformCapabilityContract();
eq(contract.version, '1.0', 'platform capability contract version');
eq(contract.execution, 'delegation_only', 'execution remains delegation-only');
eq(contract.persistence, 'none', 'platform capability layer owns no persistence');
eq(contract.authorization, 'existing authorization authority', 'authorization remains existing authority');
eq(contract.duplicateAuthority, false, 'no duplicate domain authority');

const source = read('app/src/platform/capability-contract.js');
ok(!/CREATE\s+TABLE|new\s+Database|platform[-_]?(store|ledger|database|event-store)/i.test(source), 'capability layer has no new store/ledger/database');
ok(!/enqueueEvent\s*\(/.test(source), 'capability registry does not directly enqueue events');

console.log(`PHASE16.1 CANONICAL CAPABILITY CONTRACT: ${checks} PASS / 0 FAIL`);
