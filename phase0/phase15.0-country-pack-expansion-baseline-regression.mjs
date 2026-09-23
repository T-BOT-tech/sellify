import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
globalThis.window = { __APP_CONFIG__: {} };

const required = [
  'phase0/PHASE14.15-SOURCE-HASHES.sha256',
  'phase0/phase14.14-node24-regression.mjs',
  'phase0/phase14.15-final-snapshot-regression.mjs',
  'phase0/phase14.13-cross-country-regression.mjs',
  'app/src/country-pack-contract.js',
  'app/src/country-configuration.js',
  'app/src/country-event-integration.js',
  'backend/lib/country-security-isolation.js',
  'SELLIFY_AI_HANDOFF.md',
];
for (const file of required) assert.equal(fs.existsSync(path.join(root, file)), true, `Missing Phase 15 baseline artifact: ${file}`);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(pkg.engines?.node, '>=24');

const pack = await import('../app/src/country-pack-contract.js');
assert.deepEqual(pack.listCountryPacks(), ['et']);
assert.equal(pack.getCountryPack('ET').countryCode, 'ET');
assert.equal(pack.getCountryPack('ethiopia').countryCode, 'ET');
for (const unsupported of ['US', 'KE', 'NG', 'GB', 'IN', 'CA', 'AE']) {
  assert.throws(() => pack.getCountryPack(unsupported), error => error?.code === 'COUNTRY_PACK_UNKNOWN');
}

execFileSync(process.execPath, ['phase0/phase14.13-cross-country-regression.mjs'], { cwd: root, stdio: 'pipe' });
execFileSync(process.execPath, ['phase0/phase14.15-final-snapshot-regression.mjs'], { cwd: root, stdio: 'pipe' });

console.log('Phase 15.0 Country Pack Expansion Baseline Lock: PASS');
console.log('Phase 14.15 source snapshot preserved: PASS');
console.log('Ethiopia remains the only installed country pack: PASS');
console.log('Unsupported country packs fail closed: PASS');
console.log('Node >=24 remains declared; runtime certification remains a separate gate: PASS');
