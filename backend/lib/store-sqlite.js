// SQLite-backed Sellify store.
import { normalizeTelegramCredentialRef, verifyTelegramBotCredential } from '../../app/src/platform/telegram-bot-credential-contract.js';
//
// Phase 5 replaces the old per-file JSON read/modify/write model with one
// transactional database. The JSON files remain readable as a one-time import
// source, but all new writes go through SQLite so catalog stock changes and
// marketplace orders can commit together.
//
// This uses Node's built-in node:sqlite module. The project runtime is Node
// 24+, which keeps the backend dependency-free while still giving us
// transactions, indexes, and a durable single-file database.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { assertVerificationFreshness } from './payments/verification-freshness.js';
import { requirePaymentProvider } from './payments/provider-registry.js';
import { requirePaymentChannel } from './payments/channel-registry.js';
import { decideEventReplay } from './event-replay.js';
import { assertPackLifecyclePrecondition, getPackLifecycleManifest } from './pack-lifecycle-readiness.js';
import { assertUntrustedPaymentEvidenceShape, normalizePaymentEvidenceSource } from './payments/payment-evidence-authority.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.SELLIFY_DATA_DIR
  ? path.resolve(process.env.SELLIFY_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const DB_PATH = path.resolve(process.env.SELLIFY_DB_PATH || path.join(DATA_DIR, 'sellify.sqlite'));
const BACKUP_DIR = path.resolve(process.env.SELLIFY_BACKUP_DIR || path.join(DATA_DIR, 'backups'));
const BACKUP_RETENTION = Math.max(1, Number(process.env.SELLIFY_BACKUP_RETENTION) || 7);

const LEGACY_FILES = {
  tenants: path.join(DATA_DIR, 'tenants.json'),
  catalogs: path.join(DATA_DIR, 'catalogs.json'),
  orders: path.join(DATA_DIR, 'orders.json'),
  phoneRouting: path.join(DATA_DIR, 'phone_routing.json'),
};

let db;

function nowIso() {
  return new Date().toISOString();
}

function parseJSON(value, fallback) {
  try {
    return value == null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function json(value) {
  return JSON.stringify(value == null ? null : value);
}

function sqlString(value) {
  return String(value).replaceAll("'", "''");
}

function readLegacy(file, fallback) {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    console.warn(`[sellify] Could not import legacy file ${file}: ${error.message}`);
    return fallback;
  }
}

function normalisePrice(raw) {
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function normaliseCurrency(raw, fallback = 'ETB') {
  const value = String(raw ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(value) ? value : String(fallback || 'ETB').trim().toUpperCase().match(/^[A-Z]{3}$/)?.[0] || 'ETB';
}

function tenantCurrency(chatId) {
  const row = db.prepare(`
    SELECT o.currency, t.branding_json
    FROM tenants t
    LEFT JOIN organizations o ON o.id = t.organization_id
    WHERE t.chat_id = ?
  `).get(String(chatId));
  const branding = parseJSON(row?.branding_json, {});
  return normaliseCurrency(row?.currency || branding?.currency, 'ETB');
}

function normaliseProduct(product) {
  const value = product && typeof product === 'object' ? { ...product } : {};
  value.name = typeof value.name === 'string' ? value.name.trim().slice(0, 200) : '';
  value.price = normalisePrice(value.price);
  value.currency = normaliseCurrency(value.currency, 'ETB');
  if (value.stock !== undefined && value.stock !== null) {
    const stock = Number(value.stock);
    value.stock = Number.isFinite(stock) ? Math.max(0, stock) : 0;
  }
  if (Array.isArray(value.tags)) value.tags = value.tags.filter(v => typeof v === 'string').slice(0, 50).map(v => v.slice(0, 80));
  if (Array.isArray(value.modifiers)) value.modifiers = value.modifiers.filter(v => typeof v === 'string').slice(0, 50).map(v => v.slice(0, 120));
  if (typeof value.category === 'string') value.category = value.category.trim().slice(0, 100);
  if (typeof value.unit === 'string') value.unit = value.unit.trim().slice(0, 40);
  if (typeof value.marketplace_listed !== 'boolean') value.marketplace_listed = Boolean(value.marketplace_listed);
  return value;
}

function validateAndTotalOrderItems(rawItems, expectedCurrency = null) {
  const items = [];
  for (const raw of Array.isArray(rawItems) ? rawItems : []) {
    if (!raw) continue;
    const qty = Number(raw.qty);
    const price = Number(raw.price);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) continue;
    const wholeQty = Math.floor(qty);
    if (wholeQty < 1) continue;
    if (raw.currency != null && expectedCurrency && normaliseCurrency(raw.currency, expectedCurrency) !== expectedCurrency) continue;
    items.push({ ...raw, qty: wholeQty, price: Math.round(price), ...(expectedCurrency ? { currency: expectedCurrency } : {}) });
  }
  return {
    items,
    total: items.reduce((sum, item) => sum + item.qty * item.price, 0),
  };
}

function audit(chatId, action, entityType, entityId, metadata = {}, context = {}) {
  const createdAt = nowIso();
  let organizationId = context.organizationId == null ? null : String(context.organizationId);
  if (!organizationId && chatId != null) {
    organizationId = db.prepare('SELECT organization_id FROM tenants WHERE chat_id = ?').get(String(chatId))?.organization_id || null;
  }
  const lineageType = context.lineageType == null ? null : String(context.lineageType);
  const lineageId = context.lineageId == null ? null : String(context.lineageId);
  const previousHash = organizationId
    ? (db.prepare('SELECT event_hash FROM audit_events WHERE organization_id = ? AND event_hash IS NOT NULL ORDER BY id DESC LIMIT 1').get(organizationId)?.event_hash || null)
    : null;
  const metadataJson = json(metadata || {});
  const result = String(context.result || 'success');
  const actionValue = String(action || '');
  const entityTypeValue = String(entityType || '');
  const entityIdValue = entityId == null ? null : String(entityId);
  const canonical = [
    previousHash || '', organizationId || '', String(chatId ?? ''), String(context.locationId ?? ''),
    String(context.actorId ?? ''), String(context.deviceId ?? ''), actionValue, entityTypeValue,
    entityIdValue || '', String(context.reason || ''), result, metadataJson, createdAt,
    lineageType || '', lineageId || '',
  ].join('|');
  const eventHash = crypto.createHash('sha256').update(canonical).digest('hex');
  const info = db.prepare(`
    INSERT INTO audit_events
      (chat_id, organization_id, location_id, actor_id, device_id, action, entity_type, entity_id, reason, result, metadata_json, created_at, previous_hash, event_hash, lineage_type, lineage_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    chatId == null ? null : String(chatId),
    organizationId,
    context.locationId == null ? null : String(context.locationId),
    context.actorId == null ? null : String(context.actorId),
    actionValue,
    entityTypeValue,
    entityIdValue,
    String(context.reason || ''),
    result,
    metadataJson,
    createdAt,
    previousHash,
    eventHash,
    lineageType,
    lineageId,
  );
  return { id: Number(info.lastInsertRowid), eventHash, previousHash };
}

function runMigrations() {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map(row => row.version);
  if (!applied.includes(1)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        chat_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL UNIQUE,
        api_key TEXT NOT NULL,
        created_at TEXT NOT NULL,
        seller_name TEXT NOT NULL DEFAULT '',
        branding_json TEXT,
        vendor_code TEXT
      );

      CREATE TABLE IF NOT EXISTS catalog_products (
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        product_json TEXT NOT NULL,
        price_minor INTEGER NOT NULL DEFAULT 0,
        stock REAL,
        marketplace_listed INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (chat_id, product_id)
      );
      CREATE INDEX IF NOT EXISTS idx_catalog_marketplace
        ON catalog_products (marketplace_listed, stock);

      CREATE TABLE IF NOT EXISTS orders (
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        local_id TEXT NOT NULL,
        server_order_id TEXT NOT NULL UNIQUE,
        order_json TEXT NOT NULL,
        total_minor INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL,
        delivered_to_device INTEGER NOT NULL DEFAULT 1,
        marketplace_order_id TEXT,
        is_marketplace INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (chat_id, local_id)
      );
      CREATE INDEX IF NOT EXISTS idx_orders_tenant_created
        ON orders (chat_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_orders_undelivered
        ON orders (chat_id, delivered_to_device);
      CREATE INDEX IF NOT EXISTS idx_orders_marketplace
        ON orders (marketplace_order_id);

      CREATE TABLE IF NOT EXISTS phone_routing (
        seller_phone TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_tenant_created
        ON audit_events (chat_id, created_at DESC);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(1, nowIso());
  }

  if (!applied.includes(2)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        telegram_user_id TEXT UNIQUE,
        display_name TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS memberships (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'owner',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        UNIQUE(user_id, chat_id)
      );
      CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON memberships(chat_id, status);
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        name TEXT NOT NULL DEFAULT 'Unnamed device',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_devices_tenant ON devices(chat_id, status);
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_hash ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_sessions_device ON sessions(device_id);
      CREATE TABLE IF NOT EXISTS auth_challenges (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT
      );
      CREATE TABLE IF NOT EXISTS pairing_challenges (
        token_hash TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'cashier',
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_pairing_challenges_tenant ON pairing_challenges(chat_id, expires_at);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(2, nowIso());
  }

  if (!applied.includes(3)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pairing_challenges (
        token_hash TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'cashier',
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_pairing_challenges_tenant ON pairing_challenges(chat_id, expires_at);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(3, nowIso());
  }

  if (!applied.includes(4)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS invites (
        token_hash TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE CASCADE,
        created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'cashier',
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        used_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        revoked_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_invites_tenant ON invites(chat_id, expires_at);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(4, nowIso());
  }
  if (!applied.includes(5)) {
    db.exec(`ALTER TABLE catalog_products ADD COLUMN stock_revision INTEGER NOT NULL DEFAULT 0;`);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(5, nowIso());
  }

  // Phase 10.1 — canonical identity foundation. This is deliberately additive:
  // legacy tenant/chat identifiers remain authoritative for compatibility while
  // every tenant receives one organization, one default STORE location, and one
  // Telegram chat channel identity. Existing users/memberships/devices/sessions
  // are not rewritten in this migration.
  if (!applied.includes(6)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        country TEXT NOT NULL DEFAULT '',
        currency TEXT NOT NULL DEFAULT 'ETB',
        timezone TEXT NOT NULL DEFAULT 'UTC',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL DEFAULT 'STORE',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        UNIQUE(organization_id, code)
      );
      CREATE INDEX IF NOT EXISTS idx_locations_org ON locations(organization_id, status);

      CREATE TABLE IF NOT EXISTS channel_identities (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        channel_type TEXT NOT NULL,
        channel_identifier TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(channel_type, channel_identifier)
      );
      CREATE INDEX IF NOT EXISTS idx_channel_identities_org ON channel_identities(organization_id, status);

      ALTER TABLE tenants ADD COLUMN organization_id TEXT REFERENCES organizations(id);
      CREATE INDEX IF NOT EXISTS idx_tenants_organization ON tenants(organization_id);

      ALTER TABLE audit_events ADD COLUMN organization_id TEXT REFERENCES organizations(id);
      CREATE INDEX IF NOT EXISTS idx_audit_organization_created ON audit_events(organization_id, created_at DESC);
    `);

    const tenants = db.prepare('SELECT chat_id, tenant_id, seller_name, branding_json, created_at, organization_id FROM tenants ORDER BY created_at, chat_id').all();
    for (const tenant of tenants) {
      let organizationId = tenant.organization_id;
      if (!organizationId) {
        organizationId = crypto.randomUUID();
        const branding = parseJSON(tenant.branding_json, {});
        db.prepare(`
          INSERT INTO organizations (id, name, country, currency, timezone, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          organizationId,
          tenant.seller_name || '',
          String(branding.country || ''),
          String(branding.currency || 'ETB'),
          String(branding.timezone || 'UTC'),
          tenant.created_at || nowIso()
        );
        db.prepare('UPDATE tenants SET organization_id = ? WHERE chat_id = ?').run(organizationId, tenant.chat_id);
      }

      const locationExists = db.prepare('SELECT id FROM locations WHERE organization_id = ? AND code = ?').get(organizationId, 'DEFAULT');
      if (!locationExists) {
        db.prepare(`
          INSERT INTO locations (id, organization_id, code, name, type, status, created_at)
          VALUES (?, ?, 'DEFAULT', ?, 'STORE', 'active', ?)
        `).run(crypto.randomUUID(), organizationId, tenant.seller_name || 'Main Store', tenant.created_at || nowIso());
      }

      const channelExists = db.prepare(`
        SELECT id FROM channel_identities
        WHERE channel_type = 'telegram_chat' AND channel_identifier = ?
      `).get(String(tenant.chat_id));
      if (!channelExists) {
        db.prepare(`
          INSERT INTO channel_identities
            (id, organization_id, channel_type, channel_identifier, status, metadata_json, created_at)
          VALUES (?, ?, 'telegram_chat', ?, 'active', ?, ?)
        `).run(crypto.randomUUID(), organizationId, String(tenant.chat_id), json({ legacy_tenant_id: tenant.tenant_id }), tenant.created_at || nowIso());
      }
    }

    db.prepare(`
      UPDATE audit_events
      SET organization_id = (SELECT organization_id FROM tenants WHERE tenants.chat_id = audit_events.chat_id)
      WHERE organization_id IS NULL AND chat_id IS NOT NULL
    `).run();

    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(6, nowIso());
  }

  // Phase 10.2 — organization/location hardening. Location types are now a
  // canonical contract used by inventory, fulfillment, and vertical packs.
  // Existing DEFAULT locations remain STORE locations. We add metadata rather
  // than rewriting existing tenant records.
  if (!applied.includes(7)) {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_locations_org_code ON locations(organization_id, code);
      CREATE INDEX IF NOT EXISTS idx_locations_org_type ON locations(organization_id, type, status);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(7, nowIso());
  }

  // Phase 10.4 — canonical customer domain. This is additive: existing order
  // JSON remains authoritative for legacy records, while new/updated orders
  // may carry a relational customer_id. Customers belong to an organization
  // and may optionally be associated with a location without being duplicated
  // for every branch.
  if (!applied.includes(8)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        default_location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        customer_type TEXT NOT NULL DEFAULT 'retail',
        name TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        tax_id TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        source TEXT NOT NULL DEFAULT 'manual',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(organization_id, id)
      );
      CREATE INDEX IF NOT EXISTS idx_customers_org_updated
        ON customers(organization_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_customers_org_phone
        ON customers(organization_id, phone);
      CREATE INDEX IF NOT EXISTS idx_customers_org_name
        ON customers(organization_id, name);
      ALTER TABLE orders ADD COLUMN customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(chat_id, customer_id, created_at DESC);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(8, nowIso());
  }

  // Phase 10.5 — canonical inventory movement ledger. This is additive: the
  // existing catalog stock field and local stockTransactions remain intact.
  // The ledger starts with a deterministic OPENING_BALANCE projection for
  // each currently tracked product, then records future movements without
  // changing the existing stock mutation path. This lets us validate the
  // ledger before making it authoritative for stock calculations.
  if (!applied.includes(9)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL UNIQUE,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
        product_id TEXT NOT NULL,
        quantity REAL NOT NULL,
        movement_type TEXT NOT NULL,
        reference_type TEXT,
        reference_id TEXT,
        actor_id TEXT,
        device_id TEXT,
        occurred_at TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        metadata_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_inventory_movements_org_product_time
        ON inventory_movements(organization_id, product_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_inventory_movements_location_product_time
        ON inventory_movements(location_id, product_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference
        ON inventory_movements(reference_type, reference_id);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(9, nowIso());
  }
  if (!applied.includes(10)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_events (
        event_id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        aggregate_type TEXT NOT NULL,
        aggregate_id TEXT,
        payload_json TEXT NOT NULL,
        actor_id TEXT,
        device_id TEXT,
        occurred_at TEXT NOT NULL,
        received_at TEXT NOT NULL,
        processed_at TEXT,
        status TEXT NOT NULL DEFAULT 'processed',
        error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sync_events_org_time ON sync_events(organization_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sync_events_org_type ON sync_events(organization_id, event_type);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(10, nowIso());
  }

  // Phase 10.7 — compliance / audit hardening. This is additive: the
  // historical audit_events contract remains intact while canonical audit
  // context, immutable storage, retention policy metadata, and privacy
  // request workflow are introduced beside it.
  if (!applied.includes(11)) {
    db.exec(`
      ALTER TABLE audit_events ADD COLUMN actor_id TEXT;
      ALTER TABLE audit_events ADD COLUMN location_id TEXT;
      ALTER TABLE audit_events ADD COLUMN device_id TEXT;
      ALTER TABLE audit_events ADD COLUMN reason TEXT NOT NULL DEFAULT '';
      ALTER TABLE audit_events ADD COLUMN result TEXT NOT NULL DEFAULT 'success';

      CREATE INDEX IF NOT EXISTS idx_audit_org_time
        ON audit_events(organization_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_actor_time
        ON audit_events(actor_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_entity_time
        ON audit_events(entity_type, entity_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS audit_retention_policies (
        organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
        retention_days INTEGER NOT NULL DEFAULT 365,
        updated_at TEXT NOT NULL,
        updated_by TEXT
      );

      CREATE TABLE IF NOT EXISTS compliance_requests (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        request_type TEXT NOT NULL,
        subject_type TEXT NOT NULL,
        subject_id TEXT,
        requested_by TEXT,
        reason TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        resolution_note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_compliance_requests_org_status
        ON compliance_requests(organization_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_compliance_requests_subject
        ON compliance_requests(subject_type, subject_id, created_at DESC);

      UPDATE audit_events
      SET organization_id = (
        SELECT t.organization_id FROM tenants t WHERE t.chat_id = audit_events.chat_id
      )
      WHERE organization_id IS NULL AND chat_id IS NOT NULL;

      CREATE TRIGGER IF NOT EXISTS audit_events_no_update
      BEFORE UPDATE ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'audit_events are append-only');
      END;

      CREATE TRIGGER IF NOT EXISTS audit_events_no_delete
      BEFORE DELETE ON audit_events
      BEGIN
        SELECT RAISE(ABORT, 'audit_events are append-only');
      END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(11, nowIso());
  }

  // Phase 11.1 — canonical money contract. Existing integer minor-unit
  // fields remain authoritative; currency becomes explicit on catalog and
  // order records. Legacy rows inherit the organization/tenant currency.
  if (!applied.includes(12)) {
    db.exec(`
      ALTER TABLE catalog_products ADD COLUMN currency TEXT NOT NULL DEFAULT 'ETB';
      ALTER TABLE orders ADD COLUMN currency TEXT NOT NULL DEFAULT 'ETB';

      UPDATE catalog_products
      SET currency = COALESCE((
        SELECT json_extract(t.branding_json, '$.currency')
        FROM tenants t WHERE t.chat_id = catalog_products.chat_id
      ), 'ETB')
      WHERE currency = 'ETB';

      UPDATE orders
      SET currency = COALESCE((
        SELECT json_extract(t.branding_json, '$.currency')
        FROM tenants t WHERE t.chat_id = orders.chat_id
      ), 'ETB')
      WHERE currency = 'ETB';

      CREATE INDEX IF NOT EXISTS idx_catalog_currency
        ON catalog_products(chat_id, currency);
      CREATE INDEX IF NOT EXISTS idx_orders_currency
        ON orders(chat_id, currency);
    `);

    const normalizeStoredCurrencies = db.prepare('UPDATE catalog_products SET currency = ? WHERE chat_id = ? AND currency != ?');
    for (const tenant of db.prepare('SELECT chat_id, branding_json FROM tenants').all()) {
      const currency = normaliseCurrency(parseJSON(tenant.branding_json, {})?.currency, 'ETB');
      normalizeStoredCurrencies.run(currency, String(tenant.chat_id), currency);
      db.prepare('UPDATE orders SET currency = ? WHERE chat_id = ? AND currency != ?').run(currency, String(tenant.chat_id), currency);
    }

    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(12, nowIso());
  }
  if (!applied.includes(13)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_accounts (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL,
        account_identifier TEXT NOT NULL DEFAULT '',
        phone TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_payment_accounts_org
        ON payment_accounts(organization_id, status);

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        order_id TEXT,
        customer_id TEXT,
        payment_account_id TEXT REFERENCES payment_accounts(id) ON DELETE SET NULL,
        provider_id TEXT NOT NULL DEFAULT 'manual',
        channel TEXT NOT NULL DEFAULT 'manual' CHECK (channel IN ('manual','sms','api')),
        method_id TEXT,
        method_name TEXT,
        amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
        currency TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'UNPAID' CHECK (state IN ('UNPAID','CLAIMED','RECEIVED','VERIFIED','RECONCILED','REJECTED','DUPLICATE','MISMATCH','EXPIRED','PARTIAL','REFUNDED')),
        external_reference TEXT,
        claimed_at TEXT,
        received_at TEXT,
        verified_at TEXT,
        reconciled_at TEXT,
        metadata_json TEXT,
        created_by_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_payments_org_created
        ON payments(organization_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payments_order
        ON payments(organization_id, order_id);
      CREATE INDEX IF NOT EXISTS idx_payments_state
        ON payments(organization_id, state);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_external_reference
        ON payments(organization_id, provider_id, external_reference)
        WHERE external_reference IS NOT NULL AND external_reference != '';

      CREATE TABLE IF NOT EXISTS payment_ledger_entries (
        id TEXT PRIMARY KEY,
        payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        entry_type TEXT NOT NULL CHECK (entry_type IN ('CREATED','CLAIMED','RECEIVED','VERIFIED','RECONCILED','REJECTED','DUPLICATE','MISMATCH','EXPIRED','PARTIAL','REFUNDED')),
        amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
        currency TEXT NOT NULL,
        from_state TEXT,
        to_state TEXT NOT NULL,
        actor_id TEXT,
        reason TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_payment_ledger_payment
        ON payment_ledger_entries(payment_id, created_at);

      CREATE TABLE IF NOT EXISTS payment_reconciliations (
        id TEXT PRIMARY KEY,
        payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','matched','mismatched')),
        external_reference TEXT,
        amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
        currency TEXT NOT NULL,
        reason TEXT,
        actor_id TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_org
        ON payment_reconciliations(organization_id, status, created_at DESC);

      CREATE TRIGGER IF NOT EXISTS trg_payment_ledger_no_update
      BEFORE UPDATE ON payment_ledger_entries
      BEGIN SELECT RAISE(ABORT, 'payment ledger entries are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS trg_payment_ledger_no_delete
      BEFORE DELETE ON payment_ledger_entries
      BEGIN SELECT RAISE(ABORT, 'payment ledger entries are append-only'); END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(13, nowIso());
  }

  // Phase 11.3 — canonical B2B custom pricing. Existing local B2B pricing
  // tiers remain intact; this additive contract lets a canonical Business
  // Customer receive an explicit product price without creating a parallel
  // customer/order universe. Historical rows are never overwritten.
  if (!applied.includes(14)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS customer_pricing_rules (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
        currency TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
        effective_from TEXT,
        effective_to TEXT,
        reason TEXT NOT NULL DEFAULT '',
        created_by_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(organization_id, customer_id, product_id)
      );
      CREATE INDEX IF NOT EXISTS idx_customer_pricing_org_customer
        ON customer_pricing_rules(organization_id, customer_id, status);
      CREATE INDEX IF NOT EXISTS idx_customer_pricing_org_product
        ON customer_pricing_rules(organization_id, product_id, status);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(14, nowIso());
  }

  // Phase 11.3 — canonical B2B quotes. Quotes snapshot customer/product/money
  // terms at creation time and do not mutate existing orders. They provide the
  // controlled document/workflow bridge before PO approval and invoicing.
  if (!applied.includes(15)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS quotes (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
        quote_number TEXT NOT NULL,
        currency TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED','CANCELLED')),
        subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
        total_minor INTEGER NOT NULL CHECK (total_minor >= 0),
        valid_until TEXT,
        notes TEXT NOT NULL DEFAULT '',
        terms TEXT NOT NULL DEFAULT '',
        created_by_user_id TEXT,
        sent_at TEXT,
        accepted_at TEXT,
        rejected_at TEXT,
        cancelled_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(organization_id, quote_number)
      );
      CREATE TABLE IF NOT EXISTS quote_items (
        id TEXT PRIMARY KEY,
        quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
        currency TEXT NOT NULL,
        line_total_minor INTEGER NOT NULL CHECK (line_total_minor >= 0),
        pricing_rule_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_quotes_org_customer
        ON quotes(organization_id, customer_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_quotes_org_status
        ON quotes(organization_id, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_quote_items_quote
        ON quote_items(quote_id);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(15, nowIso());
  }

  // Phase 11.3 — canonical B2B purchase orders and approval workflow.
  // This is additive: accepted quotes are snapshotted into a PO, while the
  // existing order system remains unchanged until a later controlled bridge.
  if (!applied.includes(16)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
        quote_id TEXT NOT NULL REFERENCES quotes(id) ON DELETE RESTRICT,
        po_number TEXT NOT NULL,
        currency TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED')),
        subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
        total_minor INTEGER NOT NULL CHECK (total_minor >= 0),
        buyer_reference TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        rejection_reason TEXT NOT NULL DEFAULT '',
        created_by_user_id TEXT,
        submitted_at TEXT,
        approved_at TEXT,
        approved_by_user_id TEXT,
        rejected_at TEXT,
        cancelled_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(organization_id, po_number),
        UNIQUE(organization_id, quote_id)
      );
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id TEXT PRIMARY KEY,
        purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
        currency TEXT NOT NULL,
        line_total_minor INTEGER NOT NULL CHECK (line_total_minor >= 0),
        quote_item_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_purchase_orders_org_customer
        ON purchase_orders(organization_id, customer_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_purchase_orders_org_status
        ON purchase_orders(organization_id, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order
        ON purchase_order_items(purchase_order_id);

      CREATE TRIGGER IF NOT EXISTS trg_purchase_order_items_no_update_after_approval
      BEFORE UPDATE OF quantity, unit_price_minor, currency, line_total_minor, product_id, description ON purchase_order_items
      WHEN EXISTS (SELECT 1 FROM purchase_orders WHERE id = OLD.purchase_order_id AND status IN ('SUBMITTED','APPROVED','REJECTED','CANCELLED'))
      BEGIN SELECT RAISE(ABORT, 'submitted purchase order items are immutable'); END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(16, nowIso());
  }

  // Phase 11.3 — canonical B2B credit terms. This is additive: approved
  // credit terms attach to an existing Business Customer and define a
  // currency-scoped credit limit plus payment-due days. They do not yet
  // create receivables or alter the existing Order/Payment paths; those are
  // introduced later by the Accounts Receivable phase.
  if (!applied.includes(17)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS customer_credit_terms (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
        currency TEXT NOT NULL,
        credit_limit_minor INTEGER NOT NULL CHECK (credit_limit_minor >= 0),
        payment_due_days INTEGER NOT NULL DEFAULT 0 CHECK (payment_due_days >= 0 AND payment_due_days <= 365),
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','SUSPENDED','EXPIRED','CANCELLED')),
        requires_po INTEGER NOT NULL DEFAULT 1 CHECK (requires_po IN (0,1)),
        effective_from TEXT,
        effective_to TEXT,
        notes TEXT NOT NULL DEFAULT '',
        reason TEXT NOT NULL DEFAULT '',
        created_by_user_id TEXT,
        approved_by_user_id TEXT,
        approved_at TEXT,
        rejected_by_user_id TEXT,
        rejected_at TEXT,
        suspended_by_user_id TEXT,
        suspended_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(organization_id, customer_id)
      );
      CREATE INDEX IF NOT EXISTS idx_credit_terms_org_status
        ON customer_credit_terms(organization_id, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_credit_terms_org_customer
        ON customer_credit_terms(organization_id, customer_id);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(17, nowIso());
  // Phase 11.3 — canonical Accounts Receivable. Receivables are obligations
  // backed by an approved B2B purchase order or an existing order. This phase
  // does not create invoices; Invoice is the next B2B increment.
  if (!applied.includes(18)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS accounts_receivable (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
        credit_terms_id TEXT REFERENCES customer_credit_terms(id) ON DELETE SET NULL,
        source_type TEXT NOT NULL CHECK (source_type IN ('purchase_order','order','invoice')),
        source_id TEXT NOT NULL,
        currency TEXT NOT NULL,
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        outstanding_minor INTEGER NOT NULL CHECK (outstanding_minor >= 0 AND outstanding_minor <= amount_minor),
        due_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','PARTIAL','PAID','OVERDUE','WRITTEN_OFF','CANCELLED')),
        notes TEXT NOT NULL DEFAULT '',
        created_by_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(organization_id, source_type, source_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ar_org_status
        ON accounts_receivable(organization_id, status, due_at);
      CREATE INDEX IF NOT EXISTS idx_ar_org_customer
        ON accounts_receivable(organization_id, customer_id, status);

      CREATE TABLE IF NOT EXISTS ar_ledger_entries (
        id TEXT PRIMARY KEY,
        receivable_id TEXT NOT NULL REFERENCES accounts_receivable(id) ON DELETE CASCADE,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        entry_type TEXT NOT NULL CHECK (entry_type IN ('CHARGE','PAYMENT','ADJUSTMENT','WRITE_OFF','CANCELLED')),
        amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
        currency TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT NOT NULL,
        payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
        actor_id TEXT,
        reason TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ar_ledger_receivable
        ON ar_ledger_entries(receivable_id, created_at);

      CREATE TABLE IF NOT EXISTS ar_payment_allocations (
        id TEXT PRIMARY KEY,
        receivable_id TEXT NOT NULL REFERENCES accounts_receivable(id) ON DELETE CASCADE,
        payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        currency TEXT NOT NULL,
        actor_id TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(receivable_id, payment_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ar_alloc_payment
        ON ar_payment_allocations(organization_id, payment_id);

      CREATE TRIGGER IF NOT EXISTS trg_ar_ledger_no_update
      BEFORE UPDATE ON ar_ledger_entries
      BEGIN SELECT RAISE(ABORT, 'AR ledger entries are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS trg_ar_ledger_no_delete
      BEFORE DELETE ON ar_ledger_entries
      BEGIN SELECT RAISE(ABORT, 'AR ledger entries are append-only'); END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(18, nowIso());
  }
  // Phase 11.3 — canonical invoice document over the established AR boundary.
  if (!applied.includes(19)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
        receivable_id TEXT NOT NULL REFERENCES accounts_receivable(id) ON DELETE RESTRICT,
        invoice_number TEXT NOT NULL,
        currency TEXT NOT NULL,
        subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
        total_minor INTEGER NOT NULL CHECK (total_minor > 0),
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ISSUED','VOID','CANCELLED')),
        issued_at TEXT,
        due_at TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_by_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(organization_id, invoice_number),
        UNIQUE(organization_id, receivable_id)
      );
      CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON invoices(organization_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_invoices_org_customer ON invoices(organization_id, customer_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS invoice_items (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        product_id TEXT,
        description TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
        line_total_minor INTEGER NOT NULL CHECK (line_total_minor >= 0),
        currency TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(19, nowIso());
  }

  if (!applied.includes(20)) {
    db.exec(`
      -- Phase 11.4 — canonical marketplace integrity boundary. Existing
      -- seller orders remain in the legacy orders table; these tables provide
      -- additive canonical projections and transaction-control records.
      CREATE TABLE IF NOT EXISTS marketplace_orders (
        id TEXT PRIMARY KEY,
        buyer_identity TEXT NOT NULL,
        customer_name TEXT NOT NULL DEFAULT '',
        customer_phone TEXT NOT NULL DEFAULT '',
        currency TEXT NOT NULL,
        total_minor INTEGER NOT NULL CHECK (total_minor >= 0),
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','confirmed','preparing','ready','completed','cancelled')),
        tracking_token_hash TEXT NOT NULL,
        idempotency_key TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_orders_idempotency
        ON marketplace_orders(idempotency_key)
        WHERE idempotency_key IS NOT NULL AND idempotency_key != '';
      CREATE INDEX IF NOT EXISTS idx_marketplace_orders_buyer
        ON marketplace_orders(buyer_identity, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status
        ON marketplace_orders(status, created_at DESC);

      CREATE TABLE IF NOT EXISTS marketplace_seller_orders (
        id TEXT PRIMARY KEY,
        marketplace_order_id TEXT NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
        seller_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE RESTRICT,
        seller_order_id TEXT NOT NULL,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        currency TEXT NOT NULL,
        subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
        status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','confirmed','preparing','ready','completed','cancelled')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(marketplace_order_id, seller_id),
        UNIQUE(seller_order_id)
      );
      CREATE INDEX IF NOT EXISTS idx_marketplace_seller_orders_seller
        ON marketplace_seller_orders(organization_id, status, created_at DESC);

      CREATE TABLE IF NOT EXISTS marketplace_fulfillments (
        id TEXT PRIMARY KEY,
        seller_order_id TEXT NOT NULL REFERENCES marketplace_seller_orders(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','out_for_delivery','delivered','picked_up','cancelled')),
        fulfillment_type TEXT NOT NULL DEFAULT 'delivery' CHECK (fulfillment_type IN ('delivery','pickup')),
        tracking_reference TEXT,
        proof_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_marketplace_fulfillments_order
        ON marketplace_fulfillments(seller_order_id, status);

      CREATE TABLE IF NOT EXISTS marketplace_inventory_reservations (
        id TEXT PRIMARY KEY,
        marketplace_order_id TEXT NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
        seller_order_id TEXT NOT NULL REFERENCES marketplace_seller_orders(id) ON DELETE CASCADE,
        seller_id TEXT NOT NULL REFERENCES tenants(chat_id) ON DELETE RESTRICT,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','consumed','released')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(seller_order_id, product_id)
      );
      CREATE INDEX IF NOT EXISTS idx_marketplace_reservations_product
        ON marketplace_inventory_reservations(seller_id, product_id, status);

      CREATE TABLE IF NOT EXISTS marketplace_payment_allocations (
        id TEXT PRIMARY KEY,
        marketplace_order_id TEXT NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
        seller_order_id TEXT NOT NULL REFERENCES marketplace_seller_orders(id) ON DELETE CASCADE,
        payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
        currency TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID','PARTIAL','ALLOCATED','REFUNDED')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(seller_order_id, payment_id)
      );
      CREATE INDEX IF NOT EXISTS idx_marketplace_payment_allocations_order
        ON marketplace_payment_allocations(marketplace_order_id, status);

      CREATE TABLE IF NOT EXISTS marketplace_settlements (
        id TEXT PRIMARY KEY,
        marketplace_order_id TEXT NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
        seller_order_id TEXT NOT NULL REFERENCES marketplace_seller_orders(id) ON DELETE CASCADE,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
        currency TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','READY','SETTLED','HELD','REVERSED')),
        created_at TEXT NOT NULL,
        settled_at TEXT,
        UNIQUE(seller_order_id)
      );
      CREATE INDEX IF NOT EXISTS idx_marketplace_settlements_org_status
        ON marketplace_settlements(organization_id, status, created_at DESC);

      CREATE TABLE IF NOT EXISTS marketplace_refunds (
        id TEXT PRIMARY KEY,
        marketplace_order_id TEXT NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
        seller_order_id TEXT NOT NULL REFERENCES marketplace_seller_orders(id) ON DELETE CASCADE,
        payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        currency TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','REQUESTED','PROCESSED','REJECTED')),
        created_at TEXT NOT NULL,
        processed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_marketplace_refunds_order
        ON marketplace_refunds(marketplace_order_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS marketplace_checkout_idempotency (
        id TEXT PRIMARY KEY,
        idempotency_key TEXT NOT NULL UNIQUE,
        buyer_identity TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        response_json TEXT NOT NULL,
        marketplace_order_id TEXT NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_marketplace_checkout_idem_buyer
        ON marketplace_checkout_idempotency(buyer_identity, created_at DESC);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(20, nowIso());
  }

  // Phase 17.1 — deterministic procurement demand foundation. Demand is the
  // procurement domain's intake authority only; supplier discovery, RFQ,
  // responses, award, B2B PO creation, fulfillment, inventory, payment and
  // settlement remain separate authorities and are intentionally absent here.
  if (!applied.includes(21)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS procurement_demands (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        request_number TEXT NOT NULL,
        requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','SOURCING','AWARDED','EXPIRED','CANCELLED')),
        currency TEXT NOT NULL,
        required_by TEXT,
        delivery_location_id TEXT REFERENCES locations(id) ON DELETE RESTRICT,
        notes TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'MANUAL',
        source_system TEXT,
        source_object_id TEXT,
        idempotency_key TEXT,
        request_hash TEXT,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        submitted_at TEXT,
        cancelled_at TEXT,
        expired_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(organization_id, request_number),
        UNIQUE(organization_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_demands_org_status
        ON procurement_demands(organization_id, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_procurement_demands_requester
        ON procurement_demands(organization_id, requester_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_procurement_demands_source
        ON procurement_demands(organization_id, source, source_object_id);

      CREATE TABLE IF NOT EXISTS procurement_demand_items (
        id TEXT PRIMARY KEY,
        demand_id TEXT NOT NULL REFERENCES procurement_demands(id) ON DELETE CASCADE,
        product_id TEXT,
        description TEXT NOT NULL DEFAULT '',
        specification TEXT NOT NULL DEFAULT '',
        quantity REAL NOT NULL CHECK (quantity > 0),
        unit TEXT NOT NULL,
        target_price_minor INTEGER CHECK (target_price_minor IS NULL OR target_price_minor >= 0),
        currency TEXT NOT NULL,
        required_by TEXT,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_demand_items_demand
        ON procurement_demand_items(demand_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_procurement_demand_items_product
        ON procurement_demand_items(product_id);

      CREATE TRIGGER IF NOT EXISTS procurement_demands_no_core_update_after_submit
      BEFORE UPDATE OF organization_id, requester_id, currency, delivery_location_id, source, source_system, source_object_id, idempotency_key, request_hash
      ON procurement_demands
      WHEN OLD.status <> 'DRAFT'
      BEGIN
        SELECT RAISE(ABORT, 'Submitted procurement demand core fields are immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS procurement_demand_items_no_update_after_submit
      BEFORE UPDATE ON procurement_demand_items
      WHEN (SELECT status FROM procurement_demands WHERE id = OLD.demand_id) <> 'DRAFT'
      BEGIN
        SELECT RAISE(ABORT, 'Submitted procurement demand items are immutable');
      END;

      CREATE TRIGGER IF NOT EXISTS procurement_demand_items_no_delete_after_submit
      BEFORE DELETE ON procurement_demand_items
      WHEN (SELECT status FROM procurement_demands WHERE id = OLD.demand_id) <> 'DRAFT'
      BEGIN
        SELECT RAISE(ABORT, 'Submitted procurement demand items cannot be deleted');
      END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(21, nowIso());
  }

  // Phase 17.2 — supplier participation/discovery. Organization remains the identity authority.
  if (!applied.includes(22)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS procurement_supplier_participants (
        organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED')),
        discoverable INTEGER NOT NULL DEFAULT 1 CHECK (discoverable IN (0,1)),
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_supplier_discovery ON procurement_supplier_participants(status, discoverable, updated_at DESC);
      CREATE TABLE IF NOT EXISTS procurement_supplier_relationships (
        id TEXT PRIMARY KEY,
        buyer_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        supplier_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','BLOCKED','DECLINED')),
        source TEXT NOT NULL DEFAULT 'DIRECT' CHECK (source IN ('DIRECT','DISCOVERY','MARKETPLACE')),
        notes TEXT NOT NULL DEFAULT '',
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE(buyer_organization_id, supplier_organization_id),
        CHECK (buyer_organization_id <> supplier_organization_id)
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_supplier_relationships_buyer ON procurement_supplier_relationships(buyer_organization_id, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_procurement_supplier_relationships_supplier ON procurement_supplier_relationships(supplier_organization_id, status, updated_at DESC);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(22, nowIso());
  }


  // Phase 17.3 — deterministic RFQ and supplier response foundation. RFQ is
  // procurement-owned and remains distinct from the existing B2B Quote.
  if (!applied.includes(23)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS procurement_rfqs (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        demand_id TEXT NOT NULL REFERENCES procurement_demands(id) ON DELETE RESTRICT,
        rfq_number TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SENT','CLOSED','EXPIRED','CANCELLED')),
        currency TEXT NOT NULL,
        response_due TEXT,
        notes TEXT NOT NULL DEFAULT '',
        idempotency_key TEXT,
        request_hash TEXT,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        sent_at TEXT,
        closed_at TEXT,
        expired_at TEXT,
        cancelled_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE(organization_id, rfq_number),
        UNIQUE(organization_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_rfqs_org_status ON procurement_rfqs(organization_id,status,updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_procurement_rfqs_demand ON procurement_rfqs(organization_id,demand_id);

      CREATE TABLE IF NOT EXISTS procurement_rfq_items (
        id TEXT PRIMARY KEY,
        rfq_id TEXT NOT NULL REFERENCES procurement_rfqs(id) ON DELETE CASCADE,
        demand_item_id TEXT NOT NULL REFERENCES procurement_demand_items(id) ON DELETE RESTRICT,
        product_id TEXT,
        description TEXT NOT NULL,
        specification TEXT NOT NULL DEFAULT '',
        quantity REAL NOT NULL CHECK (quantity > 0),
        unit TEXT NOT NULL,
        currency TEXT NOT NULL,
        required_by TEXT,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE(rfq_id,demand_item_id)
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_rfq_items_rfq ON procurement_rfq_items(rfq_id,created_at,id);

      CREATE TABLE IF NOT EXISTS procurement_rfq_suppliers (
        id TEXT PRIMARY KEY,
        rfq_id TEXT NOT NULL REFERENCES procurement_rfqs(id) ON DELETE CASCADE,
        supplier_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'INVITED' CHECK (status IN ('INVITED','RESPONSE_RECEIVED','DECLINED','REMOVED')),
        invited_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE(rfq_id,supplier_organization_id)
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_rfq_suppliers_supplier ON procurement_rfq_suppliers(supplier_organization_id,status,updated_at DESC);

      CREATE TABLE IF NOT EXISTS procurement_rfq_responses (
        id TEXT PRIMARY KEY,
        rfq_id TEXT NOT NULL REFERENCES procurement_rfqs(id) ON DELETE CASCADE,
        supplier_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','WITHDRAWN','REJECTED')),
        currency TEXT NOT NULL,
        valid_until TEXT,
        notes TEXT NOT NULL DEFAULT '',
        idempotency_key TEXT,
        request_hash TEXT,
        submitted_at TEXT,
        withdrawn_at TEXT,
        rejected_at TEXT,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE(rfq_id,supplier_organization_id),
        UNIQUE(supplier_organization_id,idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_rfq_responses_rfq ON procurement_rfq_responses(rfq_id,status,updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_procurement_rfq_responses_supplier ON procurement_rfq_responses(supplier_organization_id,status,updated_at DESC);

      CREATE TABLE IF NOT EXISTS procurement_rfq_response_items (
        id TEXT PRIMARY KEY,
        response_id TEXT NOT NULL REFERENCES procurement_rfq_responses(id) ON DELETE CASCADE,
        rfq_item_id TEXT NOT NULL REFERENCES procurement_rfq_items(id) ON DELETE RESTRICT,
        offered_quantity REAL NOT NULL CHECK (offered_quantity > 0),
        unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
        currency TEXT NOT NULL,
        lead_time_days INTEGER CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(response_id,rfq_item_id)
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_rfq_response_items_response ON procurement_rfq_response_items(response_id,created_at,id);

      CREATE TRIGGER IF NOT EXISTS procurement_rfq_no_item_update_after_send
      BEFORE UPDATE ON procurement_rfq_items
      WHEN (SELECT status FROM procurement_rfqs WHERE id=OLD.rfq_id) <> 'DRAFT'
      BEGIN SELECT RAISE(ABORT,'Sent RFQ items are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS procurement_rfq_no_supplier_update_after_send
      BEFORE UPDATE OF supplier_organization_id ON procurement_rfq_suppliers
      WHEN (SELECT status FROM procurement_rfqs WHERE id=OLD.rfq_id) <> 'DRAFT'
      BEGIN SELECT RAISE(ABORT,'Sent RFQ suppliers are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS procurement_rfq_response_items_no_update_after_submit
      BEFORE UPDATE ON procurement_rfq_response_items
      WHEN (SELECT status FROM procurement_rfq_responses WHERE id=OLD.response_id) <> 'DRAFT'
      BEGIN SELECT RAISE(ABORT,'Submitted RFQ response items are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS procurement_rfq_response_items_no_delete_after_submit
      BEFORE DELETE ON procurement_rfq_response_items
      WHEN (SELECT status FROM procurement_rfq_responses WHERE id=OLD.response_id) <> 'DRAFT'
      BEGIN SELECT RAISE(ABORT,'Submitted RFQ response items cannot be deleted'); END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(23, nowIso());
  }

  // Phase 17.4 — deterministic, versioned RFQ comparison snapshots.
  // Comparison is procurement-owned; it never creates an award or mutates
  // B2B quotes, purchase orders, inventory, payments, or settlement.
  if (!applied.includes(24)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS procurement_comparisons (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        rfq_id TEXT NOT NULL REFERENCES procurement_rfqs(id) ON DELETE RESTRICT,
        version INTEGER NOT NULL CHECK (version > 0),
        status TEXT NOT NULL DEFAULT 'FINAL' CHECK (status IN ('FINAL')),
        currency TEXT NOT NULL,
        policy_version TEXT NOT NULL DEFAULT '1.0',
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        UNIQUE(rfq_id, version)
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_comparisons_rfq ON procurement_comparisons(organization_id,rfq_id,version DESC);
      CREATE TABLE IF NOT EXISTS procurement_comparison_suppliers (
        id TEXT PRIMARY KEY,
        comparison_id TEXT NOT NULL REFERENCES procurement_comparisons(id) ON DELETE CASCADE,
        supplier_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        response_id TEXT NOT NULL REFERENCES procurement_rfq_responses(id) ON DELETE RESTRICT,
        requested_line_count INTEGER NOT NULL CHECK (requested_line_count >= 0),
        quoted_line_count INTEGER NOT NULL CHECK (quoted_line_count >= 0),
        complete_coverage INTEGER NOT NULL CHECK (complete_coverage IN (0,1)),
        requested_quantity_total REAL NOT NULL CHECK (requested_quantity_total >= 0),
        covered_quantity_total REAL NOT NULL CHECK (covered_quantity_total >= 0),
        coverage_ratio REAL NOT NULL CHECK (coverage_ratio >= 0 AND coverage_ratio <= 1),
        comparable_total_minor INTEGER NOT NULL CHECK (comparable_total_minor >= 0),
        max_lead_time_days INTEGER CHECK (max_lead_time_days IS NULL OR max_lead_time_days >= 0),
        valid_until TEXT,
        eligible INTEGER NOT NULL CHECK (eligible IN (0,1)),
        rank INTEGER CHECK (rank IS NULL OR rank > 0),
        created_at TEXT NOT NULL,
        UNIQUE(comparison_id,supplier_organization_id),
        UNIQUE(comparison_id,response_id)
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_comparison_suppliers_rank ON procurement_comparison_suppliers(comparison_id,eligible,rank);
      CREATE TABLE IF NOT EXISTS procurement_comparison_line_offers (
        id TEXT PRIMARY KEY,
        comparison_id TEXT NOT NULL REFERENCES procurement_comparisons(id) ON DELETE CASCADE,
        supplier_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        response_id TEXT NOT NULL REFERENCES procurement_rfq_responses(id) ON DELETE RESTRICT,
        rfq_item_id TEXT NOT NULL REFERENCES procurement_rfq_items(id) ON DELETE RESTRICT,
        requested_quantity REAL NOT NULL CHECK (requested_quantity > 0),
        offered_quantity REAL NOT NULL CHECK (offered_quantity > 0),
        covered_quantity REAL NOT NULL CHECK (covered_quantity >= 0),
        unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
        comparable_line_total_minor INTEGER NOT NULL CHECK (comparable_line_total_minor >= 0),
        lead_time_days INTEGER CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
        valid_until TEXT,
        coverage_complete INTEGER NOT NULL CHECK (coverage_complete IN (0,1)),
        line_rank INTEGER CHECK (line_rank IS NULL OR line_rank > 0),
        created_at TEXT NOT NULL,
        UNIQUE(comparison_id,supplier_organization_id,rfq_item_id)
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_comparison_lines_comparison ON procurement_comparison_line_offers(comparison_id,supplier_organization_id);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(24, nowIso());
  }

  // Phase 17.5 — explicit procurement award decision. Award is the
  // procurement decision authority only. It snapshots selected supplier
  // offers and quantities, but never creates B2B quotes/POs or mutates
  // orders, inventory, payments, AR, invoices, or settlement.
  if (!applied.includes(25)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS procurement_awards (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        demand_id TEXT NOT NULL REFERENCES procurement_demands(id) ON DELETE RESTRICT,
        rfq_id TEXT NOT NULL REFERENCES procurement_rfqs(id) ON DELETE RESTRICT,
        comparison_id TEXT NOT NULL REFERENCES procurement_comparisons(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','CONFIRMED','CANCELLED')),
        currency TEXT NOT NULL,
        award_number TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        idempotency_key TEXT,
        request_hash TEXT,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        confirmed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        confirmed_at TEXT,
        cancelled_at TEXT,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE(organization_id, award_number),
        UNIQUE(organization_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_awards_org_status
        ON procurement_awards(organization_id,status,updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_procurement_awards_demand
        ON procurement_awards(organization_id,demand_id,created_at DESC);
      CREATE TABLE IF NOT EXISTS procurement_award_lines (
        id TEXT PRIMARY KEY,
        award_id TEXT NOT NULL REFERENCES procurement_awards(id) ON DELETE CASCADE,
        rfq_item_id TEXT NOT NULL REFERENCES procurement_rfq_items(id) ON DELETE RESTRICT,
        supplier_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        response_id TEXT NOT NULL REFERENCES procurement_rfq_responses(id) ON DELETE RESTRICT,
        comparison_line_offer_id TEXT REFERENCES procurement_comparison_line_offers(id) ON DELETE RESTRICT,
        awarded_quantity REAL NOT NULL CHECK (awarded_quantity > 0),
        unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
        awarded_total_minor INTEGER NOT NULL CHECK (awarded_total_minor >= 0),
        currency TEXT NOT NULL,
        lead_time_days INTEGER CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
        valid_until TEXT,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE(award_id,rfq_item_id,supplier_organization_id)
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_award_lines_award
        ON procurement_award_lines(award_id,rfq_item_id);
      CREATE TRIGGER IF NOT EXISTS procurement_award_lines_no_update_after_confirm
      BEFORE UPDATE ON procurement_award_lines
      WHEN (SELECT status FROM procurement_awards WHERE id=OLD.award_id) <> 'DRAFT'
      BEGIN SELECT RAISE(ABORT,'Confirmed procurement award lines are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS procurement_award_lines_no_delete_after_confirm
      BEFORE DELETE ON procurement_award_lines
      WHEN (SELECT status FROM procurement_awards WHERE id=OLD.award_id) <> 'DRAFT'
      BEGIN SELECT RAISE(ABORT,'Confirmed procurement award lines cannot be deleted'); END;
      CREATE TRIGGER IF NOT EXISTS procurement_awards_no_core_update_after_confirm
      BEFORE UPDATE OF organization_id,demand_id,rfq_id,comparison_id,currency,idempotency_key,request_hash
      ON procurement_awards
      WHEN OLD.status <> 'DRAFT'
      BEGIN SELECT RAISE(ABORT,'Confirmed procurement award core fields are immutable'); END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(25, nowIso());
  }

  // Phase 17.6 — controlled procurement-to-B2B PO execution bridge. The
  // existing Purchase Order authority remains canonical, but it now supports
  // two explicit origins: an accepted B2B Quote (legacy path) or a confirmed
  // Procurement Award. Procurement-origin POs use supplier_organization_id
  // rather than manufacturing a duplicate Customer identity.
  if (!applied.includes(26)) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`
      CREATE TABLE purchase_orders_phase17_6_new (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        customer_id TEXT REFERENCES customers(id) ON DELETE RESTRICT,
        quote_id TEXT REFERENCES quotes(id) ON DELETE RESTRICT,
        procurement_award_id TEXT REFERENCES procurement_awards(id) ON DELETE RESTRICT,
        supplier_organization_id TEXT REFERENCES organizations(id) ON DELETE RESTRICT,
        source_type TEXT NOT NULL DEFAULT 'B2B_QUOTE' CHECK (source_type IN ('B2B_QUOTE','PROCUREMENT_AWARD')),
        po_number TEXT NOT NULL,
        currency TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED')),
        subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
        total_minor INTEGER NOT NULL CHECK (total_minor >= 0),
        buyer_reference TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        rejection_reason TEXT NOT NULL DEFAULT '',
        created_by_user_id TEXT,
        submitted_at TEXT,
        approved_at TEXT,
        approved_by_user_id TEXT,
        rejected_at TEXT,
        cancelled_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(organization_id, po_number),
        UNIQUE(organization_id, quote_id),
        UNIQUE(organization_id, procurement_award_id, supplier_organization_id),
        CHECK (
          (source_type = 'B2B_QUOTE' AND quote_id IS NOT NULL AND procurement_award_id IS NULL AND supplier_organization_id IS NULL AND customer_id IS NOT NULL)
          OR
          (source_type = 'PROCUREMENT_AWARD' AND quote_id IS NULL AND procurement_award_id IS NOT NULL AND supplier_organization_id IS NOT NULL AND customer_id IS NULL)
        )
      );
      INSERT INTO purchase_orders_phase17_6_new
        (id,organization_id,customer_id,quote_id,procurement_award_id,supplier_organization_id,source_type,po_number,currency,status,subtotal_minor,total_minor,buyer_reference,notes,rejection_reason,created_by_user_id,submitted_at,approved_at,approved_by_user_id,rejected_at,cancelled_at,created_at,updated_at)
      SELECT id,organization_id,customer_id,quote_id,NULL,NULL,'B2B_QUOTE',po_number,currency,status,subtotal_minor,total_minor,buyer_reference,notes,rejection_reason,created_by_user_id,submitted_at,approved_at,approved_by_user_id,rejected_at,cancelled_at,created_at,updated_at
      FROM purchase_orders;
      DROP TRIGGER IF EXISTS trg_purchase_order_items_no_update_after_approval;
      DROP TABLE purchase_orders;
      ALTER TABLE purchase_orders_phase17_6_new RENAME TO purchase_orders;
      CREATE INDEX idx_purchase_orders_org_customer ON purchase_orders(organization_id, customer_id, created_at DESC);
      CREATE INDEX idx_purchase_orders_org_supplier ON purchase_orders(organization_id, supplier_organization_id, created_at DESC);
      CREATE INDEX idx_purchase_orders_org_status ON purchase_orders(organization_id, status, updated_at DESC);
      CREATE INDEX idx_purchase_orders_org_source ON purchase_orders(organization_id, source_type, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(purchase_order_id);
      CREATE TRIGGER trg_purchase_order_items_no_update_after_approval
      BEFORE UPDATE OF quantity, unit_price_minor, currency, line_total_minor, product_id, description ON purchase_order_items
      WHEN EXISTS (SELECT 1 FROM purchase_orders WHERE id = OLD.purchase_order_id AND status IN ('SUBMITTED','APPROVED','REJECTED','CANCELLED'))
      BEGIN SELECT RAISE(ABORT, 'submitted purchase order items are immutable'); END;
      CREATE TRIGGER purchase_orders_phase17_6_source_immutable
      BEFORE UPDATE OF organization_id,customer_id,quote_id,procurement_award_id,supplier_organization_id,source_type
      ON purchase_orders
      WHEN OLD.status <> 'DRAFT'
      BEGIN SELECT RAISE(ABORT,'Purchase order source fields are immutable after DRAFT'); END;
    `);
    db.exec('PRAGMA foreign_keys = ON');
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(26, nowIso());
  }

  }

  // Phase 17.7 — procurement receiving. Receipt persistence is procurement
  // execution state; physical stock remains owned by the existing inventory
  // movement authority. Posted receipts are immutable and may be partial.
  if (!applied.includes(27)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS procurement_receipts (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
        location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
        receipt_number TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','POSTED','CANCELLED')),
        received_at TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        idempotency_key TEXT,
        request_hash TEXT,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        cancelled_at TEXT,
        UNIQUE(organization_id, receipt_number),
        UNIQUE(organization_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_receipts_po
        ON procurement_receipts(organization_id,purchase_order_id,received_at DESC);
      CREATE TABLE IF NOT EXISTS procurement_receipt_lines (
        id TEXT PRIMARY KEY,
        receipt_id TEXT NOT NULL REFERENCES procurement_receipts(id) ON DELETE CASCADE,
        purchase_order_item_id TEXT NOT NULL REFERENCES purchase_order_items(id) ON DELETE RESTRICT,
        product_id TEXT NOT NULL,
        received_quantity REAL NOT NULL CHECK (received_quantity > 0),
        notes TEXT NOT NULL DEFAULT '',
        event_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        UNIQUE(receipt_id,purchase_order_item_id)
      );
      CREATE INDEX IF NOT EXISTS idx_procurement_receipt_lines_receipt
        ON procurement_receipt_lines(receipt_id,purchase_order_item_id);
      CREATE TRIGGER IF NOT EXISTS procurement_receipt_lines_no_update
      BEFORE UPDATE ON procurement_receipt_lines
      BEGIN SELECT RAISE(ABORT,'Procurement receipt lines are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS procurement_receipt_lines_no_delete_after_posted
      BEFORE DELETE ON procurement_receipt_lines
      WHEN (SELECT status FROM procurement_receipts WHERE id=OLD.receipt_id)='POSTED'
      BEGIN SELECT RAISE(ABORT,'Posted procurement receipt lines cannot be deleted'); END;
      CREATE TRIGGER IF NOT EXISTS procurement_receipts_no_core_update_after_posted
      BEFORE UPDATE OF organization_id,purchase_order_id,location_id,receipt_number,status,received_at,idempotency_key,request_hash,created_by_user_id
      ON procurement_receipts
      WHEN OLD.status='POSTED'
      BEGIN SELECT RAISE(ABORT,'Posted procurement receipt is immutable'); END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(27, nowIso());
  }


  // Phase 17.8A — Payment Core outbound capability. Operational payment
  // instructions are owned by Payment Core and are not a second ledger.
  // No external funds move here; provider execution remains adapter work.
  if (!applied.includes(28)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_outbound_intents (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        counterparty_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        purchase_order_id TEXT REFERENCES purchase_orders(id) ON DELETE RESTRICT,
        provider_id TEXT NOT NULL DEFAULT 'manual',
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        currency TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'DRAFT' CHECK (state IN ('DRAFT','INITIATED','SUBMITTED','CONFIRMED','FAILED','CANCELLED')),
        external_reference TEXT, metadata_json TEXT, idempotency_key TEXT, request_hash TEXT,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        initiated_at TEXT, submitted_at TEXT, confirmed_at TEXT, failed_at TEXT, cancelled_at TEXT,
        UNIQUE(organization_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_payment_outbound_org_state ON payment_outbound_intents(organization_id,state,created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_outbound_po ON payment_outbound_intents(organization_id,purchase_order_id);
      CREATE INDEX IF NOT EXISTS idx_payment_outbound_counterparty ON payment_outbound_intents(counterparty_organization_id,state);
      CREATE TRIGGER IF NOT EXISTS payment_outbound_no_core_update_after_submit
      BEFORE UPDATE OF organization_id,counterparty_organization_id,purchase_order_id,provider_id,amount_minor,currency,idempotency_key,request_hash,created_by_user_id
      ON payment_outbound_intents
      WHEN OLD.state IN ('SUBMITTED','CONFIRMED','FAILED','CANCELLED')
      BEGIN SELECT RAISE(ABORT,'Submitted outbound payment intent core fields are immutable'); END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(28, nowIso());
  }

  // Phase 17.9 — Payment Core procurement settlement. Settlement is an
  // allocation/reconciliation authority inside Payment Core, not a second
  // ledger and not a copy of Marketplace settlement semantics. It records
  // how CONFIRMED outbound payment instructions are applied against a
  // procurement-origin approved PO. Status is derived from allocations.
  if (!applied.includes(29)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_procurement_settlements (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
        supplier_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
        currency TEXT NOT NULL,
        total_due_minor INTEGER NOT NULL CHECK (total_due_minor > 0),
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','PARTIALLY_SETTLED','SETTLED','CANCELLED')),
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        cancelled_at TEXT,
        UNIQUE(organization_id,purchase_order_id)
      );
      CREATE INDEX IF NOT EXISTS idx_payment_procurement_settlements_org_status
        ON payment_procurement_settlements(organization_id,status,updated_at DESC);
      CREATE TABLE IF NOT EXISTS payment_procurement_settlement_allocations (
        id TEXT PRIMARY KEY,
        settlement_id TEXT NOT NULL REFERENCES payment_procurement_settlements(id) ON DELETE CASCADE,
        outbound_intent_id TEXT NOT NULL REFERENCES payment_outbound_intents(id) ON DELETE RESTRICT,
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        currency TEXT NOT NULL,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        UNIQUE(settlement_id,outbound_intent_id)
      );
      CREATE INDEX IF NOT EXISTS idx_payment_procurement_settlement_allocations_settlement
        ON payment_procurement_settlement_allocations(settlement_id,created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_payment_procurement_settlement_allocations_intent
        ON payment_procurement_settlement_allocations(outbound_intent_id);
      CREATE TRIGGER IF NOT EXISTS payment_procurement_settlement_allocations_no_update
      BEFORE UPDATE ON payment_procurement_settlement_allocations
      BEGIN SELECT RAISE(ABORT,'Procurement settlement allocations are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS payment_procurement_settlement_allocations_no_delete
      BEFORE DELETE ON payment_procurement_settlement_allocations
      BEGIN SELECT RAISE(ABORT,'Procurement settlement allocations cannot be deleted'); END;
      CREATE TRIGGER IF NOT EXISTS payment_procurement_settlements_no_core_update_after_allocation
      BEFORE UPDATE OF organization_id,purchase_order_id,supplier_organization_id,currency,total_due_minor
      ON payment_procurement_settlements
      WHEN EXISTS (SELECT 1 FROM payment_procurement_settlement_allocations WHERE settlement_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Settled procurement settlement core fields are immutable'); END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(29, nowIso());
  }

  // Phase 18.1 — Supplier Network Profile. Organization remains the canonical
  // identity; the profile is a richer network-facing capability layer.
  if (!applied.includes(30)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS supplier_network_profiles (
        organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
        display_name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        business_categories_json TEXT NOT NULL DEFAULT '[]',
        service_summary TEXT NOT NULL DEFAULT '',
        primary_contact_reference TEXT,
        website_reference TEXT,
        visibility TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL')),
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','SUSPENDED')),
        published_at TEXT,
        suspended_at TEXT,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
      );
      CREATE INDEX IF NOT EXISTS idx_supplier_network_profiles_visibility_status
        ON supplier_network_profiles(status, visibility, updated_at DESC);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(30, nowIso());
  }



  // Phase 18.3 — Supplier Network Catalog. Listings reference the existing
  // canonical Product/Catalog authority; they do not create product identity.
  if (!applied.includes(32)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS supplier_network_catalog_listings (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        supplier_sku TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        minimum_order_quantity REAL,
        unit TEXT NOT NULL DEFAULT '',
        indicative_price_minor INTEGER,
        currency TEXT NOT NULL DEFAULT 'ETB',
        lead_time_days INTEGER,
        availability_status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (availability_status IN ('AVAILABLE','LIMITED','UNAVAILABLE','ON_REQUEST')),
        visibility TEXT NOT NULL DEFAULT 'NETWORK' CHECK (visibility IN ('PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL')),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE(organization_id, product_id)
      );
      CREATE INDEX IF NOT EXISTS idx_supplier_network_catalog_org_status
        ON supplier_network_catalog_listings(organization_id,status,updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_supplier_network_catalog_product
        ON supplier_network_catalog_listings(product_id,status,visibility,organization_id);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(32, nowIso());
  }


  // Phase 18.5 — Supplier Network declared capacity and availability.
  if (!applied.includes(34)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS supplier_network_capacity_signals (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        subject_type TEXT NOT NULL CHECK (subject_type IN ('PRODUCT','CAPABILITY')),
        subject_id TEXT NOT NULL,
        quantity REAL NOT NULL CHECK (quantity > 0),
        unit TEXT NOT NULL,
        period_type TEXT NOT NULL DEFAULT 'ON_DEMAND',
        period_start TEXT,
        period_end TEXT,
        availability TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (availability IN ('AVAILABLE','LIMITED','UNAVAILABLE','ON_REQUEST')),
        visibility TEXT NOT NULL DEFAULT 'NETWORK' CHECK (visibility IN ('PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL')),
        source TEXT NOT NULL DEFAULT 'DECLARED' CHECK (source = 'DECLARED'),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE(organization_id, subject_type, subject_id, period_type, period_start, period_end)
      );
      CREATE INDEX IF NOT EXISTS idx_supplier_network_capacity_org_status
        ON supplier_network_capacity_signals(organization_id,status,updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_supplier_network_capacity_discovery
        ON supplier_network_capacity_signals(subject_type,subject_id,status,availability,visibility,organization_id);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(34, nowIso());
  }

  // Phase 18.6 — Supplier Network commercial capability metadata. Executed
  // quotes, POs, payments, invoices, and settlements remain authoritative in
  // their existing domains.
  if (!applied.includes(35)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS supplier_network_commercial_terms (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        subject_type TEXT NOT NULL CHECK (subject_type IN ('NETWORK','PRODUCT','CAPABILITY')),
        subject_id TEXT,
        minimum_order_quantity REAL,
        unit TEXT NOT NULL DEFAULT '',
        supported_currencies_json TEXT NOT NULL DEFAULT '[]',
        payment_terms_json TEXT NOT NULL DEFAULT '[]',
        lead_time_min_days INTEGER,
        lead_time_max_days INTEGER,
        wholesale_capable INTEGER NOT NULL DEFAULT 0 CHECK (wholesale_capable IN (0,1)),
        bulk_order_capable INTEGER NOT NULL DEFAULT 0 CHECK (bulk_order_capable IN (0,1)),
        delivery_terms_json TEXT NOT NULL DEFAULT '[]',
        visibility TEXT NOT NULL DEFAULT 'NETWORK' CHECK (visibility IN ('PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL')),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE(organization_id, subject_type, subject_id)
      );
      CREATE INDEX IF NOT EXISTS idx_supplier_network_commercial_org_status
        ON supplier_network_commercial_terms(organization_id,status,updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_supplier_network_commercial_discovery
        ON supplier_network_commercial_terms(subject_type,subject_id,status,visibility,organization_id);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_network_commercial_network
        ON supplier_network_commercial_terms(organization_id) WHERE subject_type='NETWORK';
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(35, nowIso());
  }

  // Phase 18.7 — Supplier Network qualification and verification evidence.
  if (!applied.includes(36)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS supplier_network_qualifications (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        qualification_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'DECLARED' CHECK (status IN ('DECLARED','DOCUMENTED','VERIFIED','EXPIRED','REVOKED')),
        title TEXT NOT NULL DEFAULT '',
        issuer TEXT NOT NULL DEFAULT '',
        reference_number TEXT NOT NULL DEFAULT '',
        evidence_json TEXT NOT NULL DEFAULT '{}',
        valid_from TEXT,
        valid_until TEXT,
        verified_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        verified_at TEXT,
        visibility TEXT NOT NULL DEFAULT 'RELATIONSHIP' CHECK (visibility IN ('PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL')),
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
      );
      CREATE INDEX IF NOT EXISTS idx_supplier_network_qualification_org_status
        ON supplier_network_qualifications(organization_id,status,updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_supplier_network_qualification_discovery
        ON supplier_network_qualifications(qualification_type,status,visibility,organization_id);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_network_qualification_reference
        ON supplier_network_qualifications(organization_id,qualification_type,reference_number)
        WHERE reference_number <> '';
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(36, nowIso());
  }

  // Phase 18.8 — Supplier Network Performance. These are immutable derived
  // observations over authoritative procurement/RFQ/receipt records.
  if (!applied.includes(37)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS supplier_network_performance_observations (
        id TEXT PRIMARY KEY,
        supplier_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        metric_type TEXT NOT NULL CHECK (metric_type IN ('RFQ_RESPONSE_RATE','FILL_RATE','PO_COMPLETION_RATE','CANCELLATION_RATE','OBSERVED_PURCHASE_ORDERS')),
        numerator REAL NOT NULL CHECK (numerator >= 0),
        denominator REAL NOT NULL CHECK (denominator >= 0),
        value REAL NOT NULL CHECK (value >= 0),
        unit TEXT NOT NULL DEFAULT 'RATE_PERCENT',
        visibility TEXT NOT NULL DEFAULT 'NETWORK' CHECK (visibility IN ('NETWORK','RELATIONSHIP','PRIVATE')),
        period_start TEXT,
        period_end TEXT NOT NULL,
        evidence_json TEXT NOT NULL DEFAULT '{}',
        calculated_at TEXT NOT NULL,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
      );
      CREATE INDEX IF NOT EXISTS idx_supplier_network_performance_supplier_metric
        ON supplier_network_performance_observations(supplier_organization_id,metric_type,calculated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_supplier_network_performance_visibility
        ON supplier_network_performance_observations(visibility,metric_type,calculated_at DESC);
      CREATE TRIGGER IF NOT EXISTS supplier_network_performance_observations_no_update
      BEFORE UPDATE ON supplier_network_performance_observations
      BEGIN SELECT RAISE(ABORT,'Supplier performance observations are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS supplier_network_performance_observations_no_delete
      BEFORE DELETE ON supplier_network_performance_observations
      BEGIN SELECT RAISE(ABORT,'Supplier performance observations cannot be deleted'); END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(37, nowIso());
  }

  // Phase 18.9 — Supplier Network trust evidence. This is explainable evidence,
  // not a composite score. Source transaction/qualification records remain authoritative.
  if (!applied.includes(38)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS supplier_network_trust_evidence (
        id TEXT PRIMARY KEY,
        supplier_organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        evidence_type TEXT NOT NULL CHECK (evidence_type IN ('SUPPLIER_PARTICIPATION','QUALIFICATION_VERIFIED','PERFORMANCE_OBSERVED','PROCUREMENT_RELATIONSHIP')),
        source_authority TEXT NOT NULL,
        source_entity_type TEXT NOT NULL,
        source_entity_id TEXT NOT NULL,
        claim TEXT NOT NULL,
        value_json TEXT NOT NULL DEFAULT '{}',
        evidence_state TEXT NOT NULL CHECK (evidence_state IN ('OBSERVED','VERIFIED')),
        visibility TEXT NOT NULL DEFAULT 'NETWORK' CHECK (visibility IN ('NETWORK','RELATIONSHIP','PRIVATE')),
        observed_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
      );
      CREATE INDEX IF NOT EXISTS idx_supplier_network_trust_supplier_type
        ON supplier_network_trust_evidence(supplier_organization_id,evidence_type,observed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_supplier_network_trust_visibility
        ON supplier_network_trust_evidence(visibility,evidence_type,observed_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_network_trust_source
        ON supplier_network_trust_evidence(supplier_organization_id,evidence_type,source_authority,source_entity_type,source_entity_id);
      CREATE TRIGGER IF NOT EXISTS supplier_network_trust_evidence_no_update
      BEFORE UPDATE ON supplier_network_trust_evidence
      BEGIN SELECT RAISE(ABORT,'Supplier trust evidence is immutable'); END;
      CREATE TRIGGER IF NOT EXISTS supplier_network_trust_evidence_no_delete
      BEFORE DELETE ON supplier_network_trust_evidence
      BEGIN SELECT RAISE(ABORT,'Supplier trust evidence cannot be deleted'); END;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(38, nowIso());
  }

  // TG-1 — Seller-owned Telegram storefront configuration. This stores only
  // channel configuration and a reference to an external secret, never a raw
  // Telegram bot token. Commerce, inventory, payment, fulfillment and events
  // remain authoritative in their existing domains.
  if (!applied.includes(39)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS telegram_storefront_configs (
        organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
        channel_type TEXT NOT NULL DEFAULT 'telegram' CHECK (channel_type = 'telegram'),
        bot_id TEXT,
        bot_username TEXT,
        credential_ref TEXT,
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','CONFIGURED','VERIFIED','PUBLISHED','PAUSED','UNPUBLISHED')),
        webapp_url TEXT,
        enabled_capabilities_json TEXT NOT NULL DEFAULT '["browse","search","product","cart","checkout","order_status"]',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
      );
      CREATE INDEX IF NOT EXISTS idx_telegram_storefront_status
        ON telegram_storefront_configs(status, updated_at DESC);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(39, nowIso());
  }

  // FUX-13.2 — canonical Pack lifecycle persistence. This is intentionally
  // additive: existing client configuration remains authoritative until the
  // lifecycle read/mutation bridge is implemented in later bounded steps.
  // The table owns lifecycle state only; authorization, readiness, audit, and
  // event authorities remain with their existing canonical modules.
  if (!applied.includes(40)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pack_lifecycle (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        pack_id TEXT NOT NULL,
        pack_version TEXT NOT NULL DEFAULT '',
        state TEXT NOT NULL CHECK (state IN (
          'NOT_INSTALLED','INSTALLED','ELIGIBILITY_UNKNOWN','ELIGIBLE',
          'DEPENDENCY_BLOCKED','ACTIVATION_AUTHORIZATION_REQUIRED','ACTIVE',
          'DEACTIVATION_AUTHORIZATION_REQUIRED','DEACTIVATED','UPGRADE_AVAILABLE',
          'UPGRADE_AUTHORIZATION_REQUIRED','UPGRADE_BLOCKED','RECOVERY_REQUIRED','UNKNOWN'
        )),
        installed_at TEXT,
        activated_at TEXT,
        deactivated_at TEXT,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE(organization_id, pack_id)
      );
      CREATE INDEX IF NOT EXISTS idx_pack_lifecycle_org_state
        ON pack_lifecycle(organization_id, state, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_pack_lifecycle_pack
        ON pack_lifecycle(pack_id, organization_id);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(40, nowIso());
  }

  // FUX-42 — Core Fulfillment authority. This is deliberately additive and
  // separate from Marketplace fulfillment so ordinary seller orders gain one
  // canonical lifecycle without reusing marketplace-specific tables.
  if (!applied.includes(42)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS fulfillments (
        id TEXT PRIMARY KEY,
        server_order_id TEXT NOT NULL UNIQUE REFERENCES orders(server_order_id) ON DELETE CASCADE,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        fulfillment_type TEXT NOT NULL CHECK (fulfillment_type IN ('delivery','pickup')),
        status TEXT NOT NULL CHECK (status IN ('pending','out_for_delivery','delivered','ready_for_pickup','picked_up')),
        destination_json TEXT,
        scheduled_at TEXT,
        tracking_reference TEXT,
        proof_json TEXT,
        last_command_key TEXT,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
      );
      CREATE INDEX IF NOT EXISTS idx_fulfillments_org_status
        ON fulfillments(organization_id, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_fulfillments_location_status
        ON fulfillments(location_id, status, updated_at DESC);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(42, nowIso());
  }

  // GAP-2 — canonical delivery assignment authority.
  if (!applied.includes(43)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS delivery_assignments (
        id TEXT PRIMARY KEY,
        fulfillment_id TEXT NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        courier_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED','ACCEPTED','OUT_FOR_DELIVERY','DELIVERED','REASSIGNED','CANCELLED','FAILED')),
        assignment_key TEXT NOT NULL UNIQUE,
        assigned_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        last_command_key TEXT,
        UNIQUE(fulfillment_id)
      );
      CREATE INDEX IF NOT EXISTS idx_delivery_assignments_courier
        ON delivery_assignments(courier_user_id,status,updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_delivery_assignments_org
        ON delivery_assignments(organization_id,status,updated_at DESC);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(43, nowIso());
  }

  // GAP-2.1 — assignment history + command idempotency. A delivery may have
  // multiple historical courier assignments, but only one active assignment.
  if (!applied.includes(44)) {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      DROP INDEX IF EXISTS idx_delivery_assignments_courier;
      DROP INDEX IF EXISTS idx_delivery_assignments_org;
      CREATE TABLE delivery_assignments_v44 (
        id TEXT PRIMARY KEY,
        fulfillment_id TEXT NOT NULL REFERENCES fulfillments(id) ON DELETE CASCADE,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        courier_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        status TEXT NOT NULL DEFAULT 'ASSIGNED' CHECK (status IN ('ASSIGNED','ACCEPTED','OUT_FOR_DELIVERY','DELIVERED','REASSIGNED','CANCELLED','FAILED')),
        assignment_key TEXT NOT NULL UNIQUE,
        assigned_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        last_command_key TEXT
      );
      INSERT INTO delivery_assignments_v44
        (id,fulfillment_id,organization_id,location_id,courier_user_id,status,assignment_key,assigned_by_user_id,assigned_at,updated_at,version,last_command_key)
      SELECT id,fulfillment_id,organization_id,location_id,courier_user_id,status,assignment_key,assigned_by_user_id,assigned_at,updated_at,version,NULL
      FROM delivery_assignments;
      DROP TABLE delivery_assignments;
      ALTER TABLE delivery_assignments_v44 RENAME TO delivery_assignments;
      CREATE INDEX idx_delivery_assignments_courier
        ON delivery_assignments(courier_user_id,status,updated_at DESC);
      CREATE INDEX idx_delivery_assignments_org
        ON delivery_assignments(organization_id,status,updated_at DESC);
      CREATE UNIQUE INDEX idx_delivery_assignments_active_fulfillment
        ON delivery_assignments(fulfillment_id)
        WHERE status IN ('ASSIGNED','ACCEPTED','OUT_FOR_DELIVERY');
      PRAGMA foreign_keys = ON;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(44, nowIso());
  }


  // GAP-1.1 — payment intent/evidence/verification/decision foundation.
  if (!applied.includes(45)) {
    db.exec(\`
      CREATE TABLE IF NOT EXISTS payment_intents (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        order_id TEXT,
        payment_account_id TEXT REFERENCES payment_accounts(id) ON DELETE SET NULL,
        provider_id TEXT NOT NULL,
        amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
        currency TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','PAYMENT_ATTEMPTED','FULFILLED','EXPIRED','CANCELLED')),
        expires_at TEXT,
        fulfilled_at TEXT,
        cancelled_at TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_payment_intents_org_created ON payment_intents(organization_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_intents_org_order ON payment_intents(organization_id, order_id);
      CREATE INDEX IF NOT EXISTS idx_payment_intents_org_status ON payment_intents(organization_id, status);

      CREATE TABLE IF NOT EXISTS payment_evidence (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
        payment_intent_id TEXT REFERENCES payment_intents(id) ON DELETE SET NULL,
        provider_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        evidence_type TEXT NOT NULL,
        external_reference TEXT,
        provider_transaction_id TEXT,
        fingerprint TEXT NOT NULL,
        raw_payload_json TEXT,
        normalized_payload_json TEXT,
        source TEXT,
        observed_at TEXT,
        received_at TEXT NOT NULL,
        submitted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','PROCESSING','VERIFIED','REJECTED','DUPLICATE','UNVERIFIABLE','EXPIRED')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_evidence_org_provider_fingerprint ON payment_evidence(organization_id, provider_id, fingerprint);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_evidence_org_provider_transaction ON payment_evidence(organization_id, provider_id, provider_transaction_id) WHERE provider_transaction_id IS NOT NULL AND provider_transaction_id <> '';
      CREATE INDEX IF NOT EXISTS idx_payment_evidence_payment ON payment_evidence(payment_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_evidence_intent ON payment_evidence(payment_intent_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_evidence_org_status ON payment_evidence(organization_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_evidence_external_reference ON payment_evidence(organization_id, provider_id, external_reference);

      CREATE TABLE IF NOT EXISTS payment_verifications (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
        payment_intent_id TEXT REFERENCES payment_intents(id) ON DELETE SET NULL,
        evidence_id TEXT NOT NULL REFERENCES payment_evidence(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL,
        result TEXT NOT NULL CHECK (result IN ('MATCH','MISMATCH','DUPLICATE','UNVERIFIABLE','EXPIRED','PENDING','ERROR')),
        confidence REAL,
        observed_amount_minor INTEGER,
        observed_currency TEXT,
        observed_receiver TEXT,
        observed_receiver_account TEXT,
        observed_reference TEXT,
        observed_transaction_id TEXT,
        observed_at TEXT,
        reason_codes_json TEXT NOT NULL DEFAULT '[]',
        raw_result_json TEXT,
        verifier TEXT NOT NULL,
        verifier_version TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_payment_verifications_payment ON payment_verifications(payment_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_verifications_evidence ON payment_verifications(evidence_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_verifications_intent ON payment_verifications(payment_intent_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_verifications_org_result ON payment_verifications(organization_id, result, created_at DESC);

      CREATE TABLE IF NOT EXISTS payment_decisions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        payment_intent_id TEXT REFERENCES payment_intents(id) ON DELETE SET NULL,
        evidence_id TEXT REFERENCES payment_evidence(id) ON DELETE SET NULL,
        verification_id TEXT REFERENCES payment_verifications(id) ON DELETE SET NULL,
        decision TEXT NOT NULL CHECK (decision IN ('ACCEPT','REJECT','RETRY_VERIFICATION','MARK_DUPLICATE','MARK_MISMATCH','MARK_PARTIAL','EXPIRE','RECONCILE')),
        target_state TEXT,
        reason_codes_json TEXT NOT NULL DEFAULT '[]',
        invariant_results_json TEXT NOT NULL DEFAULT '{}',
        decision_source TEXT NOT NULL DEFAULT 'PAYMENT_CORE',
        actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_payment_decisions_payment ON payment_decisions(payment_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_decisions_evidence ON payment_decisions(evidence_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_decisions_verification ON payment_decisions(verification_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_decisions_org_created ON payment_decisions(organization_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS payment_idempotency_keys (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        idempotency_key TEXT NOT NULL,
        command_type TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        response_status INTEGER,
        response_json TEXT,
        resource_type TEXT,
        resource_id TEXT,
        created_at TEXT NOT NULL,
        expires_at TEXT,
        UNIQUE(organization_id, idempotency_key, command_type)
      );
      CREATE INDEX IF NOT EXISTS idx_payment_idempotency_expiry ON payment_idempotency_keys(expires_at);
    \`);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(45, nowIso());
  }

  // GAP-1.2 — link existing canonical payments to payment intents.
  if (!applied.includes(46)) {
    const columns = db.prepare('PRAGMA table_info(payments)').all();
    const hasPaymentIntentId = columns.some(column => String(column.name) === 'payment_intent_id');
    if (!hasPaymentIntentId) {
      db.exec(\`ALTER TABLE payments ADD COLUMN payment_intent_id TEXT REFERENCES payment_intents(id) ON DELETE SET NULL\`);
    }
    db.exec(\`CREATE INDEX IF NOT EXISTS idx_payments_payment_intent ON payments(payment_intent_id)\`);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(46, nowIso());
  }

  // GAP-1.16 — executable organization-scoped payment routing policy.
  if (!applied.includes(51)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_routing_policies (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        channel TEXT NOT NULL CHECK (channel IN ('manual','sms','api')),
        provider_id TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 100 CHECK (priority >= 0),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
        currencies_json TEXT NOT NULL DEFAULT '[]',
        required_capabilities_json TEXT NOT NULL DEFAULT '[]',
        location_id TEXT REFERENCES locations(id) ON DELETE CASCADE,
        reason TEXT NOT NULL DEFAULT '',
        created_by_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(organization_id, channel, provider_id, location_id)
      );
      CREATE INDEX IF NOT EXISTS idx_payment_routing_policy_match
        ON payment_routing_policies(organization_id, channel, status, priority, location_id);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(51, nowIso());
  }

  // GAP-1.17 — durable payment operational action / retry / manual-review journal.
  if (!applied.includes(52)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_operational_actions (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        action_type TEXT NOT NULL CHECK (action_type IN ('STATUS_QUERY','RECONCILIATION','REFUND','SETTLEMENT','LIFECYCLE','MANUAL_REVIEW')),
        operation TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','RUNNING','SUCCEEDED','FAILED','UNKNOWN','BLOCKED','RESOLVED','DISMISSED')),
        attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt > 0),
        idempotency_key TEXT,
        reason TEXT NOT NULL DEFAULT '',
        error_code TEXT,
        result_json TEXT,
        next_retry_at TEXT,
        actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_operational_idempotency
        ON payment_operational_actions(organization_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_payment_operational_payment
        ON payment_operational_actions(payment_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_operational_status
        ON payment_operational_actions(organization_id, status, next_retry_at, created_at DESC);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(52, nowIso());
  }

  // GAP-1.18 — durable provider capability certification evidence.
  // Evidence is scoped to an organization because provider configuration and
  // account readiness are organization-scoped. Adapter contract certification
  // remains registry-owned; live external certification is never inferred from
  // a caller-supplied flag.
  if (!applied.includes(53)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_provider_capability_certifications (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL,
        capability TEXT NOT NULL,
        certification_scope TEXT NOT NULL CHECK (certification_scope IN ('ADAPTER_CONTRACT','LIVE_EXTERNAL')),
        status TEXT NOT NULL CHECK (status IN ('UNKNOWN','OBSERVED','CERTIFIED','FAILED','EXPIRED')),
        evidence_json TEXT,
        evidence_fingerprint TEXT NOT NULL,
        provider_reference TEXT,
        observed_at TEXT,
        expires_at TEXT,
        reason TEXT NOT NULL DEFAULT '',
        certified_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(organization_id, provider_id, capability, certification_scope, evidence_fingerprint)
      );
      CREATE INDEX IF NOT EXISTS idx_payment_provider_capability_certification
        ON payment_provider_capability_certifications(organization_id, provider_id, capability, certification_scope, updated_at DESC);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(53, nowIso());

  // GAP-1.18I — provider verification persistence idempotency.
  if (!applied.includes(54)) {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_verifications_evidence_verifier
        ON payment_verifications(evidence_id, verifier, verifier_version);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(54, nowIso());
  }

  }

  // GAP-1.18N — verification provenance hardening.
  // The persisted verifier identity is server-owned. Caller-supplied verifier
  // metadata may not masquerade as Payment Core provenance.
  if (!applied.includes(56)) {
    db.exec(`
      ALTER TABLE payment_verifications ADD COLUMN provenance_source TEXT NOT NULL DEFAULT 'PAYMENT_CORE';
      ALTER TABLE payment_verifications ADD COLUMN provenance_operation TEXT;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(56, nowIso());
  }

  if (!applied.includes(57)) {
    db.exec(`
      ALTER TABLE audit_events ADD COLUMN previous_hash TEXT;
      ALTER TABLE audit_events ADD COLUMN event_hash TEXT;
      ALTER TABLE audit_events ADD COLUMN lineage_type TEXT;
      ALTER TABLE audit_events ADD COLUMN lineage_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_audit_lineage ON audit_events(organization_id, lineage_type, lineage_id, created_at DESC);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(57, nowIso());
  }

  // GAP-1.18M — durable provider transaction identity binding.
  // A provider transaction may authorize at most one Payment within an
  // organization/provider scope. NULLs remain allowed for legacy evidence,
  // but any populated transaction identity is unique at the database layer.
  if (!applied.includes(55)) {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_verifications_provider_transaction
        ON payment_verifications(organization_id, provider_id, observed_transaction_id)
        WHERE observed_transaction_id IS NOT NULL AND trim(observed_transaction_id) <> '';
      CREATE INDEX IF NOT EXISTS idx_payment_verifications_provider_transaction
        ON payment_verifications(organization_id, provider_id, observed_transaction_id, created_at DESC);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(55, nowIso());
  }

  // GAP-1.15 — canonical settlement and fee model.
  // Settlement is distinct from payment confirmation: it records the
  // provider/merchant settlement obligation and fee breakdown without
  // creating a second financial ledger.
  if (!applied.includes(50)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_settlements (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        gross_amount_minor INTEGER NOT NULL CHECK (gross_amount_minor >= 0),
        provider_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (provider_fee_minor >= 0),
        sellify_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (sellify_fee_minor >= 0),
        net_amount_minor INTEGER NOT NULL CHECK (net_amount_minor >= 0),
        currency TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','READY','SETTLED','HELD','FAILED','REVERSED')),
        settlement_reference TEXT,
        reconciliation_id TEXT,
        provider_settlement_reference TEXT,
        evidence_json TEXT,
        reason TEXT NOT NULL DEFAULT '',
        created_by_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        settled_at TEXT,
        UNIQUE(organization_id, idempotency_key),
        UNIQUE(organization_id, provider_id, settlement_reference)
      );
      CREATE INDEX IF NOT EXISTS idx_payment_settlements_payment
        ON payment_settlements(payment_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_settlements_org_status
        ON payment_settlements(organization_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_settlements_provider_reference
        ON payment_settlements(organization_id, provider_id, provider_settlement_reference);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(50, nowIso());
  }

  // GAP-1.14 — durable Payment Core refund identity and idempotency.
  // Refund records are the durable command/effect identity. Provider adapters
  // never own refund persistence or the financial ledger.
  if (!applied.includes(49)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_refunds (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        payment_intent_id TEXT REFERENCES payment_intents(id) ON DELETE SET NULL,
        provider_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        currency TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','PROCESSING','SUCCEEDED','FAILED','UNKNOWN','CANCELLED')),
        reason TEXT NOT NULL DEFAULT '',
        provider_refund_id TEXT,
        provider_transaction_id TEXT,
        provider_result_json TEXT,
        evidence_json TEXT,
        failure_code TEXT,
        requested_by_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        processed_at TEXT,
        UNIQUE(organization_id, idempotency_key),
        UNIQUE(organization_id, provider_id, provider_refund_id)
      );
      CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment
        ON payment_refunds(payment_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_refunds_org_status
        ON payment_refunds(organization_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payment_refunds_provider
        ON payment_refunds(organization_id, provider_id, provider_refund_id);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(49, nowIso());
  }

  // GAP-1.13 — explicit failure/expiration/cancellation/reversal states.
  // SQLite CHECK constraints are rebuilt additively so historical payment and
  // ledger rows remain intact while the canonical state matrix gains the
  // required lifecycle states.
  if (!applied.includes(48)) {
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`
      CREATE TABLE payments_gap113 (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
        order_id TEXT,
        customer_id TEXT,
        payment_account_id TEXT REFERENCES payment_accounts(id) ON DELETE SET NULL,
        provider_id TEXT NOT NULL DEFAULT 'manual',
        channel TEXT NOT NULL DEFAULT 'manual' CHECK (channel IN ('manual','sms','api')),
        method_id TEXT,
        method_name TEXT,
        amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
        currency TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'UNPAID' CHECK (state IN ('UNPAID','CLAIMED','RECEIVED','VERIFIED','RECONCILED','REJECTED','FAILED','DUPLICATE','MISMATCH','EXPIRED','CANCELLED','PARTIAL','REVERSED','REFUNDED')),
        external_reference TEXT,
        claimed_at TEXT,
        received_at TEXT,
        verified_at TEXT,
        reconciled_at TEXT,
        metadata_json TEXT,
        created_by_user_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        payment_intent_id TEXT REFERENCES payment_intents(id) ON DELETE SET NULL
      );
      INSERT INTO payments_gap113 SELECT
        id,organization_id,location_id,order_id,customer_id,payment_account_id,
        provider_id,channel,method_id,method_name,amount_minor,currency,state,
        external_reference,claimed_at,received_at,verified_at,reconciled_at,
        metadata_json,created_by_user_id,created_at,updated_at,payment_intent_id
      FROM payments;
      DROP TABLE payments;
      ALTER TABLE payments_gap113 RENAME TO payments;
      CREATE INDEX IF NOT EXISTS idx_payments_org_created ON payments(organization_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(organization_id, order_id);
      CREATE INDEX IF NOT EXISTS idx_payments_state ON payments(organization_id, state);
      CREATE INDEX IF NOT EXISTS idx_payments_payment_intent ON payments(payment_intent_id);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_external_reference
        ON payments(organization_id, provider_id, external_reference)
        WHERE external_reference IS NOT NULL AND external_reference != '';

      CREATE TABLE payment_ledger_entries_gap113 (
        id TEXT PRIMARY KEY,
        payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        entry_type TEXT NOT NULL CHECK (entry_type IN ('CREATED','CLAIMED','RECEIVED','VERIFIED','RECONCILED','REJECTED','FAILED','DUPLICATE','MISMATCH','EXPIRED','CANCELLED','PARTIAL','REVERSED','REFUNDED')),
        amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
        currency TEXT NOT NULL,
        from_state TEXT,
        to_state TEXT NOT NULL,
        actor_id TEXT,
        reason TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL
      );
      INSERT INTO payment_ledger_entries_gap113 SELECT * FROM payment_ledger_entries;
      DROP TABLE payment_ledger_entries;
      ALTER TABLE payment_ledger_entries_gap113 RENAME TO payment_ledger_entries;
      CREATE INDEX IF NOT EXISTS idx_payment_ledger_payment ON payment_ledger_entries(payment_id, created_at);
      CREATE TRIGGER IF NOT EXISTS trg_payment_ledger_no_update
      BEFORE UPDATE ON payment_ledger_entries
      BEGIN SELECT RAISE(ABORT, 'payment ledger entries are append-only'); END;
      CREATE TRIGGER IF NOT EXISTS trg_payment_ledger_no_delete
      BEFORE DELETE ON payment_ledger_entries
      BEGIN SELECT RAISE(ABORT, 'payment ledger entries are append-only'); END;
    `);
    db.exec('PRAGMA foreign_keys = ON');
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(48, nowIso());
  }

  // GAP-1.12 — provider-neutral reconciliation evidence.
  // Reconciliation records findings only; they never mutate Payment state or
  // write the financial ledger. Canonical state changes remain PaymentCore decisions.
  if (!applied.includes(47)) {
    const columns = db.prepare('PRAGMA table_info(payment_reconciliations)').all();
    const addColumn = (name, definition) => {
      if (!columns.some(column => String(column.name) === name)) {
        db.exec(`ALTER TABLE payment_reconciliations ADD COLUMN ${name} ${definition}`);
      }
    };
    addColumn('provider_id', 'TEXT');
    addColumn('source', "TEXT NOT NULL DEFAULT 'PAYMENT_CORE'");
    addColumn('fingerprint', 'TEXT');
    addColumn('evidence_json', "TEXT NOT NULL DEFAULT '{}'");
    addColumn('observed_at', 'TEXT');
    addColumn('updated_at', 'TEXT');
    db.exec('CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_payment_created ON payment_reconciliations(payment_id, created_at DESC)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_fingerprint ON payment_reconciliations(organization_id, fingerprint)');
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(47, nowIso());
  }

  // FUX-2 Section 6 — additive multi-role compatibility bridge.
  // memberships.role remains the legacy/default role authority while
  // membership_roles provides an additive path for multiple contextual roles.
  // No existing callers are forced to switch until assignment/read paths are
  // explicitly migrated.
  if (!applied.includes(41)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS membership_roles (
        id TEXT PRIMARY KEY,
        membership_id TEXT NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
        role_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
        scope_type TEXT NOT NULL DEFAULT 'ORGANIZATION',
        scope_id TEXT,
        source TEXT NOT NULL DEFAULT 'LEGACY_BRIDGE',
        created_at TEXT NOT NULL,
        revoked_at TEXT,
        UNIQUE(membership_id, role_id, scope_type, scope_id)
      );
      CREATE INDEX IF NOT EXISTS idx_membership_roles_membership
        ON membership_roles(membership_id, status);
      CREATE INDEX IF NOT EXISTS idx_membership_roles_scope
        ON membership_roles(scope_type, scope_id, status);

      INSERT OR IGNORE INTO membership_roles
        (id, membership_id, role_id, status, scope_type, source, created_at)
      SELECT
        'legacy-role:' || m.id,
        m.id,
        lower(m.role),
        'active',
        'ORGANIZATION',
        'LEGACY_BRIDGE',
        m.created_at
      FROM memberships m;
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(41, nowIso());
  }

  // Phase 18.4 — Supplier Network Service Areas. Geographic hierarchy remains
  // country-pack/provider-defined; this table stores normalized opaque references.
  if (!applied.includes(33)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS supplier_network_service_areas (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        scope_type TEXT NOT NULL CHECK (scope_type IN ('COUNTRY','REGION','ZONE','DISTRICT','CITY','POSTAL_CODE','RADIUS')),
        country_code TEXT NOT NULL,
        geo_code TEXT NOT NULL DEFAULT '',
        display_name TEXT NOT NULL DEFAULT '',
        radius_km REAL,
        center_latitude REAL,
        center_longitude REAL,
        visibility TEXT NOT NULL DEFAULT 'NETWORK' CHECK (visibility IN ('PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL')),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE(organization_id, scope_type, country_code, geo_code)
      );
      CREATE INDEX IF NOT EXISTS idx_supplier_network_service_areas_org_status
        ON supplier_network_service_areas(organization_id,status,updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_supplier_network_service_areas_discovery
        ON supplier_network_service_areas(country_code,scope_type,geo_code,status,visibility,organization_id);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(33, nowIso());
  }

  // Phase 18.2 — Supplier Network Capability. Capabilities are machine-readable
  // supplier declarations and remain separate from Product identity and Procurement transactions.
  if (!applied.includes(31)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS supplier_network_capabilities (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        visibility TEXT NOT NULL DEFAULT 'NETWORK' CHECK (visibility IN ('PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL')),
        source TEXT NOT NULL DEFAULT 'DECLARED' CHECK (source IN ('DECLARED','VERIFIED')),
        status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
        UNIQUE(organization_id, code)
      );
      CREATE INDEX IF NOT EXISTS idx_supplier_network_capabilities_org_status
        ON supplier_network_capabilities(organization_id,status,updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_supplier_network_capabilities_discovery
        ON supplier_network_capabilities(code,status,visibility,organization_id);
    `);
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(31, nowIso());
  }}


const PACK_LIFECYCLE_TRANSITIONS = Object.freeze({
  NOT_INSTALLED: new Set(['INSTALLED']),
  INSTALLED: new Set(['ELIGIBLE', 'DEPENDENCY_BLOCKED', 'RECOVERY_REQUIRED', 'UNKNOWN']),
  ELIGIBILITY_UNKNOWN: new Set(['ELIGIBLE', 'DEPENDENCY_BLOCKED', 'RECOVERY_REQUIRED', 'UNKNOWN']),
  ELIGIBLE: new Set(['ACTIVE', 'DEPENDENCY_BLOCKED', 'RECOVERY_REQUIRED', 'UNKNOWN']),
  DEPENDENCY_BLOCKED: new Set(['ELIGIBLE', 'RECOVERY_REQUIRED', 'UNKNOWN']),
  ACTIVATION_AUTHORIZATION_REQUIRED: new Set(['ELIGIBLE', 'ACTIVE', 'RECOVERY_REQUIRED', 'UNKNOWN']),
  ACTIVE: new Set(['DEACTIVATED', 'UPGRADE_AVAILABLE', 'RECOVERY_REQUIRED', 'UNKNOWN']),
  DEACTIVATION_AUTHORIZATION_REQUIRED: new Set(['ACTIVE', 'DEACTIVATED', 'RECOVERY_REQUIRED', 'UNKNOWN']),
  DEACTIVATED: new Set(['ELIGIBLE', 'UPGRADE_AVAILABLE', 'RECOVERY_REQUIRED', 'UNKNOWN']),
  UPGRADE_AVAILABLE: new Set(['UPGRADE_AUTHORIZATION_REQUIRED', 'UPGRADE_BLOCKED', 'ACTIVE', 'RECOVERY_REQUIRED', 'UNKNOWN']),
  UPGRADE_AUTHORIZATION_REQUIRED: new Set(['UPGRADE_AVAILABLE', 'ACTIVE', 'UPGRADE_BLOCKED', 'RECOVERY_REQUIRED', 'UNKNOWN']),
  UPGRADE_BLOCKED: new Set(['UPGRADE_AVAILABLE', 'ACTIVE', 'RECOVERY_REQUIRED', 'UNKNOWN']),
  RECOVERY_REQUIRED: new Set(['UNKNOWN', 'INSTALLED', 'ELIGIBLE', 'ACTIVE', 'DEACTIVATED']),
  UNKNOWN: new Set(['INSTALLED', 'ELIGIBLE', 'DEPENDENCY_BLOCKED', 'ACTIVE', 'DEACTIVATED', 'RECOVERY_REQUIRED']),
});

function packLifecycleFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    packId: row.pack_id,
    packVersion: row.pack_version,
    state: row.state,
    installedAt: row.installed_at,
    activatedAt: row.activated_at,
    deactivatedAt: row.deactivated_at,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: Number(row.version || 1),
  };
}

export async function transitionPackLifecycle(chatId, packId, targetState, actor = null, input = {}) {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  const actorId = assertProcurementActor(organizationId, actor);
  const normalizedPackId = String(packId || '').trim();
  const target = String(targetState || '').trim().toUpperCase();
  if (!normalizedPackId) throw Object.assign(new Error('Pack id is required'), { statusCode: 400, code: 'PACK_ID_REQUIRED' });
  if (!Object.prototype.hasOwnProperty.call(PACK_LIFECYCLE_TRANSITIONS, target)) {
    throw Object.assign(new Error('Invalid Pack lifecycle state'), { statusCode: 400, code: 'INVALID_PACK_LIFECYCLE_STATE' });
  }

  const manifest = getPackLifecycleManifest(normalizedPackId);
  if (!manifest) {
    assertPackLifecyclePrecondition(normalizedPackId, target);
  }
  if (target === 'ELIGIBLE' || target === 'ACTIVE') {
    assertPackLifecyclePrecondition(normalizedPackId, target);
  }

  const existing = db.prepare('SELECT * FROM pack_lifecycle WHERE organization_id=? AND pack_id=?').get(organizationId, normalizedPackId);
  const current = existing?.state || 'NOT_INSTALLED';
  if (current === target) return { ...packLifecycleFromRow(existing), idempotent: true };
  if (!PACK_LIFECYCLE_TRANSITIONS[current]?.has(target)) {
    throw Object.assign(new Error(`Illegal Pack lifecycle transition ${current} -> ${target}`), { statusCode: 409, code: 'INVALID_PACK_LIFECYCLE_TRANSITION' });
  }

  const expectedVersion = input.expectedVersion == null ? null : Number(input.expectedVersion);
  if (expectedVersion != null && (!Number.isInteger(expectedVersion) || expectedVersion < 1)) {
    throw Object.assign(new Error('expectedVersion must be a positive integer'), { statusCode: 400, code: 'INVALID_PACK_LIFECYCLE_VERSION' });
  }
  if (existing && expectedVersion != null && Number(existing.version) !== expectedVersion) {
    throw Object.assign(new Error('Pack lifecycle version conflict'), { statusCode: 409, code: 'PACK_LIFECYCLE_VERSION_CONFLICT' });
  }

  const packVersion = input.packVersion == null
    ? String(existing?.pack_version || manifest?.version || '')
    : String(input.packVersion);
  const now = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!existing) {
      if (target !== 'INSTALLED') {
        throw Object.assign(new Error('A Pack must be installed before lifecycle state can advance'), { statusCode: 409, code: 'PACK_INSTALL_REQUIRED' });
      }
      const id = String(input.id || crypto.randomUUID());
      db.prepare(`INSERT INTO pack_lifecycle
        (id, organization_id, pack_id, pack_version, state, installed_at, activated_at, deactivated_at, created_by_user_id, updated_by_user_id, created_at, updated_at, version)
        VALUES (?, ?, ?, ?, 'INSTALLED', ?, NULL, NULL, ?, ?, ?, ?, 1)`).run(
        id, organizationId, normalizedPackId, packVersion, now, actorId, actorId, now, now
      );
      audit(String(chatId), 'pack.lifecycle.installed', 'pack_lifecycle', id, {
        packId: normalizedPackId, fromState: 'NOT_INSTALLED', toState: target, packVersion,
      }, { organizationId, actorId });
    } else {
      const sets = ['state=?', 'pack_version=?', 'updated_by_user_id=?', 'updated_at=?', 'version=version+1'];
      const params = [target, packVersion, actorId, now];
      if (target === 'ACTIVE') { sets.push('activated_at=COALESCE(activated_at,?)'); params.push(now); }
      if (target === 'DEACTIVATED') { sets.push('deactivated_at=?'); params.push(now); }
      params.push(existing.id, organizationId);
      const result = db.prepare(`UPDATE pack_lifecycle SET ${sets.join(',')} WHERE id=? AND organization_id=?${expectedVersion == null ? '' : ' AND version=?'}`).run(
        ...params, ...(expectedVersion == null ? [] : [expectedVersion])
      );
      if (Number(result.changes || 0) !== 1) {
        throw Object.assign(new Error('Pack lifecycle version conflict'), { statusCode: 409, code: 'PACK_LIFECYCLE_VERSION_CONFLICT' });
      }
      audit(String(chatId), `pack.lifecycle.${target.toLowerCase()}`, 'pack_lifecycle', existing.id, {
        packId: normalizedPackId, fromState: current, toState: target, packVersion,
      }, { organizationId, actorId });
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return {
    ...packLifecycleFromRow(db.prepare('SELECT * FROM pack_lifecycle WHERE organization_id=? AND pack_id=?').get(organizationId, normalizedPackId)),
    idempotent: false,
  };
}

export function getPackLifecycle(organizationId, packId) {
  ensureDatabase();
  if (!organizationId || !packId) return null;
  const row = db.prepare(`
    SELECT id, organization_id, pack_id, pack_version, state,
           installed_at, activated_at, deactivated_at,
           created_by_user_id, updated_by_user_id, created_at, updated_at, version
    FROM pack_lifecycle
    WHERE organization_id = ? AND pack_id = ?
  `).get(String(organizationId), String(packId));
  if (!row) return null;
  return {
    id: row.id, organizationId: row.organization_id, packId: row.pack_id,
    packVersion: row.pack_version, state: row.state,
    installedAt: row.installed_at, activatedAt: row.activated_at,
    deactivatedAt: row.deactivated_at, createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id, createdAt: row.created_at,
    updatedAt: row.updated_at, version: Number(row.version || 1),
  };
}

export function getTelegramStorefrontConfig(chatId) {
  ensureDatabase();
  const org = db.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(String(chatId));
  if (!org?.organization_id) return null;
  const row = db.prepare('SELECT * FROM telegram_storefront_configs WHERE organization_id=?').get(org.organization_id);
  if (!row) return null;
  return {
    organizationId: row.organization_id, channelType: row.channel_type, botId: row.bot_id,
    botUsername: row.bot_username, credentialRef: row.credential_ref, status: row.status,
    webappUrl: row.webapp_url, enabledCapabilities: parseJSON(row.enabled_capabilities_json, []),
    metadata: parseJSON(row.metadata_json, {}), createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id, createdAt: row.created_at, updatedAt: row.updated_at,
    version: Number(row.version || 1),
  };
}

export async function upsertTelegramStorefrontConfig(chatId, input = {}, actor = null) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) throw Object.assign(new Error('Tenant organization not found'), { statusCode: 404, code: 'ORGANIZATION_NOT_FOUND' });
  const org = tenant.organizationId;
  const actorId = actor?.userId || null;
  const current = getTelegramStorefrontConfig(chatId);
  const status = String(input.status ?? current?.status ?? 'DRAFT').toUpperCase();
  const allowed = new Set(['DRAFT','CONFIGURED','VERIFIED','PUBLISHED','PAUSED','UNPUBLISHED']);
  if (!allowed.has(status)) throw Object.assign(new Error('Invalid Telegram storefront status'), { statusCode: 400, code: 'INVALID_TELEGRAM_STOREFRONT_STATUS' });
  if (Object.hasOwn(input, 'credentialRef')) normalizeTelegramCredentialRef(input.credentialRef);
  if (['VERIFIED','PUBLISHED'].includes(status) && !current?.status?.match(/^(VERIFIED|PUBLISHED)$/)) {
    throw Object.assign(new Error('Use the Telegram storefront verification boundary before VERIFIED or PUBLISHED'), { statusCode: 409, code: 'TELEGRAM_VERIFICATION_REQUIRED' });
  }
  const capabilities = Array.isArray(input.enabledCapabilities) ? [...new Set(input.enabledCapabilities.map(String).map(x => x.trim()).filter(Boolean))] : (current?.enabledCapabilities || ['browse','search','product','cart','checkout','order_status']);
  const metadata = input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : (current?.metadata || {});
  const now = nowIso();
  const values = [org, String(input.botId ?? current?.botId ?? '') || null, String(input.botUsername ?? current?.botUsername ?? '') || null, String(input.credentialRef ?? current?.credentialRef ?? '') || null, status, String(input.webappUrl ?? current?.webappUrl ?? '') || null, json(capabilities), json(metadata), actorId, now];
  db.exec('BEGIN IMMEDIATE');
  try {
    if (current) {
      db.prepare(`UPDATE telegram_storefront_configs SET bot_id=?,bot_username=?,credential_ref=?,status=?,webapp_url=?,enabled_capabilities_json=?,metadata_json=?,updated_by_user_id=?,updated_at=?,version=version+1 WHERE organization_id=?`).run(values[1],values[2],values[3],values[4],values[5],values[6],values[7],values[8],values[9],org);
    } else {
      db.prepare(`INSERT INTO telegram_storefront_configs (organization_id,bot_id,bot_username,credential_ref,status,webapp_url,enabled_capabilities_json,metadata_json,created_by_user_id,updated_by_user_id,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)`).run(org,values[1],values[2],values[3],values[4],values[5],values[6],values[7],actorId,actorId,now,now);
    }
    audit(String(chatId), 'telegram.storefront.configured', 'telegram_storefront', org, { status, hasCredentialRef: !!values[3], botId: values[1], botUsername: values[2] }, { organizationId: org, actorId });
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return getTelegramStorefrontConfig(chatId);
}


export async function verifyTelegramStorefront(chatId, actor = null) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) throw Object.assign(new Error('Tenant organization not found'), { statusCode: 404, code: 'ORGANIZATION_NOT_FOUND' });
  const org = tenant.organizationId;
  const actorId = actor?.userId || null;
  const current = getTelegramStorefrontConfig(chatId);
  if (!current?.credentialRef) throw Object.assign(new Error('Telegram bot credential is not configured'), { statusCode: 409, code: 'TELEGRAM_CREDENTIAL_REQUIRED' });
  try {
    const identity = await verifyTelegramBotCredential(current.credentialRef);
    const now = nowIso();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`UPDATE telegram_storefront_configs SET bot_id=?,bot_username=?,status='VERIFIED',updated_by_user_id=?,updated_at=?,version=version+1 WHERE organization_id=?`).run(identity.botId, identity.botUsername, actorId, now, org);
      audit(String(chatId), 'telegram.storefront.verified', 'telegram_storefront', org, { botId: identity.botId, botUsername: identity.botUsername }, { organizationId: org, actorId });
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return getTelegramStorefrontConfig(chatId);
  } catch (e) {
    audit(String(chatId), 'telegram.storefront.verification_failed', 'telegram_storefront', org, { code: e.code || 'TELEGRAM_BOT_VERIFICATION_FAILED' }, { organizationId: org, actorId, result: 'failure' });
    throw e;
  }
}

const SUPPLIER_NETWORK_SERVICE_AREA_VISIBILITIES = Object.freeze(['PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL']);
const SUPPLIER_NETWORK_SERVICE_AREA_TYPES = Object.freeze(['COUNTRY','REGION','ZONE','DISTRICT','CITY','POSTAL_CODE','RADIUS']);
const SUPPLIER_NETWORK_SERVICE_AREA_STATES = Object.freeze({ ACTIVE: new Set(['INACTIVE']), INACTIVE: new Set(['ACTIVE']) });
function supplierNetworkServiceAreaFromRow(row){if(!row)return null;return {id:row.id,organizationId:row.organization_id,scopeType:row.scope_type,countryCode:row.country_code,geoCode:row.geo_code||'',displayName:row.display_name||'',radiusKm:row.radius_km==null?null:Number(row.radius_km),centerLatitude:row.center_latitude==null?null:Number(row.center_latitude),centerLongitude:row.center_longitude==null?null:Number(row.center_longitude),visibility:row.visibility,status:row.status,metadata:parseJSON(row.metadata_json,{}),createdByUserId:row.created_by_user_id,updatedByUserId:row.updated_by_user_id,createdAt:row.created_at,updatedAt:row.updated_at,version:Number(row.version||1)}}
function normalizeSupplierNetworkServiceAreaInput(input={}){const clean=(v,max=500)=>String(v??'').trim().slice(0,max);const scopeType=clean(input.scopeType??input.scope_type,30).toUpperCase();if(!SUPPLIER_NETWORK_SERVICE_AREA_TYPES.includes(scopeType))throw Object.assign(new Error('Invalid service area scope type'),{statusCode:400,code:'INVALID_SERVICE_AREA_SCOPE'});const countryCode=clean(input.countryCode??input.country_code,10).toUpperCase();if(!countryCode)throw Object.assign(new Error('countryCode is required'),{statusCode:400,code:'SERVICE_AREA_COUNTRY_REQUIRED'});const geoCode=clean(input.geoCode??input.geo_code,200);const displayName=clean(input.displayName??input.display_name,500);const radius=input.radiusKm??input.radius_km;const lat=input.centerLatitude??input.center_latitude;const lon=input.centerLongitude??input.center_longitude;if(scopeType==='RADIUS' && (radius==null||!Number.isFinite(Number(radius))||Number(radius)<=0))throw Object.assign(new Error('radiusKm must be positive for RADIUS service areas'),{statusCode:400,code:'SERVICE_AREA_RADIUS_REQUIRED'});if(radius!=null&&(!Number.isFinite(Number(radius))||Number(radius)<=0))throw Object.assign(new Error('radiusKm must be positive'),{statusCode:400,code:'INVALID_SERVICE_AREA_RADIUS'});if(lat!=null&&(!Number.isFinite(Number(lat))||Number(lat)<-90||Number(lat)>90))throw Object.assign(new Error('centerLatitude must be between -90 and 90'),{statusCode:400,code:'INVALID_SERVICE_AREA_LATITUDE'});if(lon!=null&&(!Number.isFinite(Number(lon))||Number(lon)<-180||Number(lon)>180))throw Object.assign(new Error('centerLongitude must be between -180 and 180'),{statusCode:400,code:'INVALID_SERVICE_AREA_LONGITUDE'});if(scopeType!=='RADIUS'&&(lat!=null||lon!=null||radius!=null))throw Object.assign(new Error('Radius coordinates are only valid for RADIUS service areas'),{statusCode:400,code:'INVALID_SERVICE_AREA_GEOMETRY'});if(scopeType!=='COUNTRY'&&!geoCode)throw Object.assign(new Error('geoCode is required for non-country service areas'),{statusCode:400,code:'SERVICE_AREA_GEO_CODE_REQUIRED'});const visibility=clean(input.visibility||'NETWORK',20).toUpperCase();if(!SUPPLIER_NETWORK_SERVICE_AREA_VISIBILITIES.includes(visibility))throw Object.assign(new Error('Invalid service area visibility'),{statusCode:400,code:'INVALID_SERVICE_AREA_VISIBILITY'});const metadata=input.metadata??{};if(!metadata||Array.isArray(metadata)||typeof metadata!=='object')throw Object.assign(new Error('metadata must be an object'),{statusCode:400,code:'INVALID_SERVICE_AREA_METADATA'});return {scopeType,countryCode,geoCode,displayName,radiusKm:radius==null?null:Number(radius),centerLatitude:lat==null?null:Number(lat),centerLongitude:lon==null?null:Number(lon),visibility,metadata}}
function supplierNetworkServiceAreaRow(id,organizationId){return db.prepare('SELECT * FROM supplier_network_service_areas WHERE id=? AND organization_id=?').get(String(id),String(organizationId))}
const SUPPLIER_NETWORK_QUALIFICATION_STATUSES = Object.freeze({ DECLARED:new Set(['DOCUMENTED','REVOKED']), DOCUMENTED:new Set(['VERIFIED','REVOKED']), VERIFIED:new Set(['EXPIRED','REVOKED']), EXPIRED:new Set(['DOCUMENTED','REVOKED']), REVOKED:new Set(['DOCUMENTED']) });
const SUPPLIER_NETWORK_QUALIFICATION_VISIBILITIES = Object.freeze(['PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL']);
function supplierNetworkQualificationFromRow(row){if(!row)return null;return {id:row.id,organizationId:row.organization_id,qualificationType:row.qualification_type,status:row.status,title:row.title,issuer:row.issuer,referenceNumber:row.reference_number,evidence:parseJSON(row.evidence_json,{}),validFrom:row.valid_from,validUntil:row.valid_until,verifiedByUserId:row.verified_by_user_id,verifiedAt:row.verified_at,visibility:row.visibility,metadata:parseJSON(row.metadata_json,{}),createdByUserId:row.created_by_user_id,updatedByUserId:row.updated_by_user_id,createdAt:row.created_at,updatedAt:row.updated_at,version:Number(row.version||1)}}
function supplierNetworkQualificationRow(id,org){return db.prepare('SELECT * FROM supplier_network_qualifications WHERE id=? AND organization_id=?').get(String(id),String(org))}
function normalizeSupplierNetworkQualificationInput(input={}){const clean=(v,max=500)=>String(v??'').trim().slice(0,max);const type=clean(input.qualificationType??input.qualification_type,120);if(!type)throw Object.assign(new Error('qualificationType is required'),{statusCode:400,code:'QUALIFICATION_TYPE_REQUIRED'});const status=clean(input.status||'DECLARED',20).toUpperCase();if(!SUPPLIER_NETWORK_QUALIFICATION_STATUSES[status])throw Object.assign(new Error('Invalid qualification status'),{statusCode:400,code:'INVALID_QUALIFICATION_STATUS'});const title=clean(input.title,300),issuer=clean(input.issuer,300),referenceNumber=clean(input.referenceNumber??input.reference_number,200);const evidence=input.evidence??{};if(!evidence||Array.isArray(evidence)||typeof evidence!=='object')throw Object.assign(new Error('evidence must be an object'),{statusCode:400,code:'INVALID_QUALIFICATION_EVIDENCE'});const metadata=input.metadata??{};if(!metadata||Array.isArray(metadata)||typeof metadata!=='object')throw Object.assign(new Error('metadata must be an object'),{statusCode:400,code:'INVALID_QUALIFICATION_METADATA'});const validFrom=input.validFrom??input.valid_from??null,validUntil=input.validUntil??input.valid_until??null;if(validFrom&&validUntil&&String(validFrom)>String(validUntil))throw Object.assign(new Error('validFrom cannot exceed validUntil'),{statusCode:400,code:'INVALID_QUALIFICATION_PERIOD'});const visibility=clean(input.visibility||'RELATIONSHIP',20).toUpperCase();if(!SUPPLIER_NETWORK_QUALIFICATION_VISIBILITIES.includes(visibility))throw Object.assign(new Error('Invalid qualification visibility'),{statusCode:400,code:'INVALID_QUALIFICATION_VISIBILITY'});if(status==='VERIFIED'&&(!input.verifiedByUserId&&!input.verified_by_user_id))throw Object.assign(new Error('verifiedByUserId is required for VERIFIED status'),{statusCode:400,code:'VERIFIER_REQUIRED'});return {qualificationType:type,status,title,issuer,referenceNumber,evidence,validFrom:validFrom==null?null:clean(validFrom,100),validUntil:validUntil==null?null:clean(validUntil,100),verifiedByUserId:clean(input.verifiedByUserId??input.verified_by_user_id,200)||null,visibility,metadata}}
export async function listSupplierNetworkQualifications(chatId,options={}){ensureDatabase();const org=await tenantOrganizationId(chatId);const w=['organization_id=?'],p=[org];if(options.status&&options.status!=='all'){w.push('status=?');p.push(String(options.status).toUpperCase())}if(options.qualificationType||options.qualification_type){w.push('qualification_type=?');p.push(String(options.qualificationType||options.qualification_type))}p.push(Math.max(1,Math.min(500,Number(options.limit)||100)));return db.prepare(`SELECT * FROM supplier_network_qualifications WHERE ${w.join(' AND ')} ORDER BY updated_at DESC,id ASC LIMIT ?`).all(...p).map(supplierNetworkQualificationFromRow)}
export async function getSupplierNetworkQualification(chatId,id){ensureDatabase();const org=await tenantOrganizationId(chatId);return supplierNetworkQualificationFromRow(supplierNetworkQualificationRow(id,org))}
export async function upsertSupplierNetworkQualification(chatId,input={},actor=null){ensureDatabase();const org=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(org,actor);assertSupplierNetworkParticipant(org);const n=normalizeSupplierNetworkQualificationInput(input);const existing=input.id?supplierNetworkQualificationRow(input.id,org):null;const target=existing&&input.status==null?existing.status:n.status;if(existing&&existing.status!==target&&!SUPPLIER_NETWORK_QUALIFICATION_STATUSES[existing.status]?.has(target))throw Object.assign(new Error(`Illegal qualification transition ${existing.status} -> ${target}`),{statusCode:409,code:'INVALID_QUALIFICATION_TRANSITION'});if(target==='VERIFIED'){n.verifiedByUserId=actorId}else if(target!=='VERIFIED'&&existing&&input.verifiedByUserId==null&&input.verified_by_user_id==null){n.verifiedByUserId=existing.verified_by_user_id||null}const now=nowIso();db.exec('BEGIN IMMEDIATE');try{if(existing){db.prepare(`UPDATE supplier_network_qualifications SET qualification_type=?,status=?,title=?,issuer=?,reference_number=?,evidence_json=?,valid_from=?,valid_until=?,verified_by_user_id=?,verified_at=?,visibility=?,metadata_json=?,updated_by_user_id=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=?`).run(n.qualificationType,target,n.title,n.issuer,n.referenceNumber,json(n.evidence),n.validFrom,n.validUntil,n.verifiedByUserId,target==='VERIFIED'?now:null,n.visibility,json(n.metadata),actorId,now,existing.id,org);audit(String(chatId),`supplier.network.qualification.${target.toLowerCase()}`,'supplier_network_qualifications',existing.id,{qualificationType:n.qualificationType,status:target,visibility:n.visibility},{organizationId:org,actorId})}else{const id=String(input.id||crypto.randomUUID());db.prepare(`INSERT INTO supplier_network_qualifications (id,organization_id,qualification_type,status,title,issuer,reference_number,evidence_json,valid_from,valid_until,verified_by_user_id,verified_at,visibility,metadata_json,created_by_user_id,updated_by_user_id,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`).run(id,org,n.qualificationType,target,n.title,n.issuer,n.referenceNumber,json(n.evidence),n.validFrom,n.validUntil,target==='VERIFIED'?actorId:null,target==='VERIFIED'?now:null,n.visibility,json(n.metadata),actorId,actorId,now,now);audit(String(chatId),'supplier.network.qualification.created','supplier_network_qualifications',id,{qualificationType:n.qualificationType,status:target,visibility:n.visibility},{organizationId:org,actorId})}db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return supplierNetworkQualificationFromRow(existing?supplierNetworkQualificationRow(existing.id,org):db.prepare('SELECT * FROM supplier_network_qualifications WHERE organization_id=? ORDER BY created_at DESC LIMIT 1').get(org))}
export async function transitionSupplierNetworkQualification(chatId,id,targetStatus,actor=null){ensureDatabase();const org=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(org,actor);assertSupplierNetworkParticipant(org);const row=supplierNetworkQualificationRow(id,org);if(!row)throw Object.assign(new Error('Supplier network qualification not found'),{statusCode:404,code:'QUALIFICATION_NOT_FOUND'});const target=String(targetStatus||'').toUpperCase();if(!SUPPLIER_NETWORK_QUALIFICATION_STATUSES[target])throw Object.assign(new Error('Invalid qualification status'),{statusCode:400,code:'INVALID_QUALIFICATION_STATUS'});if(!SUPPLIER_NETWORK_QUALIFICATION_STATUSES[row.status]?.has(target))throw Object.assign(new Error(`Illegal qualification transition ${row.status} -> ${target}`),{statusCode:409,code:'INVALID_QUALIFICATION_TRANSITION'});const now=nowIso();db.prepare('UPDATE supplier_network_qualifications SET status=?,verified_by_user_id=?,verified_at=?,updated_by_user_id=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=?').run(target,target==='VERIFIED'?actorId:null,target==='VERIFIED'?now:null,actorId,now,row.id,org);audit(String(chatId),`supplier.network.qualification.${target.toLowerCase()}`,'supplier_network_qualifications',row.id,{fromStatus:row.status,toStatus:target},{organizationId:org,actorId});return supplierNetworkQualificationFromRow(supplierNetworkQualificationRow(row.id,org))}

const SUPPLIER_NETWORK_COMMERCIAL_SUBJECT_TYPES = Object.freeze(['NETWORK','PRODUCT','CAPABILITY']);
const SUPPLIER_NETWORK_COMMERCIAL_VISIBILITIES = Object.freeze(['PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL']);
const SUPPLIER_NETWORK_COMMERCIAL_STATES = Object.freeze({ ACTIVE: new Set(['INACTIVE']), INACTIVE: new Set(['ACTIVE']) });
function supplierNetworkCommercialTermsFromRow(row){if(!row)return null;return {id:row.id,organizationId:row.organization_id,subjectType:row.subject_type,subjectId:row.subject_id||null,minimumOrderQuantity:row.minimum_order_quantity==null?null:Number(row.minimum_order_quantity),unit:row.unit||'',supportedCurrencies:parseJSON(row.supported_currencies_json,[]),paymentTerms:parseJSON(row.payment_terms_json,[]),leadTimeMinDays:row.lead_time_min_days==null?null:Number(row.lead_time_min_days),leadTimeMaxDays:row.lead_time_max_days==null?null:Number(row.lead_time_max_days),wholesaleCapable:Boolean(row.wholesale_capable),bulkOrderCapable:Boolean(row.bulk_order_capable),deliveryTerms:parseJSON(row.delivery_terms_json,[]),visibility:row.visibility,status:row.status,metadata:parseJSON(row.metadata_json,{}),createdByUserId:row.created_by_user_id,updatedByUserId:row.updated_by_user_id,createdAt:row.created_at,updatedAt:row.updated_at,version:Number(row.version||1)}}
function normalizeSupplierNetworkCommercialTermsInput(input={}){const clean=(v,max=500)=>String(v??'').trim().slice(0,max);const subjectType=clean(input.subjectType??input.subject_type,30).toUpperCase();if(!SUPPLIER_NETWORK_COMMERCIAL_SUBJECT_TYPES.includes(subjectType))throw Object.assign(new Error('Invalid commercial terms subject type'),{statusCode:400,code:'INVALID_COMMERCIAL_SUBJECT'});const subjectId=subjectType==='NETWORK'?null:clean(input.subjectId??input.subject_id,200);if(subjectType!=='NETWORK'&&!subjectId)throw Object.assign(new Error('subjectId is required for PRODUCT or CAPABILITY commercial terms'),{statusCode:400,code:'COMMERCIAL_SUBJECT_REQUIRED'});const moq=input.minimumOrderQuantity??input.minimum_order_quantity;if(moq!=null&&(!Number.isFinite(Number(moq))||Number(moq)<=0))throw Object.assign(new Error('minimumOrderQuantity must be positive'),{statusCode:400,code:'INVALID_COMMERCIAL_MOQ'});const unit=clean(input.unit,50);const list=(v,name)=>{const a=v??[];if(!Array.isArray(a)||a.some(x=>!clean(x,100)))throw Object.assign(new Error(`${name} must be an array of non-empty strings`),{statusCode:400,code:'INVALID_COMMERCIAL_LIST'});return [...new Set(a.map(x=>clean(x,100).toUpperCase()))]};const currencies=list(input.supportedCurrencies??input.supported_currencies,'supportedCurrencies');const payments=list(input.paymentTerms??input.payment_terms,'paymentTerms');const deliveries=list(input.deliveryTerms??input.delivery_terms,'deliveryTerms');const min=input.leadTimeMinDays??input.lead_time_min_days;const max=input.leadTimeMaxDays??input.lead_time_max_days;if(min!=null&&(!Number.isInteger(Number(min))||Number(min)<0))throw Object.assign(new Error('leadTimeMinDays must be a non-negative integer'),{statusCode:400,code:'INVALID_LEAD_TIME'});if(max!=null&&(!Number.isInteger(Number(max))||Number(max)<0))throw Object.assign(new Error('leadTimeMaxDays must be a non-negative integer'),{statusCode:400,code:'INVALID_LEAD_TIME'});if(min!=null&&max!=null&&Number(min)>Number(max))throw Object.assign(new Error('leadTimeMinDays cannot exceed leadTimeMaxDays'),{statusCode:400,code:'INVALID_LEAD_TIME_RANGE'});const bool=v=>v===true||v===1||v==='1'||String(v).toLowerCase()==='true';const visibility=clean(input.visibility||'NETWORK',20).toUpperCase();if(!SUPPLIER_NETWORK_COMMERCIAL_VISIBILITIES.includes(visibility))throw Object.assign(new Error('Invalid commercial terms visibility'),{statusCode:400,code:'INVALID_COMMERCIAL_VISIBILITY'});const metadata=input.metadata??{};if(!metadata||Array.isArray(metadata)||typeof metadata!=='object')throw Object.assign(new Error('metadata must be an object'),{statusCode:400,code:'INVALID_COMMERCIAL_METADATA'});return {subjectType,subjectId,minimumOrderQuantity:moq==null?null:Number(moq),unit,supportedCurrencies:currencies,paymentTerms:payments,leadTimeMinDays:min==null?null:Number(min),leadTimeMaxDays:max==null?null:Number(max),wholesaleCapable:bool(input.wholesaleCapable??input.wholesale_capable),bulkOrderCapable:bool(input.bulkOrderCapable??input.bulk_order_capable),deliveryTerms:deliveries,visibility,metadata}}
function supplierNetworkCommercialTermsRow(id,organizationId){return db.prepare('SELECT * FROM supplier_network_commercial_terms WHERE id=? AND organization_id=?').get(String(id),String(organizationId))}
export async function listSupplierNetworkCommercialTerms(chatId,options={}){ensureDatabase();const org=await tenantOrganizationId(chatId);const w=['organization_id=?'],p=[org];if(options.status&&options.status!=='all'){w.push('status=?');p.push(String(options.status).toUpperCase())}if(options.subjectType||options.subject_type){w.push('subject_type=?');p.push(String(options.subjectType||options.subject_type).toUpperCase())}if(options.subjectId||options.subject_id){w.push('subject_id=?');p.push(String(options.subjectId||options.subject_id))}p.push(Math.max(1,Math.min(500,Number(options.limit)||100)));return db.prepare(`SELECT * FROM supplier_network_commercial_terms WHERE ${w.join(' AND ')} ORDER BY updated_at DESC,id ASC LIMIT ?`).all(...p).map(supplierNetworkCommercialTermsFromRow)}
export async function getSupplierNetworkCommercialTerms(chatId,id){ensureDatabase();const org=await tenantOrganizationId(chatId);return supplierNetworkCommercialTermsFromRow(supplierNetworkCommercialTermsRow(id,org))}
export async function upsertSupplierNetworkCommercialTerms(chatId,input={},actor=null){ensureDatabase();const org=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(org,actor);assertSupplierNetworkParticipant(org);const n=normalizeSupplierNetworkCommercialTermsInput(input);if(n.subjectType==='PRODUCT'){const tenant=supplierTenantForOrganization(org);const product=tenant&&db.prepare('SELECT product_id FROM catalog_products WHERE chat_id=? AND product_id=?').get(String(tenant.chat_id),n.subjectId);if(!product)throw Object.assign(new Error('Product must exist in the supplier canonical catalog'),{statusCode:404,code:'PRODUCT_NOT_FOUND'})}if(n.subjectType==='CAPABILITY'){const cap=db.prepare('SELECT id FROM supplier_network_capabilities WHERE organization_id=? AND id=? AND status=?').get(org,n.subjectId,'ACTIVE');if(!cap)throw Object.assign(new Error('Active supplier capability not found'),{statusCode:404,code:'CAPABILITY_NOT_FOUND'})}const existing=input.id?supplierNetworkCommercialTermsRow(input.id,org):db.prepare('SELECT * FROM supplier_network_commercial_terms WHERE organization_id=? AND subject_type=? AND subject_id IS ?').get(org,n.subjectType,n.subjectId);const target=input.status==null?(existing?.status||'ACTIVE'):String(input.status).toUpperCase();if(!SUPPLIER_NETWORK_COMMERCIAL_STATES[target])throw Object.assign(new Error('Invalid commercial terms status'),{statusCode:400,code:'INVALID_COMMERCIAL_STATUS'});if(existing&&existing.status!==target&&!SUPPLIER_NETWORK_COMMERCIAL_STATES[existing.status]?.has(target))throw Object.assign(new Error(`Illegal commercial terms transition ${existing.status} -> ${target}`),{statusCode:409,code:'INVALID_COMMERCIAL_TRANSITION'});const now=nowIso();db.exec('BEGIN IMMEDIATE');try{if(existing){db.prepare(`UPDATE supplier_network_commercial_terms SET subject_type=?,subject_id=?,minimum_order_quantity=?,unit=?,supported_currencies_json=?,payment_terms_json=?,lead_time_min_days=?,lead_time_max_days=?,wholesale_capable=?,bulk_order_capable=?,delivery_terms_json=?,visibility=?,status=?,metadata_json=?,updated_by_user_id=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=?`).run(n.subjectType,n.subjectId,n.minimumOrderQuantity,n.unit,json(n.supportedCurrencies),json(n.paymentTerms),n.leadTimeMinDays,n.leadTimeMaxDays,n.wholesaleCapable?1:0,n.bulkOrderCapable?1:0,json(n.deliveryTerms),n.visibility,target,json(n.metadata),actorId,now,existing.id,org);audit(String(chatId),target!==existing.status?`supplier.network.commercial.${target.toLowerCase()}`:'supplier.network.commercial.updated','supplier_network_commercial_terms',existing.id,{subjectType:n.subjectType,subjectId:n.subjectId,status:target,visibility:n.visibility},{organizationId:org,actorId})}else{const id=String(input.id||crypto.randomUUID());db.prepare(`INSERT INTO supplier_network_commercial_terms (id,organization_id,subject_type,subject_id,minimum_order_quantity,unit,supported_currencies_json,payment_terms_json,lead_time_min_days,lead_time_max_days,wholesale_capable,bulk_order_capable,delivery_terms_json,visibility,status,metadata_json,created_by_user_id,updated_by_user_id,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?,1)`).run(id,org,n.subjectType,n.subjectId,n.minimumOrderQuantity,n.unit,json(n.supportedCurrencies),json(n.paymentTerms),n.leadTimeMinDays,n.leadTimeMaxDays,n.wholesaleCapable?1:0,n.bulkOrderCapable?1:0,json(n.deliveryTerms),n.visibility,target,json(n.metadata),actorId,actorId,now,now);audit(String(chatId),'supplier.network.commercial.created','supplier_network_commercial_terms',id,{subjectType:n.subjectType,subjectId:n.subjectId,status:target,visibility:n.visibility},{organizationId:org,actorId})}db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return supplierNetworkCommercialTermsFromRow(existing?supplierNetworkCommercialTermsRow(existing.id,org):db.prepare('SELECT * FROM supplier_network_commercial_terms WHERE organization_id=? AND subject_type=? AND subject_id IS ?').get(org,n.subjectType,n.subjectId))}
export async function transitionSupplierNetworkCommercialTerms(chatId,id,targetStatus,actor=null){ensureDatabase();const org=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(org,actor);assertSupplierNetworkParticipant(org);const row=supplierNetworkCommercialTermsRow(id,org);if(!row)throw Object.assign(new Error('Supplier network commercial terms not found'),{statusCode:404,code:'COMMERCIAL_TERMS_NOT_FOUND'});const target=String(targetStatus||'').toUpperCase();if(!SUPPLIER_NETWORK_COMMERCIAL_STATES[target])throw Object.assign(new Error('Invalid commercial terms status'),{statusCode:400,code:'INVALID_COMMERCIAL_STATUS'});if(!SUPPLIER_NETWORK_COMMERCIAL_STATES[row.status]?.has(target))throw Object.assign(new Error(`Illegal commercial terms transition ${row.status} -> ${target}`),{statusCode:409,code:'INVALID_COMMERCIAL_TRANSITION'});const now=nowIso();db.prepare('UPDATE supplier_network_commercial_terms SET status=?,updated_by_user_id=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=?').run(target,actorId,now,row.id,org);audit(String(chatId),`supplier.network.commercial.${target.toLowerCase()}`,'supplier_network_commercial_terms',row.id,{fromStatus:row.status,toStatus:target},{organizationId:org,actorId});return supplierNetworkCommercialTermsFromRow(supplierNetworkCommercialTermsRow(row.id,org))}

const SUPPLIER_NETWORK_CAPACITY_SUBJECT_TYPES = Object.freeze(['PRODUCT','CAPABILITY']);
const SUPPLIER_NETWORK_CAPACITY_AVAILABILITY = Object.freeze(['AVAILABLE','LIMITED','UNAVAILABLE','ON_REQUEST']);
const SUPPLIER_NETWORK_CAPACITY_VISIBILITIES = Object.freeze(['PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL']);
const SUPPLIER_NETWORK_CAPACITY_STATES = Object.freeze({ ACTIVE: new Set(['INACTIVE']), INACTIVE: new Set(['ACTIVE']) });
function supplierNetworkCapacityFromRow(row){if(!row)return null;return {id:row.id,organizationId:row.organization_id,subjectType:row.subject_type,subjectId:row.subject_id,quantity:Number(row.quantity),unit:row.unit,periodType:row.period_type,periodStart:row.period_start,periodEnd:row.period_end,availability:row.availability,visibility:row.visibility,source:row.source,status:row.status,metadata:parseJSON(row.metadata_json,{}),createdByUserId:row.created_by_user_id,updatedByUserId:row.updated_by_user_id,createdAt:row.created_at,updatedAt:row.updated_at,version:Number(row.version||1)}}
function normalizeSupplierNetworkCapacityInput(input={}){const clean=(v,max=500)=>String(v??'').trim().slice(0,max);const subjectType=clean(input.subjectType??input.subject_type,30).toUpperCase();if(!SUPPLIER_NETWORK_CAPACITY_SUBJECT_TYPES.includes(subjectType))throw Object.assign(new Error('Invalid capacity subject type'),{statusCode:400,code:'INVALID_CAPACITY_SUBJECT'});const subjectId=clean(input.subjectId??input.subject_id,200);if(!subjectId)throw Object.assign(new Error('subjectId is required'),{statusCode:400,code:'CAPACITY_SUBJECT_REQUIRED'});const quantity=Number(input.quantity);if(!Number.isFinite(quantity)||quantity<=0)throw Object.assign(new Error('quantity must be positive'),{statusCode:400,code:'INVALID_CAPACITY_QUANTITY'});const unit=clean(input.unit,50);if(!unit)throw Object.assign(new Error('unit is required'),{statusCode:400,code:'CAPACITY_UNIT_REQUIRED'});const periodType=clean(input.periodType??input.period_type,'ON_DEMAND'.length>0?30:30).toUpperCase()||'ON_DEMAND';const periodStart=input.periodStart??input.period_start??null;const periodEnd=input.periodEnd??input.period_end??null;if((periodStart&&!periodEnd)||(periodEnd&&!periodStart)|| (periodStart&&periodEnd&&String(periodStart)>String(periodEnd)))throw Object.assign(new Error('periodStart and periodEnd must form a valid period'),{statusCode:400,code:'INVALID_CAPACITY_PERIOD'});const availability=clean(input.availability||'AVAILABLE',30).toUpperCase();if(!SUPPLIER_NETWORK_CAPACITY_AVAILABILITY.includes(availability))throw Object.assign(new Error('Invalid capacity availability'),{statusCode:400,code:'INVALID_CAPACITY_AVAILABILITY'});const visibility=clean(input.visibility||'NETWORK',20).toUpperCase();if(!SUPPLIER_NETWORK_CAPACITY_VISIBILITIES.includes(visibility))throw Object.assign(new Error('Invalid capacity visibility'),{statusCode:400,code:'INVALID_CAPACITY_VISIBILITY'});const metadata=input.metadata??{};if(!metadata||Array.isArray(metadata)||typeof metadata!=='object')throw Object.assign(new Error('metadata must be an object'),{statusCode:400,code:'INVALID_CAPACITY_METADATA'});return {subjectType,subjectId,quantity,unit,periodType,periodStart:periodStart==null?null:clean(periodStart,100),periodEnd:periodEnd==null?null:clean(periodEnd,100),availability,visibility,metadata}}
function supplierNetworkCapacityRow(id,organizationId){return db.prepare('SELECT * FROM supplier_network_capacity_signals WHERE id=? AND organization_id=?').get(String(id),String(organizationId))}
export async function listSupplierNetworkCapacities(chatId,options={}){ensureDatabase();const org=await tenantOrganizationId(chatId);const w=['organization_id=?'],p=[org];if(options.status&&options.status!=='all'){w.push('status=?');p.push(String(options.status).toUpperCase())}if(options.subjectType||options.subject_type){w.push('subject_type=?');p.push(String(options.subjectType||options.subject_type).toUpperCase())}if(options.subjectId||options.subject_id){w.push('subject_id=?');p.push(String(options.subjectId||options.subject_id))}if(options.availability){w.push('availability=?');p.push(String(options.availability).toUpperCase())}p.push(Math.max(1,Math.min(500,Number(options.limit)||100)));return db.prepare(`SELECT * FROM supplier_network_capacity_signals WHERE ${w.join(' AND ')} ORDER BY updated_at DESC,id ASC LIMIT ?`).all(...p).map(supplierNetworkCapacityFromRow)}
export async function getSupplierNetworkCapacity(chatId,id){ensureDatabase();const org=await tenantOrganizationId(chatId);return supplierNetworkCapacityFromRow(supplierNetworkCapacityRow(id,org))}
export async function upsertSupplierNetworkCapacity(chatId,input={},actor=null){ensureDatabase();const org=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(org,actor);assertSupplierNetworkParticipant(org);const n=normalizeSupplierNetworkCapacityInput(input);const existing=input.id?supplierNetworkCapacityRow(input.id,org):db.prepare('SELECT * FROM supplier_network_capacity_signals WHERE organization_id=? AND subject_type=? AND subject_id=? AND period_type=? AND period_start IS ? AND period_end IS ?').get(org,n.subjectType,n.subjectId,n.periodType,n.periodStart,n.periodEnd);const target=input.status==null?(existing?.status||'ACTIVE'):String(input.status).toUpperCase();if(!SUPPLIER_NETWORK_CAPACITY_STATES[target])throw Object.assign(new Error('Invalid capacity status'),{statusCode:400,code:'INVALID_CAPACITY_STATUS'});if(existing&&existing.status!==target&&!SUPPLIER_NETWORK_CAPACITY_STATES[existing.status]?.has(target))throw Object.assign(new Error(`Illegal capacity transition ${existing.status} -> ${target}`),{statusCode:409,code:'INVALID_CAPACITY_TRANSITION'});const now=nowIso();db.exec('BEGIN IMMEDIATE');try{if(existing){db.prepare(`UPDATE supplier_network_capacity_signals SET subject_type=?,subject_id=?,quantity=?,unit=?,period_type=?,period_start=?,period_end=?,availability=?,visibility=?,status=?,metadata_json=?,updated_by_user_id=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=?`).run(n.subjectType,n.subjectId,n.quantity,n.unit,n.periodType,n.periodStart,n.periodEnd,n.availability,n.visibility,target,json(n.metadata),actorId,now,existing.id,org);audit(String(chatId),target!==existing.status?`supplier.network.capacity.${target.toLowerCase()}`:'supplier.network.capacity.updated','supplier_network_capacity_signal',existing.id,{subjectType:n.subjectType,subjectId:n.subjectId,quantity:n.quantity,unit:n.unit,availability:n.availability,status:target,source:'DECLARED'},{organizationId:org,actorId})}else{const id=String(input.id||crypto.randomUUID());db.prepare(`INSERT INTO supplier_network_capacity_signals (id,organization_id,subject_type,subject_id,quantity,unit,period_type,period_start,period_end,availability,visibility,source,status,metadata_json,created_by_user_id,updated_by_user_id,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`).run(id,org,n.subjectType,n.subjectId,n.quantity,n.unit,n.periodType,n.periodStart,n.periodEnd,n.availability,n.visibility,'DECLARED',target,json(n.metadata),actorId,actorId,now,now);audit(String(chatId),'supplier.network.capacity.declared','supplier_network_capacity_signal',id,{subjectType:n.subjectType,subjectId:n.subjectId,quantity:n.quantity,unit:n.unit,availability:n.availability,status:target,source:'DECLARED'},{organizationId:org,actorId})}db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return supplierNetworkCapacityFromRow(existing?supplierNetworkCapacityRow(existing.id,org):db.prepare('SELECT * FROM supplier_network_capacity_signals WHERE organization_id=? AND subject_type=? AND subject_id=? AND period_type=? AND period_start IS ? AND period_end IS ?').get(org,n.subjectType,n.subjectId,n.periodType,n.periodStart,n.periodEnd))}
export async function transitionSupplierNetworkCapacity(chatId,id,targetStatus,actor=null){ensureDatabase();const org=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(org,actor);assertSupplierNetworkParticipant(org);const row=supplierNetworkCapacityRow(id,org);if(!row)throw Object.assign(new Error('Supplier network capacity not found'),{statusCode:404,code:'CAPACITY_NOT_FOUND'});const target=String(targetStatus||'').toUpperCase();if(!SUPPLIER_NETWORK_CAPACITY_STATES[target])throw Object.assign(new Error('Invalid capacity status'),{statusCode:400,code:'INVALID_CAPACITY_STATUS'});if(!SUPPLIER_NETWORK_CAPACITY_STATES[row.status]?.has(target))throw Object.assign(new Error(`Illegal capacity transition ${row.status} -> ${target}`),{statusCode:409,code:'INVALID_CAPACITY_TRANSITION'});const now=nowIso();db.prepare('UPDATE supplier_network_capacity_signals SET status=?,updated_by_user_id=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=?').run(target,actorId,now,row.id,org);audit(String(chatId),`supplier.network.capacity.${target.toLowerCase()}`,'supplier_network_capacity_signal',row.id,{fromStatus:row.status,toStatus:target},{organizationId:org,actorId});return supplierNetworkCapacityFromRow(supplierNetworkCapacityRow(row.id,org))}

export async function listSupplierNetworkServiceAreas(chatId,options={}){ensureDatabase();const org=await tenantOrganizationId(chatId);const w=['organization_id=?'],p=[org];if(options.status&&options.status!=='all'){w.push('status=?');p.push(String(options.status).toUpperCase())}if(options.scopeType||options.scope_type){w.push('scope_type=?');p.push(String(options.scopeType||options.scope_type).toUpperCase())}if(options.countryCode||options.country_code){w.push('country_code=?');p.push(String(options.countryCode||options.country_code).toUpperCase())}if(options.geoCode||options.geo_code){w.push('geo_code=?');p.push(String(options.geoCode||options.geo_code))}p.push(Math.max(1,Math.min(500,Number(options.limit)||100)));return db.prepare(`SELECT * FROM supplier_network_service_areas WHERE ${w.join(' AND ')} ORDER BY updated_at DESC,id ASC LIMIT ?`).all(...p).map(supplierNetworkServiceAreaFromRow)}
export async function getSupplierNetworkServiceArea(chatId,id){ensureDatabase();const org=await tenantOrganizationId(chatId);return supplierNetworkServiceAreaFromRow(supplierNetworkServiceAreaRow(id,org))}
export async function upsertSupplierNetworkServiceArea(chatId,input={},actor=null){ensureDatabase();const org=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(org,actor);assertSupplierNetworkParticipant(org);const normalized=normalizeSupplierNetworkServiceAreaInput(input);const existing=input.id?supplierNetworkServiceAreaRow(input.id,org):db.prepare('SELECT * FROM supplier_network_service_areas WHERE organization_id=? AND scope_type=? AND country_code=? AND geo_code=?').get(org,normalized.scopeType,normalized.countryCode,normalized.geoCode);const target=input.status==null?(existing?.status||'ACTIVE'):String(input.status).toUpperCase();if(!SUPPLIER_NETWORK_SERVICE_AREA_STATES[target])throw Object.assign(new Error('Invalid service area status'),{statusCode:400,code:'INVALID_SERVICE_AREA_STATUS'});if(existing&&existing.status!==target&&!SUPPLIER_NETWORK_SERVICE_AREA_STATES[existing.status]?.has(target))throw Object.assign(new Error(`Illegal service area transition ${existing.status} -> ${target}`),{statusCode:409,code:'INVALID_SERVICE_AREA_TRANSITION'});const now=nowIso();db.exec('BEGIN IMMEDIATE');try{if(existing){db.prepare(`UPDATE supplier_network_service_areas SET scope_type=?,country_code=?,geo_code=?,display_name=?,radius_km=?,center_latitude=?,center_longitude=?,visibility=?,status=?,metadata_json=?,updated_by_user_id=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=?`).run(normalized.scopeType,normalized.countryCode,normalized.geoCode,normalized.displayName,normalized.radiusKm,normalized.centerLatitude,normalized.centerLongitude,normalized.visibility,target,json(normalized.metadata),actorId,now,existing.id,org);audit(String(chatId),target!==existing.status?`supplier.network.service_area.${target.toLowerCase()}`:'supplier.network.service_area.updated','supplier_network_service_area',existing.id,{scopeType:normalized.scopeType,countryCode:normalized.countryCode,geoCode:normalized.geoCode,status:target,visibility:normalized.visibility},{organizationId:org,actorId})}else{const id=String(input.id||crypto.randomUUID());db.prepare(`INSERT INTO supplier_network_service_areas (id,organization_id,scope_type,country_code,geo_code,display_name,radius_km,center_latitude,center_longitude,visibility,status,metadata_json,created_by_user_id,updated_by_user_id,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`).run(id,org,normalized.scopeType,normalized.countryCode,normalized.geoCode,normalized.displayName,normalized.radiusKm,normalized.centerLatitude,normalized.centerLongitude,normalized.visibility,target,json(normalized.metadata),actorId,actorId,now,now);audit(String(chatId),'supplier.network.service_area.created','supplier_network_service_area',id,{scopeType:normalized.scopeType,countryCode:normalized.countryCode,geoCode:normalized.geoCode,status:target,visibility:normalized.visibility},{organizationId:org,actorId})}db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return supplierNetworkServiceAreaFromRow(existing?supplierNetworkServiceAreaRow(existing.id,org):db.prepare('SELECT * FROM supplier_network_service_areas WHERE organization_id=? AND scope_type=? AND country_code=? AND geo_code=?').get(org,normalized.scopeType,normalized.countryCode,normalized.geoCode))}
export async function transitionSupplierNetworkServiceArea(chatId,id,targetStatus,actor=null){ensureDatabase();const org=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(org,actor);assertSupplierNetworkParticipant(org);const row=supplierNetworkServiceAreaRow(id,org);if(!row)throw Object.assign(new Error('Supplier network service area not found'),{statusCode:404,code:'SERVICE_AREA_NOT_FOUND'});const target=String(targetStatus||'').toUpperCase();if(!SUPPLIER_NETWORK_SERVICE_AREA_STATES[target])throw Object.assign(new Error('Invalid service area status'),{statusCode:400,code:'INVALID_SERVICE_AREA_STATUS'});if(!SUPPLIER_NETWORK_SERVICE_AREA_STATES[row.status]?.has(target))throw Object.assign(new Error(`Illegal service area transition ${row.status} -> ${target}`),{statusCode:409,code:'INVALID_SERVICE_AREA_TRANSITION'});const now=nowIso();db.prepare('UPDATE supplier_network_service_areas SET status=?,updated_by_user_id=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=?').run(target,actorId,now,row.id,org);audit(String(chatId),`supplier.network.service_area.${target.toLowerCase()}`,'supplier_network_service_area',row.id,{fromStatus:row.status,toStatus:target},{organizationId:org,actorId});return supplierNetworkServiceAreaFromRow(supplierNetworkServiceAreaRow(row.id,org))}

const SUPPLIER_NETWORK_CATALOG_VISIBILITIES = Object.freeze(['PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL']);
const SUPPLIER_NETWORK_CATALOG_STATES = Object.freeze({ ACTIVE: new Set(['INACTIVE']), INACTIVE: new Set(['ACTIVE']) });
const SUPPLIER_NETWORK_CATALOG_AVAILABILITY = Object.freeze(['AVAILABLE','LIMITED','UNAVAILABLE','ON_REQUEST']);
function supplierNetworkCatalogFromRow(row){if(!row)return null;return {id:row.id,organizationId:row.organization_id,productId:row.product_id,supplierSku:row.supplier_sku||'',description:row.description||'',minimumOrderQuantity:row.minimum_order_quantity==null?null:Number(row.minimum_order_quantity),unit:row.unit||'',indicativePriceMinor:row.indicative_price_minor==null?null:Number(row.indicative_price_minor),currency:normaliseCurrency(row.currency,'ETB'),leadTimeDays:row.lead_time_days==null?null:Number(row.lead_time_days),availabilityStatus:row.availability_status,visibility:row.visibility,status:row.status,metadata:parseJSON(row.metadata_json,{}),createdByUserId:row.created_by_user_id,updatedByUserId:row.updated_by_user_id,createdAt:row.created_at,updatedAt:row.updated_at,version:Number(row.version||1)}}
function normalizeSupplierNetworkCatalogInput(input={}){const clean=(v,max=500)=>String(v??'').trim().slice(0,max);const productId=clean(input.productId??input.product_id,200);if(!productId)throw Object.assign(new Error('productId is required'),{statusCode:400,code:'CATALOG_PRODUCT_ID_REQUIRED'});const supplierSku=clean(input.supplierSku??input.supplier_sku,200);const description=clean(input.description,2000);const unit=clean(input.unit,50);const moq=input.minimumOrderQuantity??input.minimum_order_quantity;if(moq!=null&&(!Number.isFinite(Number(moq))||Number(moq)<=0))throw Object.assign(new Error('minimumOrderQuantity must be positive'),{statusCode:400,code:'INVALID_MINIMUM_ORDER_QUANTITY'});const price=input.indicativePriceMinor??input.indicative_price_minor;if(price!=null&&(!Number.isInteger(Number(price))||Number(price)<0))throw Object.assign(new Error('indicativePriceMinor must be a non-negative integer'),{statusCode:400,code:'INVALID_INDICATIVE_PRICE'});const lead=input.leadTimeDays??input.lead_time_days;if(lead!=null&&(!Number.isInteger(Number(lead))||Number(lead)<0))throw Object.assign(new Error('leadTimeDays must be a non-negative integer'),{statusCode:400,code:'INVALID_LEAD_TIME'});const availability=clean((input.availabilityStatus??input.availability_status??'AVAILABLE'),30).toUpperCase();if(!SUPPLIER_NETWORK_CATALOG_AVAILABILITY.includes(availability))throw Object.assign(new Error('Invalid catalog availability status'),{statusCode:400,code:'INVALID_CATALOG_AVAILABILITY'});const visibility=clean(input.visibility||'NETWORK',20).toUpperCase();if(!SUPPLIER_NETWORK_CATALOG_VISIBILITIES.includes(visibility))throw Object.assign(new Error('Invalid catalog visibility'),{statusCode:400,code:'INVALID_CATALOG_VISIBILITY'});const currency=normaliseCurrency(input.currency||'ETB','ETB');const metadata=input.metadata??{};if(metadata===null||typeof metadata!=='object'||Array.isArray(metadata))throw Object.assign(new Error('metadata must be an object'),{statusCode:400,code:'INVALID_CATALOG_METADATA'});return {productId,supplierSku,description,minimumOrderQuantity:moq==null?null:Number(moq),unit,indicativePriceMinor:price==null?null:Number(price),currency,leadTimeDays:lead==null?null:Number(lead),availabilityStatus:availability,visibility,metadata}}
function supplierNetworkCatalogRow(id,organizationId){return db.prepare('SELECT * FROM supplier_network_catalog_listings WHERE id=? AND organization_id=?').get(String(id),String(organizationId))}
function supplierTenantForOrganization(organizationId){return db.prepare('SELECT chat_id FROM tenants WHERE organization_id=? ORDER BY chat_id LIMIT 1').get(String(organizationId))}
export async function listSupplierNetworkCatalogListings(chatId,options={}){ensureDatabase();const org=await tenantOrganizationId(chatId);const w=['organization_id=?'],p=[org];if(options.status&&options.status!=='all'){w.push('status=?');p.push(String(options.status).toUpperCase())}if(options.productId||options.product_id){w.push('product_id=?');p.push(String(options.productId||options.product_id))}p.push(Math.max(1,Math.min(500,Number(options.limit)||100)));return db.prepare(`SELECT * FROM supplier_network_catalog_listings WHERE ${w.join(' AND ')} ORDER BY updated_at DESC,id ASC LIMIT ?`).all(...p).map(supplierNetworkCatalogFromRow)}
export async function getSupplierNetworkCatalogListing(chatId,id){ensureDatabase();const org=await tenantOrganizationId(chatId);return supplierNetworkCatalogFromRow(supplierNetworkCatalogRow(id,org))}
export async function upsertSupplierNetworkCatalogListing(chatId,input={},actor=null){ensureDatabase();const org=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(org,actor);assertSupplierNetworkParticipant(org);const tenant=supplierTenantForOrganization(org);if(!tenant)throw Object.assign(new Error('Supplier catalog tenant not found'),{statusCode:404,code:'SUPPLIER_TENANT_NOT_FOUND'});const normalized=normalizeSupplierNetworkCatalogInput(input);const product= db.prepare('SELECT * FROM catalog_products WHERE chat_id=? AND product_id=?').get(String(tenant.chat_id),normalized.productId);if(!product)throw Object.assign(new Error('Product must exist in the supplier canonical catalog'),{statusCode:404,code:'PRODUCT_NOT_FOUND'});const existing=input.id?supplierNetworkCatalogRow(input.id,org):db.prepare('SELECT * FROM supplier_network_catalog_listings WHERE organization_id=? AND product_id=?').get(org,normalized.productId);const target=input.status==null?(existing?.status||'ACTIVE'):String(input.status).toUpperCase();if(!SUPPLIER_NETWORK_CATALOG_STATES[target])throw Object.assign(new Error('Invalid catalog listing status'),{statusCode:400,code:'INVALID_CATALOG_STATUS'});if(existing&&existing.status!==target&&!SUPPLIER_NETWORK_CATALOG_STATES[existing.status]?.has(target))throw Object.assign(new Error(`Illegal catalog listing transition ${existing.status} -> ${target}`),{statusCode:409,code:'INVALID_CATALOG_TRANSITION'});const now=nowIso();db.exec('BEGIN IMMEDIATE');try{if(existing){db.prepare(`UPDATE supplier_network_catalog_listings SET product_id=?,supplier_sku=?,description=?,minimum_order_quantity=?,unit=?,indicative_price_minor=?,currency=?,lead_time_days=?,availability_status=?,visibility=?,status=?,metadata_json=?,updated_by_user_id=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=?`).run(normalized.productId,normalized.supplierSku,normalized.description,normalized.minimumOrderQuantity,normalized.unit,normalized.indicativePriceMinor,normalized.currency,normalized.leadTimeDays,normalized.availabilityStatus,normalized.visibility,target,json(normalized.metadata),actorId,now,existing.id,org);audit(String(chatId),target!==existing.status?`supplier.network.catalog.${target.toLowerCase()}`:'supplier.network.catalog.listing_updated','supplier_network_catalog_listing',existing.id,{productId:normalized.productId,status:target,visibility:normalized.visibility},{organizationId:org,actorId})}else{const id=String(input.id||crypto.randomUUID());db.prepare(`INSERT INTO supplier_network_catalog_listings (id,organization_id,product_id,supplier_sku,description,minimum_order_quantity,unit,indicative_price_minor,currency,lead_time_days,availability_status,visibility,status,metadata_json,created_by_user_id,updated_by_user_id,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`).run(id,org,normalized.productId,normalized.supplierSku,normalized.description,normalized.minimumOrderQuantity,normalized.unit,normalized.indicativePriceMinor,normalized.currency,normalized.leadTimeDays,normalized.availabilityStatus,normalized.visibility,target,json(normalized.metadata),actorId,actorId,now,now);audit(String(chatId),'supplier.network.catalog.listing_created','supplier_network_catalog_listing',id,{productId:normalized.productId,status:target,visibility:normalized.visibility},{organizationId:org,actorId})}db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return supplierNetworkCatalogFromRow(existing?supplierNetworkCatalogRow(existing.id,org):db.prepare('SELECT * FROM supplier_network_catalog_listings WHERE organization_id=? AND product_id=?').get(org,normalized.productId))}
export async function transitionSupplierNetworkCatalogListing(chatId,id,targetStatus,actor=null){ensureDatabase();const org=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(org,actor);assertSupplierNetworkParticipant(org);const row=supplierNetworkCatalogRow(id,org);if(!row)throw Object.assign(new Error('Supplier network catalog listing not found'),{statusCode:404,code:'CATALOG_LISTING_NOT_FOUND'});const target=String(targetStatus||'').toUpperCase();if(!SUPPLIER_NETWORK_CATALOG_STATES[target])throw Object.assign(new Error('Invalid catalog listing status'),{statusCode:400,code:'INVALID_CATALOG_STATUS'});if(!SUPPLIER_NETWORK_CATALOG_STATES[row.status]?.has(target))throw Object.assign(new Error(`Illegal catalog listing transition ${row.status} -> ${target}`),{statusCode:409,code:'INVALID_CATALOG_TRANSITION'});const now=nowIso();db.prepare('UPDATE supplier_network_catalog_listings SET status=?,updated_by_user_id=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=?').run(target,actorId,now,row.id,org);audit(String(chatId),`supplier.network.catalog.${target.toLowerCase()}`,'supplier_network_catalog_listing',row.id,{fromStatus:row.status,toStatus:target,productId:row.product_id},{organizationId:org,actorId});return supplierNetworkCatalogFromRow(supplierNetworkCatalogRow(row.id,org))}

const SUPPLIER_NETWORK_CAPABILITY_VISIBILITIES = Object.freeze(['PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL']);
const SUPPLIER_NETWORK_CAPABILITY_STATES = Object.freeze({ ACTIVE: new Set(['INACTIVE']), INACTIVE: new Set(['ACTIVE']) });
const SUPPLIER_NETWORK_CAPABILITY_SOURCES = Object.freeze(['DECLARED','VERIFIED']);
function supplierNetworkCapabilityFromRow(row){if(!row)return null;return {id:row.id,organizationId:row.organization_id,code:row.code,name:row.name,category:row.category||'',description:row.description||'',metadata:parseJSON(row.metadata_json,{}),visibility:row.visibility,source:row.source,status:row.status,createdByUserId:row.created_by_user_id,updatedByUserId:row.updated_by_user_id,createdAt:row.created_at,updatedAt:row.updated_at,version:Number(row.version||1)}}
function normalizeSupplierNetworkCapabilityInput(input={}){const clean=(v,max=200)=>String(v??'').trim().slice(0,max);const code=clean(input.code,100).toUpperCase().replace(/[^A-Z0-9._:-]+/g,'_');if(!code)throw Object.assign(new Error('code is required'),{statusCode:400,code:'CAPABILITY_CODE_REQUIRED'});if(!/^[A-Z0-9][A-Z0-9._:-]*$/.test(code))throw Object.assign(new Error('Invalid capability code'),{statusCode:400,code:'INVALID_CAPABILITY_CODE'});const name=clean(input.name||input.label,200);if(!name)throw Object.assign(new Error('name is required'),{statusCode:400,code:'CAPABILITY_NAME_REQUIRED'});const category=clean(input.category,100);const description=clean(input.description,2000);const metadata=input.metadata??{};if(metadata===null||typeof metadata!=='object'||Array.isArray(metadata))throw Object.assign(new Error('metadata must be an object'),{statusCode:400,code:'INVALID_CAPABILITY_METADATA'});const visibility=clean(input.visibility||'NETWORK',20).toUpperCase();if(!SUPPLIER_NETWORK_CAPABILITY_VISIBILITIES.includes(visibility))throw Object.assign(new Error('Invalid supplier network capability visibility'),{statusCode:400,code:'INVALID_CAPABILITY_VISIBILITY'});const source=clean(input.source||'DECLARED',20).toUpperCase();if(!SUPPLIER_NETWORK_CAPABILITY_SOURCES.includes(source))throw Object.assign(new Error('Invalid supplier network capability source'),{statusCode:400,code:'INVALID_CAPABILITY_SOURCE'});return {code,name,category,description,metadata,visibility,source}}
function supplierNetworkCapabilityRow(id,organizationId){return db.prepare('SELECT * FROM supplier_network_capabilities WHERE id=? AND organization_id=?').get(String(id),String(organizationId))}
export async function listSupplierNetworkCapabilities(chatId,options={}){ensureDatabase();const org=await tenantOrganizationId(chatId);const w=['organization_id=?'],p=[org];if(options.status&&options.status!=='all'){w.push('status=?');p.push(String(options.status).toUpperCase())}if(options.code){w.push('code=?');p.push(String(options.code).trim().toUpperCase())}p.push(Math.max(1,Math.min(500,Number(options.limit)||100)));return db.prepare(`SELECT * FROM supplier_network_capabilities WHERE ${w.join(' AND ')} ORDER BY name ASC, id ASC LIMIT ?`).all(...p).map(supplierNetworkCapabilityFromRow)}
export async function getSupplierNetworkCapability(chatId,id){ensureDatabase();const org=await tenantOrganizationId(chatId);return supplierNetworkCapabilityFromRow(supplierNetworkCapabilityRow(id,org))}
export async function upsertSupplierNetworkCapability(chatId,input={},actor=null){ensureDatabase();const org=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(org,actor);assertSupplierNetworkParticipant(org);const normalized=normalizeSupplierNetworkCapabilityInput(input);const existing=input.id?supplierNetworkCapabilityRow(input.id,org):db.prepare('SELECT * FROM supplier_network_capabilities WHERE organization_id=? AND code=?').get(org,normalized.code);const target=input.status==null?(existing?.status||'ACTIVE'):String(input.status).trim().toUpperCase();if(!SUPPLIER_NETWORK_CAPABILITY_STATES[target]&&target!=='ACTIVE')throw Object.assign(new Error('Invalid supplier network capability status'),{statusCode:400,code:'INVALID_CAPABILITY_STATUS'});if(existing&&existing.status!==target&&!SUPPLIER_NETWORK_CAPABILITY_STATES[existing.status]?.has(target))throw Object.assign(new Error(`Illegal supplier network capability transition ${existing.status} -> ${target}`),{statusCode:409,code:'INVALID_CAPABILITY_TRANSITION'});if(normalized.source==='VERIFIED'&&existing?.source!=='VERIFIED')throw Object.assign(new Error('Only the verification authority may mark a capability VERIFIED'),{statusCode:403,code:'CAPABILITY_VERIFICATION_REQUIRED'});const now=nowIso();db.exec('BEGIN IMMEDIATE');try{if(existing){db.prepare(`UPDATE supplier_network_capabilities SET code=?,name=?,category=?,description=?,metadata_json=?,visibility=?,source=?,status=?,updated_by_user_id=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=?`).run(normalized.code,normalized.name,normalized.category,normalized.description,json(normalized.metadata),normalized.visibility,normalized.source,target,actorId,now,existing.id,org);audit(String(chatId),target!==existing.status?`supplier.network.capability.${target.toLowerCase()}`:'supplier.network.capability.updated','supplier_network_capability',existing.id,{code:normalized.code,status:target,visibility:normalized.visibility,source:normalized.source},{organizationId:org,actorId})}else{const id=String(input.id||crypto.randomUUID());db.prepare(`INSERT INTO supplier_network_capabilities (id,organization_id,code,name,category,description,metadata_json,visibility,source,status,created_by_user_id,updated_by_user_id,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`).run(id,org,normalized.code,normalized.name,normalized.category,normalized.description,json(normalized.metadata),normalized.visibility,normalized.source,target,actorId,actorId,now,now);audit(String(chatId),'supplier.network.capability.created','supplier_network_capability',id,{code:normalized.code,status:target,visibility:normalized.visibility,source:normalized.source},{organizationId:org,actorId})}db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return supplierNetworkCapabilityFromRow(existing?supplierNetworkCapabilityRow(existing.id,org):db.prepare('SELECT * FROM supplier_network_capabilities WHERE organization_id=? AND code=?').get(org,normalized.code))}
export async function transitionSupplierNetworkCapability(chatId,id,targetStatus,actor=null){ensureDatabase();const org=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(org,actor);assertSupplierNetworkParticipant(org);const row=supplierNetworkCapabilityRow(id,org);if(!row)throw Object.assign(new Error('Supplier network capability not found'),{statusCode:404,code:'CAPABILITY_NOT_FOUND'});const target=String(targetStatus||'').trim().toUpperCase();if(!SUPPLIER_NETWORK_CAPABILITY_STATES[target])throw Object.assign(new Error('Invalid supplier network capability status'),{statusCode:400,code:'INVALID_CAPABILITY_STATUS'});if(!SUPPLIER_NETWORK_CAPABILITY_STATES[row.status]?.has(target))throw Object.assign(new Error(`Illegal network capability transition ${row.status} -> ${target}`),{statusCode:409,code:'INVALID_CAPABILITY_TRANSITION'});const now=nowIso();db.prepare('UPDATE supplier_network_capabilities SET status=?,updated_by_user_id=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=?').run(target,actorId,now,row.id,org);audit(String(chatId),`supplier.network.capability.${target.toLowerCase()}`,'supplier_network_capability',row.id,{fromStatus:row.status,toStatus:target,code:row.code},{organizationId:org,actorId});return supplierNetworkCapabilityFromRow(supplierNetworkCapabilityRow(row.id,org))}

const SUPPLIER_NETWORK_PROFILE_VISIBILITIES = Object.freeze(['PUBLIC','NETWORK','RELATIONSHIP','PRIVATE','CONFIDENTIAL']);
const SUPPLIER_NETWORK_PROFILE_STATES = Object.freeze({
  DRAFT: new Set(['PUBLISHED','SUSPENDED']),
  PUBLISHED: new Set(['DRAFT','SUSPENDED']),
  SUSPENDED: new Set(['DRAFT','PUBLISHED']),
});
function supplierNetworkProfileFromRow(row){if(!row)return null;return {organizationId:row.organization_id,displayName:row.display_name,description:row.description||'',businessCategories:parseJSON(row.business_categories_json,[]),serviceSummary:row.service_summary||'',primaryContactReference:row.primary_contact_reference,websiteReference:row.website_reference,visibility:row.visibility,status:row.status,publishedAt:row.published_at,suspendedAt:row.suspended_at,createdByUserId:row.created_by_user_id,updatedByUserId:row.updated_by_user_id,createdAt:row.created_at,updatedAt:row.updated_at,version:Number(row.version||1)}}
function assertSupplierNetworkParticipant(organizationId){const row=supplierParticipantRow(organizationId);if(!row)throw Object.assign(new Error('Organization is not registered as a procurement supplier'),{statusCode:409,code:'SUPPLIER_NOT_REGISTERED'});return row}
function normalizeSupplierProfileInput(input={},organizationName=''){const displayName=String(input.displayName??input.display_name??organizationName??'').trim().slice(0,200);if(!displayName)throw Object.assign(new Error('displayName is required'),{statusCode:400,code:'PROFILE_DISPLAY_NAME_REQUIRED'});const description=String(input.description??'').trim().slice(0,4000);const serviceSummary=String(input.serviceSummary??input.service_summary??'').trim().slice(0,2000);const raw=input.businessCategories??input.business_categories??[];if(!Array.isArray(raw))throw Object.assign(new Error('businessCategories must be an array'),{statusCode:400,code:'INVALID_PROFILE_CATEGORIES'});const businessCategories=[...new Set(raw.filter(v=>typeof v==='string').map(v=>v.trim().slice(0,100)).filter(Boolean))].slice(0,50);const cleanRef=(v,field)=>{if(v==null||v==='')return null;const x=String(v).trim().slice(0,500);if(/[\u0000-\u001f\u007f]/.test(x))throw Object.assign(new Error(`${field} contains invalid control characters`),{statusCode:400,code:'INVALID_PROFILE_REFERENCE'});return x};const visibility=String(input.visibility??'PRIVATE').trim().toUpperCase();if(!SUPPLIER_NETWORK_PROFILE_VISIBILITIES.includes(visibility))throw Object.assign(new Error('Invalid supplier network profile visibility'),{statusCode:400,code:'INVALID_PROFILE_VISIBILITY'});return {displayName,description,businessCategories,serviceSummary,primaryContactReference:cleanRef(input.primaryContactReference??input.primary_contact_reference,null),websiteReference:cleanRef(input.websiteReference??input.website_reference,null),visibility}}
function supplierNetworkProfileRow(organizationId){return db.prepare('SELECT * FROM supplier_network_profiles WHERE organization_id=?').get(String(organizationId))}
export async function getSupplierNetworkProfile(chatId){ensureDatabase();const org=await tenantOrganizationId(chatId);return supplierNetworkProfileFromRow(supplierNetworkProfileRow(org))}
export async function upsertSupplierNetworkProfile(chatId,input={},actor=null){ensureDatabase();const org=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(org,actor);const participant=assertSupplierNetworkParticipant(org);const orgRow=db.prepare('SELECT name FROM organizations WHERE id=?').get(org);const current=supplierNetworkProfileRow(org);const normalized=normalizeSupplierProfileInput(input,orgRow?.name||'');const target=input.status==null?(current?.status||'DRAFT'):String(input.status).trim().toUpperCase();if(!Object.hasOwn(SUPPLIER_NETWORK_PROFILE_STATES,target))throw Object.assign(new Error('Invalid supplier network profile status'),{statusCode:400,code:'INVALID_PROFILE_STATUS'});if(current&&current.status!==target&&!SUPPLIER_NETWORK_PROFILE_STATES[current.status]?.has(target))throw Object.assign(new Error(`Illegal supplier network profile transition ${current.status} -> ${target}`),{statusCode:409,code:'INVALID_PROFILE_TRANSITION'});if(target==='PUBLISHED'&&participant.status!=='ACTIVE')throw Object.assign(new Error('Only an active supplier may publish a supplier network profile'),{statusCode:409,code:'SUPPLIER_NOT_ACTIVE'});const now=nowIso();db.exec('BEGIN IMMEDIATE');try{if(!current){db.prepare(`INSERT INTO supplier_network_profiles (organization_id,display_name,description,business_categories_json,service_summary,primary_contact_reference,website_reference,visibility,status,published_at,suspended_at,created_by_user_id,updated_by_user_id,created_at,updated_at,version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`).run(org,normalized.displayName,normalized.description,json(normalized.businessCategories),normalized.serviceSummary,normalized.primaryContactReference,normalized.websiteReference,normalized.visibility,target,target==='PUBLISHED'?now:null,target==='SUSPENDED'?now:null,actorId,actorId,now,now);audit(String(chatId),'supplier.network.profile.created','supplier_network_profile',org,{status:target,visibility:normalized.visibility},{organizationId:org,actorId})}else{const publishedAt=target==='PUBLISHED'&&current.status!=='PUBLISHED'?now:current.published_at;const suspendedAt=target==='SUSPENDED'&&current.status!=='SUSPENDED'?now:current.suspended_at;db.prepare(`UPDATE supplier_network_profiles SET display_name=?,description=?,business_categories_json=?,service_summary=?,primary_contact_reference=?,website_reference=?,visibility=?,status=?,published_at=?,suspended_at=?,updated_by_user_id=?,updated_at=?,version=version+1 WHERE organization_id=?`).run(normalized.displayName,normalized.description,json(normalized.businessCategories),normalized.serviceSummary,normalized.primaryContactReference,normalized.websiteReference,normalized.visibility,target,publishedAt,suspendedAt,actorId,now,org);audit(String(chatId),target!==current.status?`supplier.network.profile.${target.toLowerCase()}`:'supplier.network.profile.updated','supplier_network_profile',org,{fromStatus:current.status,toStatus:target,visibility:normalized.visibility},{organizationId:org,actorId})}db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return supplierNetworkProfileFromRow(supplierNetworkProfileRow(org))}
export async function transitionSupplierNetworkProfile(chatId,targetStatus,actor=null){ensureDatabase();const org=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(org,actor);const participant=assertSupplierNetworkParticipant(org);const row=supplierNetworkProfileRow(org);if(!row)throw Object.assign(new Error('Supplier network profile not found'),{statusCode:404,code:'PROFILE_NOT_FOUND'});const target=String(targetStatus||'').trim().toUpperCase();if(!Object.hasOwn(SUPPLIER_NETWORK_PROFILE_STATES,target))throw Object.assign(new Error('Invalid supplier network profile status'),{statusCode:400,code:'INVALID_PROFILE_STATUS'});if(!SUPPLIER_NETWORK_PROFILE_STATES[row.status]?.has(target))throw Object.assign(new Error(`Illegal supplier network profile transition ${row.status} -> ${target}`),{statusCode:409,code:'INVALID_PROFILE_TRANSITION'});if(target==='PUBLISHED'&&participant.status!=='ACTIVE')throw Object.assign(new Error('Only an active supplier may publish a supplier network profile'),{statusCode:409,code:'SUPPLIER_NOT_ACTIVE'});const now=nowIso();db.prepare(`UPDATE supplier_network_profiles SET status=?,published_at=CASE WHEN ?='PUBLISHED' THEN COALESCE(published_at,?) ELSE published_at END,suspended_at=CASE WHEN ?='SUSPENDED' THEN ? ELSE suspended_at END,updated_by_user_id=?,updated_at=?,version=version+1 WHERE organization_id=?`).run(target,target,now,target,now,actorId,now,org);audit(String(chatId),`supplier.network.profile.${target.toLowerCase()}`,'supplier_network_profile',org,{fromStatus:row.status,toStatus:target},{organizationId:org,actorId});return supplierNetworkProfileFromRow(supplierNetworkProfileRow(org))}

const PAYMENT_OUTBOUND_STATES = Object.freeze({
  DRAFT: new Set(['INITIATED','CANCELLED']), INITIATED: new Set(['SUBMITTED','FAILED','CANCELLED']),
  SUBMITTED: new Set(['CONFIRMED','FAILED']), CONFIRMED: new Set(), FAILED: new Set(), CANCELLED: new Set(),
});
function paymentOutboundFromRow(row){ if(!row)return null; return {id:row.id,organizationId:row.organization_id,counterpartyOrganizationId:row.counterparty_organization_id,purchaseOrderId:row.purchase_order_id,providerId:row.provider_id,amountMinor:Number(row.amount_minor),currency:normaliseCurrency(row.currency,'ETB'),state:row.state,externalReference:row.external_reference,metadata:parseJSON(row.metadata_json,{}),idempotencyKey:row.idempotency_key,requestHash:row.request_hash,createdByUserId:row.created_by_user_id,createdAt:row.created_at,updatedAt:row.updated_at,initiatedAt:row.initiated_at,submittedAt:row.submitted_at,confirmedAt:row.confirmed_at,failedAt:row.failed_at,cancelledAt:row.cancelled_at}; }
export async function listPaymentOutboundIntents(chatId,options={}){ensureDatabase();const org=await tenantOrganizationId(chatId);const w=['organization_id=?'],p=[org];if(options.purchaseOrderId){w.push('purchase_order_id=?');p.push(String(options.purchaseOrderId));}if(options.state&&options.state!=='all'){w.push('state=?');p.push(String(options.state).toUpperCase());}p.push(Math.max(1,Math.min(500,Number(options.limit)||100)));return db.prepare(`SELECT * FROM payment_outbound_intents WHERE ${w.join(' AND ')} ORDER BY created_at DESC LIMIT ?`).all(...p).map(paymentOutboundFromRow);}
export async function getPaymentOutboundIntent(chatId,intentId){ensureDatabase();const org=await tenantOrganizationId(chatId);return paymentOutboundFromRow(db.prepare('SELECT * FROM payment_outbound_intents WHERE id=? AND organization_id=?').get(String(intentId),org));}
export async function createPaymentOutboundIntent(chatId,input={},actor=null){ensureDatabase();const org=await tenantOrganizationId(chatId);if(actor?.organizationId&&String(actor.organizationId)!==org)throw Object.assign(new Error('Actor organization mismatch'),{statusCode:403,code:'ORGANIZATION_MISMATCH'});const poId=String(input.purchaseOrderId??input.purchase_order_id??'').trim();if(!poId)throw Object.assign(new Error('purchaseOrderId is required'),{statusCode:400,code:'OUTBOUND_PO_REQUIRED'});const po=db.prepare('SELECT id,supplier_organization_id,status,currency,total_minor,procurement_award_id FROM purchase_orders WHERE id=? AND organization_id=?').get(poId,org);if(!po)throw Object.assign(new Error('Purchase order not found'),{statusCode:404,code:'PO_NOT_FOUND'});if(po.status!=='APPROVED')throw Object.assign(new Error('Outbound payment requires an approved purchase order'),{statusCode:409,code:'PO_NOT_APPROVED'});if(!po.supplier_organization_id)throw Object.assign(new Error('Purchase order has no supplier organization'),{statusCode:409,code:'SUPPLIER_REQUIRED'});const amount=Number(input.amountMinor??input.amount_minor??po.total_minor);if(!Number.isInteger(amount)||amount<=0)throw Object.assign(new Error('amountMinor must be a positive integer'),{statusCode:400,code:'INVALID_OUTBOUND_AMOUNT'});if(amount>Number(po.total_minor))throw Object.assign(new Error('Outbound payment cannot exceed purchase order total'),{statusCode:400,code:'OUTBOUND_AMOUNT_EXCEEDS_PO'});const currency=normaliseCurrency(input.currency??po.currency,tenantCurrency(chatId));if(currency!==normaliseCurrency(po.currency,tenantCurrency(chatId)))throw Object.assign(new Error('Outbound payment currency must match purchase order currency'),{statusCode:409,code:'CURRENCY_MISMATCH'});const providerId=String(input.providerId??input.provider_id??'manual').trim().toLowerCase();requirePaymentProvider(providerId);const idem=input.idempotencyKey??input.idempotency_key??null;const payload={purchaseOrderId:poId,amountMinor:amount,currency,providerId,counterpartyOrganizationId:String(po.supplier_organization_id)};const hash=crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');if(idem){const old=db.prepare('SELECT * FROM payment_outbound_intents WHERE organization_id=? AND idempotency_key=?').get(org,String(idem));if(old){if(old.request_hash!==hash)throw Object.assign(new Error('Idempotency key was already used with a different request'),{statusCode:409,code:'IDEMPOTENCY_CONFLICT'});return paymentOutboundFromRow(old);}}const id=String(input.id||crypto.randomUUID()),now=nowIso();db.prepare(`INSERT INTO payment_outbound_intents (id,organization_id,counterparty_organization_id,purchase_order_id,provider_id,amount_minor,currency,state,external_reference,metadata_json,idempotency_key,request_hash,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'DRAFT',?,?,?,?,?,?,?)`).run(id,org,String(po.supplier_organization_id),poId,providerId,amount,currency,input.externalReference??input.external_reference??null,json(input.metadata||{}),idem?String(idem):null,hash,actor?.userId||null,now,now);audit(String(chatId),'payment.outbound.created','payment_outbound_intent',id,{purchaseOrderId:poId,counterpartyOrganizationId:String(po.supplier_organization_id),amountMinor:amount,currency,providerId},{organizationId:org,actorId:actor?.userId||null});return paymentOutboundFromRow(db.prepare('SELECT * FROM payment_outbound_intents WHERE id=?').get(id));}
export async function transitionPaymentOutboundIntent(chatId,intentId,nextState,actor=null,input={}){ensureDatabase();const org=await tenantOrganizationId(chatId),row=db.prepare('SELECT * FROM payment_outbound_intents WHERE id=? AND organization_id=?').get(String(intentId),org);if(!row)throw Object.assign(new Error('Outbound payment intent not found'),{statusCode:404,code:'OUTBOUND_NOT_FOUND'});const target=String(nextState||'').toUpperCase();if(!Object.prototype.hasOwnProperty.call(PAYMENT_OUTBOUND_STATES,target))throw Object.assign(new Error('Invalid outbound payment state'),{statusCode:400,code:'INVALID_OUTBOUND_STATE'});if(row.state===target)return paymentOutboundFromRow(row);if(!PAYMENT_OUTBOUND_STATES[row.state]?.has(target))throw Object.assign(new Error(`Invalid outbound payment transition ${row.state} -> ${target}`),{statusCode:409,code:'INVALID_OUTBOUND_TRANSITION'});const now=nowIso(),sets=['state=?','updated_at=?'],params=[target,now],ts={INITIATED:'initiated_at',SUBMITTED:'submitted_at',CONFIRMED:'confirmed_at',FAILED:'failed_at',CANCELLED:'cancelled_at'}[target];if(ts){sets.push(`${ts}=?`);params.push(now);}params.push(String(intentId),org);db.prepare(`UPDATE payment_outbound_intents SET ${sets.join(',')} WHERE id=? AND organization_id=?`).run(...params);audit(String(chatId),`payment.outbound.${target.toLowerCase()}`,'payment_outbound_intent',String(intentId),{fromState:row.state,toState:target,purchaseOrderId:row.purchase_order_id,reason:input.reason||''},{organizationId:org,actorId:actor?.userId||null});return paymentOutboundFromRow(db.prepare('SELECT * FROM payment_outbound_intents WHERE id=?').get(String(intentId)));}
export async function createProcurementPaymentIntent(chatId,input={},actor=null){const org=await tenantOrganizationId(chatId),poId=String(input.purchaseOrderId??input.purchase_order_id??'').trim();const po=db.prepare('SELECT procurement_award_id FROM purchase_orders WHERE id=? AND organization_id=?').get(poId,org);if(!po?.procurement_award_id)throw Object.assign(new Error('Purchase order is not procurement-origin'),{statusCode:409,code:'NOT_PROCUREMENT_PO'});return createPaymentOutboundIntent(chatId,{...input,purchaseOrderId:poId},actor);}

function paymentProcurementSettlementFromRow(row, allocatedMinor=0){
  if(!row)return null;
  const due=Number(row.total_due_minor), allocated=Number(allocatedMinor||0), outstanding=Math.max(0,due-allocated);
  return {id:row.id,organizationId:row.organization_id,purchaseOrderId:row.purchase_order_id,supplierOrganizationId:row.supplier_organization_id,currency:normaliseCurrency(row.currency,'ETB'),totalDueMinor:due,allocatedMinor:allocated,outstandingMinor:outstanding,status:row.status,createdByUserId:row.created_by_user_id,createdAt:row.created_at,updatedAt:row.updated_at,cancelledAt:row.cancelled_at};
}
async function getOrCreateProcurementSettlement(chatId,purchaseOrderId,actor=null){
  ensureDatabase(); const org=await tenantOrganizationId(chatId); const poId=String(purchaseOrderId||'').trim();
  const po=db.prepare('SELECT id,supplier_organization_id,status,currency,total_minor,procurement_award_id FROM purchase_orders WHERE id=? AND organization_id=?').get(poId,org);
  if(!po) throw Object.assign(new Error('Purchase order not found'),{statusCode:404,code:'PO_NOT_FOUND'});
  if(po.status!=='APPROVED') throw Object.assign(new Error('Settlement requires an approved purchase order'),{statusCode:409,code:'PO_NOT_APPROVED'});
  if(!po.procurement_award_id||!po.supplier_organization_id) throw Object.assign(new Error('Settlement requires a procurement-origin purchase order'),{statusCode:409,code:'NOT_PROCUREMENT_PO'});
  const existing=db.prepare('SELECT * FROM payment_procurement_settlements WHERE organization_id=? AND purchase_order_id=?').get(org,poId);
  if(existing){ const allocated=db.prepare('SELECT COALESCE(SUM(amount_minor),0) AS n FROM payment_procurement_settlement_allocations WHERE settlement_id=?').get(existing.id).n; return paymentProcurementSettlementFromRow(existing,allocated); }
  const id=crypto.randomUUID(),now=nowIso(); db.prepare(`INSERT INTO payment_procurement_settlements (id,organization_id,purchase_order_id,supplier_organization_id,currency,total_due_minor,status,created_by_user_id,created_at,updated_at) VALUES (?,?,?,?,?,?, 'OPEN',?,?,?)`).run(id,org,poId,String(po.supplier_organization_id),normaliseCurrency(po.currency,tenantCurrency(chatId)),Number(po.total_minor),actor?.userId||null,now,now);
  audit(String(chatId),'payment.procurement_settlement.created','payment_procurement_settlement',id,{purchaseOrderId:poId,supplierOrganizationId:String(po.supplier_organization_id),totalDueMinor:Number(po.total_minor),currency:normaliseCurrency(po.currency,tenantCurrency(chatId))},{organizationId:org,actorId:actor?.userId||null});
  return paymentProcurementSettlementFromRow(db.prepare('SELECT * FROM payment_procurement_settlements WHERE id=?').get(id));
}
export async function getProcurementSettlement(chatId,purchaseOrderId,actor=null){ ensureDatabase(); const org=await tenantOrganizationId(chatId); const row=db.prepare('SELECT * FROM payment_procurement_settlements WHERE organization_id=? AND purchase_order_id=?').get(org,String(purchaseOrderId)); if(!row)return null; const allocated=db.prepare('SELECT COALESCE(SUM(amount_minor),0) AS n FROM payment_procurement_settlement_allocations WHERE settlement_id=?').get(row.id).n; return paymentProcurementSettlementFromRow(row,allocated); }
export async function listProcurementSettlements(chatId,options={}){ ensureDatabase(); const org=await tenantOrganizationId(chatId); const w=['organization_id=?'],p=[org]; if(options.status&&options.status!=='all'){w.push('status=?');p.push(String(options.status).toUpperCase());} if(options.purchaseOrderId){w.push('purchase_order_id=?');p.push(String(options.purchaseOrderId));} const rows=db.prepare(`SELECT * FROM payment_procurement_settlements WHERE ${w.join(' AND ')} ORDER BY updated_at DESC LIMIT ?`).all(...p,Math.max(1,Math.min(500,Number(options.limit)||100))); return rows.map(r=>paymentProcurementSettlementFromRow(r,db.prepare('SELECT COALESCE(SUM(amount_minor),0) AS n FROM payment_procurement_settlement_allocations WHERE settlement_id=?').get(r.id).n)); }
export async function listProcurementSettlementAllocations(chatId,purchaseOrderId){ ensureDatabase(); const org=await tenantOrganizationId(chatId); const settlement=db.prepare('SELECT id FROM payment_procurement_settlements WHERE organization_id=? AND purchase_order_id=?').get(org,String(purchaseOrderId)); if(!settlement)return []; return db.prepare(`SELECT a.*,p.provider_id,p.state,p.external_reference FROM payment_procurement_settlement_allocations a JOIN payment_outbound_intents p ON p.id=a.outbound_intent_id WHERE a.settlement_id=? ORDER BY a.created_at ASC`).all(settlement.id).map(r=>({id:r.id,settlementId:r.settlement_id,outboundIntentId:r.outbound_intent_id,amountMinor:Number(r.amount_minor),currency:normaliseCurrency(r.currency,'ETB'),createdByUserId:r.created_by_user_id,createdAt:r.created_at,providerId:r.provider_id,paymentState:r.state,externalReference:r.external_reference})); }
export async function allocateConfirmedOutboundPaymentToProcurementSettlement(chatId,purchaseOrderId,input={},actor=null){
  ensureDatabase(); const org=await tenantOrganizationId(chatId); const poId=String(purchaseOrderId||'').trim(); const intentId=String(input.outboundIntentId??input.outbound_intent_id??'').trim(); if(!intentId)throw Object.assign(new Error('outboundIntentId is required'),{statusCode:400,code:'OUTBOUND_INTENT_REQUIRED'});
  const settlement=await getOrCreateProcurementSettlement(chatId,poId,actor); if(settlement.status==='CANCELLED')throw Object.assign(new Error('Settlement is cancelled'),{statusCode:409,code:'SETTLEMENT_CANCELLED'});
  const intent=db.prepare('SELECT * FROM payment_outbound_intents WHERE id=? AND organization_id=?').get(intentId,org); if(!intent)throw Object.assign(new Error('Outbound payment intent not found'),{statusCode:404,code:'OUTBOUND_NOT_FOUND'});
  if(intent.purchase_order_id!==poId)throw Object.assign(new Error('Outbound payment intent does not belong to this purchase order'),{statusCode:409,code:'OUTBOUND_PO_MISMATCH'});
  if(intent.state!=='CONFIRMED')throw Object.assign(new Error('Only confirmed outbound payments can be settled'),{statusCode:409,code:'OUTBOUND_NOT_CONFIRMED'});
  if(normaliseCurrency(intent.currency,'ETB')!==settlement.currency)throw Object.assign(new Error('Payment currency must match settlement currency'),{statusCode:409,code:'CURRENCY_MISMATCH'});
  const amount=Number(input.amountMinor??input.amount_minor??intent.amount_minor); if(!Number.isInteger(amount)||amount<=0)throw Object.assign(new Error('amountMinor must be a positive integer'),{statusCode:400,code:'INVALID_SETTLEMENT_AMOUNT'}); if(amount>Number(intent.amount_minor))throw Object.assign(new Error('Settlement allocation cannot exceed outbound payment amount'),{statusCode:400,code:'ALLOCATION_EXCEEDS_PAYMENT'});
  const existing=db.prepare('SELECT * FROM payment_procurement_settlement_allocations WHERE settlement_id=? AND outbound_intent_id=?').get(settlement.id,intentId); if(existing){ if(Number(existing.amount_minor)!==amount)throw Object.assign(new Error('Outbound payment is already allocated with a different amount'),{statusCode:409,code:'ALLOCATION_CONFLICT'}); return getProcurementSettlement(chatId,poId,actor); }
  const allocated=db.prepare('SELECT COALESCE(SUM(amount_minor),0) AS n FROM payment_procurement_settlement_allocations WHERE settlement_id=?').get(settlement.id).n; const outstanding=Number(settlement.totalDueMinor)-Number(allocated); if(amount>outstanding)throw Object.assign(new Error('Settlement allocation exceeds outstanding balance'),{statusCode:400,code:'ALLOCATION_EXCEEDS_OUTSTANDING'});
  const id=crypto.randomUUID(),now=nowIso(); db.exec('BEGIN IMMEDIATE'); try { db.prepare('INSERT INTO payment_procurement_settlement_allocations (id,settlement_id,outbound_intent_id,amount_minor,currency,created_by_user_id,created_at) VALUES (?,?,?,?,?,?,?)').run(id,settlement.id,intentId,amount,settlement.currency,actor?.userId||null,now); const newAllocated=Number(allocated)+amount; const status=newAllocated===Number(settlement.totalDueMinor)?'SETTLED':'PARTIALLY_SETTLED'; db.prepare('UPDATE payment_procurement_settlements SET status=?,updated_at=? WHERE id=? AND organization_id=?').run(status,now,settlement.id,org); audit(String(chatId),'payment.procurement_settlement.allocated','payment_procurement_settlement',settlement.id,{purchaseOrderId:poId,outboundIntentId:intentId,amountMinor:amount,totalAllocatedMinor:newAllocated,status},{organizationId:org,actorId:actor?.userId||null}); db.exec('COMMIT'); } catch(e){db.exec('ROLLBACK'); throw e;} return getProcurementSettlement(chatId,poId,actor);
}

async function tenantOrganizationId(chatId) {
  const row = db.prepare('SELECT organization_id FROM tenants WHERE chat_id = ?').get(String(chatId));
  if (!row?.organization_id) throw Object.assign(new Error('Tenant organization not found'), { statusCode: 404, code: 'ORGANIZATION_NOT_FOUND' });
  return String(row.organization_id);
}

const PROCUREMENT_DEMAND_STATES = Object.freeze({
  DRAFT: new Set(['SUBMITTED', 'CANCELLED']),
  SUBMITTED: new Set(['SOURCING', 'CANCELLED', 'EXPIRED']),
  SOURCING: new Set(['AWARDED', 'CANCELLED', 'EXPIRED']),
  AWARDED: new Set(),
  EXPIRED: new Set(),
  CANCELLED: new Set(),
});

function procurementDemandFromRow(row, items = null) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    requestNumber: row.request_number,
    requesterId: row.requester_id,
    status: row.status,
    currency: normaliseCurrency(row.currency, 'ETB'),
    requiredBy: row.required_by,
    deliveryLocationId: row.delivery_location_id,
    notes: row.notes || '',
    source: row.source,
    sourceSystem: row.source_system,
    sourceObjectId: row.source_object_id,
    idempotencyKey: row.idempotency_key,
    version: Number(row.version || 1),
    submittedAt: row.submitted_at,
    cancelledAt: row.cancelled_at,
    expiredAt: row.expired_at,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items || [],
  };
}

function procurementDemandItemFromRow(row) {
  return {
    id: row.id,
    demandId: row.demand_id,
    productId: row.product_id,
    description: row.description,
    specification: row.specification,
    quantity: Number(row.quantity),
    unit: row.unit,
    targetPriceMinor: row.target_price_minor == null ? null : Number(row.target_price_minor),
    currency: normaliseCurrency(row.currency, 'ETB'),
    requiredBy: row.required_by,
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function procurementDemandRows(organizationId, where = '', params = [], limit = 100) {
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100));
  const rows = db.prepare(`
    SELECT * FROM procurement_demands
    WHERE organization_id = ? ${where ? `AND ${where}` : ''}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT ?
  `).all(String(organizationId), ...params, safeLimit);
  if (!rows.length) return [];
  const ids = rows.map(row => row.id);
  const placeholders = ids.map(() => '?').join(',');
  const itemRows = db.prepare(`SELECT * FROM procurement_demand_items WHERE demand_id IN (${placeholders}) ORDER BY created_at ASC, id ASC`).all(...ids);
  const itemsByDemand = new Map(ids.map(id => [id, []]));
  for (const item of itemRows) itemsByDemand.get(item.demand_id)?.push(procurementDemandItemFromRow(item));
  return rows.map(row => procurementDemandFromRow(row, itemsByDemand.get(row.id) || []));
}

function procurementDemandInput(input, organizationId, chatId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new Error('Demand payload must be an object'), { statusCode: 400, code: 'INVALID_DEMAND' });
  }
  const currency = normaliseCurrency(input.currency, tenantCurrency(chatId));
  const requiredBy = input.requiredBy ?? input.required_by ?? null;
  if (requiredBy != null && (typeof requiredBy !== 'string' || !requiredBy.trim())) {
    throw Object.assign(new Error('requiredBy must be a non-empty date/time string when supplied'), { statusCode: 400, code: 'INVALID_REQUIRED_BY' });
  }
  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (!rawItems.length) throw Object.assign(new Error('At least one demand item is required'), { statusCode: 400, code: 'DEMAND_ITEMS_REQUIRED' });
  const items = rawItems.map((raw, index) => {
    if (!raw || typeof raw !== 'object') throw Object.assign(new Error(`Demand item ${index + 1} is invalid`), { statusCode: 400, code: 'INVALID_DEMAND_ITEM' });
    const quantity = Number(raw.quantity ?? raw.qty);
    if (!Number.isFinite(quantity) || quantity <= 0) throw Object.assign(new Error(`Demand item ${index + 1} quantity must be greater than zero`), { statusCode: 400, code: 'INVALID_DEMAND_QUANTITY' });
    const unit = String(raw.unit ?? '').trim().slice(0, 40);
    if (!unit) throw Object.assign(new Error(`Demand item ${index + 1} unit is required`), { statusCode: 400, code: 'DEMAND_UNIT_REQUIRED' });
    const targetRaw = raw.targetPriceMinor ?? raw.target_price_minor;
    const targetPriceMinor = targetRaw == null || targetRaw === '' ? null : Number(targetRaw);
    if (targetPriceMinor != null && (!Number.isInteger(targetPriceMinor) || targetPriceMinor < 0)) {
      throw Object.assign(new Error(`Demand item ${index + 1} targetPriceMinor must be a non-negative integer`), { statusCode: 400, code: 'INVALID_TARGET_PRICE' });
    }
    const productId = raw.productId ?? raw.product_id ?? null;
    let description = String(raw.description ?? '').trim().slice(0, 500);
    if (productId) {
      const product = assertCatalogProductForOrganization(chatId, productId, organizationId);
      const productCurrency = normaliseCurrency(product.currency, currency);
      if (productCurrency !== currency) throw Object.assign(new Error('Demand item currency must match the organization demand currency'), { statusCode: 409, code: 'CURRENCY_MISMATCH' });
      if (!description) description = String(parseJSON(product.product_json, {})?.name || productId).slice(0, 500);
    }
    if (!description) throw Object.assign(new Error(`Demand item ${index + 1} description is required when productId is absent`), { statusCode: 400, code: 'DEMAND_DESCRIPTION_REQUIRED' });
    return {
      productId: productId ? String(productId) : null,
      description,
      specification: String(raw.specification ?? '').trim().slice(0, 2000),
      quantity,
      unit,
      targetPriceMinor,
      currency,
      requiredBy: raw.requiredBy ?? raw.required_by ?? requiredBy,
      notes: String(raw.notes ?? '').trim().slice(0, 1000),
    };
  });
  return {
    currency,
    requiredBy: requiredBy == null ? null : requiredBy.trim(),
    deliveryLocationId: input.deliveryLocationId ?? input.delivery_location_id ?? null,
    notes: String(input.notes ?? '').trim().slice(0, 4000),
    source: String(input.source ?? 'MANUAL').trim().toUpperCase().slice(0, 60) || 'MANUAL',
    sourceSystem: input.sourceSystem ?? input.source_system ?? null,
    sourceObjectId: input.sourceObjectId ?? input.source_object_id ?? null,
    idempotencyKey: input.idempotencyKey ?? input.idempotency_key ?? null,
    items,
  };
}

function procurementDemandHash(input) {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function assertProcurementActor(organizationId, actor) {
  const userId = String(actor?.userId || actor?.user_id || '').trim();
  if (!userId) throw Object.assign(new Error('Authenticated actor is required'), { statusCode: 401, code: 'ACTOR_REQUIRED' });
  const row = db.prepare(`
    SELECT m.user_id FROM memberships m
    JOIN tenants t ON t.chat_id = m.chat_id
    WHERE m.user_id = ? AND t.organization_id = ? AND m.status = 'active'
    LIMIT 1
  `).get(userId, String(organizationId));
  if (!row) throw Object.assign(new Error('Actor is not a member of this organization'), { statusCode: 403, code: 'ACTOR_ORGANIZATION_MISMATCH' });
  return userId;
}

function assertProcurementLocation(organizationId, locationId) {
  if (!locationId) return null;
  const row = db.prepare('SELECT id, status FROM locations WHERE id = ? AND organization_id = ?').get(String(locationId), String(organizationId));
  if (!row) throw Object.assign(new Error('Delivery location not found in this organization'), { statusCode: 404, code: 'LOCATION_NOT_FOUND' });
  if (row.status !== 'active') throw Object.assign(new Error('Delivery location is inactive'), { statusCode: 409, code: 'LOCATION_INACTIVE' });
  return String(row.id);
}

function generateProcurementRequestNumber() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `PR-${stamp}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export async function createProcurementDemand(chatId, input = {}, actor = null) {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  const actorId = assertProcurementActor(organizationId, actor);
  const normalized = procurementDemandInput(input, organizationId, chatId);
  const locationId = assertProcurementLocation(organizationId, normalized.deliveryLocationId);
  const idempotencyKey = normalized.idempotencyKey == null ? null : String(normalized.idempotencyKey).trim();
  if (idempotencyKey && idempotencyKey.length > 200) throw Object.assign(new Error('idempotencyKey is too long'), { statusCode: 400, code: 'INVALID_IDEMPOTENCY_KEY' });
  const hashPayload = { ...normalized, deliveryLocationId: locationId, idempotencyKey };
  const requestHash = procurementDemandHash(hashPayload);
  if (idempotencyKey) {
    const existing = db.prepare('SELECT * FROM procurement_demands WHERE organization_id = ? AND idempotency_key = ?').get(organizationId, idempotencyKey);
    if (existing) {
      if (existing.request_hash !== requestHash) throw Object.assign(new Error('Idempotency key was already used with a different demand payload'), { statusCode: 409, code: 'IDEMPOTENCY_KEY_REUSED' });
      return getProcurementDemand(chatId, existing.id);
    }
  }
  const now = nowIso();
  const id = String(input.id || crypto.randomUUID());
  const requestNumber = String(input.requestNumber ?? input.request_number ?? generateProcurementRequestNumber()).trim();
  if (!requestNumber) throw Object.assign(new Error('requestNumber cannot be empty'), { statusCode: 400, code: 'INVALID_REQUEST_NUMBER' });
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      INSERT INTO procurement_demands
        (id, organization_id, request_number, requester_id, status, currency, required_by, delivery_location_id, notes, source, source_system, source_object_id, idempotency_key, request_hash, version, created_by_user_id, updated_by_user_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `).run(id, organizationId, requestNumber, actorId, normalized.currency, normalized.requiredBy, locationId, normalized.notes, normalized.source, normalized.sourceSystem == null ? null : String(normalized.sourceSystem), normalized.sourceObjectId == null ? null : String(normalized.sourceObjectId), idempotencyKey, requestHash, actorId, actorId, now, now);
    const insertItem = db.prepare(`
      INSERT INTO procurement_demand_items
        (id, demand_id, product_id, description, specification, quantity, unit, target_price_minor, currency, required_by, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of normalized.items) insertItem.run(crypto.randomUUID(), id, item.productId, item.description, item.specification, item.quantity, item.unit, item.targetPriceMinor, item.currency, item.requiredBy == null ? null : String(item.requiredBy), item.notes, now, now);
    audit(chatId, 'procurement.demand.created', 'procurement_demand', id, { requestNumber, itemCount: normalized.items.length, source: normalized.source }, { organizationId, actorId, locationId });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') throw Object.assign(new Error('Demand requestNumber or idempotencyKey already exists'), { statusCode: 409, code: 'DEMAND_DUPLICATE' });
    throw error;
  }
  return getProcurementDemand(chatId, id);
}

export async function getProcurementDemand(chatId, demandId) {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  const row = db.prepare('SELECT * FROM procurement_demands WHERE id = ? AND organization_id = ?').get(String(demandId), organizationId);
  if (!row) return null;
  const items = db.prepare('SELECT * FROM procurement_demand_items WHERE demand_id = ? ORDER BY created_at ASC, id ASC').all(String(demandId)).map(procurementDemandItemFromRow);
  return procurementDemandFromRow(row, items);
}

export async function listProcurementDemands(chatId, { status = 'all', requesterId = '', limit = 100 } = {}) {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  const where = []; const params = [];
  if (status && String(status).toLowerCase() !== 'all') {
    const normalizedStatus = String(status).toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(PROCUREMENT_DEMAND_STATES, normalizedStatus)) throw Object.assign(new Error('Invalid procurement demand status'), { statusCode: 400, code: 'INVALID_DEMAND_STATUS' });
    where.push('status = ?'); params.push(normalizedStatus);
  }
  if (requesterId) { where.push('requester_id = ?'); params.push(String(requesterId)); }
  return procurementDemandRows(organizationId, where.join(' AND '), params, limit);
}

export async function updateProcurementDemand(chatId, demandId, input = {}, actor = null) {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  const actorId = assertProcurementActor(organizationId, actor);
  const row = db.prepare('SELECT * FROM procurement_demands WHERE id = ? AND organization_id = ?').get(String(demandId), organizationId);
  if (!row) throw Object.assign(new Error('Procurement demand not found'), { statusCode: 404, code: 'DEMAND_NOT_FOUND' });
  if (row.status !== 'DRAFT') throw Object.assign(new Error('Only DRAFT procurement demands can be edited'), { statusCode: 409, code: 'DEMAND_NOT_EDITABLE' });
  const currentItems = db.prepare('SELECT * FROM procurement_demand_items WHERE demand_id = ? ORDER BY created_at ASC, id ASC').all(String(demandId)).map(procurementDemandItemFromRow);
  const merged = {
    currency: input.currency ?? row.currency,
    requiredBy: input.requiredBy ?? input.required_by ?? row.required_by,
    deliveryLocationId: input.deliveryLocationId ?? input.delivery_location_id ?? row.delivery_location_id,
    notes: input.notes ?? row.notes,
    source: input.source ?? row.source,
    sourceSystem: input.sourceSystem ?? input.source_system ?? row.source_system,
    sourceObjectId: input.sourceObjectId ?? input.source_object_id ?? row.source_object_id,
    idempotencyKey: row.idempotency_key,
    items: input.items === undefined ? currentItems : input.items,
  };
  const normalized = procurementDemandInput(merged, organizationId, chatId);
  const locationId = assertProcurementLocation(organizationId, normalized.deliveryLocationId);
  const requestHash = procurementDemandHash({ ...normalized, deliveryLocationId: locationId, idempotencyKey: row.idempotency_key });
  const now = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE procurement_demands SET currency = ?, required_by = ?, delivery_location_id = ?, notes = ?, source = ?, source_system = ?, source_object_id = ?, request_hash = ?, updated_by_user_id = ?, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ? AND status = 'DRAFT'`).run(normalized.currency, normalized.requiredBy, locationId, normalized.notes, normalized.source, normalized.sourceSystem == null ? null : String(normalized.sourceSystem), normalized.sourceObjectId == null ? null : String(normalized.sourceObjectId), requestHash, actorId, now, String(demandId), organizationId);
    db.prepare('DELETE FROM procurement_demand_items WHERE demand_id = ?').run(String(demandId));
    const insertItem = db.prepare(`INSERT INTO procurement_demand_items (id, demand_id, product_id, description, specification, quantity, unit, target_price_minor, currency, required_by, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const item of normalized.items) insertItem.run(crypto.randomUUID(), String(demandId), item.productId, item.description, item.specification, item.quantity, item.unit, item.targetPriceMinor, item.currency, item.requiredBy == null ? null : String(item.requiredBy), item.notes, now, now);
    audit(chatId, 'procurement.demand.updated', 'procurement_demand', demandId, { requestNumber: row.request_number, version: Number(row.version) + 1 }, { organizationId, actorId, locationId });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return getProcurementDemand(chatId, demandId);
}

export async function transitionProcurementDemand(chatId, demandId, targetStatus, actor = null, reason = '') {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  const actorId = assertProcurementActor(organizationId, actor);
  const target = String(targetStatus || '').trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(PROCUREMENT_DEMAND_STATES, target)) throw Object.assign(new Error('Invalid procurement demand status'), { statusCode: 400, code: 'INVALID_DEMAND_STATUS' });
  const row = db.prepare('SELECT * FROM procurement_demands WHERE id = ? AND organization_id = ?').get(String(demandId), organizationId);
  if (!row) throw Object.assign(new Error('Procurement demand not found'), { statusCode: 404, code: 'DEMAND_NOT_FOUND' });
  if (!PROCUREMENT_DEMAND_STATES[row.status]?.has(target)) throw Object.assign(new Error(`Illegal procurement demand transition: ${row.status} -> ${target}`), { statusCode: 409, code: 'INVALID_DEMAND_TRANSITION' });
  const now = nowIso();
  const submittedAt = target === 'SUBMITTED' ? now : row.submitted_at;
  const cancelledAt = target === 'CANCELLED' ? now : row.cancelled_at;
  const expiredAt = target === 'EXPIRED' ? now : row.expired_at;
  const action = target === 'SOURCING' ? 'procurement.demand.sourcing_started' : `procurement.demand.${target.toLowerCase()}`;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE procurement_demands SET status = ?, submitted_at = ?, cancelled_at = ?, expired_at = ?, updated_by_user_id = ?, updated_at = ?, version = version + 1 WHERE id = ? AND organization_id = ?`).run(target, submittedAt, cancelledAt, expiredAt, actorId, now, String(demandId), organizationId);
    audit(chatId, action, 'procurement_demand', demandId, { fromStatus: row.status, toStatus: target, reason: String(reason || '').slice(0, 1000) }, { organizationId, actorId, reason: String(reason || '') });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return getProcurementDemand(chatId, demandId);
}


const PROCUREMENT_RELATIONSHIP_STATES = Object.freeze({PENDING:new Set(['ACTIVE','DECLINED','BLOCKED']),ACTIVE:new Set(['SUSPENDED','BLOCKED']),SUSPENDED:new Set(['ACTIVE','BLOCKED']),BLOCKED:new Set(),DECLINED:new Set()});
function supplierParticipantFromRow(row){if(!row)return null;return {organizationId:row.organization_id,organizationName:row.organization_name||'',country:row.country||'',currency:normaliseCurrency(row.currency,'ETB'),timezone:row.timezone||'UTC',status:row.status,discoverable:Boolean(row.discoverable),createdByUserId:row.created_by_user_id,updatedByUserId:row.updated_by_user_id,createdAt:row.created_at,updatedAt:row.updated_at,version:Number(row.version||1)}}
function supplierRelationshipFromRow(row){if(!row)return null;return {id:row.id,buyerOrganizationId:row.buyer_organization_id,buyerOrganizationName:row.buyer_organization_name||'',supplierOrganizationId:row.supplier_organization_id,supplierOrganizationName:row.supplier_organization_name||'',status:row.status,source:row.source,notes:row.notes||'',createdByUserId:row.created_by_user_id,updatedByUserId:row.updated_by_user_id,createdAt:row.created_at,updatedAt:row.updated_at,version:Number(row.version||1)}}
function supplierParticipantRow(orgId){return db.prepare(`SELECT sp.*,o.name AS organization_name,o.country,o.currency,o.timezone FROM procurement_supplier_participants sp JOIN organizations o ON o.id=sp.organization_id WHERE sp.organization_id=?`).get(String(orgId))}
function assertSupplierMember(orgId,actor){return assertProcurementActor(orgId,actor)}
function activeDiscoverableSupplier(orgId){const row=supplierParticipantRow(orgId);if(!row)throw Object.assign(new Error('Organization is not registered as a procurement supplier'),{statusCode:409,code:'SUPPLIER_NOT_REGISTERED'});if(row.status!=='ACTIVE'||!row.discoverable)throw Object.assign(new Error('Supplier participation is not active and discoverable'),{statusCode:409,code:'SUPPLIER_NOT_AVAILABLE'});return row}
export async function getProcurementSupplierParticipation(chatId){ensureDatabase();const orgId=await tenantOrganizationId(chatId);return supplierParticipantFromRow(supplierParticipantRow(orgId))}
export async function setProcurementSupplierParticipation(chatId,input={},actor=null){ensureDatabase();const orgId=await tenantOrganizationId(chatId);const actorId=assertSupplierMember(orgId,actor);const cur=supplierParticipantRow(orgId);const status=String(input.status??cur?.status??'ACTIVE').trim().toUpperCase();const discoverable=input.discoverable==null?(cur?Boolean(cur.discoverable):true):Boolean(input.discoverable);if(!['ACTIVE','SUSPENDED'].includes(status))throw Object.assign(new Error('Supplier participation status must be ACTIVE or SUSPENDED'),{statusCode:400,code:'INVALID_SUPPLIER_STATUS'});const now=nowIso();if(!cur){db.prepare(`INSERT INTO procurement_supplier_participants(organization_id,status,discoverable,created_by_user_id,updated_by_user_id,created_at,updated_at,version)VALUES(?,?,?,?,?,?,?,1)`).run(orgId,status,discoverable?1:0,actorId,actorId,now,now);audit(chatId,'procurement.supplier.participation_created','procurement_supplier_participant',orgId,{status,discoverable},{organizationId:orgId,actorId})}else{db.prepare(`UPDATE procurement_supplier_participants SET status=?,discoverable=?,updated_by_user_id=?,updated_at=?,version=version+1 WHERE organization_id=?`).run(status,discoverable?1:0,actorId,now,orgId);audit(chatId,'procurement.supplier.participation_updated','procurement_supplier_participant',orgId,{fromStatus:cur.status,toStatus:status,discoverable},{organizationId:orgId,actorId})}return getProcurementSupplierParticipation(chatId)}
export async function discoverProcurementSuppliers(chatId,{search='',country='',currency='',limit=100}={},actor=null){ensureDatabase();const orgId=await tenantOrganizationId(chatId);assertSupplierMember(orgId,actor);const c=['sp.status=\'ACTIVE\'','sp.discoverable=1','sp.organization_id<>?'],p=[orgId];const q=String(search||'').trim();if(q){c.push('(LOWER(o.name) LIKE LOWER(?) OR LOWER(o.country) LIKE LOWER(?))');p.push(`%${q}%`,`%${q}%`)}if(country){c.push('LOWER(o.country)=LOWER(?)');p.push(String(country).trim())}if(currency){c.push('UPPER(o.currency)=UPPER(?)');p.push(normaliseCurrency(currency,'ETB'))}const n=Math.min(200,Math.max(1,Number(limit)||100));return db.prepare(`SELECT sp.*,o.name AS organization_name,o.country,o.currency,o.timezone FROM procurement_supplier_participants sp JOIN organizations o ON o.id=sp.organization_id WHERE ${c.join(' AND ')} ORDER BY o.name COLLATE NOCASE ASC,sp.updated_at DESC LIMIT ?`).all(...p,n).map(supplierParticipantFromRow)}
export async function listProcurementSupplierRelationships(chatId,{direction='buyer',status='all',limit=100}={},actor=null){ensureDatabase();const orgId=await tenantOrganizationId(chatId);assertSupplierMember(orgId,actor);const d=String(direction||'buyer').toLowerCase();if(!['buyer','supplier'].includes(d))throw Object.assign(new Error('direction must be buyer or supplier'),{statusCode:400,code:'INVALID_RELATIONSHIP_DIRECTION'});const c=[`${d==='supplier'?'r.supplier_organization_id':'r.buyer_organization_id'}=?`],p=[orgId];if(status&&status!=='all'){c.push('r.status=?');p.push(String(status).toUpperCase())}const n=Math.min(200,Math.max(1,Number(limit)||100));return db.prepare(`SELECT r.*,bo.name AS buyer_organization_name,so.name AS supplier_organization_name FROM procurement_supplier_relationships r JOIN organizations bo ON bo.id=r.buyer_organization_id JOIN organizations so ON so.id=r.supplier_organization_id WHERE ${c.join(' AND ')} ORDER BY r.updated_at DESC,r.created_at DESC LIMIT ?`).all(...p,n).map(supplierRelationshipFromRow)}
export async function createProcurementSupplierRelationship(chatId,input={},actor=null){ensureDatabase();const buyerOrg=await tenantOrganizationId(chatId);const actorId=assertSupplierMember(buyerOrg,actor);const supplierOrg=String(input.supplierOrganizationId??input.supplier_organization_id??'').trim();if(!supplierOrg)throw Object.assign(new Error('supplierOrganizationId is required'),{statusCode:400,code:'SUPPLIER_ORGANIZATION_REQUIRED'});if(supplierOrg===buyerOrg)throw Object.assign(new Error('An organization cannot create a supplier relationship with itself'),{statusCode:409,code:'SELF_SUPPLIER_RELATIONSHIP'});if(!db.prepare('SELECT id FROM organizations WHERE id=?').get(supplierOrg))throw Object.assign(new Error('Supplier organization not found'),{statusCode:404,code:'SUPPLIER_ORGANIZATION_NOT_FOUND'});const source=String(input.source??'DIRECT').trim().toUpperCase();if(!['DIRECT','DISCOVERY','MARKETPLACE'].includes(source))throw Object.assign(new Error('Invalid supplier relationship source'),{statusCode:400,code:'INVALID_RELATIONSHIP_SOURCE'});activeDiscoverableSupplier(supplierOrg);const existing=db.prepare('SELECT * FROM procurement_supplier_relationships WHERE buyer_organization_id=? AND supplier_organization_id=?').get(buyerOrg,supplierOrg);if(existing)return supplierRelationshipFromRow(db.prepare(`SELECT r.*,bo.name AS buyer_organization_name,so.name AS supplier_organization_name FROM procurement_supplier_relationships r JOIN organizations bo ON bo.id=r.buyer_organization_id JOIN organizations so ON so.id=r.supplier_organization_id WHERE r.id=?`).get(existing.id));const id=String(input.id||crypto.randomUUID()),now=nowIso();db.prepare(`INSERT INTO procurement_supplier_relationships(id,buyer_organization_id,supplier_organization_id,status,source,notes,created_by_user_id,updated_by_user_id,created_at,updated_at,version)VALUES(?,?,?,'PENDING',?,?,?,?,?,?,1)`).run(id,buyerOrg,supplierOrg,source,String(input.notes||'').trim().slice(0,2000),actorId,actorId,now,now);audit(chatId,'procurement.supplier.relationship_created','procurement_supplier_relationship',id,{buyerOrganizationId:buyerOrg,supplierOrganizationId:supplierOrg,status:'PENDING',source},{organizationId:buyerOrg,actorId});return supplierRelationshipFromRow(db.prepare(`SELECT r.*,bo.name AS buyer_organization_name,so.name AS supplier_organization_name FROM procurement_supplier_relationships r JOIN organizations bo ON bo.id=r.buyer_organization_id JOIN organizations so ON so.id=r.supplier_organization_id WHERE r.id=?`).get(id))}
export async function transitionProcurementSupplierRelationship(chatId,relationshipId,targetStatus,actor=null,reason=''){ensureDatabase();const orgId=await tenantOrganizationId(chatId);const actorId=assertSupplierMember(orgId,actor);const row=db.prepare('SELECT * FROM procurement_supplier_relationships WHERE id=? AND (buyer_organization_id=? OR supplier_organization_id=?)').get(String(relationshipId),orgId,orgId);if(!row)throw Object.assign(new Error('Supplier relationship not found'),{statusCode:404,code:'SUPPLIER_RELATIONSHIP_NOT_FOUND'});const target=String(targetStatus||'').trim().toUpperCase();if(!Object.prototype.hasOwnProperty.call(PROCUREMENT_RELATIONSHIP_STATES,target))throw Object.assign(new Error('Invalid supplier relationship status'),{statusCode:400,code:'INVALID_RELATIONSHIP_STATUS'});if(!PROCUREMENT_RELATIONSHIP_STATES[row.status]?.has(target))throw Object.assign(new Error(`Illegal supplier relationship transition: ${row.status} -> ${target}`),{statusCode:409,code:'INVALID_RELATIONSHIP_TRANSITION'});const now=nowIso();db.prepare('UPDATE procurement_supplier_relationships SET status=?,updated_by_user_id=?,updated_at=?,version=version+1 WHERE id=?').run(target,actorId,now,String(relationshipId));audit(chatId,`procurement.supplier.relationship_${target.toLowerCase()}`,'procurement_supplier_relationship',relationshipId,{fromStatus:row.status,toStatus:target,reason:String(reason||'').slice(0,1000)},{organizationId:orgId,actorId,reason:String(reason||'')});return supplierRelationshipFromRow(db.prepare(`SELECT r.*,bo.name AS buyer_organization_name,so.name AS supplier_organization_name FROM procurement_supplier_relationships r JOIN organizations bo ON bo.id=r.buyer_organization_id JOIN organizations so ON so.id=r.supplier_organization_id WHERE r.id=?`).get(String(relationshipId)))}


const PROCUREMENT_RFQ_STATES = Object.freeze({DRAFT:new Set(['SENT','CANCELLED']),SENT:new Set(['CLOSED','EXPIRED','CANCELLED']),CLOSED:new Set(),EXPIRED:new Set(),CANCELLED:new Set()});
const PROCUREMENT_R_RESPONSE_STATES = Object.freeze({DRAFT:new Set(['SUBMITTED','WITHDRAWN']),SUBMITTED:new Set(['WITHDRAWN']),WITHDRAWN:new Set()});
function procurementRfqFromRow(row,items=[],suppliers=[],responses=[]){if(!row)return null;return {id:row.id,organizationId:row.organization_id,demandId:row.demand_id,rfqNumber:row.rfq_number,status:row.status,currency:normaliseCurrency(row.currency,'ETB'),responseDue:row.response_due,notes:row.notes||'',idempotencyKey:row.idempotency_key,version:Number(row.version||1),sentAt:row.sent_at,closedAt:row.closed_at,expiredAt:row.expired_at,cancelledAt:row.cancelled_at,createdAt:row.created_at,updatedAt:row.updated_at,items,suppliers,responses};}
function procurementRfqItemFromRow(row){return {id:row.id,rfqId:row.rfq_id,demandItemId:row.demand_item_id,productId:row.product_id,description:row.description,specification:row.specification,quantity:Number(row.quantity),unit:row.unit,currency:normaliseCurrency(row.currency,'ETB'),requiredBy:row.required_by,notes:row.notes||''};}
function procurementRfqSupplierFromRow(row){return {id:row.id,rfqId:row.rfq_id,supplierOrganizationId:row.supplier_organization_id,supplierOrganizationName:row.supplier_organization_name||'',status:row.status,invitedAt:row.invited_at,updatedAt:row.updated_at,version:Number(row.version||1)};}
function procurementRfqResponseItemFromRow(row){return {id:row.id,responseId:row.response_id,rfqItemId:row.rfq_item_id,offeredQuantity:Number(row.offered_quantity),unitPriceMinor:Number(row.unit_price_minor),currency:normaliseCurrency(row.currency,'ETB'),leadTimeDays:row.lead_time_days==null?null:Number(row.lead_time_days),notes:row.notes||''};}
function procurementRfqResponseFromRow(row,items=[]){if(!row)return null;return {id:row.id,rfqId:row.rfq_id,supplierOrganizationId:row.supplier_organization_id,supplierOrganizationName:row.supplier_organization_name||'',status:row.status,currency:normaliseCurrency(row.currency,'ETB'),validUntil:row.valid_until,notes:row.notes||'',idempotencyKey:row.idempotency_key,version:Number(row.version||1),submittedAt:row.submitted_at,withdrawnAt:row.withdrawn_at,rejectedAt:row.rejected_at,createdAt:row.created_at,updatedAt:row.updated_at,items};}
function procurementRfqInput(input, fallbackCurrency='ETB'){const currency=normaliseCurrency(input.currency,fallbackCurrency);const responseDue=input.responseDue??input.response_due??null;if(responseDue!=null&&(!String(responseDue).trim()))throw Object.assign(new Error('responseDue must be non-empty when supplied'),{statusCode:400,code:'INVALID_RESPONSE_DUE'});return {currency,responseDue:responseDue==null?null:String(responseDue).trim(),notes:String(input.notes||'').trim().slice(0,4000),supplierOrganizationIds:[...new Set((Array.isArray(input.supplierOrganizationIds)?input.supplierOrganizationIds:input.supplier_organization_ids||[]).map(v=>String(v).trim()).filter(Boolean))],idempotencyKey:input.idempotencyKey??input.idempotency_key??null};}
function procurementRfqHash(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function rfqRows(organizationId,where='',params=[]){const rows=db.prepare(`SELECT * FROM procurement_rfqs WHERE organization_id=? ${where?'AND '+where:''} ORDER BY updated_at DESC,created_at DESC`).all(organizationId,...params);return rows.map(r=>{const items=db.prepare('SELECT * FROM procurement_rfq_items WHERE rfq_id=? ORDER BY created_at,id').all(r.id).map(procurementRfqItemFromRow);const suppliers=db.prepare(`SELECT rs.*,o.name AS supplier_organization_name FROM procurement_rfq_suppliers rs JOIN organizations o ON o.id=rs.supplier_organization_id WHERE rs.rfq_id=? ORDER BY o.name COLLATE NOCASE`).all(r.id).map(procurementRfqSupplierFromRow);const responses=db.prepare(`SELECT rr.*,o.name AS supplier_organization_name FROM procurement_rfq_responses rr JOIN organizations o ON o.id=rr.supplier_organization_id WHERE rr.rfq_id=? ORDER BY rr.created_at`).all(r.id).map(x=>procurementRfqResponseFromRow(x,db.prepare('SELECT * FROM procurement_rfq_response_items WHERE response_id=? ORDER BY created_at,id').all(x.id).map(procurementRfqResponseItemFromRow)));return procurementRfqFromRow(r,items,suppliers,responses);});}
function assertActiveSupplierRelationship(buyerOrg,supplierOrg){const row=db.prepare(`SELECT 1 FROM procurement_supplier_relationships WHERE buyer_organization_id=? AND supplier_organization_id=? AND status='ACTIVE'`).get(buyerOrg,supplierOrg);if(!row)throw Object.assign(new Error('Active buyer-supplier relationship is required'),{statusCode:409,code:'SUPPLIER_RELATIONSHIP_REQUIRED'});}
export async function createProcurementRfq(chatId,input={},actor=null){ensureDatabase();const orgId=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(orgId,actor);const demandId=String(input.demandId??input.demand_id??'').trim();if(!demandId)throw Object.assign(new Error('demandId is required'),{statusCode:400,code:'DEMAND_REQUIRED'});const demand=await getProcurementDemand(chatId,demandId);if(!demand)throw Object.assign(new Error('Procurement demand not found'),{statusCode:404,code:'DEMAND_NOT_FOUND'});if(demand.status!=='SOURCING')throw Object.assign(new Error('Demand must be in SOURCING before creating an RFQ'),{statusCode:409,code:'DEMAND_NOT_SOURCING'});const normalized=procurementRfqInput(input,demand.currency);if(normalized.supplierOrganizationIds.length===0)throw Object.assign(new Error('At least one supplier is required'),{statusCode:400,code:'RFQ_SUPPLIERS_REQUIRED'});if(normalized.idempotencyKey){const old=db.prepare('SELECT * FROM procurement_rfqs WHERE organization_id=? AND idempotency_key=?').get(orgId,String(normalized.idempotencyKey));if(old){const hash=procurementRfqHash({demandId,...normalized});if(old.request_hash!==hash)throw Object.assign(new Error('Idempotency key was already used with a different RFQ payload'),{statusCode:409,code:'IDEMPOTENCY_KEY_REUSED'});return rfqRows(orgId,'id=?',[old.id])[0];}}
const demandItems=db.prepare('SELECT * FROM procurement_demand_items WHERE demand_id=? ORDER BY created_at,id').all(demandId);if(!demandItems.length)throw Object.assign(new Error('Demand has no items'),{statusCode:409,code:'DEMAND_ITEMS_REQUIRED'});const hash=procurementRfqHash({demandId,...normalized});const id=String(input.id||crypto.randomUUID());const rfqNumber=String(input.rfqNumber??input.rfq_number??`RFQ-${new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`).trim();const now=nowIso();db.exec('BEGIN IMMEDIATE');try{for(const sid of normalized.supplierOrganizationIds){assertActiveSupplierRelationship(orgId,sid);}db.prepare(`INSERT INTO procurement_rfqs(id,organization_id,demand_id,rfq_number,status,currency,response_due,notes,idempotency_key,request_hash,created_by_user_id,updated_by_user_id,created_at,updated_at)VALUES(?,?,?,?,'DRAFT',?,?,?,?,?,?,?, ?,?)`).run(id,orgId,demandId,rfqNumber,normalized.currency,normalized.responseDue,normalized.notes,normalized.idempotencyKey,hash,actorId,actorId,now,now);const ii=db.prepare(`INSERT INTO procurement_rfq_items(id,rfq_id,demand_item_id,product_id,description,specification,quantity,unit,currency,required_by,notes,created_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);for(const d of demandItems)ii.run(crypto.randomUUID(),id,d.id,d.product_id,d.description,d.specification,d.quantity,d.unit,d.currency,d.required_by,d.notes,now);const si=db.prepare(`INSERT INTO procurement_rfq_suppliers(id,rfq_id,supplier_organization_id,status,invited_at,updated_at,version)VALUES(?,?,?,'INVITED',?,?,1)`);for(const sid of normalized.supplierOrganizationIds)si.run(crypto.randomUUID(),id,sid,now,now);audit(chatId,'procurement.rfq.created','procurement_rfq',id,{demandId,supplierCount:normalized.supplierOrganizationIds.length},{organizationId:orgId,actorId});db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return rfqRows(orgId,'id=?',[id])[0];}
export async function listProcurementRfqs(chatId,{status='all',demandId='',limit=100}={},actor=null){ensureDatabase();const orgId=await tenantOrganizationId(chatId);assertProcurementActor(orgId,actor);const where=[];const params=[];if(status&&String(status).toLowerCase()!=='all'){const st=String(status).toUpperCase();if(!Object.hasOwn(PROCUREMENT_RFQ_STATES,st))throw Object.assign(new Error('Invalid RFQ status'),{statusCode:400,code:'INVALID_RFQ_STATUS'});where.push('status=?');params.push(st);}if(demandId){where.push('demand_id=?');params.push(String(demandId));}const rows=db.prepare(`SELECT * FROM procurement_rfqs WHERE organization_id=? ${where.length?'AND '+where.join(' AND '):''} ORDER BY updated_at DESC LIMIT ?`).all(orgId,...params,Math.min(200,Math.max(1,Number(limit)||100)));return rows.map(r=>rfqRows(orgId,'id=?',[r.id])[0]);}
export async function transitionProcurementRfq(chatId,rfqId,targetStatus,actor=null,reason=''){ensureDatabase();const orgId=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(orgId,actor);const target=String(targetStatus||'').toUpperCase();if(!Object.hasOwn(PROCUREMENT_RFQ_STATES,target))throw Object.assign(new Error('Invalid RFQ status'),{statusCode:400,code:'INVALID_RFQ_STATUS'});const row=db.prepare('SELECT * FROM procurement_rfqs WHERE id=? AND organization_id=?').get(String(rfqId),orgId);if(!row)throw Object.assign(new Error('RFQ not found'),{statusCode:404,code:'RFQ_NOT_FOUND'});if(!PROCUREMENT_RFQ_STATES[row.status]?.has(target))throw Object.assign(new Error(`Illegal RFQ transition: ${row.status} -> ${target}`),{statusCode:409,code:'INVALID_RFQ_TRANSITION'});const now=nowIso();db.exec('BEGIN IMMEDIATE');try{if(target==='SENT'&&db.prepare("SELECT COUNT(*) c FROM procurement_rfq_suppliers WHERE rfq_id=?").get(rfqId).c===0)throw Object.assign(new Error('RFQ must have suppliers before sending'),{statusCode:409,code:'RFQ_SUPPLIERS_REQUIRED'});db.prepare(`UPDATE procurement_rfqs SET status=?,sent_at=CASE WHEN ?='SENT' THEN ? ELSE sent_at END,closed_at=CASE WHEN ?='CLOSED' THEN ? ELSE closed_at END,expired_at=CASE WHEN ?='EXPIRED' THEN ? ELSE expired_at END,cancelled_at=CASE WHEN ?='CANCELLED' THEN ? ELSE cancelled_at END,updated_by_user_id=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=?`).run(target,target,now,target,now,target,now,target,now,actorId,now,rfqId,orgId);audit(chatId,`procurement.rfq.${target.toLowerCase()}`,'procurement_rfq',rfqId,{fromStatus:row.status,toStatus:target,reason:String(reason||'').slice(0,1000)},{organizationId:orgId,actorId});db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return rfqRows(orgId,'id=?',[rfqId])[0];}
function assertRfqRecipient(rfqId,supplierOrg){const row=db.prepare(`SELECT * FROM procurement_rfq_suppliers WHERE rfq_id=? AND supplier_organization_id=?`).get(rfqId,supplierOrg);if(!row)throw Object.assign(new Error('Organization is not an RFQ recipient'),{statusCode:403,code:'RFQ_RECIPIENT_REQUIRED'});return row;}
export async function createProcurementRfqResponse(chatId,rfqId,input={},actor=null){ensureDatabase();const supplierOrg=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(supplierOrg,actor);const rfq=db.prepare('SELECT * FROM procurement_rfqs WHERE id=?').get(String(rfqId));if(!rfq)throw Object.assign(new Error('RFQ not found'),{statusCode:404,code:'RFQ_NOT_FOUND'});if(rfq.status!=='SENT')throw Object.assign(new Error('RFQ must be SENT before a supplier can respond'),{statusCode:409,code:'RFQ_NOT_OPEN'});const recipient=assertRfqRecipient(rfqId,supplierOrg);if(['REMOVED','DECLINED'].includes(recipient.status))throw Object.assign(new Error('Supplier is not eligible to respond'),{statusCode:409,code:'SUPPLIER_NOT_ELIGIBLE'});const currency=normaliseCurrency(input.currency,rfq.currency);if(currency!==normaliseCurrency(rfq.currency, currency))throw Object.assign(new Error('Response currency must match RFQ currency'),{statusCode:409,code:'CURRENCY_MISMATCH'});const rawItems=Array.isArray(input.items)?input.items:[];if(!rawItems.length)throw Object.assign(new Error('At least one response item is required'),{statusCode:400,code:'RESPONSE_ITEMS_REQUIRED'});const rfqItems=db.prepare('SELECT * FROM procurement_rfq_items WHERE rfq_id=? ORDER BY created_at,id').all(rfqId);const allowed=new Map(rfqItems.map(x=>[x.id,x]));const seen=new Set();const items=rawItems.map((x,i)=>{const rfqi=allowed.get(String(x.rfqItemId??x.rfq_item_id??''));if(!rfqi)throw Object.assign(new Error(`Response item ${i+1} references an RFQ item outside this RFQ`),{statusCode:400,code:'INVALID_RFQ_ITEM'});if(seen.has(rfqi.id))throw Object.assign(new Error('Duplicate RFQ response item'),{statusCode:400,code:'DUPLICATE_RESPONSE_ITEM'});seen.add(rfqi.id);const qty=Number(x.offeredQuantity??x.offered_quantity);const price=Number(x.unitPriceMinor??x.unit_price_minor);if(!Number.isFinite(qty)||qty<=0)throw Object.assign(new Error(`Response item ${i+1} offeredQuantity must be greater than zero`),{statusCode:400,code:'INVALID_OFFERED_QUANTITY'});if(!Number.isInteger(price)||price<0)throw Object.assign(new Error(`Response item ${i+1} unitPriceMinor must be a non-negative integer`),{statusCode:400,code:'INVALID_UNIT_PRICE'});if(normaliseCurrency(rfqi.currency,currency)!==currency)throw Object.assign(new Error('Response item currency must match RFQ currency'),{statusCode:409,code:'CURRENCY_MISMATCH'});return {rfqItemId:rfqi.id,offeredQuantity:qty,unitPriceMinor:price,currency,leadTimeDays:x.leadTimeDays??x.lead_time_days??null,notes:String(x.notes||'').trim().slice(0,1000)};});const validUntil=input.validUntil??input.valid_until??null;const idem=input.idempotencyKey??input.idempotency_key??null;const hash=procurementRfqHash({rfqId,currency,validUntil,notes:String(input.notes||'').trim().slice(0,4000),items});const existing=db.prepare('SELECT * FROM procurement_rfq_responses WHERE rfq_id=? AND supplier_organization_id=?').get(rfqId,supplierOrg);if(existing){if(existing.status!=='DRAFT')return procurementRfqResponseFromRow(db.prepare(`SELECT r.*,o.name supplier_organization_name FROM procurement_rfq_responses r JOIN organizations o ON o.id=r.supplier_organization_id WHERE r.id=?`).get(existing.id),db.prepare('SELECT * FROM procurement_rfq_response_items WHERE response_id=? ORDER BY created_at,id').all(existing.id).map(procurementRfqResponseItemFromRow));}
const now=nowIso();db.exec('BEGIN IMMEDIATE');try{const responseId=existing?.id||String(input.id||crypto.randomUUID());if(existing) {db.prepare(`UPDATE procurement_rfq_responses SET currency=?,valid_until=?,notes=?,request_hash=?,updated_by_user_id=?,updated_at=?,version=version+1 WHERE id=? AND status='DRAFT'`).run(currency,validUntil==null?null:String(validUntil),String(input.notes||'').trim().slice(0,4000),hash,actorId,now,responseId);db.prepare('DELETE FROM procurement_rfq_response_items WHERE response_id=?').run(responseId);} else db.prepare(`INSERT INTO procurement_rfq_responses(id,rfq_id,supplier_organization_id,status,currency,valid_until,notes,idempotency_key,request_hash,created_by_user_id,updated_by_user_id,created_at,updated_at,version)VALUES(?,?,?,'DRAFT',?,?,?,?,?,?,?,?,?,1)`).run(responseId,rfqId,supplierOrg,currency,validUntil==null?null:String(validUntil),String(input.notes||'').trim().slice(0,4000),idem==null?null:String(idem),hash,actorId,actorId,now,now);const ins=db.prepare(`INSERT INTO procurement_rfq_response_items(id,response_id,rfq_item_id,offered_quantity,unit_price_minor,currency,lead_time_days,notes,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?,?,?)`);for(const x of items)ins.run(crypto.randomUUID(),responseId,x.rfqItemId,x.offeredQuantity,x.unitPriceMinor,x.currency,x.leadTimeDays==null?null:Number(x.leadTimeDays),x.notes,now,now);audit(chatId,'procurement.rfq.response.created','procurement_rfq_response',responseId,{rfqId,itemCount:items.length},{organizationId:supplierOrg,actorId});db.exec('COMMIT');return procurementRfqResponseFromRow(db.prepare(`SELECT r.*,o.name supplier_organization_name FROM procurement_rfq_responses r JOIN organizations o ON o.id=r.supplier_organization_id WHERE r.id=?`).get(responseId),db.prepare('SELECT * FROM procurement_rfq_response_items WHERE response_id=? ORDER BY created_at,id').all(responseId).map(procurementRfqResponseItemFromRow));}catch(e){db.exec('ROLLBACK');throw e;}}
export async function transitionProcurementRfqResponse(chatId,responseId,targetStatus,actor=null,reason=''){ensureDatabase();const supplierOrg=await tenantOrganizationId(chatId);const actorId=assertProcurementActor(supplierOrg,actor);const row=db.prepare('SELECT * FROM procurement_rfq_responses WHERE id=? AND supplier_organization_id=?').get(String(responseId),supplierOrg);if(!row)throw Object.assign(new Error('RFQ response not found'),{statusCode:404,code:'RFQ_RESPONSE_NOT_FOUND'});const target=String(targetStatus||'').toUpperCase();if(!Object.hasOwn(PROCUREMENT_R_RESPONSE_STATES,target))throw Object.assign(new Error('Invalid RFQ response status'),{statusCode:400,code:'INVALID_RFQ_RESPONSE_STATUS'});if(!PROCUREMENT_R_RESPONSE_STATES[row.status]?.has(target))throw Object.assign(new Error(`Illegal RFQ response transition: ${row.status} -> ${target}`),{statusCode:409,code:'INVALID_RFQ_RESPONSE_TRANSITION'});const rfq=db.prepare('SELECT status FROM procurement_rfqs WHERE id=?').get(row.rfq_id);if(target==='SUBMITTED'&&rfq?.status!=='SENT')throw Object.assign(new Error('RFQ must remain SENT when a response is submitted'),{statusCode:409,code:'RFQ_NOT_OPEN'});const now=nowIso();db.exec('BEGIN IMMEDIATE');try{db.prepare(`UPDATE procurement_rfq_responses SET status=?,submitted_at=CASE WHEN ?='SUBMITTED' THEN ? ELSE submitted_at END,withdrawn_at=CASE WHEN ?='WITHDRAWN' THEN ? ELSE withdrawn_at END,rejected_at=CASE WHEN ?='REJECTED' THEN ? ELSE rejected_at END,updated_by_user_id=?,updated_at=?,version=version+1 WHERE id=?`).run(target,target,now,target,now,target,now,actorId,now,responseId);if(target==='SUBMITTED')db.prepare(`UPDATE procurement_rfq_suppliers SET status='RESPONSE_RECEIVED',updated_at=?,version=version+1 WHERE rfq_id=? AND supplier_organization_id=?`).run(now,row.rfq_id,supplierOrg);audit(chatId,`procurement.rfq.response.${target.toLowerCase()}`,'procurement_rfq_response',responseId,{rfqId:row.rfq_id,fromStatus:row.status,toStatus:target,reason:String(reason||'').slice(0,1000)},{organizationId:supplierOrg,actorId});db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}const x=db.prepare(`SELECT r.*,o.name supplier_organization_name FROM procurement_rfq_responses r JOIN organizations o ON o.id=r.supplier_organization_id WHERE r.id=?`).get(responseId);return procurementRfqResponseFromRow(x,db.prepare('SELECT * FROM procurement_rfq_response_items WHERE response_id=? ORDER BY created_at,id').all(responseId).map(procurementRfqResponseItemFromRow));}


function procurementComparisonSupplierFromRow(row) {
  return {
    id: row.id,
    comparisonId: row.comparison_id,
    supplierOrganizationId: row.supplier_organization_id,
    responseId: row.response_id,
    requestedLineCount: Number(row.requested_line_count),
    quotedLineCount: Number(row.quoted_line_count),
    completeCoverage: Boolean(row.complete_coverage),
    requestedQuantityTotal: Number(row.requested_quantity_total),
    coveredQuantityTotal: Number(row.covered_quantity_total),
    coverageRatio: Number(row.coverage_ratio),
    comparableTotalMinor: Number(row.comparable_total_minor),
    maxLeadTimeDays: row.max_lead_time_days == null ? null : Number(row.max_lead_time_days),
    validUntil: row.valid_until,
    eligible: Boolean(row.eligible),
    rank: row.rank == null ? null : Number(row.rank),
  };
}

function procurementComparisonLineFromRow(row) {
  return {
    id: row.id,
    comparisonId: row.comparison_id,
    supplierOrganizationId: row.supplier_organization_id,
    responseId: row.response_id,
    rfqItemId: row.rfq_item_id,
    requestedQuantity: Number(row.requested_quantity),
    offeredQuantity: Number(row.offered_quantity),
    coveredQuantity: Number(row.covered_quantity),
    unitPriceMinor: Number(row.unit_price_minor),
    comparableLineTotalMinor: Number(row.comparable_line_total_minor),
    leadTimeDays: row.lead_time_days == null ? null : Number(row.lead_time_days),
    validUntil: row.valid_until,
    coverageComplete: Boolean(row.coverage_complete),
    lineRank: row.line_rank == null ? null : Number(row.line_rank),
  };
}

function procurementComparisonFromRow(row, suppliers = [], lines = []) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    rfqId: row.rfq_id,
    version: Number(row.version),
    status: row.status,
    currency: normaliseCurrency(row.currency, 'ETB'),
    policyVersion: row.policy_version,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    suppliers,
    lines,
  };
}

function comparisonRows(organizationId, comparisonId) {
  const row = db.prepare(`SELECT * FROM procurement_comparisons WHERE id=? AND organization_id=?`).get(String(comparisonId), String(organizationId));
  if (!row) return null;
  const suppliers = db.prepare(`SELECT cs.* FROM procurement_comparison_suppliers cs WHERE cs.comparison_id=? ORDER BY CASE WHEN cs.rank IS NULL THEN 1 ELSE 0 END, cs.rank ASC, cs.supplier_organization_id ASC`).all(row.id).map(procurementComparisonSupplierFromRow);
  const lines = db.prepare(`SELECT cl.* FROM procurement_comparison_line_offers cl WHERE cl.comparison_id=? ORDER BY cl.rfq_item_id, CASE WHEN cl.line_rank IS NULL THEN 1 ELSE 0 END, cl.line_rank ASC, cl.supplier_organization_id ASC`).all(row.id).map(procurementComparisonLineFromRow);
  return procurementComparisonFromRow(row, suppliers, lines);
}

function comparisonValidityTimestamp(value) {
  if (value == null || String(value).trim() === '') return null;
  const t = Date.parse(String(value));
  return Number.isFinite(t) ? t : NaN;
}

function comparisonLeadSort(value) {
  return value == null ? Number.MAX_SAFE_INTEGER : Number(value);
}

function comparisonValiditySort(value) {
  if (value == null || String(value).trim() === '') return -1;
  const t = Date.parse(String(value));
  return Number.isFinite(t) ? t : -1;
}

function supplierNetworkPerformanceFromRow(row) {
  if (!row) return null;
  return {
    id: String(row.id), supplierOrganizationId: String(row.supplier_organization_id),
    metricType: String(row.metric_type), numerator: Number(row.numerator), denominator: Number(row.denominator),
    value: Number(row.value), unit: String(row.unit), visibility: String(row.visibility),
    periodStart: row.period_start || null, periodEnd: row.period_end, evidence: parseJSON(row.evidence_json, {}),
    calculatedAt: row.calculated_at, createdByUserId: row.created_by_user_id || null, version: Number(row.version || 1),
  };
}

function supplierNetworkTrustEvidenceFromRow(row) {
  if (!row) return null;
  return { id:String(row.id), supplierOrganizationId:String(row.supplier_organization_id), evidenceType:String(row.evidence_type), sourceAuthority:String(row.source_authority), sourceEntityType:String(row.source_entity_type), sourceEntityId:String(row.source_entity_id), claim:String(row.claim), value:parseJSON(row.value_json,{}), evidenceState:String(row.evidence_state), visibility:String(row.visibility), observedAt:String(row.observed_at), createdAt:String(row.created_at), createdByUserId:row.created_by_user_id||null, version:Number(row.version||1) };
}

function supplierNetworkTrustCanAccessEvidence(org,supplierId,visibility){
  if(String(org)===String(supplierId)) return true;
  if(visibility==='NETWORK') return true;
  if(visibility==='RELATIONSHIP') return Boolean(db.prepare("SELECT 1 FROM procurement_supplier_relationships WHERE buyer_organization_id=? AND supplier_organization_id=? AND status='ACTIVE'").get(String(org),String(supplierId)));
  return false;
}

export async function listSupplierNetworkTrustEvidence(chatId,{supplierOrganizationId='',evidenceType='',limit=100}={},actor=null){
  ensureDatabase(); const org=await tenantOrganizationId(chatId); assertProcurementActor(org,actor);
  const supplierId=String(supplierOrganizationId||org).trim(); const where=['supplier_organization_id=?']; const params=[supplierId];
  if(supplierId!==String(org)){where.push("visibility IN ('NETWORK','RELATIONSHIP')"); if(!supplierNetworkTrustCanAccessEvidence(org,supplierId,'RELATIONSHIP')) where[where.length-1]="visibility='NETWORK'";}
  if(evidenceType){where.push('evidence_type=?');params.push(String(evidenceType).toUpperCase());}
  const n=Math.min(500,Math.max(1,Number(limit)||100));
  return db.prepare(`SELECT * FROM supplier_network_trust_evidence WHERE ${where.join(' AND ')} ORDER BY observed_at DESC,id ASC LIMIT ?`).all(...params,n).map(supplierNetworkTrustEvidenceFromRow);
}

export async function getSupplierNetworkTrustEvidence(chatId,evidenceId,actor=null){
  ensureDatabase(); const org=await tenantOrganizationId(chatId); assertProcurementActor(org,actor);
  const row=db.prepare('SELECT * FROM supplier_network_trust_evidence WHERE id=?').get(String(evidenceId));
  if(!row || !supplierNetworkTrustCanAccessEvidence(org,row.supplier_organization_id,row.visibility)) return null;
  return supplierNetworkTrustEvidenceFromRow(row);
}

export async function refreshSupplierNetworkTrustEvidence(chatId,supplierOrganizationId,input={},actor=null){
  ensureDatabase(); const org=await tenantOrganizationId(chatId); const actorId=assertProcurementActor(org,actor);
  const supplierId=String(supplierOrganizationId||'').trim(); if(!supplierId) throw Object.assign(new Error('supplierOrganizationId is required'),{statusCode:400,code:'SUPPLIER_REQUIRED'});
  const participant=db.prepare("SELECT organization_id,status,discoverable FROM procurement_supplier_participants WHERE organization_id=? AND status='ACTIVE'").get(supplierId);
  if(!participant) throw Object.assign(new Error('Trust evidence requires an active supplier participant'),{statusCode:409,code:'SUPPLIER_PARTICIPATION_REQUIRED'});
  if(supplierId!==String(org)){
    const relationship=db.prepare("SELECT 1 FROM procurement_supplier_relationships WHERE buyer_organization_id=? AND supplier_organization_id=? AND status='ACTIVE'").get(org,supplierId);
    if(!relationship) throw Object.assign(new Error('Trust evidence refresh requires an active procurement relationship'),{statusCode:403,code:'TRUST_RELATIONSHIP_REQUIRED'});
  }
  const now=nowIso(); const evidence=[];
  evidence.push(['SUPPLIER_PARTICIPATION','procurement','supplier_participant',supplierId,'Supplier is an active procurement supplier participant',{status:'ACTIVE',discoverable:Boolean(participant.discoverable)},'OBSERVED','NETWORK',now]);
  const quals=db.prepare("SELECT id,qualification_type,title,issuer,reference_number,status,verified_at,valid_until FROM supplier_network_qualifications WHERE organization_id=? AND status='VERIFIED' ORDER BY verified_at DESC,id ASC").all(supplierId);
  for(const q of quals) evidence.push(['QUALIFICATION_VERIFIED','supplier_network','supplier_network_qualification',q.id,`Qualification ${q.qualification_type} is verified`,{qualificationType:q.qualification_type,title:q.title,issuer:q.issuer,referenceNumber:q.reference_number,verifiedAt:q.verified_at,validUntil:q.valid_until},'VERIFIED','NETWORK',q.verified_at||now]);
  const perf=db.prepare(`SELECT p.* FROM supplier_network_performance_observations p WHERE p.supplier_organization_id=? AND p.id=(SELECT p2.id FROM supplier_network_performance_observations p2 WHERE p2.supplier_organization_id=p.supplier_organization_id AND p2.metric_type=p.metric_type ORDER BY p2.calculated_at DESC,p2.id DESC LIMIT 1) ORDER BY p.metric_type`).all(supplierId);
  for(const m of perf) evidence.push(['PERFORMANCE_OBSERVED','supplier_network','supplier_network_performance_observation',m.id,`Observed supplier performance: ${m.metric_type}`,{metricType:m.metric_type,numerator:Number(m.numerator),denominator:Number(m.denominator),value:Number(m.value),unit:m.unit,periodStart:m.period_start,periodEnd:m.period_end},'OBSERVED',m.visibility,m.calculated_at]);
  if(supplierId!==org){
    const rel=db.prepare("SELECT id,status,source,created_at,updated_at FROM procurement_supplier_relationships WHERE buyer_organization_id=? AND supplier_organization_id=? AND status='ACTIVE'").get(org,supplierId);
    if(rel) evidence.push(['PROCUREMENT_RELATIONSHIP','procurement','procurement_supplier_relationship',rel.id,'Buyer has an active procurement relationship with this supplier',{buyerOrganizationId:org,relationshipStatus:rel.status,source:rel.source,relationshipCreatedAt:rel.created_at},'OBSERVED','RELATIONSHIP',rel.updated_at||now]);
  }
  db.exec('BEGIN IMMEDIATE'); try{
    const ins=db.prepare(`INSERT OR IGNORE INTO supplier_network_trust_evidence(id,supplier_organization_id,evidence_type,source_authority,source_entity_type,source_entity_id,claim,value_json,evidence_state,visibility,observed_at,created_at,created_by_user_id,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);
    for(const [type,authority,entityType,entityId,claim,value,state,visibility,observedAt] of evidence){const id=crypto.randomUUID();ins.run(id,supplierId,type,authority,entityType,entityId,claim,json(value),state,visibility,observedAt,now,actorId); if(db.prepare('SELECT changes() AS c').get().c) audit(String(chatId),'supplier.network.trust.evidence_observed','supplier_network_trust_evidence',id,{supplierOrganizationId:supplierId,evidenceType:type,sourceAuthority:authority,sourceEntityId:entityId,evidenceState:state,visibility},{organizationId:org,actorId});}
    db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  audit(String(chatId),'supplier.network.trust.refreshed','supplier_network_trust_evidence',supplierId,{supplierOrganizationId:supplierId,evidenceCount:evidence.length,sourceTypes:[...new Set(evidence.map(x=>x[0]))]},{organizationId:org,actorId});
  return listSupplierNetworkTrustEvidence(chatId,{supplierOrganizationId:supplierId,limit:500},actor);
}

export async function listSupplierNetworkPerformance(chatId, { supplierOrganizationId = '', metricType = '', limit = 100 } = {}, actor = null) {
  const organizationId = await tenantOrganizationId(chatId);
  assertProcurementActor(organizationId, actor);
  const supplierId = String(supplierOrganizationId || organizationId).trim();
  const where = ['supplier_organization_id = ?']; const params = [supplierId];
  if (metricType) { where.push('metric_type = ?'); params.push(String(metricType).toUpperCase()); }
  const n = Math.min(500, Math.max(1, Number(limit) || 100));
  return db.prepare(`SELECT * FROM supplier_network_performance_observations WHERE ${where.join(' AND ')} ORDER BY calculated_at DESC, id ASC LIMIT ?`).all(...params,n).map(supplierNetworkPerformanceFromRow);
}

export async function getSupplierNetworkPerformance(chatId, observationId, actor = null) {
  const organizationId = await tenantOrganizationId(chatId);
  assertProcurementActor(organizationId, actor);
  const row = db.prepare('SELECT * FROM supplier_network_performance_observations WHERE id=?').get(String(observationId));
  return supplierNetworkPerformanceFromRow(row);
}

export async function recalculateSupplierNetworkPerformance(chatId, supplierOrganizationId, input = {}, actor = null) {
  const organizationId = await tenantOrganizationId(chatId);
  const actorId = assertProcurementActor(organizationId, actor);
  const supplierId = String(supplierOrganizationId || '').trim();
  if (!supplierId) throw Object.assign(new Error('supplierOrganizationId is required'), {statusCode:400,code:'SUPPLIER_REQUIRED'});
  const participant = db.prepare("SELECT organization_id FROM procurement_supplier_participants WHERE organization_id=? AND status='ACTIVE'").get(supplierId);
  if (!participant) throw Object.assign(new Error('Supplier network performance requires an active supplier participant'), {statusCode:409,code:'SUPPLIER_PARTICIPATION_REQUIRED'});
  const days = Math.min(3650, Math.max(1, Number(input.days) || 180));
  const end = new Date(); const start = new Date(end.getTime() - days*86400000); const periodStart=start.toISOString(); const periodEnd=end.toISOString();
  const rfq = db.prepare(`SELECT COUNT(*) invited, SUM(CASE WHEN EXISTS (SELECT 1 FROM procurement_rfq_responses r WHERE r.rfq_id=s.rfq_id AND r.supplier_organization_id=s.supplier_organization_id AND r.status='SUBMITTED') THEN 1 ELSE 0 END) responded FROM procurement_rfq_suppliers s JOIN procurement_rfqs f ON f.id=s.rfq_id WHERE s.supplier_organization_id=? AND f.created_at>=? AND f.created_at<=?`).get(supplierId,periodStart,periodEnd);
  const pos = db.prepare(`SELECT id,status,total_minor FROM purchase_orders WHERE supplier_organization_id=? AND source_type='PROCUREMENT_AWARD' AND created_at>=? AND created_at<=? AND status IN ('APPROVED','CANCELLED')`).all(supplierId,periodStart,periodEnd);
  let ordered=0, received=0, complete=0;
  const receiptStmt=db.prepare(`SELECT COALESCE(SUM(prl.received_quantity),0) received FROM procurement_receipt_lines prl JOIN procurement_receipts pr ON pr.id=prl.receipt_id WHERE pr.purchase_order_id=? AND prl.purchase_order_item_id=? AND pr.status='POSTED'`);
  for (const po of pos.filter(x=>x.status==='APPROVED')) {
    const items=db.prepare('SELECT id,quantity FROM purchase_order_items WHERE purchase_order_id=?').all(po.id);
    let poOrdered=0, poReceived=0;
    for (const item of items) { poOrdered+=Number(item.quantity||0); const r=receiptStmt.get(po.id,item.id); poReceived+=Math.min(Number(item.quantity||0), Number(r?.received||0)); }
    ordered+=poOrdered; received+=poReceived; if (poOrdered>0 && poReceived>=poOrdered) complete+=1;
  }
  const approvedCount=pos.filter(x=>x.status==='APPROVED').length;
  const cancelledCount=pos.filter(x=>x.status==='CANCELLED').length;
  const observations=[
    ['RFQ_RESPONSE_RATE',Number(rfq?.responded||0),Number(rfq?.invited||0),Number(rfq?.invited||0)?(Number(rfq.responded||0)/Number(rfq.invited))*100:0, {source:'procurement_rfq',invited:Number(rfq?.invited||0),responded:Number(rfq?.responded||0)}],
    ['FILL_RATE',received,ordered,ordered?(received/ordered)*100:0, {source:'procurement_receipt',orderedQuantity:ordered,receivedQuantity:received}],
    ['PO_COMPLETION_RATE',complete,approvedCount,approvedCount?(complete/approvedCount)*100:0, {source:'procurement_purchase_order',completed:complete,approved:approvedCount}],
    ['CANCELLATION_RATE',cancelledCount,approvedCount+cancelledCount,(approvedCount+cancelledCount)?(cancelledCount/(approvedCount+cancelledCount))*100:0, {source:'procurement_purchase_order',cancelled:cancelledCount,eligible:approvedCount+cancelledCount}],
    ['OBSERVED_PURCHASE_ORDERS',approvedCount,approvedCount+cancelledCount,approvedCount+cancelledCount, {source:'procurement_purchase_order',approved:approvedCount,cancelled:cancelledCount}],
  ];
  const now=nowIso(); db.exec('BEGIN IMMEDIATE'); try {
    const ins=db.prepare(`INSERT INTO supplier_network_performance_observations(id,supplier_organization_id,metric_type,numerator,denominator,value,unit,visibility,period_start,period_end,evidence_json,calculated_at,created_by_user_id,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);
    for (const [metric,n,d,v,evidence] of observations) { const id=crypto.randomUUID(); ins.run(id,supplierId,metric,n,d,v,metric==='OBSERVED_PURCHASE_ORDERS'?'COUNT':'RATE_PERCENT',String(input.visibility||'NETWORK').toUpperCase(),periodStart,periodEnd,json(evidence),now,actorId); audit(chatId,'supplier.network.performance.observed','supplier_network_performance_observation',id,{supplierOrganizationId:supplierId,metricType:metric,value:v,periodStart,periodEnd,evidence},{organizationId,actorId}); }
    db.exec('COMMIT');
  } catch(e){db.exec('ROLLBACK');throw e;}
  audit(chatId,'supplier.network.performance.recalculated','supplier_network_performance',supplierId,{supplierOrganizationId:supplierId,days,observationCount:observations.length,periodStart,periodEnd},{organizationId,actorId});
  return listSupplierNetworkPerformance(chatId,{supplierOrganizationId:supplierId,limit:observations.length},actor);
}

function supplierNetworkDiscoveryVisible(orgId, supplierId, visibility){
  if (String(orgId)===String(supplierId)) return true;
  if (visibility==='PUBLIC' || visibility==='NETWORK') return true;
  if (visibility==='RELATIONSHIP') return Boolean(db.prepare("SELECT 1 FROM procurement_supplier_relationships WHERE buyer_organization_id=? AND supplier_organization_id=? AND status='ACTIVE'").get(String(orgId),String(supplierId)));
  return false;
}

function supplierNetworkDiscoveryNormalizeList(value){
  if(value==null || value==='') return [];
  if(Array.isArray(value)) return value.map(v=>String(v).trim()).filter(Boolean);
  return String(value).split(',').map(v=>v.trim()).filter(Boolean);
}

function marketplaceIntegrationVisible(buyerOrg, supplierOrg, visibility){return supplierNetworkDiscoveryVisible(buyerOrg,supplierOrg,visibility);}
function marketplacePresenceForOrganization(organizationId){const rows=db.prepare(`SELECT cp.chat_id AS sellerId,cp.product_id,cp.price_minor,cp.stock,cp.currency,cp.updated_at FROM catalog_products cp JOIN tenants t ON t.chat_id=cp.chat_id WHERE t.organization_id=? AND cp.marketplace_listed=1 ORDER BY cp.updated_at DESC,cp.product_id ASC`).all(String(organizationId));return {present:rows.length>0,listingCount:rows.length,listings:rows.slice(0,50).map(r=>({sellerId:r.sellerId,productId:r.product_id,priceMinor:r.price_minor,stock:r.stock==null?null:Number(r.stock),currency:r.currency,updatedAt:r.updated_at}))};}
export async function getSupplierNetworkMarketplaceIntegration(chatId,supplierOrganizationId='',actor=null){ensureDatabase();const viewerOrg=await tenantOrganizationId(chatId);assertProcurementActor(viewerOrg,actor);const target=String(supplierOrganizationId||viewerOrg).trim();const org=db.prepare('SELECT id,name,country,currency,timezone FROM organizations WHERE id=?').get(target);if(!org)throw Object.assign(new Error('Organization not found'),{statusCode:404,code:'ORGANIZATION_NOT_FOUND'});const participation=supplierParticipantRow(target);if(target!==String(viewerOrg)&&(!participation||participation.status!=='ACTIVE'||!participation.discoverable))throw Object.assign(new Error('Supplier organization is not available for network integration'),{statusCode:404,code:'SUPPLIER_NOT_AVAILABLE'});const profile=db.prepare('SELECT * FROM supplier_network_profiles WHERE organization_id=?').get(target);if(!profile||profile.status!=='PUBLISHED'||!marketplaceIntegrationVisible(viewerOrg,target,profile.visibility))throw Object.assign(new Error('Supplier network profile is not available'),{statusCode:404,code:'SUPPLIER_PROFILE_NOT_AVAILABLE'});const marketplace=marketplacePresenceForOrganization(target);const catalog=db.prepare(`SELECT l.*,p.marketplace_listed,p.price_minor AS marketplace_price_minor,p.stock AS marketplace_stock,p.currency AS marketplace_currency,p.updated_at AS marketplace_updated_at FROM supplier_network_catalog_listings l LEFT JOIN catalog_products p ON p.chat_id=(SELECT chat_id FROM tenants WHERE organization_id=l.organization_id ORDER BY chat_id LIMIT 1) AND p.product_id=l.product_id WHERE l.organization_id=? AND l.status='ACTIVE' ORDER BY l.updated_at DESC,l.id ASC`).all(target).filter(r=>marketplaceIntegrationVisible(viewerOrg,target,r.visibility));const marketplaceByProduct=new Map(marketplace.listings.map(x=>[String(x.productId),x]));const linkedCatalog=catalog.slice(0,100).map(r=>({id:r.id,productId:r.product_id,supplierSku:r.supplier_sku,unit:r.unit,indicativePriceMinor:r.indicative_price_minor,currency:r.currency,leadTimeDays:r.lead_time_days,availabilityStatus:r.availability_status,marketplace:marketplaceByProduct.has(String(r.product_id))?{listed:true,...marketplaceByProduct.get(String(r.product_id))}:{listed:false}}));const result={organization:{id:org.id,name:org.name,country:org.country,currency:org.currency,timezone:org.timezone},identity:{canonicalOrganizationId:org.id,marketplaceSellerIdentity:'organization',procurementSupplierIdentity:'organization',sameCanonicalIdentity:true},roles:{procurementSupplier:!!participation,procurementSupplierActive:participation?.status==='ACTIVE',supplierNetworkPublished:true,marketplacePresence:marketplace.present},marketplace:{listingCount:marketplace.listingCount,listings:marketplace.listings},supplierNetwork:{catalogCount:catalog.length,catalogListings:linkedCatalog},authority:{marketplaceListings:'commerce',supplierParticipation:'procurement',supplierNetworkData:'supplier_network'},mutation:{marketplace:false,supplierNetwork:false,procurement:false,inventory:false,payment:false}};audit(String(chatId),'supplier.network.marketplace_integration.viewed','supplier_network_marketplace_integration',target,{targetOrganizationId:target,marketplaceListingCount:marketplace.listingCount,catalogCount:catalog.length},{organizationId:viewerOrg,actorId:actor?.userId||null});return result;}

export async function discoverSupplierNetwork(chatId, input={}, actor=null){
  ensureDatabase();
  const buyerOrg=await tenantOrganizationId(chatId);
  assertProcurementActor(buyerOrg,actor);
  const q=String(input.search||input.q||'').trim().toLowerCase();
  const productId=String(input.productId||input.product_id||'').trim();
  const capabilityCode=String(input.capabilityCode||input.capability_code||'').trim().toUpperCase();
  const countryCode=String(input.countryCode||input.country_code||'').trim().toUpperCase();
  const geoCode=String(input.geoCode||input.geo_code||'').trim();
  const currency=input.currency?normaliseCurrency(input.currency,'ETB'):'';
  const minimumQuantity=input.minimumQuantity??input.minimum_quantity;
  const minQty=minimumQuantity==null||minimumQuantity===''?null:Number(minimumQuantity);
  if(minQty!=null && (!Number.isFinite(minQty)||minQty<=0)) throw Object.assign(new Error('minimumQuantity must be positive'),{statusCode:400,code:'INVALID_DISCOVERY_MINIMUM_QUANTITY'});
  const wholesale=input.wholesale===true||String(input.wholesale||'').toLowerCase()==='true';
  const bulk=input.bulkOrder===true||String(input.bulkOrder||'').toLowerCase()==='true';
  const qualificationType=String(input.qualificationType||input.qualification_type||'').trim();
  const n=Math.min(100,Math.max(1,Number(input.limit)||25));
  const participants=db.prepare(`SELECT sp.organization_id,sp.discoverable,o.name AS organization_name,o.country,o.currency,o.timezone,p.display_name,p.description,p.business_categories_json,p.service_summary,p.visibility AS profile_visibility,p.status AS profile_status,p.published_at FROM procurement_supplier_participants sp JOIN organizations o ON o.id=sp.organization_id JOIN supplier_network_profiles p ON p.organization_id=sp.organization_id WHERE sp.status='ACTIVE' AND sp.discoverable=1 AND p.status='PUBLISHED' AND sp.organization_id<>? ORDER BY o.name COLLATE NOCASE ASC,sp.organization_id ASC LIMIT 500`).all(String(buyerOrg));
  const results=[];
  for(const supplier of participants){
    const sid=String(supplier.organization_id);
    const relationship=Boolean(db.prepare("SELECT 1 FROM procurement_supplier_relationships WHERE buyer_organization_id=? AND supplier_organization_id=? AND status='ACTIVE'").get(String(buyerOrg),sid));
    const visible=v=>supplierNetworkDiscoveryVisible(buyerOrg,sid,v);
    if(!visible(supplier.profile_visibility)) continue;
    const profile={displayName:supplier.display_name,description:supplier.description||'',businessCategories:parseJSON(supplier.business_categories_json,[]),serviceSummary:supplier.service_summary||'',visibility:supplier.profile_visibility};
    const searchBlob=[supplier.organization_name,profile.displayName,profile.description,profile.serviceSummary,...profile.businessCategories].join(' ').toLowerCase();
    if(q && !searchBlob.includes(q)) continue;
    const catalog=db.prepare(`SELECT l.*,p.product_json FROM supplier_network_catalog_listings l LEFT JOIN catalog_products p ON p.product_id=l.product_id WHERE l.organization_id=? AND l.status='ACTIVE'`).all(sid).filter(r=>visible(r.visibility));
    const capabilities=db.prepare(`SELECT * FROM supplier_network_capabilities WHERE organization_id=? AND status='ACTIVE'`).all(sid).filter(r=>visible(r.visibility));
    const areas=db.prepare(`SELECT * FROM supplier_network_service_areas WHERE organization_id=? AND status='ACTIVE'`).all(sid).filter(r=>visible(r.visibility));
    const capacities=db.prepare(`SELECT * FROM supplier_network_capacity_signals WHERE organization_id=? AND status='ACTIVE'`).all(sid).filter(r=>visible(r.visibility));
    const commercial=db.prepare(`SELECT * FROM supplier_network_commercial_terms WHERE organization_id=? AND status='ACTIVE'`).all(sid).filter(r=>visible(r.visibility));
    const qualifications=db.prepare(`SELECT * FROM supplier_network_qualifications WHERE organization_id=? AND status IN ('VERIFIED','DOCUMENTED')`).all(sid).filter(r=>visible(r.visibility)).filter(r=>!r.valid_until || new Date(r.valid_until).getTime()>=Date.now());
    const trust=db.prepare(`SELECT evidence_type,claim,evidence_state,visibility,observed_at FROM supplier_network_trust_evidence WHERE supplier_organization_id=? ORDER BY observed_at DESC,id ASC`).all(sid).filter(r=>visible(r.visibility));
    const matches=[];
    let score=0;
    let productMatches=catalog;
    if(productId){productMatches=catalog.filter(r=>String(r.product_id)===productId); if(productMatches.length){score+=30;matches.push({dimension:'PRODUCT',reason:'Canonical product match',productId});}}
    let capabilityMatches=capabilities;
    if(capabilityCode){capabilityMatches=capabilities.filter(r=>String(r.code).toUpperCase()===capabilityCode); if(capabilityMatches.length){score+=20;matches.push({dimension:'CAPABILITY',reason:'Capability match',code:capabilityCode});}}
    let areaMatches=areas;
    if(countryCode){areaMatches=areas.filter(r=>String(r.country_code).toUpperCase()===countryCode); if(areaMatches.length){score+=10;matches.push({dimension:'COUNTRY',reason:'Service country match',countryCode});}}
    if(geoCode){const gm=areaMatches.filter(r=>String(r.geo_code)===geoCode); if(gm.length){score+=15;matches.push({dimension:'GEOGRAPHY',reason:'Service area match',geoCode});} else if(countryCode) areaMatches=[];}
    let capacityMatches=capacities;
    if(productId) capacityMatches=capacityMatches.filter(r=>r.subject_type==='PRODUCT'&&String(r.subject_id)===productId);
    if(capabilityCode) capacityMatches=capacityMatches.filter(r=>r.subject_type==='CAPABILITY'&&String(r.subject_id)===String(capabilityMatches.find(c=>String(c.code).toUpperCase()===capabilityCode)?.id));
    if(minQty!=null){capacityMatches=capacityMatches.filter(r=>Number(r.quantity)>=minQty); if(capacityMatches.length){score+=10;matches.push({dimension:'CAPACITY',reason:'Declared capacity meets requested minimum',minimumQuantity:minQty});}}
    else if(capacities.length){score+=5;matches.push({dimension:'CAPACITY',reason:'Declared capacity signal available'});}
    let commercialMatches=commercial;
    if(currency) commercialMatches=commercialMatches.filter(r=>parseJSON(r.supported_currencies_json,[]).map(x=>String(x).toUpperCase()).includes(currency));
    if(wholesale) commercialMatches=commercialMatches.filter(r=>Boolean(r.wholesale_capable));
    if(bulk) commercialMatches=commercialMatches.filter(r=>Boolean(r.bulk_order_capable));
    if(currency||wholesale||bulk){if(commercialMatches.length){score+=10;matches.push({dimension:'COMMERCIAL',reason:'Commercial capability match',currency:currency||undefined,wholesale:wholesale||undefined,bulkOrder:bulk||undefined});}}
    if(qualificationType){const qm=qualifications.filter(r=>String(r.qualification_type)===qualificationType);if(qm.length){score+=10;matches.push({dimension:'QUALIFICATION',reason:'Valid documented/verified qualification available',qualificationType});}}
    else if(qualifications.some(r=>r.status==='VERIFIED')){score+=5;matches.push({dimension:'QUALIFICATION',reason:'Verified qualification evidence available'});}
    if(relationship){score+=5;matches.push({dimension:'RELATIONSHIP',reason:'Active procurement relationship exists'});}
    if(productId && !productMatches.length) continue;
    if(capabilityCode && !capabilityMatches.length) continue;
    if(countryCode && !areaMatches.length) continue;
    if(geoCode && !areaMatches.length) continue;
    if(minQty!=null && !capacityMatches.length) continue;
    if((currency||wholesale||bulk) && !commercialMatches.length) continue;
    if(qualificationType && !qualifications.some(r=>String(r.qualification_type)===qualificationType)) continue;
    results.push({organizationId:sid,organizationName:supplier.organization_name,profile,relationshipActive:relationship,matchScore:score,matchReasons:matches,catalog:productMatches.slice(0,20).map(r=>({id:r.id,productId:r.product_id,productName:(parseJSON(r.product_json,{})?.name||parseJSON(r.product_json,{})?.title||null),supplierSku:r.supplier_sku,unit:r.unit,indicativePriceMinor:r.indicative_price_minor,currency:r.currency,leadTimeDays:r.lead_time_days,availabilityStatus:r.availability_status})),capabilities:capabilities.filter(r=>!capabilityCode||String(r.code).toUpperCase()===capabilityCode).slice(0,20).map(r=>({id:r.id,code:r.code,name:r.name,category:r.category})),serviceAreas:areaMatches.slice(0,20).map(r=>({id:r.id,scopeType:r.scope_type,countryCode:r.country_code,geoCode:r.geo_code,displayName:r.display_name,radiusKm:r.radius_km})),capacitySignals:capacityMatches.slice(0,20).map(r=>({id:r.id,subjectType:r.subject_type,subjectId:r.subject_id,quantity:Number(r.quantity),unit:r.unit,periodType:r.period_type,periodStart:r.period_start,periodEnd:r.period_end,availability:r.availability})),commercialTerms:commercialMatches.slice(0,20).map(r=>({id:r.id,subjectType:r.subject_type,subjectId:r.subject_id,supportedCurrencies:parseJSON(r.supported_currencies_json,[]),paymentTerms:parseJSON(r.payment_terms_json,[]),leadTimeMinDays:r.lead_time_min_days,leadTimeMaxDays:r.lead_time_max_days,wholesaleCapable:Boolean(r.wholesale_capable),bulkOrderCapable:Boolean(r.bulk_order_capable),deliveryTerms:parseJSON(r.delivery_terms_json,[])})),qualifications:qualifications.slice(0,20).map(r=>({id:r.id,qualificationType:r.qualification_type,title:r.title,issuer:r.issuer,status:r.status,validUntil:r.valid_until,verifiedAt:r.verified_at})),trustEvidence:trust.slice(0,20).map(r=>({evidenceType:r.evidence_type,claim:r.claim,evidenceState:r.evidence_state,observedAt:r.observed_at})),marketplace:marketplacePresenceForOrganization(sid)});
  }
  results.sort((a,b)=>b.matchScore-a.matchScore||a.organizationName.localeCompare(b.organizationName)||a.organizationId.localeCompare(b.organizationId));
  const out=results.slice(0,n);
  audit(String(chatId),'supplier.network.discovery.performed','supplier_network_discovery',String(buyerOrg),{filters:{search:q||null,productId:productId||null,capabilityCode:capabilityCode||null,countryCode:countryCode||null,geoCode:geoCode||null,currency:currency||null,minimumQuantity:minQty,wholesale,bulkOrder:bulk,qualificationType:qualificationType||null},resultCount:out.length},{organizationId:buyerOrg,actorId:actor?.userId||null});
  return out;
}

export async function getProcurementComparison(chatId, comparisonId, actor = null) {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  assertProcurementActor(organizationId, actor);
  return comparisonRows(organizationId, comparisonId);
}

export async function listProcurementComparisons(chatId, { rfqId = '', limit = 100 } = {}, actor = null) {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  assertProcurementActor(organizationId, actor);
  const params = [organizationId];
  const where = ['organization_id=?'];
  if (rfqId) { where.push('rfq_id=?'); params.push(String(rfqId)); }
  const n = Math.min(200, Math.max(1, Number(limit) || 100));
  const rows = db.prepare(`SELECT * FROM procurement_comparisons WHERE ${where.join(' AND ')} ORDER BY rfq_id,version DESC LIMIT ?`).all(...params, n);
  return rows.map(r => comparisonRows(organizationId, r.id));
}

export async function createProcurementComparison(chatId, rfqId, actor = null) {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  const actorId = assertProcurementActor(organizationId, actor);
  const rfq = db.prepare('SELECT * FROM procurement_rfqs WHERE id=? AND organization_id=?').get(String(rfqId), organizationId);
  if (!rfq) throw Object.assign(new Error('RFQ not found'), { statusCode: 404, code: 'RFQ_NOT_FOUND' });
  if (rfq.status !== 'CLOSED') throw Object.assign(new Error('RFQ must be CLOSED before comparison'), { statusCode: 409, code: 'RFQ_NOT_CLOSED' });
  const rfqItems = db.prepare('SELECT * FROM procurement_rfq_items WHERE rfq_id=? ORDER BY created_at,id').all(rfq.id);
  if (!rfqItems.length) throw Object.assign(new Error('RFQ has no items'), { statusCode: 409, code: 'RFQ_ITEMS_REQUIRED' });
  const responses = db.prepare(`SELECT r.*,o.name AS supplier_organization_name FROM procurement_rfq_responses r JOIN organizations o ON o.id=r.supplier_organization_id WHERE r.rfq_id=? AND r.status='SUBMITTED' ORDER BY o.name COLLATE NOCASE,r.supplier_organization_id`).all(rfq.id);
  if (!responses.length) throw Object.assign(new Error('No submitted supplier responses are available for comparison'), { statusCode: 409, code: 'SUBMITTED_RESPONSES_REQUIRED' });

  const versionRow = db.prepare('SELECT COALESCE(MAX(version),0)+1 AS next_version FROM procurement_comparisons WHERE rfq_id=?').get(rfq.id);
  const version = Number(versionRow.next_version || 1);
  const comparisonId = crypto.randomUUID();
  const now = nowIso();
  const supplierPlans = [];
  const linePlans = [];

  for (const response of responses) {
    const responseItems = db.prepare('SELECT * FROM procurement_rfq_response_items WHERE response_id=? ORDER BY created_at,id').all(response.id);
    const byItem = new Map(responseItems.map(x => [String(x.rfq_item_id), x]));
    let requestedQuantityTotal = 0;
    let coveredQuantityTotal = 0;
    let comparableTotalMinor = 0;
    let maxLeadTimeDays = null;
    let quotedLineCount = 0;
    let completeCoverage = true;
    let valid = true;
    const responseValidity = comparisonValidityTimestamp(response.valid_until);
    if (Number.isNaN(responseValidity) || (responseValidity != null && responseValidity <= Date.now())) valid = false;
    if (normaliseCurrency(response.currency, rfq.currency) !== normaliseCurrency(rfq.currency, response.currency)) valid = false;

    for (const item of rfqItems) {
      const requested = Number(item.quantity);
      requestedQuantityTotal += requested;
      const offer = byItem.get(String(item.id));
      if (!offer) { completeCoverage = false; continue; }
      quotedLineCount += 1;
      const offered = Number(offer.offered_quantity);
      const covered = Math.min(requested, offered);
      const lineTotal = Math.round(covered * Number(offer.unit_price_minor));
      coveredQuantityTotal += covered;
      comparableTotalMinor += lineTotal;
      if (covered < requested) completeCoverage = false;
      if (offer.lead_time_days != null) maxLeadTimeDays = maxLeadTimeDays == null ? Number(offer.lead_time_days) : Math.max(maxLeadTimeDays, Number(offer.lead_time_days));
      linePlans.push({ supplierOrganizationId: response.supplier_organization_id, responseId: response.id, rfqItemId: item.id, requestedQuantity: requested, offeredQuantity: offered, coveredQuantity: covered, unitPriceMinor: Number(offer.unit_price_minor), comparableLineTotalMinor: lineTotal, leadTimeDays: offer.lead_time_days == null ? null : Number(offer.lead_time_days), validUntil: response.valid_until, coverageComplete: covered >= requested });
    }
    const coverageRatio = requestedQuantityTotal > 0 ? Math.min(1, coveredQuantityTotal / requestedQuantityTotal) : 0;
    supplierPlans.push({ supplierOrganizationId: response.supplier_organization_id, supplierOrganizationName: response.supplier_organization_name || '', responseId: response.id, requestedLineCount: rfqItems.length, quotedLineCount, completeCoverage, requestedQuantityTotal, coveredQuantityTotal, coverageRatio, comparableTotalMinor, maxLeadTimeDays, validUntil: response.valid_until, eligible: valid && quotedLineCount > 0 });
  }

  supplierPlans.sort((a,b) => Number(b.eligible)-Number(a.eligible) || Number(b.coverageRatio)-Number(a.coverageRatio) || Number(b.completeCoverage)-Number(a.completeCoverage) || a.comparableTotalMinor-b.comparableTotalMinor || comparisonLeadSort(a.maxLeadTimeDays)-comparisonLeadSort(b.maxLeadTimeDays) || comparisonValiditySort(b.validUntil)-comparisonValiditySort(a.validUntil) || a.supplierOrganizationName.localeCompare(b.supplierOrganizationName) || a.supplierOrganizationId.localeCompare(b.supplierOrganizationId));
  supplierPlans.forEach((x,i) => { x.rank = x.eligible ? i + 1 : null; });

  const lineRankMap = new Map();
  for (const item of rfqItems) {
    const candidates = linePlans.filter(x => x.rfqItemId === item.id && x.coveredQuantity > 0);
    candidates.sort((a,b) => Number(b.coverageComplete)-Number(a.coverageComplete) || a.unitPriceMinor-b.unitPriceMinor || comparisonLeadSort(a.leadTimeDays)-comparisonLeadSort(b.leadTimeDays) || comparisonValiditySort(b.validUntil)-comparisonValiditySort(a.validUntil) || a.supplierOrganizationId.localeCompare(b.supplierOrganizationId));
    candidates.forEach((x,i) => lineRankMap.set(`${x.supplierOrganizationId}:${x.rfqItemId}`, i + 1));
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO procurement_comparisons(id,organization_id,rfq_id,version,status,currency,policy_version,created_by_user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).run(comparisonId, organizationId, rfq.id, version, 'FINAL', normaliseCurrency(rfq.currency,'ETB'), '1.0', actorId, now);
    const si = db.prepare(`INSERT INTO procurement_comparison_suppliers(id,comparison_id,supplier_organization_id,response_id,requested_line_count,quoted_line_count,complete_coverage,requested_quantity_total,covered_quantity_total,coverage_ratio,comparable_total_minor,max_lead_time_days,valid_until,eligible,rank,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const x of supplierPlans) si.run(crypto.randomUUID(), comparisonId, x.supplierOrganizationId, x.responseId, x.requestedLineCount, x.quotedLineCount, x.completeCoverage ? 1 : 0, x.requestedQuantityTotal, x.coveredQuantityTotal, x.coverageRatio, x.comparableTotalMinor, x.maxLeadTimeDays, x.validUntil, x.eligible ? 1 : 0, x.rank, now);
    const li = db.prepare(`INSERT INTO procurement_comparison_line_offers(id,comparison_id,supplier_organization_id,response_id,rfq_item_id,requested_quantity,offered_quantity,covered_quantity,unit_price_minor,comparable_line_total_minor,lead_time_days,valid_until,coverage_complete,line_rank,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for (const x of linePlans) li.run(crypto.randomUUID(), comparisonId, x.supplierOrganizationId, x.responseId, x.rfqItemId, x.requestedQuantity, x.offeredQuantity, x.coveredQuantity, x.unitPriceMinor, x.comparableLineTotalMinor, x.leadTimeDays, x.validUntil, x.coverageComplete ? 1 : 0, lineRankMap.get(`${x.supplierOrganizationId}:${x.rfqItemId}`) || null, now);
    audit(chatId, 'procurement.comparison.created', 'procurement_comparison', comparisonId, { rfqId: rfq.id, version, supplierCount: supplierPlans.length, policyVersion: '1.0' }, { organizationId, actorId });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return comparisonRows(organizationId, comparisonId);
}

const PROCUREMENT_AWARD_STATES = Object.freeze({ DRAFT: ['CONFIRMED','CANCELLED'], CONFIRMED: [], CANCELLED: [] });

function procurementAwardLineFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    awardId: row.award_id,
    rfqItemId: row.rfq_item_id,
    supplierOrganizationId: row.supplier_organization_id,
    supplierOrganizationName: row.supplier_organization_name || '',
    responseId: row.response_id,
    comparisonLineOfferId: row.comparison_line_offer_id,
    awardedQuantity: Number(row.awarded_quantity),
    unitPriceMinor: Number(row.unit_price_minor),
    awardedTotalMinor: Number(row.awarded_total_minor),
    currency: normaliseCurrency(row.currency, 'ETB'),
    leadTimeDays: row.lead_time_days == null ? null : Number(row.lead_time_days),
    validUntil: row.valid_until,
    notes: row.notes || '',
    createdAt: row.created_at,
  };
}

function procurementAwardFromRow(row, lines = []) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    demandId: row.demand_id,
    rfqId: row.rfq_id,
    comparisonId: row.comparison_id,
    status: row.status,
    currency: normaliseCurrency(row.currency, 'ETB'),
    awardNumber: row.award_number,
    notes: row.notes || '',
    idempotencyKey: row.idempotency_key,
    version: Number(row.version || 1),
    createdByUserId: row.created_by_user_id,
    confirmedByUserId: row.confirmed_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at,
    cancelledAt: row.cancelled_at,
    lines,
  };
}

function getProcurementAwardById(organizationId, awardId) {
  const row = db.prepare(`SELECT * FROM procurement_awards WHERE id=? AND organization_id=?`).get(String(awardId), String(organizationId));
  if (!row) return null;
  const lines = db.prepare(`SELECT al.*,o.name AS supplier_organization_name FROM procurement_award_lines al JOIN organizations o ON o.id=al.supplier_organization_id WHERE al.award_id=? ORDER BY al.rfq_item_id,al.supplier_organization_id`).all(row.id).map(procurementAwardLineFromRow);
  return procurementAwardFromRow(row, lines);
}

function procurementAwardHash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }

export async function getProcurementAward(chatId, awardId, actor = null) {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  assertProcurementActor(organizationId, actor);
  return getProcurementAwardById(organizationId, awardId);
}

export async function listProcurementAwards(chatId, { demandId = '', rfqId = '', status = 'all', limit = 100 } = {}, actor = null) {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  assertProcurementActor(organizationId, actor);
  const where = ['organization_id=?'];
  const params = [organizationId];
  if (demandId) { where.push('demand_id=?'); params.push(String(demandId)); }
  if (rfqId) { where.push('rfq_id=?'); params.push(String(rfqId)); }
  if (status && String(status).toLowerCase() !== 'all') {
    const st = String(status).toUpperCase();
    if (!Object.hasOwn(PROCUREMENT_AWARD_STATES, st)) throw Object.assign(new Error('Invalid award status'), { statusCode:400, code:'INVALID_AWARD_STATUS' });
    where.push('status=?'); params.push(st);
  }
  const n = Math.min(200, Math.max(1, Number(limit) || 100));
  const rows = db.prepare(`SELECT * FROM procurement_awards WHERE ${where.join(' AND ')} ORDER BY updated_at DESC,created_at DESC LIMIT ?`).all(...params,n);
  return rows.map(r => getProcurementAwardById(organizationId,r.id));
}

export async function createProcurementAward(chatId, input = {}, actor = null) {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  const actorId = assertProcurementActor(organizationId, actor);
  const demandId = String(input.demandId ?? input.demand_id ?? '').trim();
  const rfqId = String(input.rfqId ?? input.rfq_id ?? '').trim();
  const comparisonId = String(input.comparisonId ?? input.comparison_id ?? '').trim();
  if (!demandId || !rfqId || !comparisonId) throw Object.assign(new Error('demandId, rfqId and comparisonId are required'),{statusCode:400,code:'AWARD_REFERENCES_REQUIRED'});
  const demand = db.prepare('SELECT * FROM procurement_demands WHERE id=? AND organization_id=?').get(demandId,organizationId);
  if (!demand) throw Object.assign(new Error('Procurement demand not found'),{statusCode:404,code:'DEMAND_NOT_FOUND'});
  if (demand.status !== 'SOURCING') throw Object.assign(new Error('Demand must be in SOURCING before creating an award'),{statusCode:409,code:'DEMAND_NOT_SOURCING'});
  const rfq = db.prepare('SELECT * FROM procurement_rfqs WHERE id=? AND organization_id=?').get(rfqId,organizationId);
  if (!rfq) throw Object.assign(new Error('RFQ not found'),{statusCode:404,code:'RFQ_NOT_FOUND'});
  if (rfq.demand_id !== demandId) throw Object.assign(new Error('RFQ does not belong to the supplied demand'),{statusCode:409,code:'RFQ_DEMAND_MISMATCH'});
  if (rfq.status !== 'CLOSED') throw Object.assign(new Error('RFQ must be CLOSED before award'),{statusCode:409,code:'RFQ_NOT_CLOSED'});
  const comparison = db.prepare('SELECT * FROM procurement_comparisons WHERE id=? AND organization_id=?').get(comparisonId,organizationId);
  if (!comparison) throw Object.assign(new Error('Procurement comparison not found'),{statusCode:404,code:'COMPARISON_NOT_FOUND'});
  if (comparison.rfq_id !== rfqId) throw Object.assign(new Error('Comparison does not belong to the supplied RFQ'),{statusCode:409,code:'COMPARISON_RFQ_MISMATCH'});
  if (comparison.status !== 'FINAL') throw Object.assign(new Error('Only FINAL comparisons can be awarded'),{statusCode:409,code:'COMPARISON_NOT_FINAL'});
  const rawLines = Array.isArray(input.lines) ? input.lines : [];
  if (!rawLines.length) throw Object.assign(new Error('At least one award line is required'),{statusCode:400,code:'AWARD_LINES_REQUIRED'});
  const comparisonLines = db.prepare(`SELECT cl.*,r.status AS response_status,r.currency AS response_currency FROM procurement_comparison_line_offers cl JOIN procurement_rfq_responses r ON r.id=cl.response_id WHERE cl.comparison_id=?`).all(comparisonId);
  const byKey = new Map(comparisonLines.map(x => [`${x.rfq_item_id}:${x.supplier_organization_id}`,x]));
  const requestedByItem = new Map(db.prepare('SELECT id,quantity,currency FROM procurement_rfq_items WHERE rfq_id=?').all(rfqId).map(x => [String(x.id),x]));
  const seen = new Set();
  const lines = rawLines.map((x,i)=>{
    const itemId=String(x.rfqItemId??x.rfq_item_id??'').trim();
    const supplierId=String(x.supplierOrganizationId??x.supplier_organization_id??'').trim();
    const key=`${itemId}:${supplierId}`;
    const offer=byKey.get(key);
    if(!offer) throw Object.assign(new Error(`Award line ${i+1} does not reference a comparison offer`),{statusCode:400,code:'INVALID_COMPARISON_OFFER'});
    if(seen.has(key)) throw Object.assign(new Error('Duplicate award supplier/item line'),{statusCode:400,code:'DUPLICATE_AWARD_LINE'});
    seen.add(key);
    if(offer.eligible===0 || Number(offer.covered_quantity)<=0 || offer.response_status!=='SUBMITTED') throw Object.assign(new Error(`Supplier offer for item ${itemId} is not eligible for award`),{statusCode:409,code:'OFFER_NOT_ELIGIBLE'});
    const qty=Number(x.awardedQuantity??x.awarded_quantity);
    if(!Number.isFinite(qty)||qty<=0) throw Object.assign(new Error(`Award line ${i+1} awardedQuantity must be greater than zero`),{statusCode:400,code:'INVALID_AWARDED_QUANTITY'});
    if(qty>Number(offer.covered_quantity)) throw Object.assign(new Error(`Award quantity exceeds the supplier's covered quantity for item ${itemId}`),{statusCode:409,code:'AWARD_QUANTITY_EXCEEDS_OFFER'});
    const req=requestedByItem.get(itemId);
    if(!req) throw Object.assign(new Error('Award references an RFQ item outside the RFQ'),{statusCode:400,code:'INVALID_RFQ_ITEM'});
    return { rfqItemId:itemId,supplierOrganizationId:supplierId,responseId:offer.response_id,comparisonLineOfferId:offer.id,awardedQuantity:qty,unitPriceMinor:Number(offer.unit_price_minor),awardedTotalMinor:Math.round(qty*Number(offer.unit_price_minor)),currency:normaliseCurrency(offer.currency,rfq.currency),leadTimeDays:offer.lead_time_days==null?null:Number(offer.lead_time_days),validUntil:offer.valid_until,notes:String(x.notes||'').trim().slice(0,1000) };
  });
  const byItemQty = new Map();
  for(const x of lines) byItemQty.set(x.rfqItemId,(byItemQty.get(x.rfqItemId)||0)+x.awardedQuantity);
  for(const [itemId,total] of byItemQty){const req=requestedByItem.get(itemId);if(total>Number(req.quantity)+1e-9)throw Object.assign(new Error(`Total award quantity exceeds requested quantity for item ${itemId}`),{statusCode:409,code:'AWARD_QUANTITY_EXCEEDS_DEMAND'});}
  const currency=normaliseCurrency(input.currency,rfq.currency); if(currency!==normaliseCurrency(rfq.currency,currency)) throw Object.assign(new Error('Award currency must match RFQ currency'),{statusCode:409,code:'CURRENCY_MISMATCH'});
  const notes=String(input.notes||'').trim().slice(0,4000); const idempotencyKey=input.idempotencyKey??input.idempotency_key??null; const hash=procurementAwardHash({demandId,rfqId,comparisonId,currency,notes,lines});
  if(idempotencyKey){const old=db.prepare('SELECT * FROM procurement_awards WHERE organization_id=? AND idempotency_key=?').get(organizationId,String(idempotencyKey));if(old){if(old.request_hash!==hash)throw Object.assign(new Error('Idempotency key was already used with a different award payload'),{statusCode:409,code:'IDEMPOTENCY_KEY_REUSED'});return getProcurementAwardById(organizationId,old.id);}}
  const existing=db.prepare(`SELECT id,status FROM procurement_awards WHERE organization_id=? AND comparison_id=? AND status IN ('DRAFT','CONFIRMED') ORDER BY created_at DESC LIMIT 1`).get(organizationId,comparisonId); if(existing) throw Object.assign(new Error('An active award already exists for this comparison'),{statusCode:409,code:'AWARD_ALREADY_EXISTS'});
  const id=String(input.id||crypto.randomUUID()); const awardNumber=String(input.awardNumber??input.award_number??`AWD-${new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14)}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`).trim(); const now=nowIso();
  db.exec('BEGIN IMMEDIATE'); try {
    db.prepare(`INSERT INTO procurement_awards(id,organization_id,demand_id,rfq_id,comparison_id,status,currency,award_number,notes,idempotency_key,request_hash,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,'DRAFT',?,?,?,?,?,?,?,?)`).run(id,organizationId,demandId,rfqId,comparisonId,currency,awardNumber,notes,idempotencyKey,hash,actorId,now,now);
    const ins=db.prepare(`INSERT INTO procurement_award_lines(id,award_id,rfq_item_id,supplier_organization_id,response_id,comparison_line_offer_id,awarded_quantity,unit_price_minor,awarded_total_minor,currency,lead_time_days,valid_until,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    for(const x of lines) ins.run(crypto.randomUUID(),id,x.rfqItemId,x.supplierOrganizationId,x.responseId,x.comparisonLineOfferId,x.awardedQuantity,x.unitPriceMinor,x.awardedTotalMinor,x.currency,x.leadTimeDays,x.validUntil,x.notes,now);
    audit(chatId,'procurement.award.created','procurement_award',id,{demandId,rfqId,comparisonId,lineCount:lines.length},{organizationId,actorId});
    db.exec('COMMIT');
  } catch(e){db.exec('ROLLBACK');throw e;}
  return getProcurementAwardById(organizationId,id);
}

export async function transitionProcurementAward(chatId, awardId, targetStatus, actor = null, reason = '') {
  ensureDatabase(); const organizationId=await tenantOrganizationId(chatId); const actorId=assertProcurementActor(organizationId,actor); const target=String(targetStatus||'').toUpperCase();
  if(!Object.hasOwn(PROCUREMENT_AWARD_STATES,target)) throw Object.assign(new Error('Invalid award status'),{statusCode:400,code:'INVALID_AWARD_STATUS'});
  const row=db.prepare('SELECT * FROM procurement_awards WHERE id=? AND organization_id=?').get(String(awardId),organizationId); if(!row) throw Object.assign(new Error('Procurement award not found'),{statusCode:404,code:'AWARD_NOT_FOUND'});
  if(!PROCUREMENT_AWARD_STATES[row.status]?.includes(target)) throw Object.assign(new Error(`Illegal award transition: ${row.status} -> ${target}`),{statusCode:409,code:'INVALID_AWARD_TRANSITION'});
  const lines=db.prepare('SELECT * FROM procurement_award_lines WHERE award_id=?').all(row.id); if(target==='CONFIRMED'&&!lines.length) throw Object.assign(new Error('Award must contain at least one line'),{statusCode:409,code:'AWARD_LINES_REQUIRED'});
  const now=nowIso(); db.exec('BEGIN IMMEDIATE'); try {
    db.prepare(`UPDATE procurement_awards SET status=?,confirmed_by_user_id=CASE WHEN ?='CONFIRMED' THEN ? ELSE confirmed_by_user_id END,confirmed_at=CASE WHEN ?='CONFIRMED' THEN ? ELSE confirmed_at END,cancelled_at=CASE WHEN ?='CANCELLED' THEN ? ELSE cancelled_at END,updated_at=?,version=version+1 WHERE id=? AND organization_id=?`).run(target,target,actorId,target,now,target,now,now,awardId,organizationId);
    if(target==='CONFIRMED') db.prepare(`UPDATE procurement_demands SET status='AWARDED',updated_by_user_id=?,updated_at=?,version=version+1 WHERE id=? AND organization_id=? AND status='SOURCING'`).run(actorId,now,row.demand_id,organizationId);
    audit(chatId,`procurement.award.${target.toLowerCase()}`,'procurement_award',awardId,{demandId:row.demand_id,rfqId:row.rfq_id,comparisonId:row.comparison_id,fromStatus:row.status,toStatus:target,reason:String(reason||'').slice(0,1000)},{organizationId,actorId});
    db.exec('COMMIT');
  } catch(e){db.exec('ROLLBACK');throw e;}
  return getProcurementAwardById(organizationId,awardId);
}

function customerPricingFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    customerId: row.customer_id,
    productId: row.product_id,
    priceMinor: Number(row.price_minor),
    currency: normaliseCurrency(row.currency, 'ETB'),
    status: row.status,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    reason: row.reason || '',
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertBusinessCustomer(organizationId, customerId) {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND organization_id = ?').get(String(customerId), String(organizationId));
  if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404, code: 'CUSTOMER_NOT_FOUND' });
  if (String(customer.customer_type || 'retail').toLowerCase() !== 'business') {
    throw Object.assign(new Error('Custom pricing requires a business customer'), { statusCode: 409, code: 'B2B_CUSTOMER_REQUIRED' });
  }
  return customer;
}

function assertCatalogProductForOrganization(chatId, productId, organizationId) {
  const row = db.prepare(`
    SELECT cp.* FROM catalog_products cp
    JOIN tenants t ON t.chat_id = cp.chat_id
    WHERE cp.chat_id = ? AND cp.product_id = ? AND t.organization_id = ?
  `).get(String(chatId), String(productId), String(organizationId));
  if (!row) throw Object.assign(new Error('Product not found'), { statusCode: 404, code: 'PRODUCT_NOT_FOUND' });
  return row;
}

export async function listCustomerPricing(chatId, customerId = '', productId = '', status = 'all', limit = 100) {
  const organizationId = await tenantOrganizationId(chatId);
  const params = [organizationId];
  const where = ['organization_id = ?'];
  if (customerId) { where.push('customer_id = ?'); params.push(String(customerId)); }
  if (productId) { where.push('product_id = ?'); params.push(String(productId)); }
  if (status && status !== 'all') { where.push('status = ?'); params.push(String(status)); }
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100));
  params.push(safeLimit);
  return db.prepare(`SELECT * FROM customer_pricing_rules WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT ?`).all(...params).map(customerPricingFromRow);
}

export async function getCustomerPricing(chatId, pricingId) {
  const organizationId = await tenantOrganizationId(chatId);
  return customerPricingFromRow(db.prepare('SELECT * FROM customer_pricing_rules WHERE id = ? AND organization_id = ?').get(String(pricingId), organizationId));
}

export async function upsertCustomerPricing(chatId, input = {}, actor = null) {
  const organizationId = await tenantOrganizationId(chatId);
  const customerId = String(input.customerId ?? input.customer_id ?? '').trim();
  const productId = String(input.productId ?? input.product_id ?? '').trim();
  const priceMinor = Number(input.priceMinor ?? input.price_minor);
  if (!customerId || !productId || !Number.isInteger(priceMinor) || priceMinor < 0) {
    throw Object.assign(new Error('customerId, productId and non-negative integer priceMinor are required'), { statusCode: 400, code: 'INVALID_CUSTOM_PRICING' });
  }
  assertBusinessCustomer(organizationId, customerId);
  const product = assertCatalogProductForOrganization(chatId, productId, organizationId);
  const currency = normaliseCurrency(input.currency, product.currency || tenantCurrency(chatId));
  if (currency !== normaliseCurrency(product.currency, tenantCurrency(chatId))) {
    throw Object.assign(new Error('Custom price currency must match the product currency'), { statusCode: 409, code: 'CURRENCY_MISMATCH' });
  }
  const id = String(input.id || crypto.randomUUID());
  const now = nowIso();
  db.prepare(`
    INSERT INTO customer_pricing_rules
      (id, organization_id, customer_id, product_id, price_minor, currency, status, effective_from, effective_to, reason, created_by_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(organization_id, customer_id, product_id) DO UPDATE SET
      price_minor = excluded.price_minor,
      currency = excluded.currency,
      status = excluded.status,
      effective_from = excluded.effective_from,
      effective_to = excluded.effective_to,
      reason = excluded.reason,
      created_by_user_id = excluded.created_by_user_id,
      updated_at = excluded.updated_at
  `).run(id, organizationId, customerId, productId, priceMinor, currency,
    ['active','inactive'].includes(String(input.status)) ? String(input.status) : 'active',
    input.effectiveFrom ?? input.effective_from ?? null,
    input.effectiveTo ?? input.effective_to ?? null,
    String(input.reason || ''), actor?.userId || null, now, now);
  audit(String(chatId), 'b2b.custom-pricing.upserted', 'customer_pricing_rule', id,
    { customerId, productId, priceMinor, currency },
    { organizationId, actorId: actor?.userId || null, reason: input.reason || '' });
  return getCustomerPricing(chatId, id);
}

export async function updateCustomerPricing(chatId, pricingId, input = {}, actor = null) {
  const current = await getCustomerPricing(chatId, pricingId);
  if (!current) throw Object.assign(new Error('Custom pricing rule not found'), { statusCode: 404, code: 'CUSTOM_PRICING_NOT_FOUND' });
  return upsertCustomerPricing(chatId, { ...input, id: current.id, customerId: current.customerId, productId: current.productId }, actor);
}

function quoteFromRow(row, items = []) {
  if (!row) return null;
  return {
    id: row.id, organizationId: row.organization_id, customerId: row.customer_id,
    quoteNumber: row.quote_number, currency: normaliseCurrency(row.currency, 'ETB'),
    status: row.status, subtotalMinor: Number(row.subtotal_minor), totalMinor: Number(row.total_minor),
    validUntil: row.valid_until, notes: row.notes || '', terms: row.terms || '',
    createdByUserId: row.created_by_user_id, sentAt: row.sent_at, acceptedAt: row.accepted_at,
    rejectedAt: row.rejected_at, cancelledAt: row.cancelled_at, createdAt: row.created_at, updatedAt: row.updated_at,
    items: items.map(item => ({ id: item.id, quoteId: item.quote_id, productId: item.product_id,
      description: item.description || '', quantity: Number(item.quantity), unitPriceMinor: Number(item.unit_price_minor),
      currency: normaliseCurrency(item.currency, row.currency), lineTotalMinor: Number(item.line_total_minor), pricingRuleId: item.pricing_rule_id || null, createdAt: item.created_at }))
  };
}

function assertQuoteCustomer(organizationId, customerId) {
  return assertBusinessCustomer(organizationId, customerId);
}

function quoteItemsFromRow(quoteId) {
  return db.prepare('SELECT * FROM quote_items WHERE quote_id = ? ORDER BY rowid').all(String(quoteId));
}

function getQuoteByIdSync(organizationId, quoteId) {
  const row = db.prepare('SELECT * FROM quotes WHERE id = ? AND organization_id = ?').get(String(quoteId), String(organizationId));
  return row ? quoteFromRow(row, quoteItemsFromRow(row.id)) : null;
}

export async function getQuote(chatId, quoteId) {
  const organizationId = await tenantOrganizationId(chatId);
  return getQuoteByIdSync(organizationId, quoteId);
}

export async function listQuotes(chatId, { customerId = '', status = 'all', limit = 100 } = {}) {
  const organizationId = await tenantOrganizationId(chatId);
  const where = ['organization_id = ?']; const params = [organizationId];
  if (customerId) { where.push('customer_id = ?'); params.push(String(customerId)); }
  if (status && status !== 'all') { where.push('status = ?'); params.push(String(status).toUpperCase()); }
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100)); params.push(safeLimit);
  return db.prepare(`SELECT * FROM quotes WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`).all(...params)
    .map(row => quoteFromRow(row, quoteItemsFromRow(row.id)));
}

function nextQuoteNumber(organizationId) {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM quotes WHERE organization_id = ?`).get(String(organizationId));
  return `Q-${String(Number(row?.count || 0) + 1).padStart(6, '0')}`;
}

export async function createQuote(chatId, input = {}, actor = null) {
  const organizationId = await tenantOrganizationId(chatId);
  const customerId = String(input.customerId ?? input.customer_id ?? '').trim();
  if (!customerId) throw Object.assign(new Error('customerId is required'), { statusCode: 400, code: 'QUOTE_CUSTOMER_REQUIRED' });
  assertQuoteCustomer(organizationId, customerId);
  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (!rawItems.length) throw Object.assign(new Error('At least one quote item is required'), { statusCode: 400, code: 'QUOTE_ITEMS_REQUIRED' });
  const currency = tenantCurrency(chatId);
  const items = [];
  for (const raw of rawItems) {
    const productId = String(raw.productId ?? raw.product_id ?? '').trim();
    const quantity = Number(raw.quantity ?? raw.qty);
    if (!productId || !Number.isInteger(quantity) || quantity <= 0) throw Object.assign(new Error('Quote items require productId and positive integer quantity'), { statusCode: 400, code: 'INVALID_QUOTE_ITEM' });
    const product = assertCatalogProductForOrganization(chatId, productId, organizationId);
    const productCurrency = normaliseCurrency(product.currency, currency);
    if (productCurrency !== currency) throw Object.assign(new Error('Quote item currency must match tenant currency'), { statusCode: 409, code: 'CURRENCY_MISMATCH' });
    let unitPriceMinor = Number(raw.unitPriceMinor ?? raw.unit_price_minor);
    let pricingRuleId = null;
    if (!Number.isInteger(unitPriceMinor) || unitPriceMinor < 0) {
      const rule = db.prepare(`SELECT * FROM customer_pricing_rules WHERE organization_id = ? AND customer_id = ? AND product_id = ? AND status = 'active' LIMIT 1`).get(organizationId, customerId, productId);
      unitPriceMinor = rule ? Number(rule.price_minor) : Number(product.price_minor);
      pricingRuleId = rule?.id || null;
    }
    if (!Number.isInteger(unitPriceMinor) || unitPriceMinor < 0) throw Object.assign(new Error('Quote unit price must be a non-negative integer minor amount'), { statusCode: 400, code: 'INVALID_QUOTE_PRICE' });
    items.push({ id: crypto.randomUUID(), productId, description: String(raw.description ?? parseJSON(product.product_json, {}).name ?? productId), quantity, unitPriceMinor, currency, lineTotalMinor: quantity * unitPriceMinor, pricingRuleId });
  }
  const subtotalMinor = items.reduce((sum, item) => sum + item.lineTotalMinor, 0);
  const totalMinor = subtotalMinor;
  const id = String(input.id || crypto.randomUUID());
  const quoteNumber = String(input.quoteNumber ?? input.quote_number ?? '').trim() || nextQuoteNumber(organizationId);
  const now = nowIso();
  const status = String(input.status || 'DRAFT').toUpperCase();
  if (status !== 'DRAFT') throw Object.assign(new Error('New quotes must start in DRAFT state'), { statusCode: 409, code: 'INVALID_QUOTE_STATE' });
  db.exec('BEGIN');
  try {
    db.prepare(`INSERT INTO quotes (id, organization_id, customer_id, quote_number, currency, status, subtotal_minor, total_minor, valid_until, notes, terms, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, organizationId, customerId, quoteNumber, currency, subtotalMinor, totalMinor, input.validUntil ?? input.valid_until ?? null, String(input.notes || ''), String(input.terms || ''), actor?.userId || null, now, now);
    const stmt = db.prepare(`INSERT INTO quote_items (id, quote_id, product_id, description, quantity, unit_price_minor, currency, line_total_minor, pricing_rule_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const item of items) stmt.run(item.id, id, item.productId, item.description, item.quantity, item.unitPriceMinor, item.currency, item.lineTotalMinor, item.pricingRuleId, now);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  audit(String(chatId), 'b2b.quote.created', 'quote', id, { quoteNumber, customerId, totalMinor, currency }, { organizationId, actorId: actor?.userId || null });
  return getQuoteByIdSync(organizationId, id);
}

const QUOTE_TRANSITIONS = Object.freeze({ DRAFT: new Set(['SENT','CANCELLED']), SENT: new Set(['ACCEPTED','REJECTED','EXPIRED','CANCELLED']), ACCEPTED: new Set([]), REJECTED: new Set([]), EXPIRED: new Set([]), CANCELLED: new Set([]) });

export async function transitionQuote(chatId, quoteId, targetState, actor = null, reason = '') {
  const organizationId = await tenantOrganizationId(chatId);
  const current = getQuoteByIdSync(organizationId, quoteId);
  if (!current) throw Object.assign(new Error('Quote not found'), { statusCode: 404, code: 'QUOTE_NOT_FOUND' });
  const target = String(targetState || '').toUpperCase();
  if (!QUOTE_TRANSITIONS[current.status]?.has(target)) throw Object.assign(new Error(`Invalid quote transition ${current.status} -> ${target}`), { statusCode: 409, code: 'INVALID_QUOTE_TRANSITION' });
  const now = nowIso();
  const fields = ['status = ?', 'updated_at = ?']; const params = [target, now];
  if (target === 'SENT') { fields.push('sent_at = ?'); params.push(now); }
  if (target === 'ACCEPTED') { fields.push('accepted_at = ?'); params.push(now); }
  if (target === 'REJECTED') { fields.push('rejected_at = ?'); params.push(now); }
  if (target === 'CANCELLED') { fields.push('cancelled_at = ?'); params.push(now); }
  params.push(String(quoteId), organizationId);
  db.prepare(`UPDATE quotes SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`).run(...params);
  audit(String(chatId), 'b2b.quote.transitioned', 'quote', quoteId, { from: current.status, to: target, reason: String(reason || '') }, { organizationId, actorId: actor?.userId || null, reason: String(reason || '') });
  return getQuoteByIdSync(organizationId, quoteId);
}


function purchaseOrderFromRow(row, items = []) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    customerId: row.customer_id || null,
    quoteId: row.quote_id || null,
    procurementAwardId: row.procurement_award_id || null,
    supplierOrganizationId: row.supplier_organization_id || null,
    sourceType: row.source_type || 'B2B_QUOTE',
    poNumber: row.po_number,
    currency: normaliseCurrency(row.currency, 'ETB'),
    status: row.status,
    subtotalMinor: Number(row.subtotal_minor),
    totalMinor: Number(row.total_minor),
    buyerReference: row.buyer_reference || '',
    notes: row.notes || '',
    rejectionReason: row.rejection_reason || '',
    createdByUserId: row.created_by_user_id,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    approvedByUserId: row.approved_by_user_id,
    rejectedAt: row.rejected_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: items.map(item => ({
      id: item.id, purchaseOrderId: item.purchase_order_id, productId: item.product_id,
      description: item.description || '', quantity: Number(item.quantity),
      unitPriceMinor: Number(item.unit_price_minor), currency: normaliseCurrency(item.currency, row.currency),
      lineTotalMinor: Number(item.line_total_minor), quoteItemId: item.quote_item_id || null,
      createdAt: item.created_at,
    })),
  };
}

function purchaseOrderItemsFromRow(poId) {
  return db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY rowid').all(String(poId));
}

function getPurchaseOrderByIdSync(organizationId, poId) {
  const row = db.prepare('SELECT * FROM purchase_orders WHERE id = ? AND organization_id = ?').get(String(poId), String(organizationId));
  return row ? purchaseOrderFromRow(row, purchaseOrderItemsFromRow(row.id)) : null;
}

function nextPurchaseOrderNumber(organizationId) {
  const row = db.prepare('SELECT COUNT(*) AS count FROM purchase_orders WHERE organization_id = ?').get(String(organizationId));
  return `PO-${String(Number(row?.count || 0) + 1).padStart(6, '0')}`;
}

function creditTermsFromRow(row) {
  if (!row) return null;
  return {
    id: row.id, organizationId: row.organization_id, customerId: row.customer_id,
    currency: row.currency, creditLimitMinor: Number(row.credit_limit_minor),
    paymentDueDays: Number(row.payment_due_days), status: row.status,
    requiresPo: Boolean(row.requires_po), effectiveFrom: row.effective_from || null,
    effectiveTo: row.effective_to || null, notes: row.notes || '', reason: row.reason || '',
    createdByUserId: row.created_by_user_id || null, approvedByUserId: row.approved_by_user_id || null,
    approvedAt: row.approved_at || null, rejectedByUserId: row.rejected_by_user_id || null,
    rejectedAt: row.rejected_at || null, suspendedByUserId: row.suspended_by_user_id || null,
    suspendedAt: row.suspended_at || null, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function assertBusinessCustomerForCredit(organizationId, customerId) {
  const row = db.prepare('SELECT customer_type, status FROM customers WHERE id = ? AND organization_id = ?').get(String(customerId), String(organizationId));
  if (!row) throw Object.assign(new Error('Customer not found'), { statusCode: 404, code: 'CUSTOMER_NOT_FOUND' });
  if (String(row.customer_type).toLowerCase() !== 'business') {
    throw Object.assign(new Error('Credit terms require a business customer'), { statusCode: 409, code: 'B2B_CUSTOMER_REQUIRED' });
  }
  if (String(row.status).toLowerCase() !== 'active') {
    throw Object.assign(new Error('Customer is not active'), { statusCode: 409, code: 'CUSTOMER_INACTIVE' });
  }
}

export async function getCreditTerms(chatId, creditId) {
  const organizationId = await tenantOrganizationId(chatId);
  const row = db.prepare('SELECT * FROM customer_credit_terms WHERE id = ? AND organization_id = ?').get(String(creditId), organizationId);
  return creditTermsFromRow(row);
}

export async function listCreditTerms(chatId, { customerId = '', status = 'all', limit = 100 } = {}) {
  const organizationId = await tenantOrganizationId(chatId);
  const where = ['organization_id = ?'];
  const params = [organizationId];
  if (customerId) { where.push('customer_id = ?'); params.push(String(customerId)); }
  if (status && status !== 'all') { where.push('status = ?'); params.push(String(status).toUpperCase()); }
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
  return db.prepare(`SELECT * FROM customer_credit_terms WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT ?`).all(...params, safeLimit).map(creditTermsFromRow);
}

export async function createCreditTerms(chatId, input = {}, actor = null) {
  const organizationId = await tenantOrganizationId(chatId);
  const customerId = String(input.customerId ?? input.customer_id ?? '').trim();
  const creditLimitMinor = Number(input.creditLimitMinor ?? input.credit_limit_minor);
  const paymentDueDays = Number(input.paymentDueDays ?? input.payment_due_days ?? 0);
  if (!customerId || !Number.isInteger(creditLimitMinor) || creditLimitMinor < 0 || !Number.isInteger(paymentDueDays) || paymentDueDays < 0 || paymentDueDays > 365) {
    throw Object.assign(new Error('customerId, non-negative integer creditLimitMinor and paymentDueDays from 0 to 365 are required'), { statusCode: 400, code: 'INVALID_CREDIT_TERMS' });
  }
  assertBusinessCustomerForCredit(organizationId, customerId);
  const existing = db.prepare('SELECT id FROM customer_credit_terms WHERE organization_id = ? AND customer_id = ?').get(organizationId, customerId);
  if (existing) throw Object.assign(new Error('Credit terms already exist for this customer'), { statusCode: 409, code: 'CREDIT_TERMS_EXISTS' });
  const currency = normaliseCurrency(input.currency, tenantCurrency(chatId));
  if (currency !== tenantCurrency(chatId)) throw Object.assign(new Error('Credit terms currency must match the organization currency'), { statusCode: 409, code: 'CURRENCY_MISMATCH' });
  const id = String(input.id || crypto.randomUUID());
  const now = nowIso();
  db.prepare(`INSERT INTO customer_credit_terms
    (id, organization_id, customer_id, currency, credit_limit_minor, payment_due_days, status, requires_po, effective_from, effective_to, notes, reason, created_by_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, organizationId, customerId, currency, creditLimitMinor, paymentDueDays, input.requiresPo === false || input.requires_po === false ? 0 : 1,
    input.effectiveFrom ?? input.effective_from ?? null, input.effectiveTo ?? input.effective_to ?? null,
    String(input.notes || ''), String(input.reason || ''), actor?.userId || null, now, now
  );
  audit(String(chatId), 'b2b.credit-terms.created', 'customer_credit_terms', id, { customerId, creditLimitMinor, paymentDueDays, currency }, { organizationId, actorId: actor?.userId || null, reason: input.reason || '' });
  return getCreditTerms(chatId, id);
}

const CREDIT_TRANSITIONS = Object.freeze({
  PENDING: new Set(['APPROVED', 'REJECTED', 'CANCELLED']),
  APPROVED: new Set(['SUSPENDED', 'EXPIRED', 'CANCELLED']),
  SUSPENDED: new Set(['APPROVED', 'CANCELLED']),
  REJECTED: new Set([]),
  EXPIRED: new Set([]),
  CANCELLED: new Set([]),
});

export async function transitionCreditTerms(chatId, creditId, targetState, actor = null, reason = '') {
  const organizationId = await tenantOrganizationId(chatId);
  const current = await getCreditTerms(chatId, creditId);
  if (!current) throw Object.assign(new Error('Credit terms not found'), { statusCode: 404, code: 'CREDIT_TERMS_NOT_FOUND' });
  const target = String(targetState || '').trim().toUpperCase();
  if (!CREDIT_TRANSITIONS[current.status]?.has(target)) throw Object.assign(new Error(`Invalid credit terms transition ${current.status} -> ${target}`), { statusCode: 409, code: 'INVALID_CREDIT_TERMS_TRANSITION' });
  const now = nowIso();
  const fields = ['status = ?', 'updated_at = ?'];
  const params = [target, now];
  if (target === 'APPROVED') { fields.push('approved_by_user_id = ?', 'approved_at = ?'); params.push(actor?.userId || null, now); }
  if (target === 'REJECTED') { fields.push('rejected_by_user_id = ?', 'rejected_at = ?'); params.push(actor?.userId || null, now); }
  if (target === 'SUSPENDED') { fields.push('suspended_by_user_id = ?', 'suspended_at = ?'); params.push(actor?.userId || null, now); }
  params.push(String(creditId), organizationId);
  db.prepare(`UPDATE customer_credit_terms SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`).run(...params);
  audit(String(chatId), 'b2b.credit-terms.transitioned', 'customer_credit_terms', creditId, { from: current.status, to: target, reason: String(reason || '') }, { organizationId, actorId: actor?.userId || null, reason: String(reason || '') });
  return getCreditTerms(chatId, creditId);
}

export async function updateCreditTerms(chatId, creditId, input = {}, actor = null) {
  const current = await getCreditTerms(chatId, creditId);
  if (!current) throw Object.assign(new Error('Credit terms not found'), { statusCode: 404, code: 'CREDIT_TERMS_NOT_FOUND' });
  if (current.status !== 'PENDING') throw Object.assign(new Error('Only pending credit terms can be edited'), { statusCode: 409, code: 'CREDIT_TERMS_IMMUTABLE' });
  const organizationId = await tenantOrganizationId(chatId);
  const creditLimitMinor = input.creditLimitMinor == null && input.credit_limit_minor == null ? current.creditLimitMinor : Number(input.creditLimitMinor ?? input.credit_limit_minor);
  const paymentDueDays = input.paymentDueDays == null && input.payment_due_days == null ? current.paymentDueDays : Number(input.paymentDueDays ?? input.payment_due_days);
  if (!Number.isInteger(creditLimitMinor) || creditLimitMinor < 0 || !Number.isInteger(paymentDueDays) || paymentDueDays < 0 || paymentDueDays > 365) throw Object.assign(new Error('Invalid credit limit or payment due days'), { statusCode: 400, code: 'INVALID_CREDIT_TERMS' });
  const currency = normaliseCurrency(input.currency, current.currency);
  if (currency !== tenantCurrency(chatId)) throw Object.assign(new Error('Credit terms currency must match the organization currency'), { statusCode: 409, code: 'CURRENCY_MISMATCH' });
  const now = nowIso();
  db.prepare(`UPDATE customer_credit_terms SET currency = ?, credit_limit_minor = ?, payment_due_days = ?, requires_po = ?, effective_from = ?, effective_to = ?, notes = ?, reason = ?, updated_at = ? WHERE id = ? AND organization_id = ?`).run(
    currency, creditLimitMinor, paymentDueDays, input.requiresPo == null && input.requires_po == null ? (current.requiresPo ? 1 : 0) : (input.requiresPo === false || input.requires_po === false ? 0 : 1),
    input.effectiveFrom ?? input.effective_from ?? current.effectiveFrom, input.effectiveTo ?? input.effective_to ?? current.effectiveTo, String(input.notes ?? current.notes), String(input.reason ?? current.reason), now, String(creditId), organizationId
  );
  audit(String(chatId), 'b2b.credit-terms.updated', 'customer_credit_terms', creditId, { creditLimitMinor, paymentDueDays, currency }, { organizationId, actorId: actor?.userId || null, reason: input.reason || '' });
  return getCreditTerms(chatId, creditId);
}

export async function getPurchaseOrder(chatId, poId) {
  const organizationId = await tenantOrganizationId(chatId);
  return getPurchaseOrderByIdSync(organizationId, poId);
}

export async function listPurchaseOrders(chatId, { customerId = '', status = 'all', limit = 100 } = {}) {
  const organizationId = await tenantOrganizationId(chatId);
  const where = ['organization_id = ?']; const params = [organizationId];
  if (customerId) { where.push('customer_id = ?'); params.push(String(customerId)); }
  if (status && status !== 'all') { where.push('status = ?'); params.push(String(status).toUpperCase()); }
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100)); params.push(safeLimit);
  return db.prepare(`SELECT * FROM purchase_orders WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`).all(...params)
    .map(row => purchaseOrderFromRow(row, purchaseOrderItemsFromRow(row.id)));
}

export async function createPurchaseOrder(chatId, input = {}, actor = null) {
  const organizationId = await tenantOrganizationId(chatId);
  const sourceType = String(input.sourceType ?? input.source_type ?? 'B2B_QUOTE').trim().toUpperCase();
  if (sourceType === 'PROCUREMENT_AWARD') {
    return createPurchaseOrderFromProcurementAward(chatId, input, actor);
  }
  const quoteId = String(input.quoteId ?? input.quote_id ?? '').trim();
  if (!quoteId) throw Object.assign(new Error('quoteId is required'), { statusCode: 400, code: 'PO_QUOTE_REQUIRED' });
  const quote = getQuoteByIdSync(organizationId, quoteId);
  if (!quote) throw Object.assign(new Error('Quote not found'), { statusCode: 404, code: 'QUOTE_NOT_FOUND' });
  if (quote.status !== 'ACCEPTED') throw Object.assign(new Error('Only accepted quotes can become purchase orders'), { statusCode: 409, code: 'QUOTE_NOT_ACCEPTED' });
  const existing = db.prepare('SELECT id FROM purchase_orders WHERE organization_id = ? AND quote_id = ?').get(organizationId, quoteId);
  if (existing) throw Object.assign(new Error('A purchase order already exists for this quote'), { statusCode: 409, code: 'PO_ALREADY_EXISTS' });
  const buyerReference = String(input.buyerReference ?? input.buyer_reference ?? '').trim();
  const id = String(input.id || crypto.randomUUID());
  const poNumber = String(input.poNumber ?? input.po_number ?? '').trim() || nextPurchaseOrderNumber(organizationId);
  const now = nowIso();
  db.exec('BEGIN');
  try {
    db.prepare(`INSERT INTO purchase_orders (id, organization_id, customer_id, quote_id, procurement_award_id, supplier_organization_id, source_type, po_number, currency, status, subtotal_minor, total_minor, buyer_reference, notes, rejection_reason, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, 'B2B_QUOTE', ?, ?, 'DRAFT', ?, ?, ?, ?, '', ?, ?, ?)`).run(
      id, organizationId, quote.customerId, quote.id, poNumber, quote.currency, quote.subtotalMinor, quote.totalMinor,
      buyerReference, String(input.notes || ''), actor?.userId || null, now, now
    );
    const stmt = db.prepare(`INSERT INTO purchase_order_items (id, purchase_order_id, product_id, description, quantity, unit_price_minor, currency, line_total_minor, quote_item_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const item of quote.items) stmt.run(crypto.randomUUID(), id, item.productId, item.description, item.quantity, item.unitPriceMinor, item.currency, item.lineTotalMinor, item.id, now);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  audit(String(chatId), 'b2b.purchase-order.created', 'purchase_order', id, { poNumber, quoteId, customerId: quote.customerId, totalMinor: quote.totalMinor, currency: quote.currency, sourceType: 'B2B_QUOTE' }, { organizationId, actorId: actor?.userId || null });
  return getPurchaseOrderByIdSync(organizationId, id);
}


function procurementReceiptFromRow(row, lines = []) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    purchaseOrderId: row.purchase_order_id,
    locationId: row.location_id,
    receiptNumber: row.receipt_number,
    status: row.status,
    receivedAt: row.received_at,
    notes: row.notes,
    createdByUserId: row.created_by_user_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cancelledAt: row.cancelled_at || null,
    lines,
  };
}

function procurementReceiptLineFromRow(row) {
  return {
    id: row.id,
    receiptId: row.receipt_id,
    purchaseOrderItemId: row.purchase_order_item_id,
    productId: row.product_id,
    receivedQuantity: Number(row.received_quantity),
    notes: row.notes,
    eventId: row.event_id,
    createdAt: row.created_at,
  };
}

function nextProcurementReceiptNumber(organizationId) {
  const row = db.prepare("SELECT COUNT(*) AS count FROM procurement_receipts WHERE organization_id = ?").get(String(organizationId));
  return `PR-${String(Number(row?.count || 0) + 1).padStart(6, '0')}`;
}

function getProcurementReceiptByIdSync(organizationId, receiptId) {
  const row = db.prepare('SELECT * FROM procurement_receipts WHERE id = ? AND organization_id = ?').get(String(receiptId), String(organizationId));
  if (!row) return null;
  const lines = db.prepare('SELECT * FROM procurement_receipt_lines WHERE receipt_id = ? ORDER BY created_at, id').all(row.id).map(procurementReceiptLineFromRow);
  return procurementReceiptFromRow(row, lines);
}

function procurementReceiptHash(input) {
  return crypto.createHash('sha256').update(JSON.stringify(input, Object.keys(input).sort())).digest('hex');
}

export async function getProcurementReceipt(chatId, receiptId, actor = null) {
  const organizationId = await tenantOrganizationId(chatId);
  assertProcurementActor(organizationId, actor);
  return getProcurementReceiptByIdSync(organizationId, receiptId);
}

export async function listProcurementReceipts(chatId, { purchaseOrderId = '', status = 'all', limit = 100 } = {}, actor = null) {
  const organizationId = await tenantOrganizationId(chatId);
  assertProcurementActor(organizationId, actor);
  const where = ['organization_id = ?'];
  const params = [organizationId];
  if (purchaseOrderId) { where.push('purchase_order_id = ?'); params.push(String(purchaseOrderId)); }
  if (status && String(status).toLowerCase() !== 'all') { where.push('status = ?'); params.push(String(status).toUpperCase()); }
  const n = Math.min(200, Math.max(1, Number(limit) || 100));
  return db.prepare(`SELECT * FROM procurement_receipts WHERE ${where.join(' AND ')} ORDER BY received_at DESC, created_at DESC LIMIT ?`).all(...params, n).map(row => getProcurementReceiptByIdSync(organizationId, row.id));
}

export async function createProcurementReceipt(chatId, purchaseOrderId, input = {}, actor = null) {
  const organizationId = await tenantOrganizationId(chatId);
  const actorId = assertProcurementActor(organizationId, actor);
  const po = db.prepare('SELECT * FROM purchase_orders WHERE id = ? AND organization_id = ?').get(String(purchaseOrderId), organizationId);
  if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404, code: 'PO_NOT_FOUND' });
  if (po.source_type !== 'PROCUREMENT_AWARD') throw Object.assign(new Error('Only procurement-origin purchase orders can use procurement receiving'), { statusCode: 409, code: 'PROCUREMENT_RECEIPT_SOURCE_REQUIRED' });
  if (po.status !== 'APPROVED') throw Object.assign(new Error('Only approved procurement purchase orders can be received'), { statusCode: 409, code: 'PO_NOT_APPROVED' });

  const locationId = String(input.locationId ?? input.location_id ?? '').trim();
  if (!locationId) throw Object.assign(new Error('locationId is required for procurement receiving'), { statusCode: 400, code: 'RECEIPT_LOCATION_REQUIRED' });
  const location = db.prepare("SELECT id FROM locations WHERE id = ? AND organization_id = ? AND status = 'active'").get(locationId, organizationId);
  if (!location) throw Object.assign(new Error('Receiving location does not belong to this organization'), { statusCode: 400, code: 'INVALID_RECEIVING_LOCATION' });

  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (!rawItems.length) throw Object.assign(new Error('At least one receipt item is required'), { statusCode: 400, code: 'RECEIPT_ITEMS_REQUIRED' });
  const poItems = db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY created_at, id').all(po.id);
  const allowed = new Map(poItems.map(x => [String(x.id), x]));
  const posted = db.prepare(`SELECT prl.purchase_order_item_id, SUM(prl.received_quantity) AS received_quantity
    FROM procurement_receipt_lines prl JOIN procurement_receipts pr ON pr.id=prl.receipt_id
    WHERE pr.purchase_order_id=? AND pr.status='POSTED' GROUP BY prl.purchase_order_item_id`).all(po.id);
  const receivedByItem = new Map(posted.map(x => [String(x.purchase_order_item_id), Number(x.received_quantity || 0)]));
  const seen = new Set();
  const items = rawItems.map((x, index) => {
    const itemId = String(x.purchaseOrderItemId ?? x.purchase_order_item_id ?? '').trim();
    const poItem = allowed.get(itemId);
    if (!poItem) throw Object.assign(new Error(`Receipt item ${index + 1} references a purchase-order item outside this order`), { statusCode: 400, code: 'INVALID_PO_ITEM' });
    if (seen.has(itemId)) throw Object.assign(new Error('Duplicate purchase-order receipt item'), { statusCode: 400, code: 'DUPLICATE_RECEIPT_ITEM' });
    seen.add(itemId);
    const quantity = Number(x.receivedQuantity ?? x.received_quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw Object.assign(new Error(`Receipt item ${index + 1} receivedQuantity must be a positive integer`), { statusCode: 400, code: 'INVALID_RECEIVED_QUANTITY' });
    const already = receivedByItem.get(itemId) || 0;
    const ordered = Number(poItem.quantity);
    if (already + quantity > ordered) throw Object.assign(new Error(`Receipt item ${index + 1} would exceed ordered quantity`), { statusCode: 409, code: 'OVER_RECEIPT' });
    const productId = String(poItem.product_id || '').trim();
    if (!productId) throw Object.assign(new Error('Procurement purchase-order items must reference catalog products before receiving'), { statusCode: 409, code: 'RECEIPT_PRODUCT_REQUIRED' });
    const product = db.prepare('SELECT product_id FROM catalog_products WHERE chat_id = ? AND product_id = ?').get(String(chatId), productId);
    if (!product) throw Object.assign(new Error('Purchase-order product is not present in the buyer catalog'), { statusCode: 409, code: 'RECEIPT_PRODUCT_NOT_FOUND' });
    return { purchaseOrderItemId: itemId, productId, receivedQuantity: quantity, notes: String(x.notes || '').trim().slice(0, 1000) };
  });

  const requestedReceivedAt = input.receivedAt ?? input.received_at ?? null;
  const receivedAt = String(requestedReceivedAt || nowIso());
  const notes = String(input.notes || '').trim().slice(0, 4000);
  const idempotencyKey = input.idempotencyKey ?? input.idempotency_key ?? null;
  const hash = procurementReceiptHash({ purchaseOrderId: po.id, locationId, receivedAt: requestedReceivedAt ? receivedAt : null, notes, items });
  if (idempotencyKey) {
    const old = db.prepare('SELECT * FROM procurement_receipts WHERE organization_id=? AND idempotency_key=?').get(organizationId, String(idempotencyKey));
    if (old) {
      if (old.request_hash !== hash) throw Object.assign(new Error('Idempotency key was already used with a different receipt payload'), { statusCode: 409, code: 'IDEMPOTENCY_KEY_REUSED' });
      if (old.status === 'POSTED') return getProcurementReceiptByIdSync(organizationId, old.id);
    }
  }

  const receiptId = String(input.id || crypto.randomUUID());
  const receiptNumber = String(input.receiptNumber ?? input.receipt_number ?? '').trim() || nextProcurementReceiptNumber(organizationId);
  const createdAt = nowIso();
  const eventIds = items.map(item => `procurement_receipt:${receiptId}:${item.purchaseOrderItemId}`);

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO procurement_receipts(id,organization_id,purchase_order_id,location_id,receipt_number,status,received_at,notes,idempotency_key,request_hash,created_by_user_id,created_at,updated_at) VALUES(?,?,?,?,?,'PENDING',?,?,?,?,?,?,?)`)
      .run(receiptId, organizationId, po.id, locationId, receiptNumber, receivedAt, notes, idempotencyKey, hash, actorId, createdAt, createdAt);
    const insertLine = db.prepare(`INSERT INTO procurement_receipt_lines(id,receipt_id,purchase_order_item_id,product_id,received_quantity,notes,event_id,created_at) VALUES(?,?,?,?,?,?,?,?)`);
    for (let i=0; i<items.length; i += 1) {
      const item = items[i];
      insertLine.run(crypto.randomUUID(), receiptId, item.purchaseOrderItemId, item.productId, item.receivedQuantity, item.notes, eventIds[i], createdAt);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }

  // Physical stock boundary: delegate each posted receipt line to the same
  // canonical inventory movement authority used by Warehouse Receiving.
  // The deterministic event id makes retries idempotent at the ledger boundary.
  try {
    for (let i=0; i<items.length; i += 1) {
      await appendInventoryMovement(chatId, {
        productId: items[i].productId,
        locationId,
        quantity: items[i].receivedQuantity,
        movementType: 'PURCHASE',
        referenceType: 'procurement_receipt',
        referenceId: receiptId,
        eventId: eventIds[i],
        occurredAt: receivedAt,
        reason: 'Procurement purchase-order receipt',
        metadata: { purchaseOrderId: po.id, purchaseOrderItemId: items[i].purchaseOrderItemId, receiptNumber },
      }, actor);
    }
  } catch (error) {
    audit(chatId, 'procurement.receipt.inventory_pending', 'procurement_receipt', receiptId, { purchaseOrderId: po.id, errorCode: error?.code || 'INVENTORY_SYNC_FAILED' }, { organizationId, actorId, locationId });
    throw error;
  }

  db.prepare("UPDATE procurement_receipts SET status='POSTED',updated_at=? WHERE id=? AND organization_id=? AND status='PENDING'").run(nowIso(), receiptId, organizationId);
  audit(chatId, 'procurement.receipt.posted', 'procurement_receipt', receiptId, { purchaseOrderId: po.id, receiptNumber, lineCount: items.length, locationId }, { organizationId, actorId, locationId });
  return getProcurementReceiptByIdSync(organizationId, receiptId);
}

export async function createPurchaseOrderFromProcurementAward(chatId, input = {}, actor = null) {
  const organizationId = await tenantOrganizationId(chatId);
  const actorId = assertProcurementActor(organizationId, actor);
  const awardId = String(input.procurementAwardId ?? input.procurement_award_id ?? input.awardId ?? input.award_id ?? '').trim();
  if (!awardId) throw Object.assign(new Error('procurementAwardId is required'), { statusCode: 400, code: 'PO_AWARD_REQUIRED' });
  const award = db.prepare('SELECT * FROM procurement_awards WHERE id = ? AND organization_id = ?').get(awardId, organizationId);
  if (!award) throw Object.assign(new Error('Procurement award not found'), { statusCode: 404, code: 'AWARD_NOT_FOUND' });
  if (award.status !== 'CONFIRMED') throw Object.assign(new Error('Only confirmed procurement awards can become purchase orders'), { statusCode: 409, code: 'AWARD_NOT_CONFIRMED' });
  const allLines = db.prepare(`SELECT al.*, rfi.product_id, rfi.description AS rfq_description, rfi.unit AS rfq_unit
    FROM procurement_award_lines al JOIN procurement_rfq_items rfi ON rfi.id = al.rfq_item_id
    WHERE al.award_id = ? ORDER BY al.rfq_item_id, al.supplier_organization_id`).all(awardId);
  if (!allLines.length) throw Object.assign(new Error('Confirmed procurement award has no lines'), { statusCode: 409, code: 'AWARD_LINES_REQUIRED' });
  const supplierIds = [...new Set(allLines.map(x => String(x.supplier_organization_id)))];
  const requestedSupplier = String(input.supplierOrganizationId ?? input.supplier_organization_id ?? '').trim();
  if (supplierIds.length > 1 && !requestedSupplier) throw Object.assign(new Error('Split awards require supplierOrganizationId to create one purchase order per supplier'), { statusCode: 409, code: 'SPLIT_AWARD_REQUIRES_SEPARATE_POS' });
  const supplierOrganizationId = requestedSupplier || supplierIds[0];
  if (!supplierIds.includes(supplierOrganizationId)) throw Object.assign(new Error('Supplier is not present on the confirmed procurement award'), { statusCode: 409, code: 'SUPPLIER_NOT_AWARDED' });
  const existing = db.prepare('SELECT id FROM purchase_orders WHERE organization_id = ? AND procurement_award_id = ? AND supplier_organization_id = ?').get(organizationId, awardId, supplierOrganizationId);
  if (existing) throw Object.assign(new Error('A purchase order already exists for this procurement award and supplier'), { statusCode: 409, code: 'PO_ALREADY_EXISTS' });
  const lines = allLines.filter(x => String(x.supplier_organization_id) === supplierOrganizationId);
  if (supplierOrganizationId === organizationId) throw Object.assign(new Error('Procurement purchase-order supplier must differ from buyer organization'), { statusCode: 409, code: 'SUPPLIER_SELF_REFERENCE' });
  const bad = lines.find(x => !String(x.product_id || '').trim() || !Number.isInteger(Number(x.awarded_quantity)) || Number(x.awarded_quantity) <= 0);
  if (bad) throw Object.assign(new Error('Procurement award lines must reference catalog products and use positive integer quantities before PO execution'), { statusCode: 409, code: 'AWARD_NOT_PO_EXECUTABLE' });
  const currency = normaliseCurrency(award.currency, tenantCurrency(chatId));
  if (currency !== tenantCurrency(chatId)) throw Object.assign(new Error('Procurement award currency must match the buyer organization currency'), { statusCode: 409, code: 'CURRENCY_MISMATCH' });
  const subtotalMinor = lines.reduce((sum, x) => sum + Number(x.awarded_total_minor), 0);
  const id = String(input.id || crypto.randomUUID());
  const poNumber = String(input.poNumber ?? input.po_number ?? '').trim() || nextPurchaseOrderNumber(organizationId);
  const buyerReference = String(input.buyerReference ?? input.buyer_reference ?? award.award_number).trim();
  const notes = String(input.notes || '').trim();
  const now = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO purchase_orders (id, organization_id, customer_id, quote_id, procurement_award_id, supplier_organization_id, source_type, po_number, currency, status, subtotal_minor, total_minor, buyer_reference, notes, rejection_reason, created_by_user_id, created_at, updated_at) VALUES (?, ?, NULL, NULL, ?, ?, 'PROCUREMENT_AWARD', ?, ?, 'DRAFT', ?, ?, ?, ?, '', ?, ?, ?)`).run(
      id, organizationId, awardId, supplierOrganizationId, poNumber, currency, subtotalMinor, subtotalMinor, buyerReference, notes, actorId, now, now
    );
    const stmt = db.prepare(`INSERT INTO purchase_order_items (id, purchase_order_id, product_id, description, quantity, unit_price_minor, currency, line_total_minor, quote_item_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`);
    for (const item of lines) stmt.run(crypto.randomUUID(), id, String(item.product_id), String(item.rfq_description || item.product_id), Number(item.awarded_quantity), Number(item.unit_price_minor), normaliseCurrency(item.currency, currency), Number(item.awarded_total_minor), now);
    audit(String(chatId), 'b2b.purchase-order.created', 'purchase_order', id, { poNumber, procurementAwardId: awardId, supplierOrganizationId, totalMinor: subtotalMinor, currency, sourceType: 'PROCUREMENT_AWARD' }, { organizationId, actorId });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return getPurchaseOrderByIdSync(organizationId, id);
}

const PURCHASE_ORDER_TRANSITIONS = Object.freeze({
  DRAFT: new Set(['SUBMITTED', 'CANCELLED']),
  SUBMITTED: new Set(['APPROVED', 'REJECTED', 'CANCELLED']),
  APPROVED: new Set([]),
  REJECTED: new Set([]),
  CANCELLED: new Set([]),
});

export async function transitionPurchaseOrder(chatId, poId, targetState, actor = null, reason = '') {
  const organizationId = await tenantOrganizationId(chatId);
  const current = getPurchaseOrderByIdSync(organizationId, poId);
  if (!current) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404, code: 'PO_NOT_FOUND' });
  const target = String(targetState || '').toUpperCase();
  if (!PURCHASE_ORDER_TRANSITIONS[current.status]?.has(target)) throw Object.assign(new Error(`Invalid purchase order transition ${current.status} -> ${target}`), { statusCode: 409, code: 'INVALID_PO_TRANSITION' });
  const now = nowIso();
  const fields = ['status = ?', 'updated_at = ?']; const params = [target, now];
  if (target === 'SUBMITTED') { fields.push('submitted_at = ?'); params.push(now); }
  if (target === 'APPROVED') { fields.push('approved_at = ?', 'approved_by_user_id = ?'); params.push(now, actor?.userId || null); }
  if (target === 'REJECTED') { fields.push('rejected_at = ?', 'rejection_reason = ?'); params.push(now, String(reason || '')); }
  if (target === 'CANCELLED') { fields.push('cancelled_at = ?'); params.push(now); }
  params.push(String(poId), organizationId);
  db.prepare(`UPDATE purchase_orders SET ${fields.join(', ')} WHERE id = ? AND organization_id = ?`).run(...params);
  audit(String(chatId), 'b2b.purchase-order.transitioned', 'purchase_order', poId, { from: current.status, to: target, reason: String(reason || '') }, { organizationId, actorId: actor?.userId || null, reason: String(reason || '') });
  return getPurchaseOrderByIdSync(organizationId, poId);
}

function receivableFromRow(row) {
  if (!row) return null;
  return {
    id: row.id, organizationId: row.organization_id, locationId: row.location_id || null,
    customerId: row.customer_id, creditTermsId: row.credit_terms_id || null,
    sourceType: row.source_type, sourceId: row.source_id, currency: normaliseCurrency(row.currency, 'ETB'),
    amountMinor: Number(row.amount_minor), outstandingMinor: Number(row.outstanding_minor),
    dueAt: row.due_at, status: row.status, notes: row.notes || '',
    createdByUserId: row.created_by_user_id || null, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function assertBusinessCustomerForReceivable(organizationId, customerId) {
  const customer = db.prepare('SELECT id, customer_type FROM customers WHERE id = ? AND organization_id = ?').get(String(customerId), String(organizationId));
  if (!customer) throw Object.assign(new Error('Customer does not belong to this organization'), { statusCode: 400, code: 'CUSTOMER_NOT_FOUND' });
  if (String(customer.customer_type || '').toLowerCase() !== 'business') throw Object.assign(new Error('Accounts receivable requires a business customer'), { statusCode: 409, code: 'B2B_CUSTOMER_REQUIRED' });
  return customer;
}

function addDaysIso(baseIso, days) {
  const d = new Date(baseIso);
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString();
}

export async function getReceivable(chatId, receivableId) {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  return receivableFromRow(db.prepare('SELECT * FROM accounts_receivable WHERE id = ? AND organization_id = ?').get(String(receivableId), organizationId));
}

export async function listReceivables(chatId, { customerId = '', status = 'all', limit = 100 } = {}) {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  const where = ['organization_id = ?']; const params = [organizationId];
  if (customerId) { where.push('customer_id = ?'); params.push(String(customerId)); }
  if (status && status !== 'all') { where.push('status = ?'); params.push(String(status).toUpperCase()); }
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100)); params.push(safeLimit);
  return db.prepare(`SELECT * FROM accounts_receivable WHERE ${where.join(' AND ')} ORDER BY due_at ASC, created_at DESC LIMIT ?`).all(...params).map(receivableFromRow);
}

export async function createReceivable(chatId, input = {}, actor = null) {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  const sourceType = String(input.sourceType || input.source_type || '').toLowerCase();
  const sourceId = String(input.sourceId || input.source_id || '');
  if (!['purchase_order', 'order'].includes(sourceType) || !sourceId) throw Object.assign(new Error('sourceType must be purchase_order or order and sourceId is required'), { statusCode: 400, code: 'INVALID_AR_SOURCE' });

  let customerId = null; let amountMinor = 0; let currency = tenantCurrency(chatId); let locationId = null; let creditTerms = null;
  if (sourceType === 'purchase_order') {
    const po = getPurchaseOrderByIdSync(organizationId, sourceId);
    if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404, code: 'PO_NOT_FOUND' });
    if (po.status !== 'APPROVED') throw Object.assign(new Error('Accounts receivable requires an approved purchase order'), { statusCode: 409, code: 'PO_NOT_APPROVED' });
    customerId = po.customerId; amountMinor = Number(po.totalMinor); currency = normaliseCurrency(po.currency, currency);
    creditTerms = db.prepare(`SELECT * FROM customer_credit_terms WHERE organization_id = ? AND customer_id = ? AND status = 'APPROVED' ORDER BY updated_at DESC LIMIT 1`).get(organizationId, customerId);
  } else {
    const order = db.prepare('SELECT * FROM orders WHERE chat_id = ? AND server_order_id = ?').get(String(chatId), sourceId);
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404, code: 'ORDER_NOT_FOUND' });
    customerId = order.customer_id || parseJSON(order.order_json, {}).customer_id || null; amountMinor = Number(order.total_minor); currency = normaliseCurrency(order.currency, currency);
    creditTerms = customerId ? db.prepare(`SELECT * FROM customer_credit_terms WHERE organization_id = ? AND customer_id = ? AND status = 'APPROVED' ORDER BY updated_at DESC LIMIT 1`).get(organizationId, customerId) : null;
  }
  if (!customerId) throw Object.assign(new Error('A business customer is required for receivables'), { statusCode: 409, code: 'B2B_CUSTOMER_REQUIRED' });
  assertBusinessCustomerForReceivable(organizationId, customerId);
  if (currency !== tenantCurrency(chatId)) throw Object.assign(new Error('Receivable currency must match the organization currency'), { statusCode: 409, code: 'CURRENCY_MISMATCH' });
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) throw Object.assign(new Error('Receivable amount must be a positive integer minor-unit amount'), { statusCode: 400, code: 'INVALID_AR_AMOUNT' });
  if (!creditTerms || creditTerms.currency !== currency) throw Object.assign(new Error('Approved credit terms are required before creating a receivable'), { statusCode: 409, code: 'CREDIT_TERMS_REQUIRED' });
  if (sourceType === 'order' && Number(creditTerms.requires_po) === 1) throw Object.assign(new Error('These credit terms require a purchase order before creating a receivable'), { statusCode: 409, code: 'PO_REQUIRED' });
  const existing = db.prepare('SELECT id FROM accounts_receivable WHERE organization_id = ? AND source_type = ? AND source_id = ?').get(organizationId, sourceType, sourceId);
  if (existing) throw Object.assign(new Error('A receivable already exists for this source'), { statusCode: 409, code: 'AR_EXISTS' });
  const open = db.prepare(`SELECT COALESCE(SUM(outstanding_minor),0) AS outstanding FROM accounts_receivable WHERE organization_id = ? AND customer_id = ? AND status IN ('OPEN','PARTIAL','OVERDUE')`).get(organizationId, customerId);
  if (Number(open.outstanding) + amountMinor > Number(creditTerms.credit_limit_minor)) throw Object.assign(new Error('Receivable would exceed the customer credit limit'), { statusCode: 409, code: 'CREDIT_LIMIT_EXCEEDED' });
  const now = nowIso(); const id = crypto.randomUUID(); const dueAt = input.dueAt || input.due_at || addDaysIso(now, Number(creditTerms.payment_due_days));
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO accounts_receivable (id, organization_id, location_id, customer_id, credit_terms_id, source_type, source_id, currency, amount_minor, outstanding_minor, due_at, status, notes, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?)`).run(
      id, organizationId, locationId, customerId, creditTerms.id, sourceType, sourceId, currency, amountMinor, amountMinor, String(dueAt), String(input.notes || ''), actor?.userId || null, now, now
    );
    db.prepare(`INSERT INTO ar_ledger_entries (id, receivable_id, organization_id, entry_type, amount_minor, currency, from_status, to_status, payment_id, actor_id, reason, metadata_json, created_at) VALUES (?, ?, ?, 'CHARGE', ?, ?, NULL, 'OPEN', NULL, ?, ?, ?, ?)`).run(
      crypto.randomUUID(), id, organizationId, amountMinor, currency, actor?.userId || null, String(input.reason || ''), json({ sourceType, sourceId }), now
    );
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  audit(String(chatId), 'b2b.receivable.created', 'accounts_receivable', id, { sourceType, sourceId, customerId, amountMinor, currency, dueAt }, { organizationId, actorId: actor?.userId || null, reason: input.reason || '' });
  return getReceivable(chatId, id);
}

const RECEIVABLE_TRANSITIONS = Object.freeze({
  OPEN: new Set(['PARTIAL','PAID','OVERDUE','WRITTEN_OFF','CANCELLED']),
  PARTIAL: new Set(['PAID','OVERDUE','WRITTEN_OFF','CANCELLED']),
  OVERDUE: new Set(['PARTIAL','PAID','WRITTEN_OFF','CANCELLED']),
  PAID: new Set([]), WRITTEN_OFF: new Set([]), CANCELLED: new Set([]),
});

export async function transitionReceivable(chatId, receivableId, targetState, actor = null, reason = '') {
  const current = await getReceivable(chatId, receivableId);
  if (!current) throw Object.assign(new Error('Receivable not found'), { statusCode: 404, code: 'AR_NOT_FOUND' });
  const target = String(targetState || '').toUpperCase();
  if (!RECEIVABLE_TRANSITIONS[current.status]?.has(target)) throw Object.assign(new Error(`Invalid receivable transition ${current.status} -> ${target}`), { statusCode: 409, code: 'INVALID_AR_TRANSITION' });
  const now = nowIso(); const organizationId = current.organizationId;
  db.prepare('UPDATE accounts_receivable SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?').run(target, now, current.id, organizationId);
  db.prepare(`INSERT INTO ar_ledger_entries (id, receivable_id, organization_id, entry_type, amount_minor, currency, from_status, to_status, payment_id, actor_id, reason, metadata_json, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL, ?, ?, ?, ?)`).run(
    crypto.randomUUID(), current.id, organizationId, target === 'WRITTEN_OFF' ? 'WRITE_OFF' : target === 'CANCELLED' ? 'CANCELLED' : 'ADJUSTMENT', current.currency, current.status, target, actor?.userId || null, String(reason || ''), json({}), now
  );
  audit(String(chatId), 'b2b.receivable.transitioned', 'accounts_receivable', current.id, { from: current.status, to: target, reason: String(reason || '') }, { organizationId, actorId: actor?.userId || null, reason });
  return getReceivable(chatId, current.id);
}

export async function allocatePaymentToReceivable(chatId, receivableId, input = {}, actor = null) {
  const receivable = await getReceivable(chatId, receivableId);
  if (!receivable) throw Object.assign(new Error('Receivable not found'), { statusCode: 404, code: 'AR_NOT_FOUND' });
  if (['PAID','WRITTEN_OFF','CANCELLED'].includes(receivable.status)) throw Object.assign(new Error('Receivable is not open for payment allocation'), { statusCode: 409, code: 'AR_CLOSED' });
  const paymentId = String(input.paymentId || input.payment_id || '');
  const payment = await getPayment(chatId, paymentId);
  if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
  if (!['VERIFIED','RECONCILED'].includes(payment.state)) throw Object.assign(new Error('Only verified or reconciled payments can be allocated to receivables'), { statusCode: 409, code: 'PAYMENT_NOT_VERIFIED' });
  if (payment.currency !== receivable.currency) throw Object.assign(new Error('Payment currency does not match receivable currency'), { statusCode: 409, code: 'CURRENCY_MISMATCH' });
  const amountMinor = Number(input.amountMinor ?? input.amount_minor ?? payment.amountMinor);
  if (!Number.isInteger(amountMinor) || amountMinor <= 0 || amountMinor > receivable.outstandingMinor) throw Object.assign(new Error('Allocation amount is invalid'), { statusCode: 400, code: 'INVALID_AR_ALLOCATION' });
  const already = db.prepare('SELECT COALESCE(SUM(amount_minor),0) AS allocated FROM ar_payment_allocations WHERE organization_id = ? AND payment_id = ?').get(receivable.organizationId, payment.id);
  if (Number(already.allocated) + amountMinor > payment.amountMinor) throw Object.assign(new Error('Payment allocation exceeds the payment amount'), { statusCode: 409, code: 'PAYMENT_OVERALLOCATED' });
  const now = nowIso(); const allocationId = crypto.randomUUID(); const nextOutstanding = receivable.outstandingMinor - amountMinor; const nextStatus = nextOutstanding === 0 ? 'PAID' : 'PARTIAL';
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO ar_payment_allocations (id, receivable_id, payment_id, organization_id, amount_minor, currency, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(allocationId, receivable.id, payment.id, receivable.organizationId, amountMinor, receivable.currency, actor?.userId || null, now);
    db.prepare('UPDATE accounts_receivable SET outstanding_minor = ?, status = ?, updated_at = ? WHERE id = ? AND organization_id = ?').run(nextOutstanding, nextStatus, now, receivable.id, receivable.organizationId);
    db.prepare(`INSERT INTO ar_ledger_entries (id, receivable_id, organization_id, entry_type, amount_minor, currency, from_status, to_status, payment_id, actor_id, reason, metadata_json, created_at) VALUES (?, ?, ?, 'PAYMENT', ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      crypto.randomUUID(), receivable.id, receivable.organizationId, amountMinor, receivable.currency, receivable.status, nextStatus, payment.id, actor?.userId || null, String(input.reason || ''), json({ allocationId }), now
    );
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  audit(String(chatId), 'b2b.receivable.payment-allocated', 'accounts_receivable', receivable.id, { paymentId: payment.id, allocationId, amountMinor, nextOutstanding, nextStatus }, { organizationId: receivable.organizationId, actorId: actor?.userId || null, reason: input.reason || '' });
  return getReceivable(chatId, receivable.id);
}

export async function listReceivableLedger(chatId, receivableId) {
  const receivable = await getReceivable(chatId, receivableId);
  if (!receivable) return null;
  return db.prepare('SELECT * FROM ar_ledger_entries WHERE receivable_id = ? ORDER BY rowid ASC').all(receivable.id).map(row => ({
    id: row.id, receivableId: row.receivable_id, entryType: row.entry_type, amountMinor: Number(row.amount_minor), currency: normaliseCurrency(row.currency, 'ETB'), fromStatus: row.from_status, toStatus: row.to_status, paymentId: row.payment_id, actorId: row.actor_id, reason: row.reason || '', metadata: parseJSON(row.metadata_json, {}), createdAt: row.created_at,
  }));
}


function invoiceFromRow(row, items = []) {
  if (!row) return null;
  return { id: row.id, organizationId: row.organization_id, locationId: row.location_id || null, customerId: row.customer_id, receivableId: row.receivable_id, invoiceNumber: row.invoice_number, currency: normaliseCurrency(row.currency, 'ETB'), subtotalMinor: Number(row.subtotal_minor), totalMinor: Number(row.total_minor), status: row.status, issuedAt: row.issued_at || null, dueAt: row.due_at, notes: row.notes || '', createdByUserId: row.created_by_user_id || null, createdAt: row.created_at, updatedAt: row.updated_at, items };
}

function invoiceItems(invoiceId) {
  return db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY rowid ASC').all(invoiceId).map(row => ({ id: row.id, invoiceId: row.invoice_id, productId: row.product_id || null, description: row.description, quantity: Number(row.quantity), unitPriceMinor: Number(row.unit_price_minor), lineTotalMinor: Number(row.line_total_minor), currency: normaliseCurrency(row.currency, 'ETB'), createdAt: row.created_at }));
}

function nextInvoiceNumber(organizationId) {
  const row = db.prepare("SELECT invoice_number FROM invoices WHERE organization_id = ? ORDER BY rowid DESC LIMIT 1").get(organizationId);
  const last = row?.invoice_number?.match(/(\d+)$/)?.[1];
  return `INV-${String((Number(last || 0) + 1)).padStart(6, '0')}`;
}

export async function getInvoice(chatId, invoiceId) {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  const row = db.prepare('SELECT * FROM invoices WHERE id = ? AND organization_id = ?').get(String(invoiceId), organizationId);
  return invoiceFromRow(row, row ? invoiceItems(row.id) : []);
}

export async function listInvoices(chatId, { customerId = '', status = 'all', limit = 100 } = {}) {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  const where = ['organization_id = ?']; const params = [organizationId];
  if (customerId) { where.push('customer_id = ?'); params.push(String(customerId)); }
  if (status && status !== 'all') { where.push('status = ?'); params.push(String(status).toUpperCase()); }
  params.push(Math.max(1, Math.min(500, Number(limit) || 100)));
  return db.prepare(`SELECT * FROM invoices WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`).all(...params).map(row => invoiceFromRow(row, invoiceItems(row.id)));
}

function sourceItemsForInvoice(chatId, organizationId, receivable) {
  if (receivable.sourceType === 'purchase_order') {
    const po = getPurchaseOrderByIdSync(organizationId, receivable.sourceId);
    if (!po) throw Object.assign(new Error('Purchase order not found'), { statusCode: 404, code: 'PO_NOT_FOUND' });
    return (po.items || []).map(item => ({ productId: item.productId || null, description: item.name || item.productName || item.productId || 'Item', quantity: Number(item.quantity), unitPriceMinor: Number(item.unitPriceMinor), lineTotalMinor: Number(item.lineTotalMinor) }));
  }
  const order = db.prepare('SELECT order_json FROM orders WHERE chat_id = ? AND server_order_id = ?').get(String(chatId), receivable.sourceId);
  const raw = order ? parseJSON(order.order_json, {}) : {};
  return (raw.items || []).map(item => {
    const qty = Number(item.qty || item.quantity || 1);
    const unit = Number.isInteger(item.price_minor) ? Number(item.price_minor) : Number(item.price || 0);
    return { productId: item.product_id || item.productId || item.id || null, description: item.name || item.product_name || 'Item', quantity: qty, unitPriceMinor: unit, lineTotalMinor: Number.isInteger(item.line_total_minor) ? Number(item.line_total_minor) : unit * qty };
  });
}

export async function createInvoice(chatId, input = {}, actor = null) {
  ensureDatabase();
  const organizationId = await tenantOrganizationId(chatId);
  const receivableId = String(input.receivableId || input.receivable_id || '');
  if (!receivableId) throw Object.assign(new Error('receivableId is required'), { statusCode: 400, code: 'RECEIVABLE_REQUIRED' });
  const receivable = await getReceivable(chatId, receivableId);
  if (!receivable) throw Object.assign(new Error('Receivable not found'), { statusCode: 404, code: 'AR_NOT_FOUND' });
  if (['WRITTEN_OFF','CANCELLED'].includes(receivable.status)) throw Object.assign(new Error('Cannot invoice a closed receivable'), { statusCode: 409, code: 'AR_CLOSED' });
  if (receivable.currency !== tenantCurrency(chatId)) throw Object.assign(new Error('Invoice currency must match organization currency'), { statusCode: 409, code: 'CURRENCY_MISMATCH' });
  const existing = db.prepare('SELECT id FROM invoices WHERE organization_id = ? AND receivable_id = ?').get(organizationId, receivable.id);
  if (existing) throw Object.assign(new Error('An invoice already exists for this receivable'), { statusCode: 409, code: 'INVOICE_EXISTS' });
  const items = sourceItemsForInvoice(chatId, organizationId, receivable);
  if (!items.length) items.push({ productId: null, description: 'Commerce receivable', quantity: 1, unitPriceMinor: receivable.amountMinor, lineTotalMinor: receivable.amountMinor });
  const total = items.reduce((sum, i) => sum + Number(i.lineTotalMinor), 0);
  if (total !== receivable.amountMinor) throw Object.assign(new Error('Invoice items must equal the receivable amount'), { statusCode: 409, code: 'INVOICE_TOTAL_MISMATCH' });
  const now = nowIso(); const id = crypto.randomUUID(); const number = String(input.invoiceNumber || input.invoice_number || nextInvoiceNumber(organizationId));
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO invoices (id, organization_id, location_id, customer_id, receivable_id, invoice_number, currency, subtotal_minor, total_minor, status, issued_at, due_at, notes, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', NULL, ?, ?, ?, ?, ?)`).run(id, organizationId, receivable.locationId || null, receivable.customerId, receivable.id, number, receivable.currency, total, total, receivable.dueAt, String(input.notes || ''), actor?.userId || null, now, now);
    const stmt = db.prepare(`INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, unit_price_minor, line_total_minor, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const item of items) stmt.run(crypto.randomUUID(), id, item.productId, String(item.description), Number(item.quantity), Number(item.unitPriceMinor), Number(item.lineTotalMinor), receivable.currency, now);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  audit(String(chatId), 'b2b.invoice.created', 'invoices', id, { receivableId: receivable.id, invoiceNumber: number, totalMinor: total, currency: receivable.currency }, { organizationId, actorId: actor?.userId || null, reason: input.reason || '' });
  return getInvoice(chatId, id);
}

const INVOICE_TRANSITIONS = Object.freeze({ DRAFT: new Set(['ISSUED','CANCELLED']), ISSUED: new Set(['VOID']), VOID: new Set([]), CANCELLED: new Set([]) });

export async function transitionInvoice(chatId, invoiceId, targetState, actor = null, reason = '') {
  const current = await getInvoice(chatId, invoiceId);
  if (!current) throw Object.assign(new Error('Invoice not found'), { statusCode: 404, code: 'INVOICE_NOT_FOUND' });
  const target = String(targetState || '').toUpperCase();
  if (!INVOICE_TRANSITIONS[current.status]?.has(target)) throw Object.assign(new Error(`Invalid invoice transition ${current.status} -> ${target}`), { statusCode: 409, code: 'INVALID_INVOICE_TRANSITION' });
  const now = nowIso(); const issuedAt = target === 'ISSUED' ? now : current.issuedAt;
  db.prepare('UPDATE invoices SET status = ?, issued_at = ?, updated_at = ? WHERE id = ? AND organization_id = ?').run(target, issuedAt, now, current.id, current.organizationId);
  audit(String(chatId), 'b2b.invoice.transitioned', 'invoices', current.id, { from: current.status, to: target, reason: String(reason || '') }, { organizationId: current.organizationId, actorId: actor?.userId || null, reason });
  return getInvoice(chatId, current.id);
}

function importLegacyJSON() {
  const imported = db.prepare("SELECT value FROM metadata WHERE key = 'legacy_json_imported'").get();
  if (imported) return;

  const tenants = readLegacy(LEGACY_FILES.tenants, {});
  const catalogs = readLegacy(LEGACY_FILES.catalogs, {});
  const orders = readLegacy(LEGACY_FILES.orders, {});
  const phoneRouting = readLegacy(LEGACY_FILES.phoneRouting, {});
  const hasLegacyData = Object.keys(tenants).length || Object.keys(catalogs).length || Object.keys(orders).length || Object.keys(phoneRouting).length;

  db.exec('BEGIN');
  try {
    for (const [chatId, tenant] of Object.entries(tenants)) {
      if (!tenant || typeof tenant !== 'object') continue;
      db.prepare(`
        INSERT OR IGNORE INTO tenants
          (chat_id, tenant_id, api_key, created_at, seller_name, branding_json, vendor_code)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        String(chatId),
        tenant.id || crypto.randomUUID(),
        tenant.apiKey || crypto.randomBytes(24).toString('hex'),
        tenant.createdAt || nowIso(),
        tenant.sellerName || '',
        tenant.branding == null ? null : json(tenant.branding),
        tenant.vendorCode || null,
      );
    }

    // Legacy catalogs can exist for a tenant whose tenant record was not
    // exported. Create a safe tenant shell so the data is not silently lost.
    for (const chatId of Object.keys(catalogs)) {
      ensureTenantRow(String(chatId));
      const products = Array.isArray(catalogs[chatId]?.products) ? catalogs[chatId].products : [];
      for (const product of products) insertProduct(String(chatId), normaliseProduct(product));
    }

    for (const [chatId, orderBucket] of Object.entries(orders)) {
      ensureTenantRow(String(chatId));
      for (const order of Array.isArray(orderBucket?.orders) ? orderBucket.orders : []) {
        if (!order || order.id == null) continue;
        const expectedCurrency = tenantCurrency(key);
      if (order.currency != null && normaliseCurrency(order.currency, expectedCurrency) !== expectedCurrency) {
        results.push({ local_id: order.id, status: 'rejected', error: 'Order currency does not match the organization currency' });
        continue;
      }
      const { items, total } = validateAndTotalOrderItems(order.items, expectedCurrency);
        if (!items.length) continue;
        const stored = {
          ...order,
          items,
          total,
          server_order_id: order.server_order_id || crypto.randomUUID(),
          status: order.status || 'synced',
          delivered_to_device: order.delivered_to_device !== false,
        };
        insertOrder(String(chatId), String(order.id), stored);
      }
    }

    for (const [sellerPhone, chatId] of Object.entries(phoneRouting)) {
      ensureTenantRow(String(chatId));
      db.prepare(`
        INSERT OR REPLACE INTO phone_routing (seller_phone, chat_id, updated_at)
        VALUES (?, ?, ?)
      `).run(String(sellerPhone), String(chatId), nowIso());
    }

    db.prepare("INSERT INTO metadata (key, value) VALUES ('legacy_json_imported', ?)").run(JSON.stringify({
      importedAt: nowIso(),
      hadData: Boolean(hasLegacyData),
      source: 'flat-json',
    }));
    db.exec('COMMIT');
    if (hasLegacyData) console.log('[sellify] Imported legacy JSON data into SQLite; source files were retained.');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function ensureCanonicalIdentityForTenant(chatId) {
  const tenant = db.prepare('SELECT chat_id, tenant_id, seller_name, branding_json, created_at, organization_id FROM tenants WHERE chat_id = ?').get(String(chatId));
  if (!tenant) return null;
  let organizationId = tenant.organization_id;
  if (!organizationId) {
    organizationId = crypto.randomUUID();
    const branding = parseJSON(tenant.branding_json, {});
    db.prepare(`
      INSERT INTO organizations (id, name, country, currency, timezone, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      organizationId,
      tenant.seller_name || '',
      String(branding.country || ''),
      String(branding.currency || 'ETB'),
      String(branding.timezone || 'UTC'),
      tenant.created_at || nowIso()
    );
    db.prepare('UPDATE tenants SET organization_id = ? WHERE chat_id = ?').run(organizationId, tenant.chat_id);
  }
  const location = db.prepare('SELECT id FROM locations WHERE organization_id = ? AND code = ?').get(organizationId, 'DEFAULT');
  if (!location) {
    db.prepare(`
      INSERT INTO locations (id, organization_id, code, name, type, status, created_at)
      VALUES (?, ?, 'DEFAULT', ?, 'STORE', 'active', ?)
    `).run(crypto.randomUUID(), organizationId, tenant.seller_name || 'Main Store', tenant.created_at || nowIso());
  }
  const channel = db.prepare(`
    SELECT id FROM channel_identities
    WHERE channel_type = 'telegram_chat' AND channel_identifier = ?
  `).get(String(tenant.chat_id));
  if (!channel) {
    db.prepare(`
      INSERT INTO channel_identities
        (id, organization_id, channel_type, channel_identifier, status, metadata_json, created_at)
      VALUES (?, ?, 'telegram_chat', ?, 'active', ?, ?)
    `).run(crypto.randomUUID(), organizationId, String(tenant.chat_id), json({ legacy_tenant_id: tenant.tenant_id }), tenant.created_at || nowIso());
  }
  return organizationId;
}

const LOCATION_TYPES = new Set(['STORE', 'WAREHOUSE', 'COLLECTION_CENTER', 'DELIVERY_HUB', 'OFFICE', 'RESTAURANT']);
const LOCATION_STATUSES = new Set(['active', 'inactive']);

function normaliseLocationType(value) {
  const type = String(value || 'STORE').trim().toUpperCase();
  if (!LOCATION_TYPES.has(type)) {
    throw Object.assign(new Error(`Invalid location type. Expected one of: ${[...LOCATION_TYPES].join(', ')}`), { statusCode: 400 });
  }
  return type;
}

function normaliseLocationStatus(value) {
  const status = String(value || 'active').trim().toLowerCase();
  if (!LOCATION_STATUSES.has(status)) {
    throw Object.assign(new Error('Invalid location status. Expected active or inactive'), { statusCode: 400 });
  }
  return status;
}

export async function listOrganizationLocations(chatId, { includeInactive = false } = {}) {
  ensureDatabase();
  const organizationId = ensureCanonicalIdentityForTenant(chatId);
  if (!organizationId) return null;
  const rows = db.prepare(`
    SELECT id, organization_id, code, name, type, status, created_at
    FROM locations
    WHERE organization_id = ? ${includeInactive ? '' : "AND status = 'active'"}
    ORDER BY created_at ASC, id ASC
  `).all(organizationId);
  return rows.map(row => ({ id: row.id, organizationId: row.organization_id, code: row.code, name: row.name, type: row.type, status: row.status, createdAt: row.created_at }));
}

export async function getOrganizationLocation(chatId, locationId) {
  ensureDatabase();
  const organizationId = ensureCanonicalIdentityForTenant(chatId);
  if (!organizationId || !locationId) return null;
  const row = db.prepare('SELECT id, organization_id, code, name, type, status, created_at FROM locations WHERE id = ? AND organization_id = ?').get(String(locationId), String(organizationId));
  return row ? { id: row.id, organizationId: row.organization_id, code: row.code, name: row.name, type: row.type, status: row.status, createdAt: row.created_at } : null;
}

export async function createOrganizationLocation(chatId, { code, name, type = 'STORE', status = 'active' }) {
  ensureDatabase();
  const organizationId = ensureCanonicalIdentityForTenant(chatId);
  if (!organizationId) throw Object.assign(new Error('Unknown store'), { statusCode: 404 });
  const cleanCode = String(code || '').trim().toUpperCase();
  const cleanName = String(name || '').trim();
  if (!cleanCode || !/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(cleanCode)) throw Object.assign(new Error('Location code must be 1–40 characters using letters, numbers, _ or -'), { statusCode: 400 });
  if (!cleanName || cleanName.length > 120) throw Object.assign(new Error('Location name must be 1–120 characters'), { statusCode: 400 });
  const cleanType = normaliseLocationType(type);
  const cleanStatus = normaliseLocationStatus(status);
  const id = crypto.randomUUID();
  try {
    db.prepare(`INSERT INTO locations (id, organization_id, code, name, type, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, organizationId, cleanCode, cleanName, cleanType, cleanStatus, nowIso());
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) throw Object.assign(new Error('Location code already exists in this organization'), { statusCode: 409 });
    throw error;
  }
  audit(String(chatId), 'location.created', 'location', id, { organizationId, code: cleanCode, type: cleanType });
  return db.prepare('SELECT id, organization_id, code, name, type, status, created_at FROM locations WHERE id = ?').get(id);
}

export async function updateOrganizationLocation(chatId, locationId, patch = {}) {
  ensureDatabase();
  const organizationId = ensureCanonicalIdentityForTenant(chatId);
  if (!organizationId) throw Object.assign(new Error('Unknown store'), { statusCode: 404 });
  const existing = db.prepare('SELECT * FROM locations WHERE id = ? AND organization_id = ?').get(String(locationId), organizationId);
  if (!existing) throw Object.assign(new Error('Location not found'), { statusCode: 404 });
  const name = patch.name == null ? existing.name : String(patch.name).trim();
  if (!name || name.length > 120) throw Object.assign(new Error('Location name must be 1–120 characters'), { statusCode: 400 });
  const type = patch.type == null ? existing.type : normaliseLocationType(patch.type);
  const status = patch.status == null ? existing.status : normaliseLocationStatus(patch.status);
  const code = patch.code == null ? existing.code : String(patch.code).trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(code)) throw Object.assign(new Error('Location code must be 1–40 characters using letters, numbers, _ or -'), { statusCode: 400 });
  try {
    db.prepare('UPDATE locations SET code = ?, name = ?, type = ?, status = ? WHERE id = ? AND organization_id = ?').run(code, name, type, status, existing.id, organizationId);
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) throw Object.assign(new Error('Location code already exists in this organization'), { statusCode: 409 });
    throw error;
  }
  audit(String(chatId), 'location.updated', 'location', existing.id, { organizationId, changes: { code, name, type, status } });
  return db.prepare('SELECT id, organization_id, code, name, type, status, created_at FROM locations WHERE id = ?').get(existing.id);
}

export function getIdentityForTenant(chatId) {
  ensureDatabase();
  const organizationId = ensureCanonicalIdentityForTenant(chatId);
  if (!organizationId) return null;
  const organization = db.prepare('SELECT * FROM organizations WHERE id = ?').get(organizationId);
  const locations = db.prepare('SELECT * FROM locations WHERE organization_id = ? ORDER BY created_at, id').all(organizationId);
  const channels = db.prepare('SELECT id, organization_id, channel_type, channel_identifier, status, metadata_json, created_at FROM channel_identities WHERE organization_id = ? ORDER BY created_at, id').all(organizationId);
  return {
    organization: organization ? {
      id: organization.id, name: organization.name, country: organization.country,
      currency: organization.currency, timezone: organization.timezone, createdAt: organization.created_at,
    } : null,
    locations: locations.map(row => ({ id: row.id, code: row.code, name: row.name, type: row.type, status: row.status, createdAt: row.created_at })),
    channelIdentities: channels.map(row => ({
      id: row.id, channelType: row.channel_type, channelIdentifier: row.channel_identifier,
      status: row.status, metadata: parseJSON(row.metadata_json, {}), createdAt: row.created_at,
    })),
  };
}

function ensureDatabase() {
  if (db) return db;
  mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  // GAP-1.10: concurrent Payment Core commands may legitimately contend for
  // BEGIN IMMEDIATE. Wait briefly for the current transaction rather than
  // surfacing SQLITE_BUSY as a false payment failure.
  db.exec('PRAGMA busy_timeout = 5000');
  runMigrations();
  importLegacyJSON();
  for (const tenant of db.prepare('SELECT chat_id FROM tenants ORDER BY chat_id').all()) {
    ensureCanonicalIdentityForTenant(tenant.chat_id);
    ensureInventoryOpeningBalances(tenant.chat_id);
  }
  return db;
}

function ensureInventoryOpeningBalances(chatId) {
  const tenant = db.prepare('SELECT chat_id, organization_id FROM tenants WHERE chat_id = ?').get(String(chatId));
  if (!tenant?.organization_id) return;
  const location = db.prepare(
    "SELECT id FROM locations WHERE organization_id = ? AND code = 'DEFAULT' LIMIT 1"
  ).get(String(tenant.organization_id));
  if (!location) return;
  const products = db.prepare(
    'SELECT product_id, stock FROM catalog_products WHERE chat_id = ? AND stock IS NOT NULL'
  ).all(String(chatId));
  const insert = db.prepare(`
    INSERT OR IGNORE INTO inventory_movements
      (id, event_id, organization_id, location_id, product_id, quantity, movement_type,
       reference_type, reference_id, actor_id, device_id, occurred_at, reason, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'OPENING_BALANCE', 'migration', ?, NULL, NULL, ?, ?, ?, ?)
  `);
  for (const product of products) {
    const eventId = `inventory-opening:${chatId}:${product.product_id}`;
    const occurredAt = tenant.created_at || nowIso();
    insert.run(
      crypto.randomUUID(), eventId, String(tenant.organization_id), String(location.id),
      String(product.product_id), Number(product.stock) || 0, eventId, occurredAt,
      'Phase 10.5 opening projection', json({ source: 'catalog_products.stock' }), nowIso()
    );
  }
}

function ensureTenantRow(chatId) {
  const key = String(chatId);
  const existing = db.prepare('SELECT chat_id FROM tenants WHERE chat_id = ?').get(key);
  if (existing) return;
  db.prepare(`
    INSERT INTO tenants (chat_id, tenant_id, api_key, created_at, seller_name)
    VALUES (?, ?, ?, ?, '')
  `).run(key, crypto.randomUUID(), crypto.randomBytes(24).toString('hex'), nowIso());
}

function tenantFromRow(row) {
  if (!row) return null;
  return {
    chatId: row.chat_id,
    id: row.tenant_id,
    apiKey: row.api_key,
    createdAt: row.created_at,
    sellerName: row.seller_name,
    branding: parseJSON(row.branding_json, null),
    vendorCode: row.vendor_code,
    organizationId: row.organization_id || null,
  };
}

function productFromRow(row) {
  const product = parseJSON(row.product_json, { id: row.product_id, price: row.price_minor });
  product.stock_revision = Number.isInteger(row.stock_revision) ? row.stock_revision : 0;
  product.currency = normaliseCurrency(row.currency || product.currency, 'ETB');
  product.price = normalisePrice(row.price_minor);
  return product;
}

function orderFromRow(row) {
  return parseJSON(row.order_json, {});
}

function insertProduct(chatId, product) {
  if (!product || product.id == null) return;
  const normalized = normaliseProduct(product);
  const revision = Number.isInteger(normalized.stock_revision) && normalized.stock_revision >= 0 ? normalized.stock_revision : 0;
  normalized.stock_revision = revision;
  normalized.currency = tenantCurrency(chatId);
  db.prepare(`
    INSERT OR REPLACE INTO catalog_products
      (chat_id, product_id, product_json, price_minor, stock, marketplace_listed, updated_at, stock_revision, currency)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(String(chatId), String(normalized.id), json(normalized), normalized.price,
    typeof normalized.stock === 'number' ? normalized.stock : null,
    normalized.marketplace_listed ? 1 : 0, nowIso(), revision, tenantCurrency(chatId));
}

function insertOrder(chatId, localId, order) {
  db.prepare(`
    INSERT OR IGNORE INTO orders
      (chat_id, local_id, server_order_id, order_json, total_minor, currency, created_at, status,
       delivered_to_device, marketplace_order_id, is_marketplace, customer_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(chatId),
    String(localId),
    order.server_order_id || crypto.randomUUID(),
    json(order),
    normalisePrice(order.total),
    normaliseCurrency(order.currency, tenantCurrency(chatId)),
    Number.isFinite(Number(order.created_at)) ? Number(order.created_at) : Date.now(),
    order.status || 'synced',
    order.delivered_to_device === false ? 0 : 1,
    order.marketplace_order_id || null,
    order.is_marketplace ? 1 : 0,
    order.customer_id || null,
  );
}

export async function getOrCreateTenant(chatId) {
  ensureDatabase();
  const key = String(chatId);
  const existing = db.prepare('SELECT * FROM tenants WHERE chat_id = ?').get(key);
  if (existing) return tenantFromRow(existing);
  db.prepare(`
    INSERT INTO tenants (chat_id, tenant_id, api_key, created_at, seller_name)
    VALUES (?, ?, ?, ?, '')
  `).run(key, crypto.randomUUID(), crypto.randomBytes(24).toString('hex'), nowIso());
  // New tenants must enter the canonical identity model immediately. The
  // migration-time repair path only runs for tenants that already existed when
  // the database was opened; without this call, a newly created tenant has no
  // organization_id/default location/channel and organization-scoped commands
  // fail with ORGANIZATION_NOT_FOUND.
  ensureCanonicalIdentityForTenant(key);
  audit(key, 'tenant.created', 'tenant', key);

  return tenantFromRow(db.prepare('SELECT * FROM tenants WHERE chat_id = ?').get(key));
}

export async function getTenant(chatId) {
  ensureDatabase();
  return tenantFromRow(db.prepare('SELECT * FROM tenants WHERE chat_id = ?').get(String(chatId)));
}

export async function getTenantByApiKey(apiKey) {
  ensureDatabase();
  if (!apiKey) return null;
  return tenantFromRow(db.prepare('SELECT * FROM tenants WHERE api_key = ?').get(String(apiKey)));
}

export async function updateTenant(chatId, patch) {
  ensureDatabase();
  const key = String(chatId);
  const current = await getTenant(key);
  if (!current) throw new Error(`Unknown tenant: ${chatId}`);
  const next = { ...current, ...patch };
  if (next.branding && typeof next.branding === 'object' && Object.hasOwn(next.branding, 'currency')) {
    const currentCurrency = tenantCurrency(key);
    const requestedCurrency = normaliseCurrency(next.branding.currency, currentCurrency);
    if (requestedCurrency !== currentCurrency) {
      const financialRows = db.prepare(`
        SELECT (SELECT COUNT(*) FROM catalog_products WHERE chat_id = ?) AS products,
               (SELECT COUNT(*) FROM orders WHERE chat_id = ?) AS orders
      `).get(key, key);
      if (Number(financialRows?.products || 0) > 0 || Number(financialRows?.orders || 0) > 0) {
        throw Object.assign(new Error('Organization currency cannot change after monetary records exist'), { statusCode: 409, code: 'CURRENCY_LOCKED' });
      }
      next.branding = { ...next.branding, currency: requestedCurrency };
      db.prepare('UPDATE organizations SET currency = ? WHERE id = (SELECT organization_id FROM tenants WHERE chat_id = ?)').run(requestedCurrency, key);
    } else {
      next.branding = { ...next.branding, currency: currentCurrency };
    }
  }
  db.prepare(`
    UPDATE tenants
    SET seller_name = ?, branding_json = ?, vendor_code = ?
    WHERE chat_id = ?
  `).run(next.sellerName || '', next.branding == null ? null : json(next.branding), next.vendorCode || null, key);
  audit(key, 'tenant.updated', 'tenant', key, { fields: Object.keys(patch) });
  return next;
}

export async function listTenants() {
  ensureDatabase();
  return db.prepare('SELECT * FROM tenants ORDER BY created_at').all().map(tenantFromRow);
}

export async function getCatalog(chatId) {
  ensureDatabase();
  return {
    products: db.prepare('SELECT * FROM catalog_products WHERE chat_id = ? ORDER BY product_id').all(String(chatId)).map(productFromRow),
  };
}

export async function saveCatalog(chatId, incomingProducts) {
  ensureDatabase();
  const key = String(chatId);
  const products = (Array.isArray(incomingProducts) ? incomingProducts : []).filter(p => p && p.id != null).map(normaliseProduct);
  db.exec('BEGIN IMMEDIATE');
  try {
    const current = new Map(db.prepare('SELECT * FROM catalog_products WHERE chat_id = ?').all(key).map(row => [String(row.product_id), row]));
    for (const product of products) {
      const row = current.get(String(product.id));
      if (!row) { product.stock_revision = 0; continue; }
      const currentRevision = Number.isInteger(row.stock_revision) ? row.stock_revision : 0;
      const incomingRevision = Number.isInteger(product.stock_revision) ? product.stock_revision : null;
      if (incomingRevision === null) {
        product.stock = typeof row.stock === 'number' ? row.stock : undefined;
        product.stock_revision = currentRevision;
      } else if (incomingRevision !== currentRevision) {
        throw Object.assign(new Error(`Catalog stock changed on the server for product ${product.id}; refresh before saving`), { statusCode: 409, code: 'CATALOG_STOCK_CONFLICT' });
      } else {
        const oldStock = typeof row.stock === 'number' ? row.stock : null;
        const newStock = typeof product.stock === 'number' ? product.stock : null;
        product.stock_revision = newStock !== oldStock ? currentRevision + 1 : currentRevision;
      }
    }
    db.prepare('DELETE FROM catalog_products WHERE chat_id = ?').run(key);
    const currency = tenantCurrency(key);
    for (const product of products) {
      product.currency = currency;
      insertProduct(key, product);
    }
    // Phase 10.5: if this is the first tracked catalog snapshot, seed the
    // append-only ledger from the existing stock projection. Subsequent
    // catalog writes do not create another opening balance.
    ensureInventoryOpeningBalances(key);
    audit(key, 'catalog.replaced', 'catalog', key, { productCount: products.length });
    db.exec('COMMIT');
    return products;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

function customerFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    defaultLocationId: row.default_location_id || null,
    customerType: row.customer_type,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    taxId: row.tax_id,
    notes: row.notes,
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeCustomerInput(input = {}) {
  const value = input && typeof input === 'object' ? input : {};
  const customerType = String(value.customerType ?? value.customer_type ?? 'retail').trim().toLowerCase();
  const status = String(value.status ?? 'active').trim().toLowerCase();
  return {
    name: String(value.name ?? value.customer_name ?? '').trim().slice(0, 200),
    phone: String(value.phone ?? value.customer_phone ?? '').trim().slice(0, 80),
    email: String(value.email ?? '').trim().slice(0, 254),
    address: String(value.address ?? '').trim().slice(0, 500),
    taxId: String(value.taxId ?? value.tax_id ?? '').trim().slice(0, 120),
    notes: String(value.notes ?? '').trim().slice(0, 1000),
    customerType: ['retail', 'business'].includes(customerType) ? customerType : 'retail',
    status: ['active', 'inactive'].includes(status) ? status : 'active',
    defaultLocationId: value.defaultLocationId ?? value.default_location_id ?? null,
    source: String(value.source ?? 'manual').trim().slice(0, 60) || 'manual',
  };
}

function findCustomerByNaturalKey(organizationId, phone, name) {
  const cleanPhone = String(phone || '').trim();
  const cleanName = String(name || '').trim();
  if (cleanPhone) {
    const row = db.prepare(`SELECT * FROM customers WHERE organization_id = ? AND phone = ? ORDER BY updated_at DESC LIMIT 1`).get(String(organizationId), cleanPhone);
    if (row) return row;
  }
  if (cleanName) {
    return db.prepare(`SELECT * FROM customers WHERE organization_id = ? AND phone = '' AND lower(name) = lower(?) ORDER BY updated_at DESC LIMIT 1`).get(String(organizationId), cleanName);
  }
  return null;
}

export async function listCustomers(chatId, { query = '', status = 'active', limit = 100 } = {}) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) return [];
  const q = String(query || '').trim();
  const safeLimit = Math.min(200, Math.max(1, Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : 100));
  const params = [tenant.organizationId];
  const where = ['organization_id = ?'];
  if (status && status !== 'all') { where.push('status = ?'); params.push(String(status)); }
  if (q) {
    where.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR tax_id LIKE ?)');
    const like = `%${q}%`; params.push(like, like, like, like);
  }
  params.push(safeLimit);
  return db.prepare(`SELECT * FROM customers WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT ?`).all(...params).map(customerFromRow);
}

export async function getCustomer(chatId, customerId) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) return null;
  return customerFromRow(db.prepare('SELECT * FROM customers WHERE id = ? AND organization_id = ?').get(String(customerId), tenant.organizationId));
}

export async function upsertCustomer(chatId, input = {}) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) throw Object.assign(new Error('Unknown organization'), { statusCode: 404 });
  const value = normalizeCustomerInput(input);
  if (!value.name && !value.phone) throw Object.assign(new Error('Customer name or phone is required'), { statusCode: 400 });
  if (value.defaultLocationId) {
    const location = db.prepare('SELECT id FROM locations WHERE id = ? AND organization_id = ?').get(String(value.defaultLocationId), tenant.organizationId);
    if (!location) throw Object.assign(new Error('Customer location does not belong to this organization'), { statusCode: 400 });
  }
  const existing = input.id ? db.prepare('SELECT * FROM customers WHERE id = ? AND organization_id = ?').get(String(input.id), tenant.organizationId) : findCustomerByNaturalKey(tenant.organizationId, value.phone, value.name);
  const now = nowIso();
  if (existing) {
    const next = { ...customerFromRow(existing), ...value, id: existing.id, organizationId: tenant.organizationId, createdAt: existing.created_at, updatedAt: now };
    db.prepare(`UPDATE customers SET default_location_id = ?, customer_type = ?, name = ?, phone = ?, email = ?, address = ?, tax_id = ?, notes = ?, status = ?, source = ?, updated_at = ? WHERE id = ? AND organization_id = ?`).run(
      next.defaultLocationId || null, next.customerType, next.name, next.phone, next.email, next.address, next.taxId, next.notes, next.status, next.source, now, existing.id, tenant.organizationId
    );
    audit(String(chatId), 'customer.updated', 'customer', existing.id, { source: value.source }, {
      organizationId: tenant.organizationId,
    });
    return customerFromRow(db.prepare('SELECT * FROM customers WHERE id = ?').get(existing.id));
  }
  const id = String(input.id || crypto.randomUUID());
  db.prepare(`INSERT INTO customers (id, organization_id, default_location_id, customer_type, name, phone, email, address, tax_id, notes, status, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, tenant.organizationId, value.defaultLocationId || null, value.customerType, value.name, value.phone, value.email, value.address, value.taxId, value.notes, value.status, value.source, now, now);
  audit(String(chatId), 'customer.created', 'customer', id, { source: value.source }, {
    organizationId: tenant.organizationId,
  });
  return customerFromRow(db.prepare('SELECT * FROM customers WHERE id = ?').get(id));
}

export async function updateCustomer(chatId, customerId, patch = {}) {
  const current = await getCustomer(chatId, customerId);
  if (!current) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
  return upsertCustomer(chatId, { ...current, ...patch, id: current.id });
}

function inventoryMovementFromRow(row) {
  if (!row) return null;
  return {
    id: row.id, eventId: row.event_id, organizationId: row.organization_id,
    locationId: row.location_id, productId: row.product_id, quantity: Number(row.quantity),
    movementType: row.movement_type, referenceType: row.reference_type || null,
    referenceId: row.reference_id || null, actorId: row.actor_id || null,
    deviceId: row.device_id || null, occurredAt: row.occurred_at, reason: row.reason || '',
    metadata: parseJSON(row.metadata_json, {}), createdAt: row.created_at,
  };
}

export async function listInventoryMovements(chatId, { productId = '', locationId = '', limit = 100 } = {}) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) return [];
  const safeLimit = Math.min(500, Math.max(1, Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : 100));
  const where = ['organization_id = ?'];
  const params = [String(tenant.organizationId)];
  if (productId) { where.push('product_id = ?'); params.push(String(productId)); }
  if (locationId) { where.push('location_id = ?'); params.push(String(locationId)); }
  params.push(safeLimit);
  return db.prepare(`SELECT * FROM inventory_movements WHERE ${where.join(' AND ')} ORDER BY occurred_at DESC, created_at DESC LIMIT ?`)
    .all(...params).map(inventoryMovementFromRow);
}

export async function getInventoryBalances(chatId, { locationId = '' } = {}) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) return [];
  const where = ['organization_id = ?'];
  const params = [String(tenant.organizationId)];
  if (locationId) { where.push('location_id = ?'); params.push(String(locationId)); }
  return db.prepare(`
    SELECT location_id, product_id, ROUND(SUM(quantity), 6) AS quantity
    FROM inventory_movements
    WHERE ${where.join(' AND ')}
    GROUP BY location_id, product_id
    ORDER BY product_id
  `).all(...params).map(row => ({ locationId: row.location_id, productId: row.product_id, quantity: Number(row.quantity) }));
}

export async function appendInventoryMovement(chatId, input = {}, actor = null) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) throw Object.assign(new Error('Unknown organization'), { statusCode: 404 });
  const productId = String(input.productId ?? input.product_id ?? '').trim();
  const movementType = String(input.movementType ?? input.movement_type ?? '').trim().toUpperCase();
  const quantity = Number(input.quantity);
  const allowedTypes = new Set(['PURCHASE', 'SALE', 'RETURN', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'DAMAGE', 'LOSS', 'RESERVATION', 'RELEASE', 'OPENING_BALANCE']);
  if (!productId || !Number.isFinite(quantity) || quantity === 0 || !allowedTypes.has(movementType)) {
    throw Object.assign(new Error('Valid productId, non-zero quantity, and movementType are required'), { statusCode: 400 });
  }
  const product = db.prepare('SELECT product_id FROM catalog_products WHERE chat_id = ? AND product_id = ?').get(String(chatId), productId);
  if (!product) throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  const defaultLocation = db.prepare(
    "SELECT id FROM locations WHERE organization_id = ? AND code = 'DEFAULT' LIMIT 1"
  ).get(String(tenant.organizationId));
  const locationId = String(input.locationId || defaultLocation?.id || '');
  const location = db.prepare("SELECT id FROM locations WHERE id = ? AND organization_id = ? AND status = 'active'").get(locationId, String(tenant.organizationId));
  if (!location) throw Object.assign(new Error('Inventory location does not belong to this organization'), { statusCode: 400 });
  const eventId = String(input.eventId || crypto.randomUUID()).trim();
  const existing = db.prepare('SELECT * FROM inventory_movements WHERE event_id = ?').get(eventId);
  if (existing) return inventoryMovementFromRow(existing);
  const now = nowIso();
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO inventory_movements
      (id, event_id, organization_id, location_id, product_id, quantity, movement_type,
       reference_type, reference_id, actor_id, device_id, occurred_at, reason, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, eventId, String(tenant.organizationId), locationId, productId, quantity, movementType,
    input.referenceType || input.reference_type || null, input.referenceId || input.reference_id || null,
    actor?.userId || null, actor?.deviceId || null, input.occurredAt || input.occurred_at || now,
    String(input.reason || '').slice(0, 500), json(input.metadata || {}), now
  );
  audit(String(chatId), 'inventory.movement.recorded', 'inventory_movement', id, {
    productId, locationId, movementType, quantity, eventId,
  }, {
    organizationId: tenant.organizationId,
    locationId,
    actorId: actor?.userId || null,
    deviceId: actor?.deviceId || null,
  });
  return inventoryMovementFromRow(db.prepare('SELECT * FROM inventory_movements WHERE id = ?').get(id));
}

export async function processSyncEvent(chatId, event = {}, actor = null) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) throw Object.assign(new Error('Unknown organization'), { statusCode: 404 });
  const eventId = String(event.eventId || event.event_id || '').trim();
  const eventType = String(event.eventType || event.event_type || '').trim();
  if (!eventId || !eventType || !event.payload || typeof event.payload !== 'object') {
    throw Object.assign(new Error('eventId, eventType, and payload are required'), { statusCode: 400 });
  }
  const aggregateType = String(event.aggregateType || event.aggregate_type || eventType.split('.')[0] || 'unknown');
  const aggregateId = event.aggregateId || event.aggregate_id || null;
  const occurredAt = String(event.occurredAt || event.occurred_at || nowIso());
  const receivedAt = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    const existing = db.prepare('SELECT * FROM sync_events WHERE event_id = ?').get(eventId);
    if (existing) {
      const replay = decideEventReplay(existing, {
        organizationId: tenant.organizationId,
        eventType,
        aggregateType,
        aggregateId,
        payload: event.payload,
      });
      if (replay.conflict) {
        throw Object.assign(new Error('Event id was already used with a different event payload'), {
          statusCode: 409,
          code: 'EVENT_ID_REUSED',
        });
      }
      db.exec('COMMIT');
      return { eventId, status: existing.status, duplicate: true, replay: true };
    }
    if (eventType === 'inventory.movement.record') {
      await appendInventoryMovement(chatId, event.payload, actor);
    } else if (eventType === 'customer.upsert') {
      await upsertCustomer(chatId, event.payload);
    } else {
      throw Object.assign(new Error(`Unsupported sync event type: ${eventType}`), { statusCode: 400 });
    }
    db.prepare(`INSERT INTO sync_events
      (event_id, organization_id, event_type, aggregate_type, aggregate_id, payload_json, actor_id, device_id, occurred_at, received_at, processed_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processed')`).run(
      eventId, String(tenant.organizationId), eventType, aggregateType, aggregateId == null ? null : String(aggregateId),
      json(event.payload), actor?.userId || null, actor?.deviceId || null, occurredAt, receivedAt, receivedAt
    );
    db.exec('COMMIT');
    return { eventId, status: 'processed', duplicate: false };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}


function paymentFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    locationId: row.location_id,
    orderId: row.order_id,
    customerId: row.customer_id,
    paymentAccountId: row.payment_account_id,
    paymentIntentId: row.payment_intent_id || null,
    providerId: row.provider_id,
    channel: row.channel,
    methodId: row.method_id,
    methodName: row.method_name,
    amountMinor: Number(row.amount_minor),
    currency: normaliseCurrency(row.currency, 'ETB'),
    state: row.state,
    externalReference: row.external_reference,
    claimedAt: row.claimed_at,
    receivedAt: row.received_at,
    verifiedAt: row.verified_at,
    reconciledAt: row.reconciled_at,
    metadata: parseJSON(row.metadata_json, {}),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function paymentIntentFromRow(row) {
  if (!row) return null;
  return {
    id: row.id, organizationId: row.organization_id, locationId: row.location_id || null,
    orderId: row.order_id || null, paymentAccountId: row.payment_account_id || null,
    providerId: row.provider_id, amountMinor: Number(row.amount_minor),
    currency: normaliseCurrency(row.currency, 'ETB'), status: row.status,
    expiresAt: row.expires_at || null, fulfilledAt: row.fulfilled_at || null,
    cancelledAt: row.cancelled_at || null, metadata: parseJSON(row.metadata_json, {}),
    createdByUserId: row.created_by_user_id || null, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
function paymentEvidenceFromRow(row) {
  if (!row) return null;
  return {
    id: row.id, organizationId: row.organization_id, locationId: row.location_id || null,
    paymentId: row.payment_id || null, paymentIntentId: row.payment_intent_id || null,
    providerId: row.provider_id, channel: row.channel, evidenceType: row.evidence_type,
    externalReference: row.external_reference || null, providerTransactionId: row.provider_transaction_id || null,
    fingerprint: row.fingerprint, rawPayload: parseJSON(row.raw_payload_json, null),
    normalizedPayload: parseJSON(row.normalized_payload_json, null), source: row.source || null,
    observedAt: row.observed_at || null, receivedAt: row.received_at,
    submittedByUserId: row.submitted_by_user_id || null, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
function paymentVerificationFromRow(row) {
  if (!row) return null;
  return {
    id: row.id, organizationId: row.organization_id, paymentId: row.payment_id || null,
    paymentIntentId: row.payment_intent_id || null, evidenceId: row.evidence_id, providerId: row.provider_id,
    result: row.result, confidence: row.confidence == null ? null : Number(row.confidence),
    observedAmountMinor: row.observed_amount_minor == null ? null : Number(row.observed_amount_minor),
    observedCurrency: row.observed_currency || null, observedReceiver: row.observed_receiver || null,
    observedReceiverAccount: row.observed_receiver_account || null, observedReference: row.observed_reference || null,
    observedTransactionId: row.observed_transaction_id || null, observedAt: row.observed_at || null,
    reasonCodes: parseJSON(row.reason_codes_json, []), rawResult: parseJSON(row.raw_result_json, null),
    verifier: row.verifier, verifierVersion: row.verifier_version || null, provenanceSource: row.provenance_source || null, provenanceOperation: row.provenance_operation || null, createdAt: row.created_at,
  };
}
function paymentDecisionFromRow(row) {
  if (!row) return null;
  return {
    id: row.id, organizationId: row.organization_id, paymentId: row.payment_id,
    paymentIntentId: row.payment_intent_id || null, evidenceId: row.evidence_id || null,
    verificationId: row.verification_id || null, decision: row.decision, targetState: row.target_state || null,
    reasonCodes: parseJSON(row.reason_codes_json, []), invariantResults: parseJSON(row.invariant_results_json, {}),
    decisionSource: row.decision_source, actorId: row.actor_id || null, createdAt: row.created_at,
  };
}
function hashPaymentRequest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value ?? {})).digest('hex');
}
export async function createPaymentWithIntent(chatId, input = {}, actor = null) {
  ensureDatabase();
  const { organizationId, locationId } = await resolvePaymentContext(chatId, input);
  if (input.organizationId && String(input.organizationId) !== organizationId) throw Object.assign(new Error('Payment organization does not match tenant'), { statusCode: 403, code: 'ORGANIZATION_MISMATCH' });
  const currency = tenantCurrency(chatId);
  const amountMinor = Number(input.amountMinor ?? input.amount_minor);
  if (!Number.isInteger(amountMinor) || amountMinor < 0) throw Object.assign(new Error('amountMinor must be a non-negative integer'), { statusCode: 400, code: 'INVALID_PAYMENT_AMOUNT' });
  if (input.currency != null && normaliseCurrency(input.currency, currency) !== currency) throw Object.assign(new Error('Payment currency does not match the organization currency'), { statusCode: 409, code: 'CURRENCY_MISMATCH' });
  const orderId = input.orderId || input.order_id || null;
  let customerId = input.customerId || input.customer_id || null;
  if (orderId) {
    const order = db.prepare('SELECT order_json, customer_id, total_minor, currency FROM orders WHERE chat_id = ? AND server_order_id = ?').get(String(chatId), String(orderId));
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404, code: 'ORDER_NOT_FOUND' });
    if (normaliseCurrency(order.currency, currency) !== currency) throw Object.assign(new Error('Order currency does not match the organization currency'), { statusCode: 409, code: 'CURRENCY_MISMATCH' });
    if (amountMinor > Number(order.total_minor)) throw Object.assign(new Error('Payment amount cannot exceed the order total'), { statusCode: 400, code: 'PAYMENT_AMOUNT_EXCEEDS_ORDER' });
    customerId = customerId || order.customer_id || parseJSON(order.order_json, {}).customer_id || null;
  }
  if (customerId) {
    const customer = db.prepare('SELECT id FROM customers WHERE id = ? AND organization_id = ?').get(String(customerId), organizationId);
    if (!customer) throw Object.assign(new Error('Customer does not belong to this organization'), { statusCode: 400, code: 'CUSTOMER_ORGANIZATION_MISMATCH' });
    customerId = String(customerId);
  }
  const providerId = String(input.providerId || input.provider_id || '').trim().toLowerCase();
  if (!providerId) throw Object.assign(new Error('providerId is required'), { statusCode: 400, code: 'PROVIDER_REQUIRED' });
  requirePaymentProvider(providerId);
  const accountId = input.paymentAccountId || input.payment_account_id || null;
  if (!accountId) throw Object.assign(new Error('paymentAccountId is required'), { statusCode: 400, code: 'PAYMENT_ACCOUNT_REQUIRED' });
  const account = db.prepare("SELECT id, provider_id FROM payment_accounts WHERE id = ? AND organization_id = ? AND status = 'active'").get(String(accountId), organizationId);
  if (!account) throw Object.assign(new Error('Payment account does not belong to this organization'), { statusCode: 400, code: 'PAYMENT_ACCOUNT_NOT_FOUND' });
  if (String(account.provider_id) !== providerId) throw Object.assign(new Error('Payment account provider does not match payment provider'), { statusCode: 409, code: 'PROVIDER_MISMATCH' });
  const channel = String(input.channel || 'manual').trim().toLowerCase();
  requirePaymentChannel(channel);
  const id = String(input.id || crypto.randomUUID());
  const intentId = String(input.paymentIntentId || input.payment_intent_id || crypto.randomUUID());
  const now = nowIso();
  const idempotencyKey = String(input.idempotencyKey || input.idempotency_key || '').trim();
  const requestHash = String(input.requestHash || input.request_hash || hashPaymentRequest({ orderId, customerId, paymentAccountId: accountId, providerId, channel, amountMinor, currency, expiresAt: input.expiresAt || input.expires_at || null, metadata: input.metadata || {} }));
  db.exec('BEGIN IMMEDIATE');
  try {
    if (idempotencyKey) {
      const existing = db.prepare('SELECT * FROM payment_idempotency_keys WHERE organization_id = ? AND idempotency_key = ? AND command_type = ?').get(organizationId, idempotencyKey, 'CREATE_PAYMENT');
      if (existing) {
        if (String(existing.request_hash) !== requestHash) throw Object.assign(new Error('Idempotency key was already used with a different request'), { statusCode: 409, code: 'IDEMPOTENCY_KEY_REUSE' });
        const response = parseJSON(existing.response_json, null);
        db.exec('COMMIT');
        return response?.paymentId ? { payment: paymentFromRow(db.prepare('SELECT * FROM payments WHERE id = ? AND organization_id = ?').get(response.paymentId, organizationId)), intent: paymentIntentFromRow(db.prepare('SELECT * FROM payment_intents WHERE id = ? AND organization_id = ?').get(response.intentId, organizationId)), idempotent: true } : { payment: null, intent: null, idempotent: true };
      }
    }
    db.prepare("INSERT INTO payment_intents (id, organization_id, location_id, order_id, payment_account_id, provider_id, amount_minor, currency, status, expires_at, metadata_json, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?)").run(
      intentId, organizationId, locationId, orderId ? String(orderId) : null, String(accountId), providerId, amountMinor, currency,
      input.expiresAt || input.expires_at || null, json(input.metadata || {}), actor?.userId || null, now, now
    );
    db.prepare("INSERT INTO payments (id, organization_id, location_id, order_id, customer_id, payment_account_id, provider_id, channel, method_id, method_name, amount_minor, currency, state, payment_intent_id, external_reference, claimed_at, received_at, verified_at, reconciled_at, metadata_json, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNPAID', ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?, ?)").run(
      id, organizationId, locationId, orderId ? String(orderId) : null, customerId, String(accountId), providerId, channel,
      input.methodId || input.method_id || null, input.methodName || input.method_name || null, intentId,
      json(input.metadata || {}), actor?.userId || null, now, now
    );
    db.prepare("INSERT INTO payment_ledger_entries (id, payment_id, organization_id, entry_type, amount_minor, currency, from_state, to_state, actor_id, reason, metadata_json, created_at) VALUES (?, ?, ?, 'CREATED', ?, ?, NULL, 'UNPAID', ?, ?, ?, ?)").run(
      crypto.randomUUID(), id, organizationId, amountMinor, currency, actor?.userId || null, String(input.reason || ''), json(input.metadata || {}), now
    );
    syncMarketplacePaymentAllocation(orderId, id, amountMinor, 'UNPAID');
    const response = { paymentId: id, intentId };
    if (idempotencyKey) {
      db.prepare("INSERT INTO payment_idempotency_keys (id, organization_id, idempotency_key, command_type, request_hash, response_status, response_json, resource_type, resource_id, created_at, expires_at) VALUES (?, ?, ?, 'CREATE_PAYMENT', ?, 201, ?, 'payment', ?, ?, ?)").run(
        crypto.randomUUID(), organizationId, idempotencyKey, requestHash, json(response), id, now, input.idempotencyExpiresAt || input.idempotency_expires_at || null
      );
    }
    db.exec('COMMIT');
    audit(String(chatId), 'payment.created', 'payment', id, { amountMinor, currency, state: 'UNPAID', orderId, paymentIntentId: intentId }, { organizationId, locationId, actorId: actor?.userId || null, deviceId: actor?.deviceId || null });
    return { payment: paymentFromRow(db.prepare('SELECT * FROM payments WHERE id = ? AND organization_id = ?').get(id, organizationId)), intent: paymentIntentFromRow(db.prepare('SELECT * FROM payment_intents WHERE id = ? AND organization_id = ?').get(intentId, organizationId)), idempotent: false };
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
}
export async function getPaymentIntent(chatId, intentId) {
  ensureDatabase();
  const { organizationId } = await resolvePaymentContext(chatId);
  return paymentIntentFromRow(db.prepare('SELECT * FROM payment_intents WHERE id = ? AND organization_id = ?').get(String(intentId), organizationId));
}
export async function insertPaymentIntent(chatId, input = {}, actor = null) {
  ensureDatabase();
  const { organizationId, locationId } = await resolvePaymentContext(chatId, input);
  const providerId = String(input.providerId || input.provider_id || '').trim().toLowerCase();
  if (!providerId) throw Object.assign(new Error('providerId is required'), { statusCode: 400, code: 'PROVIDER_REQUIRED' });
  requirePaymentProvider(providerId);
  const amountMinor = Number(input.amountMinor ?? input.amount_minor);
  if (!Number.isInteger(amountMinor) || amountMinor < 0) throw Object.assign(new Error('amountMinor must be a non-negative integer'), { statusCode: 400, code: 'INVALID_PAYMENT_AMOUNT' });
  const currency = tenantCurrency(chatId);
  if (input.currency != null && normaliseCurrency(input.currency, currency) !== currency) throw Object.assign(new Error('Payment currency does not match the organization currency'), { statusCode: 409, code: 'CURRENCY_MISMATCH' });
  const accountId = input.paymentAccountId || input.payment_account_id || null;
  if (accountId) {
    const account = db.prepare("SELECT id, provider_id FROM payment_accounts WHERE id = ? AND organization_id = ? AND status = 'active'").get(String(accountId), organizationId);
    if (!account) throw Object.assign(new Error('Payment account does not belong to this organization'), { statusCode: 400, code: 'PAYMENT_ACCOUNT_NOT_FOUND' });
    if (String(account.provider_id) !== providerId) throw Object.assign(new Error('Payment account provider does not match payment intent provider'), { statusCode: 409, code: 'PROVIDER_MISMATCH' });
  }
  const orderId = input.orderId || input.order_id || null;
  if (orderId) {
    const order = db.prepare('SELECT total_minor, currency FROM orders WHERE chat_id = ? AND server_order_id = ?').get(String(chatId), String(orderId));
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404, code: 'ORDER_NOT_FOUND' });
    if (normaliseCurrency(order.currency, currency) !== currency) throw Object.assign(new Error('Order currency does not match the organization currency'), { statusCode: 409, code: 'CURRENCY_MISMATCH' });
    if (amountMinor > Number(order.total_minor)) throw Object.assign(new Error('Payment amount cannot exceed the order total'), { statusCode: 400, code: 'PAYMENT_AMOUNT_EXCEEDS_ORDER' });
  }
  const id = String(input.id || crypto.randomUUID());
  const now = nowIso();
  db.prepare("INSERT INTO payment_intents (id, organization_id, location_id, order_id, payment_account_id, provider_id, amount_minor, currency, status, expires_at, metadata_json, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?)").run(
    id, organizationId, locationId, orderId ? String(orderId) : null, accountId ? String(accountId) : null,
    providerId, amountMinor, currency, input.expiresAt || input.expires_at || null,
    json(input.metadata || {}), actor?.userId || null, now, now
  );
  return paymentIntentFromRow(db.prepare('SELECT * FROM payment_intents WHERE id = ?').get(id));
}
export async function insertPaymentEvidence(chatId, input = {}, actor = null) {
  ensureDatabase();
  assertUntrustedPaymentEvidenceShape(input);
  const { organizationId, locationId } = await resolvePaymentContext(chatId, input);
  const intentId = String(input.paymentIntentId || input.payment_intent_id || '').trim();
  if (!intentId) throw Object.assign(new Error('paymentIntentId is required'), { statusCode: 400, code: 'PAYMENT_INTENT_REQUIRED' });
  const intent = db.prepare('SELECT * FROM payment_intents WHERE id = ? AND organization_id = ?').get(intentId, organizationId);
  if (!intent) throw Object.assign(new Error('Payment intent not found'), { statusCode: 404, code: 'PAYMENT_INTENT_NOT_FOUND' });
  const paymentId = input.paymentId || input.payment_id || null;
  if (paymentId) {
    const payment = db.prepare('SELECT id FROM payments WHERE id = ? AND organization_id = ?').get(String(paymentId), organizationId);
    if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
  }
  const providerId = String(input.providerId || input.provider_id || intent.provider_id).trim().toLowerCase();
  if (providerId !== String(intent.provider_id)) throw Object.assign(new Error('Evidence provider does not match payment intent provider'), { statusCode: 409, code: 'PROVIDER_MISMATCH' });
  const channel = String(input.channel || 'manual').trim().toLowerCase();
  const evidenceType = String(input.evidenceType || input.evidence_type || '').trim().toUpperCase();
  const source = normalizePaymentEvidenceSource(input.source);
  if (!evidenceType) throw Object.assign(new Error('evidenceType is required'), { statusCode: 400, code: 'EVIDENCE_TYPE_REQUIRED' });
  const rawPayload = input.rawPayload ?? input.raw_payload ?? input.payload ?? null;
  const normalizedPayload = input.normalizedPayload ?? input.normalized_payload ?? null;
  const fingerprint = String(input.fingerprint || hashPaymentRequest({ providerId, channel, evidenceType, externalReference: input.externalReference || input.external_reference || null, providerTransactionId: input.providerTransactionId || input.provider_transaction_id || null, normalizedPayload, rawPayload })).trim();
  if (!fingerprint) throw Object.assign(new Error('Evidence fingerprint is required'), { statusCode: 400, code: 'EVIDENCE_FINGERPRINT_REQUIRED' });
  const duplicate = db.prepare('SELECT * FROM payment_evidence WHERE organization_id = ? AND provider_id = ? AND fingerprint = ?').get(organizationId, providerId, fingerprint);
  if (duplicate) return { evidence: paymentEvidenceFromRow(duplicate), duplicate: true };
  const id = String(input.id || crypto.randomUUID()); const now = nowIso();
  try {
    db.prepare("INSERT INTO payment_evidence (id, organization_id, location_id, payment_id, payment_intent_id, provider_id, channel, evidence_type, external_reference, provider_transaction_id, fingerprint, raw_payload_json, normalized_payload_json, source, observed_at, received_at, submitted_by_user_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?)").run(
      id, organizationId, locationId, paymentId ? String(paymentId) : null, intentId, providerId, channel, evidenceType,
      input.externalReference || input.external_reference || null, input.providerTransactionId || input.provider_transaction_id || null,
      fingerprint, rawPayload == null ? null : json(rawPayload), normalizedPayload == null ? null : json(normalizedPayload),
      source, input.observedAt || input.observed_at || null, now,
      source === 'caller.submitted' ? (actor?.userId || null) : null, now, now
    );
  } catch (error) {
    if (String(error?.message || '').includes('UNIQUE constraint failed: payment_evidence')) {
      const existing = db.prepare('SELECT * FROM payment_evidence WHERE organization_id = ? AND provider_id = ? AND fingerprint = ?').get(organizationId, providerId, fingerprint);
      if (existing) return { evidence: paymentEvidenceFromRow(existing), duplicate: true };
    }
    throw error;
  }
  const persistedEvidence = paymentEvidenceFromRow(db.prepare('SELECT * FROM payment_evidence WHERE id = ?').get(id));
  audit(String(chatId), 'payment.evidence.recorded', 'payment_evidence', id, {
    paymentId: persistedEvidence.paymentId,
    paymentIntentId: persistedEvidence.paymentIntentId,
    providerId: persistedEvidence.providerId,
    evidenceType: persistedEvidence.evidenceType,
    fingerprint: persistedEvidence.fingerprint,
    source: persistedEvidence.source,
    observedAt: persistedEvidence.observedAt,
  }, {
    organizationId,
    locationId,
    actorId: actor?.userId || null,
    deviceId: actor?.deviceId || null,
    lineageType: 'payment_evidence',
    lineageId: id,
  });
  return { evidence: persistedEvidence, duplicate: false };
}
export async function listPaymentEvidence(chatId, paymentId) {
  ensureDatabase();
  const payment = await getPayment(chatId, paymentId);
  if (!payment) return null;
  return db.prepare('SELECT * FROM payment_evidence WHERE payment_id = ? AND organization_id = ? ORDER BY created_at DESC').all(String(paymentId), payment.organizationId).map(paymentEvidenceFromRow);
}
export async function insertPaymentVerification(chatId, input = {}, actor = null) {
  ensureDatabase();
  const { organizationId } = await resolvePaymentContext(chatId);
  const evidence = db.prepare('SELECT * FROM payment_evidence WHERE id = ? AND organization_id = ?').get(String(input.evidenceId || input.evidence_id), organizationId);
  if (!evidence) throw Object.assign(new Error('Evidence not found'), { statusCode: 404, code: 'EVIDENCE_NOT_FOUND' });

  const paymentId = String(input.paymentId || input.payment_id || evidence.payment_id || '').trim() || null;
  const paymentIntentId = String(input.paymentIntentId || input.payment_intent_id || evidence.payment_intent_id || '').trim() || null;
  const providerId = String(input.providerId || input.provider_id || evidence.provider_id || '').trim().toLowerCase();
  if (paymentId && evidence.payment_id && String(evidence.payment_id) !== paymentId) {
    throw Object.assign(new Error('Verification payment does not match evidence payment'), { statusCode: 409, code: 'VERIFICATION_PAYMENT_MISMATCH' });
  }
  if (paymentIntentId && evidence.payment_intent_id && String(evidence.payment_intent_id) !== paymentIntentId) {
    throw Object.assign(new Error('Verification payment intent does not match evidence intent'), { statusCode: 409, code: 'VERIFICATION_INTENT_MISMATCH' });
  }
  if (providerId !== String(evidence.provider_id || '').toLowerCase()) {
    throw Object.assign(new Error('Verification provider does not match evidence provider'), { statusCode: 409, code: 'VERIFICATION_PROVIDER_MISMATCH' });
  }
  if (paymentId) {
    const payment = db.prepare('SELECT id, payment_intent_id, provider_id FROM payments WHERE id = ? AND organization_id = ?').get(paymentId, organizationId);
    if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
    if (paymentIntentId && String(payment.payment_intent_id || '') !== paymentIntentId) {
      throw Object.assign(new Error('Verification payment intent does not match payment'), { statusCode: 409, code: 'VERIFICATION_INTENT_MISMATCH' });
    }
    if (String(payment.provider_id || '').toLowerCase() !== providerId) {
      throw Object.assign(new Error('Verification provider does not match payment'), { statusCode: 409, code: 'VERIFICATION_PROVIDER_MISMATCH' });
    }
  }
  if (paymentIntentId) {
    const intent = db.prepare('SELECT id, provider_id FROM payment_intents WHERE id = ? AND organization_id = ?').get(paymentIntentId, organizationId);
    if (!intent) throw Object.assign(new Error('Payment intent not found'), { statusCode: 404, code: 'PAYMENT_INTENT_NOT_FOUND' });
    if (String(intent.provider_id || '').toLowerCase() !== providerId) {
      throw Object.assign(new Error('Verification provider does not match payment intent'), { statusCode: 409, code: 'VERIFICATION_PROVIDER_MISMATCH' });
    }
  }
  const id = String(input.id || crypto.randomUUID()); const now = nowIso();
  const observedTransactionId = String(input.observedTransactionId || input.observed_transaction_id || '').trim() || null;
  if (observedTransactionId) {
    const bound = db.prepare(`
      SELECT id, payment_id
      FROM payment_verifications
      WHERE organization_id = ? AND provider_id = ? AND observed_transaction_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(organizationId, providerId, observedTransactionId);
    if (bound && String(bound.payment_id || '') !== String(paymentId || '')) {
      throw Object.assign(new Error('Provider transaction identity is already bound to another payment'), {
        statusCode: 409, code: 'PROVIDER_TRANSACTION_DUPLICATE',
        paymentId: bound.payment_id, verificationId: bound.id,
      });
    }
  }
  const verifier = String(input.verifier || '').trim();
  if (!verifier.startsWith('payment-core.')) {
    throw Object.assign(new Error('Payment verification must originate from a trusted Payment Core verifier'), {
      statusCode: 409, code: 'UNTRUSTED_PAYMENT_VERIFIER',
    });
  }
  const verifierVersion = String(input.verifierVersion || input.verifier_version || '').trim();
  if (!verifierVersion || verifierVersion.length > 64) {
    throw Object.assign(new Error('Trusted verifier version is required and bounded'), {
      statusCode: 409, code: 'INVALID_VERIFIER_VERSION',
    });
  }
  const provenanceSource = 'PAYMENT_CORE';
  const provenanceOperation = verifier === 'payment-core.provider-status'
    ? 'provider-status'
    : verifier.replace(/^payment-core\./, '') || 'unknown';
  const existing = db.prepare(
    'SELECT * FROM payment_verifications WHERE evidence_id = ? AND verifier = ? AND (verifier_version = ? OR (verifier_version IS NULL AND ? IS NULL)) ORDER BY created_at DESC LIMIT 1'
  ).get(evidence.id, verifier, verifierVersion, verifierVersion);
  if (existing) return { verification: paymentVerificationFromRow(existing), duplicate: true };

  const result = String(input.result || '').toUpperCase();
  if (!['MATCH','MISMATCH','DUPLICATE','UNVERIFIABLE','EXPIRED','PENDING','ERROR'].includes(result)) {
    throw Object.assign(new Error('Invalid payment verification result'), { statusCode: 400, code: 'INVALID_PAYMENT_VERIFICATION_RESULT' });
  }

  try {
    db.prepare("INSERT INTO payment_verifications (id, organization_id, payment_id, payment_intent_id, evidence_id, provider_id, result, confidence, observed_amount_minor, observed_currency, observed_receiver, observed_receiver_account, observed_reference, observed_transaction_id, observed_at, reason_codes_json, raw_result_json, verifier, verifier_version, provenance_source, provenance_operation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      id, organizationId, paymentId, paymentIntentId,
      evidence.id, providerId, result,
      input.confidence == null ? null : Number(input.confidence), input.observedAmountMinor ?? input.observed_amount_minor ?? null,
      input.observedCurrency || input.observed_currency || null, input.observedReceiver || input.observed_receiver || null,
      input.observedReceiverAccount || input.observed_receiver_account || null, input.observedReference || input.observed_reference || null,
      observedTransactionId, input.observedAt || input.observed_at || null,
      json(input.reasonCodes || input.reason_codes || []), input.rawResult == null ? null : json(input.rawResult || input.raw_result),
      verifier, verifierVersion, provenanceSource, provenanceOperation, now
    );
  } catch (error) {
    if (String(error?.message || '').includes('uq_payment_verifications_provider_transaction') ||
        String(error?.message || '').includes('UNIQUE constraint failed: payment_verifications.organization_id, payment_verifications.provider_id, payment_verifications.observed_transaction_id')) {
      const conflicting = observedTransactionId
        ? db.prepare('SELECT * FROM payment_verifications WHERE organization_id = ? AND provider_id = ? AND observed_transaction_id = ? ORDER BY created_at DESC LIMIT 1')
          .get(organizationId, providerId, observedTransactionId)
        : null;
      if (conflicting && String(conflicting.payment_id || '') !== String(paymentId || '')) {
        throw Object.assign(new Error('Provider transaction identity is already bound to another payment'), {
          statusCode: 409, code: 'PROVIDER_TRANSACTION_DUPLICATE',
          paymentId: conflicting.payment_id, verificationId: conflicting.id,
        });
      }
      const existing = db.prepare(
        'SELECT * FROM payment_verifications WHERE evidence_id = ? AND verifier = ? AND (verifier_version = ? OR (verifier_version IS NULL AND ? IS NULL)) ORDER BY created_at DESC LIMIT 1'
      ).get(evidence.id, verifier, verifierVersion, verifierVersion);
      if (existing) return { verification: paymentVerificationFromRow(existing), duplicate: true };
    }
    throw error;
  }
  const persistedVerification = paymentVerificationFromRow(db.prepare('SELECT * FROM payment_verifications WHERE id = ?').get(id));
  audit(String(chatId), 'payment.verification.recorded', 'payment_verification', id, {
    paymentId: persistedVerification.paymentId,
    paymentIntentId: persistedVerification.paymentIntentId,
    evidenceId: persistedVerification.evidenceId,
    providerId: persistedVerification.providerId,
    result: persistedVerification.result,
    observedTransactionId: persistedVerification.observedTransactionId,
    observedAt: persistedVerification.observedAt,
    verifier: persistedVerification.verifier,
    verifierVersion: persistedVerification.verifierVersion,
    provenanceSource: persistedVerification.provenanceSource,
    provenanceOperation: persistedVerification.provenanceOperation,
  }, {
    organizationId,
    lineageType: 'payment_verification',
    lineageId: id,
    actorId: actor?.userId || null,
    deviceId: actor?.deviceId || null,
  });
  return { verification: persistedVerification, duplicate: false };
}
export async function listPaymentVerifications(chatId, paymentId) {
  ensureDatabase();
  const payment = await getPayment(chatId, paymentId);
  if (!payment) return null;
  return db.prepare('SELECT * FROM payment_verifications WHERE payment_id = ? AND organization_id = ? ORDER BY created_at DESC').all(String(paymentId), payment.organizationId).map(paymentVerificationFromRow);
}
export async function insertPaymentDecision(chatId, input = {}, actor = null) {
  ensureDatabase();
  const { organizationId } = await resolvePaymentContext(chatId);
  const paymentId = String(input.paymentId || input.payment_id || '').trim();
  if (!paymentId) throw Object.assign(new Error('paymentId is required'), { statusCode: 400, code: 'PAYMENT_REQUIRED' });
  const payment = db.prepare('SELECT id FROM payments WHERE id = ? AND organization_id = ?').get(paymentId, organizationId);
  if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
  const decisionIntentId = String(input.paymentIntentId || input.payment_intent_id || '').trim() || null;
  const decisionEvidenceId = String(input.evidenceId || input.evidence_id || '').trim() || null;
  const decisionVerificationId = String(input.verificationId || input.verification_id || '').trim() || null;
  if (decisionVerificationId) {
    const verification = db.prepare('SELECT payment_id, payment_intent_id, evidence_id, provider_id FROM payment_verifications WHERE id = ? AND organization_id = ?').get(decisionVerificationId, organizationId);
    if (!verification) throw Object.assign(new Error('Decision verification not found'), { statusCode: 409, code: 'DECISION_VERIFICATION_NOT_FOUND' });
    if (String(verification.payment_id || '') !== paymentId || String(verification.payment_intent_id || '') !== decisionIntentId || (decisionEvidenceId && String(verification.evidence_id || '') !== decisionEvidenceId)) {
      throw Object.assign(new Error('Decision verification context does not match decision'), { statusCode: 409, code: 'DECISION_VERIFICATION_CONTEXT_MISMATCH' });
    }
  }
  const id = String(input.id || crypto.randomUUID()); const now = nowIso();
  const decisionSource = String(input.decisionSource || input.decision_source || 'PAYMENT_CORE').trim().toUpperCase();
  if (decisionSource !== 'PAYMENT_CORE') {
    throw Object.assign(new Error('Payment decisions must originate from Payment Core'), {
      statusCode: 409, code: 'UNTRUSTED_PAYMENT_DECISION_SOURCE',
    });
  }
  db.prepare("INSERT INTO payment_decisions (id, organization_id, payment_id, payment_intent_id, evidence_id, verification_id, decision, target_state, reason_codes_json, invariant_results_json, decision_source, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    id, organizationId, paymentId, decisionIntentId, decisionEvidenceId,
    decisionVerificationId, String(input.decision || '').toUpperCase(), input.targetState || input.target_state || null,
    json(input.reasonCodes || input.reason_codes || []), json(input.invariantResults || input.invariant_results || {}),
    decisionSource, actor?.userId || null, now
  );
  return paymentDecisionFromRow(db.prepare('SELECT * FROM payment_decisions WHERE id = ?').get(id));
}
export async function listPaymentDecisions(chatId, paymentId) {
  ensureDatabase();
  const payment = await getPayment(chatId, paymentId);
  if (!payment) return null;
  return db.prepare('SELECT * FROM payment_decisions WHERE payment_id = ? AND organization_id = ? ORDER BY created_at DESC').all(String(paymentId), payment.organizationId).map(paymentDecisionFromRow);
}
export async function getPaymentIdempotency(chatId, key, commandType) {
  ensureDatabase();
  const { organizationId } = await resolvePaymentContext(chatId);
  return db.prepare('SELECT * FROM payment_idempotency_keys WHERE organization_id = ? AND idempotency_key = ? AND command_type = ?').get(organizationId, String(key), String(commandType));
}
export async function insertPaymentIdempotency(chatId, input = {}) {
  ensureDatabase();
  const { organizationId } = await resolvePaymentContext(chatId);
  const now = nowIso();
  db.prepare("INSERT INTO payment_idempotency_keys (id, organization_id, idempotency_key, command_type, request_hash, response_status, response_json, resource_type, resource_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    String(input.id || crypto.randomUUID()), organizationId, String(input.idempotencyKey || input.idempotency_key), String(input.commandType || input.command_type),
    String(input.requestHash || input.request_hash), input.responseStatus ?? input.response_status ?? null,
    input.responseJson == null && input.response_json == null ? null : String(input.responseJson ?? input.response_json),
    input.resourceType || input.resource_type || null, input.resourceId || input.resource_id || null, now, input.expiresAt || input.expires_at || null
  );
  return getPaymentIdempotency(chatId, input.idempotencyKey || input.idempotency_key, input.commandType || input.command_type);
}
export async function commitPaymentDecision(chatId, input = {}, actor = null) {
  ensureDatabase();
  const { organizationId } = await resolvePaymentContext(chatId);
  const paymentId = String(input.paymentId || input.payment_id || '').trim();
  if (!paymentId) throw Object.assign(new Error('paymentId is required'), { statusCode: 400, code: 'PAYMENT_REQUIRED' });
  const target = String(input.targetState || input.target_state || '').toUpperCase();
  if (!PAYMENT_STATES.has(target)) throw Object.assign(new Error('Invalid payment target state'), { statusCode: 400, code: 'INVALID_PAYMENT_STATE' });
  const expectedState = String(input.expectedState || input.expected_state || '').toUpperCase();
  const idempotencyKey = String(input.idempotencyKey || input.idempotency_key || '').trim();
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({ paymentId, target, expectedState, reason: String(input.decision?.reason || input.reason || ''), decision: input.decision || {} })).digest('hex');
  const now = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    if (idempotencyKey) {
      const existingCommand = db.prepare('SELECT * FROM payment_idempotency_keys WHERE organization_id = ? AND idempotency_key = ? AND command_type = ?').get(organizationId, idempotencyKey, 'TRANSITION_LIFECYCLE');
      if (existingCommand) {
        if (String(existingCommand.request_hash) !== requestHash) throw Object.assign(new Error('Idempotency key was already used with a different request'), { statusCode: 409, code: 'IDEMPOTENCY_KEY_REUSE' });
        const replay = JSON.parse(existingCommand.response_json || '{}');
        db.exec('COMMIT');
        return replay.payment || replay;
      }
    }
    const row = db.prepare('SELECT * FROM payments WHERE id = ? AND organization_id = ?').get(paymentId, organizationId);
    if (!row) throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
    if (expectedState && row.state !== expectedState) throw Object.assign(new Error('Payment state changed before decision could commit'), { statusCode: 409, code: 'PAYMENT_STATE_CONFLICT' });
    if (row.state !== target && !PAYMENT_TRANSITIONS[row.state]?.has(target)) throw Object.assign(new Error('Invalid payment transition'), { statusCode: 409, code: 'INVALID_PAYMENT_TRANSITION' });
    if (input.verification) {
      const v = input.verification;
      const verificationPaymentIntentId = String(v.paymentIntentId || v.payment_intent_id || row.payment_intent_id || '').trim() || null;
      const verificationEvidenceId = String(v.evidenceId || v.evidence_id || '').trim() || null;
      const verificationProviderId = String(v.providerId || v.provider_id || row.provider_id || '').trim().toLowerCase();
      if (!verificationEvidenceId) throw Object.assign(new Error('Decision verification requires evidenceId'), { statusCode: 409, code: 'VERIFICATION_EVIDENCE_REQUIRED' });
      const evidenceRow = db.prepare('SELECT payment_id, payment_intent_id, provider_id, provider_transaction_id FROM payment_evidence WHERE id = ? AND organization_id = ?').get(verificationEvidenceId, organizationId);
      if (!evidenceRow) throw Object.assign(new Error('Decision verification evidence not found'), { statusCode: 409, code: 'VERIFICATION_EVIDENCE_NOT_FOUND' });
      if (String(evidenceRow.payment_id || '') !== paymentId || String(evidenceRow.payment_intent_id || '') !== verificationPaymentIntentId || String(evidenceRow.provider_id || '').toLowerCase() !== verificationProviderId) {
        throw Object.assign(new Error('Verification is not bound to the decision payment context'), { statusCode: 409, code: 'VERIFICATION_CONTEXT_MISMATCH' });
      }
      if (String(row.payment_intent_id || '') !== verificationPaymentIntentId || String(row.provider_id || '').toLowerCase() !== verificationProviderId) {
        throw Object.assign(new Error('Verification does not match payment context'), { statusCode: 409, code: 'VERIFICATION_CONTEXT_MISMATCH' });
      }

      // GAP-1.18L: authoritative financial transitions must re-check the
      // canonical payment obligation inside the same transaction immediately
      // before state/ledger mutation. Provider success alone is insufficient.
      if (['VERIFIED', 'RECONCILED'].includes(target)) {
        const observedAmount = Number(v.observedAmountMinor ?? v.observed_amount_minor);
        const expectedAmount = Number(row.amount_minor);
        if (!Number.isInteger(observedAmount) || observedAmount !== expectedAmount) {
          throw Object.assign(new Error('Verification amount does not match payment obligation'), {
            statusCode: 409, code: 'VERIFICATION_AMOUNT_MISMATCH',
          });
        }

        const observedCurrency = String(v.observedCurrency || v.observed_currency || '').trim().toUpperCase();
        const expectedCurrency = normaliseCurrency(row.currency, 'ETB');
        if (!observedCurrency || observedCurrency !== expectedCurrency) {
          throw Object.assign(new Error('Verification currency does not match payment obligation'), {
            statusCode: 409, code: 'VERIFICATION_CURRENCY_MISMATCH',
          });
        }

        const intent = db.prepare('SELECT amount_minor, currency FROM payment_intents WHERE id = ? AND organization_id = ?').get(verificationPaymentIntentId, organizationId);
        if (!intent || Number(intent.amount_minor) !== expectedAmount || normaliseCurrency(intent.currency, expectedCurrency) !== expectedCurrency) {
          throw Object.assign(new Error('Payment intent financial obligation does not match payment'), {
            statusCode: 409, code: 'VERIFICATION_INTENT_FINANCIAL_MISMATCH',
          });
        }

        const account = db.prepare('SELECT account_identifier FROM payment_accounts WHERE id = ? AND organization_id = ?').get(row.payment_account_id, organizationId);
        const expectedReceiver = String(account?.account_identifier || '').trim();
        const observedReceiver = String(v.observedReceiverAccount || v.observed_receiver_account || '').trim();
        if (!expectedReceiver || !observedReceiver || expectedReceiver !== observedReceiver) {
          throw Object.assign(new Error('Verification receiver does not match payment account'), {
            statusCode: 409, code: 'VERIFICATION_RECEIVER_MISMATCH',
          });
        }

        const expectedReference = String(row.external_reference || '').trim();
        const observedReference = String(v.observedReference || v.observed_reference || '').trim();
        if (expectedReference && (!observedReference || expectedReference !== observedReference)) {
          throw Object.assign(new Error('Verification reference does not match payment obligation'), {
            statusCode: 409, code: 'VERIFICATION_REFERENCE_MISMATCH',
          });
        }

        const observedTransactionId = String(v.observedTransactionId || v.observed_transaction_id || '').trim();
        const evidenceTransactionId = String(evidenceRow.provider_transaction_id || '').trim();
        if (!observedTransactionId || !evidenceTransactionId || observedTransactionId !== evidenceTransactionId) {
          throw Object.assign(new Error('Verification transaction identity is not bound to evidence'), {
            statusCode: 409, code: 'VERIFICATION_TRANSACTION_MISMATCH',
          });
        }

        const reusedTransaction = db.prepare(`
          SELECT id, payment_id
          FROM payment_verifications
          WHERE organization_id = ?
            AND provider_id = ?
            AND observed_transaction_id = ?
            AND payment_id <> ?
          ORDER BY created_at DESC
          LIMIT 1
        `).get(organizationId, verificationProviderId, observedTransactionId, paymentId);
        if (reusedTransaction) {
          throw Object.assign(new Error('Provider transaction identity is already bound to another payment'), {
            statusCode: 409, code: 'PROVIDER_TRANSACTION_DUPLICATE',
            paymentId: reusedTransaction.payment_id,
            verificationId: reusedTransaction.id,
          });
        }
      }

      assertVerificationFreshness({
        observedAt: v.observedAt || v.observed_at || null,
        createdAt: null,
        now: new Date(now),
        maxAgeMs: input.maxVerificationAgeMs || input.max_verification_age_ms,
      });
      const verificationId = String(v.id || crypto.randomUUID());
      const verifier = String(v.verifier || '').trim();
      if (!verifier.startsWith('payment-core.')) {
        throw Object.assign(new Error('Payment verification must originate from a trusted Payment Core verifier'), {
          statusCode: 409, code: 'UNTRUSTED_PAYMENT_VERIFIER',
        });
      }
      const verifierVersion = String(v.verifierVersion || v.verifier_version || '').trim();
      if (!verifierVersion || verifierVersion.length > 64) {
        throw Object.assign(new Error('Trusted verifier version is required and bounded'), {
          statusCode: 409, code: 'INVALID_VERIFIER_VERSION',
        });
      }
      const provenanceSource = 'PAYMENT_CORE';
      const provenanceOperation = verifier === 'payment-core.provider-status'
        ? 'provider-status'
        : verifier.replace(/^payment-core\./, '') || 'unknown';
      const existingVerification = db.prepare('SELECT id FROM payment_verifications WHERE evidence_id = ? AND verifier = ? AND verifier_version = ?').get(verificationEvidenceId, verifier, verifierVersion);
      if (!existingVerification) db.prepare("INSERT INTO payment_verifications (id, organization_id, payment_id, payment_intent_id, evidence_id, provider_id, result, confidence, observed_amount_minor, observed_currency, observed_receiver, observed_receiver_account, observed_reference, observed_transaction_id, observed_at, reason_codes_json, raw_result_json, verifier, verifier_version, provenance_source, provenance_operation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
        verificationId, organizationId, paymentId, verificationPaymentIntentId, verificationEvidenceId,
        verificationProviderId, String(v.result || '').toUpperCase(), v.confidence == null ? null : Number(v.confidence),
        v.observedAmountMinor ?? v.observed_amount_minor ?? null, v.observedCurrency || v.observed_currency || null,
        v.observedReceiver || v.observed_receiver || null, v.observedReceiverAccount || v.observed_receiver_account || null,
        v.observedReference || v.observed_reference || null, v.observedTransactionId || v.observed_transaction_id || null,
        v.observedAt || v.observed_at || null, json(v.reasonCodes || v.reason_codes || []),
        v.rawResult == null ? null : json(v.rawResult || v.raw_result), verifier, verifierVersion, provenanceSource, provenanceOperation, now
      );
    }
    const decision = input.decision || {};
    const decisionVerificationId = String(decision.verificationId || decision.verification_id || (input.verification ? (db.prepare('SELECT id FROM payment_verifications WHERE evidence_id = ? AND verifier = ? AND verifier_version = ?').get(
      String(input.verification.evidenceId || input.verification.evidence_id), verifier, verifierVersion
    )?.id || '') : '')).trim() || null;
    if (decisionVerificationId) {
      const linked = db.prepare('SELECT payment_id, payment_intent_id, evidence_id FROM payment_verifications WHERE id = ? AND organization_id = ?').get(decisionVerificationId, organizationId);
      if (!linked || String(linked.payment_id) !== paymentId || String(linked.payment_intent_id || '') !== String(decision.paymentIntentId || decision.payment_intent_id || row.payment_intent_id || '') || String(linked.evidence_id || '') !== String(decision.evidenceId || decision.evidence_id || input.verification?.evidenceId || input.verification?.evidence_id || '')) {
        throw Object.assign(new Error('Decision verification reference is not bound to the committed context'), { statusCode: 409, code: 'DECISION_VERIFICATION_CONTEXT_MISMATCH' });
      }
    }
    const decisionId = String(decision.id || crypto.randomUUID());
    db.prepare("INSERT INTO payment_decisions (id, organization_id, payment_id, payment_intent_id, evidence_id, verification_id, decision, target_state, reason_codes_json, invariant_results_json, decision_source, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      decisionId, organizationId, paymentId, decision.paymentIntentId || decision.payment_intent_id || row.payment_intent_id || null,
      decision.evidenceId || decision.evidence_id || input.verification?.evidenceId || input.verification?.evidence_id || null, decisionVerificationId,
      String(decision.decision || '').toUpperCase(), target, json(decision.reasonCodes || decision.reason_codes || []),
      json(decision.invariantResults || decision.invariant_results || {}), decision.decisionSource || 'PAYMENT_CORE', actor?.userId || null, now
    );
    const result = db.prepare("UPDATE payments SET state = ?, updated_at = ?, claimed_at = CASE WHEN ? = 'CLAIMED' THEN ? ELSE claimed_at END, received_at = CASE WHEN ? = 'RECEIVED' THEN ? ELSE received_at END, verified_at = CASE WHEN ? = 'VERIFIED' THEN ? ELSE verified_at END, reconciled_at = CASE WHEN ? = 'RECONCILED' THEN ? ELSE reconciled_at END WHERE id = ? AND organization_id = ?" + (expectedState ? " AND state = ?" : ""))
      .run(target, now, target, now, target, now, target, now, target, now, paymentId, organizationId, ...(expectedState ? [expectedState] : []));
    if (Number(result.changes || 0) !== 1) throw Object.assign(new Error('Payment state changed before commit'), { statusCode: 409, code: 'PAYMENT_STATE_CONFLICT' });
    db.prepare("INSERT INTO payment_ledger_entries (id, payment_id, organization_id, entry_type, amount_minor, currency, from_state, to_state, actor_id, reason, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      crypto.randomUUID(), paymentId, organizationId, String(decision.entryType || target), Number(row.amount_minor), normaliseCurrency(row.currency, 'ETB'),
      row.state, target, actor?.userId || null, String(decision.reason || ''), json(decision.metadata || {}), now
    );
    const marketplaceAllocation = db.prepare("SELECT a.*, so.id AS canonical_seller_order_id FROM marketplace_payment_allocations a JOIN marketplace_seller_orders so ON so.id = a.seller_order_id WHERE a.payment_id = ? LIMIT 1").get(paymentId);
    if (marketplaceAllocation) {
      if (target === 'REFUNDED') {
        db.prepare("UPDATE marketplace_payment_allocations SET status = 'REFUNDED', updated_at = ? WHERE id = ?").run(now, marketplaceAllocation.id);
        db.prepare("UPDATE marketplace_settlements SET status = 'REVERSED' WHERE seller_order_id = ? AND status IN ('PENDING','READY','HELD')").run(marketplaceAllocation.canonical_seller_order_id);
      } else if (['VERIFIED','RECONCILED'].includes(target) && Number(row.amount_minor) === Number(marketplaceAllocation.amount_minor)) {
        db.prepare("UPDATE marketplace_payment_allocations SET status = 'ALLOCATED', updated_at = ? WHERE id = ?").run(now, marketplaceAllocation.id);
        db.prepare("UPDATE marketplace_settlements SET status = 'READY' WHERE seller_order_id = ? AND status = 'PENDING'").run(marketplaceAllocation.canonical_seller_order_id);
      }
    }
    audit(String(chatId), 'payment.' + target.toLowerCase(), 'payment', paymentId, {
      fromState: row.state,
      toState: target,
      decision: decision.decision || null,
      reasonCodes: decision.reasonCodes || decision.reason_codes || [],
      evidenceId: input.verification?.evidenceId || input.verification?.evidence_id || decision.evidenceId || decision.evidence_id || null,
      verificationId: decisionVerificationId,
      decisionId,
    }, {
      organizationId,
      locationId: row.location_id,
      actorId: actor?.userId || null,
      deviceId: actor?.deviceId || null,
      reason: decision.reason || '',
      lineageType: 'payment_decision',
      lineageId: decisionId,
    });
    const committedPayment = paymentFromRow(db.prepare('SELECT * FROM payments WHERE id = ? AND organization_id = ?').get(paymentId, organizationId));
    if (idempotencyKey) {
      const response = { payment: committedPayment, transition: { fromState: row.state, toState: target, reason: decision.reason || '' } };
      db.prepare("INSERT INTO payment_idempotency_keys (id, organization_id, idempotency_key, command_type, request_hash, response_status, response_json, resource_type, resource_id, created_at) VALUES (?, ?, ?, 'TRANSITION_LIFECYCLE', ?, 200, ?, 'payment', ?, ?, ?)").run(crypto.randomUUID(), organizationId, idempotencyKey, requestHash, json(response), paymentId, now);
    }
    db.exec('COMMIT');
    return committedPayment;
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
}


const PAYMENT_STATES = new Set(['UNPAID','CLAIMED','RECEIVED','VERIFIED','RECONCILED','REJECTED','FAILED','DUPLICATE','MISMATCH','EXPIRED','CANCELLED','PARTIAL','REVERSED','REFUNDED']);
const PAYMENT_TRANSITIONS = Object.freeze({
  UNPAID: new Set(['CLAIMED','RECEIVED','FAILED','EXPIRED','CANCELLED']),
  CLAIMED: new Set(['RECEIVED','VERIFIED','FAILED','REJECTED','DUPLICATE','MISMATCH','EXPIRED','CANCELLED','PARTIAL']),
  RECEIVED: new Set(['VERIFIED','RECONCILED','FAILED','REJECTED','MISMATCH','PARTIAL','CANCELLED']),
  VERIFIED: new Set(['RECONCILED','REVERSED','REFUNDED','MISMATCH']),
  RECONCILED: new Set(['REVERSED','REFUNDED']),
  REJECTED: new Set(), FAILED: new Set(), DUPLICATE: new Set(), MISMATCH: new Set(['RECEIVED','VERIFIED','REJECTED']),
  EXPIRED: new Set(['RECEIVED']), CANCELLED: new Set(['RECEIVED']),
  PARTIAL: new Set(['RECEIVED','VERIFIED','FAILED','REJECTED']), REVERSED: new Set(), REFUNDED: new Set(),
});

function paymentStateTimestampColumn(state) {
  return ({ CLAIMED: 'claimed_at', RECEIVED: 'received_at', VERIFIED: 'verified_at', RECONCILED: 'reconciled_at' })[state] || null;
}

function syncMarketplacePaymentAllocation(serverOrderId, paymentId, amountMinor, paymentState = 'UNPAID') {
  const canonicalSeller = db.prepare(`
    SELECT so.*
    FROM marketplace_seller_orders so
    LEFT JOIN orders o ON o.local_id = so.seller_order_id
    WHERE so.seller_order_id = ? OR o.server_order_id = ?
    LIMIT 1
  `).get(String(serverOrderId), String(serverOrderId));
  if (!canonicalSeller) return null;

  const amount = Number(amountMinor);
  if (!Number.isInteger(amount) || amount < 0) {
    throw Object.assign(new Error('Payment amount must be a non-negative integer'), { statusCode: 400, code: 'INVALID_PAYMENT_AMOUNT' });
  }
  if (amount === 0) return null;

  const paymentIdText = String(paymentId);
  const existingPayment = db.prepare(`
    SELECT * FROM marketplace_payment_allocations
    WHERE seller_order_id = ? AND payment_id = ?
    LIMIT 1
  `).get(canonicalSeller.id, paymentIdText);

  const targetAmount = Number(db.prepare(`
    SELECT amount_minor FROM marketplace_payment_allocations
    WHERE seller_order_id = ?
    ORDER BY created_at ASC LIMIT 1
  `).get(canonicalSeller.id)?.amount_minor || 0);

  if (!targetAmount) return null;

  const priorForPayment = Number(existingPayment?.amount_minor || 0);
  const otherVerifiedAmount = Number(db.prepare(`
    SELECT COALESCE(SUM(a.amount_minor), 0) AS total
    FROM marketplace_payment_allocations a
    JOIN payments p ON p.id = a.payment_id
    WHERE a.seller_order_id = ?
      AND a.payment_id IS NOT NULL
      AND a.payment_id <> ?
      AND p.state IN ('VERIFIED','RECONCILED')
      AND a.status <> 'REFUNDED'
  `).get(canonicalSeller.id, paymentIdText)?.total || 0);

  if (otherVerifiedAmount + amount > targetAmount) {
    throw Object.assign(new Error('Payment amount exceeds the remaining marketplace seller allocation'), {
      statusCode: 400,
      code: 'MARKETPLACE_PAYMENT_ALLOCATION_EXCEEDED',
    });
  }

  const verified = ['VERIFIED', 'RECONCILED'].includes(String(paymentState).toUpperCase());

  if (existingPayment) {
    db.prepare(`
      UPDATE marketplace_payment_allocations
      SET amount_minor = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(amount, verified && otherVerifiedAmount + amount >= targetAmount ? 'ALLOCATED' : 'PARTIAL', nowIso(), existingPayment.id);
  } else {
    const allocationId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO marketplace_payment_allocations
        (id, marketplace_order_id, seller_order_id, payment_id, organization_id, amount_minor, currency, status, created_at, updated_at)
      SELECT ?, marketplace_order_id, seller_order_id, ?, organization_id, ?, currency, ?, ?, ?
      FROM marketplace_payment_allocations
      WHERE seller_order_id = ?
      ORDER BY created_at ASC LIMIT 1
    `).run(
      allocationId, paymentIdText, amount,
      verified && otherVerifiedAmount + amount >= targetAmount ? 'ALLOCATED' : 'PARTIAL',
      nowIso(), nowIso(), canonicalSeller.id
    );
  }

  const verifiedTotal = Number(db.prepare(`
    SELECT COALESCE(SUM(a.amount_minor), 0) AS total
    FROM marketplace_payment_allocations a
    JOIN payments p ON p.id = a.payment_id
    WHERE a.seller_order_id = ?
      AND p.state IN ('VERIFIED','RECONCILED')
      AND a.status <> 'REFUNDED'
  `).get(canonicalSeller.id)?.total || 0);

  if (verifiedTotal >= targetAmount) {
    db.prepare(`
      UPDATE marketplace_settlements
      SET status = 'READY'
      WHERE seller_order_id = ? AND status = 'PENDING'
    `).run(canonicalSeller.id);
  }

  const row = db.prepare(`
    SELECT * FROM marketplace_payment_allocations
    WHERE seller_order_id = ? AND payment_id = ?
    LIMIT 1
  `).get(canonicalSeller.id, paymentIdText);
  return row ? { ...row, paymentId: paymentIdText, amountMinor: amount, status: row.status } : null;
}

async function resolvePaymentContext(chatId, input = {}) {
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) throw Object.assign(new Error('Unknown organization'), { statusCode: 404 });
  const organizationId = String(tenant.organizationId);
  const locationId = input.locationId || input.location_id || null;
  if (locationId) {
    const location = db.prepare('SELECT id, organization_id, status FROM locations WHERE id = ?').get(String(locationId));
    if (!location || String(location.organization_id) !== organizationId || location.status !== 'active') {
      throw Object.assign(new Error('Payment location does not belong to this organization'), { statusCode: 400 });
    }
  }
  return { tenant, organizationId, locationId: locationId ? String(locationId) : null };
}

export async function listPaymentAccounts(chatId, options = {}) {
  ensureDatabase();
  const { organizationId } = await resolvePaymentContext(chatId);
  const status = options.status || 'active';
  return db.prepare(`SELECT * FROM payment_accounts WHERE organization_id = ? AND (? = 'all' OR status = ?) ORDER BY provider_id, account_identifier`).all(organizationId, status, status).map(row => ({
    id: row.id, organizationId: row.organization_id, providerId: row.provider_id,
    accountIdentifier: row.account_identifier, phone: row.phone, status: row.status,
    metadata: parseJSON(row.metadata_json, {}), createdAt: row.created_at, updatedAt: row.updated_at,
  }));
}

export async function createPaymentAccount(chatId, input = {}, actor = null) {
  ensureDatabase();
  const { organizationId } = await resolvePaymentContext(chatId);
  const providerId = String(input.providerId || input.provider_id || '').trim().toLowerCase();
  requirePaymentProvider(providerId);
  const accountIdentifier = String(input.accountIdentifier || input.account_identifier || '').trim();
  if (!providerId || !accountIdentifier) throw Object.assign(new Error('providerId and accountIdentifier are required'), { statusCode: 400 });
  const now = nowIso();
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO payment_accounts (id, organization_id, provider_id, account_identifier, phone, status, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, organizationId, providerId, accountIdentifier, input.phone ? String(input.phone).trim() : null,
    input.status === 'inactive' ? 'inactive' : 'active', json(input.metadata || {}), now, now
  );
  audit(String(chatId), 'payment.account.created', 'payment_account', id, { providerId, accountIdentifier }, { organizationId, actorId: actor?.userId || null, deviceId: actor?.deviceId || null });
  return listPaymentAccounts(chatId, { status: 'all' }).then(rows => rows.find(row => row.id === id));
}

export async function createPayment(chatId, input = {}, actor = null) {
  ensureDatabase();
  const { organizationId, locationId } = await resolvePaymentContext(chatId, input);
  const currency = tenantCurrency(chatId);
  const amountMinor = Number(input.amountMinor ?? input.amount_minor);
  if (!Number.isInteger(amountMinor) || amountMinor < 0) throw Object.assign(new Error('amountMinor must be a non-negative integer'), { statusCode: 400 });
  if (input.currency != null && normaliseCurrency(input.currency, currency) !== currency) throw Object.assign(new Error('Payment currency does not match the organization currency'), { statusCode: 409, code: 'CURRENCY_MISMATCH' });
  const orderId = input.orderId || input.order_id || null;
  let customerId = input.customerId || input.customer_id || null;
  if (orderId) {
    const order = db.prepare('SELECT order_json, customer_id, total_minor, currency FROM orders WHERE chat_id = ? AND server_order_id = ?').get(String(chatId), String(orderId));
    if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
    if (normaliseCurrency(order.currency, currency) !== currency) throw Object.assign(new Error('Order currency does not match the organization currency'), { statusCode: 409, code: 'CURRENCY_MISMATCH' });
    if (amountMinor > Number(order.total_minor)) throw Object.assign(new Error('Payment amount cannot exceed the order total'), { statusCode: 400 });
    customerId = customerId || order.customer_id || parseJSON(order.order_json, {}).customer_id || null;
  }
  if (customerId) {
    const customer = db.prepare('SELECT id FROM customers WHERE id = ? AND organization_id = ?').get(String(customerId), organizationId);
    if (!customer) throw Object.assign(new Error('Customer does not belong to this organization'), { statusCode: 400 });
    customerId = String(customerId);
  }
  const accountId = input.paymentAccountId || input.payment_account_id || null;
  if (accountId) {
    const account = db.prepare('SELECT id FROM payment_accounts WHERE id = ? AND organization_id = ? AND status = \'active\'').get(String(accountId), organizationId);
    if (!account) throw Object.assign(new Error('Payment account does not belong to this organization'), { statusCode: 400 });
  }
  const suppliedState = input.state == null ? null : String(input.state).toUpperCase();
  if (suppliedState && suppliedState !== 'UNPAID') throw Object.assign(new Error('Payment state is controlled by PaymentCore commands'), { statusCode: 409, code: 'STATE_NOT_CLIENT_CONTROLLED' });
  const state = 'UNPAID';
  const now = nowIso();
  const id = String(input.id || crypto.randomUUID());
  const providerId = String(input.providerId || input.provider_id || 'manual').trim().toLowerCase();
  const channel = String(input.channel || 'manual').toLowerCase();
  requirePaymentProvider(providerId);
  requirePaymentChannel(channel);
  const methodId = input.methodId || input.method_id || null;
  const methodName = input.methodName || input.method_name || null;
  try {
    db.exec('BEGIN IMMEDIATE');
    db.prepare(`INSERT INTO payments (id, organization_id, location_id, order_id, customer_id, payment_account_id, provider_id, channel, method_id, method_name, amount_minor, currency, state, external_reference, claimed_at, received_at, verified_at, reconciled_at, metadata_json, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, organizationId, locationId, orderId ? String(orderId) : null, customerId, accountId ? String(accountId) : null, providerId, channel,
      methodId ? String(methodId) : null, methodName ? String(methodName) : null, amountMinor, currency, state,
      input.externalReference || input.external_reference || null,
      state === 'CLAIMED' ? now : null, state === 'RECEIVED' ? now : null, state === 'VERIFIED' ? now : null, state === 'RECONCILED' ? now : null,
      json(input.metadata || {}), actor?.userId || null, now, now
    );
    db.prepare(`INSERT INTO payment_ledger_entries (id, payment_id, organization_id, entry_type, amount_minor, currency, from_state, to_state, actor_id, reason, metadata_json, created_at) VALUES (?, ?, ?, 'CREATED', ?, ?, NULL, ?, ?, ?, ?, ?)`).run(
      crypto.randomUUID(), id, organizationId, amountMinor, currency, state, actor?.userId || null, String(input.reason || ''), json(input.metadata || {}), now
    );
    syncMarketplacePaymentAllocation(orderId, id, amountMinor, state);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  audit(String(chatId), 'payment.created', 'payment', id, { amountMinor, currency, state, orderId }, { organizationId, locationId, actorId: actor?.userId || null, deviceId: actor?.deviceId || null });
  return paymentFromRow(db.prepare('SELECT * FROM payments WHERE id = ?').get(id));
}

export async function listPaymentRoutingPolicies(chatId, { channel = null, locationId = null, activeOnly = true } = {}) {
  ensureDatabase();
  const tenant = getTenantByChatId(chatId);
  if (!tenant) throw Object.assign(new Error('Unknown store'), { statusCode: 404 });
  const clauses = ['organization_id = ?'];
  const params = [tenant.organization_id];
  if (channel) { clauses.push('channel = ?'); params.push(String(channel).toLowerCase()); }
  if (locationId) { clauses.push('(location_id IS NULL OR location_id = ?)'); params.push(String(locationId)); }
  if (activeOnly) clauses.push("status = 'ACTIVE'");
  const rows = db.prepare(`SELECT * FROM payment_routing_policies WHERE ${clauses.join(' AND ')} ORDER BY priority ASC, created_at ASC`).all(...params);
  return rows.map(row => ({
    id: row.id, organizationId: row.organization_id, channel: row.channel, providerId: row.provider_id,
    priority: Number(row.priority), status: row.status, currencies: parseJSON(row.currencies_json, []),
    requiredCapabilities: parseJSON(row.required_capabilities_json, []), locationId: row.location_id,
    reason: row.reason || '', createdByUserId: row.created_by_user_id, createdAt: row.created_at, updatedAt: row.updated_at,
  }));
}

export async function upsertPaymentRoutingPolicy(chatId, input = {}, actor = null) {
  ensureDatabase();
  const tenant = getTenantByChatId(chatId);
  if (!tenant) throw Object.assign(new Error('Unknown store'), { statusCode: 404 });
  const channel = String(input.channel || '').trim().toLowerCase();
  const providerId = String(input.providerId || input.provider_id || '').trim().toLowerCase();
  if (!['manual','sms','api'].includes(channel) || !providerId) throw Object.assign(new Error('Valid channel and providerId are required'), { statusCode: 400, code: 'INVALID_ROUTING_POLICY' });
  const currencies = Array.isArray(input.currencies) ? [...new Set(input.currencies.map(v => String(v).trim().toUpperCase()).filter(v => /^[A-Z]{3}$/.test(v)))] : [];
  const requiredCapabilities = Array.isArray(input.requiredCapabilities || input.required_capabilities) ? [...new Set((input.requiredCapabilities || input.required_capabilities).map(v => String(v).trim()).filter(Boolean))] : [];
  const locationId = input.locationId || input.location_id || null;
  const now = nowIso();
  const id = String(input.id || crypto.randomUUID());
  const existing = db.prepare('SELECT id FROM payment_routing_policies WHERE organization_id = ? AND channel = ? AND provider_id = ? AND location_id IS ?').get(tenant.organization_id, channel, providerId, locationId);
  if (existing) {
    db.prepare(`UPDATE payment_routing_policies SET priority=?, status=?, currencies_json=?, required_capabilities_json=?, reason=?, updated_at=? WHERE id=?`).run(
      Number.isInteger(Number(input.priority)) ? Number(input.priority) : 100,
      String(input.status || 'ACTIVE').toUpperCase(),
      json(currencies), json(requiredCapabilities), String(input.reason || ''), now, existing.id);
    return (await listPaymentRoutingPolicies(chatId, { channel, locationId, activeOnly: false })).find(p => p.id === existing.id);
  }
  db.prepare(`INSERT INTO payment_routing_policies
    (id,organization_id,channel,provider_id,priority,status,currencies_json,required_capabilities_json,location_id,reason,created_by_user_id,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, tenant.organization_id, channel, providerId, Number.isInteger(Number(input.priority)) ? Number(input.priority) : 100,
      String(input.status || 'ACTIVE').toUpperCase(), json(currencies), json(requiredCapabilities), locationId,
      String(input.reason || ''), actor?.userId || actor?.user_id || null, now, now);
  return (await listPaymentRoutingPolicies(chatId, { channel, locationId, activeOnly: false })).find(p => p.id === id);
}

export async function getPaymentSettlementByIdempotencyKey(chatId, idempotencyKey) {
  const db = ensureDatabase();
  const tenant = getTenantByChatId(chatId);
  if (!tenant) throw Object.assign(new Error('Unknown store'), { statusCode: 404, code: 'UNKNOWN_STORE' });
  const row = db.prepare('SELECT * FROM payment_settlements WHERE organization_id = ? AND idempotency_key = ?').get(tenant.organization_id, String(idempotencyKey));
  return row ? normalizePaymentSettlement(row) : null;
}

export async function createPaymentSettlement(chatId, input = {}, actor = null) {
  const db = ensureDatabase();
  const tenant = getTenantByChatId(chatId);
  if (!tenant) throw Object.assign(new Error('Unknown store'), { statusCode: 404, code: 'UNKNOWN_STORE' });
  const payment = db.prepare('SELECT * FROM payments WHERE id = ? AND organization_id = ?').get(String(input.paymentId), tenant.organization_id);
  if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });

  const key = String(input.idempotencyKey || input.idempotency_key || '').trim();
  if (!key) throw Object.assign(new Error('Settlement idempotencyKey is required'), { statusCode: 400, code: 'SETTLEMENT_IDEMPOTENCY_REQUIRED' });
  const existing = db.prepare('SELECT * FROM payment_settlements WHERE organization_id = ? AND idempotency_key = ?').get(tenant.organization_id, key);
  if (existing) return { settlement: normalizePaymentSettlement(existing), duplicate: true };

  if (!['VERIFIED','RECONCILED'].includes(String(payment.state).toUpperCase())) {
    throw Object.assign(new Error('Only VERIFIED or RECONCILED payments can enter settlement'), { statusCode: 409, code: 'PAYMENT_NOT_SETTLEABLE' });
  }

  const gross = Number(input.grossAmountMinor ?? input.gross_amount_minor ?? payment.amount_minor);
  const providerFee = Number(input.providerFeeMinor ?? input.provider_fee_minor ?? 0);
  const sellifyFee = Number(input.sellifyFeeMinor ?? input.sellify_fee_minor ?? 0);
  const net = gross - providerFee - sellifyFee;
  if (![gross, providerFee, sellifyFee, net].every(Number.isInteger) || gross < 0 || providerFee < 0 || sellifyFee < 0 || net < 0) {
    throw Object.assign(new Error('Invalid settlement amount or fee model'), { statusCode: 400, code: 'INVALID_SETTLEMENT_AMOUNTS' });
  }
  if (gross > Number(payment.amount_minor)) {
    throw Object.assign(new Error('Settlement gross cannot exceed payment amount'), { statusCode: 409, code: 'SETTLEMENT_GROSS_EXCEEDS_PAYMENT' });
  }
  const currency = normaliseCurrency(input.currency || payment.currency, payment.currency);
  if (currency !== normaliseCurrency(payment.currency, currency)) {
    throw Object.assign(new Error('Settlement currency must match payment currency'), { statusCode: 409, code: 'SETTLEMENT_CURRENCY_MISMATCH' });
  }

  const now = nowIso();
  const settlement = {
    id: String(input.settlementId || crypto.randomUUID()),
    organization_id: tenant.organization_id,
    payment_id: payment.id,
    provider_id: payment.provider_id,
    idempotency_key: key,
    gross_amount_minor: gross,
    provider_fee_minor: providerFee,
    sellify_fee_minor: sellifyFee,
    net_amount_minor: net,
    currency,
    status: 'PENDING',
    settlement_reference: input.settlementReference || input.settlement_reference || null,
    reconciliation_id: input.reconciliationId || input.reconciliation_id || null,
    provider_settlement_reference: input.providerSettlementReference || input.provider_settlement_reference || null,
    evidence_json: input.evidence == null ? null : json(input.evidence),
    reason: String(input.reason || ''),
    created_by_user_id: actor?.userId || actor?.user_id || null,
    created_at: now,
    updated_at: now,
    settled_at: null,
  };
  db.prepare(`INSERT INTO payment_settlements
    (id,organization_id,payment_id,provider_id,idempotency_key,gross_amount_minor,provider_fee_minor,sellify_fee_minor,net_amount_minor,currency,status,settlement_reference,reconciliation_id,provider_settlement_reference,evidence_json,reason,created_by_user_id,created_at,updated_at,settled_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      settlement.id, tenant.organization_id, payment.id, payment.provider_id, key,
      gross, providerFee, sellifyFee, net, currency, 'PENDING',
      settlement.settlement_reference, settlement.reconciliation_id, settlement.provider_settlement_reference,
      settlement.evidence_json, settlement.reason, settlement.created_by_user_id, now, now, null
  );
  audit(String(chatId), 'payment.settlement.requested', payment.id, actor?.userId || null, {
    settlementId: settlement.id, grossAmountMinor: gross, providerFeeMinor: providerFee,
    sellifyFeeMinor: sellifyFee, netAmountMinor: net, currency,
  });
  return { settlement: normalizePaymentSettlement(settlement), duplicate: false };
}

export async function finalizePaymentSettlement(chatId, settlementId, input = {}, actor = null) {
  const db = ensureDatabase();
  const tenant = getTenantByChatId(chatId);
  if (!tenant) throw Object.assign(new Error('Unknown store'), { statusCode: 404, code: 'UNKNOWN_STORE' });
  const status = String(input.status || '').toUpperCase();
  if (!['READY','SETTLED','HELD','FAILED','REVERSED'].includes(status)) {
    throw Object.assign(new Error('Invalid settlement status'), { statusCode: 400, code: 'INVALID_SETTLEMENT_STATUS' });
  }
  const now = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db.prepare('SELECT * FROM payment_settlements WHERE id = ? AND organization_id = ?').get(String(settlementId), tenant.organization_id);
    if (!row) throw Object.assign(new Error('Settlement not found'), { statusCode: 404, code: 'SETTLEMENT_NOT_FOUND' });
    if (row.status === 'SETTLED' && status !== 'SETTLED') {
      db.exec('COMMIT');
      return normalizePaymentSettlement(row);
    }
    db.prepare(`UPDATE payment_settlements
      SET status=?, settlement_reference=?, provider_settlement_reference=?, evidence_json=?, reason=?, updated_at=?, settled_at=?
      WHERE id=? AND organization_id=?`).run(
      status,
      input.settlementReference || input.settlement_reference || row.settlement_reference || null,
      input.providerSettlementReference || input.provider_settlement_reference || row.provider_settlement_reference || null,
      input.evidence == null ? row.evidence_json : json(input.evidence),
      String(input.reason || row.reason || ''),
      now,
      status === 'SETTLED' ? now : row.settled_at,
      row.id, tenant.organization_id
    );
    audit(String(chatId), `payment.settlement.${status.toLowerCase()}`, row.payment_id, actor?.userId || null, {
      settlementId: row.id, status, grossAmountMinor: row.gross_amount_minor,
      providerFeeMinor: row.provider_fee_minor, sellifyFeeMinor: row.sellify_fee_minor,
      netAmountMinor: row.net_amount_minor,
    });
    db.exec('COMMIT');
    return normalizePaymentSettlement(db.prepare('SELECT * FROM payment_settlements WHERE id = ?').get(row.id));
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

export async function listPaymentSettlements(chatId, paymentId, { status = null } = {}) {
  const db = ensureDatabase();
  const tenant = getTenantByChatId(chatId);
  if (!tenant) throw Object.assign(new Error('Unknown store'), { statusCode: 404, code: 'UNKNOWN_STORE' });
  const rows = db.prepare(`SELECT * FROM payment_settlements WHERE organization_id = ? AND payment_id = ? ${status ? 'AND status = ?' : ''} ORDER BY created_at DESC`).all(
    tenant.organization_id, paymentId, ...(status ? [String(status).toUpperCase()] : [])
  );
  return rows.map(normalizePaymentSettlement);
}

function normalizePaymentSettlement(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    paymentId: row.payment_id,
    providerId: row.provider_id,
    idempotencyKey: row.idempotency_key,
    grossAmountMinor: Number(row.gross_amount_minor),
    providerFeeMinor: Number(row.provider_fee_minor),
    sellifyFeeMinor: Number(row.sellify_fee_minor),
    netAmountMinor: Number(row.net_amount_minor),
    currency: row.currency,
    status: row.status,
    settlementReference: row.settlement_reference,
    reconciliationId: row.reconciliation_id,
    providerSettlementReference: row.provider_settlement_reference,
    evidence: parseJSON(row.evidence_json, null),
    reason: row.reason || '',
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    settledAt: row.settled_at,
  };
}

export async function getPaymentRefunds(chatId, paymentId, { status = null } = {}) {
  const db = ensureDatabase();
  const tenant = getTenantByChatId(chatId);
  if (!tenant) throw Object.assign(new Error('Unknown store'), { statusCode: 404, code: 'UNKNOWN_STORE' });
  const rows = db.prepare(`SELECT * FROM payment_refunds WHERE organization_id = ? AND payment_id = ? ${status ? 'AND status = ?' : ''} ORDER BY created_at DESC`).all(
    tenant.organization_id, paymentId, ...(status ? [String(status).toUpperCase()] : [])
  );
  return rows.map(normalizePaymentRefund);
}

export async function getPaymentRefundByIdempotencyKey(chatId, idempotencyKey) {
  const db = ensureDatabase();
  const tenant = getTenantByChatId(chatId);
  if (!tenant) throw Object.assign(new Error('Unknown store'), { statusCode: 404, code: 'UNKNOWN_STORE' });
  const row = db.prepare('SELECT * FROM payment_refunds WHERE organization_id = ? AND idempotency_key = ?').get(tenant.organization_id, String(idempotencyKey));
  return row ? normalizePaymentRefund(row) : null;
}

export async function createPaymentRefundRequest(chatId, input = {}, actor = null) {
  const db = ensureDatabase();
  const tenant = getTenantByChatId(chatId);
  if (!tenant) throw Object.assign(new Error('Unknown store'), { statusCode: 404, code: 'UNKNOWN_STORE' });
  const payment = db.prepare('SELECT * FROM payments WHERE id = ? AND organization_id = ?').get(String(input.paymentId), tenant.organization_id);
  if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
  const key = String(input.idempotencyKey || input.idempotency_key || '').trim();
  if (!key) throw Object.assign(new Error('Refund idempotencyKey is required'), { statusCode: 400, code: 'REFUND_IDEMPOTENCY_REQUIRED' });
  const existing = db.prepare('SELECT * FROM payment_refunds WHERE organization_id = ? AND idempotency_key = ?').get(tenant.organization_id, key);
  if (existing) return { refund: normalizePaymentRefund(existing), duplicate: true };

  const amountMinor = Number(input.amountMinor ?? input.amount_minor);
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) throw Object.assign(new Error('Refund amount must be a positive integer'), { statusCode: 400, code: 'INVALID_REFUND_AMOUNT' });
  const currency = normaliseCurrency(input.currency || payment.currency, payment.currency);
  if (currency !== normaliseCurrency(payment.currency, currency)) {
    throw Object.assign(new Error('Refund currency must match payment currency'), { statusCode: 409, code: 'REFUND_CURRENCY_MISMATCH' });
  }
  if (!['VERIFIED','RECONCILED'].includes(String(payment.state).toUpperCase())) {
    throw Object.assign(new Error('Only VERIFIED or RECONCILED payments can be refunded'), { statusCode: 409, code: 'PAYMENT_NOT_REFUNDABLE' });
  }

  const refunded = Number(db.prepare("SELECT COALESCE(SUM(amount_minor),0) AS total FROM payment_refunds WHERE payment_id = ? AND status = 'SUCCEEDED'").get(payment.id).total || 0);
  if (refunded + amountMinor > Number(payment.amount_minor)) {
    throw Object.assign(new Error('Refund exceeds refundable payment amount'), { statusCode: 409, code: 'REFUND_AMOUNT_EXCEEDS_PAYMENT' });
  }

  const now = nowIso();
  const refund = {
    id: String(input.refundId || crypto.randomUUID()),
    organization_id: tenant.organization_id,
    payment_id: payment.id,
    payment_intent_id: payment.payment_intent_id || null,
    provider_id: payment.provider_id,
    idempotency_key: key,
    amount_minor: amountMinor,
    currency,
    status: 'REQUESTED',
    reason: String(input.reason || ''),
    provider_refund_id: null,
    provider_transaction_id: null,
    provider_result_json: null,
    evidence_json: null,
    failure_code: null,
    requested_by_user_id: actor?.userId || actor?.user_id || null,
    created_at: now,
    updated_at: now,
    processed_at: null,
  };
  db.prepare(`INSERT INTO payment_refunds
    (id,organization_id,payment_id,payment_intent_id,provider_id,idempotency_key,amount_minor,currency,status,reason,provider_refund_id,provider_transaction_id,provider_result_json,evidence_json,failure_code,requested_by_user_id,created_at,updated_at,processed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      refund.id, refund.organization_id, refund.payment_id, refund.payment_intent_id, refund.provider_id,
      refund.idempotency_key, refund.amount_minor, refund.currency, refund.status, refund.reason,
      null, null, null, null, null, refund.requested_by_user_id, now, now, null
    );
  audit(String(chatId), 'payment.refund.requested', payment.id, actor?.userId || null, {
    refundId: refund.id, amountMinor, currency, idempotencyKey: key,
  });
  return { refund: normalizePaymentRefund(refund), duplicate: false };
}

export async function finalizePaymentRefund(chatId, refundId, input = {}, actor = null) {
  const db = ensureDatabase();
  const tenant = getTenantByChatId(chatId);
  if (!tenant) throw Object.assign(new Error('Unknown store'), { statusCode: 404, code: 'UNKNOWN_STORE' });
  const now = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    const refund = db.prepare('SELECT * FROM payment_refunds WHERE id = ? AND organization_id = ?').get(String(refundId), tenant.organization_id);
    if (!refund) throw Object.assign(new Error('Refund not found'), { statusCode: 404, code: 'REFUND_NOT_FOUND' });
    if (refund.status === 'SUCCEEDED') {
      db.exec('COMMIT');
      return normalizePaymentRefund(refund);
    }
    const payment = db.prepare('SELECT * FROM payments WHERE id = ? AND organization_id = ?').get(refund.payment_id, tenant.organization_id);
    if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });

    const status = String(input.status || '').toUpperCase();
    if (status !== 'SUCCEEDED') {
      db.prepare(`UPDATE payment_refunds SET status = ?, provider_refund_id = ?, provider_transaction_id = ?, provider_result_json = ?, evidence_json = ?, failure_code = ?, updated_at = ?, processed_at = ? WHERE id = ? AND organization_id = ?`).run(
        status || 'UNKNOWN', input.providerRefundId || input.provider_refund_id || null,
        input.providerTransactionId || input.provider_transaction_id || null,
        input.providerResult == null ? null : json(input.providerResult),
        input.evidence == null ? null : json(input.evidence),
        input.failureCode || input.failure_code || null, now, now, refund.id, tenant.organization_id
      );
      audit(String(chatId), 'payment.refund.result', payment.id, actor?.userId || null, { refundId: refund.id, status: status || 'UNKNOWN' });
      db.exec('COMMIT');
      return normalizePaymentRefund(db.prepare('SELECT * FROM payment_refunds WHERE id = ?').get(refund.id));
    }

    const successfulBefore = Number(db.prepare("SELECT COALESCE(SUM(amount_minor),0) AS total FROM payment_refunds WHERE payment_id = ? AND status = 'SUCCEEDED' AND id <> ?").get(payment.id, refund.id).total || 0);
    if (successfulBefore + Number(refund.amount_minor) > Number(payment.amount_minor)) {
      throw Object.assign(new Error('Refund exceeds refundable payment amount'), { statusCode: 409, code: 'REFUND_AMOUNT_EXCEEDS_PAYMENT' });
    }
    const fullRefund = successfulBefore + Number(refund.amount_minor) === Number(payment.amount_minor);
    db.prepare(`UPDATE payment_refunds SET status='SUCCEEDED', provider_refund_id=?, provider_transaction_id=?, provider_result_json=?, evidence_json=?, updated_at=?, processed_at=? WHERE id=? AND organization_id=?`).run(
      input.providerRefundId || input.provider_refund_id || null,
      input.providerTransactionId || input.provider_transaction_id || null,
      input.providerResult == null ? null : json(input.providerResult),
      input.evidence == null ? null : json(input.evidence),
      now, now, refund.id, tenant.organization_id
    );
    if (fullRefund) {
      db.prepare('UPDATE payments SET state = ?, updated_at = ? WHERE id = ? AND organization_id = ? AND state IN (\'VERIFIED\',\'RECONCILED\')').run('REFUNDED', now, payment.id, tenant.organization_id);
    }
    db.prepare(`INSERT INTO payment_ledger_entries
      (id,payment_id,organization_id,entry_type,amount_minor,currency,from_state,to_state,actor_id,reason,metadata_json,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      crypto.randomUUID(), payment.id, tenant.organization_id, 'REFUNDED', Number(refund.amount_minor), refund.currency,
      payment.state, fullRefund ? 'REFUNDED' : payment.state, actor?.userId || null,
      refund.reason || 'Payment refund',
      json({ lifecycle: 'GAP-1.14', refundId: refund.id, providerRefundId: input.providerRefundId || input.provider_refund_id || null }),
      now
    );
    audit(String(chatId), 'payment.refund.succeeded', payment.id, actor?.userId || null, {
      refundId: refund.id, amountMinor: refund.amount_minor, fullRefund,
    });
    db.exec('COMMIT');
    return normalizePaymentRefund(db.prepare('SELECT * FROM payment_refunds WHERE id = ?').get(refund.id));
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

function normalizePaymentRefund(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    paymentId: row.payment_id,
    paymentIntentId: row.payment_intent_id,
    providerId: row.provider_id,
    idempotencyKey: row.idempotency_key,
    amountMinor: Number(row.amount_minor),
    currency: row.currency,
    status: row.status,
    reason: row.reason || '',
    providerRefundId: row.provider_refund_id,
    providerTransactionId: row.provider_transaction_id,
    providerResult: parseJSON(row.provider_result_json, null),
    evidence: parseJSON(row.evidence_json, null),
    failureCode: row.failure_code,
    requestedByUserId: row.requested_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    processedAt: row.processed_at,
  };
}

export async function getPayment(chatId, paymentId) {
  ensureDatabase();
  const { organizationId } = await resolvePaymentContext(chatId);
  return paymentFromRow(db.prepare('SELECT * FROM payments WHERE id = ? AND organization_id = ?').get(String(paymentId), organizationId));
}

export async function listPayments(chatId, options = {}) {
  ensureDatabase();
  const { organizationId } = await resolvePaymentContext(chatId);
  const where = ['organization_id = ?']; const params = [organizationId];
  if (options.state && options.state !== 'all') { where.push('state = ?'); params.push(String(options.state).toUpperCase()); }
  if (options.orderId) { where.push('order_id = ?'); params.push(String(options.orderId)); }
  const limit = Math.max(1, Math.min(500, Number(options.limit) || 100));
  params.push(limit);
  return db.prepare(`SELECT * FROM payments WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`).all(...params).map(paymentFromRow);
}

export async function transitionPayment(chatId, paymentId, nextState, actor = null, input = {}) {
  ensureDatabase();
  const { organizationId } = await resolvePaymentContext(chatId, input);
  const target = String(nextState || '').toUpperCase();
  if (!PAYMENT_STATES.has(target)) throw Object.assign(new Error('Invalid payment state'), { statusCode: 400 });
  const row = db.prepare('SELECT * FROM payments WHERE id = ? AND organization_id = ?').get(String(paymentId), organizationId);
  if (!row) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
  if (row.state === target) return paymentFromRow(row);
  if (!PAYMENT_TRANSITIONS[row.state]?.has(target)) throw Object.assign(new Error(`Invalid payment transition ${row.state} -> ${target}`), { statusCode: 409, code: 'INVALID_PAYMENT_TRANSITION' });
  const now = nowIso();
  const timestampColumn = paymentStateTimestampColumn(target);
  const sets = ['state = ?', 'updated_at = ?']; const params = [target, now];
  if (timestampColumn) { sets.push(`${timestampColumn} = ?`); params.push(now); }
  if (input.externalReference || input.external_reference) { sets.push('external_reference = ?'); params.push(String(input.externalReference || input.external_reference)); }
  params.push(String(paymentId), organizationId);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE payments SET ${sets.join(', ')} WHERE id = ? AND organization_id = ?`).run(...params);
    db.prepare(`INSERT INTO payment_ledger_entries (id, payment_id, organization_id, entry_type, amount_minor, currency, from_state, to_state, actor_id, reason, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      crypto.randomUUID(), String(paymentId), organizationId, target, Number(row.amount_minor), normaliseCurrency(row.currency, 'ETB'), row.state, target, actor?.userId || null, String(input.reason || ''), json(input.metadata || {}), now
    );
    const marketplaceAllocation = db.prepare(`
      SELECT a.*, so.id AS canonical_seller_order_id
      FROM marketplace_payment_allocations a
      JOIN marketplace_seller_orders so ON so.id = a.seller_order_id
      WHERE a.payment_id = ?
      LIMIT 1
    `).get(String(paymentId));
    if (marketplaceAllocation) {
      if (target === 'REFUNDED') {
        db.prepare('UPDATE marketplace_payment_allocations SET status = \'REFUNDED\', updated_at = ? WHERE id = ?').run(now, marketplaceAllocation.id);
        db.prepare('UPDATE marketplace_settlements SET status = \'REVERSED\' WHERE seller_order_id = ? AND status IN (\'PENDING\',\'READY\',\'HELD\')').run(marketplaceAllocation.canonical_seller_order_id);
      } else if (['VERIFIED','RECONCILED'].includes(target) && Number(row.amount_minor) === Number(marketplaceAllocation.amount_minor)) {
        db.prepare('UPDATE marketplace_payment_allocations SET status = \'ALLOCATED\', updated_at = ? WHERE id = ?').run(now, marketplaceAllocation.id);
        db.prepare('UPDATE marketplace_settlements SET status = \'READY\' WHERE seller_order_id = ? AND status = \'PENDING\'').run(marketplaceAllocation.canonical_seller_order_id);
      }
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  audit(String(chatId), `payment.${target.toLowerCase()}`, 'payment', paymentId, { fromState: row.state, toState: target }, { organizationId, locationId: row.location_id, actorId: actor?.userId || null, deviceId: actor?.deviceId || null, reason: input.reason || '' });
  return paymentFromRow(db.prepare('SELECT * FROM payments WHERE id = ?').get(String(paymentId)));
}

export async function listPaymentLedger(chatId, paymentId) {
  ensureDatabase();
  const payment = await getPayment(chatId, paymentId);
  if (!payment) return null;
  return db.prepare('SELECT * FROM payment_ledger_entries WHERE payment_id = ? ORDER BY rowid ASC').all(String(paymentId)).map(row => ({
    id: row.id, paymentId: row.payment_id, entryType: row.entry_type, amountMinor: Number(row.amount_minor), currency: normaliseCurrency(row.currency, 'ETB'),
    fromState: row.from_state, toState: row.to_state, actorId: row.actor_id, reason: row.reason || '', metadata: parseJSON(row.metadata_json, {}), createdAt: row.created_at,
  }));
}

export async function recordPaymentReconciliation(chatId, paymentId, input = {}, actor = null) {
  ensureDatabase();
  const payment = await getPayment(chatId, paymentId);
  if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
  const now = nowIso();
  const reconciliationId = String(input.id || crypto.randomUUID());
  const status = ['matched', 'mismatched', 'pending'].includes(String(input.status || '').toLowerCase())
    ? String(input.status).toLowerCase()
    : 'pending';
  const amountMinor = Number(input.amountMinor ?? input.amount_minor ?? 0);
  const currency = normaliseCurrency(input.currency, payment.currency);
  const fingerprint = String(input.fingerprint || '').trim() || null;
  const existing = fingerprint
    ? db.prepare('SELECT * FROM payment_reconciliations WHERE organization_id = ? AND fingerprint = ? ORDER BY created_at DESC LIMIT 1').get(payment.organizationId, fingerprint)
    : null;
  if (existing) {
    return { reconciliation: existing, duplicate: true };
  }
  db.prepare(`INSERT INTO payment_reconciliations
    (id, payment_id, organization_id, status, external_reference, amount_minor, currency, reason, actor_id, created_at, resolved_at, provider_id, source, fingerprint, evidence_json, observed_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    reconciliationId,
    payment.id,
    payment.organizationId,
    status,
    input.externalReference || input.external_reference || payment.externalReference || null,
    Number.isInteger(amountMinor) && amountMinor >= 0 ? amountMinor : 0,
    currency,
    String(input.reason || ''),
    actor?.userId || null,
    now,
    status === 'matched' ? (input.resolvedAt || now) : null,
    input.providerId || payment.providerId || null,
    String(input.source || 'PAYMENT_CORE'),
    fingerprint,
    json(input.evidence || input.normalizedPayload || {}),
    input.observedAt || null,
    now,
  );
  return {
    reconciliation: db.prepare('SELECT * FROM payment_reconciliations WHERE id = ?').get(reconciliationId),
    duplicate: false,
  };
}

export async function listPaymentReconciliations(chatId, paymentId, options = {}) {
  ensureDatabase();
  const payment = await getPayment(chatId, paymentId);
  if (!payment) return null;
  const limit = Math.min(Math.max(Number(options.limit || 100), 1), 500);
  return db.prepare('SELECT * FROM payment_reconciliations WHERE payment_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(payment.id, limit);
}

export async function reconcilePayment(chatId, paymentId, input = {}, actor = null) {
  ensureDatabase();
  const payment = await getPayment(chatId, paymentId);
  if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
  const amountMinor = Number(input.amountMinor ?? input.amount_minor ?? payment.amountMinor);
  const currency = normaliseCurrency(input.currency, payment.currency);
  const matched = Number.isInteger(amountMinor) && amountMinor === payment.amountMinor && currency === payment.currency;
  const now = nowIso();
  const reconciliationId = crypto.randomUUID();
  db.prepare(`INSERT INTO payment_reconciliations (id, payment_id, organization_id, status, external_reference, amount_minor, currency, reason, actor_id, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    reconciliationId, payment.id, payment.organizationId, matched ? 'matched' : 'mismatched', input.externalReference || input.external_reference || payment.externalReference || null,
    Number.isInteger(amountMinor) && amountMinor >= 0 ? amountMinor : 0, currency, String(input.reason || ''), actor?.userId || null, now, matched ? now : null
  );
  if (matched && payment.state === 'VERIFIED') await transitionPayment(chatId, payment.id, 'RECONCILED', actor, { reason: input.reason || 'Payment reconciliation matched' });
  if (!matched && payment.state !== 'MISMATCH' && !['REFUNDED','REJECTED','DUPLICATE','EXPIRED'].includes(payment.state)) await transitionPayment(chatId, payment.id, 'MISMATCH', actor, { reason: input.reason || 'Payment reconciliation mismatch' });
  return db.prepare('SELECT * FROM payment_reconciliations WHERE id = ?').get(reconciliationId);
}


function deriveLegacyPaymentState(order) {
  const tendered = Number(order.cash_tendered);
  if (Number.isInteger(tendered) && tendered > 0) return tendered >= Number(order.total || 0) ? 'RECEIVED' : 'PARTIAL';
  if (order.payment_proof) return 'CLAIMED';
  return 'UNPAID';
}

function ensureCanonicalPaymentForOrder(chatId, order, serverOrderId, actor = null) {
  const organizationId = db.prepare('SELECT organization_id FROM tenants WHERE chat_id = ?').get(String(chatId))?.organization_id;
  if (!organizationId) return null;
  const existing = db.prepare('SELECT id FROM payments WHERE organization_id = ? AND order_id = ? LIMIT 1').get(String(organizationId), String(serverOrderId));
  if (existing) return existing.id;
  const state = deriveLegacyPaymentState(order);
  const now = nowIso();
  const id = crypto.randomUUID();
  const amountMinor = Math.max(0, Number.isInteger(Number(order.cash_tendered)) && Number(order.cash_tendered) > 0 ? Math.min(Number(order.cash_tendered), Number(order.total || 0)) : (state === 'CLAIMED' ? Number(order.total || 0) : 0));
  const currency = normaliseCurrency(order.currency, tenantCurrency(chatId));
  db.prepare(`INSERT INTO payments (id, organization_id, location_id, order_id, customer_id, payment_account_id, provider_id, channel, method_id, method_name, amount_minor, currency, state, external_reference, claimed_at, received_at, verified_at, reconciled_at, metadata_json, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, 'manual', 'manual', ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL, ?, ?, ?, ?)`).run(
    id, String(organizationId), order.location_id || null, String(serverOrderId), order.customer_id || null,
    order.payment_method_id || null, order.payment_method_name || null, amountMinor, currency, state,
    state === 'CLAIMED' ? now : null, state === 'RECEIVED' ? now : null,
    json({ compatibility: 'legacy-order-payment', paymentProofAttached: Boolean(order.payment_proof) }), actor?.userId || null, now, now
  );
  db.prepare(`INSERT INTO payment_ledger_entries (id, payment_id, organization_id, entry_type, amount_minor, currency, from_state, to_state, actor_id, reason, metadata_json, created_at) VALUES (?, ?, ?, 'CREATED', ?, ?, NULL, ?, ?, ?, ?, ?)`).run(
    crypto.randomUUID(), id, String(organizationId), amountMinor, currency, state, actor?.userId || null,
    'Compatibility projection from existing order payment fields', json({ compatibility: 'legacy-order-payment' }), now
  );
  return id;
}


const CORE_FULFILLMENT_TRANSITIONS = Object.freeze({
  delivery: Object.freeze({
    pending: new Set(['out_for_delivery']),
    out_for_delivery: new Set(['delivered']),
    delivered: new Set([]),
  }),
  pickup: Object.freeze({
    pending: new Set(['ready_for_pickup']),
    ready_for_pickup: new Set(['picked_up']),
    picked_up: new Set([]),
  }),
});

function fulfillmentFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    serverOrderId: row.server_order_id,
    organizationId: row.organization_id,
    locationId: row.location_id,
    fulfillmentType: row.fulfillment_type,
    status: row.status,
    destination: parseJSON(row.destination_json, null),
    scheduledAt: row.scheduled_at || null,
    trackingReference: row.tracking_reference || null,
    proof: parseJSON(row.proof_json, null),
    version: Number(row.version || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeCoreFulfillmentType(value) {
  const type = String(value || '').trim().toLowerCase();
  if (!Object.hasOwn(CORE_FULFILLMENT_TRANSITIONS, type)) {
    throw Object.assign(new Error('Unsupported fulfillment type'), { statusCode: 400, code: 'UNSUPPORTED_FULFILLMENT_TYPE' });
  }
  return type;
}

function normalizeCoreFulfillmentStatus(value) {
  return String(value || '').trim().toLowerCase();
}

async function getCoreFulfillmentOrder(chatId, serverOrderId) {
  const row = db.prepare(
    'SELECT o.*, t.organization_id AS tenant_organization_id FROM orders o JOIN tenants t ON t.chat_id = o.chat_id WHERE o.chat_id = ? AND o.server_order_id = ?'
  ).get(String(chatId), String(serverOrderId));
  if (!row) throw Object.assign(new Error('Order not found'), { statusCode: 404, code: 'ORDER_NOT_FOUND' });
  return row;
}

export async function getOrderFulfillment(chatId, serverOrderId) {
  ensureDatabase();
  const order = await getCoreFulfillmentOrder(chatId, serverOrderId);
  const row = db.prepare('SELECT * FROM fulfillments WHERE server_order_id = ? AND organization_id = ?').get(String(serverOrderId), String(order.tenant_organization_id));
  return fulfillmentFromRow(row);
}

function applyCoreFulfillmentInventoryConsequence(chatId, fulfillmentRow, orderJson, actor = null) {
  const terminal = fulfillmentRow.fulfillment_type === 'delivery'
    ? fulfillmentRow.status === 'delivered'
    : fulfillmentRow.status === 'picked_up';
  if (!terminal) return [];
  const items = Array.isArray(orderJson?.items) ? orderJson.items : [];
  const defaultLocation = db.prepare("SELECT id FROM locations WHERE organization_id = ? AND code = 'DEFAULT' LIMIT 1").get(String(fulfillmentRow.organization_id));
  const locationId = String(fulfillmentRow.location_id || defaultLocation?.id || '');
  if (!locationId) throw Object.assign(new Error('Fulfillment inventory location is required'), { statusCode: 409, code: 'FULFILLMENT_INVENTORY_LOCATION_REQUIRED' });
  const movements = [];
  for (const item of items) {
    const productId = String(item?.product_id ?? item?.productId ?? item?.item_id ?? item?.id ?? '').trim();
    const quantity = Number(item?.qty ?? item?.quantity ?? 0);
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue;
    const product = db.prepare('SELECT product_id FROM catalog_products WHERE chat_id = ? AND product_id = ?').get(String(chatId), productId);
    if (!product) throw Object.assign(new Error('Fulfillment product not found'), { statusCode: 409, code: 'FULFILLMENT_PRODUCT_NOT_FOUND', productId });
    const balance = Number(db.prepare('SELECT COALESCE(SUM(quantity), 0) AS quantity FROM inventory_movements WHERE organization_id = ? AND location_id = ? AND product_id = ?').get(String(fulfillmentRow.organization_id), locationId, productId)?.quantity || 0);
    if (balance < quantity) throw Object.assign(new Error('Insufficient inventory for fulfillment'), { statusCode: 409, code: 'FULFILLMENT_INSUFFICIENT_INVENTORY', productId, available: balance, requested: quantity });
    const eventId = `fulfillment-sale:${fulfillmentRow.id}:${productId}`;
    const existing = db.prepare('SELECT * FROM inventory_movements WHERE event_id = ?').get(eventId);
    if (existing) { movements.push(inventoryMovementFromRow(existing)); continue; }
    const id = crypto.randomUUID(); const now = nowIso();
    db.prepare('INSERT INTO inventory_movements (id,event_id,organization_id,location_id,product_id,quantity,movement_type,reference_type,reference_id,actor_id,device_id,occurred_at,reason,metadata_json,created_at) VALUES (?,?,?,?,?,?,\'SALE\',\'fulfillment\',?,?,?,?,?,?,?)').run(id,eventId,String(fulfillmentRow.organization_id),locationId,productId,-quantity,String(fulfillmentRow.id),actor?.userId || null,actor?.deviceId || null,now,'Core fulfillment terminal inventory consequence',json({orderId:String(fulfillmentRow.server_order_id),fulfillmentId:String(fulfillmentRow.id)}),now);
    movements.push(inventoryMovementFromRow(db.prepare('SELECT * FROM inventory_movements WHERE id = ?').get(id)));
  }
  return movements;
}

export async function selectDeliveryCourier(chatId, organizationId, locationId) {
  ensureDatabase();
  const location = locationId ? String(locationId) : null;
  const candidate = db.prepare(`
    SELECT m.user_id, mr.scope_type, mr.scope_id,
           COUNT(DISTINCT da.id) AS active_workload
    FROM memberships m
    JOIN membership_roles mr
      ON mr.membership_id = m.id
     AND mr.status = 'active'
     AND mr.role_id = 'logistics_courier'
    LEFT JOIN delivery_assignments da
      ON da.courier_user_id = m.user_id
     AND da.organization_id = ?
     AND da.status IN ('ASSIGNED','ACCEPTED','OUT_FOR_DELIVERY')
     AND (? IS NULL OR da.location_id = ?)
    WHERE m.chat_id = ?
      AND m.status = 'active'
      AND (
        mr.scope_type IS NULL
        OR mr.scope_type != 'LOCATION'
        OR mr.scope_id = ?
      )
    GROUP BY m.user_id, mr.scope_type, mr.scope_id
    ORDER BY active_workload ASC, m.user_id ASC
    LIMIT 1
  `).get(String(organizationId), location, location, String(chatId), location);
  if (!candidate) {
    throw Object.assign(new Error('No eligible logistics courier is available'), {
      statusCode: 409, code: 'COURIER_CAPACITY_UNAVAILABLE',
    });
  }
  return candidate;
}

export async function assignDeliveryCourier(chatId, serverOrderId, courierUserId, actor = null, input = {}) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organization_id) throw Object.assign(new Error('Order organization is required'), { statusCode: 409 });
  const order = await getCoreFulfillmentOrder(String(chatId), String(serverOrderId));
  const organizationId = String(order.tenant_organization_id || '');
  if (organizationId !== String(tenant.organization_id)) throw Object.assign(new Error('Order organization mismatch'), { statusCode: 403 });
  const locationId = input.locationId || input.location_id || order.location_id || null;
  const type = normalizeCoreFulfillmentType(order.fulfillment_type || 'delivery');
  if (type !== 'delivery') throw Object.assign(new Error('Courier assignment requires delivery fulfillment'), { statusCode: 400 });
  const actorUserId = actor?.userId ? String(actor.userId) : null;
  let selectedCourierUserId = String(courierUserId || '').trim();
  const key = String(input.assignmentKey || input.assignment_key || `courier:auto:${serverOrderId}`).trim();
  let fulfillment = db.prepare('SELECT * FROM fulfillments WHERE server_order_id = ? AND organization_id = ?').get(String(serverOrderId), organizationId);
  if (!key) throw Object.assign(new Error('Assignment key is required'), { statusCode: 400 });
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!selectedCourierUserId) {
      const selected = await selectDeliveryCourier(chatId, organizationId, locationId);
      selectedCourierUserId = String(selected.user_id);
    }
    const courier = db.prepare(`
      SELECT m.user_id, mr.role_id, mr.scope_type, mr.scope_id
      FROM memberships m
      JOIN membership_roles mr ON mr.membership_id = m.id AND mr.status = 'active'
      WHERE m.user_id = ? AND m.chat_id = ? AND m.status = 'active'
        AND mr.role_id = 'logistics_courier'
    `).get(selectedCourierUserId, String(chatId));
    if (!courier) throw Object.assign(new Error('Courier does not have an active logistics courier role'), { statusCode: 403, code: 'COURIER_ROLE_REQUIRED' });
    const scopeId = courier.scope_type === 'LOCATION' ? String(courier.scope_id || '') : null;
    if (scopeId && String(locationId || '') !== scopeId) throw Object.assign(new Error('Courier role is outside the delivery location scope'), { statusCode: 403, code: 'COURIER_SCOPE_DENIED' });
    if (!fulfillment) {
      const now = nowIso();
      const fulfillmentId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO fulfillments
          (id, server_order_id, organization_id, location_id, fulfillment_type, status, destination_json,
           scheduled_at, tracking_reference, proof_json, last_command_key, created_by_user_id,
           updated_by_user_id, created_at, updated_at, version)
        VALUES (?, ?, ?, ?, 'delivery', 'pending', ?, ?, ?, ?, NULL, ?, ?, ?, ?, 1)
      `).run(
        fulfillmentId, String(serverOrderId), organizationId, locationId ? String(locationId) : null,
        json(order.delivery_address || null), order.scheduled_time || null, order.tracking_reference || null,
        json(order.fulfillment_proof || null), actorUserId, actorUserId, now, now,
      );
      fulfillment = db.prepare('SELECT * FROM fulfillments WHERE id = ?').get(fulfillmentId);
    }
    const existing = db.prepare('SELECT * FROM delivery_assignments WHERE fulfillment_id = ?').get(fulfillment.id);
    if (existing) {
      if (existing.courier_user_id !== selectedCourierUserId) throw Object.assign(new Error('Delivery is already assigned to another courier'), { statusCode: 409, code: 'ASSIGNMENT_CONFLICT' });
      db.exec('COMMIT');
      return existing;
    }
    const now = nowIso();
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO delivery_assignments
        (id,fulfillment_id,organization_id,location_id,courier_user_id,status,assignment_key,assigned_by_user_id,assigned_at,updated_at,version,last_command_key)
      VALUES (?,?,?,?,?,'ASSIGNED',?,?,?,?,1,?)
    `).run(id, fulfillment.id, organizationId, locationId ? String(locationId) : null, selectedCourierUserId, key, actorUserId, now, now, key);
    const row = db.prepare('SELECT * FROM delivery_assignments WHERE id = ?').get(id);
    audit(String(chatId), 'delivery.assignment.created', 'delivery_assignment', id, {
      orderId: String(serverOrderId), courierUserId: selectedCourierUserId, locationId: locationId ? String(locationId) : null,
    }, { organizationId, locationId: locationId ? String(locationId) : null, actorId: actorUserId });
    db.exec('COMMIT');
    return row;
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

export async function listDeliveryAssignments(chatId, actor = null, filters = {}) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organization_id) return [];
  const organizationId = String(tenant.organization_id);
  const status = String(filters.status || '').trim().toUpperCase();
  const locationId = String(filters.locationId || filters.location_id || '').trim();
  const courierUserId = String(filters.courierUserId || filters.courier_user_id || '').trim();
  const isCourier = Array.isArray(actor?.roles) && actor.roles.includes('logistics_courier') || actor?.role === 'logistics_courier';
  let courierLocationScoped = false;

  const clauses = [
    'da.organization_id = ?',
    "da.status IN ('ASSIGNED','ACCEPTED','OUT_FOR_DELIVERY')",
  ];
  const params = [organizationId];

  if (locationId) {
    const location = db.prepare('SELECT id FROM locations WHERE id = ? AND organization_id = ?').get(locationId, organizationId);
    if (!location) throw Object.assign(new Error('Location does not belong to this organization'), { statusCode: 403, code: 'LOCATION_SCOPE_DENIED' });
  }

  if (isCourier) {
    const actorUserId = String(actor?.userId || '').trim();
    const courierMembership = db.prepare(`
      SELECT m.user_id, mr.scope_type, mr.scope_id
      FROM memberships m
      JOIN membership_roles mr ON mr.membership_id = m.id AND mr.status = 'active'
      WHERE m.user_id = ? AND m.chat_id = ? AND m.status = 'active'
        AND mr.role_id = 'logistics_courier'
    `).get(actorUserId, String(chatId));
    if (!courierMembership) throw Object.assign(new Error('Active logistics courier role is required'), { statusCode: 403, code: 'COURIER_ROLE_REQUIRED' });
    if (courierMembership.scope_type === 'LOCATION') {
      const scopedLocation = String(courierMembership.scope_id || '');
      courierLocationScoped = true;
      if (locationId && String(locationId) !== scopedLocation) {
        throw Object.assign(new Error('Courier workload is outside the delivery location scope'), { statusCode: 403, code: 'COURIER_SCOPE_DENIED' });
      }
      clauses.push('da.location_id = ?');
      params.push(scopedLocation);
    }
  }
  if (status && ['ASSIGNED','ACCEPTED','OUT_FOR_DELIVERY'].includes(status)) {
    clauses[1] = 'da.status = ?';
    params.push(status);
  }
  if (locationId && !courierLocationScoped) {
    clauses.push('da.location_id = ?');
    params.push(locationId);
  }
  if (isCourier) {
    clauses.push('da.courier_user_id = ?');
    params.push(String(actor.userId));
  } else if (courierUserId) {
    clauses.push('da.courier_user_id = ?');
    params.push(courierUserId);
  }

  return db.prepare(`
    SELECT da.id, da.fulfillment_id, da.organization_id, da.location_id,
           da.courier_user_id, u.display_name AS courier_name, da.status,
           da.assignment_key, da.assigned_by_user_id, da.assigned_at,
           da.updated_at, da.version, f.server_order_id,
           f.fulfillment_type, f.status AS fulfillment_status,
           f.scheduled_at, f.tracking_reference, f.destination_json,
           l.code AS location_code, l.name AS location_name, l.type AS location_type
    FROM delivery_assignments da
    JOIN fulfillments f ON f.id = da.fulfillment_id
    LEFT JOIN users u ON u.id = da.courier_user_id
    LEFT JOIN locations l ON l.id = da.location_id AND l.organization_id = da.organization_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY
      CASE da.status WHEN 'OUT_FOR_DELIVERY' THEN 1 WHEN 'ACCEPTED' THEN 2 ELSE 3 END,
      da.updated_at DESC
    LIMIT 200
  `).all(...params).map(row => ({
    ...row,
    dispatch: {
      locationId: row.location_id || null,
      locationCode: row.location_code || null,
      locationName: row.location_name || null,
      locationType: row.location_type || null,
      scheduledAt: row.scheduled_at || null,
      trackingReference: row.tracking_reference || null,
      destination: parseJSON(row.destination_json, null),
    },
  }));
}

export async function getDeliveryAssignment(chatId, serverOrderId, actor = null) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organization_id) return null;
  const row = db.prepare(`
    SELECT da.*,
           f.scheduled_at AS fulfillment_scheduled_at,
           f.tracking_reference AS fulfillment_tracking_reference,
           f.destination_json AS fulfillment_destination_json,
           l.code AS location_code,
           l.name AS location_name,
           l.type AS location_type
    FROM delivery_assignments da
    JOIN fulfillments f ON f.id = da.fulfillment_id
    LEFT JOIN locations l ON l.id = da.location_id AND l.organization_id = da.organization_id
    WHERE f.server_order_id = ? AND da.organization_id = ?
      AND da.status IN ('ASSIGNED','ACCEPTED','OUT_FOR_DELIVERY')
    ORDER BY da.updated_at DESC
    LIMIT 1
  `).get(String(serverOrderId), String(tenant.organization_id));
  if (!row) return null;
  return {
    ...row,
    dispatch: {
      locationId: row.location_id || null,
      locationCode: row.location_code || null,
      locationName: row.location_name || null,
      locationType: row.location_type || null,
      scheduledAt: row.fulfillment_scheduled_at || null,
      trackingReference: row.fulfillment_tracking_reference || null,
      destination: parseJSON(row.fulfillment_destination_json, null),
    },
  };
}

export async function assertCourierOwnsDelivery(chatId, serverOrderId, actor) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  const actorUserId = String(actor?.userId || '').trim();
  if (!tenant?.organization_id || !actorUserId) {
    throw Object.assign(new Error('Courier identity is required'), { statusCode: 403, code: 'COURIER_IDENTITY_REQUIRED' });
  }
  const membership = db.prepare(`
    SELECT m.user_id, mr.scope_type, mr.scope_id
    FROM memberships m
    JOIN membership_roles mr ON mr.membership_id = m.id AND mr.status = 'active'
    WHERE m.user_id = ? AND m.chat_id = ? AND m.status = 'active'
      AND mr.role_id = 'logistics_courier'
  `).get(actorUserId, String(chatId));
  if (!membership) {
    throw Object.assign(new Error('Active logistics courier role is required'), { statusCode: 403, code: 'COURIER_ROLE_REQUIRED' });
  }
  const assignment = await getDeliveryAssignment(chatId, serverOrderId, actor);
  if (!assignment || String(assignment.courier_user_id) !== actorUserId) {
    throw Object.assign(new Error('Courier is not assigned to this delivery'), { statusCode: 403, code: 'COURIER_ASSIGNMENT_REQUIRED' });
  }
  if (membership.scope_type === 'LOCATION' && String(membership.scope_id || '') !== String(assignment.location_id || '')) {
    throw Object.assign(new Error('Courier role is outside the delivery location scope'), { statusCode: 403, code: 'COURIER_SCOPE_DENIED' });
  }
  if (String(assignment.organization_id) !== String(tenant.organization_id)) {
    throw Object.assign(new Error('Courier assignment organization mismatch'), { statusCode: 403, code: 'COURIER_ORGANIZATION_DENIED' });
  }
  if (['CANCELLED','FAILED','REASSIGNED'].includes(String(assignment.status))) {
    throw Object.assign(new Error('Courier assignment is no longer active'), { statusCode: 403, code: 'COURIER_ASSIGNMENT_INACTIVE' });
  }
  return assignment;
}

export async function transitionDeliveryAssignment(chatId, serverOrderId, action, actor = null, input = {}) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organization_id) throw Object.assign(new Error('Order organization is required'), { statusCode: 409, code: 'ORDER_ORGANIZATION_REQUIRED' });
  const order = await getCoreFulfillmentOrder(String(chatId), String(serverOrderId));
  const organizationId = String(order.tenant_organization_id || '');
  if (organizationId !== String(tenant.organization_id)) throw Object.assign(new Error('Order organization mismatch'), { statusCode: 403 });
  const normalizedAction = String(action || '').trim().toUpperCase();
  const targetCourierId = String(input.courierUserId || input.courier_user_id || '').trim();
  const exceptionReason = String(input.reason || input.exceptionReason || input.exception_reason || '').trim().slice(0, 500);
  const commandKey = String(input.idempotencyKey || input.idempotency_key || '').trim();
  if (!commandKey) throw Object.assign(new Error('Idempotency key is required'), { statusCode: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' });
  if (normalizedAction === 'REASSIGN_EXCEPTION') {
    if (!targetCourierId) throw Object.assign(new Error('A different courier is required to resolve a delivery exception'), { statusCode: 400, code: 'REASSIGNMENT_TARGET_REQUIRED' });
    const courier = db.prepare(`SELECT m.user_id, mr.scope_type, mr.scope_id FROM memberships m JOIN membership_roles mr ON mr.membership_id = m.id AND mr.status = 'active' WHERE m.user_id = ? AND m.chat_id = ? AND m.status = 'active' AND mr.role_id = 'logistics_courier'`).get(targetCourierId, String(chatId));
    if (!courier) throw Object.assign(new Error('Target courier does not have an active logistics courier role'), { statusCode: 403, code: 'COURIER_ROLE_REQUIRED' });
    db.exec('BEGIN IMMEDIATE');
    try {
      const existingCommand = db.prepare('SELECT * FROM delivery_assignments WHERE organization_id = ? AND last_command_key = ? ORDER BY updated_at DESC LIMIT 1').get(organizationId, commandKey);
      if (existingCommand) {
        if (String(existingCommand.status) !== 'ASSIGNED') {
          throw Object.assign(new Error('Idempotency key was already used for a different delivery command'), { statusCode: 409, code: 'IDEMPOTENCY_KEY_REUSE_CONFLICT' });
        }
        db.exec('COMMIT');
        return existingCommand;
      }
      const exception = db.prepare(`SELECT da.* FROM delivery_assignments da JOIN fulfillments f ON f.id = da.fulfillment_id WHERE f.server_order_id = ? AND da.organization_id = ? AND da.status IN ('CANCELLED','FAILED') ORDER BY da.updated_at DESC LIMIT 1`).get(String(serverOrderId), organizationId);
      if (!exception) throw Object.assign(new Error('No unresolved delivery exception exists'), { statusCode: 409, code: 'EXCEPTION_NOT_FOUND' });
      if (String(targetCourierId) === String(exception.courier_user_id)) throw Object.assign(new Error('A different courier is required to resolve a delivery exception'), { statusCode: 400, code: 'REASSIGNMENT_TARGET_REQUIRED' });
      const locationId = input.locationId || input.location_id || exception.location_id || order.location_id || null;
      if (courier.scope_type === 'LOCATION' && String(courier.scope_id || '') !== String(locationId || '')) throw Object.assign(new Error('Target courier is outside the delivery location scope'), { statusCode: 403, code: 'COURIER_SCOPE_DENIED' });
      const now = nowIso();
      db.prepare('UPDATE delivery_assignments SET status = \'REASSIGNED\', last_command_key = ?, updated_at = ?, version = version + 1 WHERE id = ?').run(commandKey, now, exception.id);
      const assignmentKey = String(input.assignmentKey || input.assignment_key || ('exception-reassign:' + serverOrderId + ':' + targetCourierId + ':' + commandKey)).trim();
      const newId = crypto.randomUUID();
      db.prepare(`INSERT INTO delivery_assignments (id,fulfillment_id,organization_id,location_id,courier_user_id,status,assignment_key,assigned_by_user_id,assigned_at,updated_at,version,last_command_key) VALUES (?,?,?,?,?,'ASSIGNED',?,?,?,?,1,?)`).run(newId, exception.fulfillment_id, organizationId, locationId ? String(locationId) : null, targetCourierId, assignmentKey, actor?.userId || null, now, now, commandKey);
      const result = db.prepare('SELECT * FROM delivery_assignments WHERE id = ?').get(newId);
      audit(String(chatId), 'delivery.assignment.exception_resolved', 'delivery_assignment', newId, { orderId: String(serverOrderId), previousAssignmentId: exception.id, previousStatus: exception.status, previousCourierUserId: String(exception.courier_user_id), courierUserId: targetCourierId, commandKey, resolutionReason: exceptionReason }, { organizationId, locationId, actorId: actor?.userId || null, deviceId: actor?.deviceId || null });
      db.exec('COMMIT');
      return result;
    } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
  }

  const transitions = {
    ASSIGNED: new Set(['ACCEPTED','CANCELLED','FAILED','REASSIGNED']),
    ACCEPTED: new Set(['OUT_FOR_DELIVERY','CANCELLED','FAILED','REASSIGNED']),
    OUT_FOR_DELIVERY: new Set(['DELIVERED','CANCELLED','FAILED','REASSIGNED']),
  };
  if (['CANCELLED','FAILED'].includes(normalizedAction) && !exceptionReason) throw Object.assign(new Error('A reason is required when cancelling or failing a delivery assignment'), { statusCode: 400, code: 'EXCEPTION_REASON_REQUIRED' });
  const proofInput = input.proof;
  if (normalizedAction === 'DELIVERED' && (proofInput == null || (typeof proofInput === 'string' && !proofInput.trim()))) {
    throw Object.assign(new Error('Delivery proof is required before delivery completion'), { statusCode: 400, code: 'DELIVERY_PROOF_REQUIRED' });
  }
  if (normalizedAction === 'DELIVERED' && typeof proofInput === 'object' && !Array.isArray(proofInput)) {
    const proofType = String(proofInput.type || proofInput.kind || '').trim().toLowerCase();
    const proofReference = String(proofInput.reference || proofInput.referenceId || proofInput.reference_id || '').trim();
    if (!proofType || !proofReference) {
      throw Object.assign(new Error('Delivery proof type and reference are required'), { statusCode: 400, code: 'DELIVERY_PROOF_INVALID' });
    }
  }

  if (normalizedAction === 'REASSIGNED') {
    if (!targetCourierId || targetCourierId === String(active.courier_user_id)) throw Object.assign(new Error('A different courier is required for reassignment'), { statusCode: 400, code: 'REASSIGNMENT_TARGET_REQUIRED' });
    const courier = db.prepare(`SELECT m.user_id, mr.scope_type, mr.scope_id FROM memberships m JOIN membership_roles mr ON mr.membership_id = m.id AND mr.status = 'active' WHERE m.user_id = ? AND m.chat_id = ? AND m.status = 'active' AND mr.role_id = 'logistics_courier'`).get(targetCourierId, String(chatId));
    if (!courier) throw Object.assign(new Error('Target courier does not have an active logistics courier role'), { statusCode: 403, code: 'COURIER_ROLE_REQUIRED' });
    const locationId = input.locationId || input.location_id || active.location_id || order.location_id || null;
    if (courier.scope_type === 'LOCATION' && String(courier.scope_id || '') !== String(locationId || '')) throw Object.assign(new Error('Target courier is outside the delivery location scope'), { statusCode: 403, code: 'COURIER_SCOPE_DENIED' });
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    const existingCommand = db.prepare('SELECT * FROM delivery_assignments WHERE organization_id = ? AND last_command_key = ? ORDER BY updated_at DESC LIMIT 1').get(organizationId, commandKey);
    if (existingCommand) {
      const replayCompatible = normalizedAction === 'REASSIGN_EXCEPTION'
        ? String(existingCommand.status) === 'ASSIGNED'
        : String(existingCommand.status) === normalizedAction;
      if (!replayCompatible) throw Object.assign(new Error('Idempotency key was already used for a different delivery command'), { statusCode: 409, code: 'IDEMPOTENCY_KEY_REUSE_CONFLICT' });
      db.exec('COMMIT');
      return existingCommand;
    }
    const active = db.prepare(`SELECT da.* FROM delivery_assignments da JOIN fulfillments f ON f.id = da.fulfillment_id WHERE f.server_order_id = ? AND da.organization_id = ? AND da.status IN ('ASSIGNED','ACCEPTED','OUT_FOR_DELIVERY') ORDER BY da.updated_at DESC LIMIT 1`).get(String(serverOrderId), organizationId);
    if (!active) throw Object.assign(new Error('No active courier assignment exists'), { statusCode: 409, code: 'ASSIGNMENT_REQUIRED' });
    const current = String(active.status);
    if (!transitions[current]?.has(normalizedAction)) throw Object.assign(new Error('Cannot move assignment from ' + current + ' to ' + normalizedAction), { statusCode: 409, code: 'INVALID_ASSIGNMENT_TRANSITION' });
    const now = nowIso();
    const fulfillment = db.prepare('SELECT * FROM fulfillments WHERE id = ? AND organization_id = ?').get(active.fulfillment_id, organizationId);
    if (!fulfillment) throw Object.assign(new Error('Fulfillment not found'), { statusCode: 404, code: 'FULFILLMENT_NOT_FOUND' });
    const fulfillmentTarget = normalizedAction === 'OUT_FOR_DELIVERY' ? 'out_for_delivery' : normalizedAction === 'DELIVERED' ? 'delivered' : null;
    if (normalizedAction === 'DELIVERED') {
      const existingProof = fulfillment.proof_json ? (() => { try { return JSON.parse(fulfillment.proof_json); } catch { return fulfillment.proof_json; } })() : null;
      if (existingProof && JSON.stringify(existingProof) !== JSON.stringify(proofInput)) {
        throw Object.assign(new Error('Delivery proof cannot be changed after capture'), { statusCode: 409, code: 'DELIVERY_PROOF_IMMUTABLE' });
      }
    }
    if (fulfillmentTarget) {
      const currentFulfillment = normalizeCoreFulfillmentStatus(fulfillment.status);
      if (!CORE_FULFILLMENT_TRANSITIONS.delivery[currentFulfillment]?.has(fulfillmentTarget)) throw Object.assign(new Error('Cannot move fulfillment from ' + currentFulfillment + ' to ' + fulfillmentTarget), { statusCode: 409, code: 'INVALID_FULFILLMENT_TRANSITION' });
      db.prepare(`UPDATE fulfillments SET status = ?, last_command_key = ?, updated_by_user_id = ?, updated_at = ?, version = version + 1, proof_json = CASE WHEN ? IS NULL THEN proof_json ELSE ? END WHERE id = ?`).run(fulfillmentTarget, commandKey, actor?.userId || null, now, input.proof === undefined ? null : json(input.proof), input.proof === undefined ? null : json(input.proof), fulfillment.id);
    }
    db.prepare('UPDATE delivery_assignments SET status = ?, last_command_key = ?, updated_at = ?, version = version + 1 WHERE id = ?').run(normalizedAction, commandKey, now, active.id);

    let result = db.prepare('SELECT * FROM delivery_assignments WHERE id = ?').get(active.id);
    if (normalizedAction === 'REASSIGNED') {
      const locationId = input.locationId || input.location_id || active.location_id || order.location_id || null;
      const assignmentKey = String(input.assignmentKey || input.assignment_key || ('reassign:' + serverOrderId + ':' + targetCourierId + ':' + commandKey)).trim();
      db.prepare(`INSERT INTO delivery_assignments (id,fulfillment_id,organization_id,location_id,courier_user_id,status,assignment_key,assigned_by_user_id,assigned_at,updated_at,version,last_command_key) VALUES (?,?,?,?,?,'ASSIGNED',?,?,?,?,1,?)`).run(crypto.randomUUID(), active.fulfillment_id, organizationId, locationId ? String(locationId) : null, targetCourierId, assignmentKey, actor?.userId || null, now, now, commandKey);
      result = db.prepare('SELECT * FROM delivery_assignments WHERE fulfillment_id = ? AND status = \'ASSIGNED\' ORDER BY updated_at DESC LIMIT 1').get(active.fulfillment_id);
      audit(String(chatId), 'delivery.assignment.reassigned', 'delivery_assignment', result.id, { orderId: String(serverOrderId), previousCourierUserId: String(active.courier_user_id), courierUserId: targetCourierId, commandKey }, { organizationId, locationId, actorId: actor?.userId || null, deviceId: actor?.deviceId || null });
    } else if (normalizedAction === 'DELIVERED') {
      const updatedFulfillment = db.prepare('SELECT * FROM fulfillments WHERE id = ?').get(fulfillment.id);
      const inventoryMovements = applyCoreFulfillmentInventoryConsequence(String(chatId), updatedFulfillment, orderFromRow(order), actor);
      audit(String(chatId), 'delivery.assignment.delivered', 'delivery_assignment', active.id, { orderId: String(serverOrderId), from: current, to: normalizedAction, commandKey, proofAttached: true, inventoryMovementIds: inventoryMovements.map(item => item.id) }, { organizationId, locationId: active.location_id, actorId: actor?.userId || null, deviceId: actor?.deviceId || null });
    } else {
      audit(String(chatId), 'delivery.assignment.' + normalizedAction.toLowerCase(), 'delivery_assignment', active.id, { orderId: String(serverOrderId), from: current, to: normalizedAction, commandKey, ...(exceptionReason ? { exceptionReason } : {}) }, { organizationId, locationId: active.location_id, actorId: actor?.userId || null, deviceId: actor?.deviceId || null });
    }
    db.exec('COMMIT');
    return result;
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
}

export async function transitionOrderFulfillment(chatId, serverOrderId, nextStatus, actor = null, input = {}) {
  ensureDatabase();
  const key = String(chatId);
  const order = await getCoreFulfillmentOrder(key, serverOrderId);
  const organizationId = String(order.tenant_organization_id || '');
  if (!organizationId) throw Object.assign(new Error('Order organization is required'), { statusCode: 409, code: 'ORDER_ORGANIZATION_REQUIRED' });

  const commandKey = String(input.idempotencyKey || input.idempotency_key || '').trim();
  if (!commandKey) throw Object.assign(new Error('Idempotency key is required'), { statusCode: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' });
  const target = normalizeCoreFulfillmentStatus(nextStatus);

  const orderJson = orderFromRow(order);
  const type = normalizeCoreFulfillmentType(input.fulfillmentType || input.fulfillment_type || orderJson.fulfillment_type || 'delivery');
  if (!CORE_FULFILLMENT_TRANSITIONS[type]) throw Object.assign(new Error('Unsupported fulfillment type'), { statusCode: 400 });

  const actorUserId = actor?.userId && db.prepare('SELECT id FROM users WHERE id = ?').get(String(actor.userId)) ? String(actor.userId) : null;
  const locationId = input.locationId || input.location_id || actor?.locationId || null;
  if (locationId) {
    const location = db.prepare('SELECT id FROM locations WHERE id = ? AND organization_id = ?').get(String(locationId), organizationId);
    if (!location) throw Object.assign(new Error('Location does not belong to this organization'), { statusCode: 400, code: 'LOCATION_SCOPE_DENIED' });
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    let row = db.prepare('SELECT * FROM fulfillments WHERE server_order_id = ? AND organization_id = ?').get(String(serverOrderId), organizationId);
    const now = nowIso();
    if (!row) {
      const fulfillmentId = crypto.randomUUID();
      const destination = input.destination ?? (type === 'delivery' ? orderJson.delivery_address : orderJson.pickup_location) ?? null;
      const scheduledAt = input.scheduledAt || input.scheduled_at || orderJson.scheduled_time || null;
      db.prepare(`
        INSERT INTO fulfillments
          (id, server_order_id, organization_id, location_id, fulfillment_type, status, destination_json, scheduled_at, tracking_reference, proof_json, last_command_key, created_by_user_id, updated_by_user_id, created_at, updated_at, version)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, NULL, ?, ?, ?, ?, 1)
      `).run(
        fulfillmentId, String(serverOrderId), organizationId, locationId ? String(locationId) : null, type,
        json(destination), scheduledAt, input.trackingReference || input.tracking_reference || orderJson.tracking_reference || null,
        json(input.proof ?? orderJson.fulfillment_proof ?? null), actorUserId, actorUserId, now, now,
      );
      row = db.prepare('SELECT * FROM fulfillments WHERE id = ?').get(fulfillmentId);
    }

    if (String(row.last_command_key || '') === commandKey) {
      db.exec('COMMIT');
      return fulfillmentFromRow(row);
    }
    if (row.fulfillment_type !== type) throw Object.assign(new Error('Fulfillment type cannot change'), { statusCode: 409, code: 'FULFILLMENT_TYPE_IMMUTABLE' });
    const current = normalizeCoreFulfillmentStatus(row.status);
    if (!CORE_FULFILLMENT_TRANSITIONS[type][current]?.has(target)) {
      throw Object.assign(new Error(`Cannot move fulfillment from ${current} to ${target}`), { statusCode: 409, code: 'INVALID_FULFILLMENT_TRANSITION' });
    }

    db.prepare(`
      UPDATE fulfillments
      SET status = ?, last_command_key = ?, updated_by_user_id = ?, updated_at = ?, version = version + 1,
          tracking_reference = COALESCE(?, tracking_reference), proof_json = COALESCE(?, proof_json)
      WHERE id = ?
    `).run(
      target, commandKey, actorUserId, now,
      input.trackingReference || input.tracking_reference || null,
      input.proof === undefined ? null : json(input.proof),
      row.id,
    );
    const updated = db.prepare('SELECT * FROM fulfillments WHERE id = ?').get(row.id);
    const inventoryMovements = applyCoreFulfillmentInventoryConsequence(key, updated, orderJson, actor);
    audit(key, 'fulfillment.transitioned', 'fulfillment', row.id, {
      orderId: String(serverOrderId), from: current, to: target, commandKey,
      inventoryMovementIds: inventoryMovements.map(item => item.id),
    }, {
      organizationId, locationId: updated.location_id, actorId: actorUserId, deviceId: actor?.deviceId || null,
    });
    db.exec('COMMIT');
    return fulfillmentFromRow(updated);
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

export function coreFulfillmentContract() {
  return Object.freeze({
    authority: 'backend/lib/store-sqlite.js',
    entity: 'fulfillments',
    order_authority: 'orders',
    organization_scope: 'tenant organization_id',
    location_scope: 'organization-owned location_id',
    transition_authority: 'server',
    delivery_transitions: 'pending -> out_for_delivery -> delivered; assignment: ASSIGNED -> ACCEPTED -> OUT_FOR_DELIVERY -> DELIVERED',
    pickup_transitions: 'pending -> ready_for_pickup -> picked_up',
    idempotency: 'client command key; replay returns current canonical state',
    inventory_consequence: 'terminal fulfillment atomically records SALE movements in existing inventory_movements authority',
    cross_feature_boundary: 'delivery terminal transition may invoke existing inventory consequence only; payment and settlement remain read-only external authorities',
    payment_authority: 'unchanged; delivery does not mutate payment state or payment ledger',
    settlement_authority: 'unchanged; delivery does not create, settle, reverse, or mutate settlement records',
    marketplace_fulfillment_reuse: false,
  });
}

export async function getOrders(chatId) {
  ensureDatabase();
  return db.prepare('SELECT * FROM orders WHERE chat_id = ? ORDER BY created_at DESC').all(String(chatId)).map(row => {
    const order = orderFromRow(row);
    return row.customer_id && !order.customer_id ? { ...order, customer_id: row.customer_id } : order;
  });
}

export async function saveQueuedOrders(chatId, queuedOrders) {
  ensureDatabase();
  const key = String(chatId);
  const results = [];
  db.exec('BEGIN');
  try {
    for (const order of Array.isArray(queuedOrders) ? queuedOrders : []) {
      if (!order || order.id == null) {
        results.push({ local_id: order?.id, status: 'rejected', error: 'Order id is required' });
        continue;
      }
      const localId = String(order.id);
      const already = db.prepare('SELECT server_order_id FROM orders WHERE chat_id = ? AND local_id = ?').get(key, localId);
      if (already) {
        results.push({ local_id: order.id, status: 'synced', order_id: already.server_order_id });
        continue;
      }
      const expectedCurrency = tenantCurrency(key);
      if (order.currency != null && normaliseCurrency(order.currency, expectedCurrency) !== expectedCurrency) {
        results.push({ local_id: order.id, status: 'rejected', error: 'Order currency does not match the organization currency' });
        continue;
      }
      const { items, total } = validateAndTotalOrderItems(order.items, expectedCurrency);
      if (!items.length) {
        results.push({ local_id: order.id, status: 'rejected', error: 'No valid line items' });
        continue;
      }
      let customerId = order.customer_id ? String(order.customer_id) : null;
      if (order.customer && typeof order.customer === 'object') {
        const customer = await upsertCustomer(key, order.customer);
        customerId = customer.id;
      } else if (order.customer_name || order.customer_phone) {
        const customer = await upsertCustomer(key, {
          id: customerId || undefined,
          name: order.customer_name || '',
          phone: order.customer_phone || '',
          source: order.is_marketplace ? 'marketplace' : 'order',
        });
        customerId = customer.id;
      }
      if (customerId) {
        const owned = db.prepare('SELECT id FROM customers WHERE id = ? AND organization_id = (SELECT organization_id FROM tenants WHERE chat_id = ?)').get(customerId, key);
        if (!owned) customerId = null;
      }
      const serverOrderId = crypto.randomUUID();
      const stored = {
        ...order,
        ...(customerId ? { customer_id: customerId } : {}),
        items,
        total,
        currency: expectedCurrency,
        server_order_id: serverOrderId,
        status: 'synced',
        synced_at: nowIso(),
        delivered_to_device: true,
      };
      insertOrder(key, localId, stored);
      ensureCanonicalPaymentForOrder(key, stored, serverOrderId, null);
      audit(key, 'order.synced', 'order', serverOrderId, { localId, totalMinor: total });
      results.push({ local_id: order.id, status: 'synced', order_id: serverOrderId });
    }
    db.exec('COMMIT');
    return results;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export async function pullNewOrders(chatId) {
  ensureDatabase();
  const key = String(chatId);
  db.exec('BEGIN');
  try {
    const rows = db.prepare(`
      SELECT * FROM orders
      WHERE chat_id = ? AND delivered_to_device = 0
      ORDER BY created_at ASC
    `).all(key);
    for (const row of rows) {
      db.prepare('UPDATE orders SET delivered_to_device = 1 WHERE chat_id = ? AND local_id = ?').run(key, row.local_id);
      audit(key, 'order.delivered', 'order', row.server_order_id);
    }
    db.exec('COMMIT');
    return rows.map(row => ({ ...orderFromRow(row), delivered_to_device: true }));
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function defaultVendorCode(chatId) {
  const digits = String(chatId).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  return 'V' + digits.padStart(6, '0');
}

export async function searchMarketplaceListings() {
  ensureDatabase();
  return db.prepare(`
    SELECT p.*, t.seller_name, t.branding_json, t.vendor_code
    FROM catalog_products p
    JOIN tenants t ON t.chat_id = p.chat_id
    WHERE p.marketplace_listed = 1 AND (p.stock IS NULL OR p.stock > 0)
    ORDER BY p.updated_at DESC
  `).all().map(row => {
    const product = productFromRow(row);
    return {
      listing_id: `${row.chat_id}_${row.product_id}`,
      seller_id: row.chat_id,
      item_id: row.product_id,
      title: product.name,
      price: row.price_minor,
      currency: normaliseCurrency(row.currency || parseJSON(row.branding_json, {})?.currency, 'ETB'),
      category: product.category || 'General',
      seller_name: row.seller_name || 'Community Stall',
      vendor_code: row.vendor_code || defaultVendorCode(row.chat_id),
      is_available: true,
    };
  });
}

export async function createMarketplaceOrder({ buyer_id, buyer_identity, customer_name, customer_phone, items, idempotency_key = null }) {
  ensureDatabase();
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error('No items in order'), { statusCode: 400 });
  }

  const buyerIdentity = String(buyer_identity || buyer_id || 'anonymous').trim().slice(0, 200) || 'anonymous';
  const idempotencyKey = String(idempotency_key || '').trim().slice(0, 200);
  const normalizedItems = [];
  const bySeller = new Map();
  for (const raw of items) {
    const sellerId = raw && raw.seller_id;
    const itemId = raw && raw.item_id;
    const qty = Number(raw && raw.qty);
    if (!sellerId || !itemId || !Number.isFinite(qty) || qty <= 0 || Math.floor(qty) < 1) {
      throw Object.assign(new Error('Invalid line item — each item needs seller_id, item_id, and a positive whole qty'), { statusCode: 400 });
    }
    const wholeQty = Math.floor(qty);
    if (wholeQty > 100000) {
      throw Object.assign(new Error('Line item quantity exceeds marketplace risk limit'), { statusCode: 409, code: 'MARKETPLACE_RISK_LIMIT' });
    }
    const sellerKey = String(sellerId);
    const itemKey = String(itemId);
    if (!bySeller.has(sellerKey)) bySeller.set(sellerKey, new Map());
    const sellerLines = bySeller.get(sellerKey);
    sellerLines.set(itemKey, (sellerLines.get(itemKey) || 0) + wholeQty);
  }
  for (const [sellerId, sellerLines] of bySeller) {
    for (const [itemId, qty] of sellerLines) normalizedItems.push({ seller_id: sellerId, item_id: itemId, qty });
  }
  normalizedItems.sort((a, b) => `${a.seller_id}:${a.item_id}`.localeCompare(`${b.seller_id}:${b.item_id}`));

  const requestHash = crypto.createHash('sha256').update(JSON.stringify({
    buyerIdentity,
    customerName: String(customer_name || '').trim(),
    customerPhone: String(customer_phone || '').trim(),
    items: normalizedItems,
  })).digest('hex');

  const marketplaceOrderId = crypto.randomUUID();
  const trackingToken = crypto.randomBytes(24).toString('base64url');
  const trackingTokenHash = hashToken(trackingToken);
  const subOrders = [];
  let marketplaceCurrency = null;
  let grandTotal = 0;

  db.exec('BEGIN IMMEDIATE');
  try {
    if (idempotencyKey) {
      const existing = db.prepare('SELECT response_json, request_hash FROM marketplace_checkout_idempotency WHERE idempotency_key = ?').get(idempotencyKey);
      if (existing) {
        if (existing.request_hash !== requestHash) {
          throw Object.assign(new Error('Idempotency key was already used with a different checkout request'), { statusCode: 409, code: 'IDEMPOTENCY_KEY_REUSED' });
        }
        db.exec('COMMIT');
        return parseJSON(existing.response_json, {});
      }
    }

    const recentWindowMs = 10 * 60 * 1000;
    const recentCutoff = new Date(Date.now() - recentWindowMs).toISOString();
    const recent = db.prepare(`
      SELECT COUNT(*) AS count
      FROM marketplace_orders
      WHERE buyer_identity = ? AND created_at >= ? AND status NOT IN ('cancelled','completed')
    `).get(buyerIdentity, recentCutoff);
    if (Number(recent?.count || 0) >= 10) {
      throw Object.assign(new Error('Too many active marketplace orders for this buyer identity'), { statusCode: 429, code: 'MARKETPLACE_ORDER_LIMIT' });
    }

    db.prepare(`
      INSERT INTO marketplace_orders
        (id, buyer_identity, customer_name, customer_phone, currency, total_minor, status, tracking_token_hash, idempotency_key, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'ETB', 0, 'queued', ?, ?, ?, ?)
    `).run(
      marketplaceOrderId,
      buyerIdentity,
      String(customer_name || 'Marketplace Buyer').trim().slice(0, 200),
      String(customer_phone || '').trim().slice(0, 80),
      trackingTokenHash,
      idempotencyKey || null,
      nowIso(),
      nowIso(),
    );

    for (const [sellerId, sellerLines] of bySeller) {
      const tenant = db.prepare('SELECT * FROM tenants WHERE chat_id = ?').get(sellerId);
      if (!tenant) throw Object.assign(new Error(`Unknown seller: ${sellerId}`), { statusCode: 400 });

      const sellerItems = [];
      let subtotal = 0;
      const sellerCurrency = normaliseCurrency(tenant.branding_json ? parseJSON(tenant.branding_json, {})?.currency : null, 'ETB');
      if (marketplaceCurrency && marketplaceCurrency !== sellerCurrency) {
        throw Object.assign(new Error('Marketplace checkout requires one currency across all sellers'), { statusCode: 409 });
      }
      marketplaceCurrency = sellerCurrency;

      for (const [itemId, qty] of sellerLines) {
        const row = db.prepare('SELECT * FROM catalog_products WHERE chat_id = ? AND product_id = ?').get(sellerId, itemId);
        if (!row) throw Object.assign(new Error(`Item no longer listed: ${itemId}`), { statusCode: 409 });
        const product = productFromRow(row);
        if (!product.marketplace_listed) {
          throw Object.assign(new Error(`Item no longer listed: ${itemId}`), { statusCode: 409 });
        }
        const sellerOrg = tenant.organization_id;
        const defaultLocation = db.prepare(
          "SELECT id FROM locations WHERE organization_id = ? AND code = 'DEFAULT' LIMIT 1"
        ).get(String(sellerOrg));
        if (!defaultLocation) {
          throw Object.assign(new Error('Canonical inventory location is unavailable'), { statusCode: 409, code: 'INVENTORY_LOCATION_UNAVAILABLE' });
        }
        const canonicalBalance = Number(db.prepare(`
          SELECT COALESCE(SUM(quantity), 0) AS quantity
          FROM inventory_movements
          WHERE organization_id = ? AND location_id = ? AND product_id = ?
        `).get(String(sellerOrg), String(defaultLocation.id), String(itemId))?.quantity || 0);
        if (canonicalBalance < qty) {
          throw Object.assign(new Error(`Not enough stock for "${product.name}" (${canonicalBalance} left)`), { statusCode: 409 });
        }

        // inventory_movements is the physical stock authority. catalog_products.stock
        // is retained only as a compatibility projection for older clients.
        const movementEventId = `marketplace-sale:${marketplaceOrderId}:${sellerId}:${itemId}`;
        await appendInventoryMovement(sellerId, {
          productId: itemId,
          locationId: String(defaultLocation.id),
          quantity: -qty,
          movementType: 'SALE',
          referenceType: 'marketplace_order',
          referenceId: marketplaceOrderId,
          eventId: movementEventId,
          occurredAt: nowIso(),
          reason: 'Marketplace checkout',
          metadata: { marketplaceOrderId, sellerId, quantity: qty },
        });
        product.stock = canonicalBalance - qty;
        product.stock_revision = (Number.isInteger(row.stock_revision) ? row.stock_revision : 0) + 1;
        insertProduct(sellerId, product);

        const price = row.price_minor;
        const lineTotal = price * qty;
        subtotal += lineTotal;
        grandTotal += lineTotal;
        sellerItems.push({ item_id: product.id, name: product.name, price, qty, total: lineTotal, currency: sellerCurrency, category: product.category });
      }

      const orderId = `MPO_${marketplaceOrderId}_${sellerId}`;
      const serverOrderId = crypto.randomUUID();
      const sellerOrderCanonicalId = crypto.randomUUID();
      const order = {
        id: orderId,
        marketplace_order_id: marketplaceOrderId,
        is_marketplace: true,
        vendor_code: tenant.vendor_code || defaultVendorCode(sellerId),
        items: sellerItems,
        total: subtotal,
        currency: sellerCurrency,
        customer_name: customer_name || 'Marketplace Buyer',
        customer_phone: customer_phone || '',
        buyer_id: buyer_id || buyerIdentity,
        buyer_identity: buyerIdentity,
        buyer_tracking_token_hash: trackingTokenHash,
        status: 'queued',
        created_at: Date.now(),
        created_by_role: 'buyer',
        created_by_user: customer_name || 'Marketplace Buyer',
      };
      insertOrder(sellerId, orderId, {
        ...order,
        server_order_id: serverOrderId,
        synced_at: nowIso(),
        delivered_to_device: false,
      });

      db.prepare(`
        INSERT INTO marketplace_seller_orders
          (id, marketplace_order_id, seller_id, seller_order_id, organization_id, currency, subtotal_minor, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)
      `).run(
        sellerOrderCanonicalId, marketplaceOrderId, sellerId, orderId, String(tenant.organization_id),
        sellerCurrency, subtotal, nowIso(), nowIso()
      );

      db.prepare(`
        INSERT INTO marketplace_fulfillments
          (id, seller_order_id, status, fulfillment_type, created_at, updated_at)
        VALUES (?, ?, 'pending', 'delivery', ?, ?)
      `).run(crypto.randomUUID(), sellerOrderCanonicalId, nowIso(), nowIso());

      for (const item of sellerItems) {
        db.prepare(`
          INSERT INTO marketplace_inventory_reservations
            (id, marketplace_order_id, seller_order_id, seller_id, product_id, quantity, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'consumed', ?, ?)
        `).run(
          crypto.randomUUID(), marketplaceOrderId, sellerOrderCanonicalId, sellerId,
          String(item.item_id), Math.floor(Number(item.qty)), nowIso(), nowIso()
        );
      }

      db.prepare(`
        INSERT INTO marketplace_payment_allocations
          (id, marketplace_order_id, seller_order_id, payment_id, organization_id, amount_minor, currency, status, created_at, updated_at)
        VALUES (?, ?, ?, NULL, ?, ?, ?, 'UNPAID', ?, ?)
      `).run(
        crypto.randomUUID(), marketplaceOrderId, sellerOrderCanonicalId, String(tenant.organization_id),
        subtotal, sellerCurrency, nowIso(), nowIso()
      );

      db.prepare(`
        INSERT INTO marketplace_settlements
          (id, marketplace_order_id, seller_order_id, organization_id, amount_minor, currency, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)
      `).run(
        crypto.randomUUID(), marketplaceOrderId, sellerOrderCanonicalId, String(tenant.organization_id),
        subtotal, sellerCurrency, nowIso()
      );

      audit(sellerId, 'marketplace.order_created', 'order', orderId, {
        marketplaceOrderId,
        canonicalSellerOrderId: sellerOrderCanonicalId,
        totalMinor: subtotal,
        itemCount: sellerItems.length,
      });
      subOrders.push({
        seller_id: sellerId,
        vendor_code: order.vendor_code,
        sub_total: subtotal,
        currency: sellerCurrency,
        item_count: sellerItems.length,
        seller_order_id: sellerOrderCanonicalId,
      });
    }

    const finalCurrency = marketplaceCurrency || 'ETB';
    db.prepare('UPDATE marketplace_orders SET currency = ?, total_minor = ?, updated_at = ? WHERE id = ?')
      .run(finalCurrency, grandTotal, nowIso(), marketplaceOrderId);

    const response = { marketplace_order_id: marketplaceOrderId, tracking_token: trackingToken, sub_orders: subOrders };
    if (idempotencyKey) {
      db.prepare(`
        INSERT INTO marketplace_checkout_idempotency
          (id, idempotency_key, buyer_identity, request_hash, response_json, marketplace_order_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), idempotencyKey, buyerIdentity, requestHash, json(response), marketplaceOrderId, nowIso());
    }
    db.exec('COMMIT');
    return response;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

const MARKETPLACE_STATUS_TRANSITIONS = {
  queued: new Set(['confirmed', 'cancelled']),
  confirmed: new Set(['preparing', 'cancelled']),
  preparing: new Set(['ready', 'cancelled']),
  ready: new Set(['completed']),
  completed: new Set([]),
  cancelled: new Set([]),
};

export async function updateMarketplaceOrderStatus(chatId, localId, nextStatus) {
  ensureDatabase();
  const key = String(chatId);
  const id = String(localId);
  const target = String(nextStatus || '').trim().toLowerCase();
  if (!Object.hasOwn(MARKETPLACE_STATUS_TRANSITIONS, target)) {
    throw Object.assign(new Error('Invalid marketplace order status'), { statusCode: 400 });
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db.prepare('SELECT * FROM orders WHERE chat_id = ? AND local_id = ? AND is_marketplace = 1').get(key, id);
    if (!row) throw Object.assign(new Error('Marketplace order not found'), { statusCode: 404 });
    const order = orderFromRow(row);
    const current = String(order.status || row.status || 'queued');
    if (current === target) {
      db.exec('COMMIT');
      return order;
    }
    if (!MARKETPLACE_STATUS_TRANSITIONS[current]?.has(target)) {
      throw Object.assign(new Error(`Cannot move order from ${current} to ${target}`), { statusCode: 409 });
    }

    // Stock is reserved at checkout. A cancellation releases that reservation
    // exactly once (the transition machine makes repeated cancellation
    // impossible). We restore against the current product row instead of
    // trusting the buyer payload; if the seller deleted the product after the
    // order, we deliberately do not resurrect it.
    const canonicalSeller = db.prepare(
      'SELECT * FROM marketplace_seller_orders WHERE seller_order_id = ?'
    ).get(id);

    if (target === 'cancelled') {
      for (const item of Array.isArray(order.items) ? order.items : []) {
        const itemId = String(item?.item_id || '').trim();
        const qty = Math.floor(Number(item?.qty));
        if (!itemId || !Number.isFinite(qty) || qty <= 0) continue;
        const productRow = db.prepare('SELECT * FROM catalog_products WHERE chat_id = ? AND product_id = ?').get(key, itemId);
        if (!productRow) continue;
        const tenant = db.prepare('SELECT organization_id FROM tenants WHERE chat_id = ?').get(key);
        const defaultLocation = tenant?.organization_id
          ? db.prepare("SELECT id FROM locations WHERE organization_id = ? AND code = 'DEFAULT' LIMIT 1").get(String(tenant.organization_id))
          : null;
        if (!tenant?.organization_id || !defaultLocation) continue;
        const canonicalBalance = Number(db.prepare(`
          SELECT COALESCE(SUM(quantity), 0) AS quantity
          FROM inventory_movements
          WHERE organization_id = ? AND location_id = ? AND product_id = ?
        `).get(String(tenant.organization_id), String(defaultLocation.id), String(itemId))?.quantity || 0);
        const restoredStock = Math.min(1000000000, canonicalBalance + qty);
        const movementEventId = `marketplace-cancel:${order.marketplace_order_id}:${key}:${itemId}`;
        await appendInventoryMovement(key, {
          productId: itemId,
          locationId: String(defaultLocation.id),
          quantity: qty,
          movementType: 'RETURN',
          referenceType: 'marketplace_order',
          referenceId: order.marketplace_order_id,
          eventId: movementEventId,
          occurredAt: nowIso(),
          reason: 'Marketplace cancellation stock release',
          metadata: { marketplaceOrderId: order.marketplace_order_id, sellerId: key, quantity: qty },
        });
        const product = productFromRow(productRow);
        product.stock = restoredStock;
        product.stock_revision = (Number.isInteger(productRow.stock_revision) ? productRow.stock_revision : 0) + 1;
        insertProduct(key, product);
      }

      if (canonicalSeller) {
        db.prepare(`
          UPDATE marketplace_inventory_reservations
          SET status = 'released', updated_at = ?
          WHERE seller_order_id = ? AND status = 'consumed'
        `).run(nowIso(), canonicalSeller.id);

        const allocations = db.prepare(`
          SELECT a.*, p.state AS payment_state
          FROM marketplace_payment_allocations a
          LEFT JOIN payments p ON p.id = a.payment_id
          WHERE a.seller_order_id = ? AND a.status IN ('ALLOCATED','PARTIAL')
        `).all(canonicalSeller.id);
        for (const allocation of allocations) {
          const paidAndVerified = ['VERIFIED', 'RECONCILED'].includes(String(allocation.payment_state || '').toUpperCase());
          if (!paidAndVerified || Number(allocation.amount_minor) <= 0 || !allocation.payment_id) continue;
          db.prepare(`
            INSERT INTO marketplace_refunds
              (id, marketplace_order_id, seller_order_id, payment_id, organization_id, amount_minor, currency, reason, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
          `).run(
            crypto.randomUUID(), allocation.marketplace_order_id, allocation.seller_order_id,
            allocation.payment_id, allocation.organization_id, allocation.amount_minor,
            allocation.currency, 'Marketplace order cancellation', nowIso()
          );
          db.prepare(`
            UPDATE marketplace_payment_allocations
            SET status = 'REFUNDED', updated_at = ?
            WHERE id = ?
          `).run(nowIso(), allocation.id);
        }

        db.prepare(`
          UPDATE marketplace_settlements
          SET status = 'REVERSED'
          WHERE seller_order_id = ? AND status IN ('PENDING','READY','HELD')
        `).run(canonicalSeller.id);

        db.prepare(`
          UPDATE marketplace_fulfillments
          SET status = 'cancelled', updated_at = ?
          WHERE seller_order_id = ? AND status <> 'delivered' AND status <> 'picked_up'
        `).run(nowIso(), canonicalSeller.id);
      }
    }

    if (canonicalSeller) {
      db.prepare(`
        UPDATE marketplace_seller_orders
        SET status = ?, updated_at = ?
        WHERE id = ?
      `).run(target, nowIso(), canonicalSeller.id);

      const statusSummary = db.prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) AS ready,
          SUM(CASE WHEN status = 'preparing' THEN 1 ELSE 0 END) AS preparing,
          SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed
        FROM marketplace_seller_orders
        WHERE marketplace_order_id = ?
      `).get(canonicalSeller.marketplace_order_id);
      let masterStatus = 'queued';
      if (Number(statusSummary?.cancelled || 0) === Number(statusSummary?.total || 0)) masterStatus = 'cancelled';
      else if (Number(statusSummary?.completed || 0) === Number(statusSummary?.total || 0)) masterStatus = 'completed';
      else if (Number(statusSummary?.ready || 0) > 0) masterStatus = 'ready';
      else if (Number(statusSummary?.preparing || 0) > 0) masterStatus = 'preparing';
      else if (Number(statusSummary?.confirmed || 0) === Number(statusSummary?.total || 0)) masterStatus = 'confirmed';
      db.prepare('UPDATE marketplace_orders SET status = ?, updated_at = ? WHERE id = ?')
        .run(masterStatus, nowIso(), canonicalSeller.marketplace_order_id);
    }

    const updated = { ...order, status: target, status_updated_at: Date.now() };
    db.prepare('UPDATE orders SET order_json = ?, status = ? WHERE chat_id = ? AND local_id = ?').run(json(updated), target, key, id);
    audit(key, `marketplace.order_${target}`, 'order', id, {
      marketplaceOrderId: order.marketplace_order_id,
      from: current,
      to: target,
      stockReleased: target === 'cancelled',
    });
    db.exec('COMMIT');
    return updated;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export async function getMarketplaceOrderTracking(marketplaceOrderId, trackingToken) {
  ensureDatabase();
  const id = String(marketplaceOrderId || '').trim();
  const token = String(trackingToken || '').trim();
  if (!id || !token) throw Object.assign(new Error('Order ID and tracking token are required'), { statusCode: 400 });
  const rows = db.prepare('SELECT * FROM orders WHERE marketplace_order_id = ? AND is_marketplace = 1 ORDER BY created_at ASC').all(id);
  if (!rows.length) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  const expectedHash = hashToken(token);
  const authorised = rows.some(row => {
    const stored = String(orderFromRow(row).buyer_tracking_token_hash || '');
    const a = Buffer.from(stored); const b = Buffer.from(expectedHash);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
  if (!authorised) throw Object.assign(new Error('Invalid tracking token'), { statusCode: 404 });
  return {
    marketplace_order_id: id,
    created_at: Math.min(...rows.map(r => Number(r.created_at) || Date.now())),
    status: rows.some(r => String(r.status) === 'cancelled') ? 'cancelled' : rows.every(r => String(r.status) === 'completed') ? 'completed' : rows.some(r => ['preparing','ready'].includes(String(r.status))) ? 'in_progress' : rows.every(r => String(r.status) === 'confirmed' || String(r.status) === 'completed') ? 'confirmed' : 'queued',
    sellers: rows.map(row => {
      const order = orderFromRow(row);
      return { seller_name: getTenant(row.chat_id)?.sellerName || 'Seller', status: order.status || row.status || 'queued', item_count: Array.isArray(order.items) ? order.items.reduce((n, item) => n + Number(item.qty || 0), 0) : 0, total: order.total || 0, currency: normaliseCurrency(row.currency || order.currency || parseJSON(db.prepare('SELECT branding_json FROM tenants WHERE chat_id = ?').get(row.chat_id)?.branding_json, {})?.currency, 'ETB') };
    }),
  };
}

export async function getTelegramBuyerFulfillmentExperience(chatId, telegramUserId, marketplaceOrderId) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) throw Object.assign(new Error('Unknown store'), { statusCode: 404, code: 'STORE_NOT_FOUND' });
  const buyer = String(telegramUserId || '').trim();
  const orderId = String(marketplaceOrderId || '').trim();
  if (!buyer) throw Object.assign(new Error('Telegram buyer identity is required'), { statusCode: 400, code: 'TELEGRAM_BUYER_REQUIRED' });
  if (!orderId) throw Object.assign(new Error('Marketplace order ID is required'), { statusCode: 400, code: 'MARKETPLACE_ORDER_REQUIRED' });
  const rows = db.prepare(`
    SELECT mo.id AS marketplace_order_id, mo.status AS marketplace_status, mo.created_at,
           mso.seller_order_id, mso.status AS seller_status,
           mf.id AS fulfillment_id, mf.status AS fulfillment_status,
           mf.fulfillment_type, mf.tracking_reference, mf.proof_json,
           mf.created_at AS fulfillment_created_at, mf.updated_at AS fulfillment_updated_at
    FROM marketplace_orders mo
    JOIN marketplace_seller_orders mso ON mso.marketplace_order_id = mo.id
    LEFT JOIN marketplace_fulfillments mf ON mf.seller_order_id = mso.id
    WHERE mo.id = ? AND mo.buyer_identity = ? AND mso.seller_id = ?
    ORDER BY mf.updated_at DESC, mf.created_at DESC
  `).all(orderId, buyer, String(chatId));
  if (!rows.length) throw Object.assign(new Error('Order not found'), { statusCode: 404, code: 'ORDER_NOT_FOUND' });
  const first = rows[0];
  const fulfillments = rows.filter(r => r.fulfillment_id).map(r => ({
    id: r.fulfillment_id,
    sellerOrderId: r.seller_order_id,
    status: r.fulfillment_status,
    fulfillmentType: r.fulfillment_type,
    trackingReference: r.tracking_reference || null,
    proof: parseJSON(r.proof_json, null),
    createdAt: r.fulfillment_created_at,
    updatedAt: r.fulfillment_updated_at,
  }));
  return {
    marketplaceOrderId: first.marketplace_order_id,
    marketplaceStatus: first.marketplace_status,
    createdAt: first.created_at,
    sellerOrders: [...new Map(rows.map(r => [r.seller_order_id, { sellerOrderId: r.seller_order_id, status: r.seller_status }])).values()],
    fulfillments,
    returns: { supported: false, status: null, requestAction: 'existing_logistics_return_authority_required' },
    authority: { order: 'commerce', fulfillment: 'existing_marketplace_fulfillment', logistics: 'logistics-pack', returns: 'logistics-pack' },
  };
}

export async function listTelegramBuyerOrders(chatId, telegramUserId, limit = 20) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) throw Object.assign(new Error('Unknown store'), { statusCode: 404, code: 'STORE_NOT_FOUND' });
  const buyer = String(telegramUserId || '').trim();
  if (!buyer) throw Object.assign(new Error('Telegram buyer identity is required'), { statusCode: 400, code: 'TELEGRAM_BUYER_REQUIRED' });
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  const rows = db.prepare(`
    SELECT mo.id AS marketplace_order_id, mo.currency AS marketplace_currency,
           mo.total_minor, mo.status AS marketplace_status, mo.created_at, mo.updated_at,
           mso.seller_id, mso.organization_id, mso.seller_order_id, mso.currency AS seller_currency,
           mso.subtotal_minor, mso.status AS seller_status
    FROM marketplace_orders mo
    JOIN marketplace_seller_orders mso ON mso.marketplace_order_id = mo.id
    WHERE mo.buyer_identity = ? AND mso.seller_id = ?
    ORDER BY mo.created_at DESC, mso.created_at ASC
  `).all(buyer, String(chatId));
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.marketplace_order_id)) grouped.set(row.marketplace_order_id, {
      marketplace_order_id: row.marketplace_order_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      status: row.marketplace_status,
      total_minor: Number(row.total_minor || 0),
      currency: row.marketplace_currency,
      sellers: [],
    });
    const order = grouped.get(row.marketplace_order_id);
    order.sellers.push({ seller_order_id: row.seller_order_id, status: row.seller_status, subtotal_minor: Number(row.subtotal_minor || 0), currency: row.seller_currency });
  }
  return [...grouped.values()].slice(0, safeLimit);
}

export async function listAuditEvents(chatId, limit = 100, filters = {}) {
  ensureDatabase();
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100));
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) return [];
  const where = ['a.organization_id = ?'];
  const params = [String(tenant.organizationId)];
  if (filters.action) { where.push('a.action = ?'); params.push(String(filters.action)); }
  if (filters.actorId) { where.push('a.actor_id = ?'); params.push(String(filters.actorId)); }
  if (filters.entityType) { where.push('a.entity_type = ?'); params.push(String(filters.entityType)); }
  params.push(safeLimit);
  return db.prepare(`
    SELECT a.id, a.chat_id, a.organization_id, a.location_id, a.actor_id, a.device_id,
           a.action, a.entity_type, a.entity_id, a.reason, a.result, a.metadata_json, a.created_at
    FROM audit_events a
    WHERE ${where.join(' AND ')}
    ORDER BY a.id DESC
    LIMIT ?
  `).all(...params).map(row => ({
    id: row.id,
    chatId: row.chat_id,
    organizationId: row.organization_id,
    locationId: row.location_id,
    actorId: row.actor_id,
    deviceId: row.device_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    reason: row.reason || '',
    result: row.result || 'success',
    metadata: parseJSON(row.metadata_json, {}),
    createdAt: row.created_at,
  }));
}

export async function createDatabaseBackup() {
  ensureDatabase();
  await mkdir(BACKUP_DIR, { recursive: true });
  const fileName = `sellify-${new Date().toISOString().replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z')}.sqlite`;
  const destination = path.join(BACKUP_DIR, fileName);
  // VACUUM INTO produces a compact, consistent snapshot even while the
  // service is live. The destination is generated under our own backup dir.
  db.exec(`VACUUM INTO '${sqlString(destination)}'`);

  const files = (await readdir(BACKUP_DIR))
    .filter(file => file.startsWith('sellify-') && file.endsWith('.sqlite'))
    .sort()
    .reverse();
  for (const oldFile of files.slice(BACKUP_RETENTION)) {
    await unlink(path.join(BACKUP_DIR, oldFile));
  }
  return { path: destination, fileName, retained: Math.min(files.length, BACKUP_RETENTION) };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export async function getOrCreateUserByTelegram(telegramUserId, displayName = '') {
  ensureDatabase();
  const id = String(telegramUserId);
  const existing = db.prepare('SELECT * FROM users WHERE telegram_user_id = ?').get(id);
  const now = nowIso();
  if (existing) {
    db.prepare('UPDATE users SET display_name = ?, last_seen_at = ? WHERE id = ?').run(displayName || existing.display_name || '', now, existing.id);
    return { ...existing, display_name: displayName || existing.display_name || '', last_seen_at: now };
  }
  const userId = crypto.randomUUID();
  db.prepare(`INSERT INTO users (id, telegram_user_id, display_name, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)`).run(userId, id, displayName || '', now, now);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

export async function listTenantMemberships(chatId) {
  ensureDatabase();
  const memberships = db.prepare(`
    SELECT m.id, m.user_id, m.chat_id, m.role, m.status, u.display_name
    FROM memberships m JOIN users u ON u.id = m.user_id
    WHERE m.chat_id = ? AND m.status = 'active'
    ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, u.display_name
  `).all(String(chatId));
  return memberships.map(row => ({
    id: row.id, userId: row.user_id, chatId: row.chat_id, role: row.role, status: row.status,
    displayName: row.display_name,
    contextualRoles: db.prepare(`
      SELECT role_id AS role, scope_type AS scopeType, scope_id AS scopeId
        FROM membership_roles
       WHERE membership_id = ? AND status = 'active'
       ORDER BY created_at
    `).all(String(row.id)),
  }));
}

export async function listUserMemberships(userId) {
  ensureDatabase();
  return db.prepare(`
    SELECT m.id, m.chat_id, m.role, m.status, t.tenant_id, t.seller_name, t.branding_json, t.vendor_code
    FROM memberships m JOIN tenants t ON t.chat_id = m.chat_id
    WHERE m.user_id = ? AND m.status = 'active'
    ORDER BY t.created_at
  `).all(String(userId)).map(row => ({
    id: row.id, chatId: row.chat_id, tenantId: row.tenant_id, role: row.role, status: row.status,
    sellerName: row.seller_name, branding: parseJSON(row.branding_json, {}), vendorCode: row.vendor_code
  }));
}


const CONTEXTUAL_ROLE_IDS = new Set([
  'restaurant_waiter',
  'restaurant_kitchen_staff',
  'warehouse_receiving',
  'warehouse_picker_packer',
  'warehouse_inventory_staff',
  'retail_cashier',
  'retail_stock_staff',
  'agriculture_farm_manager',
  'agriculture_field_staff',
  'procurement_buyer_requester',
  'procurement_approver',
  'supplier_network_admin',
  'supplier_network_staff',
  'marketplace_seller_admin',
  'marketplace_seller_staff',
  'logistics_manager',
  'logistics_dispatcher',
  'logistics_courier',
  'logistics_viewer',
]);

function assertContextualRoleAssignable(chatId, role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  if (!CONTEXTUAL_ROLE_IDS.has(normalizedRole)) {
    throw Object.assign(new Error('Unsupported contextual role'), { statusCode: 400 });
  }
  const tenant = db.prepare('SELECT organization_id FROM tenants WHERE chat_id = ?').get(String(chatId));
  if (!tenant?.organization_id) throw Object.assign(new Error('Tenant organization not found'), { statusCode: 404 });
  const requiredPack = normalizedRole.startsWith('warehouse_') ? 'warehouse'
    : normalizedRole.startsWith('restaurant_') ? 'restaurant'
    : normalizedRole.startsWith('logistics_') ? 'logistics'
    : null;
  // Retail/POS contextual roles are backed by existing Platform/Core retail authorities.
  // Retail/POS and Agriculture contextual roles are backed by existing
  // Platform/Core or declarative Agriculture authorities; assignment does not
  // invent a new lifecycle authority.
  if (normalizedRole.startsWith('retail_') || normalizedRole.startsWith('agriculture_') || normalizedRole.startsWith('procurement_') || normalizedRole.startsWith('supplier_network_') || normalizedRole.startsWith('marketplace_')) return;
  const lifecycle = db.prepare(`
    SELECT state FROM pack_lifecycle
     WHERE organization_id = ? AND pack_id = ?
     ORDER BY updated_at DESC LIMIT 1
  `).get(String(tenant.organization_id), requiredPack);
  if (lifecycle?.state !== 'ACTIVE') {
    throw Object.assign(
      new Error(`${requiredPack[0].toUpperCase()}${requiredPack.slice(1)} Pack must be ACTIVE before assigning ${requiredPack} contextual roles`),
      { statusCode: 409 },
    );
  }
}

export async function assignMembershipContextualRole({
  actorUserId, chatId, membershipId, role, scopeType = 'ORGANIZATION', scopeId = null,
}) {
  ensureDatabase();
  const normalizedRole = String(role || '').trim().toLowerCase();
  const normalizedScopeType = String(scopeType || 'ORGANIZATION').trim().toUpperCase();
  const normalizedScopeId = scopeId == null || String(scopeId).trim() === '' ? null : String(scopeId).trim();
  if (!membershipId || !normalizedRole) throw Object.assign(new Error('membershipId and role are required'), { statusCode: 400 });
  assertContextualRoleAssignable(chatId, normalizedRole);
  if (!['ORGANIZATION', 'LOCATION', 'RESOURCE'].includes(normalizedScopeType)) {
    throw Object.assign(new Error('Unsupported role scope type'), { statusCode: 400 });
  }
  if (normalizedScopeType !== 'ORGANIZATION' && !normalizedScopeId) {
    throw Object.assign(new Error('scopeId is required for non-organization role scope'), { statusCode: 400 });
  }
  if (normalizedScopeType === 'LOCATION') {
    const tenant = db.prepare('SELECT organization_id FROM tenants WHERE chat_id = ?').get(String(chatId));
    const location = db.prepare('SELECT id FROM locations WHERE id = ? AND organization_id = ?').get(normalizedScopeId, String(tenant?.organization_id || ''));
    if (!location) throw Object.assign(new Error('Role scope location is outside the organization'), { statusCode: 403 });
  }

  const actor = db.prepare(`SELECT * FROM memberships WHERE user_id = ? AND chat_id = ? AND status = 'active'`)
    .get(String(actorUserId), String(chatId));
  if (!actor || !['owner', 'manager'].includes(actor.role)) {
    throw Object.assign(new Error('Owner or manager permission required'), { statusCode: 403 });
  }
  const target = db.prepare(`SELECT * FROM memberships WHERE id = ? AND chat_id = ? AND status = 'active'`)
    .get(String(membershipId), String(chatId));
  if (!target) throw Object.assign(new Error('Membership not found'), { statusCode: 404 });

  const id = crypto.randomUUID();
  const createdAt = nowIso();
  db.prepare(`
    INSERT OR IGNORE INTO membership_roles
      (id, membership_id, role_id, status, scope_type, scope_id, source, created_at)
    VALUES (?, ?, ?, 'active', ?, ?, 'PACK_ROLE_ASSIGNMENT', ?)
  `).run(id, target.id, normalizedRole, normalizedScopeType, normalizedScopeId, createdAt);

  audit(String(chatId), 'membership.contextual_role.assigned', 'membership_role', id, {
    membershipId: target.id, userId: target.user_id, role: normalizedRole,
    scopeType: normalizedScopeType, scopeId: normalizedScopeId,
    changedByUserId: String(actorUserId),
  });
  return {
    id, membershipId: target.id, userId: target.user_id, chatId: String(chatId),
    role: normalizedRole, status: 'active', scopeType: normalizedScopeType, scopeId: normalizedScopeId,
  };
}

export async function changeMembershipRole({ actorUserId, chatId, membershipId, role }) {
  ensureDatabase();
  const nextRole = String(role || '').trim().toLowerCase();
  const allowedRoles = new Set(['owner', 'manager', 'cashier', 'staff', 'buyer', 'viewer']);
  if (!allowedRoles.has(nextRole)) throw Object.assign(new Error('Invalid membership role'), { statusCode: 400 });
  const actor = db.prepare(`SELECT * FROM memberships WHERE user_id = ? AND chat_id = ? AND status = 'active'`).get(String(actorUserId), String(chatId));
  if (!actor) throw Object.assign(new Error('You are not a member of this tenant'), { statusCode: 403 });
  if (!['owner', 'manager'].includes(actor.role)) throw Object.assign(new Error('Owner or manager permission required'), { statusCode: 403 });
  const target = db.prepare(`SELECT * FROM memberships WHERE id = ? AND chat_id = ? AND status = 'active'`).get(String(membershipId), String(chatId));
  if (!target) throw Object.assign(new Error('Membership not found'), { statusCode: 404 });
  if (String(target.user_id) === String(actorUserId)) throw Object.assign(new Error('You cannot change your own role'), { statusCode: 409 });
  if (target.role === 'owner' && actor.role !== 'owner') throw Object.assign(new Error('Only the owner can change an owner membership'), { statusCode: 403 });
  if (nextRole === 'owner' && actor.role !== 'owner') throw Object.assign(new Error('Only the owner can assign the owner role'), { statusCode: 403 });
  if (actor.role === 'manager' && !['cashier', 'staff', 'viewer'].includes(nextRole)) {
    throw Object.assign(new Error('Managers may assign cashier, staff, or viewer roles'), { statusCode: 403 });
  }
  if (target.role === 'owner' && nextRole !== 'owner') {
    const owners = db.prepare(`SELECT COUNT(*) AS count FROM memberships WHERE chat_id = ? AND status = 'active' AND role = 'owner'`).get(String(chatId));
    if (Number(owners?.count || 0) <= 1) throw Object.assign(new Error('The last owner cannot be demoted'), { statusCode: 409 });
  }
  if (target.role === nextRole) return { id: target.id, userId: target.user_id, chatId: target.chat_id, from: target.role, to: nextRole, changed: false };
  db.prepare('UPDATE memberships SET role = ? WHERE id = ?').run(nextRole, target.id);
  db.prepare(`
    UPDATE membership_roles
       SET status = 'revoked', revoked_at = ?
     WHERE membership_id = ? AND scope_type = 'ORGANIZATION' AND scope_id IS NULL AND status = 'active'
  `).run(nowIso(), target.id);
  db.prepare(`
    INSERT OR IGNORE INTO membership_roles
      (id, membership_id, role_id, status, scope_type, source, created_at)
    VALUES (?, ?, ?, 'active', 'ORGANIZATION', 'LEGACY_ROLE_CHANGE', ?)
  `).run(`legacy-role:${target.id}`, target.id, nextRole, nowIso());
  audit(String(chatId), 'membership.role_changed', 'membership', target.id, {
    userId: target.user_id, changedByUserId: String(actorUserId), from: target.role, to: nextRole,
  });
  return { id: target.id, userId: target.user_id, chatId: target.chat_id, from: target.role, to: nextRole, changed: true };
}

export async function ensureMembership(userId, chatId, role = 'owner') {
  ensureDatabase();
  const existing = db.prepare('SELECT * FROM memberships WHERE user_id = ? AND chat_id = ?').get(String(userId), String(chatId));
  if (existing) return existing;
  const id = crypto.randomUUID();
  const createdAt = nowIso();
  db.prepare(`INSERT INTO memberships (id, user_id, chat_id, role, status, created_at) VALUES (?, ?, ?, ?, 'active', ?)`).run(id, String(userId), String(chatId), role, createdAt);
  db.prepare(`
    INSERT OR IGNORE INTO membership_roles
      (id, membership_id, role_id, status, scope_type, source, created_at)
    VALUES (?, ?, ?, 'active', 'ORGANIZATION', 'LEGACY_BRIDGE', ?)
  `).run(`legacy-role:${id}`, id, String(role).trim().toLowerCase(), createdAt);
  audit(String(chatId), 'membership.created', 'membership', id, { userId: String(userId), role });
  return db.prepare('SELECT * FROM memberships WHERE id = ?').get(id);
}

export async function createTenantForUser({ userId, sellerName, businessType, country, currency, timezone }) {
  ensureDatabase();
  const chatId = `tenant_${crypto.randomUUID()}`;
  const tenantId = crypto.randomUUID();
  const now = nowIso();
  const apiKey = crypto.randomBytes(32).toString('hex');
  const tenant = { sellerName: String(sellerName || '').trim(), businessType: String(businessType || 'retail'), country: String(country || ''), currency: normaliseCurrency(currency, 'ETB'), timezone: String(timezone || 'UTC') };
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO tenants (chat_id, tenant_id, api_key, created_at, seller_name, branding_json, vendor_code) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(chatId, tenantId, apiKey, now, tenant.sellerName, json({ currency: tenant.currency, country: tenant.country, timezone: tenant.timezone }), null);
    ensureCanonicalIdentityForTenant(chatId);
    const membership = await ensureMembership(userId, chatId, 'owner');
    audit(chatId, 'tenant.created_authenticated', 'tenant', chatId, { userId: String(userId), businessType: tenant.businessType });
    db.exec('COMMIT');
    return { chatId, tenantId, membership, tenant: { ...tenant, createdAt: now } };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function createDeviceRow(userId, chatId, name) {
  const id = crypto.randomUUID();
  const now = nowIso();
  db.prepare(`INSERT INTO devices (id, user_id, chat_id, name, status, created_at, last_seen_at) VALUES (?, ?, ?, ?, 'active', ?, ?)`).run(id, String(userId), String(chatId), String(name || 'Unnamed device'), now, now);
  return db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
}

export async function createSession({ userId, chatId, deviceName = 'Sellify device', ttlMs = 1000 * 60 * 60 * 24 * 7 }) {
  ensureDatabase();
  const membership = db.prepare(`SELECT * FROM memberships WHERE user_id = ? AND chat_id = ? AND status = 'active'`).get(String(userId), String(chatId));
  if (!membership) throw Object.assign(new Error('User is not a member of this tenant'), { statusCode: 403 });
  const device = createDeviceRow(userId, chatId, deviceName);
  const token = crypto.randomBytes(32).toString('base64url');
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + ttlMs);
  const sessionId = crypto.randomUUID();
  db.prepare(`INSERT INTO sessions (id, device_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`).run(sessionId, device.id, hashToken(token), createdAt.toISOString(), expiresAt.toISOString());
  const context = db.prepare(`
    SELECT t.organization_id,
           (SELECT l.id FROM locations l WHERE l.organization_id = t.organization_id AND l.code = 'DEFAULT' LIMIT 1) AS default_location_id
    FROM tenants t WHERE t.chat_id = ?
  `).get(String(chatId));
  const contextualRoles = db.prepare(`
    SELECT role_id, scope_type, scope_id
      FROM membership_roles
     WHERE membership_id = ? AND status = 'active'
     ORDER BY created_at
  `).all(String(membership.id)).map(row => ({
    role: row.role_id, scopeType: row.scope_type, scopeId: row.scope_id || null,
  }));
  return {
    token, expiresAt: expiresAt.toISOString(), sessionId, deviceId: device.id, role: membership.role,
    roles: Array.from(new Set([membership.role, ...contextualRoles.map(item => item.role)])),
    contextualRoles,
    chatId: String(chatId), organizationId: context?.organization_id || null, locationId: context?.default_location_id || null,
  };
}

export async function authenticateSessionToken(token) {
  ensureDatabase();
  if (!token) return null;
  const row = db.prepare(`
    SELECT s.*, d.user_id, d.chat_id, d.status AS device_status, m.role, m.status AS membership_status,
           t.organization_id,
           (SELECT l.id FROM locations l WHERE l.organization_id = t.organization_id AND l.code = 'DEFAULT' LIMIT 1) AS default_location_id,
           (SELECT group_concat(DISTINCT mr.role_id)
              FROM membership_roles mr
             WHERE mr.membership_id = m.id AND mr.status = 'active'
               AND (
                 (
                   mr.role_id NOT IN (
                     'restaurant_waiter', 'restaurant_kitchen_staff',
                     'warehouse_receiving', 'warehouse_picker_packer', 'warehouse_inventory_staff',
                     'logistics_manager', 'logistics_dispatcher', 'logistics_courier', 'logistics_viewer'
                   )
                 )
                 OR (
                   mr.role_id IN ('restaurant_waiter', 'restaurant_kitchen_staff')
                   AND EXISTS (
                     SELECT 1 FROM pack_lifecycle pl
                      WHERE pl.organization_id = t.organization_id
                        AND pl.pack_id = 'restaurant'
                        AND pl.state = 'ACTIVE'
                   )
                 )
                 OR (
                   mr.role_id IN ('warehouse_receiving', 'warehouse_picker_packer', 'warehouse_inventory_staff')
                   AND EXISTS (
                     SELECT 1 FROM pack_lifecycle pl
                      WHERE pl.organization_id = t.organization_id
                        AND pl.pack_id = 'warehouse'
                        AND pl.state = 'ACTIVE'
                   )
                 )
                 OR (
                   mr.role_id IN ('logistics_manager', 'logistics_dispatcher', 'logistics_courier', 'logistics_viewer')
                   AND EXISTS (
                     SELECT 1 FROM pack_lifecycle pl
                      WHERE pl.organization_id = t.organization_id
                        AND pl.pack_id = 'logistics'
                        AND pl.state = 'ACTIVE'
                   )
                 )
               )) AS membership_roles
    FROM sessions s JOIN devices d ON d.id = s.device_id
    JOIN memberships m ON m.user_id = d.user_id AND m.chat_id = d.chat_id
    JOIN tenants t ON t.chat_id = d.chat_id
    WHERE s.token_hash = ?
  `).get(hashToken(token));
  if (!row || row.revoked_at || row.device_status !== 'active' || row.membership_status !== 'active') return null;
  if (Date.parse(row.expires_at) <= Date.now()) return null;
  db.prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?').run(nowIso(), row.device_id);
  return {
    sessionId: row.id,
    userId: row.user_id,
    chatId: row.chat_id,
    deviceId: row.device_id,
    role: row.role,
    roles: Array.from(new Set(String(row.membership_roles || row.role || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean))),
    organizationId: row.organization_id || null,
    locationId: row.default_location_id || null,
    expiresAt: row.expires_at,
  };
}

export async function recordAuditEvent({
  chatId = null,
  organizationId = null,
  locationId = null,
  actorId = null,
  deviceId = null,
  action,
  entityType,
  entityId = null,
  reason = '',
  result = 'success',
  metadata = {},
}) {
  ensureDatabase();
  audit(chatId, action, entityType, entityId, metadata, {
    organizationId, locationId, actorId, deviceId, reason, result,
  });
}

export async function getAuditRetentionPolicy(chatId) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) return null;
  const row = db.prepare('SELECT * FROM audit_retention_policies WHERE organization_id = ?').get(String(tenant.organizationId));
  return {
    organizationId: tenant.organizationId,
    retentionDays: Number(row?.retention_days || 365),
    updatedAt: row?.updated_at || null,
    updatedBy: row?.updated_by || null,
  };
}

export async function setAuditRetentionPolicy(chatId, retentionDays, actor = null) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) throw Object.assign(new Error('Unknown organization'), { statusCode: 404 });
  const days = Math.floor(Number(retentionDays));
  if (!Number.isInteger(days) || days < 30 || days > 3650) {
    throw Object.assign(new Error('retentionDays must be an integer between 30 and 3650'), { statusCode: 400 });
  }
  const now = nowIso();
  db.prepare(`
    INSERT INTO audit_retention_policies (organization_id, retention_days, updated_at, updated_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(organization_id) DO UPDATE SET
      retention_days = excluded.retention_days,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `).run(String(tenant.organizationId), days, now, actor?.userId || null);
  audit(String(chatId), 'audit.retention_policy.updated', 'audit_retention_policy', tenant.organizationId, {
    retentionDays: days,
  }, {
    organizationId: tenant.organizationId,
    actorId: actor?.userId || null,
    deviceId: actor?.deviceId || null,
  });
  return getAuditRetentionPolicy(chatId);
}

export async function createComplianceRequest(chatId, input = {}, actor = null) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) throw Object.assign(new Error('Unknown organization'), { statusCode: 404 });
  const requestType = String(input.requestType || input.request_type || '').trim().toUpperCase();
  const subjectType = String(input.subjectType || input.subject_type || '').trim().toLowerCase();
  const allowedTypes = new Set(['ACCESS', 'EXPORT', 'DELETION']);
  const allowedSubjectTypes = new Set(['organization', 'customer']);
  if (!allowedTypes.has(requestType) || !subjectType || !allowedSubjectTypes.has(subjectType)) {
    throw Object.assign(new Error('requestType must be ACCESS, EXPORT, or DELETION and subjectType must be organization or customer'), { statusCode: 400 });
  }
  if (subjectType === 'organization' && input.subjectId && String(input.subjectId) !== String(tenant.organizationId)) {
    throw Object.assign(new Error('Organization compliance requests must target the current organization'), { statusCode: 400 });
  }
  if (subjectType === 'customer') {
    if (!input.subjectId) throw Object.assign(new Error('Customer compliance requests require subjectId'), { statusCode: 400 });
    const customer = db.prepare('SELECT id FROM customers WHERE id = ? AND organization_id = ?').get(String(input.subjectId), tenant.organizationId);
    if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
  }
  if (input.locationId) {
    const location = db.prepare('SELECT id FROM locations WHERE id = ? AND organization_id = ?').get(String(input.locationId), tenant.organizationId);
    if (!location) throw Object.assign(new Error('Location does not belong to this organization'), { statusCode: 400 });
  }
  const id = crypto.randomUUID();
  const now = nowIso();
  db.prepare(`
    INSERT INTO compliance_requests
      (id, organization_id, location_id, request_type, subject_type, subject_id, requested_by, reason, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(
    id, String(tenant.organizationId), input.locationId ? String(input.locationId) : null,
    requestType, subjectType, input.subjectId == null ? null : String(input.subjectId),
    actor?.userId || null, String(input.reason || '').slice(0, 1000), now, now,
  );
  audit(String(chatId), 'compliance.request.created', 'compliance_request', id, {
    requestType, subjectType, subjectId: input.subjectId == null ? null : String(input.subjectId),
  }, {
    organizationId: tenant.organizationId,
    locationId: input.locationId || null,
    actorId: actor?.userId || null,
    deviceId: actor?.deviceId || null,
  });
  return getComplianceRequest(chatId, id);
}

export async function getComplianceRequest(chatId, requestId) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) return null;
  const row = db.prepare('SELECT * FROM compliance_requests WHERE id = ? AND organization_id = ?').get(String(requestId), tenant.organizationId);
  return row ? {
    id: row.id, organizationId: row.organization_id, locationId: row.location_id,
    requestType: row.request_type, subjectType: row.subject_type, subjectId: row.subject_id,
    requestedBy: row.requested_by, reason: row.reason, status: row.status,
    resolutionNote: row.resolution_note, createdAt: row.created_at, updatedAt: row.updated_at,
  } : null;
}

export async function listComplianceRequests(chatId, { status = 'all', limit = 100 } = {}) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) return [];
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
  const where = ['organization_id = ?'];
  const params = [String(tenant.organizationId)];
  if (status && status !== 'all') { where.push('status = ?'); params.push(String(status)); }
  params.push(safeLimit);
  return db.prepare(`SELECT * FROM compliance_requests WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ?`).all(...params).map(row => ({
    id: row.id, organizationId: row.organization_id, locationId: row.location_id,
    requestType: row.request_type, subjectType: row.subject_type, subjectId: row.subject_id,
    requestedBy: row.requested_by, reason: row.reason, status: row.status,
    resolutionNote: row.resolution_note, createdAt: row.created_at, updatedAt: row.updated_at,
  }));
}

export async function resolveComplianceRequest(chatId, requestId, status, resolutionNote = '', actor = null) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) throw Object.assign(new Error('Unknown organization'), { statusCode: 404 });
  const nextStatus = String(status || '').toLowerCase();
  const current = await getComplianceRequest(chatId, requestId);
  if (!current) throw Object.assign(new Error('Compliance request not found'), { statusCode: 404 });
  const transitions = {
    pending: new Set(['approved', 'rejected', 'cancelled']),
    approved: new Set(['completed', 'cancelled']),
    rejected: new Set(),
    completed: new Set(),
    cancelled: new Set(),
  };
  if (!transitions[current.status]?.has(nextStatus)) {
    throw Object.assign(new Error(`Invalid compliance request transition: ${current.status} -> ${nextStatus}`), { statusCode: 409 });
  }
  const now = nowIso();
  db.prepare('UPDATE compliance_requests SET status = ?, resolution_note = ?, updated_at = ? WHERE id = ? AND organization_id = ?')
    .run(nextStatus, String(resolutionNote || '').slice(0, 2000), now, String(requestId), String(tenant.organizationId));
  audit(String(chatId), 'compliance.request.resolved', 'compliance_request', requestId, {
    previousStatus: current.status, status: nextStatus,
  }, {
    organizationId: tenant.organizationId,
    actorId: actor?.userId || null,
    deviceId: actor?.deviceId || null,
    reason: resolutionNote || '',
    result: nextStatus === 'rejected' ? 'failure' : 'success',
  });
  return getComplianceRequest(chatId, requestId);
}


export async function buildComplianceExport(chatId, { subjectType = 'organization', subjectId = null } = {}) {
  ensureDatabase();
  const tenant = await getTenant(chatId);
  if (!tenant?.organizationId) throw Object.assign(new Error('Unknown organization'), { statusCode: 404 });
  const type = String(subjectType || 'organization').toLowerCase();
  const orgId = String(tenant.organizationId);

  if (type === 'customer') {
    if (!subjectId) throw Object.assign(new Error('subjectId is required for customer export'), { statusCode: 400 });
    const customer = db.prepare('SELECT * FROM customers WHERE id = ? AND organization_id = ?').get(String(subjectId), orgId);
    if (!customer) throw Object.assign(new Error('Customer not found'), { statusCode: 404 });
    const orders = db.prepare(`
      SELECT server_order_id, local_id, order_json, total_minor, created_at, status,
             delivered_to_device, marketplace_order_id, is_marketplace
      FROM orders WHERE chat_id = ? AND customer_id = ? ORDER BY created_at DESC
    `).all(String(chatId), String(subjectId)).map(row => ({
      serverOrderId: row.server_order_id, localId: row.local_id,
      order: parseJSON(row.order_json, {}), totalMinor: row.total_minor,
      createdAt: row.created_at, status: row.status,
      deliveredToDevice: Boolean(row.delivered_to_device),
      marketplaceOrderId: row.marketplace_order_id, isMarketplace: Boolean(row.is_marketplace),
    }));
    const auditEvents = db.prepare(`
      SELECT id, action, entity_type, entity_id, actor_id, location_id, device_id, reason, result, metadata_json, created_at
      FROM audit_events
      WHERE organization_id = ? AND (entity_type = 'customer' AND entity_id = ?)
      ORDER BY id DESC LIMIT 5000
    `).all(orgId, String(subjectId)).map(row => ({
      id: row.id, action: row.action, entityType: row.entity_type, entityId: row.entity_id,
      actorId: row.actor_id, locationId: row.location_id, deviceId: row.device_id,
      reason: row.reason || '', result: row.result || 'success', metadata: parseJSON(row.metadata_json, {}),
      createdAt: row.created_at,
    }));
    return {
      exportVersion: 1,
      exportedAt: nowIso(),
      subject: { type: 'customer', id: String(subjectId) },
      customer: customerFromRow(customer),
      orders,
      auditEvents,
    };
  }

  if (type !== 'organization') {
    throw Object.assign(new Error('Unsupported export subject type'), { statusCode: 400 });
  }

  const locations = db.prepare('SELECT id, code, name, type, status, created_at FROM locations WHERE organization_id = ? ORDER BY code').all(orgId);
  const customers = db.prepare('SELECT * FROM customers WHERE organization_id = ? ORDER BY updated_at DESC').all(orgId).map(customerFromRow);
  const orders = db.prepare(`
    SELECT server_order_id, local_id, order_json, total_minor, created_at, status,
           delivered_to_device, marketplace_order_id, is_marketplace, customer_id
    FROM orders WHERE chat_id = ? ORDER BY created_at DESC LIMIT 5000
  `).all(String(chatId)).map(row => ({
    serverOrderId: row.server_order_id, localId: row.local_id,
    order: parseJSON(row.order_json, {}), totalMinor: row.total_minor,
    createdAt: row.created_at, status: row.status,
    deliveredToDevice: Boolean(row.delivered_to_device),
    marketplaceOrderId: row.marketplace_order_id, isMarketplace: Boolean(row.is_marketplace),
    customerId: row.customer_id || null,
  }));
  const auditEvents = db.prepare(`
    SELECT id, chat_id, organization_id, location_id, actor_id, device_id, action, entity_type, entity_id, reason, result, metadata_json, created_at
    FROM audit_events WHERE organization_id = ? ORDER BY id DESC LIMIT 10000
  `).all(orgId).map(row => ({
    id: row.id, chatId: row.chat_id, organizationId: row.organization_id, locationId: row.location_id,
    actorId: row.actor_id, deviceId: row.device_id, action: row.action, entityType: row.entity_type,
    entityId: row.entity_id, reason: row.reason || '', result: row.result || 'success',
    metadata: parseJSON(row.metadata_json, {}), createdAt: row.created_at,
  }));
  const complianceRequests = await listComplianceRequests(chatId, { limit: 500 });
  return {
    exportVersion: 1,
    exportedAt: nowIso(),
    subject: { type: 'organization', id: orgId },
    organization: {
      id: orgId, tenantId: tenant.tenantId, chatId: String(chatId),
      sellerName: tenant.sellerName, country: tenant.country, currency: tenant.currency, timezone: tenant.timezone,
    },
    retentionPolicy: await getAuditRetentionPolicy(chatId),
    locations, customers, orders, auditEvents, complianceRequests,
  };
}

export async function revokeSession(sessionId) {
  ensureDatabase();
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').run(nowIso(), String(sessionId));
}

// A "device" row today is created fresh on every createSession call (see
// createDeviceRow above) — there's no re-use of an existing device across
// logins, so this list is really "every session lineage ever created for
// this tenant," most of which will show status 'active' but an expired
// underlying session. hasLiveSession distinguishes those from ones that
// are both active *and* currently authenticate-able, so the UI can show
// "signed out (expired)" instead of implying a revoke would do anything.
export async function listDevices(chatId) {
  ensureDatabase();
  const rows = db.prepare(`
    SELECT d.id, d.name, d.status, d.created_at, d.last_seen_at,
           s.expires_at AS session_expires_at, s.revoked_at AS session_revoked_at
    FROM devices d
    LEFT JOIN sessions s ON s.device_id = d.id
    WHERE d.chat_id = ?
    ORDER BY d.last_seen_at DESC
  `).all(String(chatId));
  // A device can have accumulated more than one session row over time in
  // principle (none today, since createSession always makes a fresh
  // device — but the schema allows it), so collapse to one row per
  // device, keeping whichever session is furthest from expiring.
  const byDevice = new Map();
  for (const row of rows) {
    const existing = byDevice.get(row.id);
    if (!existing || (row.session_expires_at || '') > (existing.session_expires_at || '')) {
      byDevice.set(row.id, row);
    }
  }
  const now = Date.now();
  return Array.from(byDevice.values()).map(row => {
    const hasLiveSession = row.status === 'active' && !row.session_revoked_at
      && row.session_expires_at && Date.parse(row.session_expires_at) > now;
    return {
      id: row.id,
      name: row.name,
      status: row.status, // 'active' | 'revoked' (device-level, set by revokeDevice)
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      sessionExpiresAt: row.session_expires_at || null,
      hasLiveSession,
    };
  });
}

// Revokes at the device level (not just its session): sets devices.status
// = 'revoked', which authenticateSessionToken already checks on every
// request (`row.device_status !== 'active'` short-circuits to null), so
// this takes effect immediately without needing to separately find and
// revoke every session row that device ever created. The explicit
// sessions UPDATE below is defense-in-depth, not load-bearing — it means
// a future re-activation of the device row (if that's ever added) doesn't
// silently resurrect an old session too.
// requestingDeviceId is the caller's *own* device, from their session —
// not user input. Revoking your own device (signing yourself out) never
// needs a role check; revoking a different device does. This mirrors the
// same self-vs-other split server.js's handleRevokeDevice already applies
// before calling in here, but re-checked here too since this function is
// the actual authority, not the route handler.
export async function revokeDevice({ userId, chatId, deviceId, requestingDeviceId }) {
  ensureDatabase();
  const isSelf = requestingDeviceId != null && String(requestingDeviceId) === String(deviceId);
  if (!isSelf) {
    const membership = db.prepare(`SELECT * FROM memberships WHERE user_id = ? AND chat_id = ? AND status = 'active'`).get(String(userId), String(chatId));
    if (!membership || !['owner', 'manager'].includes(membership.role)) {
      throw Object.assign(new Error('Owner or manager permission required'), { statusCode: 403 });
    }
  }
  const device = db.prepare('SELECT * FROM devices WHERE id = ? AND chat_id = ?').get(String(deviceId), String(chatId));
  if (!device) throw Object.assign(new Error('Device not found'), { statusCode: 404 });
  db.prepare(`UPDATE devices SET status = 'revoked' WHERE id = ?`).run(String(deviceId));
  db.prepare(`UPDATE sessions SET revoked_at = ? WHERE device_id = ? AND revoked_at IS NULL`).run(nowIso(), String(deviceId));
  audit(String(chatId), 'device.revoked', 'device', String(deviceId), { userId: String(userId), deviceName: device.name });
}

export async function createAuthChallenge(userId, ttlMs = 5 * 60_000) {
  ensureDatabase();
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + ttlMs);
  db.prepare('INSERT INTO auth_challenges (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(hashToken(token), String(userId), now.toISOString(), expires.toISOString());
  return { token, expiresAt: expires.toISOString() };
}

export async function consumeAuthChallenge(token) {
  ensureDatabase();
  const hash = hashToken(token);
  const row = db.prepare('SELECT * FROM auth_challenges WHERE token_hash = ?').get(hash);
  if (!row || row.used_at || Date.parse(row.expires_at) <= Date.now()) return null;
  db.prepare('UPDATE auth_challenges SET used_at = ? WHERE token_hash = ?').run(nowIso(), hash);
  return { userId: row.user_id };
}

export async function createPairingChallenge({ userId, chatId, role = 'cashier', ttlMs = 10 * 60_000 }) {
  ensureDatabase();
  const allowedRoles = new Set(['manager', 'cashier', 'staff']);
  if (!allowedRoles.has(role)) throw Object.assign(new Error('Invalid pairing role'), { statusCode: 400 });
  const membership = db.prepare(`SELECT * FROM memberships WHERE user_id = ? AND chat_id = ? AND status = 'active'`).get(String(userId), String(chatId));
  if (!membership || !['owner', 'manager'].includes(membership.role)) throw Object.assign(new Error('Owner or manager permission required'), { statusCode: 403 });
  if (membership.role !== 'owner' && role === 'manager') throw Object.assign(new Error('Only the owner can invite managers'), { statusCode: 403 });
  const token = crypto.randomBytes(18).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + ttlMs);
  db.prepare('INSERT INTO pairing_challenges (token_hash, chat_id, created_by_user_id, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)').run(hashToken(token), String(chatId), String(userId), role, now.toISOString(), expires.toISOString());
  audit(String(chatId), 'device.pairing_created', 'device', null, { userId: String(userId), role, expiresAt: expires.toISOString() });
  return { token, expiresAt: expires.toISOString(), role, chatId: String(chatId) };
}

export async function consumePairingChallenge(token, deviceName = 'Paired Sellify device') {
  ensureDatabase();
  const hash = hashToken(token);
  const row = db.prepare(`SELECT * FROM pairing_challenges WHERE token_hash = ?`).get(hash);
  if (!row || row.used_at || Date.parse(row.expires_at) <= Date.now()) return null;
  const userId = crypto.randomUUID();
  const now = nowIso();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO users (id, telegram_user_id, display_name, created_at, last_seen_at) VALUES (?, NULL, ?, ?, ?)').run(userId, `Paired device`, now, now);
    await ensureMembership(userId, row.chat_id, row.role);
    db.prepare('UPDATE pairing_challenges SET used_at = ? WHERE token_hash = ?').run(now, hash);
    audit(row.chat_id, 'device.paired', 'device', null, { userId, role: row.role, deviceName: String(deviceName || 'Paired Sellify device') });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { userId, chatId: row.chat_id, role: row.role };
}

// Invites are distinct from pairing challenges: pairing hands a *device*
// a role by minting a fresh anonymous user, for standalone/non-Telegram
// clients. Invites hand a *person* a role — the recipient authenticates
// with their own Telegram identity and the invite grants that existing
// (or newly created) user a membership on this tenant. This is the path
// for adding a staff member who has their own Telegram account, as
// opposed to physically approving a new device.
export async function createInvite({ userId, chatId, role = 'cashier', ttlMs = 7 * 24 * 60 * 60_000 }) {
  ensureDatabase();
  const allowedRoles = new Set(['manager', 'cashier', 'staff']);
  if (!allowedRoles.has(role)) throw Object.assign(new Error('Invalid invite role'), { statusCode: 400 });
  const membership = db.prepare(`SELECT * FROM memberships WHERE user_id = ? AND chat_id = ? AND status = 'active'`).get(String(userId), String(chatId));
  if (!membership || !['owner', 'manager'].includes(membership.role)) throw Object.assign(new Error('Owner or manager permission required'), { statusCode: 403 });
  if (membership.role !== 'owner' && role === 'manager') throw Object.assign(new Error('Only the owner can invite managers'), { statusCode: 403 });
  const token = crypto.randomBytes(18).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + ttlMs);
  db.prepare('INSERT INTO invites (token_hash, chat_id, created_by_user_id, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)').run(hashToken(token), String(chatId), String(userId), role, now.toISOString(), expires.toISOString());
  audit(String(chatId), 'invite.created', 'invite', null, { userId: String(userId), role, expiresAt: expires.toISOString() });
  return { token, expiresAt: expires.toISOString(), role, chatId: String(chatId) };
}

// Listing never returns the raw token (it's only known at creation time,
// same as pairing codes) — just status, so an owner can see what's
// outstanding and revoke it if it was sent to the wrong person.
export async function listInvites(chatId) {
  ensureDatabase();
  const rows = db.prepare(`
    SELECT i.role, i.created_at, i.expires_at, i.used_at, i.revoked_at, u.display_name AS created_by_name
    FROM invites i JOIN users u ON u.id = i.created_by_user_id
    WHERE i.chat_id = ?
    ORDER BY i.created_at DESC
  `).all(String(chatId));
  return rows.map(row => ({
    role: row.role,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    createdBy: row.created_by_name,
    status: row.revoked_at ? 'revoked' : row.used_at ? 'accepted' : Date.parse(row.expires_at) <= Date.now() ? 'expired' : 'pending',
  }));
}

export async function revokeInvite({ userId, chatId, token }) {
  ensureDatabase();
  const membership = db.prepare(`SELECT * FROM memberships WHERE user_id = ? AND chat_id = ? AND status = 'active'`).get(String(userId), String(chatId));
  if (!membership || !['owner', 'manager'].includes(membership.role)) throw Object.assign(new Error('Owner or manager permission required'), { statusCode: 403 });
  const hash = hashToken(token);
  const row = db.prepare('SELECT * FROM invites WHERE token_hash = ? AND chat_id = ?').get(hash, String(chatId));
  if (!row) throw Object.assign(new Error('Invite not found'), { statusCode: 404 });
  db.prepare('UPDATE invites SET revoked_at = ? WHERE token_hash = ?').run(nowIso(), hash);
  audit(String(chatId), 'invite.revoked', 'invite', null, { userId: String(userId) });
}

// Roles an invite can carry, ranked so consumeInvite can tell an upgrade
// from a downgrade. Not exported: this ordering only matters for deciding
// whether accepting an invite should raise an existing membership's role,
// never for permission checks (those live client-side in
// auth/permissions.js and are re-derived from the stored role each time).
const ROLE_RANK = { owner: 4, manager: 3, staff: 2, cashier: 2, buyer: 1 };
function roleRank(role) { return ROLE_RANK[role] ?? 0; }

export async function consumeInvite(token, userId) {
  ensureDatabase();
  const hash = hashToken(token);
  const row = db.prepare('SELECT * FROM invites WHERE token_hash = ?').get(hash);
  if (!row || row.used_at || row.revoked_at || Date.parse(row.expires_at) <= Date.now()) return null;
  db.exec('BEGIN IMMEDIATE');
  let alreadyMember = false;
  let roleChanged = false;
  try {
    const existing = db.prepare('SELECT * FROM memberships WHERE user_id = ? AND chat_id = ?').get(String(userId), String(row.chat_id));
    if (existing) {
      // Already a member of this tenant — accepting the invite again should
      // never be a silent no-op. Only raise the role if the invite actually
      // grants more than they already have; never downgrade someone (e.g. a
      // manager re-accepting a stale cashier-level invite keeps their
      // manager role).
      alreadyMember = true;
      if (roleRank(row.role) > roleRank(existing.role)) {
        db.prepare('UPDATE memberships SET role = ? WHERE id = ?').run(row.role, existing.id);
        roleChanged = true;
        audit(row.chat_id, 'membership.role_upgraded', 'membership', existing.id, { userId: String(userId), from: existing.role, to: row.role });
      }
    } else {
      await ensureMembership(userId, row.chat_id, row.role);
    }
    db.prepare('UPDATE invites SET used_at = ?, used_by_user_id = ? WHERE token_hash = ?').run(nowIso(), String(userId), hash);
    audit(row.chat_id, 'invite.accepted', 'invite', null, { userId: String(userId), role: row.role, alreadyMember, roleChanged });
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  const tenant = db.prepare('SELECT tenant_id, seller_name FROM tenants WHERE chat_id = ?').get(row.chat_id);
  const finalRole = db.prepare('SELECT role FROM memberships WHERE user_id = ? AND chat_id = ?').get(String(userId), String(row.chat_id))?.role || row.role;
  return { chatId: row.chat_id, tenantId: tenant?.tenant_id, sellerName: tenant?.seller_name, role: finalRole, alreadyMember, roleChanged };
}

export async function createPaymentOperationalAction(chatId, input = {}, actor = null) {
  ensureDatabase();
  const payment = await getPayment(chatId, input.paymentId || input.payment_id);
  if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
  const actionType = String(input.actionType || input.action_type || '').trim().toUpperCase();
  const operation = String(input.operation || '').trim().toUpperCase();
  const allowed = new Set(['STATUS_QUERY','RECONCILIATION','REFUND','SETTLEMENT','LIFECYCLE','MANUAL_REVIEW']);
  if (!allowed.has(actionType) || !operation) throw Object.assign(new Error('Valid actionType and operation are required'), { statusCode: 400, code: 'INVALID_OPERATIONAL_ACTION' });
  const organizationId = payment.organizationId;
  const idempotencyKey = input.idempotencyKey || input.idempotency_key || null;
  if (idempotencyKey) {
    const existing = db.prepare('SELECT * FROM payment_operational_actions WHERE organization_id = ? AND idempotency_key = ?').get(organizationId, String(idempotencyKey));
    if (existing) return { action: normalizePaymentOperationalAction(existing), duplicate: true };
  }
  const id = crypto.randomUUID(), now = nowIso();
  db.prepare(`INSERT INTO payment_operational_actions
    (id, organization_id, payment_id, action_type, operation, status, attempt, idempotency_key, reason, actor_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'REQUESTED', 1, ?, ?, ?, ?, ?)`).run(
      id, organizationId, payment.id, actionType, operation,
      idempotencyKey == null ? null : String(idempotencyKey), String(input.reason || ''),
      actor?.userId || actor?.id || null, now, now);
  audit(String(chatId), 'payment.operational_action.requested', 'payment_operational_action', id,
    { paymentId: payment.id, actionType, operation, attempt: 1 },
    { organizationId, actorId: actor?.userId || actor?.id || null, reason: input.reason || '' });
  return { action: normalizePaymentOperationalAction(db.prepare('SELECT * FROM payment_operational_actions WHERE id = ?').get(id)), duplicate: false };
}

export async function updatePaymentOperationalAction(chatId, actionId, patch = {}, actor = null) {
  ensureDatabase();
  const row=db.prepare(`SELECT a.* FROM payment_operational_actions a
    JOIN payments p ON p.id=a.payment_id AND p.organization_id=a.organization_id
    JOIN tenants t ON t.organization_id=a.organization_id
    WHERE a.id=? AND t.chat_id=?`).get(String(actionId),String(chatId));
  if(!row) throw Object.assign(new Error('Operational action not found'),{statusCode:404,code:'OPERATIONAL_ACTION_NOT_FOUND'});
  const status=patch.status==null?row.status:String(patch.status).trim().toUpperCase();
  if(!new Set(['REQUESTED','RUNNING','SUCCEEDED','FAILED','UNKNOWN','BLOCKED','RESOLVED','DISMISSED']).has(status))
    throw Object.assign(new Error('Invalid operational action status'),{statusCode:400,code:'INVALID_OPERATIONAL_ACTION_STATUS'});
  const attempt=patch.attempt==null?row.attempt:Number(patch.attempt);
  if(!Number.isInteger(attempt)||attempt<1) throw Object.assign(new Error('Attempt must be an integer'),{statusCode:400,code:'INVALID_OPERATIONAL_ATTEMPT'});
  const now=nowIso(), completedAt=['SUCCEEDED','FAILED','UNKNOWN','BLOCKED','RESOLVED','DISMISSED'].includes(status)?(patch.completedAt||now):null;
  db.prepare(`UPDATE payment_operational_actions SET status=?,attempt=?,reason=?,error_code=?,result_json=?,next_retry_at=?,updated_at=?,completed_at=? WHERE id=?`).run(
    status,attempt,String(patch.reason??row.reason??''),patch.errorCode??row.error_code??null,
    patch.result==null?row.result_json:json(patch.result),patch.nextRetryAt??patch.next_retry_at??row.next_retry_at??null,now,completedAt,row.id);
  audit(String(chatId),'payment.operational_action.updated','payment_operational_action',row.id,
    {paymentId:row.payment_id,actionType:row.action_type,operation:row.operation,from:row.status,to:status,attempt},
    {organizationId:row.organization_id,actorId:actor?.userId||actor?.id||null,reason:patch.reason||row.reason||''});
  return normalizePaymentOperationalAction(db.prepare('SELECT * FROM payment_operational_actions WHERE id=?').get(row.id));
}

export async function listPaymentOperationalActions(chatId,paymentId,options={}) {
  ensureDatabase();
  const payment=await getPayment(chatId,paymentId); if(!payment)return null;
  const params=[payment.id,payment.organizationId]; let sql='SELECT * FROM payment_operational_actions WHERE payment_id=? AND organization_id=?';
  if(options.status){sql+=' AND status=?';params.push(String(options.status).toUpperCase());}
  if(options.actionType){sql+=' AND action_type=?';params.push(String(options.actionType).toUpperCase());}
  sql+=' ORDER BY created_at DESC,id DESC';
  return db.prepare(sql).all(...params).map(normalizePaymentOperationalAction);
}
function normalizePaymentOperationalAction(row){if(!row)return null;return{
  id:row.id,organizationId:row.organization_id,paymentId:row.payment_id,actionType:row.action_type,operation:row.operation,status:row.status,
  attempt:row.attempt,idempotencyKey:row.idempotency_key,reason:row.reason,errorCode:row.error_code,result:parseJSON(row.result_json,null),
  nextRetryAt:row.next_retry_at,actorId:row.actor_id,createdAt:row.created_at,updatedAt:row.updated_at,completedAt:row.completed_at
};}

export async function recordPaymentProviderCapabilityEvidence(chatId, input = {}, actor = null) {
  ensureDatabase();
  const tenant = getTenantByChatId(chatId);
  if (!tenant) throw Object.assign(new Error('Unknown store'), { statusCode: 404, code: 'UNKNOWN_STORE' });

  const providerId = String(input.providerId || input.provider_id || '').trim().toLowerCase();
  const capability = String(input.capability || '').trim();
  const scope = String(input.certificationScope || input.certification_scope || 'LIVE_EXTERNAL').trim().toUpperCase();
  if (!providerId || !capability) throw Object.assign(new Error('providerId and capability are required'), { statusCode: 400, code: 'PROVIDER_CAPABILITY_CONTEXT_REQUIRED' });
  if (!['ADAPTER_CONTRACT','LIVE_EXTERNAL'].includes(scope)) throw Object.assign(new Error('Invalid certification scope'), { statusCode: 400, code: 'INVALID_PROVIDER_CERTIFICATION_SCOPE' });

  const evidence = input.evidence && typeof input.evidence === 'object' ? input.evidence : {};
  const evidenceJson = json(evidence);
  const fingerprint = crypto.createHash('sha256').update([
    providerId, capability, scope, evidenceJson,
  ].join('|')).digest('hex');

  // External evidence supplied through the API is recorded as OBSERVED/UNKNOWN.
  // It cannot promote itself to LIVE_EXTERNAL/CERTIFIED.
  const requestedStatus = String(input.status || 'UNKNOWN').trim().toUpperCase();
  const status = requestedStatus === 'FAILED' ? 'FAILED' : requestedStatus === 'OBSERVED' ? 'OBSERVED' : 'UNKNOWN';
  const providerReference = input.providerReference || input.provider_reference || null;
  const observedAt = input.observedAt || input.observed_at || nowIso();
  const expiresAt = input.expiresAt || input.expires_at || null;
  const now = nowIso();
  const id = crypto.randomUUID();

  const existing = db.prepare(`
    SELECT * FROM payment_provider_capability_certifications
    WHERE organization_id = ? AND provider_id = ? AND capability = ?
      AND certification_scope = ? AND evidence_fingerprint = ?
  `).get(tenant.organization_id, providerId, capability, scope, fingerprint);
  if (existing) return normalizePaymentProviderCapabilityCertification(existing);

  db.prepare(`
    INSERT INTO payment_provider_capability_certifications
      (id, organization_id, provider_id, capability, certification_scope, status,
       evidence_json, evidence_fingerprint, provider_reference, observed_at,
       expires_at, reason, certified_by_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, tenant.organization_id, providerId, capability, scope, status,
    evidenceJson, fingerprint, providerReference == null ? null : String(providerReference),
    observedAt, expiresAt, String(input.reason || ''), actor?.userId || actor?.id || null, now, now,
  );

  audit(String(chatId), 'payment.provider_capability.evidence.recorded',
    'payment_provider_capability_certification', id,
    { providerId, capability, certificationScope: scope, status, evidenceFingerprint: fingerprint },
    { organizationId: tenant.organization_id, actorId: actor?.userId || actor?.id || null, reason: input.reason || '' });

  return normalizePaymentProviderCapabilityCertification(
    db.prepare('SELECT * FROM payment_provider_capability_certifications WHERE id = ?').get(id),
  );
}

export async function certifyPaymentProviderCapability(chatId, input = {}, actor = null) {
  ensureDatabase();
  const tenant = getTenantByChatId(chatId);
  if (!tenant) throw Object.assign(new Error('Unknown store'), { statusCode: 404, code: 'UNKNOWN_STORE' });

  const providerId = String(input.providerId || input.provider_id || '').trim().toLowerCase();
  const capability = String(input.capability || '').trim();
  const evidenceId = String(input.evidenceId || input.evidence_id || '').trim();
  if (!providerId || !capability || !evidenceId) {
    throw Object.assign(new Error('providerId, capability and evidenceId are required'), { statusCode: 400, code: 'PROVIDER_CERTIFICATION_CONTEXT_REQUIRED' });
  }

  const evidence = db.prepare(`
    SELECT * FROM payment_provider_capability_certifications
    WHERE id = ? AND organization_id = ? AND provider_id = ? AND capability = ?
  `).get(evidenceId, tenant.organization_id, providerId, capability);
  if (!evidence) throw Object.assign(new Error('Capability evidence not found'), { statusCode: 404, code: 'PROVIDER_CAPABILITY_EVIDENCE_NOT_FOUND' });

  if (evidence.certification_scope !== 'LIVE_EXTERNAL' || evidence.status !== 'OBSERVED') {
    throw Object.assign(new Error('Only observed live-external evidence can be certified'), { statusCode: 409, code: 'CAPABILITY_CERTIFICATION_EVIDENCE_NOT_ELIGIBLE' });
  }
  if (evidence.expires_at && new Date(evidence.expires_at).getTime() <= Date.now()) {
    throw Object.assign(new Error('Capability evidence is expired'), { statusCode: 409, code: 'CAPABILITY_EVIDENCE_EXPIRED' });
  }

  const now = nowIso();
  const fingerprint = crypto.createHash('sha256').update([
    providerId, capability, 'LIVE_EXTERNAL', evidence.evidence_fingerprint, 'CERTIFIED',
  ].join('|')).digest('hex');
  const existing = db.prepare(`
    SELECT * FROM payment_provider_capability_certifications
    WHERE organization_id = ? AND provider_id = ? AND capability = ?
      AND certification_scope = 'LIVE_EXTERNAL' AND evidence_fingerprint = ?
  `).get(tenant.organization_id, providerId, capability, fingerprint);
  if (existing) return normalizePaymentProviderCapabilityCertification(existing);

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO payment_provider_capability_certifications
      (id, organization_id, provider_id, capability, certification_scope, status,
       evidence_json, evidence_fingerprint, provider_reference, observed_at,
       expires_at, reason, certified_by_user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'LIVE_EXTERNAL', 'CERTIFIED', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, tenant.organization_id, providerId, capability,
    json({
      sourceEvidenceId: evidence.id,
      sourceEvidenceFingerprint: evidence.evidence_fingerprint,
      observationStatus: evidence.status,
      certificationDecision: 'CERTIFIED',
    }),
    fingerprint,
    evidence.provider_reference,
    evidence.observed_at,
    evidence.expires_at,
    String(input.reason || 'Live external capability certification'),
    actor?.userId || actor?.id || null,
    now, now,
  );

  audit(String(chatId), 'payment.provider_capability.certified',
    'payment_provider_capability_certification', id,
    { providerId, capability, sourceEvidenceId: evidence.id, evidenceFingerprint: evidence.evidence_fingerprint },
    { organizationId: tenant.organization_id, actorId: actor?.userId || actor?.id || null, reason: input.reason || '' });

  return normalizePaymentProviderCapabilityCertification(
    db.prepare('SELECT * FROM payment_provider_capability_certifications WHERE id = ?').get(id),
  );
}

export async function listPaymentProviderCapabilityEvidence(chatId, providerId = null, options = {}) {
  ensureDatabase();
  const tenant = getTenantByChatId(chatId);
  if (!tenant) throw Object.assign(new Error('Unknown store'), { statusCode: 404, code: 'UNKNOWN_STORE' });
  const clauses = ['organization_id = ?'];
  const params = [tenant.organization_id];
  if (providerId) { clauses.push('provider_id = ?'); params.push(String(providerId).trim().toLowerCase()); }
  if (options.capability) { clauses.push('capability = ?'); params.push(String(options.capability).trim()); }
  if (options.scope) { clauses.push('certification_scope = ?'); params.push(String(options.scope).trim().toUpperCase()); }
  clauses.push("status <> 'EXPIRED'");
  const rows = db.prepare(`SELECT * FROM payment_provider_capability_certifications WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC, id DESC`).all(...params);
  return rows.map(normalizePaymentProviderCapabilityCertification);
}

function normalizePaymentProviderCapabilityCertification(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    providerId: row.provider_id,
    capability: row.capability,
    certificationScope: row.certification_scope,
    status: row.status,
    evidence: parseJSON(row.evidence_json, null),
    evidenceFingerprint: row.evidence_fingerprint,
    providerReference: row.provider_reference,
    observedAt: row.observed_at,
    expiresAt: row.expires_at,
    reason: row.reason || '',
    certifiedByUserId: row.certified_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getDatabasePath() {
  return DB_PATH;
}
// Test-only introspection kept deliberately narrow; production callers should
// use domain functions rather than the raw database handle.
export function getDatabaseForTests() {
  ensureDatabase();
  return db;
}
