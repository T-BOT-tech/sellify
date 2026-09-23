import { spawnSync } from 'node:child_process';
import process from 'node:process';

const root = process.cwd();
const checks = [
  ['Phase 12.1 Physical/Printing Contract', 'phase0/phase12.1-physical-printing-regression.mjs'],
  ['Phase 12.2 Fulfillment Bridge', 'phase0/phase12.2-fulfillment-bridge-regression.mjs'],
  ['Phase 12.3 Physical Lifecycle', 'phase0/phase12.3-physical-lifecycle-regression.mjs'],
  ['Phase 12.4 Printing Contract', 'phase0/phase12.4-printing-contract-regression.mjs'],
  ['Phase 12.5 ESC/POS Adapter', 'phase0/phase12.5-escpos-adapter-regression.mjs'],
  ['Phase 12.6 Web Bluetooth Adapter', 'phase0/phase12.6-web-bluetooth-adapter-regression.mjs'],
  ['Phase 12.7 Warehouse Hardening', 'phase0/phase12.7-warehouse-hardening-regression.mjs'],
  ['Phase 11.4 Marketplace Integrity', 'phase0/phase11.4-marketplace-integrity-regression.mjs'],
  ['Phase 0 Golden Regression', 'phase0/golden-regression.mjs'],
];

for (const [label, script] of checks) {
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.status !== 0) {
    console.error(`Phase 12.8 Regression Gate: FAIL — ${label}`);
    process.exit(result.status || 1);
  }
  console.log(`Phase 12.8 gate check: PASS — ${label}`);
}

console.log('Phase 12.8 Physical Commerce Regression Gate: PASS');
console.log(`Verified runtime: ${process.version}`);
console.log('Supported release runtime remains Node >=24; this gate does not override that requirement.');
