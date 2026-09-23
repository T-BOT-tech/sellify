import { spawn } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const scripts = [
  'p0-09-procurement-demand-rfq-preparation-regression.mjs',
  'p0-10-rfq-responses-comparison-regression.mjs',
  'p0-11-comparison-award-authorization-regression.mjs',
  'p0-12-award-po-receiving-regression.mjs',
  'r1-golden-e2e-traceability-gate.mjs',
  'r2-golden-business-journeys-regression.mjs',
];

let failed = false;
for (const script of scripts) {
  console.log(`\n=== P0 GOLDEN CUMULATIVE: ${script} ===`);
  const result = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(root, 'phase0', script)], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
  if (result !== 0) {
    failed = true;
    console.error(`FAILED: ${script}`);
    break;
  }
}

if (failed) {
  console.error('P0 GOLDEN JOURNEY CUMULATIVE GATE: FAIL');
  process.exit(1);
}

console.log('\nP0 GOLDEN JOURNEY CUMULATIVE GATE: PASS');
