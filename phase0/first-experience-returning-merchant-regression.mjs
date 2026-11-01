import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const tenantSource = await readFile(new URL('../app/src/auth/tenant.js', import.meta.url), 'utf8');
const mainSource = await readFile(new URL('../app/src/main.js', import.meta.url), 'utf8');

assert.match(tenantSource,
  /if \(config\.sessionToken && config\.sessionExpiresAt && Date\.parse\(config\.sessionExpiresAt\) > Date\.now\(\) \+ 30_000\) \{[\s\S]*?return \{ authenticated: true \};\s*\}/,
  'an unexpired tenant session must bypass first-run onboarding');
assert.match(tenantSource,
  /export async function bootstrapTenantAuth\(\) \{[\s\S]*?loadJSONAsync\(STORAGE_KEYS\.config, null\)[\s\S]*?setConfig\(\{ \.\.\.config, \.\.\.persistedConfig \}\);[\s\S]*?if \(config\.sessionToken/,
  'returning-merchant bootstrap must hydrate IndexedDB-backed config before deciding whether to show onboarding');
assert.match(tenantSource,
  /export async function switchActiveTenant\(\)[\s\S]*?const persistedAuth = persistAuth\(data, data\.membership\);[\s\S]*?await saveJSONAsync\(STORAGE_KEYS\.config, persistedAuth\)[\s\S]*?window\.location\.reload\(\);/,
  'tenant switching must durably persist the server-issued session before reloading');
assert.match(tenantSource,
  /if \(data\.session && memberships\.length === 1\) \{[\s\S]*?persistAuth\(data, memberships\[0\]\);[\s\S]*?return \{ authenticated: true \};\s*\}/,
  'a Telegram user with exactly one authorized business must persist that membership and continue directly');
assert.match(tenantSource,
  /if \(data\.challenge\?\.token\)[\s\S]*?showWizard\(\{ user: data\.user, memberships \}\);\s*return \{ authenticated: false, onboarding: true \};/,
  'multiple memberships must continue through the tenant-selection onboarding state');
assert.match(tenantSource,
  /selectOnboardingTenant\(\)[\s\S]*?request\('\/auth\/select-tenant'[\s\S]*?Authorization: `Bearer \$\{config\.sessionToken\}`[\s\S]*?persistAuth\(data, data\.membership\)/,
  'tenant choice must be submitted using the authenticated session and persist the server-selected membership');
assert.match(tenantSource,
  /next\.organizationId = data\.session\.organizationId \|\| next\.organizationId \|\| '';/,
  'workspace organization context must come from the selected session when supplied');
assert.match(tenantSource,
  /next\.locationId = data\.session\.locationId \|\| next\.locationId \|\| '';/,
  'workspace location context must come from the selected session when supplied');
assert.match(tenantSource,
  /next\.tenantId = membership\.tenantId;/,
  'the selected membership must persist its canonical tenant identifier');
assert.match(mainSource,
  /tenantAuthPromise\.then\(result =>[\s\S]*?if \(result\?\.authenticated && config\.chatId && config\.syncUrl\)[\s\S]*?return fetchRemoteCatalogAndBranding\(\);/,
  'authorized returning users must load tenant-scoped catalog/branding only after authentication');
assert.match(tenantSource,
  /export async function switchActiveTenant\(\)[\s\S]*?request\('\/auth\/select-tenant'[\s\S]*?persistAuth\(data, data\.membership\);[\s\S]*?window\.location\.reload\(\);/,
  'switching businesses must obtain server-selected context before reloading into the new workspace');

console.log('First-experience returning merchant regression: PASS');
