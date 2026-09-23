import assert from 'node:assert/strict';
import {
  projectAgricultureSupplyContext,
  projectAgricultureProductionObservation,
  phase21AgricultureSupplyIntegrationContract,
} from '../app/src/phase21-agriculture-supply-integration.js';

let pass = 0;
function ok(name, fn) { fn(); console.log(`PASS: ${name}`); pass += 1; }
function throws(name, fn) { assert.throws(fn); console.log(`PASS: ${name}`); pass += 1; }

const commodity = { entity_type: 'Commodity', id: 'commodity-1', organization_id: 'org-1', status: 'active', name: 'Maize', product_id: 'product-1', unit: 'kg' };
const farm = { entity_type: 'Farm', id: 'farm-1', organization_id: 'org-1', status: 'active', farmer_id: 'customer-1', name: 'Farm A' };
const plot = { entity_type: 'Plot', id: 'plot-1', organization_id: 'org-1', status: 'active', farm_id: 'farm-1', name: 'Plot A' };
const season = { entity_type: 'Season', id: 'season-1', organization_id: 'org-1', status: 'active', farm_id: 'farm-1', name: '2026 Main' };
const crop = { entity_type: 'Crop', id: 'crop-1', organization_id: 'org-1', status: 'active', plot_id: 'plot-1', season_id: 'season-1', crop_type: 'maize' };
const supply = { entity_type: 'Supply', id: 'supply-1', supply_id: 'supply-1', organization_id: 'org-1', status: 'active', commodity_id: 'commodity-1', product_id: 'product-1', quantity: 1000 };
const harvest = { entity_type: 'Harvest', id: 'harvest-1', organization_id: 'org-1', status: 'active', crop_id: 'crop-1', product_id: 'product-1', quantity: 800 };
const product = { id: 'product-1', organization_id: 'org-1' };

ok('projects the existing Agriculture hierarchy', () => {
  const result = projectAgricultureSupplyContext({ farm, plot, season, crop, commodity, supply, harvest, product });
  assert.equal(result.commodityReference.id, 'commodity-1');
  assert.equal(result.cropReference.id, 'crop-1');
  assert.equal(result.supplyReference.id, 'supply-1');
  assert.equal(result.harvestReference.id, 'harvest-1');
  assert.equal(result.persistence, 'none');
});

ok('keeps Agriculture as authority', () => {
  const result = projectAgricultureSupplyContext({ commodity });
  assert.equal(result.agricultureAuthority, 'agriculture');
  assert.equal(result.inventoryAuthority, 'existing inventory authority');
  assert.equal(result.supplierCapabilityAuthority, 'existing supplier-network capability authority');
});

ok('projects expected production without claiming inventory', () => {
  const result = projectAgricultureProductionObservation({
    crop,
    commodity,
    quantity: 5000,
    unit: 'kg',
    state: 'EXPECTED',
    observedAt: '2026-09-15T00:00:00Z',
    validUntil: '2027-01-01T00:00:00Z',
  });
  assert.equal(result.state, 'EXPECTED');
  assert.equal(result.isInventory, false);
  assert.equal(result.isCommittedSupply, false);
  assert.equal(result.isSupplierNetworkCapacity, false);
  assert.equal(result.isProcurementAward, false);
});

ok('supports recorded production separately from expected production', () => {
  const result = projectAgricultureProductionObservation({
    crop,
    commodity,
    quantity: 800,
    unit: 'kg',
    state: 'RECORDED',
    observedAt: '2026-09-15T00:00:00Z',
  });
  assert.equal(result.state, 'RECORDED');
  assert.equal(result.availabilityMeaning, 'recorded_agriculture_production');
});

ok('output is immutable', () => {
  const result = projectAgricultureSupplyContext({ commodity });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.commodityReference), true);
});

throws('rejects foreign-organization crop', () => projectAgricultureSupplyContext({
  commodity,
  crop: { ...crop, organization_id: 'org-2' },
}));
throws('rejects crop from a different plot', () => projectAgricultureSupplyContext({
  commodity,
  plot,
  crop: { ...crop, plot_id: 'plot-2' },
}));
throws('rejects supply from a different commodity', () => projectAgricultureSupplyContext({
  commodity,
  supply: { ...supply, commodity_id: 'commodity-2' },
}));
throws('rejects harvest from a different crop', () => projectAgricultureSupplyContext({
  commodity,
  crop,
  harvest: { ...harvest, crop_id: 'crop-2' },
}));
throws('rejects invalid production state', () => projectAgricultureProductionObservation({
  crop, commodity, quantity: 10, unit: 'kg', state: 'AVAILABLE', observedAt: '2026-09-15T00:00:00Z',
}));
throws('rejects production validUntil before observedAt', () => projectAgricultureProductionObservation({
  crop, commodity, quantity: 10, unit: 'kg', observedAt: '2026-09-15T00:00:00Z', validUntil: '2026-09-14T00:00:00Z',
}));
throws('rejects invalid quantity', () => projectAgricultureProductionObservation({
  crop, commodity, quantity: 0, unit: 'kg', observedAt: '2026-09-15T00:00:00Z',
}));

ok('contract preserves authority boundaries', () => {
  const contract = phase21AgricultureSupplyIntegrationContract();
  assert.equal(contract.agricultureAuthority, 'agriculture');
  assert.equal(contract.inventoryAuthority, 'existing inventory authority');
  assert.equal(contract.procurementAuthority, 'existing procurement authority');
  assert.equal(contract.persistence, 'none');
  assert.equal(contract.mutation, false);
});

console.log(`PHASE 21.10 AGRICULTURE SUPPLY INTEGRATION: ${pass} PASS / 0 FAIL`);
