import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');

// Migration 54 must be independently evaluated when migration 53 is already
// present in schema_migrations. Nesting 54 under the 53 conditional silently
// skips the unique verification index on partially upgraded databases.
const migration53 = source.match(
  /if \(!applied\.includes\(53\)\)\s*\{([\s\S]*?)run\(53, nowIso\(\)\);([\s\S]*?)\}/,
);
assert.ok(migration53, 'migration 53 has an explicit, closed migration block');

const migration54 = source.match(
  /if \(!applied\.includes\(54\)\)\s*\{([\s\S]*?)run\(54, nowIso\(\)\);\s*\}/,
);
assert.ok(migration54, 'migration 54 has its own independent migration block');
assert.match(
  migration54[1],
  /CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_verifications_evidence_verifier\s+ON payment_verifications\(evidence_id, verifier, verifier_version\)/,
  'migration 54 installs the verification idempotency index',
);

// Guard the precise regression: the migration-53 block must close before the
// migration-54 conditional begins.
const start53 = source.indexOf('if (!applied.includes(53))');
const end53 = source.indexOf('run(53, nowIso());', start53);
const close53 = source.indexOf('\n  }', end53);
const start54 = source.indexOf('if (!applied.includes(54))', start53);
assert.ok(start53 >= 0 && end53 > start53 && close53 > end53 && start54 > close53,
  'migration 54 is not nested inside migration 53');

console.log('GAP-1.18I migration independence regression passed');
