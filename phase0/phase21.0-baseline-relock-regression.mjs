import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'app/src/verticals/agriculture/commerce-contract.js',
  'app/src/verticals/agriculture/pack.js',
  'app/src/verticals/agriculture/procurement-bridge.js',
  'app/src/supplier-network/catalog-contract.js',
  'app/src/supplier-network/capability-contract.js',
  'app/src/supplier-network/capacity-contract.js',
  'app/src/supplier-network/qualification-contract.js',
  'app/src/supplier-network/service-area-contract.js',
  'app/src/supplier-network/commercial-contract.js',
  'app/src/supplier-network/discovery-contract.js',
  'app/src/procurement/demand-contract.js',
  'app/src/procurement/rfq-contract.js',
  'app/src/procurement/award-contract.js',
  'backend/lib/discovery/unified-discovery.js',
  'app/src/cross-border-contract.js',
  'app/src/cross-border-plan.js',
  'PHASE21.0_IMPLEMENTATION_HANDOFF.md',
];
for (const rel of required) assert.equal(fs.existsSync(path.join(root, rel)), true, `missing baseline source: ${rel}`);
const agriculture = fs.readFileSync(path.join(root, 'app/src/verticals/agriculture/commerce-contract.js'), 'utf8');
assert.match(agriculture, /agriculture_owns: Object\.freeze\(\['Commodity'\]\)/);
assert.match(agriculture, /commerce_owns: Object\.freeze\(\['Order', 'Fulfillment'\]\)/);
const supplierCatalog = fs.readFileSync(path.join(root, 'app/src/supplier-network/catalog-contract.js'), 'utf8');
assert.match(supplierCatalog, /authority:'supplier_network'/);
assert.match(supplierCatalog, /productAuthority:'existing product\/catalog authority'/);
assert.match(supplierCatalog, /procurementMutation:false/);
assert.match(supplierCatalog, /paymentMutation:false/);
assert.match(supplierCatalog, /inventoryMutation:false/);
const handoff = fs.readFileSync(path.join(root, 'PHASE21.0_IMPLEMENTATION_HANDOFF.md'), 'utf8');
assert.match(handoff, /no new commodity database/);
assert.match(handoff, /REUSE, EXTEND, NEW, or DEFER/);
console.log('PHASE 21.0 BASELINE RE-LOCK: 20 PASS / 0 FAIL');
