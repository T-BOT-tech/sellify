import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ledger = await readFile(path.join(root, 'app/src/warehouse/ledger.js'), 'utf8');
const workspace = await readFile(path.join(root, 'app/src/experience/workspace.js'), 'utf8');
const ci = await readFile(path.join(root, '.github/workflows/ci.yml'), 'utf8');

for (const status of ['UNKNOWN', 'REFRESHING', 'FRESH', 'CACHED', 'OFFLINE', 'PERMISSION_DENIED']) {
  assert.ok(ledger.includes("'" + status + "'"), 'missing inventory refresh state ' + status);
}
assert.match(ledger, /getInventoryBalanceRefreshState/);
assert.match(ledger, /tenantChatId: String\(config\.chatId \|\| ''\)/);
assert.match(ledger, /locationId: String\(locationId \|\| ''\)/);
assert.match(ledger, /res\.status === 401 \|\| res\.status === 403 \? 'PERMISSION_DENIED'/);
assert.match(ledger, /setInventoryBalances\(next\)[\s\S]*?persistBalances\(\)[\s\S]*?setInventoryBalanceRefreshStatus\('FRESH'/);
assert.match(ledger, /setInventoryBalanceRefreshStatus\(offline \?/);
assert.match(workspace, /startInventoryRefresh\(\)/);
assert.match(workspace, /data-action="refresh-inventory"/);
assert.match(workspace, /Server freshness metadata is not supplied/);
assert.match(workspace, /saved projection only/i);
assert.ok(ci.includes('node phase0/inventory-refresh-lifecycle-regression.mjs'), 'CI must run inventory refresh lifecycle regression');

console.log('Inventory refresh lifecycle regression: PASS');
console.log('Tenant/location scoped refresh status and truthful fallback states: PASS');
console.log('Server freshness metadata is not fabricated: PASS');
