import assert from 'node:assert/strict';
import {
  defineFarm,
  definePlot,
  defineSeason,
  defineCrop,
  validateFarmPlotHierarchy,
} from '../app/src/verticals/agriculture/farm-plot.js';

const org = 'org-13-4';
const farm = defineFarm({ id: 'farm-1', organization_id: org, farmer_id: 'customer-1', name: 'North Farm' });
const plot = definePlot({ id: 'plot-1', organization_id: org, farm_id: farm.id, name: 'Plot A' });
const season = defineSeason({ id: 'season-1', organization_id: org, farm_id: farm.id, name: 'Main Season' });
const crop = defineCrop({
  id: 'crop-1',
  organization_id: org,
  plot_id: plot.id,
  season_id: season.id,
  crop_type: 'maize',
});

assert.equal(farm.entity_type, 'Farm');
assert.equal(plot.entity_type, 'Plot');
assert.equal(season.status, 'active');
assert.equal(crop.entity_type, 'Crop');
assert.equal(validateFarmPlotHierarchy({ farm, plot, season, crop }), true);

assert.throws(
  () => validateFarmPlotHierarchy({
    farm,
    plot: { ...plot, organization_id: 'other-org' },
  }),
  /different organization/,
);

assert.throws(
  () => validateFarmPlotHierarchy({
    farm,
    plot: { ...plot, farm_id: 'other-farm' },
  }),
  /supplied Farm/,
);

assert.throws(
  () => validateFarmPlotHierarchy({
    plot,
    crop: { ...crop, plot_id: 'other-plot' },
  }),
  /supplied Plot/,
);

console.log('Phase 13.4 Agriculture Farm/Plot Model Regression: PASS');
