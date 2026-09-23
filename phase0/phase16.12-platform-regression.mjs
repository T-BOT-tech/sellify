import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const pkg = JSON.parse(read('package.json'));

const controls = Array.from({ length: 12 }, (_, i) => `phase0/phase16.${i}-`);
const phaseScripts = [
  'test:phase16.0', 'test:phase16.1', 'test:phase16.2', 'test:phase16.3',
  'test:phase16.4', 'test:phase16.5', 'test:phase16.6', 'test:phase16.7',
  'test:phase16.8', 'test:phase16.9', 'test:phase16.10', 'test:phase16.11',
];

const required = [
  'phase0/PHASE16.0-PLATFORM-BASELINE-LOCK.md',
  'phase0/PHASE16.1-CANONICAL-CAPABILITY-CONTRACT.md',
  'phase0/PHASE16.2-AUTHORITY-REGISTRY.md',
  'phase0/PHASE16.3-ADAPTER-FRAMEWORK.md',
  'phase0/PHASE16.4-INTEGRATION-CONTRACTS.md',
  'phase0/PHASE16.5-CAPABILITY-DISCOVERY.md',
  'phase0/PHASE16.6-CONTRACT-VERSIONING.md',
  'phase0/PHASE16.7-EVENT-OUTBOX-PLATFORMIZATION.md',
  'phase0/PHASE16.8-EXTERNAL-INTEGRATION-GATEWAY.md',
  'phase0/PHASE16.9-TENANT-COUNTRY-VERTICAL-COMPOSITION.md',
  'phase0/PHASE16.10-AI-CAPABILITY-BOUNDARY.md',
  'phase0/PHASE16.11-PLATFORM-SECURITY.md',
  'phase0/phase16.0-platform-baseline-regression.mjs',
  'phase0/phase16.1-canonical-capability-contract-regression.mjs',
  'phase0/phase16.2-authority-registry-regression.mjs',
  'phase0/phase16.3-adapter-framework-regression.mjs',
  'phase0/phase16.4-integration-contract-regression.mjs',
  'phase0/phase16.5-capability-discovery-regression.mjs',
  'phase0/phase16.6-contract-versioning-regression.mjs',
  'phase0/phase16.7-event-outbox-platformization-regression.mjs',
  'phase0/phase16.8-integration-gateway-regression.mjs',
  'phase0/phase16.9-tenant-country-vertical-regression.mjs',
  'phase0/phase16.10-ai-capability-boundary-regression.mjs',
  'phase0/phase16.11-platform-security-regression.mjs',
  'app/src/platform/index.js',
  'app/src/platform/capability-contract.js',
  'app/src/platform/authority-registry.js',
  'app/src/platform/adapter-framework.js',
  'app/src/platform/integration-contract.js',
  'app/src/platform/capability-discovery.js',
  'app/src/platform/contract-versioning.js',
  'app/src/platform/event-outbox-platform.js',
  'app/src/platform/integration-gateway.js',
  'app/src/platform/tenant-country-vertical.js',
  'app/src/platform/ai-capability-boundary.js',
  'app/src/platform/platform-security.js',
  'backend/lib/authorization.js',
  'backend/lib/security-context.js',
  'backend/lib/tenant-isolation.js',
  'backend/lib/country-security-expansion.js',
  'backend/lib/vertical-capability-authorization.js',
  'app/src/sync/outbox.js',
  'backend/lib/store-sqlite.js',
  'phase0/golden-regression.mjs',
  'phase0/PHASE16.12-PLATFORM-REGRESSION.md',
];

for (const rel of required) assert(exists(rel), `Missing Phase 16.12 gate artifact: ${rel}`);
assert.equal(pkg.engines?.node, '>=24', 'Node >=24 requirement changed');

for (const script of phaseScripts) {
  assert.equal(typeof pkg.scripts?.[script], 'string', `Missing completed Phase 16 control: ${script}`);
  assert.match(pkg.scripts[script], /^node\s+phase0\/phase16\.[0-9]+.*\.mjs$/, `Unexpected command shape: ${script}`);
}
assert.equal(pkg.scripts?.['test:phase16.12'], 'node phase0/phase16.12-platform-regression.mjs', 'Phase 16.12 gate command changed');

const platformIndex = read('app/src/platform/index.js');
for (const exportName of [
  'getPlatformCapability', 'getPlatformAuthority', 'getPlatformAdapter',
  'getPlatformIntegration', 'discoverPlatformCapabilities',
  'parsePlatformContractVersion', 'buildPlatformVersionedEvent',
  'validateIntegrationGatewayRequest', 'resolvePlatformTenantCountryVerticalComposition',
  'defineAiCapabilityIntent', 'authorizePlatformRequest',
]) assert.match(platformIndex, new RegExp(`\\b${exportName}\\b`), `Public platform export missing: ${exportName}`);

const platformFiles = [
  'app/src/platform/capability-contract.js',
  'app/src/platform/authority-registry.js',
  'app/src/platform/adapter-framework.js',
  'app/src/platform/integration-contract.js',
  'app/src/platform/capability-discovery.js',
  'app/src/platform/contract-versioning.js',
  'app/src/platform/event-outbox-platform.js',
  'app/src/platform/integration-gateway.js',
  'app/src/platform/tenant-country-vertical.js',
  'app/src/platform/ai-capability-boundary.js',
  'app/src/platform/platform-security.js',
];

const forbiddenOwnership = /CREATE\s+TABLE|new\s+Database\b|new\s+(?:EventStore|MessageBroker|TransactionEngine)\b|owns(?:Database|Persistence|Authorization|IdentityStore|TenantStore|OrganizationStore|LocationStore|CountryStore|VerticalStore)\s*[:=]\s*true/i;
for (const rel of platformFiles) {
  const source = read(rel);
  assert(!forbiddenOwnership.test(source), `Duplicate platform authority detected in ${rel}`);
}

const security = read('app/src/platform/platform-security.js');
assert.match(security, /authorizePlatformRequest/);
assert.match(security, /authorization\s*=/);
assert.match(security, /PLATFORM_SECURITY_FORBIDDEN_AUTHORITIES/);

const gateway = read('app/src/platform/integration-gateway.js');
assert.match(gateway, /authorize/);
assert.match(gateway, /tenant/i);

const eventPlatform = read('app/src/platform/event-outbox-platform.js');
assert.match(eventPlatform, /app\/src\/sync\/outbox\.js#enqueueEvent/);
assert.match(eventPlatform, /backend\/lib\/store-sqlite\.js#processSyncEvent/);

const ai = read('app/src/platform/ai-capability-boundary.js');
for (const forbidden of ['database', 'credentials', 'directExecution']) assert.match(ai, new RegExp(forbidden));

const resultSummary = [];
for (const script of phaseScripts) {
  const command = pkg.scripts[script];
  const scriptPath = command.replace(/^node\s+/, '');
  const result = spawnSync(process.execPath, [scriptPath], { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Regression control failed: ${script} (status ${result.status})`);
  resultSummary.push(script);
}

const golden = spawnSync(process.execPath, ['phase0/golden-regression.mjs'], { cwd: ROOT, stdio: 'inherit' });
if (golden.status !== 0) throw new Error(`Phase 0 Golden Regression failed (status ${golden.status})`);

console.log(`Phase 16.12 Platform Regression: PASS`);
console.log(`Completed Phase 16 controls executed: ${resultSummary.length}/12`);
console.log('Platform public boundary: PASS');
console.log('No duplicate platform persistence/authority detected: PASS');
console.log('AI capability boundary: PASS');
console.log('Integration gateway boundary: PASS');
console.log('Event/outbox authority preservation: PASS');
console.log('Phase 0 Golden Regression: PASS');
console.log(`Runtime observed: ${process.version}`);
console.log('Node >=24 certification: DEFERRED TO PHASE 16.13');
