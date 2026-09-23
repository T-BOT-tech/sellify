import { readFile } from 'node:fs/promises';
import process from 'node:process';

const root = new URL('../', import.meta.url);
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const backendPkg = JSON.parse(await readFile(new URL('backend/package.json', root), 'utf8'));

const major = Number(process.versions.node.split('.')[0]);
const required = 24;
const checks = [];
checks.push({ name: 'root engine declares Node >=24', pass: pkg.engines?.node === '>=24', value: pkg.engines?.node });
checks.push({ name: 'backend engine declares Node >=24', pass: backendPkg.engines?.node === '>=24', value: backendPkg.engines?.node });
checks.push({ name: 'runtime major >=24', pass: major >= required, value: process.version });

if (major >= required) {
  try {
    await import('node:sqlite');
    checks.push({ name: 'node:sqlite available', pass: true, value: 'available' });
  } catch (error) {
    checks.push({ name: 'node:sqlite available', pass: false, value: error.message });
  }
} else {
  checks.push({ name: 'node:sqlite available', pass: false, value: 'NOT_EXECUTED: runtime below required Node >=24' });
}

for (const check of checks) {
  console.log(`${check.pass ? 'PASS' : 'BLOCKED'} ${check.name} :: ${check.value}`);
}

const blocked = checks.filter((c) => !c.pass);
if (blocked.length) {
  console.error(`\nP1-23 RELEASE GATE: BLOCKED (${blocked.length} check(s)).`);
  console.error('A Node >=24 runtime is required to certify the release.');
  process.exitCode = 2;
} else {
  console.log('\nP1-23 RELEASE GATE: PASS');
}
