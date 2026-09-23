import assert from 'node:assert/strict';
globalThis.window = globalThis.window || { __APP_CONFIG__: {} };
const {
  resolvePlatformTenantCountryVerticalComposition,
  platformTenantCountryVerticalCompositionContract,
  assertPlatformTenantCountryVerticalBoundary,
} = await import('../app/src/platform/tenant-country-vertical.js');

let pass = 0;
const ok = (name, fn) => { fn(); pass += 1; console.log(`PASS ${name}`); };

ok('contract is composition-only', () => {
  const c = platformTenantCountryVerticalCompositionContract();
  assert.equal(c.persistence, 'none'); assert.equal(c.mutation, 'none');
  assert.equal(c.authorization, 'existing_authorization_only'); assert.equal(c.duplicateAuthority, false);
});
ok('boundary assertion passes', () => assert.equal(assertPlatformTenantCountryVerticalBoundary().failClosed, true));
ok('Ethiopia tenant composition resolves', () => {
  const r = resolvePlatformTenantCountryVerticalComposition({ tenant: { id: 't1', organizationId: 'o1' }, countryCode: 'ET', config: { businessModel: 'restaurant' }, verticalPacks: ['restaurant'] });
  assert.equal(r.tenant.id, 't1'); assert.equal(r.country.code, 'ET'); assert.equal(r.verticals[0].pack_id, 'restaurant');
});
ok('Kenya composition resolves', () => {
  const r = resolvePlatformTenantCountryVerticalComposition({ tenant: { id: 't2' }, countryCode: 'KE', verticalPacks: ['warehouse'] });
  assert.equal(r.country.code, 'KE'); assert.equal(r.verticals[0].pack_id, 'warehouse');
});
ok('Tanzania composition resolves', () => {
  const r = resolvePlatformTenantCountryVerticalComposition({ tenant: { id: 't3' }, countryCode: 'TZ', verticalPacks: ['logistics'] });
  assert.equal(r.country.code, 'TZ');
});
ok('Nigeria composition resolves', () => {
  const r = resolvePlatformTenantCountryVerticalComposition({ tenant: { id: 't4' }, countryCode: 'NG', verticalPacks: ['agriculture'] });
  assert.equal(r.country.code, 'NG'); assert.equal(r.verticals[0].enabled, null);
});
ok('candidate country fails closed', () => assert.throws(() => resolvePlatformTenantCountryVerticalComposition({ tenant: { id: 't' }, countryCode: 'GH' }), /not an active country pack/));
ok('regional-only country fails closed', () => assert.throws(() => resolvePlatformTenantCountryVerticalComposition({ tenant: { id: 't' }, countryCode: 'UG' }), /not an active country pack/));
ok('unknown country fails closed', () => assert.throws(() => resolvePlatformTenantCountryVerticalComposition({ tenant: { id: 't' }, countryCode: 'ZZ' }), /not an active country pack/));
ok('tenant is required', () => assert.throws(() => resolvePlatformTenantCountryVerticalComposition({ countryCode: 'ET' }), /tenant/));
ok('vertical list rejects duplicates', () => assert.throws(() => resolvePlatformTenantCountryVerticalComposition({ tenant: { id: 't' }, countryCode: 'ET', verticalPacks: ['warehouse', 'warehouse'] }), /duplicates/));
ok('unknown vertical fails closed', () => assert.throws(() => resolvePlatformTenantCountryVerticalComposition({ tenant: { id: 't' }, countryCode: 'ET', verticalPacks: ['mining'] }), /unknown vertical/));
ok('composition has no persistence', () => {
  const r = resolvePlatformTenantCountryVerticalComposition({ tenant: { id: 't' }, countryCode: 'ET' });
  assert.equal(r.persistence, 'none'); assert.equal(r.mutation, 'none');
});
ok('existing authorization remains authority', () => {
  const r = resolvePlatformTenantCountryVerticalComposition({ tenant: { id: 't' }, countryCode: 'ET', verticalPacks: ['restaurant'] });
  assert.equal(r.authorization, 'existing_authorization_only');
});
ok('existing outbox remains event storage', () => {
  const r = resolvePlatformTenantCountryVerticalComposition({ tenant: { id: 't' }, countryCode: 'ET' });
  assert.equal(r.eventStorage, 'existing_outbox_only');
});
console.log(`Phase 16.9 regression: ${pass} PASS / 0 FAIL`);
