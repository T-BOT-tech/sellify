import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => fs.readFileSync(`${root}/${p}`, 'utf8');
const exists = (p) => fs.existsSync(`${root}/${p}`);
const checks = [];
function check(name, fn) {
  try { fn(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: 'FAIL', error: error.message }); }
}
function fileContains(path, patterns) {
  const text = read(path);
  for (const pattern of patterns) assert.match(text, pattern, `${path} missing ${pattern}`);
}

const p1 = [
  'P1-IMPLEMENTATION-01-IAM-ROLE-CATALOG.md',
  'P1-IMPLEMENTATION-04-PACK-ROLE-RECONCILIATION.md',
  'P1-IMPLEMENTATION-06-CONDITIONS-APPROVAL-BOUNDARY.md',
  'P1-IMPLEMENTATION-08-IAM-CERTIFICATION-TRACE-MATRIX.md',
  'P1-IMPLEMENTATION-09-MEMBERSHIP-ROLE-CHANGE.md',
  'P1-IMPLEMENTATION-12-PACK-CAPABILITY-JOURNEY-COMPOSITION.md',
  'P1-IMPLEMENTATION-13-PACK-DEPENDENCY-READINESS.md',
  'P1-IMPLEMENTATION-14-PACK-RECOVERY-FAILURE-UX.md',
  'P1-IMPLEMENTATION-15-PACK-AUDIT-OBSERVABILITY.md',
  'P1-IMPLEMENTATION-17-PACK-ACCESSIBILITY-LOCALIZATION.md',
  'P1-IMPLEMENTATION-19-PACK-ANALYTICS-TELEMETRY.md',
  'P1-IMPLEMENTATION-20-PACK-EXPERIMENTATION.md',
  'P1-IMPLEMENTATION-21-PACK-DESIGN-ENGINEERING-QA-TRACEABILITY.md',
];

check('P1 implementation evidence documents present', () => {
  for (const p of p1) assert.ok(exists(p), `missing ${p}`);
});

check('canonical authorization remains backend-owned', () => {
  fileContains('backend/lib/authorization.js', [/export.*authorize/s, /ROLE_PERMISSIONS/, /owner/]);
  fileContains('app/src/authorization/pack-security.js', [/backend\/lib\/authorization\.js/, /server/i]);
});

check('canonical authority registry forbids duplicate ownership', () => {
  fileContains('app/src/platform/authority-registry.js', [/FORBIDDEN_PLATFORM_OWNERSHIP/, /duplicateAuthority: false/, /duplicatePersistence: false/, /duplicateAuthorization: false/]);
});

check('Pack traceability contract is complete and read-only', () => {
  fileContains('app/src/authorization/pack-traceability.js', [/Component → Screen → Journey → API\/Capability → Canonical Authority/, /execution: 'read_only'/, /persistence: 'none'/]);
  const rows = read('app/src/authorization/pack-traceability.js').match(/pack: '/g) || [];
  assert.equal(rows.length, 12, 'expected 12 registered Pack trace rows');
});

check('experimentation remains fail-closed / non-executable', () => {
  const text = read('app/src/authorization/pack-experimentation.js');
  assert.match(text, /NOT_ESTABLISHED/);
  assert.match(text, /NOT_ASSIGNED/);
  assert.match(text, /BLOCKED_BY_BOUNDARY/);
  assert.doesNotMatch(text, /fetch\(/);
  assert.doesNotMatch(text, /INSERT INTO|CREATE TABLE|recordAuditEvent|telemetryStore|experimentStore/i);
});

check('analytics remains a read-only audit projection', () => {
  const text = read('app/src/authorization/pack-analytics.js');
  assert.match(text, /audit\?limit/);
  assert.match(text, /audit:view/);
  assert.doesNotMatch(text, /INSERT INTO|CREATE TABLE|recordAuditEvent|telemetryStore|analytics_events/i);
});

check('Settings exposes the P1 certification surfaces', () => {
  const settings = read('app/src/ui/settings.js');
  const html = read('app/index.html');
  for (const name of ['renderPackExperimentationPanel', 'renderPackTraceabilityPanel']) assert.match(settings, new RegExp(name));
  for (const id of ['packExperimentationPanel', 'packTraceabilityPanel']) assert.match(html, new RegExp(`id="${id}"`));
});

check('P1 regression suite scripts exist', () => {
  for (const n of [1,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,19,20,21]) {
    const matches = fs.readdirSync(`${root}/phase0`).filter(f => f.startsWith(`p1-${String(n).padStart(2,'0')}-`) && f.endsWith('-regression.mjs'));
    assert.ok(matches.length >= 1, `missing P1-${String(n).padStart(2,'0')} regression`);
  }
});

const regressionFiles = fs.readdirSync(`${root}/phase0`)
  .filter(f => /^p1-\d{2}-.*-regression\.mjs$/.test(f))
  .sort();
for (const file of regressionFiles) {
  const result = spawnSync(process.execPath, [`phase0/${file}`], { cwd: root, encoding: 'utf8' });
  check(`regression ${file}`, () => {
    assert.equal(result.status, 0, `${result.stdout || ''}${result.stderr || ''}`.trim());
  });
}

const pass = checks.filter(c => c.status === 'PASS').length;
const fail = checks.length - pass;
console.log(`P1-22 PACK CUMULATIVE CERTIFICATION: ${pass} PASS / ${fail} FAIL`);
for (const item of checks) {
  console.log(`${item.status} — ${item.name}${item.error ? ` — ${item.error}` : ''}`);
}
if (fail) process.exitCode = 1;
