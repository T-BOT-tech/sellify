import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.join(ROOT, p);
const required = [
  'app/src/experience/state-contract.js',
  'app/src/experience/accessibility-localization-contract.js',
  'app/src/device/device-experience-contract.js',
  'app/src/experience/notifications-observability-contract.js',
  'app/src/experience/experimentation-analytics-contract.js',
  'app/src/experience/qa-security-recovery-contract.js',
  'app/src/experience/documentation-contract.js',
  'phase0/p0-04-offline-recovery-regression.mjs',
  'phase0/p1-01-iam-role-catalog-regression.mjs',
  'phase0/p1-03-permission-role-scope-regression.mjs',
  'phase0/p1-04-pack-role-reconciliation-regression.mjs',
  'phase0/p1-09-membership-role-change-regression.mjs',
  'phase0/p1-12-pack-capability-journey-composition-regression.mjs',
  'phase0/p1-17-pack-accessibility-localization-regression.mjs',
  'phase0/p1-21-pack-traceability-regression.mjs',
  'phase0/fux13-pack-activation-contract-regression.mjs',
  'phase0/fux14-device-hardware-regression.mjs',
  'phase0/fux15-16-accessibility-localization-regression.mjs',
  'phase0/fux17-18-notifications-observability-regression.mjs',
  'phase0/fux19-20-experimentation-analytics-regression.mjs',
  'phase0/fux21-23-qa-security-recovery-regression.mjs',
  'phase0/fux24-in-product-documentation-regression.mjs',
  'phase0/fux27-unified-seller-storefront-regression.mjs',
  'phase0/fux28-cross-channel-consistency-regression.mjs',
  'phase0/fux29-seller-golden-journey-regression.mjs',
  'phase0/fux30-multi-channel-adversarial-regression.mjs',
  'phase0/r1-golden-e2e-traceability-gate.mjs',
  'phase0/r2-golden-business-journeys-regression.mjs',
  'phase0/golden-regression.mjs',
  'phase0/p1-23-node24-runtime-gate.mjs',
];

for (const file of required) { try { await access(rel(file)); } catch { assert.fail(`Missing FUX-25 artifact: ${file}`); } }

const pkg = JSON.parse(await readFile(rel('package.json'), 'utf8'));
const backendPkg = JSON.parse(await readFile(rel('backend/package.json'), 'utf8'));
assert.equal(pkg.engines?.node, '>=24');
assert.equal(backendPkg.engines?.node, '>=24');

const gates = [
  ['offline', 'phase0/p0-04-offline-recovery-regression.mjs'],
  ['roles', 'phase0/p1-01-iam-role-catalog-regression.mjs'],
  ['role-scope', 'phase0/p1-03-permission-role-scope-regression.mjs'],
  ['pack-role', 'phase0/p1-04-pack-role-reconciliation-regression.mjs'],
  ['membership-role', 'phase0/p1-09-membership-role-change-regression.mjs'],
  ['journey-composition', 'phase0/p1-12-pack-capability-journey-composition-regression.mjs'],
  ['accessibility-localization', 'phase0/p1-17-pack-accessibility-localization-regression.mjs'],
  ['traceability', 'phase0/p1-21-pack-traceability-regression.mjs'],
  ['fux13', 'phase0/fux13-pack-activation-contract-regression.mjs'],
  ['fux14', 'phase0/fux14-device-hardware-regression.mjs'],
  ['fux15-16', 'phase0/fux15-16-accessibility-localization-regression.mjs'],
  ['fux17-18', 'phase0/fux17-18-notifications-observability-regression.mjs'],
  ['fux19-20', 'phase0/fux19-20-experimentation-analytics-regression.mjs'],
  ['fux21-23', 'phase0/fux21-23-qa-security-recovery-regression.mjs'],
  ['fux24', 'phase0/fux24-in-product-documentation-regression.mjs'],
  ['fux27', 'phase0/fux27-unified-seller-storefront-regression.mjs'],
  ['fux28', 'phase0/fux28-cross-channel-consistency-regression.mjs'],
  ['fux29', 'phase0/fux29-seller-golden-journey-regression.mjs'],
  ['fux30', 'phase0/fux30-multi-channel-adversarial-regression.mjs'],
  ['r1-golden', 'phase0/r1-golden-e2e-traceability-gate.mjs'],
  ['r2-golden', 'phase0/r2-golden-business-journeys-regression.mjs'],
  ['golden', 'phase0/golden-regression.mjs'],
];

const results = [];
for (const [name, file] of gates) {
  const result = spawnSync(process.execPath, [file], { cwd: ROOT, encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  results.push({ name, file, status: result.status === 0 ? 'PASS' : 'FAIL', exitCode: result.status, output: output.slice(-4000) });
  console.log(`${result.status === 0 ? 'PASS' : 'FAIL'} ${name}`);
  if (result.status !== 0) console.error(output);
}

const runtime = spawnSync(process.execPath, ['phase0/p1-23-node24-runtime-gate.mjs'], { cwd: ROOT, encoding: 'utf8' });
const runtimeStatus = runtime.status === 0 ? 'PASS' : runtime.status === 2 ? 'BLOCKED' : 'FAIL';
console.log(`${runtimeStatus} node24-runtime-gate`);

const failed = results.filter((r) => r.status !== 'PASS');
const certification = failed.length === 0 && runtime.status === 0 ? 'CERTIFIED' : 'PREPARED_NOT_CERTIFIED';
const report = {
  phase: 'FUX-25',
  date: '2026-09-20',
  runtime: process.version,
  certification,
  runtimeGate: { status: runtimeStatus, exitCode: runtime.status, output: `${runtime.stdout ?? ''}${runtime.stderr ?? ''}`.slice(-4000) },
  gates: results.map(({ name, file, status, exitCode }) => ({ name, file, status, exitCode })),
};
await writeFile(rel('phase0/FUX25-CERTIFICATION-RESULT.json'), JSON.stringify(report, null, 2) + '\n');
if (certification !== 'CERTIFIED') process.exitCode = runtime.status === 2 && failed.length === 0 ? 2 : 1;
