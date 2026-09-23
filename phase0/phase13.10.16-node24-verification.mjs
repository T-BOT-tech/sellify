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
  ['app/src/verticals/logistics/pack.js', '5eb3db80f0419544bfea525b38bf94e1e5f75e551d11c0dd28569ffa3515182f'],
  ['app/src/verticals/logistics/authority-map.js', '884261daccb27e41d23445834ed377b96ecb9ed0983fc3185aff4dcdbed10844'],
  ['app/src/verticals/logistics/fulfillment-boundary.js', '63d37925bd92ea92394100cb5a40334ae24f825b00cc639179f846d25590f592'],
  ['app/src/verticals/logistics/config-contract.js', 'a67a068a4fd475aeba06055cfbbc3648d356aff1bb74d1362e559dbfd50d2525'],
  ['app/src/verticals/logistics/shipment-tracking-contract.js', '89a506be233f3e999bf3aeecaccc7f5de2f5a2bf12605d665487b19212d410cb'],
  ['app/src/verticals/logistics/proof-return-contract.js', '76baac4451af53ff0121b23ad5409fae1fd08153c7921177d8164159038bce16'],
  ['app/src/verticals/logistics/courier-assignment-contract.js', '49a351cb453e435888cc4b4d66fd6d4b5f46a94fa95f9e8952c03fb7874841e4'],
  ['app/src/logistics/fulfillment.js', 'cdfbd8acad71f936175fa2ed94a94b375e2452184807ff18f00422012737a7c6'],
  ['app/src/logistics/physical-flow.js', '60e1d60957add13dcdfdf01af45f342d0d988812a32641c8d21e46aea5a66bee'],
  ['app/src/storage/migration.js', '8e6e46df61952ffc360f3f5ad50b701361ab2ac68a9fdbd240c03119bb3fb4d2'],
  ['app/src/constants.js', 'cfc8b927aa8953b5611c606f5ad0ae24c90401bc05d12568d306aa0e2a917113'],
];

for (const [file, expected] of locked) {
  const actual = createHash('sha256').update(readFileSync(new URL(`../${file}`, import.meta.url))).digest('hex');
  if (actual !== expected) throw new Error(`Locked source changed: ${file}`);
}

console.log(`Phase 13.10.16 source/runtime declaration checks: PASS (package engine ${required}; Node ${process.version})`);
console.log(`Locked Logistics/Core boundary sources verified: ${locked.length}`);

if (actualMajor < 24) {
  console.error(`Phase 13.10.16 Node >=24 Verification: BLOCKED (runtime is Node ${process.versions.node})`);
  console.error('Source locks and package engine declaration passed, but release certification requires execution under Node >=24.');
  process.exitCode = 2;
} else {
  console.log(`Phase 13.10.16 Node >=24 Verification: PASS (Node ${process.versions.node})`);
}
