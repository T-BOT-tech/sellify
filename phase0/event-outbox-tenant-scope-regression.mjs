import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertEventTenantScope } from '../backend/lib/event-replay.js';

const scope = { chatId: 'tenant-a', organizationId: 'org-a' };
assert.equal(assertEventTenantScope({ eventId: 'legacy-unscoped', payload: { productId: 'p1' } }, scope), true,
  'legacy events without tenant claims remain compatible with authenticated route scope');
assert.equal(assertEventTenantScope({ tenantChatId: 'tenant-a', payload: {} }, scope), true);
assert.equal(assertEventTenantScope({ payload: { tenantChatId: 'tenant-a' } }, scope), true);
assert.equal(assertEventTenantScope({ organization_id: 'org-a', payload: { _event: { organization_id: 'org-a' } } }, scope), true);

for (const event of [
  { tenantChatId: 'tenant-b', payload: {} },
  { tenant_chat_id: 'tenant-b', payload: {} },
  { payload: { tenantChatId: 'tenant-b' } },
  { payload: { tenant_chat_id: 'tenant-b' } },
]) {
  assert.throws(() => assertEventTenantScope(event, scope), error =>
    error?.statusCode === 403 && error?.code === 'EVENT_TENANT_SCOPE_MISMATCH');
}
for (const event of [
  { organizationId: 'org-b', payload: {} },
  { organization_id: 'org-b', payload: {} },
  { payload: { _event: { organization_id: 'org-b' } } },
]) {
  assert.throws(() => assertEventTenantScope(event, scope), error =>
    error?.statusCode === 403 && error?.code === 'EVENT_ORGANIZATION_SCOPE_MISMATCH');
}

const server = await readFile(new URL('../backend/server.js', import.meta.url), 'utf8');
const start = server.indexOf('async function handleSyncEvents');
const end = server.indexOf('async function handleSync(', start);
assert.ok(start >= 0 && end > start, 'sync event route handler is present');
const handler = server.slice(start, end);
assert.ok(handler.includes('requireSession(req, tenant.chatId)'),
  'event batch requires a tenant-scoped authenticated session');
assert.ok(handler.includes('assertEventTenantScope(candidate, { chatId: tenant.chatId, organizationId: tenant.organizationId })'),
  'each event is checked against authoritative route tenant and organization');
assert.ok(handler.indexOf('assertEventTenantScope(candidate') < handler.indexOf('processSyncEvent(chatId, candidate, session)'),
  'scope validation runs before canonical event processing');

console.log('Event outbox tenant-scope regression: PASS');
console.log('Legacy unscoped compatibility with authenticated route: PASS');
console.log('Cross-tenant envelope and organization claims rejected: PASS');
console.log('Validation before canonical event processing: PASS');
