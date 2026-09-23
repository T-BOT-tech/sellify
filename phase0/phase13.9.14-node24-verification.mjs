import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const required = String(pkg.engines?.node || '');
const match = required.match(/^>=\s*(\d+)/);
const requiredMajor = match ? Number(match[1]) : null;
const actualMajor = Number(process.versions.node.split('.')[0]);

if (requiredMajor !== 24) {
  throw new Error(`Expected package engine >=24, found ${required || '(missing)'}`);
}

const locked = [
  ['app/src/warehouse/inventory.js', 'ee5799eab8a22a53d6a98756caf32ae013fbd995c3c3501d371615790b5940b9'],
  ['app/src/warehouse/ledger.js', 'd6206c4f42d53f86e625b63956445d73babfd78f55b61de9c90985a95884b9d8'],
  ['app/src/warehouse/locations.js', 'fd3d7bfd253775177130acff2feb3de2667a6bbb0009f1a20735662d12ca9eeb'],
  ['app/src/warehouse/ui.js', '23b82bcb252e70187b246e710a1e4057f5da586b3f9705b99244d9a9462ab9e9'],
  ['app/src/logistics/fulfillment.js', 'cdfbd8acad71f936175fa2ed94a94b375e2452184807ff18f00422012737a7c6'],
];

for (const [file, expected] of locked) {
  const actual = createHash('sha256').update(readFileSync(new URL(`../${file}`, import.meta.url))).digest('hex');
  if (actual !== expected) throw new Error(`Locked source changed: ${file}`);
}

if (actualMajor < 24) {
  console.error(`Phase 13.9.14 Node >=24 Verification: BLOCKED (runtime is Node ${process.versions.node})`);
  console.error('The project declaration and locked-source checks passed, but release certification requires execution under Node >=24.');
  process.exitCode = 2;
} else {
  console.log(`Phase 13.9.14 Node >=24 Verification: PASS (Node ${process.versions.node})`);
}
