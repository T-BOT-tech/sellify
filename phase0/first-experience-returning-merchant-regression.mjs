import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const tenantSource = await readFile(new URL('../app/src/auth/tenant.js', import.meta.url), 'utf8');
const mainSource = await readFile(new URL('../app/src/main.js', import.meta.url), 'utf8');

assert.match(tenantSource,
  /if \(config\.sessionToken && config\.sessionExpiresAt && Date\.parse\(config\.sessionExpiresAt\) > Date\.now\(\) \+ 30_000\) return \{ authenticated: true \};/,
  'an unexpired tenant session must bypass first-run onboarding');
assert.match(tenantSource,
  /if \(data\.session && memberships\.length === 1\) \{\s*persistAuth\(data, memberships\[0\]\);\s*return \{ authenticated: true \};\s*\}/,
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
  /tenantAuthPromise\.then\(result => \{\s*if \(result\?\.authenticated && config\.chatId && config\.syncUrl\) return fetchRemoteCatalogAndBranding\(\);/,
  'authorized returning users must load tenant-scoped catalog/branding only after authentication');
assert.match(tenantSource,
  /export async function switchActiveTenant\(\)[\s\S]*?request\('\/auth\/select-tenant'[\s\S]*?persistAuth\(data, data\.membership\);[\s\S]*?window\.location\.reload\(\);/,
  'switching businesses must obtain server-selected context before reloading into the new workspace');

console.log('First-experience returning merchant regression: PASS');
