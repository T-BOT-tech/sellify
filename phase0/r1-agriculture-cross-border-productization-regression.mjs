import assert from 'node:assert/strict';
import fs from 'node:fs';
import { projectAgricultureSupplyContext } from '../app/src/phase21-agriculture-supply-integration.js';
import { evaluateCrossBorder } from '../app/src/cross-border-evaluation.js';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../app/src/agriculture-cross-border-productization.js', import.meta.url), 'utf8');
let pass = 0;
function ok(name, fn) { fn(); console.log(`PASS: ${name}`); pass += 1; }

ok('Sourcing contains Agriculture bridge surface', () => {
  assert.match(html, /id="agricultureSupplyBridge"/);
  assert.match(html, /id="agricultureSupplyReview"/);
});
ok('Sourcing contains Cross-border evaluation surface', () => {
  assert.match(html, /id="crossBorderWorkspace"/);
  assert.match(html, /id="crossBorderEvaluate"/);
});
ok('UI imports existing deterministic authorities', () => {
  assert.match(ui, /phase21-agriculture-supply-integration\.js/);
  assert.match(ui, /cross-border-evaluation\.js/);
});
ok('Agriculture projection remains non-authoritative', () => {
  const result = projectAgricultureSupplyContext({ commodity: { entity_type:'Commodity', id:'c1', organization_id:'o1' } });
  assert.equal(result.persistence, 'none');
  assert.equal(result.mutation, false);
  assert.equal(result.inventoryAuthority, 'existing inventory authority');
  assert.equal(result.procurementAuthority, 'existing procurement authority');
});
ok('Cross-border evaluation preserves UNKNOWN', () => {
  const result = evaluateCrossBorder({ origin:'ET', destination:'KE', commercial:'FEASIBLE' });
  assert.equal(result.result, 'unknown');
  assert.equal(result.failureState, 'unknown');
});
ok('Cross-border evaluation remains non-executing', () => {
  const result = evaluateCrossBorder({ origin:'ET', destination:'KE', commercial:'FEASIBLE', capacity:'FEASIBLE', qualification:'FEASIBLE', requirements:'FEASIBLE', currency:'FEASIBLE', logistics:'FEASIBLE', payment:'FEASIBLE' });
  assert.equal(result.result, 'feasible');
  assert.equal(result.persistence, 'none');
  assert.equal(result.authorization, false);
  assert.equal(result.execution, false);
  assert.equal(result.transactionCreation, false);
});
ok('UI explicitly preserves authority boundaries', () => {
  assert.match(html, /does not turn expected production into inventory/);
  assert.match(html, /feasibility is not authorization/);
  assert.match(ui, /does not create orders, shipments, payments/);
});
console.log(`R1 AGRICULTURE + CROSS-BORDER PRODUCTIZATION: ${pass} PASS / 0 FAIL`);
