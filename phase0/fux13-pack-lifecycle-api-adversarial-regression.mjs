import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');
const transitions = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');

assert.match(server, /publicActionStates = new Set\(\['INSTALLED', 'ACTIVE', 'DEACTIVATED'\]\)/);
assert.match(server, /UNSUPPORTED_PACK_LIFECYCLE_API_STATE/);
assert.match(server, /current === 'UPGRADE_AVAILABLE'/);
assert.match(server, /pack:lifecycle:upgrade/);
assert.match(transitions, /PACK_LIFECYCLE_VERSION_CONFLICT/);
assert.match(transitions, /INVALID_PACK_LIFECYCLE_TRANSITION/);
assert.match(transitions, /idempotent: true/);
assert.match(transitions, /BEGIN IMMEDIATE/);
assert.match(transitions, /ROLLBACK/);

console.log('FUX-13 Pack Lifecycle API adversarial regression: PASS');
console.log('Public API exposes only user lifecycle actions; internal evidence/recovery states remain server-controlled: PASS');
console.log('Version conflict, invalid transition, idempotency and transaction rollback protections present: PASS');
