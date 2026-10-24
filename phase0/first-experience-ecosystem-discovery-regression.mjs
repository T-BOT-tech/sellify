import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, tabs, discovery, capabilityDiscovery, addMenu] = await Promise.all([
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/ui/tabs.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/experience/ecosystem-discovery.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/platform/capability-discovery.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/ui/add-menu.js', import.meta.url), 'utf8'),
]);

const marketplaceStart = html.indexOf('id="tab-marketplace"');
const marketplace = html.slice(marketplaceStart, html.indexOf('</section>', marketplaceStart));
assert.match(marketplace, /id="marketEcosystemDiscovery"/,
  'the existing Marketplace route must host the ecosystem discovery surface');
assert.match(marketplace, /id="marketProductList"/,
  'purchasable offerings must remain in the existing product listing surface');
assert.match(marketplace, /Products &amp; services to purchase/,
  'purchasable listings must be labeled separately from ecosystem metadata');
assert.match(marketplace, /id="multiCartBar"/,
  'marketplace cart/checkout presentation must remain intact');
assert.match(tabs, /renderEcosystemDiscovery\(\)/,
  'opening Marketplace must render the ecosystem index');
assert.match(discovery, /discoverPlatformSurface/,
  'capability and integration metadata must come from existing canonical discovery contracts');
assert.match(discovery, /execution: 'none'/);
assert.match(discovery, /persistence: 'none'/);
assert.match(discovery, /status and actions describe metadata, not readiness or activation/i);
assert.match(discovery, /Review Pack readiness/);
assert.match(discovery, /openAddSettings\('configure-packs'\)/,
  'Pack navigation must use the existing settings/readiness route');
assert.match(discovery, /Review channel connections/);
assert.match(discovery, /openAddSettings\('connect-sales-channels'\)/,
  'channel connection must use the existing settings workflow');
assert.match(discovery, /Seller registration/);
assert.match(discovery, /No supported in-app seller-registration workflow is declared/,
  'seller registration must not be represented as a purchase or an implemented action');
assert.match(discovery, /workspaces/);
assert.match(addMenu, /'configure-packs': 'packReadinessPanel'/);
assert.match(addMenu, /'connect-sales-channels': 'sellerStorefrontChannelsPanel'/);
assert.match(capabilityDiscovery, /discovery: 'metadata_only'/);
assert.match(capabilityDiscovery, /execution: 'none'/);
assert.doesNotMatch(discovery, /fetch\(|\.post\(|method:\s*['"]POST/i,
  'the discovery surface must not execute or mutate any domain operation');

console.log('First-experience Stage 5 ecosystem discovery regression: PASS');
