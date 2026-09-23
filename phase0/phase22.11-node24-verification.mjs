import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(pkg.engines?.node, '>=24');
console.log('PASS project requires Node >=24');

const major = Number(process.versions.node.split('.')[0]);
assert.ok(Number.isInteger(major));
console.log(`PASS detected Node ${process.versions.node}`);

const gate = spawnSync(process.execPath, ['phase0/phase22.10-cumulative-phase22-gate.mjs'], { cwd: root, encoding: 'utf8' });
assert.equal(gate.status, 0, `${gate.stdout}\n${gate.stderr}`);
console.log('PASS Phase 22.10 cumulative functional gate');

if (major >= 24) {
  console.log('NODE >=24 VERIFICATION: PASS');
  console.log('Release runtime certification: PASS');
} else {
  console.log('NODE >=24 VERIFICATION: BLOCKED');
  console.log('Release runtime certification: BLOCKED (actual runtime is below required Node >=24)');
}
