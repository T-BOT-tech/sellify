import { spawnSync } from 'node:child_process';
import process from 'node:process';

const checks = [
  'phase0/phase13.10.1-logistics-pack-boundary-regression.mjs',
  'phase0/phase13.10.2-logistics-authority-map-regression.mjs',
  'phase0/phase13.10.3-logistics-fulfillment-boundary-regression.mjs',
  'phase0/phase13.10.4-logistics-proof-return-regression.mjs',
  'phase0/phase13.10.5-logistics-configuration-regression.mjs',
  'phase0/phase13.10.6-logistics-adversarial-regression.mjs',
  'phase0/phase12.2-fulfillment-bridge-regression.mjs',
  'phase0/phase12.3-physical-lifecycle-regression.mjs',
];

for (const script of checks) {
  const result = spawnSync(process.execPath, [script], { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.status !== 0) {
    console.error(`Phase 13.10 Regression Gate: FAIL — ${script}`);
    process.exit(result.status || 1);
  }
}
console.log('Phase 13.10 Logistics Pack Regression Gate: PASS');
console.log(`Verified runtime: ${process.version}`);
console.log('Supported release runtime remains Node >=24; Node 22 is not release certification.');
