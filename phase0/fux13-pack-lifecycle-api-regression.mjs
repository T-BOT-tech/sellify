import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');
const contract = fs.readFileSync(new URL('../app/src/experience/pack-activation-contract.js', import.meta.url), 'utf8');

assert.match(server, /handlePackLifecycle/);
assert.match(server, /pack:lifecycle:view/);
assert.match(server, /pack:lifecycle:install/);
assert.match(server, /pack:lifecycle:activate/);
assert.match(server, /pack:lifecycle:deactivate/);
assert.match(server, /pack:lifecycle:upgrade/);
assert.match(server, /requireAuthorization\(session, tenant, 'pack_lifecycle'/);
assert.match(server, /transitionPackLifecycle\(chatId, packId, targetState, session/);
assert.match(server, /packs\\\/.*lifecycle/);
assert.match(server, /lifecycle\$\//);
assert.match(server, /method: 'GET'/);
assert.match(server, /method: 'POST'/);
assert.doesNotMatch(server, /STORAGE_KEYS\.config.*pack_lifecycle/i);
assert.doesNotMatch(contract, /frontend activation API remains intentionally unavailable/);
assert.match(contract, /supported: true/);
assert.match(contract, /backend\/server\.js#handlePackLifecycle/);
assert.match(contract, /clients must use the authenticated canonical lifecycle API/);

console.log('FUX-13 Pack Lifecycle API / Authorization regression: PASS');
console.log('Canonical server routing: PASS');
console.log('Central authorization boundary: PASS');
console.log('No local lifecycle mutation authority: PASS');
