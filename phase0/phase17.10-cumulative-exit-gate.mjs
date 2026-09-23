import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const phase17 = fs.readdirSync(path.join(root, 'phase0')).filter((f) => /^phase17\.[1-9](?:\D|$).*\.mjs$/.test(f)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
const required = [
  'phase17.1-procurement-demand-contract-regression.mjs','phase17.1-procurement-demand-regression.mjs',
  'phase17.2-supplier-contract-regression.mjs','phase17.2-supplier-participation-regression.mjs',
  'phase17.3-rfq-contract-regression.mjs','phase17.3-rfq-response-regression.mjs',
  'phase17.4-comparison-contract-regression.mjs','phase17.4-comparison-regression.mjs',
  'phase17.5-procurement-award-contract-regression.mjs','phase17.5-procurement-award-regression.mjs',
  'phase17.6-execution-contract-regression.mjs','phase17.6-procurement-po-bridge-regression.mjs',
  'phase17.7-procurement-receiving-regression.mjs','phase17.7-receiving-contract-regression.mjs',
  'phase17.8-payment-contract-regression.mjs','phase17.8-payment-core-outbound-regression.mjs','phase17.8-procurement-payment-regression.mjs',
  'phase17.9-procurement-settlement-contract-regression.mjs','phase17.9-procurement-settlement-regression.mjs'
];
assert.deepEqual(phase17, required, 'Phase 17 regression inventory drifted');

function run(label, file) {
  const r = spawnSync(process.execPath, [path.join(root, 'phase0', file)], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write(r.stdout || ''); process.stderr.write(r.stderr || '');
    throw new Error(`${label} failed: ${file}`);
  }
  return (r.stdout || '').trim();
}

const results = [];
for (const file of required) results.push({ label: 'Phase 17', file, result: run('Phase 17', file) });
run('Phase 16.12', 'phase16.12-platform-regression.mjs');
run('Golden', 'golden-regression.mjs');

const nodeMajor = Number(process.versions.node.split('.')[0]);
const node24 = nodeMajor >= 24;
const report = {
  phase: '17.10', status: 'PASS_WITH_NODE24_DEFERRED',
  phase17RegressionCount: required.length,
  phase17RegressionFailures: 0,
  phase16_12: 'PASS', golden: 'PASS',
  runtime: process.version,
  node24Certification: node24 ? 'AVAILABLE_FOR_EXECUTION' : 'DEFERRED_TO_PHASE_16.13',
  checkedAt: new Date().toISOString()
};
fs.writeFileSync(path.join(root, 'phase0', 'PHASE17.10-CUMULATIVE-EXIT-REPORT.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Phase 17.10 Cumulative Exit Gate: PASS`);
console.log(`Phase 17 regressions: ${required.length} PASS / 0 FAIL`);
console.log(`Phase 16.12: PASS`);
console.log(`Phase 0 Golden Regression: PASS`);
console.log(`Runtime: ${process.version}`);
console.log(`Node >=24 certification: ${report.node24Certification}`);
