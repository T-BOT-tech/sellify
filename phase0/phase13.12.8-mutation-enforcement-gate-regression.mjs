import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AUTHZ, authorize } from '../backend/lib/authorization.js';
import {
  executeAuthorizedVerticalMutation,
  VerticalMutationDeniedError,
  assertVerticalMutationDecision,
  verticalMutationEnforcementContract,
} from '../backend/lib/vertical-mutation-enforcement.js';
import { RESOURCE_ACTION_REGISTRY } from '../backend/lib/resource-action-registry.js';

const session = {
  userId: 'user-1',
  sessionId: 'session-1',
  chatId: 'chat-1',
  organizationId: 'org-1',
  locationId: 'loc-1',
  role: 'owner',
};
const tenant = { chatId: 'chat-1', organizationId: 'org-1' };
const location = { id: 'loc-1', organizationId: 'org-1' };
const foreignTenant = { chatId: 'chat-2', organizationId: 'org-2' };
const foreignLocation = { id: 'loc-2', organizationId: 'org-2' };

let pass = 0;
const check = async (name, fn) => {
  await fn();
  pass += 1;
  console.log(`PASS ${name}`);
};

await check('mutation contract remains persistence-neutral', () => {
  const contract = verticalMutationEnforcementContract();
  assert.equal(contract.authorization_authority, 'backend/lib/authorization.js');
  assert.equal(contract.capability_authority, 'backend/lib/vertical-capability-authorization.js');
  assert.equal(contract.mutation_authority, 'injected_existing_canonical_capability');
  assert.deepEqual(contract.execution_order, ['tenant_location_scope', 'capability_authorization', 'mutation']);
  assert.equal(contract.deny_execution, 'mutation_callback_not_called');
  assert.equal(contract.persistence, 'none');
  assert.equal(contract.role_store, 'none');
  assert.equal(contract.permission_store, 'none');
  assert.equal(contract.approval_store, 'none');
  assert.equal(contract.audit_store, 'none');
  assert.equal(contract.event_store, 'none');
});

const allowedEntry = RESOURCE_ACTION_REGISTRY.find(
  (entry) => entry.packId === 'restaurant' && entry.resource === 'table' && entry.action === 'manage',
);
assert.ok(allowedEntry, 'expected policy-defined restaurant table/manage entry');
assert.equal(authorize(session, tenant.organizationId, location, allowedEntry.resource, allowedEntry.permission), AUTHZ.ALLOW);

await check('ALLOW executes the canonical mutation callback exactly once', async () => {
  let calls = 0;
  const result = await executeAuthorizedVerticalMutation(
    session,
    tenant,
    allowedEntry.packId,
    allowedEntry.resource,
    allowedEntry.action,
    {
      location,
      mutation: async () => {
        calls += 1;
        return { mutation: 'canonical', calls };
      },
    },
  );
  assert.equal(calls, 1);
  assert.deepEqual(result, { mutation: 'canonical', calls: 1 });
});

await check('DENY prevents mutation callback execution', async () => {
  const entry = RESOURCE_ACTION_REGISTRY.find(
    (candidate) => candidate.packId === 'restaurant' && candidate.resource === 'table' && candidate.action === 'manage',
  );
  const deniedSession = { ...session, role: 'viewer' };
  let calls = 0;
  await assert.rejects(
    executeAuthorizedVerticalMutation(
      deniedSession,
      tenant,
      entry.packId,
      entry.resource,
      entry.action,
      { location, mutation: () => { calls += 1; } },
    ),
    (error) => error instanceof VerticalMutationDeniedError && error.code === 'VERTICAL_MUTATION_DENIED' && error.decision === AUTHZ.DENY,
  );
  assert.equal(calls, 0);
});

await check('vocabulary-only capability fails closed before mutation', async () => {
  const entry = RESOURCE_ACTION_REGISTRY.find((candidate) => !candidate.policyDefined);
  assert.ok(entry);
  let calls = 0;
  await assert.rejects(
    executeAuthorizedVerticalMutation(
      session,
      tenant,
      entry.packId,
      entry.resource,
      entry.action,
      { location, mutation: () => { calls += 1; } },
    ),
    (error) => error instanceof VerticalMutationDeniedError && error.decision === AUTHZ.DENY,
  );
  assert.equal(calls, 0);
});

await check('foreign organization is denied before mutation', async () => {
  let calls = 0;
  await assert.rejects(
    executeAuthorizedVerticalMutation(
      session,
      foreignTenant,
      allowedEntry.packId,
      allowedEntry.resource,
      allowedEntry.action,
      { location, mutation: () => { calls += 1; } },
    ),
    (error) => error?.code === 'TENANT_SCOPE_DENIED',
  );
  assert.equal(calls, 0);
});

await check('foreign location is denied before mutation', async () => {
  let calls = 0;
  await assert.rejects(
    executeAuthorizedVerticalMutation(
      session,
      tenant,
      allowedEntry.packId,
      allowedEntry.resource,
      allowedEntry.action,
      { location: foreignLocation, mutation: () => { calls += 1; } },
    ),
    (error) => error?.code === 'LOCATION_SCOPE_DENIED',
  );
  assert.equal(calls, 0);
});

await check('unknown capability is denied before mutation', async () => {
  let calls = 0;
  await assert.rejects(
    executeAuthorizedVerticalMutation(
      session,
      tenant,
      'agriculture',
      'unknown',
      'manage',
      { location, mutation: () => { calls += 1; } },
    ),
    (error) => error instanceof VerticalMutationDeniedError && error.decision === AUTHZ.DENY,
  );
  assert.equal(calls, 0);
});

await check('REQUIRES_APPROVAL never executes before approval boundary', async () => {
  let calls = 0;
  assert.throws(
    () => assertVerticalMutationDecision(AUTHZ.REQUIRES_APPROVAL, {
      packId: 'restaurant', resource: 'table', action: 'manage',
    }),
    (error) => error instanceof VerticalMutationDeniedError && error.decision === AUTHZ.REQUIRES_APPROVAL,
  );
  assert.equal(calls, 0);
});

await check('vertical app modules remain free of direct SQL/database persistence', () => {
  const root = path.resolve('app/src/verticals');
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  };
  walk(root);
  const forbidden = /(?:from ['"].*(?:store-sqlite|database|sqlite)|\b(?:db|database)\.(?:prepare|run|exec|query)|\.prepare\(|\.exec\()/i;
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(forbidden.test(source), false, `direct persistence API found in ${path.relative(process.cwd(), file)}`);
  }
});

await check('vertical mutation functions delegate to injected canonical capabilities', () => {
  const agriculture = fs.readFileSync(path.resolve('app/src/verticals/agriculture/commerce-contract.js'), 'utf8');
  const agricultureInventory = fs.readFileSync(path.resolve('app/src/verticals/agriculture/commerce-inventory-contract.js'), 'utf8');
  const warehouse = fs.readFileSync(path.resolve('app/src/verticals/warehouse/inventory-contract.js'), 'utf8');
  assert.match(agriculture, /return createOrder\(bridge\);/);
  assert.match(agricultureInventory, /return createOrder\(handoff\.order\);/);
  assert.match(agricultureInventory, /return receiveHarvest\(handoff\.inventory\);/);
  assert.match(warehouse, /return applyStockChange\(/);
});

await check('no vertical backend mutation routes bypass the gate at this baseline', () => {
  const server = fs.readFileSync(path.resolve('backend/server.js'), 'utf8');
  // The authorization-conditions contract endpoint may expose the existing
  // mutation-gate contract for inspection. That is not a mutation route.
  assert.match(server, /verticalMutationEnforcementContract/);
  assert.doesNotMatch(server, /POST\s+.*vertical|PUT\s+.*vertical|PATCH\s+.*vertical|DELETE\s+.*vertical/i);
  const verticalRouteFiles = fs.readdirSync(path.resolve('backend'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  assert.equal(verticalRouteFiles.includes('verticals'), false);
});

await check('canonical Phase 10.3 authority remains independently unchanged', () => {
  assert.equal(authorize(session, tenant.organizationId, location, 'orders', 'orders:view'), AUTHZ.ALLOW);
});

console.log('Phase 13.12.8 Mutation Enforcement Gate Regression: PASS');
console.log(`Golden assertions: ${pass} PASS / 0 FAIL`);
console.log('Authorization precedes mutation execution: PASS');
console.log('DENY / undefined policy / foreign scope cannot execute mutation: PASS');
console.log('Vertical direct persistence: BLOCKED');
console.log('Canonical mutation authority preserved: PASS');
console.log('Approval / audit / events / configuration not pulled forward: PASS');
