import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const ui = fs.readFileSync(path.join(root, 'app/src/procurement/ui.js'), 'utf8');
const ai = fs.readFileSync(path.join(root, 'app/src/p0-ai-procurement-proposal.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');

assert.match(ui, /prepareAiProposalFromSupplier/);
assert.match(ui, /preferredSupplierReferences/);
assert.match(ui, /authority: 'supplier_network'/);
assert.match(ui, /evidenceReferences/);
assert.match(ui, /supplyIntelligence: \{ derived: true, persistence: 'none', ranking: false \}/);
assert.match(ui, /procurement: \{ authority: 'existing procurement authority', authorizationRequired: true \}/);
assert.match(ui, /data-ai-supplier-proposal/);
assert.match(ui, /aiProcurementCopilot/);

// The bridge may prefill review context, but must not execute or persist procurement work.
assert.doesNotMatch(ui, /fetch\([^\n]+procurement\/awards/);
assert.doesNotMatch(ui, /fetch\([^\n]+b2b\/purchase-orders/);
assert.match(ai, /existing procurement authorization required/);
assert.match(ai, /Execution:<\/strong> none in Phase 22/);
assert.match(ai, /Persistence:<\/strong> none in Phase 22/);
assert.match(html, /id=["']aiProcurementCopilot["']/);

console.log('P0-06 Supplier Discovery → AI Procurement Proposal Bridge Regression: PASS');
