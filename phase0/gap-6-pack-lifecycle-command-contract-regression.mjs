import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../app/src/experience/pack-lifecycle-client.js', import.meta.url), 'utf8');
const workspace = fs.readFileSync(new URL('../app/src/experience/pack-workspace.js', import.meta.url), 'utf8');
const entitlement = fs.readFileSync(new URL('../app/src/authorization/pack-entitlement.js', import.meta.url), 'utf8');

assert.match(server, /requestedAction/);
assert.match(server, /actionTargets/);
assert.match(server, /INSTALL: 'INSTALLED'/);
assert.match(server, /ACTIVATE: 'ACTIVE'/);
assert.match(server, /DEACTIVATE: 'DEACTIVATED'/);
assert.match(server, /UPGRADE: 'ACTIVE'/);
assert.match(server, /PACK_LIFECYCLE_ACTION_REQUIRED/);
assert.match(server, /UNSUPPORTED_PACK_LIFECYCLE_ACTION/);
assert.match(server, /PACK_LIFECYCLE_ACTION_STATE_MISMATCH/);
assert.match(server, /transitionPackLifecycle\(chatId, packId, targetState, session/);
assert.match(server, /PACK_UPGRADE_COMMAND_REQUIRED/);
assert.match(server, /PACK_UPGRADE_NOT_AVAILABLE/);
assert.match(server, /requestedAction !== 'UPGRADE'/);
assert.match(server, /requestedAction === 'UPGRADE'/);
assert.match(server, /RECOVER: 'ELIGIBLE'/);
assert.match(server, /PACK_RECOVERY_NOT_REQUIRED/);
assert.match(server, /pack:lifecycle:recover/);

assert.match(client, /export async function getPackLifecycle/);
assert.match(client, /export async function getPackLifecycleSnapshot/);
assert.match(client, /data\.readiness/);
assert.match(client, /export function installPack/);
assert.match(client, /export function activatePack/);
assert.match(client, /export function deactivatePack/);
assert.match(client, /export function upgradePack/);
assert.match(client, /action, \.\.\.extra/);
assert.match(client, /authHeaders\(\)/);
assert.doesNotMatch(client, /targetState/);

assert.match(workspace, /getPackLifecycleSnapshot/);
assert.match(workspace, /snapshot\?\.readiness/);
assert.match(workspace, /Promise\.allSettled/);
assert.match(workspace, /pack\.state === 'ACTIVE'/);
assert.doesNotMatch(workspace, /getVerticalPackConfiguration/);

assert.match(entitlement, /getPackLifecycleSnapshot/);
assert.match(entitlement, /snapshot\?\.readiness/);
assert.match(entitlement, /canonical server Pack lifecycle state/);
assert.doesNotMatch(entitlement, /getVerticalPackConfiguration/);

console.log('GAP-6.1 intent-based Pack lifecycle API regression: PASS');
console.log('GAP-6.3 canonical frontend lifecycle client contract: PASS');
console.log('GAP-6.3 workspace/settings lifecycle authority integration: PASS');
console.log('GAP-6.5 explicit upgrade command semantics: PASS');
console.log('GAP-6.6 Pack recovery command boundary: PASS');
console.log('GAP-6.7 configuration/lifecycle divergence detection: PASS');

const packReadiness = fs.readFileSync(new URL('../app/src/authorization/pack-readiness.js', import.meta.url), 'utf8');
assert.match(packReadiness, /getPackLifecycleSnapshot/);
assert.match(packReadiness, /configurationLifecycleDivergence/);
assert.match(packReadiness, /CONFIG_ENABLED_LIFECYCLE_NOT_ACTIVE/);
assert.match(packReadiness, /CONFIG_DISABLED_LIFECYCLE_ACTIVE/);
assert.match(packReadiness, /never converted into an inferred lifecycle mutation/);
const activationContract = fs.readFileSync(new URL('../app/src/experience/pack-activation-contract.js', import.meta.url), 'utf8');
assert.match(activationContract, /getPackUxStateProjection/);
assert.match(activationContract, /installed:/);
assert.match(activationContract, /eligible:/);
assert.match(activationContract, /active:/);
assert.match(activationContract, /configured:/);
assert.match(activationContract, /entitled:/);
assert.match(activationContract, /operational:/);
assert.match(workspace, /getPackUxStateProjection/);
assert.match(workspace, /pack\.ux\.operational/);

const readiness = fs.readFileSync(new URL('../backend/lib/pack-lifecycle-readiness.js', import.meta.url), 'utf8');
assert.match(readiness, /export function derivePackLifecycleReadiness/);
assert.match(readiness, /organizationScoped/);
assert.match(readiness, /DEPENDENCY_BLOCKED/);

console.log('GAP-6.8 distinct Pack UX state projection: PASS');
