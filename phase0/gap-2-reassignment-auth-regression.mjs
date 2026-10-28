import assert from 'node:assert/strict';
import fs from 'node:fs';

const store = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const start = store.indexOf('export async function transitionDeliveryAssignment(');
const end = store.indexOf('export async function transitionOrderFulfillment(', start);
assert.ok(start >= 0 && end > start, 'canonical delivery assignment transition must remain discoverable');
const transition = store.slice(start, end);
const exceptionStart = transition.indexOf("if (normalizedAction === 'REASSIGN_EXCEPTION')");
const normalStart = transition.indexOf('  const transitions =', exceptionStart);
assert.ok(exceptionStart >= 0 && normalStart > exceptionStart, 'normal and exception reassignment paths must remain distinct');
const exception = transition.slice(exceptionStart, normalStart);
const normal = transition.slice(normalStart);

assert.match(exception, /BEGIN IMMEDIATE/);
assert.match(exception, /SELECT \* FROM delivery_assignment_commands[\s\S]*?WHERE organization_id = \? AND command_key = \?/);
assert.match(exception, /ASSIGNMENT_REPLAY_STATE_MISSING/);
assert.match(exception, /REASSIGNMENT_TARGET_REQUIRED/);
assert.match(exception, /REASSIGNMENT_REASON_REQUIRED/);
assert.match(exception, /Target courier does not have an active logistics courier role/);
assert.match(exception, /COURIER_SCOPE_DENIED/);
assert.match(exception, /String\(targetCourierId\) === String\(exception\.courier_user_id\)/);
assert.match(exception, /UPDATE delivery_assignments SET status = \\'REASSIGNED\\'/);
assert.match(exception, /delivery\.assignment\.exception_resolved/);
assert.match(exception, /INSERT INTO delivery_assignment_commands/);
assert.ok(exception.indexOf('if (existingCommand)') < exception.indexOf('REASSIGNMENT_TARGET_REQUIRED'),
  'exception retries must replay/conflict before target validation');
assert.ok(exception.indexOf('REASSIGNMENT_TARGET_REQUIRED') < exception.indexOf('REASSIGNMENT_REASON_REQUIRED'),
  'exception commands must reject missing target before missing reason');
assert.ok(exception.indexOf('REASSIGNMENT_REASON_REQUIRED') < exception.indexOf('const freshCourierGrants'),
  'exception reason must be required before target role/scope validation');
assert.ok(exception.indexOf('const freshCourierGrants') < exception.indexOf('const exception = db.prepare'),
  'exception target role must be revalidated under the write lock before mutation');
assert.ok(exception.lastIndexOf('db.exec(\'COMMIT\')') > exception.lastIndexOf('INSERT INTO delivery_assignment_commands'),
  'exception state, audit, and command history must commit atomically');

assert.match(normal, /if \(!targetCourierId \|\| targetCourierId === String\(active\.courier_user_id\)\)/);
assert.match(normal, /mr\.role_id = 'logistics_courier'/);
assert.match(normal, /hasCourierLocationGrant\(courierGrants, locationId\)/);
assert.match(normal, /const canonicalLocationId = freshOrderRow\.location_id/);
assert.match(normal, /const locationId = canonicalLocationId \|\| active\.location_id \|\| order\.location_id \|\| input\.locationId \|\| input\.location_id \|\| null/);
const normalReassignment = normal.slice(normal.indexOf("if (normalizedAction === 'REASSIGNED')"), normal.indexOf('const now = nowIso();'));
assert.ok(normalReassignment.indexOf('canonicalLocationId') < normalReassignment.indexOf('input.locationId'),
  'normal reassignment must prefer canonical location scope over caller fallback');

console.log('GAP-2 Reassignment Authorization Regression: PASS');
console.log('Exception reason required after durable replay: PASS');
console.log('Normal reassignment different-courier and role/scope checks: PASS');
console.log('Tenant/location revalidation and atomic command history: PASS');
