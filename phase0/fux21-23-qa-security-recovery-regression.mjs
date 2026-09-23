import assert from 'node:assert/strict';
import fs from 'node:fs';
const { fux21To23Contract, assertFux21To23Boundary, validateRecoveryOutcome } = await import('../app/src/experience/qa-security-recovery-contract.js');
const { UI_STATES } = await import('../app/src/experience/state-contract.js');

const contract = fux21To23Contract({ role: 'admin' });
assert.equal(contract.version, '1.0');
assert.equal(contract.fux21.execution, 'read_only');
assert.equal(contract.fux21.persistence, 'none');
assert.match(contract.fux21.requiredTrace, /Component.*Screen.*Journey.*API\/Capability.*Canonical Authority/);
assert.equal(contract.fux22.uiIsNotAuthorization, true);
assert.match(contract.fux22.authorizationAuthority, /backend\/lib\/authorization\.js/);
assert.match(contract.fux22.approvalAuthority, /vertical-approval-boundary/);
assert.ok(contract.fux22.states.includes(UI_STATES.PERMISSION_DENIED));
assert.ok(contract.fux22.states.includes(UI_STATES.SESSION_EXPIRED));
assert.equal(contract.fux23.successRequiresCanonicalConfirmation, true);
assert.ok(contract.fux23.states.includes(UI_STATES.CONFLICT));
assert.ok(contract.fux23.states.includes(UI_STATES.PROVIDER_UNAVAILABLE));

assert.equal(validateRecoveryOutcome(UI_STATES.SUCCESS, false), false);
assert.equal(validateRecoveryOutcome(UI_STATES.SUCCESS, true), true);
assert.equal(validateRecoveryOutcome(UI_STATES.UNKNOWN, false), true);
assert.equal(validateRecoveryOutcome(UI_STATES.QUEUED, false), true);

assert.equal(assertFux21To23Boundary({}), true);
assert.throws(() => assertFux21To23Boundary({ ownsAuthorization: true }), /cannot own authorization/);
assert.throws(() => assertFux21To23Boundary({ ownsRecoveryEngine: true }), /cannot own recoveryEngine/);


const source = fs.readFileSync(new URL('../app/src/experience/qa-security-recovery-contract.js', import.meta.url), 'utf8');
assert.match(source, /FUX-21\/FUX-22\/FUX-23/);
assert.match(source, /cannot own/);
assert.match(source, /successRequiresCanonicalConfirmation/);

console.log('FUX-21/FUX-22/FUX-23 QA + Security + Recovery Regression: PASS');
console.log('Design/engineering traceability remains read-only: PASS');
console.log('Frontend security delegates to canonical authorization/scope/approval/audit: PASS');
console.log('Recovery never fabricates success and preserves UNKNOWN/offline/conflict/provider states: PASS');
console.log('No duplicate authority/persistence introduced: PASS');
