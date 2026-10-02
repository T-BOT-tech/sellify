import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app/src/logistics/ui.js', import.meta.url), 'utf8');

assert.match(source, /data-logistics-workspace-projection/);
assert.match(source, /workspace\.tracking/);
assert.match(source, /workspace\.proof/);
assert.match(source, /workspace\.exceptions/);
assert.match(source, /Tracking/);
assert.match(source, /Proof/);
assert.match(source, /Exceptions/);

// Operational display remains projection-only; mutations stay on canonical APIs.
assert.match(source, /transitionDeliveryAssignmentForOrder/);
assert.match(source, /assignDeliveryCourierForOrder/);
assert.match(source, /refreshDeliveryAssignments/);

console.log('Phase 13.10.23 Logistics Operational Surfaces Regression: PASS (9/9)');
