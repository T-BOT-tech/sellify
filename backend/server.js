// server.js
//
// Sellify tenant backend. Runtime persistence is SQLite through Node 24's
// built-in node:sqlite module, so the service still has no npm runtime
// dependencies and remains a single deployable process.
//
// Endpoints implement exactly what the existing PWA client already
// calls (see src/sync/orders.js, src/sync/catalog.js in the app repo):
//
//   POST /sync/:chatId       { orders: [...] }   -> { results, branding }
//   GET  /sync/:chatId       (owner key required) -> { new_orders: [...] } — Phase 2
//     addition: hands over any order created server-side (marketplace
//     sub-orders) that this device hasn't received yet. See pullNewOrders.
//   GET  /catalog/:chatId                        -> { products, branding, seller_name }
//   POST /catalog/:chatId    { products: [...] } -> { products, branding }
//
// Plus a couple of small admin endpoints this backend needs to be
// useful on its own (not called by the current client, but needed for
// onboarding/branding to be settable at all):
//
//   GET   /tenants                 -> list of tenants (future market_admin use)
//   GET   /tenants/:chatId/customers?q=... -> authenticated customer list
//   POST  /tenants/:chatId/customers -> create/upsert canonical customer
//   GET/PATCH /tenants/:chatId/customers/:customerId -> customer read/update
//   PATCH /tenants/:chatId         { sellerName?, branding?, vendorCode? } -> updated tenant
//   GET   /tenants/:chatId/audit   -> owner-authenticated audit events
//   POST  /admin/backup            -> rolling SQLite snapshot (backup token)
//
// Phase 2 additions — implements the marketplace boundary the client was
// already calling with nothing behind it (see lib/store.js's "marketplace
// (Phase 2)" section for the real logic):
//
//   GET  /api/marketplace/search               -> { results: [...] }
//   POST /api/marketplace/checkout { buyer_id?, customer_name?, customer_phone?, items: [{seller_id, item_id, qty}] }
//                                               -> { marketplace_order_id, sub_orders: [...] }
//
// Auth model:
//   - POST /auth/telegram verifies Telegram Mini App initData and resolves
//     the authenticated user to server-side tenant memberships.
//   - POST /auth/tenants creates a tenant only for an authenticated user or
//     a short-lived one-time onboarding challenge. The owner role is always
//     assigned server-side.
//   - POST /auth/select-tenant exchanges a membership selection for a
//     tenant-scoped device session.
//   - POST /sync/:chatId and POST /catalog/:chatId require that session.
//     There is no anonymous tenant provisioning path through sync/catalog.
//   - GET /catalog/:chatId remains PUBLIC because it is the buyer/viewer
//     storefront read path.
//   - PATCH /tenants/:chatId and seller order pull/audit routes require the
//     tenant-scoped session and an owner/manager role where appropriate.
//   - Legacy tenant apiKey fields remain in SQLite only for one-time migration.
//     They are not accepted by seller routes. POST /auth/migrate-legacy exchanges
//     a legacy key plus fresh Telegram identity for a tenant membership/session.
//   - POST /auth/pairing/POST /auth/pair add a *device* to a tenant (owner
//     approves, a fresh anonymous user is minted for that device).
//   - POST /auth/invites/POST /auth/accept-invite add a *person* to a
//     tenant instead: an owner/manager mints a role-scoped invite token,
//     and the recipient redeems it with their own Telegram identity. This
//     is the staff-onboarding path — no device needs to be physically
//     present for the owner to approve.

// Phase 1 (deployability) additions on top of the above, all env-driven
// so the same code runs unmodified across dev/staging/prod:
//   - Serves the PWA's static files itself (see serveStatic below), so
//     `node server.js` is the entire deployable unit — no separate
//     static host needed, and no more "ZIP alone only serves the
//     frontend" gap.
//   - /config.js is generated per-request instead of being a checked-in
//     static file with an empty sync URL — see handleConfigJs.
//   - CORS_ALLOWED_ORIGINS replaces the previous wildcard '*' with an
//     explicit allowlist (comma-separated). Left unset, it still falls
//     back to '*' for local/dev convenience, with a startup warning —
//     see corsHeadersFor.
//   - A small in-memory per-IP rate limiter (RATE_LIMIT_* env vars).
//   - Structured error responses that don't leak internal error text
//     for unexpected 500s (deliberately-thrown 4xx messages are still
//     shown — those are our own validation text, not internals).

import { createServer } from 'node:http';
import crypto from 'node:crypto';
import { resolveTelegramBotCredential } from '../app/src/platform/telegram-bot-credential-contract.js';
import { verifyTelegramBuyerInitDataWithSecret } from '../app/src/platform/telegram-buyer-identity-contract.js';
import { normalizeTelegramCheckoutContext, buildTelegramPaymentBoundary } from '../app/src/platform/telegram-checkout-contract.js';
import { buildSellerStorefrontChannelSummary } from '../app/src/platform/seller-channel-storefront-contract.js';
import { buildCrossChannelConsistencyContract, evaluateCrossChannelConsistency } from '../app/src/platform/cross-channel-consistency-contract.js';
import { getDiscoveryProvider, discoverUnified } from './lib/discovery/index.js';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getOrCreateTenant,
  getOrders,
  getTenantByApiKey,
  getTenant,
  getOrganizationLocation,
  updateTenant,
  listTenants,
  getCatalog,
  saveCatalog,
  saveQueuedOrders,
  processSyncEvent,
  pullNewOrders,
  searchMarketplaceListings,
  createMarketplaceOrder,
  listAuditEvents,
  createDatabaseBackup,
  getOrCreateUserByTelegram, listUserMemberships, listTenantMemberships, ensureMembership, createTenantForUser,
  getTelegramStorefrontConfig, upsertTelegramStorefrontConfig, verifyTelegramStorefront,
  createSession, authenticateSessionToken, revokeSession, createAuthChallenge, consumeAuthChallenge,
  listOrganizationLocations, createOrganizationLocation, updateOrganizationLocation,
  listCustomers, getCustomer, upsertCustomer, updateCustomer,
  listInventoryMovements, getInventoryBalances, appendInventoryMovement,
  createPairingChallenge, consumePairingChallenge,
  createInvite, listInvites, revokeInvite, consumeInvite, changeMembershipRole, assignMembershipContextualRole, revokeMembershipContextualRole,
  listDevices, revokeDevice, updateMarketplaceOrderStatus, getMarketplaceOrderTracking, listTelegramBuyerOrders, getTelegramBuyerFulfillmentExperience, getOrderFulfillment, transitionOrderFulfillment,
  recordAuditEvent, getAuditRetentionPolicy, setAuditRetentionPolicy,
  createComplianceRequest, getComplianceRequest, listComplianceRequests, resolveComplianceRequest, buildComplianceExport,
  listPaymentAccounts, createPaymentAccount, createPayment, getPayment, getPaymentIntent, listPayments, listPaymentLedger, reconcilePayment, recordPaymentReconciliation, listPaymentReconciliations, insertPaymentEvidence, insertProviderNotificationEvidence, getPaymentAccountForProviderNotification, resolvePaymentIntentForProviderEvidence, createPaymentConfirmationAttempt, updatePaymentConfirmationAttempt, getPaymentConfirmationAttempt, getPaymentConfirmationAttemptByProviderTransaction, insertPaymentVerification, insertPaymentDecision, commitPaymentDecision, listPaymentOutboundIntents, getPaymentOutboundIntent, createPaymentOutboundIntent, transitionPaymentOutboundIntent, createProcurementPaymentIntent, getProcurementSettlement, listProcurementSettlements, listProcurementSettlementAllocations, allocateConfirmedOutboundPaymentToProcurementSettlement,
  listCustomerPricing, getCustomerPricing, upsertCustomerPricing, updateCustomerPricing,
  listQuotes, getQuote, createQuote, transitionQuote,
  listPurchaseOrders, getPurchaseOrder, createPurchaseOrder, createPurchaseOrderFromProcurementAward, transitionPurchaseOrder,
  getProcurementReceipt, listProcurementReceipts, createProcurementReceipt,
  assignDeliveryCourier, getDeliveryAssignment, listDeliveryAssignments, assertCourierOwnsDelivery, transitionDeliveryAssignment,
  listCreditTerms, getCreditTerms, createCreditTerms, updateCreditTerms, transitionCreditTerms,
  listReceivables, getReceivable, createReceivable, transitionReceivable, allocatePaymentToReceivable, listReceivableLedger,
  listInvoices, getInvoice, createInvoice, transitionInvoice,
  listProcurementDemands, getProcurementDemand, createProcurementDemand, updateProcurementDemand, transitionProcurementDemand,
  listProcurementRfqs, createProcurementRfq, transitionProcurementRfq, createProcurementRfqResponse, transitionProcurementRfqResponse,
  listProcurementSupplierRelationships, createProcurementSupplierRelationship, transitionProcurementSupplierRelationship,
  listSupplierNetworkQualifications, getSupplierNetworkQualification, upsertSupplierNetworkQualification, transitionSupplierNetworkQualification,
  getProcurementComparison, listProcurementComparisons, createProcurementComparison,
  getProcurementAward, listProcurementAwards, createProcurementAward, transitionProcurementAward,
  getSupplierNetworkProfile, upsertSupplierNetworkProfile, transitionSupplierNetworkProfile,
  listSupplierNetworkCapabilities, getSupplierNetworkCapability, upsertSupplierNetworkCapability, transitionSupplierNetworkCapability,
  listSupplierNetworkCatalogListings, getSupplierNetworkCatalogListing, upsertSupplierNetworkCatalogListing, transitionSupplierNetworkCatalogListing,
  listSupplierNetworkServiceAreas, getSupplierNetworkServiceArea, upsertSupplierNetworkServiceArea, transitionSupplierNetworkServiceArea,
  listSupplierNetworkCapacities, getSupplierNetworkCapacity, upsertSupplierNetworkCapacity, transitionSupplierNetworkCapacity,
  listSupplierNetworkCommercialTerms, getSupplierNetworkCommercialTerms, upsertSupplierNetworkCommercialTerms, transitionSupplierNetworkCommercialTerms,
  listSupplierNetworkPerformance,
  listSupplierNetworkTrustEvidence, getSupplierNetworkTrustEvidence, refreshSupplierNetworkTrustEvidence, getSupplierNetworkPerformance, recalculateSupplierNetworkPerformance,
  discoverSupplierNetwork, getSupplierNetworkMarketplaceIntegration, setProcurementSupplierParticipation,
  getPackLifecycle, transitionPackLifecycle, getPaymentSettlementByIdempotencyKey, createPaymentSettlement, finalizePaymentSettlement, listPaymentSettlements, listPaymentRoutingPolicies, upsertPaymentRoutingPolicy, listPaymentOperationalActions, createPaymentOperationalAction, updatePaymentOperationalAction, recordPaymentProviderCapabilityEvidence, listPaymentProviderCapabilityEvidence, recordPaymentProductionCertification, listPaymentProductionCertifications,
} from './lib/store-sqlite.js';
import { AUTHZ, authorize, ROLES, getRolePermissions } from './lib/authorization.js';
import { assertTenantScope, assertLocationScope } from './lib/tenant-isolation.js';
import { getPaymentProvider, listPaymentProviders, registerPaymentProvider, requirePaymentProvider, certifyPaymentProviderCapabilities, certifyAllPaymentProviders } from './lib/payments/provider-registry.js';
import { PROVIDER_ADAPTERS } from './lib/payments/provider-adapters.js';
import { PaymentCore } from './lib/payments/payment-core.js';
import { derivePackLifecycleReadiness } from './lib/pack-lifecycle-readiness.js';
import { InvariantGate } from './lib/payments/invariant-gate.js';
import { PaymentDecisionEngine } from './lib/payments/decision-engine.js';
import { listPaymentChannels } from './lib/payments/channel-registry.js';
import { processEventIsolated } from './lib/event-failure-isolation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

for (const adapter of Object.values(PROVIDER_ADAPTERS)) {
  registerPaymentProvider(adapter, { replace: true });
}

const paymentCore = new PaymentCore({
  store: {
    getPayment,
    getPaymentIntent,
    listPaymentAccounts,
    getPaymentAccountForProviderNotification,
    resolvePaymentIntentForProviderEvidence,
    createPaymentConfirmationAttempt,
    updatePaymentConfirmationAttempt,
    getPaymentConfirmationAttempt,
    getPaymentConfirmationAttemptByProviderTransaction,
    insertPaymentEvidence,
    insertProviderNotificationEvidence,
    insertPaymentVerification,
    insertPaymentDecision,
    commitPaymentDecision,
    recordPaymentReconciliation,
    listPaymentReconciliations,
    getPaymentSettlementByIdempotencyKey,
    createPaymentSettlement,
    finalizePaymentSettlement,
    listPaymentSettlements,
    listPaymentRoutingPolicies,
    upsertPaymentRoutingPolicy,
    listPaymentOperationalActions,
    createPaymentOperationalAction,
    updatePaymentOperationalAction,
    recordPaymentProviderCapabilityEvidence,
    listPaymentProviderCapabilityEvidence,
    recordPaymentProductionCertification,
    listPaymentProductionCertifications,
  },
  providerRegistry: { getPaymentProvider, requirePaymentProvider, certifyPaymentProviderCapabilities, certifyAllPaymentProviders },
  invariantGate: new InvariantGate(),
  decisionEngine: new PaymentDecisionEngine(),
});

// ---------- env-driven config ----------

const PORT = Number(process.env.PORT) || 8787;
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

// Where the built/static PWA lives relative to this file. Defaults to
// ../app to match this project's layout (backend/ and app/ as siblings);
// override with STATIC_DIR for a different deployment layout.
const STATIC_DIR = process.env.STATIC_DIR
  ? path.resolve(process.env.STATIC_DIR)
  : path.join(__dirname, '..', 'app');
const SERVE_STATIC = existsSync(STATIC_DIR);

// Comma-separated allowlist, e.g. "https://myshop.example.com,https://admin.example.com".
// Unset -> '*' (fine for local dev; a real deployment should set this).
const CORS_ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
if (CORS_ALLOWED_ORIGINS.length === 0) {
  if (IS_PROD) {
    throw new Error('CORS_ALLOWED_ORIGINS must be configured in production; wildcard CORS is development-only');
  }
  console.warn(
    '[sellify-backend] CORS_ALLOWED_ORIGINS not set — allowing all origins (*). ' +
    'Set it to a comma-separated allowlist before deploying with real sellers.'
  );
}

// What /config.js tells the PWA to sync against, when the app and
// backend are NOT served from the same origin (e.g. app on a CDN,
// backend elsewhere). If unset, /config.js tells the client to use
// same-origin sync — correct by default whenever this server is also
// the one serving the static app (SERVE_STATIC === true).
const PUBLIC_SYNC_SERVER_URL = process.env.PUBLIC_SYNC_SERVER_URL || '';

const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const RATE_LIMIT_MAX_WRITES = Number(process.env.RATE_LIMIT_MAX_WRITES) || 60; // POST/PATCH per window
const RATE_LIMIT_MAX_READS = Number(process.env.RATE_LIMIT_MAX_READS) || 300; // GET per window

// Off by default: req.socket.remoteAddress is the only IP a client can't
// spoof, so that's what the rate limiter uses unless this is explicitly
// enabled. Turn it on ONLY when this process sits behind a reverse proxy
// / load balancer you control (e.g. nginx, an LB health-checked to strip
// any inbound X-Forwarded-For before appending its own) — otherwise any
// client can set X-Forwarded-For themselves and every request looks like
// it comes from a different IP, making the per-IP limiter a no-op.
const TRUST_PROXY = /^(1|true|yes)$/i.test(process.env.TRUST_PROXY || '');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_AUTH_MAX_AGE_SEC = Math.max(60, Number(process.env.TELEGRAM_AUTH_MAX_AGE_SEC) || 86400);
const SESSION_TTL_MS = Math.max(5 * 60_000, Number(process.env.SELLIFY_SESSION_TTL_MS) || 7 * 24 * 60 * 60_000);

// ---------- tiny request helpers ----------

// Resolves the address the rate limiter (and anything else that cares
// about "which client") should key on. With TRUST_PROXY unset, this is
// always the raw socket address — accurate for a direct connection, and
// safe against spoofing. With TRUST_PROXY=1, the left-most address in
// X-Forwarded-For is used (the original client, assuming your proxy
// appends rather than trusts an inbound value), falling back to the
// socket address if the header is absent or malformed.
function clientIp(req) {
  if (TRUST_PROXY) {
    const header = req.headers['x-forwarded-for'];
    if (header) {
      const first = String(header).split(',')[0].trim();
      if (first) return first;
    }
  }
  return req.socket.remoteAddress || 'unknown';
}

function corsOriginFor(req) {
  const origin = req.headers['origin'];
  if (CORS_ALLOWED_ORIGINS.length === 0) return '*'; // dev fallback, warned about at startup
  if (origin && CORS_ALLOWED_ORIGINS.includes(origin)) return origin;
  return null; // not allowed — omit the header, browser blocks the cross-origin read
}

function sendJSON(res, status, body, req) {
  const payload = JSON.stringify(body);
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    ...(req?._requestId ? { 'X-Request-Id': req._requestId } : {}),
  };
  const allowOrigin = req ? corsOriginFor(req) : '*';
  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
    headers['Vary'] = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(payload);
}

// Structured error body. For 5xx we deliberately don't echo e.message —
// that's a Node/store internal error, not something written for a
// client to read, and could leak implementation details. For 4xx, the
// message IS the intended validation text (e.g. "Invalid or missing API
// key"), so it's shown as-is.
function sendError(res, status, err, req) {
  const message = status >= 500 ? 'Internal error' : (err.message || 'Request error');
  if (status >= 500) console.error('[error]', err);
  sendJSON(res, status, { error: { message, status } }, req);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > 2 * 1024 * 1024) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(buffer);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      // Basic body-size guard — 2MB is generous for an order/catalog
      // sync payload and prevents an unbounded read from a bad client.
      if (data.length > 2 * 1024 * 1024) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

// ---------- auth ----------

function getBearerKey(req) {
  const header = req.headers['authorization'] || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

// Constant-time compare so a mistyped/guessed key can't be distinguished
// from a correct-length-wrong-value one by response timing. Length is
// checked first (timingSafeEqual throws on mismatched lengths, and the
// length itself isn't the secret here — the key content is).
function keysMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Throws a 401 unless the request's Authorization header carries the
// exact key minted for this tenant. Callers pass an already-loaded
// tenant record (never re-fetches) so this stays a pure check, not a
// second store hit.
async function requireTenantAuth(req, tenant) {
  const token = getBearerToken(req);
  const session = token ? await authenticateSessionToken(token) : null;
  if (session) {
    if (String(session.chatId) !== String(tenant.chatId)) throw Object.assign(new Error('Session is not authorized for this tenant'), { statusCode: 403 });
    assertTenantScope(session, tenant);
    return session;
  }
  throw Object.assign(new Error('Invalid or missing session'), { statusCode: 401 });
}

async function requireAuthorization(session, tenant, resource, action, { location = null, deniedMessage = 'Permission denied' } = {}) {
  assertTenantScope(session, tenant);
  if (location) assertLocationScope(session, tenant, location);
  const organization = tenant?.organizationId || session?.organizationId;
  const decision = authorize(session, organization, location, resource, action);
  if (decision === AUTHZ.ALLOW) return decision;
  // Authorization failures use the existing audit_events table; this does not
  // create a second audit system. Best-effort logging must never turn a 403
  // into a 500 if the audit write itself fails.
  try {
    await recordAuditEvent({
      chatId: session?.chatId ?? null,
      organizationId: session?.organizationId ?? null,
      action: 'authorization.denied',
      entityType: String(resource || 'unknown'),
      entityId: null,
      metadata: { action: String(action || ''), decision, role: String(session?.role || '') },
    });
  } catch (auditError) {
    console.error('[authorization] denied-event audit failed', auditError);
  }
  throw Object.assign(new Error(deniedMessage), { statusCode: 403, code: 'AUTHORIZATION_DENIED', decision });
}

async function requireOwnerRole(session) {
  // Compatibility helper retained for routes not yet migrated in this phase.
  // It now delegates to the central policy instead of owning role logic.
  return requireAuthorization(session, { chatId: session?.chatId, organizationId: session?.organizationId }, 'administration', 'settings:configure', {
    deniedMessage: 'Owner or manager permission required',
  });
}

function requireInviteRole(session, role) {
  const target = String(role || 'cashier');
  const allowed = new Set(['manager', 'cashier', 'staff']);
  if (!allowed.has(target)) {
    throw Object.assign(new Error('Invalid invite role'), { statusCode: 400 });
  }
  if (!session || !['owner', 'manager'].includes(session.role)) {
    throw Object.assign(new Error('Owner or manager permission required'), { statusCode: 403 });
  }
  // Managers can manage frontline staff, but only owners can create managers.
  if (session.role !== 'owner' && target === 'manager') {
    throw Object.assign(new Error('Only the owner can invite managers'), { statusCode: 403 });
  }
  return target;
}

async function handleTelegramStorefrontPublicGet(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const config = getTelegramStorefrontConfig(chatId);
  if (!config || config.status !== 'PUBLISHED') {
    return sendJSON(res, 404, { error: { message: 'Telegram storefront is not published', status: 404 } }, req);
  }
  // Public buyer surface receives channel presentation metadata only. Never
  // expose credential references, seller administration metadata, or secrets.
  sendJSON(res, 200, { storefront: {
    channelType: config.channelType,
    botId: config.botId,
    botUsername: config.botUsername,
    status: config.status,
    webappUrl: config.webappUrl,
    enabledCapabilities: config.enabledCapabilities,
    checkout: normalizeTelegramCheckoutContext({
      enabledCapabilities: config.enabledCapabilities,
      metadata: config.metadata,
    }),
    metadata: config.metadata && typeof config.metadata === 'object' ? config.metadata : {},
  } }, req);
}

async function handleCrossChannelConsistencyGet(req, res, chatId) {
  const session = await requireSession(req, chatId);
  const tenant = await getTenant(chatId);
  await requireAuthorization(session, tenant, 'seller_storefront_channels', 'settings:configure', { deniedMessage: 'Seller storefront access denied' });
  const telegram = getTelegramStorefrontConfig(chatId);
  const channels = telegram ? [buildSellerStorefrontChannelSummary(telegram)] : [];
  const contract = buildCrossChannelConsistencyContract(channels);
  const assessment = evaluateCrossChannelConsistency(channels);
  sendJSON(res, 200, { consistency: assessment, contract }, req);
}

async function handleSellerStorefrontChannelsGet(req, res, chatId) {
  const session = await requireSession(req, chatId);
  const tenant = await getTenant(chatId);
  await requireAuthorization(session, tenant, 'seller_storefront_channels', 'settings:configure', { deniedMessage: 'Seller storefront access denied' });
  const telegram = getTelegramStorefrontConfig(chatId);
  const channels = telegram ? [buildSellerStorefrontChannelSummary(telegram)] : [];
  sendJSON(res, 200, { channels, constitution: 'existing_sellify_domains_are_canonical' }, req);
}

async function handleTelegramStorefrontGet(req, res, chatId) {
  const session = await requireSession(req, chatId);
  const tenant = await getTenant(chatId);
  await requireAuthorization(session, tenant, 'telegram_storefront', 'settings:configure', { deniedMessage: 'Telegram storefront access denied' });
  const config = getTelegramStorefrontConfig(chatId);
  // credentialRef is intentionally returned only as presence metadata, never a secret.
  if (config) config.credentialRef = config.credentialRef ? '[configured]' : null;
  sendJSON(res, 200, { storefront: config }, req);
}

async function handleTelegramStorefrontVerify(req, res, chatId) {
  const session = await requireSession(req, chatId);
  const tenant = await getTenant(chatId);
  await requireAuthorization(session, tenant, 'telegram_storefront', 'settings:configure', { deniedMessage: 'Only owners and managers can verify the Telegram storefront' });
  const config = await verifyTelegramStorefront(chatId, session);
  if (config) config.credentialRef = config.credentialRef ? '[configured]' : null;
  sendJSON(res, 200, { storefront: config }, req);
}

async function handleTelegramStorefrontPatch(req, res, chatId) {
  const session = await requireSession(req, chatId);
  const tenant = await getTenant(chatId);
  await requireAuthorization(session, tenant, 'telegram_storefront', 'settings:configure', { deniedMessage: 'Only owners and managers can configure the Telegram storefront' });
  const body = await readBody(req);
  if (Object.hasOwn(body, 'credentialRef') && body.credentialRef != null && typeof body.credentialRef !== 'string') {
    throw Object.assign(new Error('credentialRef must be a string reference'), { statusCode: 400, code: 'INVALID_CREDENTIAL_REF' });
  }
  const config = await upsertTelegramStorefrontConfig(chatId, body, session);
  if (config) config.credentialRef = config.credentialRef ? '[configured]' : null;
  sendJSON(res, 200, { storefront: config }, req);
}

async function handleTelegramStorefrontBuyerSession(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const config = getTelegramStorefrontConfig(chatId);
  if (!config || config.status !== 'PUBLISHED') return sendJSON(res, 404, { error: { message: 'Telegram storefront is not published', status: 404 } }, req);
  if (!config.credentialRef) throw Object.assign(new Error('Telegram bot credential is not configured'), { statusCode: 409, code: 'TELEGRAM_CREDENTIAL_REQUIRED' });
  const body = await readBody(req);
  const initData = body.initData || body.init_data || req.headers['x-telegram-init-data'] || '';
  try {
    const secret = await resolveTelegramBotCredential(config.credentialRef);
    const verified = verifyTelegramBuyerInitDataWithSecret(initData, secret, TELEGRAM_AUTH_MAX_AGE_SEC);
    // Stateless buyer context: no new session table, no tenant membership, and
    // no duplicate identity authority. The canonical buyer/order domains may
    // use telegramUserId as an external buyer identity key.
    return sendJSON(res, 200, {
      buyer: {
        telegramUserId: verified.telegramUserId,
        name: `${verified.user.firstName} ${verified.user.lastName}`.trim() || verified.user.username || `Telegram ${verified.telegramUserId}`,
        username: verified.user.username,
        languageCode: verified.user.languageCode,
      },
      storefront: { chatId: String(chatId), botId: config.botId, botUsername: config.botUsername },
      session: { type: 'verified_stateless', expiresAt: new Date((verified.authDate + TELEGRAM_AUTH_MAX_AGE_SEC) * 1000).toISOString() },
    }, req);
  } catch (e) {
    try { await recordAuditEvent({ chatId: String(chatId), organizationId: tenant.organizationId, action: 'telegram.storefront.buyer_verification_failed', entityType: 'telegram_buyer_session', entityId: null, metadata: { code: e.code || 'TELEGRAM_BUYER_VERIFICATION_FAILED' }, }); } catch {}
    throw e;
  }
}

async function handleTelegramStorefrontOrderHistory(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const config = getTelegramStorefrontConfig(chatId);
  if (!config || config.status !== 'PUBLISHED') return sendJSON(res, 404, { error: { message: 'Telegram storefront is not published', status: 404 } }, req);
  if (!Array.isArray(config.enabledCapabilities) || !config.enabledCapabilities.includes('order_status')) {
    return sendJSON(res, 403, { error: { message: 'Telegram order status capability is disabled', status: 403, code: 'TELEGRAM_ORDER_STATUS_DISABLED' } }, req);
  }
  const initData = String(req.headers['x-telegram-init-data'] || '').trim();
  if (!initData) throw Object.assign(new Error('Telegram buyer authentication is required'), { statusCode: 401, code: 'TELEGRAM_BUYER_AUTH_REQUIRED' });
  try {
    const secret = await resolveTelegramBotCredential(config.credentialRef);
    const verified = verifyTelegramBuyerInitDataWithSecret(initData, secret, TELEGRAM_AUTH_MAX_AGE_SEC);
    const orders = await listTelegramBuyerOrders(chatId, verified.telegramUserId, 20);
    return sendJSON(res, 200, { buyer: { telegramUserId: verified.telegramUserId }, orders }, req);
  } catch (e) {
    try { await recordAuditEvent({ chatId: String(chatId), organizationId: tenant.organizationId, action: 'telegram.storefront.buyer_order_history_failed', entityType: 'telegram_buyer_orders', entityId: null, metadata: { code: e.code || 'TELEGRAM_BUYER_ORDER_HISTORY_FAILED' } }); } catch {}
    throw e;
  }
}

async function handleTelegramStorefrontFulfillment(req, res, chatId, orderId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const config = getTelegramStorefrontConfig(chatId);
  if (!config || config.status !== 'PUBLISHED') return sendJSON(res, 404, { error: { message: 'Telegram storefront is not published', status: 404 } }, req);
  const enabled = new Set(Array.isArray(config.enabledCapabilities) ? config.enabledCapabilities : []);
  if (![...enabled].some(c => ['tracking','proof_of_delivery','returns'].includes(c))) {
    return sendJSON(res, 403, { error: { message: 'Fulfillment capabilities are disabled', status: 403, code: 'TELEGRAM_FULFILLMENT_DISABLED' } }, req);
  }
  const initData = String(req.headers['x-telegram-init-data'] || '').trim();
  if (!initData) throw Object.assign(new Error('Telegram buyer authentication is required'), { statusCode: 401, code: 'TELEGRAM_BUYER_AUTH_REQUIRED' });
  try {
    const secret = await resolveTelegramBotCredential(config.credentialRef);
    const verified = verifyTelegramBuyerInitDataWithSecret(initData, secret, TELEGRAM_AUTH_MAX_AGE_SEC);
    const fulfillment = await getTelegramBuyerFulfillmentExperience(chatId, verified.telegramUserId, decodeURIComponent(orderId));
    const visible = {
      ...fulfillment,
      fulfillments: fulfillment.fulfillments.map(f => ({
        ...f,
        trackingReference: enabled.has('tracking') ? f.trackingReference : null,
        proof: enabled.has('proof_of_delivery') ? f.proof : null,
      })),
      returns: enabled.has('returns') ? fulfillment.returns : { supported: false, status: null, requestAction: 'disabled' },
    };
    return sendJSON(res, 200, { order: visible }, req);
  } catch (e) {
    try { await recordAuditEvent({ chatId: String(chatId), organizationId: tenant.organizationId, action: 'telegram.storefront.fulfillment_view_failed', entityType: 'telegram_buyer_fulfillment', entityId: String(orderId), metadata: { code: e.code || 'TELEGRAM_FULFILLMENT_VIEW_FAILED' } }); } catch {}
    throw e;
  }
}

async function handleTelegramStorefrontOrder(req, res, chatId, orderId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const config = getTelegramStorefrontConfig(chatId);
  if (!config || config.status !== 'PUBLISHED') return sendJSON(res, 404, { error: { message: 'Telegram storefront is not published', status: 404 } }, req);
  if (!Array.isArray(config.enabledCapabilities) || !config.enabledCapabilities.includes('order_status')) {
    return sendJSON(res, 403, { error: { message: 'Telegram order status capability is disabled', status: 403, code: 'TELEGRAM_ORDER_STATUS_DISABLED' } }, req);
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = String(url.searchParams.get('token') || '').trim();
  if (!token) return sendJSON(res, 400, { error: { message: 'Tracking token is required', status: 400 } }, req);
  const tracking = await getMarketplaceOrderTracking(decodeURIComponent(orderId), token);
  return sendJSON(res, 200, { order: tracking, payment: buildTelegramPaymentBoundary({ order: tracking }) }, req);
}

// ---------- identity/session auth ----------

function getBearerToken(req) {
  const header = req.headers.authorization;
  const match = /^Bearer\s+(.+)$/i.exec(header || '');
  return match ? match[1].trim() : null;
}

function verifyTelegramInitData(rawInitData) {
  if (!TELEGRAM_BOT_TOKEN) throw Object.assign(new Error('Telegram authentication is not configured'), { statusCode: 503 });
  if (typeof rawInitData !== 'string' || !rawInitData.trim()) {
    throw Object.assign(new Error('Telegram initData is required'), { statusCode: 400 });
  }
  const params = new URLSearchParams(rawInitData);
  const receivedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  if (!receivedHash || !Number.isFinite(authDate)) {
    throw Object.assign(new Error('Invalid Telegram initData'), { statusCode: 401 });
  }
  if (Math.abs(Date.now() / 1000 - authDate) > TELEGRAM_AUTH_MAX_AGE_SEC) {
    throw Object.assign(new Error('Telegram initData is expired'), { statusCode: 401 });
  }
  const pairs = [];
  for (const [key, value] of params.entries()) {
    if (key !== 'hash') pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(TELEGRAM_BOT_TOKEN).digest();
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (!keysMatch(receivedHash, expectedHash)) {
    throw Object.assign(new Error('Invalid Telegram initData signature'), { statusCode: 401 });
  }
  let user = null;
  try { user = params.get('user') ? JSON.parse(params.get('user')) : null; } catch {}
  if (!user || user.id == null) throw Object.assign(new Error('Telegram user is missing'), { statusCode: 401 });
  return { user, authDate };
}

async function requireSession(req, chatId = null) {
  const session = await authenticateSessionToken(getBearerToken(req));
  if (!session) throw Object.assign(new Error('Invalid or expired session'), { statusCode: 401 });
  if (chatId != null && String(chatId) !== String(session.chatId)) {
    throw Object.assign(new Error('Session is not authorized for this tenant'), { statusCode: 403 });
  }
  return session;
}

async function handleLegacyMigration(req, res) {
  const body = await readBody(req);
  const { user } = verifyTelegramInitData(body.initData);
  const legacyKey = String(body.apiKey || '').trim();
  if (!legacyKey) throw Object.assign(new Error('Legacy API key is required for migration'), { statusCode: 400 });
  const tenant = await getTenantByApiKey(legacyKey);
  if (!tenant) throw Object.assign(new Error('Invalid legacy API key'), { statusCode: 401 });
  const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || `Telegram ${user.id}`;
  const dbUser = await getOrCreateUserByTelegram(user.id, displayName);
  const membership = await ensureMembership(dbUser.id, tenant.chatId, 'owner');
  const session = await createSession({ userId: dbUser.id, chatId: tenant.chatId, deviceName: body.deviceName || 'Migrated device', ttlMs: SESSION_TTL_MS });
  sendJSON(res, 200, { user: { id: dbUser.id, telegramUserId: String(user.id), displayName }, membership: { chatId: tenant.chatId, tenantId: tenant.tenantId, role: membership.role, sellerName: tenant.sellerName }, session }, req);
}

async function handleTelegramAuth(req, res) {
  const body = await readBody(req);
  const { user } = verifyTelegramInitData(body.initData);
  const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || `Telegram ${user.id}`;
  const dbUser = await getOrCreateUserByTelegram(user.id, displayName);
  const memberships = await listUserMemberships(dbUser.id);
  let session = null;
  let challenge = null;
  if (memberships.length === 1) {
    session = await createSession({ userId: dbUser.id, chatId: memberships[0].chatId, deviceName: 'Telegram Mini App', ttlMs: SESSION_TTL_MS });
  } else {
    // A user with zero tenants needs a challenge to create one; a user with
    // multiple tenants needs the same short-lived proof to select one and
    // exchange it for a tenant-scoped device session. We deliberately do not
    // create a tenantless session because sessions are always bound to a
    // concrete tenant/device boundary.
    challenge = await createAuthChallenge(dbUser.id);
  }
  sendJSON(res, 200, {
    user: { id: dbUser.id, telegramUserId: String(user.id), displayName },
    memberships,
    session,
    challenge,
  }, req);
}

async function handleCreateTenant(req, res) {
  const body = await readBody(req);
  let userId;
  try {
    const session = await requireSession(req);
    await requireOwnerRole(session);
    userId = session.userId;
  } catch (error) {
    if (!body.challengeToken) throw error;
    const challenge = await consumeAuthChallenge(body.challengeToken);
    if (!challenge) throw Object.assign(new Error('Invalid or expired onboarding challenge'), { statusCode: 401 });
    userId = challenge.userId;
  }
  if (!String(body.sellerName || '').trim()) throw Object.assign(new Error('Business name is required'), { statusCode: 400 });
  const result = await createTenantForUser({
    userId,
    sellerName: body.sellerName,
    businessType: body.businessType,
    country: body.country,
    currency: body.currency,
    timezone: body.timezone,
    deviceName: body.deviceName || 'Primary device',
  });
  const authSession = await createSession({ userId, chatId: result.chatId, deviceName: body.deviceName || 'Primary device', ttlMs: SESSION_TTL_MS });
  sendJSON(res, 201, {
    tenant: result.tenant,
    membership: { chatId: result.chatId, tenantId: result.tenantId, role: 'owner' },
    session: authSession,
  }, req);
}

async function handleMyTenants(req, res) {
  const session = await requireSession(req);
  const memberships = await listUserMemberships(session.userId);
  sendJSON(res, 200, { memberships }, req);
}

async function handleSelectTenant(req, res) {
  const body = await readBody(req);
  const chatId = String(body.chatId || '');
  if (!chatId) throw Object.assign(new Error('chatId is required'), { statusCode: 400 });

  let userId;
  const bearer = getBearerToken(req);
  const session = bearer ? await authenticateSessionToken(bearer) : null;
  if (session) {
    userId = session.userId;
  } else {
    // Multi-tenant Telegram users do not yet have a tenant-scoped session.
    // Exchange the one-time identity challenge issued by /auth/telegram for
    // a concrete tenant session after the user chooses a business.
    const challenge = await consumeAuthChallenge(body.challengeToken);
    if (!challenge) throw Object.assign(new Error('Invalid or expired tenant-selection challenge'), { statusCode: 401 });
    userId = challenge.userId;
  }

  const memberships = await listUserMemberships(userId);
  const membership = memberships.find(m => m.chatId === chatId);
  if (!membership) throw Object.assign(new Error('You are not a member of this tenant'), { statusCode: 403 });
  const next = await createSession({ userId, chatId, deviceName: body.deviceName || 'Sellify device', ttlMs: SESSION_TTL_MS });
  sendJSON(res, 200, { session: next, membership }, req);
}

async function handleLogout(req, res) {
  const session = await requireSession(req);
  await revokeSession(session.sessionId);
  sendJSON(res, 200, { ok: true }, req);
}

async function handleCreatePairing(req, res) {
  const body = await readBody(req);
  const session = await requireSession(req);
  await requireOwnerRole(session);
  const role = String(body.role || 'cashier');
  const result = await createPairingChallenge({ userId: session.userId, chatId: session.chatId, role });
  sendJSON(res, 201, result, req);
}

async function handlePairDevice(req, res) {
  const body = await readBody(req);
  const token = String(body.token || '').trim();
  if (!token) throw Object.assign(new Error('Pairing code is required'), { statusCode: 400 });
  const paired = await consumePairingChallenge(token, body.deviceName || 'Paired Sellify device');
  if (!paired) throw Object.assign(new Error('Invalid or expired pairing code'), { statusCode: 401 });
  const authSession = await createSession({ userId: paired.userId, chatId: paired.chatId, deviceName: body.deviceName || 'Paired Sellify device', ttlMs: SESSION_TTL_MS });
  sendJSON(res, 200, {
    user: { id: paired.userId, displayName: 'Paired device' },
    membership: { chatId: paired.chatId, role: paired.role },
    session: authSession,
  }, req);
}

async function handleCreateInvite(req, res) {
  const body = await readBody(req);
  const session = await requireSession(req);
  await requireOwnerRole(session);
  const role = requireInviteRole(session, body.role || 'cashier');
  const result = await createInvite({ userId: session.userId, chatId: session.chatId, role });
  sendJSON(res, 201, result, req);
}

async function handleListTenantMemberships(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, chatId);
  if (!tenant) throw Object.assign(new Error('Unknown store'), { statusCode: 404 });
  await requireAuthorization(session, tenant, 'membership', 'membership:role:manage', {
    deniedMessage: 'Membership role management permission required',
  });
  const memberships = await listTenantMemberships(chatId);
  sendJSON(res, 200, { memberships }, req);
}

async function handleChangeMembershipRole(req, res) {
  const body = await readBody(req);
  const session = await requireSession(req);
  const membershipId = String(body.membershipId || '').trim();
  const role = String(body.role || '').trim().toLowerCase();
  if (!membershipId || !role) throw Object.assign(new Error('membershipId and role are required'), { statusCode: 400 });
  const tenant = await getTenant(session.chatId);
  if (!tenant) throw Object.assign(new Error('Unknown store'), { statusCode: 404 });
  await requireAuthorization(session, tenant, 'membership', 'membership:role:manage', {
    deniedMessage: 'Membership role management permission required',
  });
  const result = await changeMembershipRole({ actorUserId: session.userId, chatId: session.chatId, membershipId, role });
  sendJSON(res, 200, { membership: result }, req);
}

async function handleAssignMembershipContextualRole(req, res) {
  const body = await readBody(req);
  const session = await requireSession(req);
  const tenant = await getTenant(session.chatId);
  if (!tenant) throw Object.assign(new Error('Unknown store'), { statusCode: 404 });
  await requireAuthorization(session, tenant, 'membership', 'membership:role:manage', {
    deniedMessage: 'Membership role management permission required',
  });
  const result = await assignMembershipContextualRole({
    actorUserId: session.userId,
    chatId: session.chatId,
    membershipId: String(body.membershipId || '').trim(),
    role: String(body.role || '').trim().toLowerCase(),
    scopeType: body.scopeType || 'ORGANIZATION',
    scopeId: body.scopeId ?? null,
  });
  sendJSON(res, 201, { membershipRole: result }, req);
}

async function handleRevokeMembershipContextualRole(req, res) {
  const body = await readBody(req);
  const session = await requireSession(req);
  const decision = authorize(session, session.organizationId, null, 'membership', 'membership:role:manage');
  if (decision !== AUTHZ.ALLOW) throw Object.assign(new Error('Membership role management permission required'), { statusCode: 403 });
  const result = await revokeMembershipContextualRole({
    actorUserId: session.userId,
    chatId: session.chatId,
    membershipId: String(body.membershipId || '').trim(),
    role: String(body.role || '').trim().toLowerCase(),
    scopeType: body.scopeType || 'ORGANIZATION',
    scopeId: body.scopeId ?? null,
  });
  sendJSON(res, 200, { membershipRole: result }, req);
}

async function handleListInvites(req, res, chatId) {
  const session = await requireSession(req, chatId);
  await requireOwnerRole(session);
  const invites = await listInvites(chatId);
  sendJSON(res, 200, { invites }, req);
}

async function handleRevokeInvite(req, res) {
  const body = await readBody(req);
  const session = await requireSession(req);
  await requireOwnerRole(session);
  const token = String(body.token || '').trim();
  if (!token) throw Object.assign(new Error('Invite token is required'), { statusCode: 400 });
  await revokeInvite({ userId: session.userId, chatId: session.chatId, token });
  sendJSON(res, 200, { ok: true }, req);
}

async function handleListDevices(req, res, chatId) {
  const session = await requireSession(req, chatId);
  await requireOwnerRole(session);
  const devices = await listDevices(chatId);
  sendJSON(res, 200, { devices }, req);
}

async function handleRevokeDevice(req, res) {
  const body = await readBody(req);
  const session = await requireSession(req);
  const deviceId = String(body.deviceId || '').trim();
  if (!deviceId) throw Object.assign(new Error('deviceId is required'), { statusCode: 400 });
  // A device can always revoke itself (e.g. "sign this browser out" from
  // its own Settings), regardless of role — that's just logging out.
  // Revoking a *different* device requires owner/manager; revokeDevice()
  // in the store also re-checks this role server-side, so this is a fast
  // early rejection, not the only enforcement.
  if (deviceId !== session.deviceId) await requireOwnerRole(session);
  await revokeDevice({ userId: session.userId, chatId: session.chatId, deviceId, requestingDeviceId: session.deviceId });
  sendJSON(res, 200, { ok: true }, req);
}

// Unlike pairing, accepting an invite authenticates the *recipient's own*
// Telegram identity (not the owner's) — this is the one auth endpoint
// where the caller and the tenant owner are deliberately different people.
async function handleAcceptInvite(req, res) {
  const body = await readBody(req);
  const token = String(body.token || '').trim();
  if (!token) throw Object.assign(new Error('Invite token is required'), { statusCode: 400 });
  const { user } = verifyTelegramInitData(body.initData);
  const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || `Telegram ${user.id}`;
  const dbUser = await getOrCreateUserByTelegram(user.id, displayName);
  const accepted = await consumeInvite(token, dbUser.id);
  if (!accepted) throw Object.assign(new Error('Invalid, expired, or already-used invite'), { statusCode: 401 });
  const authSession = await createSession({ userId: dbUser.id, chatId: accepted.chatId, deviceName: body.deviceName || 'Telegram Mini App', ttlMs: SESSION_TTL_MS });
  sendJSON(res, 200, {
    user: { id: dbUser.id, telegramUserId: String(user.id), displayName },
    membership: { chatId: accepted.chatId, tenantId: accepted.tenantId, role: accepted.role, sellerName: accepted.sellerName },
    alreadyMember: accepted.alreadyMember,
    roleChanged: accepted.roleChanged,
    session: authSession,
  }, req);
}

// ---------- route handlers ----------

async function handleSyncEvents(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  const body = await readBody(req);
  const events = Array.isArray(body.events) ? body.events : [];
  if (events.length > 100) throw Object.assign(new Error('Too many events in one batch'), { statusCode: 400 });
  const results = [];
  for (const event of events) {
    results.push(await processEventIsolated(event, (candidate) => processSyncEvent(chatId, candidate, session)));
  }
  sendJSON(res, 200, { results }, req);
}

async function handleSync(req, res, chatId) {
  const body = await readBody(req);
  const queued = Array.isArray(body.orders) ? body.orders : [];

  const existing = await getTenant(chatId);
  if (!existing) return sendJSON(res, 404, { error: { message: 'Unknown store; complete onboarding first', status: 404 } }, req);
  const tenant = existing;
  await requireSession(req, chatId);

  const results = queued.length ? await saveQueuedOrders(chatId, queued) : [];

  sendJSON(res, 200, {
    results,
    branding: tenant.branding || undefined,

  }, req);
}

// Phase 2: the pull half of sync, added specifically so a marketplace
// sub-order created by createMarketplaceOrder has a way to reach the
// seller's own device — see pullNewOrders in lib/store.js. Owner-key
// authenticated, same as the push side: this is a seller reading their
// own order queue, not a public storefront read.
async function handleOrdersFeed(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'orders', 'orders:view', { deniedMessage: 'Order view permission required' });
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedLimit = Number(url.searchParams.get('limit') || 100);
  const limit = Math.min(200, Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 100));
  const orders = (await getOrders(chatId)).slice(0, limit);
  sendJSON(res, 200, { orders }, req);
}

async function handleSyncPull(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireOwnerRole(session);
  const new_orders = await pullNewOrders(chatId);
  sendJSON(res, 200, { new_orders }, req);
}

async function handleCatalogGet(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) {
    // Unlike /sync and /catalog POST, a bare GET shouldn't silently
    // create a tenant — that would let anyone probe chatIds into
    // existence. Catalog pull only succeeds for a chatId that has
    // already synced at least once.
    return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  }
  // Deliberately public, no auth: this is the storefront/marketplace
  // read path — buyers and cross-tenant marketplace feeds need to pull
  // a seller's catalog without holding that seller's credential. See
  // the auth-model note at the top of this file.
  const catalog = await getCatalog(chatId);
  sendJSON(res, 200, {
    products: catalog.products,
    branding: tenant.branding || undefined,
    seller_name: tenant.sellerName || undefined,
  }, req);
}

async function handleCatalogPost(req, res, chatId) {
  const body = await readBody(req);
  const incoming = Array.isArray(body.products) ? body.products : [];
  if (incoming.length > 2000) {
    throw Object.assign(new Error('Catalog is too large (maximum 2000 products)'), { statusCode: 400 });
  }
  for (const product of incoming) {
    if (!product || typeof product !== 'object') {
      throw Object.assign(new Error('Each catalog product must be an object'), { statusCode: 400 });
    }
    if (product.id == null || !/^[A-Za-z0-9_.-]{1,128}$/.test(String(product.id))) {
      throw Object.assign(new Error('Each catalog product needs a valid id'), { statusCode: 400 });
    }
    if (typeof product.name !== 'string' || !product.name.trim() || product.name.trim().length > 200) {
      throw Object.assign(new Error('Each catalog product needs a name of 1-200 characters'), { statusCode: 400 });
    }
    const price = Number(product.price);
    if (!Number.isFinite(price) || price < 0 || price > 2147483647) {
      throw Object.assign(new Error('Each catalog product needs a valid non-negative price'), { statusCode: 400 });
    }
    if (product.stock !== undefined && product.stock !== null) {
      const stock = Number(product.stock);
      if (!Number.isFinite(stock) || stock < 0 || stock > 1000000000) {
        throw Object.assign(new Error('Catalog stock must be a finite non-negative number'), { statusCode: 400 });
      }
    }
    if (product.stock_revision !== undefined && (!Number.isInteger(Number(product.stock_revision)) || Number(product.stock_revision) < 0)) {
      throw Object.assign(new Error('Catalog stock_revision must be a non-negative integer'), { statusCode: 400 });
    }
  }

  const existing = await getTenant(chatId);
  if (!existing) return sendJSON(res, 404, { error: { message: 'Unknown store; complete onboarding first', status: 404 } }, req);
  const tenant = existing;
  const session = await requireSession(req, chatId);
  await requireOwnerRole(session);

  let products;
  try {
    products = await saveCatalog(chatId, incoming);
  } catch (error) {
    if (error?.code === 'CATALOG_STOCK_CONFLICT') {
      const latest = await getCatalog(chatId);
      return sendJSON(res, 409, {
        error: { message: error.message, status: 409, code: error.code },
        products: latest.products,
        branding: tenant.branding || undefined,
      }, req);
    }
    throw error;
  }
  sendJSON(res, 200, { products, branding: tenant.branding || undefined }, req);
}

async function handleTenantsList(req, res) {
  const session = await requireSession(req);
  const memberships = await listUserMemberships(session.userId);
  sendJSON(res, 200, {
    tenants: memberships.map(m => ({
      chatId: m.chatId, tenantId: m.tenantId, sellerName: m.sellerName, role: m.role,
    })),
  }, req);
}

async function handleCustomersList(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'customers', 'customers:view', { deniedMessage: 'Customer view permission required' });
  const url = new URL(req.url, `http://${req.headers.host}`);
  const customers = await listCustomers(chatId, {
    query: url.searchParams.get('q') || '',
    status: url.searchParams.get('status') || 'active',
    limit: Number(url.searchParams.get('limit') || 100),
  });
  sendJSON(res, 200, { customers }, req);
}

async function handleCustomerGet(req, res, chatId, customerId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'customers', 'customers:view', { deniedMessage: 'Customer view permission required' });
  const customer = await getCustomer(chatId, customerId);
  if (!customer) return sendJSON(res, 404, { error: { message: 'Customer not found', status: 404 } }, req);
  sendJSON(res, 200, { customer }, req);
}

async function handleCustomerCreate(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'customers', 'customers:manage', { deniedMessage: 'Customer management permission required' });
  const body = await readBody(req);
  const customer = await upsertCustomer(chatId, body);
  sendJSON(res, 201, { customer }, req);
}

async function handleCustomerPatch(req, res, chatId, customerId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'customers', 'customers:manage', { deniedMessage: 'Customer management permission required' });
  const body = await readBody(req);
  const customer = await updateCustomer(chatId, customerId, body);
  sendJSON(res, 200, { customer }, req);
}

async function handleCustomerPricing(req, res, chatId, pricingId = null) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  const action = req.method === 'GET' ? 'b2b:pricing:view' : 'b2b:pricing:manage';
  await requireAuthorization(session, tenant, 'b2b_pricing', action, { deniedMessage: 'B2B pricing permission required' });
  if (req.method === 'GET') {
    if (pricingId) {
      const rule = await getCustomerPricing(chatId, pricingId);
      if (!rule) return sendJSON(res, 404, { error: { message: 'Custom pricing rule not found', status: 404 } }, req);
      return sendJSON(res, 200, { pricing: rule }, req);
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pricing = await listCustomerPricing(chatId, url.searchParams.get('customer_id') || '', url.searchParams.get('product_id') || '', url.searchParams.get('status') || 'all', Number(url.searchParams.get('limit') || 100));
    return sendJSON(res, 200, { pricing }, req);
  }
  const body = await readBody(req);
  const pricing = pricingId
    ? await updateCustomerPricing(chatId, pricingId, body, session)
    : await upsertCustomerPricing(chatId, body, session);
  sendJSON(res, pricingId ? 200 : 201, { pricing }, req);
}

async function handleSupplierNetworkCapabilities(req, res, chatId, capabilityId = null, action = null) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  if (req.method === 'GET') {
    await requireAuthorization(session, tenant, 'supplier_network_capability', 'supplier-network:capability:view', { deniedMessage: 'Supplier network capability view permission required' });
    if (capabilityId) {
      const capability = await getSupplierNetworkCapability(chatId, capabilityId);
      if (!capability) return sendJSON(res, 404, { error: { message: 'Supplier network capability not found', status: 404 } }, req);
      return sendJSON(res, 200, { capability }, req);
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    return sendJSON(res, 200, { capabilities: await listSupplierNetworkCapabilities(chatId, { status: url.searchParams.get('status') || 'all', code: url.searchParams.get('code') || '', limit: url.searchParams.get('limit') || 100 }) }, req);
  }
  if (req.method === 'POST' && action) {
    const permission = action === 'activate' ? 'supplier-network:capability:activate' : action === 'deactivate' ? 'supplier-network:capability:deactivate' : 'supplier-network:capability:manage';
    await requireAuthorization(session, tenant, 'supplier_network_capability', permission, { deniedMessage: 'Supplier network capability action permission required' });
    const target = action === 'activate' ? 'ACTIVE' : 'INACTIVE';
    return sendJSON(res, 200, { capability: await transitionSupplierNetworkCapability(chatId, capabilityId, target, session) }, req);
  }
  if (req.method === 'POST' || req.method === 'PATCH') {
    const body = await readBody(req);
    const requested = String(body.status || '').toUpperCase();
    const actionName = requested === 'ACTIVE' ? 'supplier-network:capability:activate' : requested === 'INACTIVE' ? 'supplier-network:capability:deactivate' : 'supplier-network:capability:manage';
    await requireAuthorization(session, tenant, 'supplier_network_capability', actionName, { deniedMessage: 'Supplier network capability permission required' });
    return sendJSON(res, capabilityId ? 200 : 201, { capability: await upsertSupplierNetworkCapability(chatId, { ...body, ...(capabilityId ? { id: capabilityId } : {}) }, session) }, req);
  }
  return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);
}


async function handleSupplierNetworkCatalog(req, res, chatId, listingId = null, action = null) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  if (req.method === 'GET') {
    await requireAuthorization(session, tenant, 'supplier_network_catalog_listing', 'supplier-network:catalog:view', { deniedMessage: 'Supplier network catalog view permission required' });
    if (listingId) { const listing = await getSupplierNetworkCatalogListing(chatId, listingId); if (!listing) return sendJSON(res, 404, { error: { message: 'Supplier network catalog listing not found', status: 404 } }, req); return sendJSON(res, 200, { listing }, req); }
    const url = new URL(req.url, `http://${req.headers.host}`);
    return sendJSON(res, 200, { listings: await listSupplierNetworkCatalogListings(chatId, { status: url.searchParams.get('status') || 'all', productId: url.searchParams.get('productId') || '', limit: url.searchParams.get('limit') || 100 }) }, req);
  }
  if (req.method === 'POST' && action) {
    const permission = action === 'activate' ? 'supplier-network:catalog:activate' : 'supplier-network:catalog:deactivate';
    await requireAuthorization(session, tenant, 'supplier_network_catalog_listing', permission, { deniedMessage: 'Supplier network catalog action permission required' });
    return sendJSON(res, 200, { listing: await transitionSupplierNetworkCatalogListing(chatId, listingId, action === 'activate' ? 'ACTIVE' : 'INACTIVE', session) }, req);
  }
  if (req.method === 'POST' || req.method === 'PATCH') {
    const body = await readBody(req);
    const permission = String(body.status || '').toUpperCase() === 'ACTIVE' ? 'supplier-network:catalog:activate' : String(body.status || '').toUpperCase() === 'INACTIVE' ? 'supplier-network:catalog:deactivate' : 'supplier-network:catalog:manage';
    await requireAuthorization(session, tenant, 'supplier_network_catalog_listing', permission, { deniedMessage: 'Supplier network catalog permission required' });
    return sendJSON(res, listingId ? 200 : 201, { listing: await upsertSupplierNetworkCatalogListing(chatId, { ...body, ...(listingId ? { id: listingId } : {}) }, session) }, req);
  }
  return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);
}
async function handleSupplierNetworkQualifications(req,res,chatId,qualificationId=null,action=null){
  const tenant=await getTenant(chatId); if(!tenant)return sendJSON(res,404,{error:{message:'Unknown store',status:404}},req); const session=await requireSession(req,tenant.chatId);
  if(req.method==='GET'){await requireAuthorization(session,tenant,'supplier_network_qualification','supplier-network:qualification:view',{deniedMessage:'Supplier network qualification view permission required'}); if(qualificationId){const qualification=await getSupplierNetworkQualification(chatId,qualificationId);if(!qualification)return sendJSON(res,404,{error:{message:'Supplier network qualification not found',status:404}},req);return sendJSON(res,200,{qualification},req)} const u=new URL(req.url,`http://${req.headers.host}`);return sendJSON(res,200,{qualifications:await listSupplierNetworkQualifications(chatId,{status:u.searchParams.get('status')||'all',qualificationType:u.searchParams.get('qualificationType')||'',limit:u.searchParams.get('limit')||100})},req)}
  if(req.method==='POST'&&action){const permission=action==='verify'?'supplier-network:qualification:verify':action==='document'?'supplier-network:qualification:document':'supplier-network:qualification:revoke';await requireAuthorization(session,tenant,'supplier_network_qualification',permission,{deniedMessage:'Supplier network qualification action permission required'});const target=action==='verify'?'VERIFIED':action==='document'?'DOCUMENTED':'REVOKED';return sendJSON(res,200,{qualification:await transitionSupplierNetworkQualification(chatId,qualificationId,target,session)},req)}
  if(req.method==='POST'||req.method==='PATCH'){const body=await readBody(req);const st=String(body.status||'').toUpperCase();const permission=st==='VERIFIED'?'supplier-network:qualification:verify':st==='DOCUMENTED'?'supplier-network:qualification:document':st==='REVOKED'?'supplier-network:qualification:revoke':'supplier-network:qualification:manage';await requireAuthorization(session,tenant,'supplier_network_qualification',permission,{deniedMessage:'Supplier network qualification permission required'});return sendJSON(res,qualificationId?200:201,{qualification:await upsertSupplierNetworkQualification(chatId,{...body,...(qualificationId?{id:qualificationId}:{})},session)},req)}
  return sendJSON(res,405,{error:{message:'Method not allowed',status:405}},req);
}

async function handleSupplierNetworkCommercialTerms(req,res,chatId,termsId=null,action=null){
  const tenant=await getTenant(chatId); if(!tenant)return sendJSON(res,404,{error:{message:'Unknown store',status:404}},req); const session=await requireSession(req,tenant.chatId);
  if(req.method==='GET'){await requireAuthorization(session,tenant,'supplier_network_commercial_terms','supplier-network:commercial:view',{deniedMessage:'Supplier network commercial terms view permission required'}); if(termsId){const terms=await getSupplierNetworkCommercialTerms(chatId,termsId);if(!terms)return sendJSON(res,404,{error:{message:'Supplier network commercial terms not found',status:404}},req);return sendJSON(res,200,{commercialTerms:terms},req)} const u=new URL(req.url,`http://${req.headers.host}`);return sendJSON(res,200,{commercialTerms:await listSupplierNetworkCommercialTerms(chatId,{status:u.searchParams.get('status')||'all',subjectType:u.searchParams.get('subjectType')||'',subjectId:u.searchParams.get('subjectId')||'',limit:u.searchParams.get('limit')||100})},req)}
  if(req.method==='POST'&&action){const permission=action==='activate'?'supplier-network:commercial:activate':'supplier-network:commercial:deactivate';await requireAuthorization(session,tenant,'supplier_network_commercial_terms',permission,{deniedMessage:'Supplier network commercial terms action permission required'});return sendJSON(res,200,{commercialTerms:await transitionSupplierNetworkCommercialTerms(chatId,termsId,action==='activate'?'ACTIVE':'INACTIVE',session)},req)}
  if(req.method==='POST'||req.method==='PATCH'){const body=await readBody(req);const st=String(body.status||'').toUpperCase();const permission=st==='ACTIVE'?'supplier-network:commercial:activate':st==='INACTIVE'?'supplier-network:commercial:deactivate':'supplier-network:commercial:manage';await requireAuthorization(session,tenant,'supplier_network_commercial_terms',permission,{deniedMessage:'Supplier network commercial terms permission required'});return sendJSON(res,termsId?200:201,{commercialTerms:await upsertSupplierNetworkCommercialTerms(chatId,{...body,...(termsId?{id:termsId}:{})},session)},req)}
  return sendJSON(res,405,{error:{message:'Method not allowed',status:405}},req);
}

async function handleSupplierNetworkCapacities(req,res,chatId,capacityId=null,action=null){
  const tenant=await getTenant(chatId); if(!tenant)return sendJSON(res,404,{error:{message:'Unknown store',status:404}},req); const session=await requireSession(req,tenant.chatId);
  if(req.method==='GET'){await requireAuthorization(session,tenant,'supplier_network_capacity','supplier-network:capacity:view',{deniedMessage:'Supplier network capacity view permission required'}); if(capacityId){const capacity=await getSupplierNetworkCapacity(chatId,capacityId);if(!capacity)return sendJSON(res,404,{error:{message:'Supplier network capacity not found',status:404}},req);return sendJSON(res,200,{capacity},req)} const u=new URL(req.url,`http://${req.headers.host}`);return sendJSON(res,200,{capacities:await listSupplierNetworkCapacities(chatId,{status:u.searchParams.get('status')||'all',subjectType:u.searchParams.get('subjectType')||'',subjectId:u.searchParams.get('subjectId')||'',availability:u.searchParams.get('availability')||'',limit:u.searchParams.get('limit')||100})},req)}
  if(req.method==='POST'&&action){const permission=action==='activate'?'supplier-network:capacity:activate':'supplier-network:capacity:deactivate';await requireAuthorization(session,tenant,'supplier_network_capacity',permission,{deniedMessage:'Supplier network capacity action permission required'});return sendJSON(res,200,{capacity:await transitionSupplierNetworkCapacity(chatId,capacityId,action==='activate'?'ACTIVE':'INACTIVE',session)},req)}
  if(req.method==='POST'||req.method==='PATCH'){const body=await readBody(req);const st=String(body.status||'').toUpperCase();const permission=st==='ACTIVE'?'supplier-network:capacity:activate':st==='INACTIVE'?'supplier-network:capacity:deactivate':'supplier-network:capacity:manage';await requireAuthorization(session,tenant,'supplier_network_capacity',permission,{deniedMessage:'Supplier network capacity permission required'});return sendJSON(res,capacityId?200:201,{capacity:await upsertSupplierNetworkCapacity(chatId,{...body,...(capacityId?{id:capacityId}:{})},session)},req)}
  return sendJSON(res,405,{error:{message:'Method not allowed',status:405}},req);
}

async function handleSupplierNetworkServiceAreas(req, res, chatId, areaId = null, action = null) {
  const tenant = await getTenant(chatId); if (!tenant) return sendJSON(res,404,{error:{message:'Unknown store',status:404}},req);
  const session = await requireSession(req, tenant.chatId);
  if (req.method === 'GET') {
    await requireAuthorization(session, tenant, 'supplier_network_service_area', 'supplier-network:service-area:view', {deniedMessage:'Supplier network service area view permission required'});
    if (areaId) { const area=await getSupplierNetworkServiceArea(chatId,areaId); if(!area)return sendJSON(res,404,{error:{message:'Supplier network service area not found',status:404}},req); return sendJSON(res,200,{serviceArea:area},req); }
    const url=new URL(req.url,`http://${req.headers.host}`); return sendJSON(res,200,{serviceAreas:await listSupplierNetworkServiceAreas(chatId,{status:url.searchParams.get('status')||'all',scopeType:url.searchParams.get('scopeType')||'',countryCode:url.searchParams.get('countryCode')||'',geoCode:url.searchParams.get('geoCode')||'',limit:url.searchParams.get('limit')||100})},req);
  }
  if (req.method === 'POST' && action) { const permission=action==='activate'?'supplier-network:service-area:activate':'supplier-network:service-area:deactivate'; await requireAuthorization(session,tenant,'supplier_network_service_area',permission,{deniedMessage:'Supplier network service area action permission required'}); return sendJSON(res,200,{serviceArea:await transitionSupplierNetworkServiceArea(chatId,areaId,action==='activate'?'ACTIVE':'INACTIVE',session)},req); }
  if (req.method==='POST'||req.method==='PATCH') { const body=await readBody(req); const st=String(body.status||'').toUpperCase(); const permission=st==='ACTIVE'?'supplier-network:service-area:activate':st==='INACTIVE'?'supplier-network:service-area:deactivate':'supplier-network:service-area:manage'; await requireAuthorization(session,tenant,'supplier_network_service_area',permission,{deniedMessage:'Supplier network service area permission required'}); return sendJSON(res,areaId?200:201,{serviceArea:await upsertSupplierNetworkServiceArea(chatId,{...body,...(areaId?{id:areaId}:{})},session)},req); }
  return sendJSON(res,405,{error:{message:'Method not allowed',status:405}},req);
}

async function handleSupplierNetworkMarketplaceIntegration(req,res,chatId,supplierOrganizationId=null){const tenant=await getTenant(chatId);if(!tenant)return sendJSON(res,404,{error:{message:'Unknown store',status:404}},req);const session=await requireSession(req,tenant.chatId);if(req.method!=='GET')return sendJSON(res,405,{error:{message:'Method not allowed',status:405}},req);await requireAuthorization(session,tenant,'supplier_network_marketplace_integration','supplier-network:marketplace-integration:view',{deniedMessage:'Supplier network marketplace integration view permission required'});return sendJSON(res,200,{integration:await getSupplierNetworkMarketplaceIntegration(chatId,supplierOrganizationId,session)},req);}

async function handleSupplierNetworkDiscovery(req,res,chatId){
  const tenant=await getTenant(chatId); if(!tenant)return sendJSON(res,404,{error:{message:'Unknown store',status:404}},req);
  const session=await requireSession(req,tenant.chatId);
  if(req.method!=='GET' && req.method!=='POST')return sendJSON(res,405,{error:{message:'Method not allowed',status:405}},req);
  await requireAuthorization(session,tenant,'supplier_network_discovery','supplier-network:discovery:discover',{deniedMessage:'Supplier network discovery permission required'});
  const input=req.method==='POST'?await readBody(req):Object.fromEntries(new URL(req.url,`http://${req.headers.host}`).searchParams.entries());
  const results=await discoverSupplierNetwork(chatId,input,session);
  return sendJSON(res,200,{results,deterministic:true,ai:false},req);
}

async function handleSupplierNetworkTrust(req,res,chatId,supplierOrganizationId=null,action=null){
  const tenant=await getTenant(chatId); if(!tenant)return sendJSON(res,404,{error:{message:'Unknown store',status:404}},req); const session=await requireSession(req,tenant.chatId);
  if(req.method==='GET'){await requireAuthorization(session,tenant,'supplier_network_trust','supplier-network:trust:view',{deniedMessage:'Supplier network trust view permission required'}); if(supplierOrganizationId){const evidence=await listSupplierNetworkTrustEvidence(chatId,{supplierOrganizationId,limit:500},session);return sendJSON(res,200,{evidence},req)} const u=new URL(req.url,`http://${req.headers.host}`);return sendJSON(res,200,{evidence:await listSupplierNetworkTrustEvidence(chatId,{supplierOrganizationId:u.searchParams.get('supplierOrganizationId')||'',evidenceType:u.searchParams.get('evidenceType')||'',limit:u.searchParams.get('limit')||100},session)},req)}
  if(req.method==='POST'&&action==='refresh'){await requireAuthorization(session,tenant,'supplier_network_trust','supplier-network:trust:refresh',{deniedMessage:'Supplier network trust refresh permission required'});const body=await readBody(req);const supplierId=String(supplierOrganizationId||body.supplierOrganizationId||body.supplier_organization_id||'').trim();if(!supplierId)return sendJSON(res,400,{error:{message:'supplierOrganizationId is required',status:400}},req);return sendJSON(res,200,{evidence:await refreshSupplierNetworkTrustEvidence(chatId,supplierId,body,session)},req)}
  return sendJSON(res,405,{error:{message:'Method not allowed',status:405}},req);
}

async function handleSupplierNetworkPerformance(req,res,chatId,supplierOrganizationId=null,action=null){
  const tenant=await getTenant(chatId); if(!tenant)return sendJSON(res,404,{error:{message:'Unknown store',status:404}},req); const session=await requireSession(req,tenant.chatId);
  if(req.method==='GET'){await requireAuthorization(session,tenant,'supplier_network_performance','supplier-network:performance:view',{deniedMessage:'Supplier network performance view permission required'}); if(supplierOrganizationId){const observation=await getSupplierNetworkPerformance(chatId,supplierOrganizationId,session);if(!observation)return sendJSON(res,404,{error:{message:'Supplier network performance observation not found',status:404}},req);return sendJSON(res,200,{observation},req)} const u=new URL(req.url,`http://${req.headers.host}`);return sendJSON(res,200,{observations:await listSupplierNetworkPerformance(chatId,{supplierOrganizationId:u.searchParams.get('supplierOrganizationId')||'',metricType:u.searchParams.get('metricType')||'',limit:u.searchParams.get('limit')||100},session)},req)}
  if(req.method==='POST'&&action==='recalculate'){await requireAuthorization(session,tenant,'supplier_network_performance','supplier-network:performance:recalculate',{deniedMessage:'Supplier network performance recalculation permission required'});const body=await readBody(req);const supplierId=String(supplierOrganizationId||body.supplierOrganizationId||body.supplier_organization_id||'').trim();if(!supplierId)return sendJSON(res,400,{error:{message:'supplierOrganizationId is required',status:400}},req);return sendJSON(res,200,{observations:await recalculateSupplierNetworkPerformance(chatId,supplierId,body,session)},req)}
  return sendJSON(res,405,{error:{message:'Method not allowed',status:405}},req);
}

async function handleSupplierNetworkProfile(req, res, chatId, action = null) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  if (req.method === 'GET') {
    await requireAuthorization(session, tenant, 'supplier_network_profile', 'supplier-network:view', { deniedMessage: 'Supplier network profile view permission required' });
    return sendJSON(res, 200, { profile: await getSupplierNetworkProfile(chatId) }, req);
  }
  if (req.method === 'POST' && action) {
    const permission = action === 'publish' ? 'supplier-network:publish' : action === 'suspend' ? 'supplier-network:suspend' : action === 'draft' ? 'supplier-network:manage' : null;
    if (!permission) return sendJSON(res, 404, { error: { message: 'Unknown supplier network profile action', status: 404 } }, req);
    await requireAuthorization(session, tenant, 'supplier_network_profile', permission, { deniedMessage: 'Supplier network profile action permission required' });
    const target = action === 'publish' ? 'PUBLISHED' : action === 'suspend' ? 'SUSPENDED' : 'DRAFT';
    return sendJSON(res, 200, { profile: await transitionSupplierNetworkProfile(chatId, target, session) }, req);
  }
  if (req.method === 'POST' || req.method === 'PATCH') {
    const body = await readBody(req);
    const actionName = String(body.status || '').toUpperCase() === 'PUBLISHED' ? 'supplier-network:publish'
      : String(body.status || '').toUpperCase() === 'SUSPENDED' ? 'supplier-network:suspend'
      : 'supplier-network:manage';
    await requireAuthorization(session, tenant, 'supplier_network_profile', actionName, { deniedMessage: 'Supplier network profile permission required' });
    return sendJSON(res, 200, { profile: await upsertSupplierNetworkProfile(chatId, body, session) }, req);
  }
  return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);
}

async function handleProcurementDemands(req, res, chatId, demandId = null, action = null) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);

  if (req.method === 'GET') {
    await requireAuthorization(session, tenant, 'procurement_demand', 'procurement:demand:view', { deniedMessage: 'Procurement demand view permission required' });
    if (demandId) {
      const demand = await getProcurementDemand(chatId, demandId);
      if (!demand) return sendJSON(res, 404, { error: { message: 'Procurement demand not found', status: 404 } }, req);
      return sendJSON(res, 200, { demand }, req);
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const demands = await listProcurementDemands(chatId, {
      status: url.searchParams.get('status') || 'all',
      requesterId: url.searchParams.get('requester_id') || '',
      limit: Number(url.searchParams.get('limit') || 100),
    });
    return sendJSON(res, 200, { demands }, req);
  }

  if (req.method === 'POST' && !demandId) {
    await requireAuthorization(session, tenant, 'procurement_demand', 'procurement:demand:create', { deniedMessage: 'Procurement demand creation permission required' });
    const body = await readBody(req);
    const demand = await createProcurementDemand(chatId, body, session);
    return sendJSON(res, 201, { demand }, req);
  }

  if (!demandId) return sendJSON(res, 400, { error: { message: 'Procurement demand id is required', status: 400 } }, req);

  if (req.method === 'PATCH' && !action) {
    await requireAuthorization(session, tenant, 'procurement_demand', 'procurement:demand:manage', { deniedMessage: 'Procurement demand management permission required' });
    const body = await readBody(req);
    const demand = await updateProcurementDemand(chatId, demandId, body, session);
    return sendJSON(res, 200, { demand }, req);
  }

  if (req.method === 'POST' && action) {
    const permission = action === 'submit' ? 'procurement:demand:submit'
      : action === 'cancel' ? 'procurement:demand:cancel'
      : action === 'start-sourcing' ? 'procurement:demand:sourcing'
      : null;
    if (!permission) return sendJSON(res, 404, { error: { message: 'Unknown procurement demand action', status: 404 } }, req);
    await requireAuthorization(session, tenant, 'procurement_demand', permission, { deniedMessage: 'Procurement demand action permission required' });
    const body = await readBody(req).catch(() => ({}));
    const target = action === 'submit' ? 'SUBMITTED' : action === 'cancel' ? 'CANCELLED' : 'SOURCING';
    const demand = await transitionProcurementDemand(chatId, demandId, target, session, body.reason || '');
    return sendJSON(res, 200, { demand }, req);
  }

  return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);
}


async function handleProcurementRfqs(req, res, chatId, rfqId = null, action = null) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  if (req.method === 'GET') {
    await requireAuthorization(session, tenant, 'procurement_rfq', 'procurement:rfq:view', { deniedMessage: 'Procurement RFQ view permission required' });
    if (rfqId) {
      const rfqs = await listProcurementRfqs(chatId, { demandId: '' }, session);
      const rfq = rfqs.find(item => item.id === rfqId);
      if (!rfq) return sendJSON(res, 404, { error: { message: 'Procurement RFQ not found', status: 404 } }, req);
      return sendJSON(res, 200, { rfq }, req);
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const rfqs = await listProcurementRfqs(chatId, {
      status: url.searchParams.get('status') || 'all',
      demandId: url.searchParams.get('demand_id') || '',
      limit: Number(url.searchParams.get('limit') || 100),
    }, session);
    return sendJSON(res, 200, { rfqs }, req);
  }
  if (req.method === 'POST' && !rfqId) {
    await requireAuthorization(session, tenant, 'procurement_rfq', 'procurement:rfq:create', { deniedMessage: 'Procurement RFQ creation permission required' });
    return sendJSON(res, 201, { rfq: await createProcurementRfq(chatId, await readBody(req), session) }, req);
  }
  if (!rfqId) return sendJSON(res, 400, { error: { message: 'RFQ id is required', status: 400 } }, req);
  if (req.method === 'POST' && action) {
    const permission = action === 'send' ? 'procurement:rfq:send' : action === 'close' ? 'procurement:rfq:close' : action === 'cancel' ? 'procurement:rfq:manage' : null;
    if (!permission) return sendJSON(res, 404, { error: { message: 'Unknown procurement RFQ action', status: 404 } }, req);
    await requireAuthorization(session, tenant, 'procurement_rfq', permission, { deniedMessage: 'Procurement RFQ action permission required' });
    const target = action === 'send' ? 'SENT' : action === 'close' ? 'CLOSED' : 'CANCELLED';
    const body = await readBody(req).catch(() => ({}));
    return sendJSON(res, 200, { rfq: await transitionProcurementRfq(chatId, rfqId, target, session, body.reason || '') }, req);
  }
  return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);
}

async function handleProcurementRfqResponses(req, res, chatId, rfqId, responseId = null, action = null) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  if (req.method === 'POST' && !responseId) {
    await requireAuthorization(session, tenant, 'procurement_rfq', 'procurement:rfq:respond', { deniedMessage: 'Procurement RFQ response permission required' });
    return sendJSON(res, 201, { response: await createProcurementRfqResponse(chatId, rfqId, await readBody(req), session) }, req);
  }
  if (req.method === 'POST' && responseId && action === 'submit') {
    await requireAuthorization(session, tenant, 'procurement_rfq', 'procurement:rfq:respond', { deniedMessage: 'Procurement RFQ response permission required' });
    return sendJSON(res, 200, { response: await transitionProcurementRfqResponse(chatId, responseId, 'SUBMITTED', session, (await readBody(req).catch(() => ({}))).reason || '') }, req);
  }
  return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);
}

async function handleProcurementSupplierRelationships(req, res, chatId, relationshipId = null, action = null) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  if (req.method === 'GET') {
    await requireAuthorization(session, tenant, 'procurement_supplier_relationship', 'procurement:supplier:relationship:view', { deniedMessage: 'Supplier relationship view permission required' });
    const url = new URL(req.url, `http://${req.headers.host}`);
    return sendJSON(res, 200, { relationships: await listProcurementSupplierRelationships(chatId, { direction: url.searchParams.get('direction') || 'buyer', status: url.searchParams.get('status') || 'all', limit: Number(url.searchParams.get('limit') || 100) }, session) }, req);
  }
  if (req.method === 'POST' && !relationshipId) {
    await requireAuthorization(session, tenant, 'procurement_supplier_relationship', 'procurement:supplier:relationship:manage', { deniedMessage: 'Supplier relationship management permission required' });
    return sendJSON(res, 201, { relationship: await createProcurementSupplierRelationship(chatId, await readBody(req), session) }, req);
  }
  if (req.method === 'POST' && relationshipId && action) {
    await requireAuthorization(session, tenant, 'procurement_supplier_relationship', 'procurement:supplier:relationship:manage', { deniedMessage: 'Supplier relationship management permission required' });
    const body = await readBody(req).catch(() => ({}));
    return sendJSON(res, 200, { relationship: await transitionProcurementSupplierRelationship(chatId, relationshipId, String(action).toUpperCase(), session, body.reason || '') }, req);
  }
  return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);
}


async function handleProcurementAwards(req, res, chatId, awardId = null, action = null) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  if (req.method === 'GET') {
    await requireAuthorization(session, tenant, 'procurement_award', 'procurement:award:view', { deniedMessage: 'Procurement award view permission required' });
    if (awardId) {
      const award = await getProcurementAward(chatId, awardId, session);
      if (!award) return sendJSON(res, 404, { error: { message: 'Procurement award not found', status: 404 } }, req);
      return sendJSON(res, 200, { award }, req);
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const awards = await listProcurementAwards(chatId, { demandId: url.searchParams.get('demand_id') || '', rfqId: url.searchParams.get('rfq_id') || '', status: url.searchParams.get('status') || 'all', limit: Number(url.searchParams.get('limit') || 100) }, session);
    return sendJSON(res, 200, { awards }, req);
  }
  if (req.method === 'POST' && !awardId) {
    await requireAuthorization(session, tenant, 'procurement_award', 'procurement:award:create', { deniedMessage: 'Procurement award creation permission required' });
    const body = await readBody(req);
    const award = await createProcurementAward(chatId, body, session);
    return sendJSON(res, 201, { award }, req);
  }
  if (!awardId) return sendJSON(res, 400, { error: { message: 'Procurement award id is required', status: 400 } }, req);
  if (req.method === 'POST' && action) {
    const permission = action === 'confirm' ? 'procurement:award:confirm' : action === 'cancel' ? 'procurement:award:cancel' : null;
    if (!permission) return sendJSON(res, 404, { error: { message: 'Unknown procurement award action', status: 404 } }, req);
    await requireAuthorization(session, tenant, 'procurement_award', permission, { deniedMessage: 'Procurement award action permission required' });
    const body = await readBody(req).catch(() => ({}));
    const target = action === 'confirm' ? 'CONFIRMED' : 'CANCELLED';
    const award = await transitionProcurementAward(chatId, awardId, target, session, body.reason || '');
    return sendJSON(res, 200, { award }, req);
  }
  return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);
}

async function handleProcurementComparisons(req, res, chatId, comparisonId = null) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'procurement_comparison', req.method === 'GET' ? 'procurement:comparison:view' : 'procurement:comparison:create', { deniedMessage: 'Procurement comparison permission required' });
  if (req.method === 'GET') {
    if (comparisonId) {
      const comparison = await getProcurementComparison(chatId, comparisonId, session);
      if (!comparison) return sendJSON(res, 404, { error: { message: 'Procurement comparison not found', status: 404 } }, req);
      return sendJSON(res, 200, { comparison }, req);
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const comparisons = await listProcurementComparisons(chatId, { rfqId: url.searchParams.get('rfq_id') || '', limit: Number(url.searchParams.get('limit') || 100) }, session);
    return sendJSON(res, 200, { comparisons }, req);
  }
  if (req.method === 'POST' && comparisonId) return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);
  if (req.method === 'POST') {
    const body = await readBody(req);
    const rfqId = body.rfqId ?? body.rfq_id;
    if (!rfqId) return sendJSON(res, 400, { error: { message: 'rfqId is required', status: 400 } }, req);
    const comparison = await createProcurementComparison(chatId, rfqId, session);
    return sendJSON(res, 201, { comparison }, req);
  }
  return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);
}

async function handleB2BQuotes(req, res, chatId, quoteId = null) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  const action = req.method === 'GET' ? 'b2b:quotes:view' : 'b2b:quotes:manage';
  await requireAuthorization(session, tenant, 'b2b_quotes', action, { deniedMessage: 'B2B quote permission required' });
  if (req.method === 'GET') {
    if (quoteId) {
      const quote = await getQuote(chatId, quoteId);
      if (!quote) return sendJSON(res, 404, { error: { message: 'Quote not found', status: 404 } }, req);
      return sendJSON(res, 200, { quote }, req);
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const quotes = await listQuotes(chatId, { customerId: url.searchParams.get('customer_id') || '', status: url.searchParams.get('status') || 'all', limit: Number(url.searchParams.get('limit') || 100) });
    return sendJSON(res, 200, { quotes }, req);
  }
  const body = await readBody(req);
  if (req.method === 'POST') {
    const quote = await createQuote(chatId, body, session);
    return sendJSON(res, 201, { quote }, req);
  }
  const target = body.status ?? body.state;
  if (!target) return sendJSON(res, 400, { error: { message: 'status is required', status: 400 } }, req);
  const quote = await transitionQuote(chatId, quoteId, target, session, body.reason || '');
  return sendJSON(res, 200, { quote }, req);
}

async function handleB2BPurchaseOrders(req, res, chatId, poId = null) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  if (req.method === 'GET') {
    await requireAuthorization(session, tenant, 'b2b_purchase_orders', 'b2b:po:view', { deniedMessage: 'B2B purchase-order view permission required' });
    if (poId) {
      const purchaseOrder = await getPurchaseOrder(chatId, poId);
      if (!purchaseOrder) return sendJSON(res, 404, { error: { message: 'Purchase order not found', status: 404 } }, req);
      return sendJSON(res, 200, { purchaseOrder }, req);
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const purchaseOrders = await listPurchaseOrders(chatId, { customerId: url.searchParams.get('customer_id') || '', status: url.searchParams.get('status') || 'all', limit: Number(url.searchParams.get('limit') || 100) });
    return sendJSON(res, 200, { purchaseOrders }, req);
  }
  const body = await readBody(req);
  if (req.method === 'POST') {
    await requireAuthorization(session, tenant, 'b2b_purchase_orders', 'b2b:po:create', { deniedMessage: 'B2B purchase-order creation permission required' });
    if (String(body.sourceType ?? body.source_type ?? '').toUpperCase() === 'PROCUREMENT_AWARD') {
      await requireAuthorization(session, tenant, 'procurement_execution', 'procurement:award:execute', { deniedMessage: 'Procurement award execution permission required' });
    }
    const purchaseOrder = await createPurchaseOrder(chatId, body, session);
    return sendJSON(res, 201, { purchaseOrder }, req);
  }
  if (!poId) return sendJSON(res, 400, { error: { message: 'Purchase order id is required', status: 400 } }, req);
  const target = String(body.status ?? body.state ?? '').toUpperCase();
  if (!target) return sendJSON(res, 400, { error: { message: 'status is required', status: 400 } }, req);
  const permission = ['APPROVED', 'REJECTED'].includes(target) ? 'b2b:po:approve' : 'b2b:po:create';
  await requireAuthorization(session, tenant, 'b2b_purchase_orders', permission, { deniedMessage: 'B2B purchase-order approval permission required' });
  const purchaseOrder = await transitionPurchaseOrder(chatId, poId, target, session, body.reason || '');
  return sendJSON(res, 200, { purchaseOrder }, req);
}

async function handleProcurementReceipts(req, res, chatId, receiptId = null, purchaseOrderId = null) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  if (req.method === 'GET') {
    await requireAuthorization(session, tenant, 'procurement_receipt', 'procurement:receipt:view', { deniedMessage: 'Procurement receipt view permission required' });
    if (receiptId) {
      const receipt = await getProcurementReceipt(chatId, receiptId, session);
      if (!receipt) return sendJSON(res, 404, { error: { message: 'Procurement receipt not found', status: 404 } }, req);
      return sendJSON(res, 200, { receipt }, req);
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const receipts = await listProcurementReceipts(chatId, {
      purchaseOrderId: purchaseOrderId || url.searchParams.get('purchase_order_id') || '',
      status: url.searchParams.get('status') || 'all',
      limit: Number(url.searchParams.get('limit') || 100),
    }, session);
    return sendJSON(res, 200, { receipts }, req);
  }
  if (req.method === 'POST' && purchaseOrderId && !receiptId) {
    await requireAuthorization(session, tenant, 'procurement_receipt', 'procurement:receipt:create', { deniedMessage: 'Procurement receipt creation permission required' });
    const body = await readBody(req);
    const receipt = await createProcurementReceipt(chatId, purchaseOrderId, body, session);
    return sendJSON(res, 201, { receipt }, req);
  }
  return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);
}

async function handleB2BCreditTerms(req, res, chatId, creditId = null) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  const action = req.method === 'GET' ? 'b2b:credit:view' : (creditId && req.method === 'PATCH' ? 'b2b:credit:manage' : 'b2b:credit:create');
  await requireAuthorization(session, tenant, 'b2b_credit_terms', action, { deniedMessage: 'B2B credit-terms permission required' });
  if (req.method === 'GET') {
    if (creditId) {
      const creditTerms = await getCreditTerms(chatId, creditId);
      if (!creditTerms) return sendJSON(res, 404, { error: { message: 'Credit terms not found', status: 404 } }, req);
      return sendJSON(res, 200, { creditTerms }, req);
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const creditTerms = await listCreditTerms(chatId, { customerId: url.searchParams.get('customer_id') || '', status: url.searchParams.get('status') || 'all', limit: Number(url.searchParams.get('limit') || 100) });
    return sendJSON(res, 200, { creditTerms }, req);
  }
  const body = await readBody(req);
  if (req.method === 'POST') {
    const creditTerms = await createCreditTerms(chatId, body, session);
    return sendJSON(res, 201, { creditTerms }, req);
  }
  if (!creditId) return sendJSON(res, 400, { error: { message: 'Credit terms id is required', status: 400 } }, req);
  const target = String(body.status ?? body.state ?? '').toUpperCase();
  if (target) {
    const permission = ['APPROVED','REJECTED','SUSPENDED'].includes(target) ? 'b2b:credit:approve' : 'b2b:credit:manage';
    await requireAuthorization(session, tenant, 'b2b_credit_terms', permission, { deniedMessage: 'B2B credit-terms approval permission required' });
    const creditTerms = await transitionCreditTerms(chatId, creditId, target, session, body.reason || '');
    return sendJSON(res, 200, { creditTerms }, req);
  }
  const creditTerms = await updateCreditTerms(chatId, creditId, body, session);
  return sendJSON(res, 200, { creditTerms }, req);
}

async function handleInventoryMovementsList(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'inventory', 'inventory:view', { deniedMessage: 'Inventory view permission required' });
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedLocationId = url.searchParams.get('location_id') || '';
  if (requestedLocationId) {
    const location = await getOrganizationLocation(chatId, requestedLocationId);
    if (!location) throw Object.assign(new Error('Location does not belong to this organization'), { statusCode: 403, code: 'LOCATION_SCOPE_DENIED' });
    assertLocationScope(session, tenant, location);
  }
  const movements = await listInventoryMovements(chatId, {
    productId: url.searchParams.get('product_id') || '',
    locationId: requestedLocationId,
    limit: Number(url.searchParams.get('limit') || 100),
  });
  sendJSON(res, 200, { movements }, req);
}

async function handleInventoryBalances(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'inventory', 'inventory:view', { deniedMessage: 'Inventory view permission required' });
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedLocationId = url.searchParams.get('location_id') || '';
  if (requestedLocationId) {
    const location = await getOrganizationLocation(chatId, requestedLocationId);
    if (!location) throw Object.assign(new Error('Location does not belong to this organization'), { statusCode: 403, code: 'LOCATION_SCOPE_DENIED' });
    assertLocationScope(session, tenant, location);
  }
  const balances = await getInventoryBalances(chatId, { locationId: requestedLocationId });
  sendJSON(res, 200, { balances }, req);
}

async function handleInventoryMovementCreate(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'inventory', 'inventory:edit', { deniedMessage: 'Inventory edit permission required' });
  const body = await readBody(req);
  if (body.locationId || body.location_id) {
    const location = await getOrganizationLocation(chatId, body.locationId || body.location_id);
    if (!location) throw Object.assign(new Error('Location does not belong to this organization'), { statusCode: 403, code: 'LOCATION_SCOPE_DENIED' });
    assertLocationScope(session, tenant, location);
  }
  const movement = await appendInventoryMovement(chatId, body, session);
  sendJSON(res, 201, { movement }, req);
}

async function handleLocationsList(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'locations', 'locations:view', { deniedMessage: 'Location view permission required' });
  const url = new URL(req.url, `http://${req.headers.host}`);
  const locations = await listOrganizationLocations(chatId, { includeInactive: url.searchParams.get('include_inactive') === 'true' });
  sendJSON(res, 200, { locations }, req);
}

async function handleLocationCreate(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'locations', 'locations:manage', { deniedMessage: 'Location management permission required' });
  const body = await readBody(req);
  const location = await createOrganizationLocation(chatId, body);
  sendJSON(res, 201, { location }, req);
}

async function handleLocationPatch(req, res, chatId, locationId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'locations', 'locations:manage', { deniedMessage: 'Location management permission required' });
  const body = await readBody(req);
  const location = await updateOrganizationLocation(chatId, locationId, body);
  sendJSON(res, 200, { location }, req);
}

async function handleAuthorizationScopeContext(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  if (req.method !== 'GET') return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);

  const locationView = (() => {
    try { return requireAuthorization(session, tenant, 'scope_context', 'locations:view', { deniedMessage: 'Location scope view permission required' }); }
    catch (error) { throw error; }
  })();
  await locationView;

  const locations = await listOrganizationLocations(chatId, { includeInactive: true });
  const canManageLocations = (() => {
    try { authorize(session, tenant, null, 'scope_context', 'locations:manage'); return true; }
    catch (_) { return false; }
  })();

  const currentLocationId = session.locationId || null;
  const currentLocation = currentLocationId
    ? locations.find(location => String(location.id) === String(currentLocationId)) || null
    : null;

  sendJSON(res, 200, {
    authority: 'backend/lib/authorization.js + existing locations.organization_id',
    organization: { id: tenant.organizationId || tenant.organization_id || null },
    actor: { id: session.userId || null, role: session.role || null },
    context: { locationId: currentLocationId, location: currentLocation },
    locations,
    capabilities: {
      viewLocations: true,
      manageLocations: canManageLocations,
      selectLocation: true,
    },
    uiIsNotAuthorization: true,
  }, req);
}

async function handleAuthorizationConditionsContract(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'authorization_conditions_contract', 'settings:configure', {
    deniedMessage: 'Conditions and approval boundary access denied',
  });
  if (req.method !== 'GET') return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);

  const { verticalCapabilityAuthorizationContract } = await import('./lib/vertical-capability-authorization.js');
  const { verticalMutationEnforcementContract } = await import('./lib/vertical-mutation-enforcement.js');
  const { verticalApprovalBoundaryContract } = await import('./lib/vertical-approval-boundary.js');

  sendJSON(res, 200, {
    authority: 'backend/lib/authorization.js',
    decisionVocabulary: Object.values(AUTHZ),
    conditionModel: [
      { id: 'tenant_location_scope', status: 'ENFORCED', authority: 'backend/lib/tenant-isolation.js' },
      { id: 'capability_policy', status: 'ENFORCED', authority: 'backend/lib/resource-action-registry.js + backend/lib/authorization.js' },
      { id: 'resource_action_policy', status: 'ENFORCED', authority: 'backend/lib/authorization.js' },
      { id: 'approval_boundary', status: 'BOUNDARY_ONLY', authority: 'backend/lib/vertical-approval-boundary.js' },
    ],
    approval: verticalApprovalBoundaryContract(),
    capability: verticalCapabilityAuthorizationContract(),
    mutation: verticalMutationEnforcementContract(),
    uiIsNotAuthorization: true,
  }, req);
}

async function handleAuthorizationRoleMatrix(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'authorization_role_matrix', 'settings:configure', {
    deniedMessage: 'Role and permission matrix access denied',
  });
  if (req.method !== 'GET') return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);

  const scopeModel = [
    { id: 'organization', label: 'Organization', required: true, description: 'The authenticated tenant/organization boundary.' },
    { id: 'location', label: 'Location', required: false, description: 'Optional location context; the canonical policy verifies organization ownership when supplied.' },
    { id: 'resource', label: 'Resource', required: true, description: 'The canonical business resource being acted on.' },
    { id: 'conditions', label: 'Conditions', required: false, description: 'Resource-specific conditions and approval rules enforced by the canonical server path.' },
  ];

  const roles = ROLES.map(role => ({
    id: role,
    permissions: getRolePermissions(role),
    scope: scopeModel,
    enforcement: 'canonical server authorization',
  }));

  sendJSON(res, 200, {
    roles,
    scopeModel,
    authority: 'backend/lib/authorization.js',
    uiIsNotAuthorization: true,
  }, req);
}

async function handleAuthorizationIamCertification(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'authorization_iam_certification', 'settings:configure', {
    deniedMessage: 'IAM certification access denied',
  });
  if (req.method !== 'GET') return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);

  const { getRolePermissions, ROLES } = await import('./lib/authorization.js');
  const { RESOURCE_ACTION_REGISTRY } = await import('./lib/resource-action-registry.js');
  const policyDefinedPacks = new Set(RESOURCE_ACTION_REGISTRY.filter(entry => entry.policyDefined).map(entry => entry.packId));
  const roleMap = new Map([
    ['Owner', 'owner'], ['Manager', 'manager'], ['Cashier', 'cashier'], ['Staff', 'staff'], ['Buyer', 'buyer'], ['Viewer', 'viewer'],
    ['Store Owner', 'owner'], ['Store Manager', 'manager'], ['Procurement Manager', 'manager'], ['Buyer/Requester', 'buyer'], ['Buyer Network User', 'buyer'], ['Farm/Operations Manager', 'manager'],
  ]);

  const rows = [
    ['Core organization', 'Owner'], ['Core organization', 'Admin'], ['Core organization', 'Manager'], ['Core organization', 'Staff'], ['Core organization', 'Viewer'],
    ['Restaurant', 'Owner'], ['Restaurant', 'Manager'], ['Restaurant', 'Waiter / FOH'], ['Restaurant', 'Chef / Kitchen Staff'], ['Restaurant', 'Viewer'],
    ['Retail / POS', 'Store Owner'], ['Retail / POS', 'Store Manager'], ['Retail / POS', 'Cashier'], ['Retail / POS', 'Stock Staff'], ['Retail / POS', 'Viewer'],
    ['Warehouse', 'Warehouse Manager'], ['Warehouse', 'Receiving'], ['Warehouse', 'Picker/Packer'], ['Warehouse', 'Inventory Staff'], ['Warehouse', 'Viewer'],
    ['Logistics', 'Logistics Manager'], ['Logistics', 'Dispatcher/Coordinator'], ['Logistics', 'Courier'], ['Logistics', 'Viewer'],
    ['Agriculture', 'Farm/Operations Manager'], ['Agriculture', 'Field Staff'], ['Agriculture', 'Buyer'], ['Agriculture', 'Viewer'],
    ['Procurement', 'Procurement Manager'], ['Procurement', 'Buyer/Requester'], ['Procurement', 'Approver'], ['Procurement', 'Viewer'],
    ['Supplier Network', 'Supplier Admin'], ['Supplier Network', 'Supplier Staff'], ['Supplier Network', 'Buyer Network User'], ['Supplier Network', 'Viewer'],
    ['Marketplace', 'Seller Admin'], ['Marketplace', 'Seller Staff'], ['Marketplace', 'Buyer'],
  ].map(([pack, role]) => {
    const canonicalRole = roleMap.get(role) || null;
    const status = canonicalRole ? 'MAP' : (role === 'Admin' ? 'NEW' : 'EXTEND');
    const packKey = pack.toLowerCase().replace(/\s*\/\s*pos/i, '').replace(/\s+/g, '-');
    const permissionEvidence = canonicalRole
      ? `${canonicalRole}: ${getRolePermissions(canonicalRole).length} canonical permission entries`
      : (policyDefinedPacks.has(packKey) ? 'Pack capability vocabulary exists; no distinct role policy established.' : 'No distinct canonical role/permission policy established.');
    const scope = 'Organization required; location optional; resource required; conditions resource-specific.';
    const conditionsApproval = 'Canonical conditions/approval boundary applies where the mutation requires it; approval evidence is status + approvedBy + approvedAt; no local approval store.';
    const uiAffordance = canonicalRole ? 'Role/access, scope/context, conditions, approval UX and business workflows expose applicable affordances.' : 'Product-model metadata only; no executable assignment affordance.';
    const serverEnforcement = canonicalRole ? 'backend/lib/authorization.js authorize() + canonical business mutation gates' : 'Not executable until deliberate canonical policy/enforcement is added.';
    const auditEvent = canonicalRole ? 'Existing audit/event paths remain authoritative; role assignment/approval evidence is not inferred by UI.' : 'No new role audit/event authority created.';
    return { pack, role, status, canonicalRole, permissionEvidence, scope, conditionsApproval, uiAffordance, serverEnforcement, auditEvent };
  });

  sendJSON(res, 200, {
    rows,
    canonicalRoles: ROLES,
    authority: 'backend/lib/authorization.js',
    persistence: 'existing canonical stores only',
    evaluator: 'backend/lib/authorization.js authorize()',
    membershipRoleChangeGap: 'CERTIFIED: generic membership role changes use POST /auth/membership-role, canonical membership:role:manage authorization, tenant-scoped store enforcement, role-boundary protections, last-owner protection, and membership.role_changed audit events.',
    policyDefinedPacks: [...policyDefinedPacks],
    uiIsNotAuthorization: true,
  }, req);
}

async function handleTenantPatch(req, res, chatId) {
  const body = await readBody(req);
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireOwnerRole(session);

  const patch = {};
  if (typeof body.sellerName === 'string') patch.sellerName = body.sellerName;
  if (body.branding && typeof body.branding === 'object') {
    const branding = body.branding;
    const allowed = ['business_name', 'primary_color', 'logo_url'];
    const clean = {};
    for (const key of allowed) {
      if (branding[key] == null || branding[key] === '') continue;
      if (typeof branding[key] !== 'string') {
        throw Object.assign(new Error(`branding.${key} must be a string`), { statusCode: 400 });
      }
      clean[key] = branding[key].trim();
    }
    if (clean.business_name && (clean.business_name.length < 1 || clean.business_name.length > 120)) {
      throw Object.assign(new Error('Brand name must be 1–120 characters'), { statusCode: 400 });
    }
    if (clean.primary_color && !/^#[0-9a-fA-F]{6}$/.test(clean.primary_color)) {
      throw Object.assign(new Error('Primary color must be a 6-digit hex color'), { statusCode: 400 });
    }
    if (clean.logo_url) {
      let parsed;
      try { parsed = new URL(clean.logo_url); } catch {
        throw Object.assign(new Error('Logo URL must be a valid URL'), { statusCode: 400 });
      }
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        throw Object.assign(new Error('Logo URL must use http or https'), { statusCode: 400 });
      }
      if (clean.logo_url.length > 2048) {
        throw Object.assign(new Error('Logo URL is too long'), { statusCode: 400 });
      }
    }
    patch.branding = clean;
  }
  // Phase 2: lets a seller pick their own marketplace vendor code (shown
  // to buyers as e.g. "Blue Nile Coffee Roasters (SC1001)") instead of
  // being stuck with the auto-generated one derived from their chatId.
  if (typeof body.vendorCode === 'string' && body.vendorCode.trim()) patch.vendorCode = body.vendorCode.trim();

  const updated = await updateTenant(chatId, patch);
  sendJSON(res, 200, { tenant: updated }, req);
}


async function handlePaymentProviderNotification(req, res, providerId) {
  const provider = requirePaymentProvider(providerId);
  if (provider.capabilities?.authenticateNotification !== true) {
    throw Object.assign(new Error('Payment provider notification authentication is not configured'), {
      statusCode: 503, code: 'PAYMENT_NOTIFICATION_NOT_CONFIGURED',
    });
  }

  const rawBody = await readRawBody(req);
  let body = {};
  try {
    body = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {};
  } catch {
    throw Object.assign(new Error('Invalid provider notification payload'), {
      statusCode: 400, code: 'INVALID_PROVIDER_NOTIFICATION',
    });
  }

  const submitted = await paymentCore.ingestProviderNotification({
    providerId: provider.id,
    rawRequest: {
      body,
      rawBody,
      headers: req.headers,
      method: req.method,
      url: req.url,
    },
    requestContext: {
      requestId: req._requestId,
      remoteAddress: req.socket?.remoteAddress || null,
      providerAuthenticated: /^(1|true|yes)$/i.test(
        String(req.headers['x-sellify-provider-authenticated'] || '')
      ),
    },
    config: {},
  });

  const outcome = submitted.duplicate ? 'DUPLICATE' : 'RECEIVED';
  return sendJSON(res, submitted.duplicate ? 200 : 202, {
    accepted: true,
    notification_id: submitted.evidence?.providerNotificationId || null,
    evidence_id: submitted.evidence?.id || null,
    status: outcome,
    outcome_code: outcome,
  }, req);
}

async function handlePaymentProviderMetadata(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'payments', 'payments:view', { deniedMessage: 'Payment view permission required' });
  return sendJSON(res, 200, { providers: listPaymentProviders(), channels: listPaymentChannels() }, req);
}

async function handlePaymentAccounts(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  if (req.method === 'GET') {
    await requireAuthorization(session, tenant, 'payments', 'payments:view', { deniedMessage: 'Payment view permission required' });
    const url = new URL(req.url, `http://${req.headers.host}`);
    const accounts = await listPaymentAccounts(chatId, { status: url.searchParams.get('status') || 'active' });
    return sendJSON(res, 200, { accounts }, req);
  }
  await requireAuthorization(session, tenant, 'payments', 'payments:manage', { deniedMessage: 'Payment account management permission required' });
  const body = await readBody(req);
  const account = await createPaymentAccount(chatId, body, session);
  sendJSON(res, 201, { account }, req);
}

async function handlePayments(req, res, chatId, paymentId = null) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  if (req.method === 'GET') {
    await requireAuthorization(session, tenant, 'payments', 'payments:view', { deniedMessage: 'Payment view permission required' });
    if (paymentId) {
      const payment = await getPayment(chatId, paymentId);
      if (!payment) return sendJSON(res, 404, { error: { message: 'Payment not found', status: 404 } }, req);
      return sendJSON(res, 200, { payment }, req);
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const payments = await listPayments(chatId, { state: url.searchParams.get('state') || 'all', orderId: url.searchParams.get('order_id') || '', limit: Number(url.searchParams.get('limit') || 100) });
    return sendJSON(res, 200, { payments }, req);
  }
  if (req.method === 'POST') {
    await requireAuthorization(session, tenant, 'payments', 'payments:accept', { deniedMessage: 'Payment acceptance permission required' });
    const body = await readBody(req);
    const idempotencyKey = String(req.headers['idempotency-key'] || body.idempotencyKey || body.idempotency_key || '').trim();
    if (!idempotencyKey) return sendJSON(res, 400, { error: { message: 'Idempotency-Key is required', status: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' } }, req);
    const result = await paymentCore.createPayment({
      ...body,
      idempotencyKey,
      chatId,
      organizationId: tenant.organizationId,
      actor: session,
    });
    return sendJSON(res, 201, result, req);
  }
  if (req.method === 'PATCH' && paymentId) {
    const body = await readBody(req);
    const target = String(body.targetState || body.target_state || body.state || '').toUpperCase();
    if (!target) return sendJSON(res, 400, { error: { message: 'targetState is required', status: 400, code: 'PAYMENT_CONTEXT_REQUIRED' } }, req);
    if (['RECONCILED', 'VERIFIED'].includes(target)) {
      return sendJSON(res, 400, { error: { message: 'Use the canonical verification/reconciliation commands for this state', status: 400, code: 'PAYMENT_STATE_COMMAND_REQUIRED' } }, req);
    }
    const idempotencyKey = String(req.headers['idempotency-key'] || body.idempotencyKey || body.idempotency_key || '').trim();
    if (!idempotencyKey) return sendJSON(res, 400, { error: { message: 'Idempotency-Key is required', status: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' } }, req);
    const result = await paymentCore.transitionLifecycle({
      ...body,
      targetState: target,
      paymentId,
      idempotencyKey,
      chatId,
      organizationId: tenant.organizationId,
      actor: session,
    });
    return sendJSON(res, 200, result, req);
  }
  return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);
}

async function handlePaymentOutbound(req,res,chatId,intentId=null,action=null){const tenant=await getTenant(chatId);if(!tenant)return sendJSON(res,404,{error:{message:'Unknown store',status:404}},req);const session=await requireSession(req,tenant.chatId);if(req.method==='GET'){await requireAuthorization(session,tenant,'payments','payments:view',{deniedMessage:'Payment view permission required'});if(intentId){const intent=await getPaymentOutboundIntent(chatId,intentId);if(!intent)return sendJSON(res,404,{error:{message:'Outbound payment intent not found',status:404}},req);return sendJSON(res,200,{intent},req);}const u=new URL(req.url,`http://${req.headers.host}`);return sendJSON(res,200,{intents:await listPaymentOutboundIntents(chatId,{purchaseOrderId:u.searchParams.get('purchase_order_id')||'',state:u.searchParams.get('state')||'all',limit:Number(u.searchParams.get('limit')||100)})},req);}if(req.method==='POST'&&!intentId){await requireAuthorization(session,tenant,'payments','payments:outbound:create',{deniedMessage:'Outbound payment creation permission required'});return sendJSON(res,201,{intent:await createPaymentOutboundIntent(chatId,await readBody(req),session)},req);}if(req.method==='POST'&&intentId&&action){const permission=action==='confirm'?'payments:outbound:confirm':action==='submit'?'payments:outbound:submit':'payments:outbound:manage';await requireAuthorization(session,tenant,'payments',permission,{deniedMessage:'Outbound payment state-change permission required'});return sendJSON(res,200,{intent:await transitionPaymentOutboundIntent(chatId,intentId,action.toUpperCase(),session,await readBody(req))},req);}return sendJSON(res,405,{error:{message:'Method not allowed',status:405}},req);}
async function handleProcurementSettlement(req,res,chatId,purchaseOrderId=null){const tenant=await getTenant(chatId);if(!tenant)return sendJSON(res,404,{error:{message:'Unknown store',status:404}},req);const session=await requireSession(req,tenant.chatId);if(req.method==='GET'){await requireAuthorization(session,tenant,'payments','payments:settlement:view',{deniedMessage:'Payment settlement view permission required'});if(purchaseOrderId){const settlement=await getProcurementSettlement(chatId,purchaseOrderId);return sendJSON(res,200,{settlement,allocations:await listProcurementSettlementAllocations(chatId,purchaseOrderId)},req);}const u=new URL(req.url,`http://${req.headers.host}`);return sendJSON(res,200,{settlements:await listProcurementSettlements(chatId,{purchaseOrderId:u.searchParams.get('purchase_order_id')||'',status:u.searchParams.get('status')||'all',limit:Number(u.searchParams.get('limit')||100)})},req);}if(req.method==='POST'&&purchaseOrderId){await requireAuthorization(session,tenant,'payments','payments:settlement:allocate',{deniedMessage:'Payment settlement allocation permission required'});return sendJSON(res,201,{settlement:await allocateConfirmedOutboundPaymentToProcurementSettlement(chatId,purchaseOrderId,await readBody(req),session)},req);}return sendJSON(res,405,{error:{message:'Method not allowed',status:405}},req);}

async function handleProcurementPayment(req,res,chatId,purchaseOrderId){const tenant=await getTenant(chatId);if(!tenant)return sendJSON(res,404,{error:{message:'Unknown store',status:404}},req);const session=await requireSession(req,tenant.chatId);await requireAuthorization(session,tenant,'procurement_payment','procurement:payment:create',{deniedMessage:'Procurement payment permission required'});if(req.method!=='POST')return sendJSON(res,405,{error:{message:'Method not allowed',status:405}},req);return sendJSON(res,201,{intent:await createProcurementPaymentIntent(chatId,{...(await readBody(req)),purchaseOrderId},session)},req);}

async function handlePaymentLedger(req, res, chatId, paymentId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'payments', 'payments:view', { deniedMessage: 'Payment view permission required' });
  const ledger = await listPaymentLedger(chatId, paymentId);
  if (!ledger) return sendJSON(res, 404, { error: { message: 'Payment not found', status: 404 } }, req);
  sendJSON(res, 200, { ledger }, req);
}

async function handleOrderPaymentSummary(req, res, chatId, orderId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'payments', 'payments:view', { deniedMessage: 'Payment view permission required' });
  const summary = await paymentCore.getOrderPaymentSummary({ chatId, orderId, organizationId: tenant.organizationId, actor: session });
  return sendJSON(res, 200, { summary }, req);
}

async function handlePaymentRoutingResolve(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'payments', 'payments:view', { deniedMessage: 'Payment view permission required' });
  const body = await readBody(req);
  return sendJSON(res, 200, await paymentCore.resolveRouting({
    ...body, chatId, organizationId: tenant.organizationId, actor: session,
  }), req);
}

async function handlePaymentRoutingPolicies(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  if (req.method === 'GET') {
    return sendJSON(res, 200, { policies: await store.listPaymentRoutingPolicies(chatId, {
      channel: new URL(req.url, 'http://localhost').searchParams.get('channel'),
      locationId: new URL(req.url, 'http://localhost').searchParams.get('locationId'),
      activeOnly: true,
    }) }, req);
  }
  const body = await readBody(req);
  return sendJSON(res, 200, { policy: await store.upsertPaymentRoutingPolicy(chatId, body, session) }, req);
}

async function handlePaymentProviderCertification(req,res,chatId){
  const tenant=await getTenant(chatId);if(!tenant)return sendJSON(res,404,{error:{message:'Unknown store',status:404}},req);
  const session=await requireSession(req,tenant.chatId);
  if(req.method==='GET'){
    const providerId=new URL(req.url, 'http://localhost').searchParams.get('providerId');
    if(providerId)return sendJSON(res,200,await paymentCore.certifyProviderCapabilities({chatId,organizationId:tenant.organizationId,providerId,actor:session}),req);
    return sendJSON(res,200,await paymentCore.certifyAllProviders({chatId,organizationId:tenant.organizationId,actor:session}),req);
  }
  if(req.method==='POST'){
    const body=await readBody(req);
    return sendJSON(res,200,await paymentCore.certifyProviderCapability({...body,chatId,organizationId:tenant.organizationId,actor:session}),req);
  }
  return sendJSON(res,405,{error:{message:'Method not allowed',status:405}},req);
}
async function handlePaymentProviderCapabilityProbe(req,res,chatId){
  const tenant=await getTenant(chatId);if(!tenant)return sendJSON(res,404,{error:{message:'Unknown store',status:404}},req);
  const session=await requireSession(req,tenant.chatId);
  if(req.method!=='POST')return sendJSON(res,405,{error:{message:'Method not allowed',status:405}},req);
  const body=await readBody(req);
  return sendJSON(res,200,await paymentCore.probeProviderCapability({...body,chatId,organizationId:tenant.organizationId,actor:session}),req);
}
async function handlePaymentProviderCapabilityEvidence(req,res,chatId){
  const tenant=await getTenant(chatId);if(!tenant)return sendJSON(res,404,{error:{message:'Unknown store',status:404}},req);
  const session=await requireSession(req,tenant.chatId);
  if(req.method==='GET'){
    const query=new URL(req.url,'http://localhost').searchParams;
    return sendJSON(res,200,await paymentCore.listProviderCapabilityEvidence({
      chatId,organizationId:tenant.organizationId,providerId:query.get('providerId'),capability:query.get('capability'),
      certificationScope:query.get('scope'),actor:session,
    }),req);
  }
  if(req.method==='POST'){
    const body=await readBody(req);
    return sendJSON(res,200,await paymentCore.recordProviderCapabilityEvidence({
      ...body,chatId,organizationId:tenant.organizationId,actor:session,
    }),req);
  }
  return sendJSON(res,405,{error:{message:'Method not allowed',status:405}},req);
}


async function handlePaymentOperationalActions(req,res,chatId,paymentId){
  const tenant=await getTenant(chatId);if(!tenant)return sendJSON(res,404,{error:{message:'Unknown store',status:404}},req);
  const session=await requireSession(req,tenant.chatId);
  if(req.method==='GET')return sendJSON(res,200,await paymentCore.listOperationalActions({chatId,paymentId,organizationId:tenant.organizationId,actor:session}),req);
  if(req.method==='POST')return sendJSON(res,200,await paymentCore.recordOperationalAction({...await readBody(req),chatId,paymentId,organizationId:tenant.organizationId,actor:session}),req);
  return sendJSON(res,405,{error:{message:'Method not allowed',status:405}},req);
}
async function handlePaymentOperationalRetry(req,res,chatId,paymentId){
  const tenant=await getTenant(chatId);if(!tenant)return sendJSON(res,404,{error:{message:'Unknown store',status:404}},req);
  const session=await requireSession(req,tenant.chatId);
  return sendJSON(res,200,await paymentCore.retryOperationalAction({...await readBody(req),chatId,paymentId,organizationId:tenant.organizationId,actor:session}),req);
}
async function handlePaymentManualReview(req,res,chatId,paymentId){
  const tenant=await getTenant(chatId);if(!tenant)return sendJSON(res,404,{error:{message:'Unknown store',status:404}},req);
  const session=await requireSession(req,tenant.chatId);
  return sendJSON(res,200,await paymentCore.resolveManualReview({...await readBody(req),chatId,paymentId,organizationId:tenant.organizationId,actor:session}),req);
}

async function handlePaymentSettlement(req, res, chatId, paymentId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  const body = await readBody(req);
  return sendJSON(res, 200, await paymentCore.createSettlement({
    ...body, chatId, paymentId, organizationId: tenant.organizationId, actor: session,
  }), req);
}

async function handlePaymentSettlementFinalize(req, res, chatId, paymentId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  const body = await readBody(req);
  return sendJSON(res, 200, await paymentCore.finalizeSettlement({
    ...body, chatId, paymentId, organizationId: tenant.organizationId, actor: session,
  }), req);
}

async function handlePaymentSettlementHistory(req, res, chatId, paymentId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  return sendJSON(res, 200, await paymentCore.listSettlements({
    chatId, paymentId, organizationId: tenant.organizationId, actor: session,
  }), req);
}

async function handlePaymentRefund(req, res, chatId, paymentId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  const body = await readBody(req);
  const result = await paymentCore.refund({
    ...body,
    chatId,
    paymentId,
    organizationId: tenant.organizationId,
    actor: session,
  });
  return sendJSON(res, 200, result, req);
}

async function handlePaymentRefundHistory(req, res, chatId, paymentId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  return sendJSON(res, 200, await paymentCore.listRefunds({
    chatId,
    paymentId,
    organizationId: tenant.organizationId,
    actor: session,
  }), req);
}

async function handlePaymentConfirmationFinalization(req, res, chatId, attemptId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'payments', 'payments:accept', {
    deniedMessage: 'Payment confirmation permission required',
  });
  const body = await readBody(req);
  const result = await paymentCore.finalizeProviderConfirmation({
    ...body,
    chatId,
    confirmationAttemptId: attemptId,
    organizationId: tenant.organizationId,
    actor: session,
  });
  return sendJSON(res, result.finalized ? 200 : 202, result, req);
}

async function handlePaymentLifecycle(req, res, chatId, paymentId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  const body = await readBody(req);
  const result = await paymentCore.transitionLifecycle({
    ...body,
    chatId,
    paymentId,
    organizationId: tenant.organizationId,
    actor: session,
  });
  return sendJSON(res, 200, result, req);
}

async function handlePaymentStatusQuery(req, res, chatId, paymentId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'payments', 'payments:accept', { deniedMessage: 'Payment status query permission required' });
  const body = await readBody(req);
  const idempotencyKey = String(req.headers['idempotency-key'] || body.idempotencyKey || body.idempotency_key || '').trim();
  if (!idempotencyKey) return sendJSON(res, 400, { error: { message: 'Idempotency-Key is required', status: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' } }, req);
  const result = await paymentCore.queryStatus({
    ...body,
    idempotencyKey,
    chatId,
    paymentId,
    organizationId: tenant.organizationId,
    actor: session,
  });
  return sendJSON(res, 200, result, req);
}

async function handlePaymentCoreReconciliation(req, res, chatId, paymentId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'payments', 'payments:reconcile', { deniedMessage: 'Payment reconciliation permission required' });
  const body = await readBody(req);
  const result = await paymentCore.reconcile({
    ...body,
    chatId,
    paymentId,
    organizationId: tenant.organizationId,
    actor: session,
  });
  return sendJSON(res, 200, result, req);
}

async function handlePaymentReconciliationHistory(req, res, chatId, paymentId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'payments', 'payments:reconcile', { deniedMessage: 'Payment reconciliation permission required' });
  const reconciliations = await listPaymentReconciliations(chatId, paymentId, {});
  if (!reconciliations) return sendJSON(res, 404, { error: { message: 'Payment not found', status: 404 } }, req);
  return sendJSON(res, 200, { reconciliations }, req);
}

async function handlePaymentReconciliation(req, res, chatId, paymentId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'payments', 'payments:reconcile', { deniedMessage: 'Payment reconciliation permission required' });
  const body = await readBody(req);
  const result = await paymentCore.reconcile({
    ...body,
    chatId,
    paymentId,
    organizationId: tenant.organizationId,
    actor: session,
  });
  return sendJSON(res, 200, result, req);
}

async function handleB2BReceivables(req, res, chatId, receivableId = null, ledger = false, allocate = false) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  if (ledger) {
    await requireAuthorization(session, tenant, 'b2b_receivables', 'b2b:ar:view', { deniedMessage: 'Accounts-receivable view permission required' });
    const entries = await listReceivableLedger(chatId, receivableId);
    if (!entries) return sendJSON(res, 404, { error: { message: 'Receivable not found', status: 404 } }, req);
    return sendJSON(res, 200, { ledger: entries }, req);
  }
  if (allocate) {
    await requireAuthorization(session, tenant, 'b2b_receivables', 'b2b:ar:allocate', { deniedMessage: 'Accounts-receivable allocation permission required' });
    const body = await readBody(req);
    const receivable = await allocatePaymentToReceivable(chatId, receivableId, body, session);
    return sendJSON(res, 200, { receivable }, req);
  }
  const action = req.method === 'GET' ? 'b2b:ar:view' : (receivableId && req.method === 'PATCH' ? 'b2b:ar:manage' : 'b2b:ar:create');
  await requireAuthorization(session, tenant, 'b2b_receivables', action, { deniedMessage: 'Accounts-receivable permission required' });
  if (req.method === 'GET') {
    if (receivableId) {
      const receivable = await getReceivable(chatId, receivableId);
      if (!receivable) return sendJSON(res, 404, { error: { message: 'Receivable not found', status: 404 } }, req);
      return sendJSON(res, 200, { receivable }, req);
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const receivables = await listReceivables(chatId, { customerId: url.searchParams.get('customer_id') || '', status: url.searchParams.get('status') || 'all', limit: Number(url.searchParams.get('limit') || 100) });
    return sendJSON(res, 200, { receivables }, req);
  }
  if (req.method === 'POST') {
    const body = await readBody(req);
    const receivable = await createReceivable(chatId, body, session);
    return sendJSON(res, 201, { receivable }, req);
  }
  if (req.method === 'PATCH' && receivableId) {
    const body = await readBody(req);
    const target = String(body.status || '').toUpperCase();
    const permission = ['WRITTEN_OFF','CANCELLED'].includes(target) ? 'b2b:ar:manage' : 'b2b:ar:manage';
    await requireAuthorization(session, tenant, 'b2b_receivables', permission, { deniedMessage: 'Accounts-receivable state change permission required' });
    const receivable = await transitionReceivable(chatId, receivableId, target, session, body.reason || '');
    return sendJSON(res, 200, { receivable }, req);
  }
  return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);
}

async function handleB2BInvoices(req, res, chatId, invoiceId = null) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  const action = req.method === 'GET' ? 'b2b:invoice:view' : (invoiceId ? 'b2b:invoice:manage' : 'b2b:invoice:create');
  await requireAuthorization(session, tenant, 'b2b_invoices', action, { deniedMessage: 'Invoice permission required' });
  if (req.method === 'GET') {
    if (invoiceId) {
      const invoice = await getInvoice(chatId, invoiceId);
      if (!invoice) return sendJSON(res, 404, { error: { message: 'Invoice not found', status: 404 } }, req);
      return sendJSON(res, 200, { invoice }, req);
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const invoices = await listInvoices(chatId, { customerId: url.searchParams.get('customer_id') || '', status: url.searchParams.get('status') || 'all', limit: Number(url.searchParams.get('limit') || 100) });
    return sendJSON(res, 200, { invoices }, req);
  }
  if (req.method === 'POST') {
    const body = await readBody(req);
    const invoice = await createInvoice(chatId, body, session);
    return sendJSON(res, 201, { invoice }, req);
  }
  if (req.method === 'PATCH' && invoiceId) {
    const body = await readBody(req);
    const invoice = await transitionInvoice(chatId, invoiceId, body.status, session, body.reason || '');
    return sendJSON(res, 200, { invoice }, req);
  }
  return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);
}

async function handleTenantAudit(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'audit', 'audit:view', { deniedMessage: 'Audit view permission required' });
  const url = new URL(req.url, `http://${req.headers.host}`);
  const limit = url.searchParams.get('limit');
  const events = await listAuditEvents(chatId, limit, {
    action: url.searchParams.get('action') || '',
    actorId: url.searchParams.get('actor_id') || '',
    entityType: url.searchParams.get('entity_type') || '',
  });
  await recordAuditEvent({
    chatId, organizationId: tenant.organizationId, actorId: session.userId, deviceId: session.deviceId,
    action: 'audit.accessed', entityType: 'audit_events',
    metadata: { limit: Number(limit) || 100 },
  });
  sendJSON(res, 200, { events }, req);
}

async function handleAuditRetention(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'audit', 'compliance:manage', { deniedMessage: 'Compliance management permission required' });
  if (req.method === 'GET') {
    return sendJSON(res, 200, { policy: await getAuditRetentionPolicy(chatId) }, req);
  }
  const body = await readBody(req);
  const policy = await setAuditRetentionPolicy(chatId, body.retentionDays, session);
  sendJSON(res, 200, { policy }, req);
}

async function handleComplianceRequests(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'compliance', 'compliance:manage', { deniedMessage: 'Compliance management permission required' });

  if (req.method === 'GET') {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const requests = await listComplianceRequests(chatId, {
      status: url.searchParams.get('status') || 'all',
      limit: Number(url.searchParams.get('limit') || 100),
    });
    return sendJSON(res, 200, { requests }, req);
  }
  if (req.method === 'POST') {
    const body = await readBody(req);
    const request = await createComplianceRequest(chatId, body, session);
    return sendJSON(res, 201, { request }, req);
  }
  const body = await readBody(req);
  const request = await resolveComplianceRequest(chatId, body.requestId, body.status, body.resolutionNote, session);
  sendJSON(res, 200, { request }, req);
}

async function handleComplianceExport(req, res, chatId, subjectType, subjectId = null) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  await requireAuthorization(session, tenant, 'compliance', 'compliance:manage', { deniedMessage: 'Compliance export permission required' });
  const exportData = await buildComplianceExport(chatId, { subjectType, subjectId });
  await recordAuditEvent({
    chatId, organizationId: tenant.organizationId, actorId: session.userId, deviceId: session.deviceId,
    action: 'compliance.exported',
    entityType: subjectType === 'customer' ? 'customer' : 'organization',
    entityId: subjectId || tenant.organizationId,
    reason: 'compliance export',
    metadata: { subjectType, subjectId: subjectId || null },
  });
  sendJSON(res, 200, exportData, req);
}

async function handleAdminBackup(req, res) {
  const configuredToken = process.env.SELLIFY_BACKUP_TOKEN;
  const suppliedToken = getBearerKey(req);
  if (!configuredToken) {
    return sendError(res, 503, new Error('Backups are not configured'), req);
  }
  if (!suppliedToken || !keysMatch(suppliedToken, configuredToken)) {
    return sendError(res, 401, new Error('Invalid or missing backup token'), req);
  }
  const backup = await createDatabaseBackup();
  sendJSON(res, 201, {
    ok: true,
    file: backup.fileName,
    retained: backup.retained,
  }, req);
}

// Phase 2 (marketplace boundary): both routes below are exactly what
// marketplace/listings.js and marketplace/checkout.js were already
// calling with no server-side implementation behind them — see
// lib/store.js's "marketplace (Phase 2)" section for the actual logic
// and the integrity rules that matter for an unauthenticated buyer-facing
// checkout. Deliberately public/unauthenticated, same reasoning as
// GET /catalog/:chatId: a buyer browsing or checking out has no tenant
// api key and shouldn't need one.
async function handleMarketplaceSearch(req, res) {
  const results = await searchMarketplaceListings();
  sendJSON(res, 200, { results }, req);
}

// Phase 19.3 — read-only cross-marketplace product discovery. The provider
// delegates to existing Marketplace/Product authority and returns derived
// candidates only; it does not mutate commerce state.
async function handleDiscoveryProducts(req, res) {
  const provider = getDiscoveryProvider('commerce.marketplace');
  const url = new URL(req.url, `http://${req.headers.host}`);
  const rows = await provider.search({
    search: url.searchParams.get('q') || url.searchParams.get('search') || '',
    category: url.searchParams.get('category') || '',
    currency: url.searchParams.get('currency') || '',
    seller: url.searchParams.get('seller') || '',
  });
  const candidates = rows.map(row => {
    const candidate = provider.normalize(row);
    candidate.evidence = provider.evidence(row);
    candidate.actions = provider.actions(row);
    return candidate;
  });
  sendJSON(res, 200, { deterministic: true, ai: false, provider: provider.providerId, candidates }, req);
}

// Phase 19.4 — read-only seller/organization discovery. The provider
// exposes only canonical Organizations with public Marketplace presence.
// Phase 19.5 — read-only Supplier Network federation. The provider delegates
// to the existing Phase 18 deterministic Supplier Network authority.
async function handleDiscoverySuppliers(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);
  if (req.method !== 'GET' && req.method !== 'POST') return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);
  await requireAuthorization(session, tenant, 'supplier_network_discovery', 'supplier-network:discovery:discover', { deniedMessage: 'Supplier network discovery permission required' });
  const url = new URL(req.url, `http://${req.headers.host}`);
  const input = req.method === 'POST' ? await readBody(req) : Object.fromEntries(url.searchParams.entries());
  delete input.chatId;
  const provider = getDiscoveryProvider('supplier-network');
  const rows = await provider.search({ ...input, chatId: tenant.chatId, actor: session });
  const candidates = rows.map(row => {
    const candidate = provider.normalize(row);
    candidate.evidence = provider.evidence(row);
    candidate.actions = provider.actions(row);
    return candidate;
  });
  sendJSON(res, 200, { deterministic: true, ai: false, provider: provider.providerId, candidates }, req);
}

async function handleUnifiedDiscovery(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let input = req.method === 'POST' ? await readBody(req) : Object.fromEntries(url.searchParams.entries());
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};

  // Supplier Network federation is tenant-scoped and must retain its existing
  // authorization boundary. Marketplace/organization discovery may remain
  // public, but a unified request that includes supplier federation requires
  // an authenticated tenant context.
  const providerIds = Array.isArray(input.providers)
    ? input.providers
    : (typeof input.providers === 'string' ? input.providers.split(',') : undefined);
  const requestedProviders = providerIds?.length ? providerIds : undefined;
  const includesSupplier = (requestedProviders || ['commerce.marketplace', 'commerce.organization', 'supplier-network']).includes('supplier-network');
  let actor = null;
  let tenant = null;
  if (includesSupplier) {
    const chatId = String(input.chatId || url.searchParams.get('chatId') || '').trim();
    if (!chatId) return sendJSON(res, 400, { error: { message: 'chatId is required when supplier-network federation is included', status: 400 } }, req);
    tenant = await getTenant(chatId);
    if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
    const session = await requireSession(req, tenant);
    await requireAuthorization(session, tenant, 'supplier_network_discovery', 'supplier-network:discovery:discover', { deniedMessage: 'Supplier network discovery permission required' });
    actor = session;
    input.chatId = tenant.chatId;
  }

  delete input.providers;
  delete input.actor;
  input.actor = actor;
  const result = await discoverUnified({ intent: input, providerIds: requestedProviders });
  sendJSON(res, 200, result, req);
}

async function handleDiscoveryOrganizations(req, res) {
  const provider = getDiscoveryProvider('commerce.organization');
  const url = new URL(req.url, `http://${req.headers.host}`);
  const rows = await provider.search({
    search: url.searchParams.get('q') || url.searchParams.get('search') || '',
    country: url.searchParams.get('country') || url.searchParams.get('countryCode') || '',
    currency: url.searchParams.get('currency') || '',
    seller: url.searchParams.get('seller') || '',
  });
  const candidates = rows.map(row => {
    const candidate = provider.normalize(row);
    candidate.evidence = provider.evidence(row);
    candidate.actions = provider.actions(row);
    return candidate;
  });
  sendJSON(res, 200, { deterministic: true, ai: false, provider: provider.providerId, candidates }, req);
}

async function handleMarketplaceCheckout(req, res) {
  const body = await readBody(req);
  const bearer = getBearerToken(req);
  let session = null;
  if (bearer) {
    session = await authenticateSessionToken(bearer);
    if (!session) throw Object.assign(new Error('Invalid or expired session'), { statusCode: 401 });
  }
  const idempotencyKey = String(req.headers['idempotency-key'] || body.idempotency_key || '').trim();
  const telegramChatId = String(body.telegram_storefront_chat_id || '').trim();
  const telegramInitData = String(body.telegram_init_data || req.headers['x-telegram-init-data'] || '').trim();
  let verifiedTelegramBuyer = null;
  if (telegramChatId || telegramInitData) {
    if (!telegramChatId || !telegramInitData) throw Object.assign(new Error('Telegram storefront buyer context is incomplete'), { statusCode: 400, code: 'TELEGRAM_BUYER_CONTEXT_INCOMPLETE' });
    const tenant = await getTenant(telegramChatId);
    const config = getTelegramStorefrontConfig(telegramChatId);
    if (!tenant || !config || config.status !== 'PUBLISHED') throw Object.assign(new Error('Telegram storefront is not published'), { statusCode: 404, code: 'TELEGRAM_STOREFRONT_NOT_PUBLISHED' });
    if (!Array.isArray(config.enabledCapabilities) || !config.enabledCapabilities.includes('checkout')) throw Object.assign(new Error('Telegram checkout capability is disabled'), { statusCode: 403, code: 'TELEGRAM_CHECKOUT_DISABLED' });
    const secret = await resolveTelegramBotCredential(config.credentialRef);
    verifiedTelegramBuyer = verifyTelegramBuyerInitDataWithSecret(telegramInitData, secret, TELEGRAM_AUTH_MAX_AGE_SEC);
    if (!Array.isArray(body.items) || body.items.some(item => String(item?.seller_id || '') !== telegramChatId)) throw Object.assign(new Error('Telegram checkout seller scope mismatch'), { statusCode: 403, code: 'TELEGRAM_CHECKOUT_SCOPE_MISMATCH' });
  }
  const order = await createMarketplaceOrder({
    buyer_id: verifiedTelegramBuyer?.telegramUserId || body.buyer_id,
    buyer_identity: session?.userId || verifiedTelegramBuyer?.telegramUserId || body.buyer_id || body.customer_phone || 'anonymous',
    customer_name: body.customer_name,
    customer_phone: body.customer_phone,
    items: body.items,
    idempotency_key: idempotencyKey || null,
  });
  if (telegramChatId) {
    order.telegram_storefront = {
      channel: 'telegram',
      payment: buildTelegramPaymentBoundary({ order }),
      orderStatusCapability: true,
    };
  }
  sendJSON(res, 200, order, req);
}

async function handleMarketplaceOrderTracking(req, res, marketplaceOrderId) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token') || '';
  const result = await getMarketplaceOrderTracking(decodeURIComponent(marketplaceOrderId), token);
  sendJSON(res, 200, result, req);
}

async function handleMarketplaceOrderStatus(req, res, localId) {
  const body = await readBody(req);
  const id = decodeURIComponent(localId);
  const parts = id.split('_');
  const sellerId = parts.length >= 3 ? parts.slice(2).join('_') : '';
  if (!sellerId) throw Object.assign(new Error('Invalid marketplace order ID'), { statusCode: 400 });
  const session = await requireSession(req, sellerId);
  await requireAuthorization(session, { organizationId: session.organizationId }, 'marketplace_orders', 'marketplace_orders:update', { deniedMessage: 'Order status permission required' });
  const role = String(session.role || '').toLowerCase();
  const requestedStatus = String(body.status || '').trim().toLowerCase();
  if (requestedStatus === 'cancelled') {
    await requireAuthorization(session, { organizationId: session.organizationId }, 'marketplace_orders', 'orders:delete', { deniedMessage: 'Only owners or managers can cancel marketplace orders' });
  }
  const updated = await updateMarketplaceOrderStatus(sellerId, id, requestedStatus);
  sendJSON(res, 200, {
    order_id: id,
    marketplace_order_id: updated.marketplace_order_id,
    status: updated.status,
    status_updated_at: updated.status_updated_at,
  }, req);
}

// Generated per-request rather than served as a static file. Previously
// a checked-in config.js shipped with an empty SYNC_SERVER_URL, which
// meant every deployment had to remember to edit it by hand (confirmed
// gap: the uploaded ZIP's config.js had exactly this problem). Now: if
// PUBLIC_SYNC_SERVER_URL is set, use it; otherwise default to this
// request's own origin, which is correct automatically whenever this
// server is also the one serving the static app (the normal case for
// this merged project).
function handleConfigJs(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const syncUrl = PUBLIC_SYNC_SERVER_URL || `${url.protocol}//${req.headers.host}`;
  const body = `// Generated by backend/server.js at request time — see handleConfigJs.\n` +
    `window.__APP_CONFIG__ = {\n  SYNC_SERVER_URL: ${JSON.stringify(syncUrl)}\n};\n`;
  res.writeHead(200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

// ---------- static file serving ----------
//
// Closes the "uploaded ZIP alone serves the frontend only" gap: this
// server is now the whole deployable unit. Deliberately minimal (no
// range requests, no strong ETags) — this is a small PWA, not a CDN;
// swap in a real static-file library first if that ever matters.

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

async function serveStatic(req, res, pathname) {
  // Path-traversal guard: resolve against STATIC_DIR and reject anything
  // that escapes it (e.g. "/../../etc/passwd" after normalization).
  const decoded = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const resolved = path.normalize(path.join(STATIC_DIR, decoded));
  if (!resolved.startsWith(STATIC_DIR)) {
    return sendError(res, 403, new Error('Forbidden'), req);
  }

  let filePath = resolved;
  try {
    if (statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch {
    // Not found as-is. Single-page apps that use client-side routes
    // would fall back to index.html here; this app doesn't use
    // path-based client routing (it's tab state, not URL state), so a
    // genuine 404 is the correct behavior rather than masking typos.
    return sendError(res, 404, new Error('Not found'), req);
  }

  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': data.length,
      // service-worker.js controls its own cache versioning (see the
      // Phase-5 roadmap item on stale releases) — this header just
      // stops the *browser's* HTTP cache from adding a second stale
      // layer on top of that.
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(data);
  } catch (e) {
    sendError(res, 404, new Error('Not found'), req);
  }
}

// ---------- rate limiting ----------
//
// Small in-memory fixed-window limiter, per (IP, tier). No external
// dependency, consistent with this backend's zero-deps approach — and
// it doesn't need to survive a restart to be useful. This IS
// single-process-only, same caveat as the file-based store (see
// store.js's header comment); a horizontally-scaled deployment needs a
// shared store (Redis etc.) for this to mean anything, which is exactly
// the kind of change that comes with the Postgres migration later.
const rateBuckets = new Map(); // key -> { count, windowStart }

function checkRateLimit(req, tier, max) {
  const key = `${tier}:${clientIp(req)}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}

// Periodic sweep so rateBuckets doesn't grow unbounded across many
// distinct IPs over a long-running process.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS * 2) rateBuckets.delete(key);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

async function handlePackLifecycle(req, res, chatId, packId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, tenant.chatId);

  if (req.method === 'GET') {
    await requireAuthorization(session, tenant, 'pack_lifecycle', 'pack:lifecycle:view', {
      deniedMessage: 'Pack lifecycle view permission required',
    });
    const lifecycle = getPackLifecycle(tenant.organizationId, packId);
    const readiness = derivePackLifecycleReadiness(packId, lifecycle, {
      organizationId: tenant.organizationId,
    });
    return sendJSON(res, 200, { lifecycle, readiness }, req);
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const requestedAction = String(body.action || '').trim().toUpperCase();
    const actionTargets = Object.freeze({
      INSTALL: 'INSTALLED',
      ACTIVATE: 'ACTIVE',
      DEACTIVATE: 'DEACTIVATED',
      UPGRADE: 'ACTIVE',
      RECOVER: 'ELIGIBLE',
    });
    const legacyTarget = String(body.targetState || body.target_state || body.state || '').trim().toUpperCase();
    if (!requestedAction && !legacyTarget) {
      return sendJSON(res, 400, { error: { message: 'action is required', status: 400, code: 'PACK_LIFECYCLE_ACTION_REQUIRED' } }, req);
    }
    if (requestedAction && !Object.prototype.hasOwnProperty.call(actionTargets, requestedAction)) {
      return sendJSON(res, 400, {
        error: { message: 'Unsupported Pack lifecycle action', status: 400, code: 'UNSUPPORTED_PACK_LIFECYCLE_ACTION' },
      }, req);
    }
    const targetState = requestedAction ? actionTargets[requestedAction] : legacyTarget;
    if (requestedAction && legacyTarget && legacyTarget !== targetState) {
      return sendJSON(res, 400, {
        error: { message: 'action and targetState describe different lifecycle intents', status: 400, code: 'PACK_LIFECYCLE_ACTION_STATE_MISMATCH' },
      }, req);
    }

    const current = getPackLifecycle(tenant.organizationId, packId)?.state || 'NOT_INSTALLED';
    const upgradeStates = new Set(['UPGRADE_AVAILABLE', 'UPGRADE_AUTHORIZATION_REQUIRED', 'UPGRADE_BLOCKED']);
    if (upgradeStates.has(current) && requestedAction !== 'UPGRADE') {
      return sendJSON(res, 409, {
        error: {
          message: 'Pack upgrade state requires the UPGRADE command',
          status: 409,
          code: 'PACK_UPGRADE_COMMAND_REQUIRED',
        },
      }, req);
    }
    if (requestedAction === 'RECOVER' && current !== 'RECOVERY_REQUIRED') {
      return sendJSON(res, 409, {
        error: {
          message: 'Pack recovery is not currently required',
          status: 409,
          code: 'PACK_RECOVERY_NOT_REQUIRED',
        },
      }, req);
    }
    if (requestedAction === 'UPGRADE' && !['UPGRADE_AVAILABLE', 'UPGRADE_AUTHORIZATION_REQUIRED'].includes(current)) {
      return sendJSON(res, 409, {
        error: {
          message: 'No Pack upgrade is currently available',
          status: 409,
          code: 'PACK_UPGRADE_NOT_AVAILABLE',
        },
      }, req);
    }
    // The public API exposes user actions, not internal lifecycle evidence/recovery states.
    // Internal states such as ELIGIBLE, DEPENDENCY_BLOCKED, UNKNOWN and RECOVERY_REQUIRED
    // are produced by lifecycle/readiness/recovery boundaries and must not be user-selectable.
    const publicActionStates = new Set(['INSTALLED', 'ACTIVE', 'DEACTIVATED']);
    const internalCommandTarget = requestedAction === 'RECOVER' && targetState === 'ELIGIBLE';
    if (!publicActionStates.has(targetState) && !internalCommandTarget) {
      return sendJSON(res, 400, {
        error: { message: 'Unsupported Pack lifecycle API target state', status: 400, code: 'UNSUPPORTED_PACK_LIFECYCLE_API_STATE' },
      }, req);
    }
    const permission = requestedAction === 'RECOVER'
      ? 'pack:lifecycle:recover'
      : requestedAction === 'INSTALL' || targetState === 'INSTALLED'
      ? 'pack:lifecycle:install'
      : requestedAction === 'DEACTIVATE' || targetState === 'DEACTIVATED'
        ? 'pack:lifecycle:deactivate'
        : requestedAction === 'UPGRADE'
          ? 'pack:lifecycle:upgrade'
          : (current === 'UPGRADE_AVAILABLE' || current === 'UPGRADE_AUTHORIZATION_REQUIRED' || current === 'UPGRADE_BLOCKED')
            ? 'pack:lifecycle:upgrade'
            : 'pack:lifecycle:activate';

    await requireAuthorization(session, tenant, 'pack_lifecycle', permission, {
      deniedMessage: 'Pack lifecycle action permission required',
    });

    const lifecycle = await transitionPackLifecycle(chatId, packId, targetState, session, {
      ...body,
      expectedVersion: body.expectedVersion ?? body.expected_version,
    });
    return sendJSON(res, 200, { lifecycle }, req);
  }

  return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);
}


async function handleDeliveryAssignmentsList(req, res, chatId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, chatId);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const locationId = String(url.searchParams.get('locationId') || '').trim() || null;
  await requireAuthorization(session, tenant, 'logistics', 'logistics:deliveries:view', {
    location: locationId || session.locationId || null,
    deniedMessage: 'Logistics delivery view permission required',
  });
  const assignments = await listDeliveryAssignments(chatId, session, {
    locationId,
    status: url.searchParams.get('status'),
    courierUserId: url.searchParams.get('courierUserId'),
  });
  return sendJSON(res, 200, { assignments }, req);
}

async function handleDeliveryAssignment(req, res, chatId, serverOrderId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, chatId);
  if (req.method === 'GET') {
    await requireAuthorization(session, tenant, 'logistics', 'logistics:deliveries:view', {
      location: session.locationId || null, deniedMessage: 'Logistics delivery view permission required',
    });
    const assignment = await getDeliveryAssignment(chatId, serverOrderId, session);
    return sendJSON(res, 200, { assignment }, req);
  }

  const body = await readBody(req);
  const location = body.locationId || body.location_id || session.locationId || null;
  if (req.method === 'PATCH') {
    const action = String(body.action || body.status || '').trim().toUpperCase();
    const courierActor = Array.isArray(session.roles) && session.roles.includes('logistics_courier') || session.role === 'logistics_courier';
    const courierActions = new Set(['ACCEPTED','OUT_FOR_DELIVERY','DELIVERED']);
    if (courierActor && courierActions.has(action)) {
      await requireAuthorization(session, tenant, 'logistics', 'logistics:deliveries:update_assigned', {
        location, deniedMessage: 'Assigned delivery update permission required',
      });
      await assertCourierOwnsDelivery(chatId, serverOrderId, session);
    } else {
      const permission = action === 'REASSIGNED' || action === 'REASSIGN_EXCEPTION' || action === 'CANCELLED' || action === 'FAILED'
        ? 'logistics:deliveries:reassign'
        : 'logistics:deliveries:update_assigned';
      await requireAuthorization(session, tenant, 'logistics', permission, {
        location, deniedMessage: 'Delivery lifecycle permission required',
      });
    }
    const idempotencyKey = String(req.headers['idempotency-key'] || body.idempotencyKey || body.idempotency_key || '').trim();
    if (!idempotencyKey) return sendJSON(res, 400, { error: { message: 'Idempotency-Key is required', status: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' } }, req);
    const assignment = await transitionDeliveryAssignment(chatId, serverOrderId, action, session, { ...body, locationId: location, idempotencyKey });
    return sendJSON(res, 200, { assignment }, req);
  }

  await requireAuthorization(session, tenant, 'logistics', 'logistics:deliveries:assign', {
    location, deniedMessage: 'Delivery assignment permission required',
  });
  const assignment = await assignDeliveryCourier(chatId, serverOrderId, body.courierUserId || body.courier_user_id, session, body);
  return sendJSON(res, 200, { assignment }, req);
}

async function handleOrderFulfillment(req, res, chatId, serverOrderId) {
  const tenant = await getTenant(chatId);
  if (!tenant) return sendJSON(res, 404, { error: { message: 'Unknown store', status: 404 } }, req);
  const session = await requireSession(req, chatId);

  if (req.method === 'GET') {
    await requireAuthorization(session, tenant, 'fulfillment', 'fulfillment:view', {
      location: session.locationId || null,
      deniedMessage: 'Fulfillment view permission required',
    });
    const fulfillment = await getOrderFulfillment(chatId, serverOrderId);
    return sendJSON(res, 200, { fulfillment }, req);
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const locationId = body.locationId || body.location_id || session.locationId || null;
    const isCourier = Array.isArray(session.roles) && session.roles.includes('logistics_courier') || session.role === 'logistics_courier';
    if (isCourier) {
      await requireAuthorization(session, tenant, 'logistics', 'logistics:deliveries:update_assigned', {
        location: locationId,
        deniedMessage: 'Assigned delivery update permission required',
      });
      await assertCourierOwnsDelivery(chatId, serverOrderId, session);
    } else {
      await requireAuthorization(session, tenant, 'fulfillment', 'fulfillment:update', {
        location: locationId,
        deniedMessage: 'Fulfillment update permission required',
      });
    }
    const idempotencyKey = String(req.headers['idempotency-key'] || body.idempotencyKey || body.idempotency_key || '').trim();
    if (!idempotencyKey) {
      return sendJSON(res, 400, { error: { message: 'Idempotency-Key is required', status: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' } }, req);
    }
    const targetStatus = body.status || body.nextStatus || body.next_status;
    const fulfillment = await transitionOrderFulfillment(chatId, serverOrderId, targetStatus, session, {
      ...body,
      locationId,
      idempotencyKey,
    });
    return sendJSON(res, 200, { fulfillment }, req);
  }

  return sendJSON(res, 405, { error: { message: 'Method not allowed', status: 405 } }, req);
}

// ---------- routing ----------

const ROUTES = [
  { method: 'POST', pattern: /^\/integrations\/payments\/([^/]+)\/notifications$/, handler: (req, res, m) => handlePaymentProviderNotification(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/auth\/telegram$/, handler: handleTelegramAuth },
  { method: 'POST', pattern: /^\/auth\/migrate-legacy$/, handler: handleLegacyMigration },
  { method: 'POST', pattern: /^\/auth\/tenants$/, handler: handleCreateTenant },
  { method: 'GET', pattern: /^\/auth\/tenants$/, handler: handleMyTenants },
  { method: 'POST', pattern: /^\/auth\/select-tenant$/, handler: handleSelectTenant },
  { method: 'POST', pattern: /^\/auth\/logout$/, handler: handleLogout },
  { method: 'POST', pattern: /^\/auth\/pairing$/, handler: handleCreatePairing },
  { method: 'POST', pattern: /^\/auth\/pair$/, handler: handlePairDevice },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/memberships$/, handler: (req, res, m) => handleListTenantMemberships(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/packs\/([^/]+)\/lifecycle$/, handler: (req, res, m) => handlePackLifecycle(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/packs\/([^/]+)\/lifecycle$/, handler: (req, res, m) => handlePackLifecycle(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/auth\/membership-role$/, handler: handleChangeMembershipRole },
  { method: 'POST', pattern: /^\/auth\/membership-contextual-role$/, handler: handleAssignMembershipContextualRole },
  { method: 'POST', pattern: /^\/auth\/membership-contextual-role\/revoke$/, handler: handleRevokeMembershipContextualRole },
  { method: 'POST', pattern: /^\/auth\/invites$/, handler: handleCreateInvite },
  { method: 'POST', pattern: /^\/auth\/invites\/revoke$/, handler: handleRevokeInvite },
  { method: 'POST', pattern: /^\/auth\/accept-invite$/, handler: handleAcceptInvite },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/invites$/, handler: (req, res, m) => handleListInvites(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/devices$/, handler: (req, res, m) => handleListDevices(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/auth\/devices\/revoke$/, handler: handleRevokeDevice },
  { method: 'POST', pattern: /^\/sync\/([^/]+)$/, handler: (req, res, m) => handleSync(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/events\/([^/]+)$/, handler: (req, res, m) => handleSyncEvents(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/sync\/([^/]+)$/, handler: (req, res, m) => handleSyncPull(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/orders\/([^/]+)$/, handler: (req, res, m) => handleOrdersFeed(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/orders\/([^/]+)\/fulfillment$/, handler: (req, res, m) => handleOrderFulfillment(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/orders\/([^/]+)\/delivery-assignment$/, handler: (req, res, m) => handleDeliveryAssignment(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/orders\/([^/]+)\/delivery-assignment$/, handler: (req, res, m) => handleDeliveryAssignment(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/delivery-assignments$/, handler: (req, res, m) => handleDeliveryAssignmentsList(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/orders\/([^/]+)\/delivery-assignment$/, handler: (req, res, m) => handleDeliveryAssignment(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/orders\/([^/]+)\/fulfillment$/, handler: (req, res, m) => handleOrderFulfillment(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/catalog\/([^/]+)$/, handler: (req, res, m) => handleCatalogGet(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/storefront-channels$/, handler: (req, res, m) => handleSellerStorefrontChannelsGet(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/storefront-consistency$/, handler: (req, res, m) => handleCrossChannelConsistencyGet(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/telegram-storefront$/, handler: (req, res, m) => handleTelegramStorefrontGet(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/api\/telegram-storefront\/([^/]+)$/, handler: (req, res, m) => handleTelegramStorefrontPublicGet(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/api\/telegram-storefront\/([^/]+)\/buyer-session$/, handler: (req, res, m) => handleTelegramStorefrontBuyerSession(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/api\/telegram-storefront\/([^/]+)\/orders\/([^/]+)\/fulfillment$/, handler: (req, res, m) => handleTelegramStorefrontFulfillment(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/api\/telegram-storefront\/([^/]+)\/orders\/([^/]+)$/, handler: (req, res, m) => handleTelegramStorefrontOrder(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/api\/telegram-storefront\/([^/]+)\/orders$/, handler: (req, res, m) => handleTelegramStorefrontOrderHistory(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/telegram-storefront\/verify$/, handler: (req, res, m) => handleTelegramStorefrontVerify(req, res, decodeURIComponent(m[1])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/telegram-storefront$/, handler: (req, res, m) => handleTelegramStorefrontPatch(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/catalog\/([^/]+)$/, handler: (req, res, m) => handleCatalogPost(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants$/, handler: (req, res) => handleTenantsList(req, res) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/customers$/, handler: (req, res, m) => handleCustomersList(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/customers$/, handler: (req, res, m) => handleCustomerCreate(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/customers\/([^/]+)$/, handler: (req, res, m) => handleCustomerGet(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/customers\/([^/]+)$/, handler: (req, res, m) => handleCustomerPatch(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/b2b\/pricing$/, handler: (req, res, m) => handleCustomerPricing(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/b2b\/pricing$/, handler: (req, res, m) => handleCustomerPricing(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/b2b\/pricing\/([^/]+)$/, handler: (req, res, m) => handleCustomerPricing(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/b2b\/pricing\/([^/]+)$/, handler: (req, res, m) => handleCustomerPricing(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/capabilities$/, handler: (req, res, m) => handleSupplierNetworkCapabilities(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/supplier-network\/capabilities$/, handler: (req, res, m) => handleSupplierNetworkCapabilities(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/capabilities\/([^/]+)$/, handler: (req, res, m) => handleSupplierNetworkCapabilities(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/supplier-network\/capabilities\/([^/]+)$/, handler: (req, res, m) => handleSupplierNetworkCapabilities(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/supplier-network\/capabilities\/([^/]+)\/(activate|deactivate)$/, handler: (req, res, m) => handleSupplierNetworkCapabilities(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2]), m[3]) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/catalog$/, handler: (req, res, m) => handleSupplierNetworkCatalog(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/supplier-network\/catalog$/, handler: (req, res, m) => handleSupplierNetworkCatalog(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/catalog\/([^/]+)$/, handler: (req, res, m) => handleSupplierNetworkCatalog(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/supplier-network\/catalog\/([^/]+)$/, handler: (req, res, m) => handleSupplierNetworkCatalog(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/supplier-network\/catalog\/([^/]+)\/(activate|deactivate)$/, handler: (req, res, m) => handleSupplierNetworkCatalog(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2]), m[3]) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/qualifications$/, handler: (req,res,m)=>handleSupplierNetworkQualifications(req,res,decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/supplier-network\/qualifications$/, handler: (req,res,m)=>handleSupplierNetworkQualifications(req,res,decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/qualifications\/([^/]+)$/, handler: (req,res,m)=>handleSupplierNetworkQualifications(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/supplier-network\/qualifications\/([^/]+)$/, handler: (req,res,m)=>handleSupplierNetworkQualifications(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/supplier-network\/qualifications\/([^/]+)\/(verify|document|revoke)$/, handler: (req,res,m)=>handleSupplierNetworkQualifications(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2]),m[3]) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/commercial-terms$/, handler: (req,res,m)=>handleSupplierNetworkCommercialTerms(req,res,decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/supplier-network\/commercial-terms$/, handler: (req,res,m)=>handleSupplierNetworkCommercialTerms(req,res,decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/commercial-terms\/([^/]+)$/, handler: (req,res,m)=>handleSupplierNetworkCommercialTerms(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/supplier-network\/commercial-terms\/([^/]+)$/, handler: (req,res,m)=>handleSupplierNetworkCommercialTerms(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/supplier-network\/commercial-terms\/([^/]+)\/(activate|deactivate)$/, handler: (req,res,m)=>handleSupplierNetworkCommercialTerms(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2]),m[3]) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/capacities$/, handler: (req,res,m)=>handleSupplierNetworkCapacities(req,res,decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/supplier-network\/capacities$/, handler: (req,res,m)=>handleSupplierNetworkCapacities(req,res,decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/capacities\/([^/]+)$/, handler: (req,res,m)=>handleSupplierNetworkCapacities(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/supplier-network\/capacities\/([^/]+)$/, handler: (req,res,m)=>handleSupplierNetworkCapacities(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/supplier-network\/capacities\/([^/]+)\/(activate|deactivate)$/, handler: (req,res,m)=>handleSupplierNetworkCapacities(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2]),m[3]) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/service-areas$/, handler: (req, res, m) => handleSupplierNetworkServiceAreas(req,res,decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/supplier-network\/service-areas$/, handler: (req,res,m) => handleSupplierNetworkServiceAreas(req,res,decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/service-areas\/([^/]+)$/, handler: (req,res,m) => handleSupplierNetworkServiceAreas(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/supplier-network\/service-areas\/([^/]+)$/, handler: (req,res,m) => handleSupplierNetworkServiceAreas(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/supplier-network\/service-areas\/([^/]+)\/(activate|deactivate)$/, handler: (req,res,m) => handleSupplierNetworkServiceAreas(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2]),m[3]) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/trust$/, handler:(req,res,m)=>handleSupplierNetworkTrust(req,res,decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/marketplace-integration(?:\/([^/]+))?$/, handler: (req, res, m) => handleSupplierNetworkMarketplaceIntegration(req, res, decodeURIComponent(m[1]), m[2] ? decodeURIComponent(m[2]) : null) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/discovery$/, handler:(req,res,m)=>handleSupplierNetworkDiscovery(req,res,decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/supplier-network\/discovery$/, handler:(req,res,m)=>handleSupplierNetworkDiscovery(req,res,decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/supplier-network\/trust\/([^/]+)\/refresh$/, handler:(req,res,m)=>handleSupplierNetworkTrust(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2]),'refresh') },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/trust\/([^/]+)$/, handler:(req,res,m)=>handleSupplierNetworkTrust(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/performance$/, handler: (req,res,m)=>handleSupplierNetworkPerformance(req,res,decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/supplier-network\/performance\/([^/]+)\/recalculate$/, handler: (req,res,m)=>handleSupplierNetworkPerformance(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2]),'recalculate') },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/performance\/([^/]+)$/, handler: (req,res,m)=>handleSupplierNetworkPerformance(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/supplier-network\/profile$/, handler: (req, res, m) => handleSupplierNetworkProfile(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/supplier-network\/profile$/, handler: (req, res, m) => handleSupplierNetworkProfile(req, res, decodeURIComponent(m[1])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/supplier-network\/profile$/, handler: (req, res, m) => handleSupplierNetworkProfile(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/supplier-network\/profile\/(publish|suspend|draft)$/, handler: (req, res, m) => handleSupplierNetworkProfile(req, res, decodeURIComponent(m[1]), m[2]) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/procurement\/supplier-relationships$/, handler: (req, res, m) => handleProcurementSupplierRelationships(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/procurement\/supplier-relationships$/, handler: (req, res, m) => handleProcurementSupplierRelationships(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/procurement\/supplier-relationships\/([^/]+)\/(active|declined|blocked|suspended)$/, handler: (req, res, m) => handleProcurementSupplierRelationships(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2]), m[3]) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/procurement\/rfqs$/, handler: (req, res, m) => handleProcurementRfqs(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/procurement\/rfqs$/, handler: (req, res, m) => handleProcurementRfqs(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/procurement\/rfqs\/([^/]+)$/, handler: (req, res, m) => handleProcurementRfqs(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/procurement\/rfqs\/([^/]+)\/(send|close|cancel)$/, handler: (req, res, m) => handleProcurementRfqs(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2]), m[3]) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/procurement\/rfqs\/([^/]+)\/responses$/, handler: (req, res, m) => handleProcurementRfqResponses(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/procurement\/rfqs\/([^/]+)\/responses\/([^/]+)\/submit$/, handler: (req, res, m) => handleProcurementRfqResponses(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2]), decodeURIComponent(m[3]), 'submit') },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/procurement\/awards$/, handler: (req, res, m) => handleProcurementAwards(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/procurement\/awards$/, handler: (req, res, m) => handleProcurementAwards(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/procurement\/awards\/([^/]+)$/, handler: (req, res, m) => handleProcurementAwards(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/procurement\/awards\/([^/]+)\/(confirm|cancel)$/, handler: (req, res, m) => handleProcurementAwards(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2]), m[3]) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/procurement\/comparisons$/, handler: (req, res, m) => handleProcurementComparisons(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/procurement\/comparisons$/, handler: (req, res, m) => handleProcurementComparisons(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/procurement\/comparisons\/([^/]+)$/, handler: (req, res, m) => handleProcurementComparisons(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/procurement\/demands$/, handler: (req, res, m) => handleProcurementDemands(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/procurement\/demands$/, handler: (req, res, m) => handleProcurementDemands(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/procurement\/demands\/([^/]+)$/, handler: (req, res, m) => handleProcurementDemands(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/procurement\/demands\/([^/]+)$/, handler: (req, res, m) => handleProcurementDemands(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/procurement\/demands\/([^/]+)\/submit$/, handler: (req, res, m) => handleProcurementDemands(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2]), 'submit') },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/procurement\/demands\/([^/]+)\/cancel$/, handler: (req, res, m) => handleProcurementDemands(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2]), 'cancel') },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/procurement\/demands\/([^/]+)\/start-sourcing$/, handler: (req, res, m) => handleProcurementDemands(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2]), 'start-sourcing') },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/b2b\/quotes$/, handler: (req, res, m) => handleB2BQuotes(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/b2b\/quotes$/, handler: (req, res, m) => handleB2BQuotes(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/b2b\/quotes\/([^/]+)$/, handler: (req, res, m) => handleB2BQuotes(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/b2b\/quotes\/([^/]+)$/, handler: (req, res, m) => handleB2BQuotes(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/procurement\/receipts$/, handler: (req, res, m) => handleProcurementReceipts(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/procurement\/receipts\/([^/]+)$/, handler: (req, res, m) => handleProcurementReceipts(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/procurement\/purchase-orders\/([^/]+)\/receipts$/, handler: (req, res, m) => handleProcurementReceipts(req, res, decodeURIComponent(m[1]), null, decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/procurement\/purchase-orders\/([^/]+)\/receipts$/, handler: (req, res, m) => handleProcurementReceipts(req, res, decodeURIComponent(m[1]), null, decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/b2b\/purchase-orders$/, handler: (req, res, m) => handleB2BPurchaseOrders(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/b2b\/purchase-orders$/, handler: (req, res, m) => handleB2BPurchaseOrders(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/b2b\/purchase-orders\/([^/]+)$/, handler: (req, res, m) => handleB2BPurchaseOrders(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/b2b\/purchase-orders\/([^/]+)$/, handler: (req, res, m) => handleB2BPurchaseOrders(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/b2b\/credit-terms$/, handler: (req, res, m) => handleB2BCreditTerms(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/b2b\/credit-terms$/, handler: (req, res, m) => handleB2BCreditTerms(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/b2b\/credit-terms\/([^/]+)$/, handler: (req, res, m) => handleB2BCreditTerms(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/b2b\/credit-terms\/([^/]+)$/, handler: (req, res, m) => handleB2BCreditTerms(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/inventory\/movements$/, handler: (req, res, m) => handleInventoryMovementsList(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/inventory\/balances$/, handler: (req, res, m) => handleInventoryBalances(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/inventory\/movements$/, handler: (req, res, m) => handleInventoryMovementCreate(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/locations$/, handler: (req, res, m) => handleLocationsList(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/locations$/, handler: (req, res, m) => handleLocationCreate(req, res, decodeURIComponent(m[1])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/locations\/([^/]+)$/, handler: (req, res, m) => handleLocationPatch(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/authorization\/scope-context$/, handler: (req, res, m) => handleAuthorizationScopeContext(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/authorization\/conditions-contract$/, handler: (req, res, m) => handleAuthorizationConditionsContract(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/authorization\/role-matrix$/, handler: (req, res, m) => handleAuthorizationRoleMatrix(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/authorization\/iam-certification$/, handler: (req, res, m) => handleAuthorizationIamCertification(req, res, decodeURIComponent(m[1])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)$/, handler: (req, res, m) => handleTenantPatch(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/payments\/providers$/, handler: (req, res, m) => handlePaymentProviderMetadata(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/payments\/accounts$/, handler: (req, res, m) => handlePaymentAccounts(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/accounts$/, handler: (req, res, m) => handlePaymentAccounts(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/payments\/outbound$/, handler: (req,res,m)=>handlePaymentOutbound(req,res,decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/outbound$/, handler: (req,res,m)=>handlePaymentOutbound(req,res,decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/payments\/outbound\/([^/]+)$/, handler: (req,res,m)=>handlePaymentOutbound(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/outbound\/([^/]+)\/(submit|confirm|fail|cancel)$/, handler: (req,res,m)=>handlePaymentOutbound(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2]),m[3]) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/procurement\/purchase-orders\/([^/]+)\/payment$/, handler:(req,res,m)=>handleProcurementPayment(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/payments\/procurement-settlements$/, handler:(req,res,m)=>handleProcurementSettlement(req,res,decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/payments\/procurement-settlements\/purchase-orders\/([^/]+)$/, handler:(req,res,m)=>handleProcurementSettlement(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/procurement-settlements\/purchase-orders\/([^/]+)\/allocate$/, handler:(req,res,m)=>handleProcurementSettlement(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/orders\/([^/]+)\/payments\/summary$/, handler: (req,res,m)=>handleOrderPaymentSummary(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/payments\/([^/]+)\/ledger$/, handler: (req, res, m) => handlePaymentLedger(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/([^/]+)\/reconcile$/, handler: (req, res, m) => handlePaymentReconciliation(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/([^/]+)\/reconciliation$/, handler: (req, res, m) => handlePaymentCoreReconciliation(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/payments\/([^/]+)\/reconciliation$/, handler: (req, res, m) => handlePaymentReconciliationHistory(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/confirmation-attempts\/([^/]+)\/finalize$/, handler: (req, res, m) => handlePaymentConfirmationFinalization(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/([^/]+)\/status$/, handler: (req, res, m) => handlePaymentStatusQuery(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/([^/]+)\/lifecycle$/, handler: (req, res, m) => handlePaymentLifecycle(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/([^/]+)\/refund$/, handler: (req, res, m) => handlePaymentRefund(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/payments\/providers\/certification$/, handler: (req,res,m)=>handlePaymentProviderCertification(req,res,decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/providers\/capability-probe$/, handler: (req,res,m)=>handlePaymentProviderCapabilityProbe(req,res,decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/payments\/providers\/capability-evidence$/, handler: (req,res,m)=>handlePaymentProviderCapabilityEvidence(req,res,decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/providers\/capability-evidence$/, handler: (req,res,m)=>handlePaymentProviderCapabilityEvidence(req,res,decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/payments\/production-certification$/, handler: (req,res,m)=>handlePaymentProductionCertification(req,res,decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/production-certification$/, handler: (req,res,m)=>handlePaymentProductionCertification(req,res,decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/payments\/([^/]+)\/operations$/, handler: (req,res,m)=>handlePaymentOperationalActions(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/([^/]+)\/operations$/, handler: (req,res,m)=>handlePaymentOperationalActions(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/([^/]+)\/operations\/retry$/, handler: (req,res,m)=>handlePaymentOperationalRetry(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/([^/]+)\/operations\/manual-review$/, handler: (req,res,m)=>handlePaymentManualReview(req,res,decodeURIComponent(m[1]),decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/([^/]+)\/settlement$/, handler: (req, res, m) => handlePaymentSettlement(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/routing\/resolve$/, handler: (req, res, m) => handlePaymentRoutingResolve(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/payments\/routing\/policies$/, handler: (req, res, m) => handlePaymentRoutingPolicies(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/routing\/policies$/, handler: (req, res, m) => handlePaymentRoutingPolicies(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments\/([^/]+)\/settlement\/finalize$/, handler: (req, res, m) => handlePaymentSettlementFinalize(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/payments\/([^/]+)\/settlement$/, handler: (req, res, m) => handlePaymentSettlementHistory(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/payments\/([^/]+)\/refund$/, handler: (req, res, m) => handlePaymentRefundHistory(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/payments\/([^/]+)$/, handler: (req, res, m) => handlePayments(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/payments$/, handler: (req, res, m) => handlePayments(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/payments$/, handler: (req, res, m) => handlePayments(req, res, decodeURIComponent(m[1])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/payments\/([^/]+)$/, handler: (req, res, m) => handlePayments(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/b2b\/receivables$/, handler: (req, res, m) => handleB2BReceivables(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/b2b\/receivables$/, handler: (req, res, m) => handleB2BReceivables(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/b2b\/receivables\/([^/]+)$/, handler: (req, res, m) => handleB2BReceivables(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/b2b\/receivables\/([^/]+)$/, handler: (req, res, m) => handleB2BReceivables(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/b2b\/receivables\/([^/]+)\/ledger$/, handler: (req, res, m) => handleB2BReceivables(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2]), true) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/b2b\/invoices$/, handler: (req, res, m) => handleB2BInvoices(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/b2b\/invoices$/, handler: (req, res, m) => handleB2BInvoices(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/b2b\/invoices\/([^/]+)$/, handler: (req, res, m) => handleB2BInvoices(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/b2b\/invoices\/([^/]+)$/, handler: (req, res, m) => handleB2BInvoices(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/b2b\/receivables\/([^/]+)\/allocate$/, handler: (req, res, m) => handleB2BReceivables(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2]), false, true) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/audit$/, handler: (req, res, m) => handleTenantAudit(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/compliance\/retention$/, handler: (req, res, m) => handleAuditRetention(req, res, decodeURIComponent(m[1])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/compliance\/retention$/, handler: (req, res, m) => handleAuditRetention(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/compliance\/requests$/, handler: (req, res, m) => handleComplianceRequests(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/tenants\/([^/]+)\/compliance\/requests$/, handler: (req, res, m) => handleComplianceRequests(req, res, decodeURIComponent(m[1])) },
  { method: 'PATCH', pattern: /^\/tenants\/([^/]+)\/compliance\/requests$/, handler: (req, res, m) => handleComplianceRequests(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/compliance\/export\/([^/]+)\/([^/]+)$/, handler: (req, res, m) => handleComplianceExport(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2]), decodeURIComponent(m[3])) },
  { method: 'GET', pattern: /^\/tenants\/([^/]+)\/compliance\/export\/([^/]+)$/, handler: (req, res, m) => handleComplianceExport(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2])) },
  { method: 'POST', pattern: /^\/admin\/backup$/, handler: (req, res) => handleAdminBackup(req, res) },
  { method: 'GET', pattern: /^\/api\/marketplace\/search$/, handler: (req, res) => handleMarketplaceSearch(req, res) },
  { method: 'GET', pattern: /^\/api\/discovery\/products$/, handler: (req, res) => handleDiscoveryProducts(req, res) },
  { method: 'GET', pattern: /^\/api\/discovery\/suppliers\/([^/]+)$/, handler: (req, res, m) => handleDiscoverySuppliers(req, res, decodeURIComponent(m[1])) },
  { method: 'POST', pattern: /^\/api\/discovery\/suppliers\/([^/]+)$/, handler: (req, res, m) => handleDiscoverySuppliers(req, res, decodeURIComponent(m[1])) },
  { method: 'GET', pattern: /^\/api\/discovery\/organizations$/, handler: (req, res) => handleDiscoveryOrganizations(req, res) },
  { method: 'GET', pattern: /^\/api\/discovery$/, handler: (req, res) => handleUnifiedDiscovery(req, res) },
  { method: 'POST', pattern: /^\/api\/discovery$/, handler: (req, res) => handleUnifiedDiscovery(req, res) },
  { method: 'POST', pattern: /^\/api\/marketplace\/checkout$/, handler: (req, res) => handleMarketplaceCheckout(req, res) },
  { method: 'GET', pattern: /^\/api\/marketplace\/orders\/([^/]+)$/, handler: (req, res, m) => handleMarketplaceOrderTracking(req, res, m[1]) },
  { method: 'PATCH', pattern: /^\/api\/marketplace\/orders\/status\/([^/]+)$/, handler: (req, res, m) => handleMarketplaceOrderStatus(req, res, m[1]) },
];

const START_TIME = Date.now();

const server = createServer(async (req, res) => {
  req._requestId = String(req.headers['x-request-id'] || crypto.randomUUID());
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    const allowOrigin = corsOriginFor(req);
    res.writeHead(204, {
      'X-Request-Id': req._requestId,
      ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin, 'Vary': 'Origin' } : {}),
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
    });
    return res.end();
  }

  if (url.pathname === '/health') {
    return sendJSON(res, 200, {
      ok: true,
      service: 'sellify-backend',
      env: NODE_ENV,
      uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
    }, req);
  }

  if (url.pathname === '/config.js' && req.method === 'GET') {
    return handleConfigJs(req, res);
  }

  // Public storefront route: the viewer itself is static; its only data access is the public catalog GET.
  if (req.method === 'GET' && /^\/store\/[^/]+$/.test(url.pathname)) {
    return serveStatic(req, res, '/store.html');
  }
  if (req.method === 'GET' && url.pathname === '/track') {
    return serveStatic(req, res, '/track.html');
  }

  // Rate limit: writes get the stricter budget, reads (including static
  // asset loads) the generous one. Checked before routing so a flood
  // can't even reach store I/O.
  const isWrite = req.method === 'POST' || req.method === 'PATCH';
  const withinLimit = checkRateLimit(req, isWrite ? 'write' : 'read', isWrite ? RATE_LIMIT_MAX_WRITES : RATE_LIMIT_MAX_READS);
  if (!withinLimit) {
    return sendError(res, 429, new Error('Too many requests — slow down and try again shortly.'), req);
  }

  for (const route of ROUTES) {
    if (route.method !== req.method) continue;
    const match = url.pathname.match(route.pattern);
    if (!match) continue;
    try {
      return await route.handler(req, res, match);
    } catch (e) {
      const status = e.statusCode || 500;
      return sendError(res, status, e, req);
    }
  }

  // No API route matched. GET falls through to the static app (if this
  // deployment serves one); everything else is a genuine 404.
  if (req.method === 'GET' && SERVE_STATIC) {
    return serveStatic(req, res, url.pathname);
  }

  sendError(res, 404, new Error('Not found'), req);
});

server.listen(PORT, () => {
  console.log(`sellify-backend listening on http://localhost:${PORT} (env=${NODE_ENV}, static=${SERVE_STATIC ? STATIC_DIR : 'disabled'})`);
});

