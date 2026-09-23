// Phase 14.10 — Country Security / Isolation regression.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTHZ, authorize } from '../backend/lib/authorization.js';
import { TENANT_SCOPE, tenantScopeDecision } from '../backend/lib/tenant-isolation.js';
import {
  COUNTRY_SECURITY,
  authorizeCountryAction,
  countryScopeDecision,
  countrySecurityIsolationContract,
} from '../backend/lib/country-security-isolation.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const serverSource = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
const tenantSource = fs.readFileSync(path.join(root, 'backend/lib/tenant-isolation.js'), 'utf8');
const authSource = fs.readFileSync(path.join(root, 'backend/lib/authorization.js'), 'utf8');

const organization = { id: 'org-et-a', country: 'ET' };
const foreignOrganization = { id: 'org-ke-b', country: 'KE' };
const tenant = { chatId: 'chat-et-a', organizationId: 'org-et-a' };
const foreignTenant = { chatId: 'chat-ke-b', organizationId: 'org-ke-b' };
const session = { userId: 'user-et', chatId: 'chat-et-a', organizationId: 'org-et-a', role: 'owner' };
const sameOrgLocation = { id: 'loc-et-a', organizationId: 'org-et-a' };
const foreignLocation = { id: 'loc-ke-b', organizationId: 'org-ke-b' };

let checks = 0;
function ok(condition, message) { checks += 1; assert.equal(Boolean(condition), true, message); }
function eq(actual, expected, message) { checks += 1; assert.equal(actual, expected, message); }

// Country scope is subordinate to canonical tenant/location scope.
eq(countryScopeDecision(session, tenant, organization, 'ET', sameOrgLocation), COUNTRY_SECURITY.ALLOW, 'matching Ethiopia country and same-org location allowed');
eq(countryScopeDecision(session, tenant, organization, 'ethiopia', sameOrgLocation), COUNTRY_SECURITY.ALLOW, 'Ethiopia alias normalizes to ET');
eq(countryScopeDecision(session, tenant, organization, 'KE', sameOrgLocation), COUNTRY_SECURITY.DENY, 'country mismatch denied');
eq(countryScopeDecision(session, tenant, foreignOrganization, 'ET', sameOrgLocation), COUNTRY_SECURITY.DENY, 'organization identity mismatch denied');
eq(countryScopeDecision(session, foreignTenant, organization, 'ET', sameOrgLocation), COUNTRY_SECURITY.DENY, 'foreign tenant denied');
eq(countryScopeDecision(session, tenant, organization, 'ET', foreignLocation), COUNTRY_SECURITY.DENY, 'foreign location denied');
eq(countryScopeDecision(session, tenant, { id: organization.id, country: '' }, 'ET', sameOrgLocation), COUNTRY_SECURITY.DENY, 'missing organization country fails closed');
eq(countryScopeDecision(session, tenant, organization, '', sameOrgLocation), COUNTRY_SECURITY.DENY, 'missing requested country fails closed');

// Matching country does not bypass the existing role policy.
eq(authorizeCountryAction(session, tenant, organization, sameOrgLocation, 'ET', 'orders', 'orders:view'), AUTHZ.ALLOW, 'owner retains existing authorization');
const viewer = { ...session, role: 'viewer' };
eq(authorizeCountryAction(viewer, tenant, organization, sameOrgLocation, 'ET', 'orders', 'orders:view'), AUTHZ.DENY, 'country match does not grant a new role permission');
eq(authorizeCountryAction(session, tenant, organization, sameOrgLocation, 'KE', 'orders', 'orders:view'), AUTHZ.DENY, 'country mismatch blocks authorization');

// Existing authorities remain canonical.
eq(tenantScopeDecision(session, tenant, sameOrgLocation), TENANT_SCOPE.ALLOW, 'canonical tenant/location scope remains authoritative');
eq(authorize(session, organization, sameOrgLocation, 'orders', 'orders:view'), AUTHZ.ALLOW, 'canonical authorization remains authoritative');
ok(tenantSource.includes('tenantScopeDecision'), 'country layer delegates tenant isolation');
ok(authSource.includes('export function authorize'), 'central authorization remains present');
ok(serverSource.includes('assertTenantScope(session, tenant);'), 'server tenant boundary remains intact');
ok(serverSource.includes('assertLocationScope(session, tenant, location);'), 'server location boundary remains intact');
ok(countrySecurityIsolationContract().country_permission_store === false, 'no country permission store');
ok(countrySecurityIsolationContract().country_membership_store === false, 'no country membership store');
ok(!fs.existsSync(path.join(root, 'backend/lib/country-permission-store.js')), 'no duplicate country permission store introduced');
ok(!fs.existsSync(path.join(root, 'backend/lib/country-membership.js')), 'no duplicate country membership authority introduced');

eq(countrySecurityIsolationContract().tenant_scope_authority, 'backend/lib/tenant-isolation.js', 'tenant authority points to canonical module');
eq(countrySecurityIsolationContract().authorization_authority, 'backend/lib/authorization.js', 'authorization authority points to canonical module');

console.log('Phase 14.10 Country Security / Isolation Regression: PASS');
console.log(`Golden assertions: ${checks} PASS / 0 FAIL`);
console.log('Country mismatch: DENY');
console.log('Cross-organization / location scope: DENY');
console.log('Existing role authorization preserved: PASS');
console.log('No duplicate country security authority: BLOCKED');
