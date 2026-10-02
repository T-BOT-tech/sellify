import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app/src/logistics/ui.js', import.meta.url), 'utf8');

assert.match(source, /buildLogisticsOperationalWorkspaceProjection/);
assert.match(source, /getLogisticsWorkspaceComposition/);
assert.match(source, /currentStaff\?\.role/);
assert.match(source, /data-logistics-workspace-projection/);
assert.match(source, /workspace\.dispatch\.length/);
assert.match(source, /workspace\.tracking\.length/);
assert.match(source, /workspace\.exceptions\.length/);
assert.match(source, /workspace\.workload\.active_count/);

// Integration is additive: existing canonical mutation functions remain wired.
assert.match(source, /assignDeliveryCourierForOrder/);
assert.match(source, /transitionDeliveryAssignmentForOrder/);
assert.match(source, /refreshDeliveryAssignments/);

console.log('Phase 13.10.22 Logistics Workspace UI Integration Regression: PASS (10/10)');
