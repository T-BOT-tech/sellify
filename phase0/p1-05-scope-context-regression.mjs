import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authorize } from '../backend/lib/authorization.js';

const owner = { userId: 'u-owner', role: 'owner', organizationId: 'org-1', chatId: 'chat-1' };
const manager = { userId: 'u-manager', role: 'manager', organizationId: 'org-1', chatId: 'chat-1' };
const viewer = { userId: 'u-viewer', role: 'viewer', organizationId: 'org-1', chatId: 'chat-1' };
const tenant = { chatId: 'chat-1', organizationId: 'org-1' };
const location = { id: 'loc-1', organizationId: 'org-1', status: 'active' };

assert.equal(authorize(owner, tenant, location, 'scope_context', 'locations:view'), 'ALLOW');
assert.equal(authorize(owner, tenant, location, 'scope_context', 'locations:manage'), 'ALLOW');
assert.equal(authorize(manager, tenant, location, 'scope_context', 'locations:view'), 'ALLOW');
assert.equal(authorize(manager, tenant, location, 'scope_context', 'locations:manage'), 'ALLOW');
assert.equal(authorize(viewer, tenant, location, 'scope_context', 'locations:view'), 'DENY');

const server = readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../app/src/authorization/scope-context.js', import.meta.url), 'utf8');
assert.ok(server.includes('handleAuthorizationScopeContext'));
assert.ok(server.includes('scope-context'));
assert.match(server, /locations:manage/);
assert.match(ui, /Selecting a location changes client context; it does not grant authorization/);
assert.match(ui, /\/locations/);

console.log('P1-05 scope/context regression: PASS');
