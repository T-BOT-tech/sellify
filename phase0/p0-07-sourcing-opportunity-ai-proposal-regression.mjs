import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const ui = fs.readFileSync(path.join(root, 'app/src/procurement/ui.js'), 'utf8');
const discovery = fs.readFileSync(path.join(root, 'backend/lib/discovery/opportunity-model.js'), 'utf8');
const ai = fs.readFileSync(path.join(root, 'app/src/p0-ai-procurement-proposal.js'), 'utf8');

assert.match(ui, /lastSourcingOpportunities/);
assert.match(ui, /data\.opportunities/);
assert.match(ui, /prepareAiProposalFromOpportunity/);
assert.match(ui, /sourcingOpportunityReference/);
assert.match(ui, /authority: 'discovery_opportunity'/);
assert.match(ui, /persistence: 'none', ranking: false, deterministic: true/);
assert.match(ui, /data-ai-opportunity-index/);
assert.match(ui, /existing procurement authority/);
assert.match(ui, /authorizationRequired: true/);

assert.match(discovery, /persistent: false/);
assert.match(discovery, /owningDomainRequired: true/);
assert.match(discovery, /procurementMutation: false/);
assert.match(discovery, /aiRanking: false/);

assert.match(ai, /existing procurement authorization required/);
assert.match(ai, /Execution:<\/strong> none in Phase 22/);
assert.match(ai, /Persistence:<\/strong> none in Phase 22/);

console.log('P0-07 Sourcing Opportunity → AI Procurement Proposal Regression: PASS');
