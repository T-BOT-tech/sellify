import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [legacyHome, workspace, inventory] = await Promise.all([
  readFile(new URL('../app/src/ui/home.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/experience/workspace.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/warehouse/inventory.js', import.meta.url), 'utf8'),
]);

assert.doesNotMatch(legacyHome, /Ready to sell/,
  'connectivity alone must not be shown as business readiness in the legacy renderer');
assert.match(legacyHome, /Online — setup readiness not assessed/,
  'online connectivity must be distinguished from setup readiness');
assert.match(legacyHome, /Offline — setup readiness unknown/,
  'offline readiness must remain unknown rather than being inferred');
assert.match(legacyHome, /getLowStockProducts\(\)\.length/,
  'the legacy renderer must reuse the existing low-stock projection');
assert.match(legacyHome, /getOutOfStockProducts\(\)\.length/,
  'the legacy renderer must reuse the existing out-of-stock projection');
assert.doesNotMatch(legacyHome, /stock\s*<=\s*5/,
  'the legacy renderer must not define a competing fixed stock threshold');
assert.match(workspace, /getLowStockProducts\(\)/,
  'the active Home workspace must reuse Sellify’s existing inventory projection');
assert.match(workspace, /getOutOfStockProducts\(\)/,
  'the active Home workspace must reuse Sellify’s existing out-of-stock projection');
assert.match(workspace, /Business readiness is operation-specific/,
  'Home must not present a universal readiness verdict; owning workflows assess their own actions');
assert.match(workspace, /separate from business readiness/,
  'inventory conditions must remain distinct from business readiness');
assert.match(workspace, /products\.filter\(isStockTracked\)/,
  'inventory applicability must derive from the existing stock-tracking projection');
assert.match(workspace, /Not applicable to current stock-tracked catalog/,
  'businesses without stock-tracked catalog items must not receive a false inventory-health warning');
assert.match(workspace, /Freshness unknown; saved projection only/,
  'unverified inventory freshness must stay explicit');
assert.match(workspace, /Server freshness metadata is not supplied\./,
  'the UI must not fabricate server freshness evidence');
assert.match(inventory, /stock <= \(p\.reorder_point \|\| 0\)/,
  'low-stock projection must use the existing item reorder point');
assert.match(inventory, /if \(p\?\.item_type === 'service'\) return false/,
  'services must not be treated as physical stock');

console.log('First-experience Home readiness regression: PASS');
