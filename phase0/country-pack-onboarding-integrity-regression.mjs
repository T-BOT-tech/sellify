import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { once } from 'node:events';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = mkdtempSync(path.join(tmpdir(), 'sellify-country-onboarding-'));
process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_DB_PATH = path.join(dataDir, 'sellify.sqlite');

const [store, packContract, security, onboarding, translations] = await Promise.all([
  import('../backend/lib/store-sqlite.js'),
  import('../app/src/country-pack-contract.js'),
  import('../backend/lib/country-security-expansion.js'),
  import('../backend/lib/country-pack-onboarding.js'),
  import('../app/src/i18n/translations.js'),
]);

let serverProcess;
let db;

async function freePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  return port;
}

try {
  const activeCodes = [...security.countrySecurityExpansionContract().activeCountrySecurity].sort();
  const options = onboarding.listOnboardingCountryOptions();
  assert.deepEqual(options.map(country => country.countryCode), activeCodes);
  assert.ok(options.every(country => country.status === 'active_country_pack'));
  assert.ok(options.every(country => country.implementationStatus === 'contract_only'));
  assert.deepEqual(
    activeCodes,
    packContract.listCountryPacks().map(code => packContract.getCountryPack(code).countryCode).sort(),
    'the active security roster and country-pack inventory must remain in parity',
  );

  for (const [code, alias] of [['ET', 'Ethiopia'], ['KE', 'Kenya'], ['TZ', 'Tanzania'], ['NG', 'Nigeria']]) {
    assert.equal(onboarding.resolveOnboardingCountry(code).countryCode, code);
    assert.equal(onboarding.resolveOnboardingCountry(alias).countryCode, code);
  }

  for (const [country, code] of [
    ['GH', 'COUNTRY_PACK_INACTIVE'],
    ['ZM', 'COUNTRY_PACK_INACTIVE'],
    ['UG', 'COUNTRY_PACK_INACTIVE'],
    ['XX', 'COUNTRY_PACK_UNKNOWN'],
    ['', 'COUNTRY_PACK_REQUIRED'],
  ]) {
    assert.throws(() => onboarding.resolveOnboardingCountry(country), error => error.code === code);
  }

  db = store.getDatabaseForTests();
  const rowCount = table => db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
  const beforeInvalidCreate = { tenants: rowCount('tenants'), memberships: rowCount('memberships') };
  for (const country of ['GH', 'ZM', 'UG', 'XX', '']) {
    const expectedCode = country === 'XX' ? 'COUNTRY_PACK_UNKNOWN' : country ? 'COUNTRY_PACK_INACTIVE' : 'COUNTRY_PACK_REQUIRED';
    await assert.rejects(
      store.createTenantForUser({
        userId: `must-not-be-used-${country || 'empty'}`,
        sellerName: 'Invalid country should not persist',
        businessType: 'retail',
        country,
        currency: 'ETB',
        timezone: 'UTC',
      }),
      error => error.code === expectedCode,
    );
  }
  assert.deepEqual(
    { tenants: rowCount('tenants'), memberships: rowCount('memberships') },
    beforeInvalidCreate,
    'invalid or inactive country choices must be rejected before tenant or membership persistence',
  );

  const runId = `${Date.now()}-${process.pid}`;
  for (const countryCode of activeCodes) {
    const pack = packContract.getCountryPack(countryCode);
    const user = await store.getOrCreateUserByTelegram(`country-onboarding-${runId}-${countryCode}`, 'Country Onboarding Test');
    const result = await store.createTenantForUser({
      userId: user.id,
      sellerName: `Country onboarding ${countryCode}`,
      businessType: 'retail',
      country: countryCode.toLowerCase(),
      currency: '',
      timezone: 'UTC',
    });
    assert.equal(result.tenant.country, countryCode);
    assert.equal(result.tenant.currency, pack.currency, 'blank currency defaults to the country-pack currency');
    const organization = db.prepare(`
      SELECT t.organization_id, o.country, o.currency
        FROM tenants t JOIN organizations o ON o.id = t.organization_id
       WHERE t.chat_id = ?
    `).get(result.chatId);
    assert.deepEqual({ country: organization.country, currency: organization.currency }, {
      country: countryCode,
      currency: pack.currency,
    });
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM pack_lifecycle WHERE organization_id = ?').get(organization.organization_id).count, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM payment_accounts WHERE organization_id = ?').get(organization.organization_id).count, 0);
  }

  const port = await freePort();
  let serverOutput = '';
  serverProcess = spawn(process.execPath, ['backend/server.js'], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port), SERVE_STATIC: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProcess.stdout.on('data', chunk => { serverOutput += chunk; });
  serverProcess.stderr.on('data', chunk => { serverOutput += chunk; });
  let response;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (serverProcess.exitCode !== null) throw new Error(`Backend exited before readiness: ${serverOutput}`);
    try {
      response = await fetch(`http://127.0.0.1:${port}/auth/country-packs`);
      break;
    } catch {
      await delay(50);
    }
  }
  assert.ok(response, `Backend country-options endpoint did not become ready: ${serverOutput}`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.authority, 'existing_country_pack_and_country_security_contracts');
  assert.equal(payload.persistence, 'none');
  assert.deepEqual(payload.countries.map(country => country.countryCode), activeCodes);

  const indexHtml = readFileSync(path.join(repoRoot, 'app/index.html'), 'utf8');
  const tenantUi = readFileSync(path.join(repoRoot, 'app/src/auth/tenant.js'), 'utf8');
  const supportedLanguages = Object.keys(translations.TRANSLATIONS);
  assert.equal(supportedLanguages.length, 13, 'onboarding must reuse the existing 13-language catalog');
  assert.match(indexHtml, /<label for="onboardingLanguage">Interface language<\/label>/);
  assert.match(indexHtml, /id="onboardingLanguage"[^>]*onchange="changeLanguage\(this\.value\)"/);
  assert.match(indexHtml, /does not determine business country, currency, or tax\/payment setup/);
  const onboardingModalStart = indexHtml.indexOf('<div class="modal-backdrop" id="onboardingModal"');
  const languageControl = indexHtml.indexOf('id="onboardingLanguage"', onboardingModalStart);
  const membershipPath = indexHtml.indexOf('<div id="onboardingTelegram">', onboardingModalStart);
  assert.ok(languageControl >= 0 && languageControl < membershipPath,
    'interface language must be outside create-only content and visible on existing/joining paths');
  assert.match(tenantUi, /import \{ TRANSLATIONS \} from '\.\.\/i18n\/translations\.js'/);
  assert.match(tenantUi, /Object\.keys\(TRANSLATIONS\)\.map/);
  assert.match(tenantUi, /Object\.hasOwn\(TRANSLATIONS, config\.lang\) \? config\.lang : 'en'/,
    'a saved supported interface language is preserved; missing/unsupported preferences default to English');
  const wizardSetup = tenantUi.slice(tenantUi.indexOf('function showWizard('), tenantUi.indexOf('export function closeOnboarding'));
  assert.match(wizardSetup, /populateOnboardingLanguageOptions\(\)[\s\S]*?if \(memberships\.length/,
    'language preference must initialize before existing-versus-new-business onboarding routing');
  assert.match(tenantUi, /regional locale hint/);
  const tenantCreation = tenantUi.slice(
    tenantUi.indexOf('export async function createOnboardingTenant()'),
    tenantUi.indexOf('// Step 5 of the wizard'),
  );
  assert.match(tenantCreation, /body: JSON\.stringify\(\{ sellerName, businessType, country, currency, timezone,/);
  assert.doesNotMatch(tenantCreation, /\blanguage\b|\blang\b/,
    'interface language must not become tenant country or legal-jurisdiction data');
  assert.match(indexHtml, /<select id="onboardingCountry" required disabled>/);
  assert.match(indexHtml, /id="onboardingCountryPackPreview"/);
  assert.match(tenantUi, /request\('\/auth\/country-packs'\)/);
  assert.match(tenantUi, /Choose a country with an active country pack/);

  console.log('PASS country-pack onboarding integrity: active options, aliases, fail-closed persistence, normalized defaults, no activation side effects, and HTTP projection');
} finally {
  if (serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill('SIGTERM');
    await Promise.race([once(serverProcess, 'exit'), delay(2_000)]);
  }
  try { db?.close(); } catch {}
  rmSync(dataDir, { recursive: true, force: true });
}
