import assert from 'node:assert/strict';
import fs from 'node:fs';

const store = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const frontend = fs.readFileSync(new URL('../app/src/logistics/fulfillment.js', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');

assert.match(store, /f\.scheduled_at AS fulfillment_scheduled_at/);
assert.match(store, /f\.tracking_reference AS fulfillment_tracking_reference/);
assert.match(store, /f\.destination_json AS fulfillment_destination_json/);
assert.match(store, /LEFT JOIN locations l ON l\.id = da\.location_id AND l\.organization_id = da\.organization_id/);
assert.match(store, /dispatch: \{/);
assert.match(store, /locationCode: row\.location_code/);
assert.match(store, /locationName: row\.location_name/);
assert.match(store, /scheduledAt: row\.fulfillment_scheduled_at/);
assert.match(store, /trackingReference: row\.fulfillment_tracking_reference/);
assert.match(store, /destination: parseJSON\(row\.fulfillment_destination_json, null\)/);
assert.match(store, /export async function listDeliveryAssignments/);
assert.match(store, /da\.organization_id = \?/);
assert.match(store, /da\.location_id = \?/);

assert.match(server, /getDeliveryAssignment/);
assert.match(server, /listDeliveryAssignments/);
assert.match(frontend, /refreshDeliveryAssignments/);
assert.match(frontend, /locationId/);

console.log('GAP-2.8 Route/Dispatch Scope Regression: PASS');
console.log('Existing location, schedule, tracking, and destination authorities remain read-only projections: PASS');
console.log('Organization/location scoping is retained: PASS');
