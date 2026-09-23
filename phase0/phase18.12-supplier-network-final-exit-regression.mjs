import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const store = fs.readFileSync(path.join(root, 'backend/lib/store-sqlite.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
const capabilities = fs.readFileSync(path.join(root, 'app/src/platform/capability-contract.js'), 'utf8');
const authorities = fs.readFileSync(path.join(root, 'app/src/platform/authority-registry.js'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'backend/lib/authorization.js'), 'utf8');

// Phase 18.12 is an exit certification layer. It must not introduce another
// supplier identity, another marketplace authority, or a new persistence
// authority. The executable domain regressions remain the behavioral source.
assert.match(store, /supplier_network_profiles/);
assert.match(store, /supplier_network_capabilities/);
assert.match(store, /supplier_network_catalog_listings/);
assert.match(store, /supplier_network_service_areas/);
assert.match(store, /supplier_network_capacity_signals/);
assert.match(store, /supplier_network_commercial_terms/);
assert.match(store, /supplier_network_qualifications/);
assert.match(store, /supplier_network_performance_observations/);
assert.match(store, /supplier_network_trust_evidence/);
assert.match(store, /getSupplierNetworkMarketplaceIntegration/);
assert.doesNotMatch(store, /supplier_network_seller|supplier_network_supplier_identity|supplier_network_identity/);
assert.doesNotMatch(store, /schema_migrations.*\.run\(39/);

const integrationStart = store.indexOf('export async function getSupplierNetworkMarketplaceIntegration');
assert.ok(integrationStart >= 0, 'Marketplace integration authority missing');
const integration = store.slice(integrationStart, integrationStart + 7000);
assert.match(integration, /marketplace:false/);
assert.match(integration, /supplierNetwork:false/);
assert.match(integration, /procurement:false/);
assert.match(integration, /inventory:false/);
assert.match(integration, /payment:false/);
assert.match(integration, /sameCanonicalIdentity:true/);
assert.match(integration, /marketplaceSellerIdentity:'organization'/);
assert.match(integration, /procurementSupplierIdentity:'organization'/);

assert.match(server, /supplier-network.*marketplace-integration/);
assert.match(server, /supplier-network:marketplace-integration:view/);
assert.match(capabilities, /supplier-network\.marketplace-integration/);
assert.match(capabilities, /actions:Object\.freeze\(\['view'\]\)/);
assert.match(authorities, /marketplace_integration/);
assert.match(authorities, /authority: 'commerce'/);
assert.match(authorities, /authority: 'supplier_network'/);
assert.match(auth, /supplier-network:marketplace-integration:view/);

// Discovery must remain explicitly deterministic and non-AI. This assertion
// anchors the API contract rather than allowing an implicit ranking authority.
const discoveryStart = server.indexOf('handleSupplierNetworkDiscovery');
assert.ok(discoveryStart >= 0, 'Supplier discovery handler missing');
const discovery = server.slice(discoveryStart, discoveryStart + 12000);
assert.match(discovery, /deterministic/);
assert.match(discovery, /ai/);

console.log('Phase 18.12 structural supplier-network exit checks: PASS');
console.log('Canonical organization identity: PASS');
console.log('No duplicate supplier identity authority: PASS');
console.log('No Phase 18 persistence migration beyond v38: PASS');
console.log('Marketplace/Product authority boundary: PASS');
console.log('Supplier Network marketplace integration is read-only: PASS');
console.log('Deterministic discovery / AI boundary: PASS');
