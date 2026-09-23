import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const contract = fs.readFileSync(new URL('../app/src/experience/pack-activation-contract.js', import.meta.url), 'utf8');

assert.match(source, /const PACK_LIFECYCLE_TRANSITIONS = Object\.freeze/);
assert.match(source, /export async function transitionPackLifecycle/);
assert.match(source, /INVALID_PACK_LIFECYCLE_TRANSITION/);
assert.match(source, /PACK_LIFECYCLE_VERSION_CONFLICT/);
assert.match(source, /BEGIN IMMEDIATE/);
assert.match(source, /ROLLBACK/);
assert.match(source, /pack\.lifecycle\.installed/);
assert.match(source, /pack\.lifecycle\.\$\{target\.toLowerCase\(\)\}/);
assert.match(contract, /backend\/lib\/store-sqlite\.js#pack_lifecycle/);
assert.match(contract, /backend\/lib\/store-sqlite\.js#transitionPackLifecycle/);
assert.match(contract, /server-side only/);

console.log('FUX-13.3 Pack Lifecycle Transaction regression: PASS');
