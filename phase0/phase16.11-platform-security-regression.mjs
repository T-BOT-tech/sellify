import assert from 'node:assert/strict';

globalThis.window = globalThis.window ?? { __APP_CONFIG__: {} };

const { getPlatformCapability } = await import('../app/src/platform/capability-contract.js');
const {
  validatePlatformSecurityRequest,
  resolvePlatformSecurityRequest,
  authorizePlatformRequest,
  platformSecurityContract,
} = await import('../app/src/platform/platform-security.js');

let pass = 0;
function ok(condition, message) { assert.equal(condition, true, message); pass += 1; }
function throwsCode(fn, code) { assert.throws(fn, (e) => e?.code === code); pass += 1; }
async function rejectsCode(fn, code) { await assert.rejects(fn, (e) => e?.code === code); pass += 1; }

const capability = getPlatformCapability('customers.identity');
ok(capability.capability === 'customers.identity', 'canonical customer capability exists');

const context = {
  actorId: 'actor-1', sessionId: 'session-1', chatId: 'chat-1',
  organizationId: 'org-1', role: 'manager', countryCode: 'ET',
  locationId: 'loc-1',
};

const request = validatePlatformSecurityRequest({
  capability: 'customers.identity', action: 'view', context,
});
ok(request.capability === 'customers.identity', 'request normalized');
ok(request.action === 'view', 'action normalized');

const resolved = resolvePlatformSecurityRequest({
  capability: 'customers.identity', action: 'view', context,
});
ok(resolved.authority.authority === 'customers', 'customer authority resolved');
ok(resolved.composition.tenant.id === 'org-1', 'tenant composition preserved');

for (const field of ['database','credentials','secrets','authorizationStore','transactionEngine','ledger','eventStore','broker','ownsDatabase']) {
  throwsCode(() => validatePlatformSecurityRequest({ capability: 'customers.identity', action: 'view', context, [field]: true }), 'PLATFORM_SECURITY_FORBIDDEN_FIELD');
}

throwsCode(() => validatePlatformSecurityRequest({ capability: 'customers.identity', action: 'view', context: { ...context, organizationId: null } }), 'PLATFORM_SECURITY_CONTEXT_INVALID');
throwsCode(() => resolvePlatformSecurityRequest({ capability: 'customers.identity', action: 'delete', context }), 'PLATFORM_SECURITY_ACTION_DENIED');

const allowed = await authorizePlatformRequest({ capability: 'customers.identity', action: 'view', context });
ok(allowed.allowed === true, 'existing authorization allows manager customer view');
ok(allowed.authority === 'customers', 'execution remains customer authority');
ok(allowed.persistence === 'none', 'security boundary has no persistence');

const deniedContext = { ...context, role: 'viewer' };
await rejectsCode(() => authorizePlatformRequest({ capability: 'customers.identity', action: 'view', context: deniedContext }), 'PLATFORM_SECURITY_DENIED');

const crossOrg = { ...context, organizationId: 'org-2', organization: { id: 'org-2' } };
await rejectsCode(() => authorizePlatformRequest({ capability: 'customers.identity', action: 'view', context: crossOrg }), 'PLATFORM_SECURITY_DENIED');

const candidateCountry = { ...context, countryCode: 'GH' };
await rejectsCode(() => authorizePlatformRequest({ capability: 'customers.identity', action: 'view', context: candidateCountry }), 'PLATFORM_SECURITY_SCOPE_DENIED');

const regionalCountry = { ...context, countryCode: 'UG' };
await rejectsCode(() => authorizePlatformRequest({ capability: 'customers.identity', action: 'view', context: regionalCountry }), 'PLATFORM_SECURITY_SCOPE_DENIED');

const contract = platformSecurityContract();
ok(contract.failClosed === true, 'security boundary fails closed');
ok(contract.duplicateAuthorizationAuthority === false, 'no duplicate authorization');
ok(contract.duplicateIdentityAuthority === false, 'no duplicate identity');
ok(contract.duplicateDatabase === false, 'no duplicate database');
ok(contract.duplicateEventStore === false, 'no duplicate event store');
ok(contract.credentials === 'never_owned_or_stored', 'credentials never owned');
ok(contract.forbiddenAuthorities.includes('transactionEngine'), 'transaction engine forbidden');

console.log(`Phase 16.11 platform security regression: ${pass} PASS / 0 FAIL`);
