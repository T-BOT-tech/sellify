// Rebased and revalidated against the current mainline integration.
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
  return page.evaluate(async () => new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error('Timed out reading the application IndexedDB tenant config')), 5000);
    try {
      // Do not create the database/store here and do not fall back to localStorage:
      // this regression specifically proves the app committed the canonical config
      // to its IndexedDB primary store before navigating/reloading.
      const request = indexedDB.open('ledger_db');
      request.onupgradeneeded = () => {
        try { request.transaction.abort(); } catch {}
        finish(new Error('The application did not initialize its IndexedDB database before the persistence assertion'));
      };
      request.onerror = () => finish(request.error || new Error('Could not open the application IndexedDB database'));
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('kv')) {
          db.close();
          finish(new Error('The application IndexedDB key/value store is missing'));
          return;
        }
        const tx = db.transaction('kv', 'readonly');
        const get = tx.objectStore('kv').get('ledger_config');
        get.onsuccess = () => {
          const value = get.result;
          db.close();
          if (!value || typeof value !== 'object') {
            finish(new Error('The application tenant config is absent from IndexedDB'));
            return;
          }
          finish(null, value);
        };
        get.onerror = () => {
          const error = get.error || new Error('Could not read tenant config from IndexedDB');
          db.close();
          finish(error);
        };
      };
    } catch (error) {
      finish(error);
    }
  }));
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

  // Complete a real Retail browser checkout before exercising multi-tenant
  // switching. The order is first saved locally, then synchronized through
  // the visible Queue action; canonical backend state remains authoritative.
  const retailProductRow = page.locator('#prodRow-' + item.id);
  await retailProductRow.waitFor({ state: 'visible', timeout: 10000 });
  await retailProductRow.locator('button[onclick^="changeQty"]').nth(1).click();
  await page.locator('#custName').fill('Synthetic Retail Buyer');
  await page.locator('#orderSummary').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#saveOrderBtn').click();
  await page.locator('#paymentProofModal').waitFor({ state: 'visible', timeout: 5000 });
  const paymentOptions = await page.locator('#orderPayMethod option').evaluateAll(options =>
    options.map(option => ({ value: option.value, label: option.textContent.trim() })),
  );
  assert.ok(paymentOptions.length > 0 && paymentOptions[0].value,
    'Retail checkout must offer at least one enabled payment method');
  assert.match(await page.locator('#checkoutPaymentStateHint').textContent(),
    /does not confirm that a payment was received/i,
    'checkout must clearly distinguish saving an order from confirming payment');
  await page.locator('#checkoutSaveOrderButton').click();
  await page.locator('#paymentProofModal').waitFor({ state: 'hidden', timeout: 5000 });
  await page.locator('#tab-queue').waitFor({ state: 'visible', timeout: 5000 });
  const retailTicket = page.locator('#queueList').locator('.ticket').filter({ hasText: 'Browser First Product' }).first();
  await retailTicket.waitFor({ state: 'visible', timeout: 10000 });
  const localRetailOrderId = (await retailTicket.locator('.ticket-id').textContent()).trim();
  assert.ok(localRetailOrderId, 'saved Retail order must have a local identity');
  await retailTicket.getByText('Payment tracking: Not yet linked to Payment Core', { exact: true }).waitFor({
    state: 'visible', timeout: 5000,
  });
  assert.equal(await retailTicket.locator('.badge.queued').count(), 1,
    'the browser checkout must create a queued local order, not claim server confirmation');

  // Use the actual Queue Sync now button, not a test-only backend write.
  // Payment state is returned by the sync acknowledgement; the canonical
  // order feed intentionally does not duplicate Payment Core state.
  const syncResponsePromise = page.waitForResponse(response => {
    const url = new URL(response.url());
    return response.request().method() === 'POST'
      && url.pathname === `/sync/${encodeURIComponent(config.chatId)}`;
  }, { timeout: 10000 });
  await page.locator('#syncNowBtn').click();
  const syncResponse = await syncResponsePromise;
  assert.equal(syncResponse.status(), 200, 'Queue Sync now must receive a successful canonical sync acknowledgement');
  const syncBody = await syncResponse.json();
  const syncAcknowledgement = (syncBody.results || []).find(result => String(result.local_id) === localRetailOrderId);
  assert.equal(syncAcknowledgement?.status, 'synced', 'the canonical sync acknowledgement must accept the Retail order');
  assert.equal(String(syncAcknowledgement?.payment_state || '').toUpperCase(), 'UNPAID',
    'sync acknowledgement must keep the canonical payment state unpaid until Payment Core confirms receipt');
  let canonicalRetailOrder;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(baseUrl + '/orders/' + encodeURIComponent(config.chatId) + '?limit=200', {
      headers: { Authorization: 'Bearer ' + restoredConfig.sessionToken },
    });
    assert.equal(response.status, 200, 'authenticated canonical order feed must remain accessible');
    const body = await response.json();
    canonicalRetailOrder = (body.orders || []).find(order => String(order.id) === localRetailOrderId);
    if (canonicalRetailOrder?.server_order_id) break;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert.ok(canonicalRetailOrder?.server_order_id,
    'the real browser Sync now action must create and acknowledge a canonical backend order');
  assert.equal(canonicalRetailOrder.items?.length, 1);
  assert.equal(canonicalRetailOrder.items[0].name, 'Browser First Product');
  assert.equal(Number(canonicalRetailOrder.items[0].qty), 1);
  assert.equal(Number(canonicalRetailOrder.items[0].price), 2500);
  assert.equal(Number(canonicalRetailOrder.total), 2500);
  assert.equal(canonicalRetailOrder.currency || 'ETB', 'ETB');
  const canonicalOrderCountBeforeReload = (await (await fetch(
    baseUrl + '/orders/' + encodeURIComponent(config.chatId) + '?limit=200',
    { headers: { Authorization: 'Bearer ' + restoredConfig.sessionToken } },
  )).json()).orders.filter(order => String(order.id) === localRetailOrderId).length;
  assert.equal(canonicalOrderCountBeforeReload, 1,
    'the canonical order feed must contain exactly one Retail order');

  // The UI has completed its Retail transaction path; switch back to the
  // catalog workspace before the existing reload/multi-tenant assertions.
  await page.evaluate(() => window.switchTab('order'));
  await page.locator('#productList').getByText('Browser First Product', { exact: true }).waitFor({
    state: 'visible', timeout: 10000,
  });

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

  // Create a separate synthetic Restaurant business and exercise its real
  // Tables → menu order → Kitchen workflow without changing the Retail tenant.
  const restaurantCreateResponse = await fetch(baseUrl + '/auth/tenants', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + firstRestoredConfig.sessionToken,
    },
    body: JSON.stringify({
      sellerName: 'Browser Restaurant Regression',
      businessType: 'restaurant',
      country: 'ET',
      timezone: 'Africa/Addis_Ababa',
      deviceName: 'Restaurant browser regression',
    }),
  });
  assert.equal(restaurantCreateResponse.status, 201,
    'the authenticated owner must be able to create an isolated Restaurant test tenant');
  const restaurantCreateBody = await restaurantCreateResponse.json();
  const restaurantChatId = String(restaurantCreateBody.membership?.chatId || restaurantCreateBody.session?.chatId || '');
  const restaurantSessionToken = String(restaurantCreateBody.session?.token || '');
  assert.ok(restaurantChatId && restaurantChatId !== firstChatId,
    'Restaurant regression must use a distinct canonical tenant');
  assert.ok(restaurantSessionToken, 'Restaurant tenant creation must issue its own session');
  const restaurantTemplateResponse = await fetch(
    baseUrl + '/tenants/' + encodeURIComponent(restaurantChatId) + '/business-template',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + restaurantSessionToken,
      },
      body: JSON.stringify({ templateKey: 'restaurant' }),
    },
  );
  assert.equal(restaurantTemplateResponse.status, 200,
    'Restaurant template must be persisted for the synthetic Restaurant tenant');

  await page.locator('#gearSettingsBtn').click();
  await page.locator('#tenantSwitcherControls').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#tenantSwitcherSelect').selectOption(restaurantChatId);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
    page.locator('#tenantSwitcherControls button').click(),
  ]);
  const restaurantActiveConfig = await readPersistedBrowserConfig(page);
  assert.equal(String(restaurantActiveConfig.chatId), restaurantChatId,
    'Restaurant workflow must run under its own server-issued tenant session');
  await page.locator('#gearSettingsBtn').click();
  await page.locator('#settingsModal.open').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#setBusinessModel').selectOption('restaurant');
  await page.locator('#settingsModal button.btn-primary').filter({ hasText: 'Save' }).last().click();
  const restaurantNavigation = await page.evaluate(() => ({
    tables: document.getElementById('navTables')?.style.display,
    kitchen: document.getElementById('navKitchen')?.style.display,
    tablePicker: getComputedStyle(document.getElementById('orderTableSelect')).display,
    coursePicker: getComputedStyle(document.getElementById('orderCourseSelect')).display,
  }));
  assert.notEqual(restaurantNavigation.tables, 'none',
    'Restaurant mode must enable the real Tables navigation item');
  assert.notEqual(restaurantNavigation.kitchen, 'none',
    'Restaurant mode must enable the real Kitchen navigation item');
  assert.equal(restaurantNavigation.tablePicker, 'block',
    'Restaurant mode must expose the table picker in the real order form');
  assert.equal(restaurantNavigation.coursePicker, 'block',
    'Restaurant mode must expose the course picker in the real order form');

  // Add a real menu product through the catalog UI.
  await page.evaluate(() => window.switchTab('catalog'));
  await page.locator('#newProdName').fill('Browser Restaurant Meal');
  await page.locator('#newProdPrice').fill('18');
  await page.locator('#addProdBtn').click();
  await page.locator('#catalogList').getByText('Browser Restaurant Meal', { exact: true })
    .waitFor({ state: 'visible', timeout: 10000 });
  // Catalog edits are local-first; use the real Queue sync boundary before
  // expecting the authenticated canonical catalog endpoint to contain it.
  await page.evaluate(() => window.switchTab('queue'));
  await page.locator('#syncNowBtn').click();
  const syncedRestaurantMenuItem = await waitForCatalogItem(
    baseUrl, restaurantChatId, restaurantActiveConfig.sessionToken, 'Browser Restaurant Meal',
  );
  assert.ok(syncedRestaurantMenuItem.id, 'synced Restaurant menu item must have a canonical catalog identity');
  const restaurantCatalogResponse = await fetch(
    baseUrl + '/catalog/' + encodeURIComponent(restaurantChatId),
    { headers: { Authorization: 'Bearer ' + restaurantActiveConfig.sessionToken } },
  );
  assert.equal(restaurantCatalogResponse.status, 200,
    'Restaurant menu item must be readable from its canonical tenant catalog');
  const restaurantCatalog = await restaurantCatalogResponse.json();
  const restaurantMenuItem = (restaurantCatalog.products || []).find(product => product.name === 'Browser Restaurant Meal');
  assert.ok(restaurantMenuItem, 'Restaurant menu item must be persisted canonically');

  // Create a table using the actual Tables tab and modal controls.
  await page.evaluate(() => window.switchTab('tables'));
  await page.locator('#tablesList').getByText('No tables yet').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#tab-tables button').filter({ hasText: 'Add table' }).click();
  await page.locator('#tableEditModal').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#tableEditNumber').fill('7');
  await page.locator('#tableEditCapacity').fill('4');
  await page.locator('#tableEditNotes').fill('Synthetic browser test table');
  await page.locator('#tableEditModal button').filter({ hasText: 'Save' }).click();
  await page.locator('#tablesList .table-card').filter({ hasText: 'Table 7' }).waitFor({
    state: 'visible', timeout: 10000,
  });

  // Take the order through the actual Order UI, assigning table and course.
  await page.evaluate(() => window.switchTab('order'));
  await page.locator('#orderTableSelect').waitFor({ state: 'visible', timeout: 10000 });
  const tableOption = await page.locator('#orderTableSelect option').filter({ hasText: 'Table 7' }).getAttribute('value');
  assert.ok(tableOption, 'Restaurant order form must offer the newly created table');
  await page.locator('#orderTableSelect').selectOption(tableOption);
  await page.locator('#orderCourseSelect').selectOption({ index: 1 });
  const restaurantProductRow = page.locator('#productList .product-row').filter({ hasText: 'Browser Restaurant Meal' });
  await restaurantProductRow.locator('button[onclick^="changeQty"]').last().click();
  await page.locator('#orderSummary').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#saveOrderBtn').click();
  await page.locator('#paymentProofModal').waitFor({ state: 'visible', timeout: 5000 });
  assert.ok(await page.locator('#orderPayMethod option:enabled').count() > 0,
    'Restaurant checkout must use an enabled configured payment method');
  await page.locator('#checkoutSaveOrderButton').click();
  await page.locator('#paymentProofModal').waitFor({ state: 'hidden', timeout: 10000 });

  // Kitchen is a Restaurant view of the existing Core order, not a second
  // order authority. Verify its table context and transition through the UI.
  await page.evaluate(() => window.switchTab('kitchen'));
  const kitchenTicket = page.locator('#kitchenList .kitchen-order').filter({ hasText: 'Browser Restaurant Meal' });
  await kitchenTicket.waitFor({ state: 'visible', timeout: 10000 });
  await assert.doesNotReject(async () => {
    assert.match(await kitchenTicket.innerText(), /Table 7/,
      'Kitchen ticket must retain the table assigned at checkout');
  });
  await kitchenTicket.getByRole('button', { name: /Start prep/ }).click();
  await kitchenTicket.waitFor({ state: 'visible', timeout: 5000 });
  await assert.doesNotReject(async () => {
    assert.match(await kitchenTicket.getAttribute('class'), /preparing/,
      'Kitchen ticket must transition from pending to preparing through the UI');
  });

  // Synchronize the same order via the Queue UI and verify canonical Commerce
  // order identity and item data; kitchen state remains a vertical projection.
  await page.evaluate(() => window.switchTab('queue'));
  const restaurantSyncResponsePromise = page.waitForResponse(response => {
    const url = new URL(response.url());
    return response.request().method() === 'POST'
      && url.pathname === `/sync/${encodeURIComponent(restaurantChatId)}`;
  }, { timeout: 10000 });
  await page.locator('#syncNowBtn').click();
  const restaurantSyncResponse = await restaurantSyncResponsePromise;
  assert.equal(restaurantSyncResponse.status(), 200,
    'Restaurant Queue Sync now must receive a successful canonical sync acknowledgement');
  const restaurantSyncBody = await restaurantSyncResponse.json();
  const restaurantAck = (restaurantSyncBody.results || []).find(result =>
    String(result.local_id || '') && result.status === 'synced');
  assert.ok(restaurantAck, 'Restaurant order must be accepted by canonical sync');
  const restaurantOrdersResponse = await fetch(
    baseUrl + '/orders/' + encodeURIComponent(restaurantChatId) + '?limit=200',
    { headers: { Authorization: 'Bearer ' + restaurantActiveConfig.sessionToken } },
  );
  assert.equal(restaurantOrdersResponse.status, 200,
    'Restaurant canonical Commerce order feed must be readable');
  const restaurantOrdersBody = await restaurantOrdersResponse.json();
  const canonicalRestaurantOrder = (restaurantOrdersBody.orders || []).find(order =>
    (order.items || []).some(item => item.name === 'Browser Restaurant Meal'));
  assert.ok(canonicalRestaurantOrder,
    'Restaurant browser checkout must create the canonical Commerce order');
  assert.equal((canonicalRestaurantOrder.items || []).find(item => item.name === 'Browser Restaurant Meal')?.qty, 1,
    'canonical Restaurant order must preserve the menu item quantity');
  console.log('Restaurant browser Tables → menu order → Kitchen preparation → canonical Commerce order: PASS');

  // Exercise the implemented Wholesale B2B workflow in its own synthetic tenant.
  // The customer and catalog product are created through the real UI; quotes and
  // purchase orders are issued/transited through their canonical backend APIs by
  // the UI modules, never by test-side database writes.
  const wholesaleCreateResponse = await fetch(baseUrl + '/auth/tenants', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + firstRestoredConfig.sessionToken,
    },
    body: JSON.stringify({
      sellerName: 'Browser Wholesale Regression',
      businessType: 'wholesale',
      country: 'ET',
      timezone: 'Africa/Addis_Ababa',
      deviceName: 'Wholesale browser regression',
    }),
  });
  assert.equal(wholesaleCreateResponse.status, 201,
    'the authenticated owner must be able to create an isolated Wholesale test tenant');
  const wholesaleCreateBody = await wholesaleCreateResponse.json();
  const wholesaleChatId = String(wholesaleCreateBody.membership?.chatId || wholesaleCreateBody.session?.chatId || '');
  const wholesaleSessionToken = String(wholesaleCreateBody.session?.token || '');
  assert.ok(wholesaleChatId && wholesaleChatId !== firstChatId,
    'Wholesale regression must use a distinct canonical tenant');
  assert.ok(wholesaleSessionToken, 'Wholesale tenant creation must issue its own session');
  const wholesaleTemplateResponse = await fetch(
    baseUrl + '/tenants/' + encodeURIComponent(wholesaleChatId) + '/business-template',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + wholesaleSessionToken,
      },
      body: JSON.stringify({ templateKey: 'wholesale' }),
    },
  );
  assert.equal(wholesaleTemplateResponse.status, 200,
    'Wholesale template must persist on its canonical tenant');

  // Switch into Wholesale through Settings so browser storage/session state
  // follows the same path as a merchant switching businesses.
  await page.locator('#gearSettingsBtn').click();
  await page.locator('#tenantSwitcherControls').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#tenantSwitcherSelect').selectOption(wholesaleChatId);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
    page.locator('#tenantSwitcherControls button').click(),
  ]);
  const wholesaleActiveConfig = await readPersistedBrowserConfig(page);
  assert.equal(String(wholesaleActiveConfig.chatId), wholesaleChatId,
    'Wholesale workflow must run under its own server-issued tenant session');
  assert.equal(wholesaleActiveConfig.businessTemplate, 'wholesale',
    'Wholesale tenant switching must hydrate the Wholesale template rather than retain another tenant template');

  // Wholesale is a separate workspace capability toggle, not inferred from
  // the onboarding template. Enable it through the real Settings UI.
  await page.locator('#gearSettingsBtn').click();
  await page.locator('#settingsModal.open').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#setWholesaleEnabled').check();
  await page.locator('#settingsModal button.btn-primary').filter({ hasText: 'Save' }).last().click();
  await page.waitForFunction(() => {
    const button = document.getElementById('navAccounts');
    return Boolean(button && button.style.display !== 'none');
  }, null, { timeout: 10000 });
  assert.notEqual(await page.locator('#navAccounts').evaluate(element => element.style.display), 'none',
    'enabling Wholesale in Settings must expose the Accounts workspace');

  // Create a business-type customer from Customers UI. The quote selector
  // intentionally excludes retail customers, so assert canonical type too.
  await page.evaluate(() => window.switchTab('customers'));
  await page.locator('#tab-customers button').filter({ hasText: 'Add customer' }).click();
  await page.locator('#customerModal').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('#customerNameInput').fill('Synthetic Wholesale Buyer');
  await page.locator('#customerPhoneInput').fill('+251900000777');
  await page.locator('#customerEmailInput').fill('wholesale-buyer@example.invalid');
  await page.locator('#customerTypeInput').selectOption('business');
  await page.locator('#customerNotesInput').fill('Synthetic browser regression customer');
  await page.locator('#customerModal button').filter({ hasText: 'Save customer' }).click();
  await page.locator('#customerModal').waitFor({ state: 'hidden', timeout: 10000 });
  let wholesaleCustomer;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(
      baseUrl + '/tenants/' + encodeURIComponent(wholesaleChatId) + '/customers?status=active&limit=200',
      { headers: { Authorization: 'Bearer ' + wholesaleActiveConfig.sessionToken } },
    );
    assert.equal(response.status, 200, 'canonical Wholesale customer list must be readable');
    const body = await response.json();
    wholesaleCustomer = (body.customers || []).find(customer => customer.name === 'Synthetic Wholesale Buyer');
    if (wholesaleCustomer) break;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert.ok(wholesaleCustomer?.id, 'Customers UI must sync the business customer to the canonical backend');
  assert.equal(String(wholesaleCustomer.customerType || '').toLowerCase(), 'business',
    'the canonical customer record must retain business classification');

  // Create and sync a physical catalog product through the UI. Quote pricing
  // and totals are calculated by the canonical B2B quote service.
  await page.evaluate(() => window.switchTab('catalog'));
  await page.locator('#newProdName').fill('Wholesale Regression Carton');
  await page.locator('#newProdPrice').fill('125');
  await page.locator('#newProdType').selectOption('product');
  await page.locator('#addProdBtn').click();
  await page.locator('#catalogList').getByText('Wholesale Regression Carton', { exact: true })
    .waitFor({ state: 'visible', timeout: 10000 });
  await page.evaluate(() => window.switchTab('queue'));
  await page.locator('#syncNowBtn').click();
  const wholesaleProduct = await waitForCatalogItem(
    baseUrl, wholesaleChatId, wholesaleActiveConfig.sessionToken, 'Wholesale Regression Carton',
  );
  assert.ok(wholesaleProduct.id, 'Wholesale catalog UI must create a canonical product identity');

  // Create a quote, send it, and accept it through the visible B2B action
  // buttons. Re-read each resulting state from the canonical quote endpoint.
  await page.evaluate(() => window.switchTab('accounts'));
  await page.locator('#b2bQuoteRefresh').click();
  await page.locator('#b2bQuoteCustomer option[value="' + wholesaleCustomer.id + '"]').waitFor({
    state: 'attached', timeout: 10000,
  });
  await page.locator('#b2bQuoteProduct option[value="' + wholesaleProduct.id + '"]').waitFor({
    state: 'attached', timeout: 10000,
  });
  await page.locator('#b2bQuoteCustomer').selectOption(wholesaleCustomer.id);
  await page.locator('#b2bQuoteProduct').selectOption(wholesaleProduct.id);
  await page.locator('#b2bQuoteQuantity').fill('4');
  await page.locator('#b2bQuoteNotes').fill('Synthetic Wholesale browser quote');
  await page.locator('#b2bQuoteTerms').fill('ETB; synthetic test only');
  await page.locator('#b2bQuoteCreate').click();
  await page.locator('#b2bQuotesList').getByText('DRAFT', { exact: false }).waitFor({
    state: 'visible', timeout: 10000,
  });
  const wholesaleQuotesUrl = baseUrl + '/tenants/' + encodeURIComponent(wholesaleChatId) + '/b2b/quotes?limit=100';
  const readWholesaleQuotes = async () => {
    const response = await fetch(wholesaleQuotesUrl, {
      headers: { Authorization: 'Bearer ' + wholesaleActiveConfig.sessionToken },
    });
    assert.equal(response.status, 200, 'canonical Wholesale quote list must be readable');
    return (await response.json()).quotes || [];
  };
  let wholesaleQuote = (await readWholesaleQuotes()).find(quote =>
    quote.customerId === wholesaleCustomer.id && quote.status === 'DRAFT');
  assert.ok(wholesaleQuote?.id, 'quote creation UI must create a canonical DRAFT quote');
  assert.equal(Number(wholesaleQuote.items?.[0]?.quantity), 4,
    'canonical quote must preserve the requested product quantity');
  assert.equal(wholesaleQuote.items?.[0]?.productId, wholesaleProduct.id,
    'canonical quote must reference the selected catalog product');
  await page.locator('#b2bQuotesList [data-quote-action="SENT"]').click();
  await page.locator('#b2bQuotesList [data-quote-action="ACCEPTED"]').waitFor({
    state: 'visible', timeout: 10000,
  });
  await page.locator('#b2bQuotesList [data-quote-action="ACCEPTED"]').click();
  await page.locator('#b2bQuotesList').getByText('ACCEPTED', { exact: false }).waitFor({
    state: 'visible', timeout: 10000,
  });
  wholesaleQuote = (await readWholesaleQuotes()).find(quote => quote.id === wholesaleQuote.id);
  assert.equal(wholesaleQuote?.status, 'ACCEPTED',
    'the visible quote action must transition the canonical quote to ACCEPTED');

  // Only accepted quotes may populate the PO selector. Create a PO from that
  // quote, verify the backend-owned amount/currency snapshot, then submit it.
  await page.locator('#b2bPoRefresh').click();
  await page.locator('#b2bPoQuote option[value="' + wholesaleQuote.id + '"]').waitFor({
    state: 'attached', timeout: 10000,
  });
  await page.locator('#b2bPoQuote').selectOption(wholesaleQuote.id);
  await page.locator('#b2bPoBuyerReference').fill('SYNTH-WHOLESALE-PO-001');
  await page.locator('#b2bPoNotes').fill('Synthetic purchase order browser test');
  await page.locator('#b2bPoCreate').click();
  await page.locator('#b2bPurchaseOrdersList').getByText('DRAFT', { exact: false }).waitFor({
    state: 'visible', timeout: 10000,
  });
  const wholesalePosUrl = baseUrl + '/tenants/' + encodeURIComponent(wholesaleChatId) + '/b2b/purchase-orders?limit=100';
  const readWholesalePos = async () => {
    const response = await fetch(wholesalePosUrl, {
      headers: { Authorization: 'Bearer ' + wholesaleActiveConfig.sessionToken },
    });
    assert.equal(response.status, 200, 'canonical Wholesale purchase-order list must be readable');
    return (await response.json()).purchaseOrders || [];
  };
  let wholesalePo = (await readWholesalePos()).find(po => po.quoteId === wholesaleQuote.id);
  assert.ok(wholesalePo?.id, 'PO creation UI must create a canonical purchase order');
  assert.equal(wholesalePo.status, 'DRAFT', 'newly created purchase order must start in DRAFT');
  assert.equal(wholesalePo.buyerReference, 'SYNTH-WHOLESALE-PO-001');
  assert.equal(Number(wholesalePo.totalMinor), Number(wholesaleQuote.totalMinor),
    'PO amount must be snapshotted from the canonical accepted quote, not recalculated in the UI');
  assert.equal(wholesalePo.currency, wholesaleQuote.currency,
    'PO currency must be inherited from the accepted quote');
  assert.equal(wholesalePo.quoteId, wholesaleQuote.id,
    'canonical PO must retain the accepted quote linkage');
  await page.locator('#b2bPurchaseOrdersList [data-po-action="submit"]').click();
  await page.locator('#b2bPurchaseOrdersList').getByText('SUBMITTED', { exact: false }).waitFor({
    state: 'visible', timeout: 10000,
  });
  wholesalePo = (await readWholesalePos()).find(po => po.id === wholesalePo.id);
  assert.equal(wholesalePo?.status, 'SUBMITTED',
    'the visible Submit action must transition the canonical PO from DRAFT to SUBMITTED');
  console.log('Wholesale browser business customer → quote → accepted quote → PO draft → submitted: PASS');

  if (process.env.PREVIEW_SCREENSHOT_PATH) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: process.env.PREVIEW_SCREENSHOT_PATH, fullPage: true });
    console.log('Mobile preview screenshot: PASS (390 × 844)');
  }

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
