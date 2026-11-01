import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-first-experience-browser-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');
process.env.SELLIFY_BACKUP_DIR = path.join(tempDir, 'backups');

let child;
let output = '';
let browser;

async function freePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function waitForHealth(baseUrl) {
  let lastError;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error('Backend exited before browser journey: ' + output);
    }
    try {
      const response = await fetch(baseUrl + '/health');
      if (response.ok) return;
      lastError = new Error('health returned ' + response.status);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Backend did not become healthy: ' + lastError?.message + '\n' + output);
}

async function waitForCatalogItem(baseUrl, chatId, token, itemName) {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(baseUrl + '/catalog/' + encodeURIComponent(chatId), {
      headers: { Authorization: 'Bearer ' + token },
    });
    lastStatus = response.status;
    if (response.ok) {
      const data = await response.json();
      const item = (data.products || []).find(product => product.name === itemName);
      if (item) return item;
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('First catalog item was not persisted through browser sync; last HTTP status=' + lastStatus);
}

async function readPersistedBrowserConfig(page) {
  return page.evaluate(async () => {
    const fallback = () => {
      try { return JSON.parse(localStorage.getItem('ledger_config') || '{}'); } catch { return {}; }
    };
    return new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        resolve(value && typeof value === 'object' ? value : fallback());
      };
      const timer = setTimeout(() => finish(fallback()), 2000);
      try {
        const request = indexedDB.open('ledger_db', 1);
        request.onerror = () => { clearTimeout(timer); finish(fallback()); };
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        };
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('kv')) {
            db.close();
            clearTimeout(timer);
            finish(fallback());
            return;
          }
          const tx = db.transaction('kv', 'readonly');
          const get = tx.objectStore('kv').get('ledger_config');
          get.onsuccess = () => {
            clearTimeout(timer);
            db.close();
            finish(get.result || fallback());
          };
          get.onerror = () => {
            clearTimeout(timer);
            db.close();
            finish(fallback());
          };
        };
      } catch {
        clearTimeout(timer);
        finish(fallback());
      }
    });
  });
}

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const user = await store.getOrCreateUserByTelegram(
    'first-experience-browser-' + Date.now(),
    'First Experience Browser Regression',
  );
  const challenge = await store.createAuthChallenge(user.id);
  const port = await freePort();
  const baseUrl = 'http://127.0.0.1:' + port;

  child = spawn(process.execPath, ['backend/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      NODE_ENV: 'test',
      CORS_ALLOWED_ORIGINS: baseUrl,
      RATE_LIMIT_MAX_WRITES: '500',
      // The real PWA loads hundreds of ES modules; the reload must not trip
      // the backend's production per-IP read budget inside this isolated test.
      RATE_LIMIT_MAX_READS: '5000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  await waitForHealth(baseUrl);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];
  const consoleErrors = [];
  let selectTenantResponseStatus = null;
  let selectTenantResponseBodyPromise = null;
  page.on('pageerror', error => pageErrors.push(error.stack || error.message));
  page.on('requestfailed', request => failedRequests.push(request.url() + ' :: ' + (request.failure()?.errorText || 'request failed')));
  page.on('response', response => {
    if (response.status() >= 400) badResponses.push(response.status() + ' ' + response.url());
    if (new URL(response.url()).pathname === '/auth/select-tenant'
      && response.request().method() === 'POST') {
      selectTenantResponseStatus = response.status();
      // Read the response body immediately: switchActiveTenant reloads the
      // page as soon as its own fetch has consumed this response.
      selectTenantResponseBodyPromise = response.json().catch(error => ({ __readError: error.message }));
    }
  });
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  // Keep the UI and business APIs real. Only Telegram's external signed
  // initData proof is represented by a deterministic fixture. Its response
  // mirrors the real backend contract using live canonical memberships and
  // backend-issued sessions/challenges, including the returning-user case.
  await page.route('https://telegram.org/**', route => route.abort());
  await page.route(baseUrl + '/auth/telegram', async route => {
    const memberships = await store.listUserMemberships(user.id);
    let authPayload;
    if (memberships.length === 1) {
      const session = await store.createSession({
        userId: user.id,
        chatId: memberships[0].chatId,
        deviceName: 'First Experience browser regression',
        ttlMs: 24 * 60 * 60 * 1000,
      });
      authPayload = { user: { id: user.id, displayName: 'First Experience Browser Regression' }, memberships, session };
    } else {
      const nextChallenge = memberships.length ? await store.createAuthChallenge(user.id) : challenge;
      authPayload = {
        user: { id: user.id, displayName: 'First Experience Browser Regression' },
        memberships,
        challenge: { token: nextChallenge.token },
      };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(authPayload),
    });
  });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('__sellify_first_experience_browser_started')) {
      localStorage.clear();
      sessionStorage.setItem('__sellify_first_experience_browser_started', '1');
    }
    window.Telegram = {
      WebApp: {
        initData: 'deterministic-first-experience-browser-init-data',
        initDataUnsafe: { user: { id: 999991, first_name: 'First Experience', last_name: 'Regression' } },
        themeParams: {},
        colorScheme: 'light',
        ready() {},
        expand() {},
        setBackgroundColor() {},
        setHeaderColor() {},
      },
    };
  });

  const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  assert.equal(response?.status(), 200, 'browser must load the real Sellify application');
  await page.locator('#onboardingModal').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#onboardingCountry option[value="ET"]').waitFor({ state: 'attached', timeout: 15000 });
  await page.locator('#onboardingCountry').selectOption('ET');
  await page.locator('#onboardingBusinessName').fill('Browser First Sale Store');
  await page.locator('#onboardingBusinessTemplate').selectOption('retail-shop');
  await page.getByRole('button', { name: 'Create business' }).click();

  await page.locator('#onboardingFirstProduct').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#onboardingProdName').fill('Browser First Product');
  await page.locator('#onboardingProdCategory').fill('Regression');
  await page.locator('#onboardingProdUnit').fill('piece');
  await page.locator('#onboardingProdPrice').fill('25');
  await page.locator('#onboardingProdStock').fill('5');
  await page.locator('#onboardingAddOfferingButton').click();
  await page.locator('#onboardingDone').waitFor({ state: 'visible', timeout: 10000 });

  const config = await page.evaluate(async () => {
    const localFallback = () => {
      try { return JSON.parse(localStorage.getItem('ledger_config') || '{}'); } catch { return {}; }
    };
    return await new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        resolve(value && typeof value === 'object' ? value : localFallback());
      };
      const timer = setTimeout(() => finish(localFallback()), 2000);
      try {
        const request = indexedDB.open('ledger_db', 1);
        request.onerror = () => { clearTimeout(timer); finish(localFallback()); };
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        };
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('kv')) {
            db.close();
            clearTimeout(timer);
            finish(localFallback());
            return;
          }
          const tx = db.transaction('kv', 'readonly');
          const get = tx.objectStore('kv').get('ledger_config');
          get.onsuccess = () => {
            clearTimeout(timer);
            db.close();
            finish(get.result || localFallback());
          };
          get.onerror = () => {
            clearTimeout(timer);
            db.close();
            finish(localFallback());
          };
        };
      } catch {
        clearTimeout(timer);
        finish(localFallback());
      }
    });
  });
  assert.ok(config.chatId, 'onboarding UI must persist the canonical tenant identity in IndexedDB/local fallback');
  assert.ok(config.sessionToken, 'onboarding UI must persist the issued tenant session in IndexedDB/local fallback');
  assert.equal(config.businessTemplate, 'retail-shop', 'selected business template must remain in the active UI context');

  const item = await waitForCatalogItem(baseUrl, config.chatId, config.sessionToken, 'Browser First Product');
  assert.equal(item.item_type, 'product', 'the first offering must persist as a physical product');
  assert.equal(Number(item.price), 2500, 'the first offering price must be normalized to ETB minor units');

  const templateResponse = await fetch(
    baseUrl + '/tenants/' + encodeURIComponent(config.chatId) + '/business-template',
    { headers: { Authorization: 'Bearer ' + config.sessionToken } },
  );
  assert.equal(templateResponse.status, 200, 'canonical business-template read must succeed');
  const templateBody = await templateResponse.json();
  assert.equal(templateBody.businessTemplate?.templateKey, 'retail-shop',
    'selected template must persist on the canonical backend, not only in local UI state');

  // Complete the actual first-run journey before testing a returning session.
  // The Done screen intentionally keeps onboarding open until the merchant
  // chooses "Start selling"; a raw reload here would only reopen the wizard.
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
    page.getByRole('button', { name: 'Start selling' }).click(),
  ]);
  await page.locator('#onboardingModal').waitFor({ state: 'hidden', timeout: 15000 });

  // Reload once more in the same browser context. This independently exercises
  // persisted device state and returning-merchant auth bootstrap.
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.locator('#onboardingModal').waitFor({ state: 'hidden', timeout: 15000 });
  try {
    await page.waitForFunction(() => typeof window.switchTab === 'function', null, { timeout: 10000 });
  } catch (error) {
    const diagnostics = await page.evaluate(() => ({
      readyState: document.readyState,
      scripts: [...document.scripts].map(script => script.src || '[inline]'),
      moduleResources: performance.getEntriesByType('resource')
        .map(entry => entry.name).filter(name => /\\.js(?:$|\\?)/.test(name)),
      bridgeType: typeof window.switchTab,
      bodyText: (document.body?.innerText || '').slice(0, 1200),
    })).catch(e => ({ evaluateError: e.message }));
    throw new Error('Application bridge did not restore after reload. URL: ' + page.url()
      + '; page errors: ' + pageErrors.join(' | ')
      + '; console errors: ' + consoleErrors.join(' | ')
      + '; failed requests: ' + failedRequests.join(' | ')
      + '; bad responses: ' + badResponses.join(' | ')
      + '; browser diagnostics: ' + JSON.stringify(diagnostics)
      + '; cause: ' + error.message);
  }
  const restoredConfig = await readPersistedBrowserConfig(page);
  assert.equal(String(restoredConfig.chatId), String(config.chatId),
    'reload must restore the same canonical active tenant');
  assert.ok(restoredConfig.sessionToken,
    'reload must restore an authenticated tenant session (the backend may rotate the device token)');
  assert.equal(restoredConfig.businessTemplate, 'retail-shop',
    'reload must retain the selected business template for the same tenant');
  await page.evaluate(() => window.switchTab('order'));
  const restoredProduct = page.locator('#productList').getByText('Browser First Product', { exact: true });
  await restoredProduct.waitFor({ state: 'visible', timeout: 15000 });
  assert.equal(await restoredProduct.textContent(), 'Browser First Product',
    'the first catalog item must remain visible in the real application after reload');

  // Re-read canonical server state after the browser restart boundary; a
  // surviving local projection alone must not be mistaken for backend truth.
  const restoredMembershipsResponse = await fetch(baseUrl + '/auth/tenants', {
    headers: { Authorization: 'Bearer ' + restoredConfig.sessionToken },
  });
  assert.equal(restoredMembershipsResponse.status, 200,
    'the session restored after reload must authenticate against the tenant membership API');
  const restoredMemberships = await restoredMembershipsResponse.json();
  assert.ok((restoredMemberships.memberships || []).some(membership => String(membership.chatId) === String(config.chatId)),
    'the restored session must retain access to the same canonical tenant');

  const reloadedCatalog = await fetch(baseUrl + '/catalog/' + encodeURIComponent(config.chatId), {
    headers: { Authorization: 'Bearer ' + restoredConfig.sessionToken },
  });
  assert.equal(reloadedCatalog.status, 200, 'canonical catalog must remain readable after browser reload');
  const reloadedCatalogBody = await reloadedCatalog.json();
  const reloadedItem = reloadedCatalogBody.products.find(product => product.name === 'Browser First Product');
  assert.ok(reloadedItem, 'canonical catalog must still contain the first offering after reload');
  assert.equal(reloadedItem.item_type, 'product');
  assert.equal(Number(reloadedItem.price), 2500);

  // Create a second business through the authenticated owner API contract.
  // This creates a real membership for the same identity; no test-only
  // membership insertion or direct database mutation is used.
  const firstChatId = String(config.chatId);
  const secondCreateResponse = await fetch(baseUrl + '/auth/tenants', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + restoredConfig.sessionToken,
    },
    body: JSON.stringify({
      sellerName: 'Browser Second Business',
      businessType: 'services',
      country: 'ET',
      timezone: 'Africa/Addis_Ababa',
      deviceName: 'First Experience multi-business regression',
    }),
  });
  assert.equal(secondCreateResponse.status, 201,
    'an authenticated owner must be able to create another business for the same identity');
  const secondCreateBody = await secondCreateResponse.json();
  const secondChatId = String(secondCreateBody.membership?.chatId || secondCreateBody.session?.chatId || '');
  const secondSessionToken = String(secondCreateBody.session?.token || '');
  assert.ok(secondChatId && secondChatId !== firstChatId, 'second business must have a distinct canonical tenant identity');
  assert.ok(secondSessionToken, 'second business creation must issue a tenant-scoped session');

  const secondTemplateResponse = await fetch(
    baseUrl + '/tenants/' + encodeURIComponent(secondChatId) + '/business-template',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + secondSessionToken,
      },
      body: JSON.stringify({ templateKey: 'repair' }),
    },
  );
  assert.equal(secondTemplateResponse.status, 200,
    'second business must accept its own canonical business-template configuration');

  // Confirm the server has actually attached both tenants to the same
  // authenticated identity before testing the UI projection.
  const membershipsResponse = await fetch(baseUrl + '/auth/tenants', {
    headers: { Authorization: 'Bearer ' + restoredConfig.sessionToken },
  });
  assert.equal(membershipsResponse.status, 200, 'authenticated owner must be able to list business memberships');
  const membershipsBody = await membershipsResponse.json();
  assert.equal((membershipsBody.memberships || []).length, 2,
    'both canonical businesses must be active memberships for the same identity');

  // Exercise the actual Settings switcher and its server-issued session
  // exchange, then verify that the first business projection is not carried
  // into the second tenant. Assert both the canonical API membership state
  // and the actual rendered Settings controls so swallowed errors cannot hide failure.
  await page.locator('#gearSettingsBtn').click();
  try {
    await page.locator('#settingsModal.open').waitFor({ state: 'visible', timeout: 10000 });
  } catch (error) {
    const settingsDiagnostics = await page.evaluate(() => ({
      url: location.href,
      button: document.getElementById('gearSettingsBtn')?.outerHTML,
      openSettingsType: typeof window.openSettings,
      modalClass: document.getElementById('settingsModal')?.className,
      modalDisplay: document.getElementById('settingsModal') ? getComputedStyle(document.getElementById('settingsModal')).display : null,
      tenantControlsDisplay: document.getElementById('tenantSwitcherControls')?.style.display,
      bodyText: (document.body?.innerText || '').slice(0, 1600),
    })).catch(e => ({ evaluateError: e.message }));
    throw new Error('Settings did not open from its real header button. '
      + 'page errors: ' + pageErrors.join(' | ')
      + '; console errors: ' + consoleErrors.join(' | ')
      + '; diagnostics: ' + JSON.stringify(settingsDiagnostics)
      + '; cause: ' + error.message);
  }
  // renderTenantSwitcher is intentionally best-effort in Settings. Waiting for
  // its rendered control proves the browser request completed and the UI
  // received both memberships; the canonical API count above independently
  // proves the server-side membership state.
  await page.locator('#tenantSwitcherControls').waitFor({ state: 'visible', timeout: 15000 });
  const renderedTenantOptions = await page.locator('#tenantSwitcherSelect option').evaluateAll(
    options => options.map(option => ({ value: option.value, label: option.textContent })),
  );
  assert.equal(renderedTenantOptions.length, 2,
    'Settings tenant switcher must render both canonical memberships');
  assert.ok(renderedTenantOptions.some(option => option.value === firstChatId),
    'Settings tenant switcher must include the first business');
  assert.ok(renderedTenantOptions.some(option => option.value === secondChatId),
    'Settings tenant switcher must include the second business');
  await page.locator('#tenantSwitcherSelect').selectOption(secondChatId);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
    page.locator('#tenantSwitcherControls button').click(),
  ]);
  assert.equal(selectTenantResponseStatus, 200,
    'Settings switcher must exchange the current session for a server-issued second-tenant session');
  assert.ok(selectTenantResponseBodyPromise,
    'Settings switcher must issue the canonical /auth/select-tenant request');
  const selectTenantBody = await selectTenantResponseBodyPromise;
  assert.ok(!selectTenantBody.__readError,
    'the canonical tenant-selection response body must be captured before reload: ' + (selectTenantBody.__readError || ''));
  assert.ok(selectTenantBody.session?.token && selectTenantBody.session?.expiresAt,
    'tenant selection must return a token and expiry for the second tenant');
  const secondActiveConfig = await readPersistedBrowserConfig(page);
  const secondBootDiagnostics = await page.evaluate(() => {
    let localConfig = {};
    try { localConfig = JSON.parse(localStorage.getItem('ledger_config') || '{}'); } catch {}
    const modal = document.getElementById('onboardingModal');
    return {
      onboardingDisplay: modal ? getComputedStyle(modal).display : 'missing',
      onboardingStyle: modal?.getAttribute('style') || '',
      localChatId: localConfig.chatId || '',
      localSessionExpiresAt: localConfig.sessionExpiresAt || '',
      localSessionTokenPresent: Boolean(localConfig.sessionToken),
    };
  });
  assert.equal(String(secondActiveConfig.chatId), secondChatId,
    'Settings switcher must persist the second canonical tenant before returning to the workspace');
  assert.equal(secondActiveConfig.sessionToken, selectTenantBody.session.token,
    'the persisted second-tenant session must be the exact server-issued token');
  assert.equal(secondActiveConfig.sessionExpiresAt, selectTenantBody.session.expiresAt,
    'the persisted second-tenant session expiry must match the server response');
  assert.equal(secondBootDiagnostics.onboardingDisplay, 'none',
    'a valid server-issued tenant session must keep the onboarding wizard closed after reload: '
      + JSON.stringify(secondBootDiagnostics));
  assert.equal(String(secondActiveConfig.chatId), secondChatId,
    'Settings switcher must activate the second canonical tenant');
  assert.equal(secondActiveConfig.businessTemplate, 'repair',
    'switching must hydrate the second tenant template rather than retain the first tenant template');
  await page.evaluate(() => window.switchTab('order'));
  assert.equal(await page.locator('#productList').getByText('Browser First Product', { exact: true }).count(), 0,
    'the first business product must not leak into the second business UI');
  const secondCatalogResponse = await fetch(baseUrl + '/catalog/' + encodeURIComponent(secondChatId), {
    headers: { Authorization: 'Bearer ' + secondActiveConfig.sessionToken },
  });
  assert.equal(secondCatalogResponse.status, 200, 'second tenant canonical catalog must be readable');
  const secondCatalog = await secondCatalogResponse.json();
  assert.equal((secondCatalog.products || []).some(product => product.name === 'Browser First Product'), false,
    'the first business product must not exist in the second tenant canonical catalog');

  // Switch back using the same real Settings UI and confirm first-tenant data
  // and template are restored from their own canonical scope.
  await page.locator('#gearSettingsBtn').click();
  await page.locator('#tenantSwitcherControls').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#tenantSwitcherSelect').selectOption(firstChatId);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
    page.locator('#tenantSwitcherControls button').click(),
  ]);
  await page.locator('#onboardingModal').waitFor({ state: 'hidden', timeout: 15000 });
  const firstRestoredConfig = await readPersistedBrowserConfig(page);
  assert.equal(String(firstRestoredConfig.chatId), firstChatId,
    'switching back must restore the first canonical tenant');
  assert.equal(firstRestoredConfig.businessTemplate, 'retail-shop',
    'switching back must restore the first tenant template');
  await page.evaluate(() => window.switchTab('order'));
  await page.locator('#productList').getByText('Browser First Product', { exact: true })
    .waitFor({ state: 'visible', timeout: 15000 });

  assert.deepEqual(pageErrors, [], 'onboarding, reload, and multi-tenant switching must not throw uncaught errors');
  console.log('First Experience browser onboarding → first catalog item → reload: PASS');
  console.log('Real Settings tenant switching, session exchange, and tenant isolation: PASS');
  console.log('Canonical template and catalog state restored independently per tenant: PASS');
} catch (error) {
  console.error(error);
  if (output) console.error('Backend output:\n' + output);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  await rm(tempDir, { recursive: true, force: true });
}
