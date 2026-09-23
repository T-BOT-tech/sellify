import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const filesUnder = (relative, predicate = () => true) => {
  const base = path.join(root, relative);
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (predicate(full, entry.name)) out.push(path.relative(root, full));
    }
  };
  walk(base);
  return out.sort();
};

const verticalFiles = filesUnder('app/src/verticals', (full) => /\.(?:js|mjs)$/.test(full));
const contractFiles = verticalFiles.filter((file) => file.includes('/contract.js') || file.includes('boundary') || file.includes('bridge') || file.includes('integration') || file.includes('spine') || file.includes('fulfillment'));
const verticalSource = verticalFiles.map((file) => ({ file, source: read(file) }));

// 1. Pack manifests may only depend on declared Core authorities and must not
// introduce reserved Core entities.
const packFiles = verticalFiles.filter((file) => /\/pack\.js$/.test(file));
const forbiddenEntityPattern = /(?:Agriculture|Restaurant|Warehouse|Logistics)(?:Order|Inventory|Product|Payment|Customer|Location|Fulfillment|Ledger)/;
for (const file of packFiles) {
  const source = read(file);
  const entityBlock = source.match(/domain_entities\s*:\s*\[([\s\S]*?)\]/) || source.match(/AGRICULTURE_ENTITY_ORDER\s*=\s*Object\.freeze\(\[([\s\S]*?)\]/);
  assert(entityBlock, `domain entity declaration missing in ${file}`);
  assert(!forbiddenEntityPattern.test(entityBlock[1]), `duplicate Core authority declaration in ${file}`);
  assert(!/CREATE TABLE|INSERT INTO|UPDATE\s+|DELETE FROM/i.test(source), `persistence in pack manifest ${file}`);
}

// 2. Vertical bridge/contract source must remain persistence-neutral. Core
// persistence modules are intentionally outside this lint scope.
for (const { file, source } of verticalSource) {
  if (!contractFiles.includes(file)) continue;
  assert(!/CREATE TABLE|ALTER TABLE|DROP TABLE|INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM/i.test(source), `direct persistence in cross-pack contract ${file}`);
}

// 3. Vertical code must not directly mutate the canonical product stock field.
for (const { file, source } of verticalSource) {
  assert(!/\b(?:product|row|item|record)\.stock\s*=(?!=)/.test(source), `direct stock mutation in vertical source ${file}`);
}

// 4. No new route/dispatch implementation in the vertical layer. Declarative
// references are allowed, but engines/providers/stateful implementations are not.
for (const { file, source } of verticalSource) {
  assert(!/class\s+(?:Route|Dispatch)(?:Engine|Service)|(?:route|dispatch)(?:Engine|Provider|Optimizer)\s*=\s*new\s+/i.test(source), `route/dispatch implementation in ${file}`);
  assert(!/CREATE TABLE[^\n]*(?:route|dispatch)|\b(?:route|dispatch)_(?:ledger|events?)\b/i.test(source), `route/dispatch persistence or stream in ${file}`);
}

// 5. Cross-pack contracts must not become orchestration god-services.
for (const { file, source } of verticalSource) {
  if (!contractFiles.includes(file)) continue;
  assert(!/class\s+\w*(?:Orchestrator|Coordinator|GodService)\b|\b(?:PhysicalCommerceOrchestrator|CrossPackOrchestrator)\b/.test(source), `cross-pack orchestrator in ${file}`);
}

// 6. Canonical authority anchors must still point to the existing authorities.
const authorityChecks = [
  ['app/src/logistics/fulfillment.js', 'Fulfillment authority missing'],
  ['app/src/warehouse/inventory.js', 'Inventory mutation authority missing'],
  ['app/src/warehouse/ledger.js', 'Inventory ledger authority missing'],
  ['backend/lib/store-sqlite.js', 'Backend persistence authority missing'],
  ['backend/lib/event-replay.js', 'Replay authority missing'],
  ['backend/lib/event-failure-isolation.js', 'Failure isolation authority missing'],
  ['app/src/events/event-boundary.js', 'Event boundary missing'],
  ['app/src/audit/audit-boundary.js', 'Audit boundary missing'],
];
for (const [file, message] of authorityChecks) assert(fs.existsSync(path.join(root, file)), message);

const logisticsAuthority = read('app/src/verticals/logistics/authority-map.js');
assert.match(logisticsAuthority, /fulfillment_lifecycle:\s*['"]app\/src\/logistics\/fulfillment\.js['"]/);
assert.match(logisticsAuthority, /stock_mutation_authority:\s*['"]app\/src\/warehouse\/inventory\.js#applyStockChange['"]/);

// 7. Cross-pack dependency direction: verticals may reference other verticals
// only through the established contract/bridge surface, not raw implementation
// internals of another pack.
const rawCrossPack = /from\s+['"](?:\.\.\/)+verticals\/(?:warehouse|restaurant|agriculture|logistics)\/(?!.*(?:contract|boundary|bridge|pack|authority-map))/;
for (const { file, source } of verticalSource) {
  if (!/\/verticals\/(?:warehouse|restaurant|agriculture|logistics)\//.test(file)) continue;
  assert(!rawCrossPack.test(source), `raw cross-pack implementation import in ${file}`);
}

console.log('Phase 13.11.17 Architecture-Lint: PASS');
console.log(`Vertical source files scanned: ${verticalFiles.length}`);
console.log(`Cross-pack contract/boundary files scanned: ${contractFiles.length}`);
console.log('Duplicate Core authorities: BLOCKED');
console.log('Direct vertical persistence: BLOCKED');
console.log('Direct vertical stock mutation: BLOCKED');
console.log('Route / dispatch implementation: BLOCKED');
console.log('Cross-pack orchestration services: BLOCKED');
console.log('Canonical authority anchors: PASS');
console.log('Raw cross-pack implementation imports: BLOCKED');
