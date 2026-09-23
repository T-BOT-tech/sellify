import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../backend/lib/pack-lifecycle-readiness.js', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');

assert.match(source, /CORE_AUTHORITIES/);
assert.match(source, /VERTICAL_PACK_MANIFEST_LIST/);
assert.match(source, /PACK_REGISTRY/);
assert.match(source, /DEPENDENCY_UNAVAILABLE/);
assert.match(source, /assertPackLifecyclePrecondition/);
assert.match(source, /duplicateAuthorizationAuthority: false/);
assert.match(source, /duplicateConfigurationAuthority: false/);
assert.match(store, /assertPackLifecyclePrecondition/);
assert.match(store, /target === 'ELIGIBLE' \|\| target === 'ACTIVE'/);
assert.match(store, /manifest\?\.version/);

console.log('FUX-13.5 Pack Lifecycle Readiness regression: PASS');
