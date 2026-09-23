import fs from 'node:fs';
import assert from 'node:assert/strict';
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.equal(pkg.engines?.node, '>=24', 'Node engine requirement changed');
const major = Number(process.versions.node.split('.')[0]);
if (major < 24) {
  console.log(`Phase 14.14 Node >=24 regression: BLOCKED (runtime ${process.versions.node}; required >=24)`);
  process.exit(0);
}
console.log(`Phase 14.14 Node >=24 regression: PASS (${process.versions.node})`);
