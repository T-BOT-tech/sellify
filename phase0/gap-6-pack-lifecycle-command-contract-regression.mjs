import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../app/src/experience/pack-lifecycle-client.js', import.meta.url), 'utf8');

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

assert.match(client, /export function getPackLifecycle/);
assert.match(client, /export function installPack/);
assert.match(client, /export function activatePack/);
assert.match(client, /export function deactivatePack/);
assert.match(client, /export function upgradePack/);
assert.match(client, /action, \.\.\.extra/);
assert.match(client, /authHeaders\(\)/);
assert.doesNotMatch(client, /targetState/);

console.log('GAP-6.1 intent-based Pack lifecycle API regression: PASS');
console.log('GAP-6.3 canonical frontend lifecycle client contract: PASS');
