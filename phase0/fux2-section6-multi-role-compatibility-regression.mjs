import fs from 'node:fs';
import assert from 'node:assert/strict';

const store = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../backend/lib/authorization.js', import.meta.url), 'utf8');

assert.match(store, /CREATE TABLE IF NOT EXISTS membership_roles/);
assert.match(store, /membership_id TEXT NOT NULL REFERENCES memberships\(id\)/);
assert.match(store, /scope_type TEXT NOT NULL DEFAULT 'ORGANIZATION'/);
assert.match(store, /group_concat\(DISTINCT mr\.role_id\)/);
assert.match(store, /roles: Array\.from\(new Set/);
assert.match(store, /LEGACY_ROLE_CHANGE/);

assert.match(auth, /Array\.isArray\(actor\.roles\)/);
assert.match(auth, /permissions\.some\(set => set\.has\('\*'\)/);

console.log('FUX-2 Section 6 multi-role compatibility regression: PASS');
