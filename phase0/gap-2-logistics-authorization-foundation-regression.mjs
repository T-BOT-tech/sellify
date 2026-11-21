import assert from 'node:assert/strict';
import fs from 'node:fs';

import { AUTHZ, authorize, getRolePermissions } from '../backend/lib/authorization.js';

const roles = {
  manager: 'logistics_manager',
  dispatcher: 'logistics_dispatcher',
  courier: 'logistics_courier',
  viewer: 'logistics_viewer',
};

const organization = { id: 'org-logistics' };
const actor = (role) => ({ userId: `user-${role}`, role, organizationId: organization.id });

const checks = [
  ['logistics manager is a distinct contextual policy role', () => {
    assert.equal(authorize(actor(roles.manager), organization, null, 'logistics', 'logistics:deliveries:assign'), AUTHZ.ALLOW);
    assert.ok(getRolePermissions(roles.manager).includes('fulfillment:update'));
  }],
  ['dispatcher can coordinate but is not a courier role', () => {
    const permissions = getRolePermissions(roles.dispatcher);
    assert.ok(permissions.includes('logistics:deliveries:assign'));
    assert.ok(permissions.includes('logistics:deliveries:reassign'));
    assert.ok(!permissions.includes('logistics:deliveries:update_assigned') || permissions.includes('logistics:deliveries:update_assigned') === false);
  }],
  ['courier has assigned-delivery capability without generic fulfillment mutation', () => {
    const permissions = getRolePermissions(roles.courier);
    assert.ok(permissions.includes('logistics:deliveries:update_assigned'));
    assert.ok(!permissions.includes('fulfillment:update'));
    assert.equal(authorize(actor(roles.courier), organization, null, 'fulfillment', 'fulfillment:update'), AUTHZ.DENY);
    assert.equal(authorize(actor(roles.courier), organization, null, 'logistics', 'logistics:deliveries:update_assigned'), AUTHZ.ALLOW);
  }],
  ['viewer is read-only', () => {
    const permissions = getRolePermissions(roles.viewer);
    assert.ok(permissions.includes('logistics:deliveries:view'));
    assert.ok(!permissions.includes('fulfillment:update'));
    assert.ok(!permissions.includes('logistics:deliveries:assign'));
    assert.ok(!permissions.includes('logistics:deliveries:update_assigned'));
  }],
  ['Service Booking lifecycle remains outside Logistics Scheduling authorization', () => {
    const businessManager = actor('manager');
    const logisticsManager = actor(roles.manager);
    const logisticsViewer = actor(roles.viewer);
    for (const action of [
      'service:service_booking:view', 'service:service_booking:request',
      'service:service_booking:manage', 'service:service_booking:confirm',
      'service:service_booking:cancel',
    ]) {
      assert.equal(authorize(businessManager, organization, null, 'service_booking', action), AUTHZ.ALLOW);
      assert.equal(authorize(logisticsManager, organization, null, 'service_booking', action), AUTHZ.DENY);
      assert.equal(authorize(logisticsViewer, organization, null, 'service_booking', action), AUTHZ.DENY);
    }
    assert.equal(authorize(logisticsManager, organization, null, 'scheduling', 'logistics:scheduling:manage'), AUTHZ.ALLOW);
    assert.equal(authorize(logisticsViewer, organization, null, 'scheduling', 'logistics:scheduling:view'), AUTHZ.ALLOW);
  }],
  ['organization isolation remains enforced', () => {
    assert.equal(authorize(actor(roles.courier), { id: 'foreign-org' }, null, 'logistics', 'logistics:deliveries:update_assigned'), AUTHZ.DENY);
  }],
];

const store = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
assert.match(store, /'logistics_manager'/);
assert.match(store, /'logistics_dispatcher'/);
assert.match(store, /'logistics_courier'/);
assert.match(store, /'logistics_viewer'/);
assert.match(store, /startsWith\('logistics_'\) \? 'logistics'/);
assert.match(store, /mr\.role_id IN \('logistics_manager', 'logistics_dispatcher', 'logistics_courier', 'logistics_viewer'\)/);

const server = fs.readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');
const serviceBookingHandler = server.slice(
  server.indexOf('async function handleServiceBookings('),
  server.indexOf('async function handleServiceDeliveryAssessment')
);
assert.match(serviceBookingHandler, /req\.method === 'GET'[\s\S]*?service:service_booking:view/);
assert.match(serviceBookingHandler, /let authorizationAction = 'service:service_booking:request'/);
assert.match(serviceBookingHandler, /target === 'CONFIRMED'[\s\S]*?service:service_booking:confirm/);
assert.match(serviceBookingHandler, /target === 'CANCELLED'[\s\S]*?service:service_booking:cancel/);
assert.match(serviceBookingHandler, /'service:service_booking:manage'/);
assert.doesNotMatch(serviceBookingHandler, /logistics:scheduling:/);

const failures = [];
for (const [name, fn] of checks) {
  try { fn(); console.log(`PASS: ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL: ${name} — ${error.message}`); }
}

if (failures.length) {
  console.error(`\nGAP-2 Logistics Authorization Foundation Regression: FAIL (${failures.length})`);
  process.exit(1);
}

console.log('\nGAP-2 Logistics Authorization Foundation Regression: PASS');
console.log('Role policy: manager / dispatcher / courier / viewer');
console.log('Courier generic fulfillment mutation: DENY');
console.log('Service Booking lifecycle authorization: separate from Logistics Scheduling');
console.log('Logistics Scheduling authority: retained for Logistics roles');
console.log('Active logistics pack gating: PASS');
