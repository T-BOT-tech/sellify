import assert from 'node:assert/strict';
import {
  evaluateCrossBorderLogistics,
  isCrossBorderLogisticsFeasibility,
  crossBorderLogisticsFeasibilityContract,
} from '../app/src/cross-border-logistics-feasibility.js';

const order = {
  id: 'order-cb-208',
  organization_id: 'org-1',
  location_id: 'loc-1',
  fulfillment_type: 'delivery',
  fulfillment_status: 'out_for_delivery',
  shipment_id: 'ship-1',
  tracking_reference: 'track-1',
};

const pass = async (name, fn) => { await fn(); console.log(`PASS ${name}`); };

await pass('contract is persistence-free', () => {
  const c = crossBorderLogisticsFeasibilityContract();
  assert.equal(c.persistence, 'none');
  assert.equal(c.route_execution, false);
  assert.equal(c.dispatch_execution, false);
  assert.equal(c.provider_execution, false);
});

await pass('existing delivery fulfillment is composed', () => {
  const r = evaluateCrossBorderLogistics({
    order, origin: 'ET', destination: 'KE', deliveryMode: 'delivery',
    carrierCapability: { status: 'AVAILABLE', source: 'carrier-adapter' },
    courier: { status: 'AVAILABLE', source: 'provider-adapter' },
  });
  assert.equal(r.result, 'FEASIBLE');
  assert.equal(r.fulfillment.authority, 'app/src/logistics/fulfillment.js');
  assert.equal(r.route_execution, false);
  assert.equal(r.provider_execution, false);
  assert.equal(r.persistence, 'none');
  assert.equal(isCrossBorderLogisticsFeasibility(r), true);
});

await pass('missing carrier evidence stays UNKNOWN', () => {
  const r = evaluateCrossBorderLogistics({ order, origin: 'ET', destination: 'KE', deliveryMode: 'delivery' });
  assert.equal(r.result, 'UNKNOWN');
});

await pass('review capability becomes conditionally feasible', () => {
  const r = evaluateCrossBorderLogistics({
    order, origin: 'ET', destination: 'KE', deliveryMode: 'delivery',
    carrierCapability: { status: 'REVIEW_REQUIRED', reason: 'Lane confirmation required' },
  });
  assert.equal(r.result, 'CONDITIONALLY_FEASIBLE');
});

await pass('blocked carrier becomes not feasible', () => {
  const r = evaluateCrossBorderLogistics({
    order, origin: 'ET', destination: 'KE', deliveryMode: 'delivery',
    carrierCapability: { status: 'BLOCKED' },
  });
  assert.equal(r.result, 'NOT_FEASIBLE');
});

await pass('fulfillment mode conflict fails closed', () => {
  assert.throws(() => evaluateCrossBorderLogistics({
    order, origin: 'ET', destination: 'KE', deliveryMode: 'pickup',
  }));
});

await pass('invalid capability state fails closed', () => {
  assert.throws(() => evaluateCrossBorderLogistics({
    order, origin: 'ET', destination: 'KE', deliveryMode: 'delivery',
    carrierCapability: { status: 'SUCCESS' },
  }));
});

await pass('does not create shipment/courier authority', () => {
  const r = evaluateCrossBorderLogistics({
    order, origin: 'ET', destination: 'KE', deliveryMode: 'delivery',
    shipment: { id: 'external-shipment' },
  });
  assert.equal(r.shipment.execution, false);
  assert.equal(r.courier.execution, false);
});

await pass('no database/store/provider execution references', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(new URL('../app/src/cross-border-logistics-feasibility.js', import.meta.url), 'utf8');
  assert.equal(/sqlite|indexeddb|localStorage|enqueueEvent|credentials|password|token/i.test(source), false);
});
