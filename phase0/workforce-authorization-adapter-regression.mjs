import assert from 'node:assert/strict';
import { authorizeWorkforceRepositoryAccess } from '../backend/lib/workforce-authorization-adapter.js';

const manager = {
  userId: 'manager-a', chatId: 'chat-a', organizationId: 'org-a', role: 'manager',
};
const base = {
  organization_id: 'org-a', chat_id: 'chat-a',
  entity: 'allocation', operation: 'approve',
  actor: manager,
};
assert.equal(authorizeWorkforceRepositoryAccess(base), true);
assert.equal(authorizeWorkforceRepositoryAccess({ ...base, entity: 'department', operation: 'list' }), true);
assert.equal(authorizeWorkforceRepositoryAccess({ ...base, entity: 'position', operation: 'create' }), true);
assert.equal(authorizeWorkforceRepositoryAccess({ ...base, entity: 'department', operation: 'list', actor: viewer }), false);

const viewer = { ...manager, role: 'viewer' };
assert.equal(authorizeWorkforceRepositoryAccess({ ...base, actor: viewer }), false);

const provider = {
  userId: 'provider-a', chatId: 'chat-a', organizationId: 'org-a', role: 'staff',
  contextualRoles: [{ role: 'service_provider', scopeType: 'RESOURCE', scopeId: 'resource-a' }],
};
const providerRead = {
  organization_id: 'org-a', tenant_id: 'tenant-a', chat_id: 'chat-a',
  actor: provider, entity: 'assignment', operation: 'get',
  resource_id: 'resource-a',
  record: { organization_id: 'org-a', tenant_id: 'tenant-a', resource_id: 'resource-a', location_id: 'location-a' },
};
assert.equal(authorizeWorkforceRepositoryAccess(providerRead), true);
assert.equal(authorizeWorkforceRepositoryAccess({
  ...providerRead, operation: 'update',
}), false);
assert.equal(authorizeWorkforceRepositoryAccess({
  ...providerRead, resource_id: 'resource-b',
  record: { organization_id: 'org-a', tenant_id: 'tenant-a', resource_id: 'resource-b', location_id: 'location-a' },
}), false);
assert.equal(authorizeWorkforceRepositoryAccess({
  ...providerRead, resource_id: null,
  record: { organization_id: 'org-a', tenant_id: 'tenant-a', resource_id: null, location_id: null },
}), false);

assert.equal(authorizeWorkforceRepositoryAccess({
  ...base, organization_id: 'org-b',
}), false);
assert.equal(authorizeWorkforceRepositoryAccess({
  ...base, chat_id: 'chat-b',
}), false);

console.log('PASS Workforce central authorization adapter: roles, permissions, tenant scope, provider resource scope');
