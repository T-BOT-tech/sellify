import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-business-template-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('template-owner-' + suffix, 'Template Owner');
  const tenant = await store.createTenantForUser({
    userId: owner.id,
    sellerName: 'Template Atomicity Test',
    businessType: 'services',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const db = store.getDatabaseForTests();
  const actor = { userId: String(owner.id) };
  const auditCount = () => db.prepare(
    "SELECT COUNT(*) AS count FROM audit_events WHERE chat_id = ? AND action = 'tenant.business_template.updated'"
  ).get(String(tenant.chatId)).count;
  const templateRow = () => db.prepare(
    'SELECT template_key, schema_version, config_json FROM tenant_business_templates WHERE chat_id = ?'
  ).get(String(tenant.chatId));

  const createFailureTrigger = () => db.exec(`
    CREATE TRIGGER fail_business_template_audit
    BEFORE INSERT ON audit_events
    WHEN NEW.action = 'tenant.business_template.updated'
    BEGIN
      SELECT RAISE(ABORT, 'injected business-template audit failure');
    END;
  `);
  const removeFailureTrigger = () => db.exec('DROP TRIGGER IF EXISTS fail_business_template_audit');

  // A failed audit must roll back a first-time template insert as well.
  createFailureTrigger();
  await assert.rejects(
    store.saveBusinessTemplateConfig(tenant.chatId, { templateKey: 'retail-shop' }, actor),
    /injected business-template audit failure/,
    'template save must surface audit persistence failure',
  );
  assert.equal(templateRow(), undefined,
    'failed audit must not leave an unaudited first-time business-template record');
  assert.equal(auditCount(), 0,
    'failed template transaction must not leave partial audit evidence');

  removeFailureTrigger();
  const saved = await store.saveBusinessTemplateConfig(
    tenant.chatId, { templateKey: 'retail-shop' }, actor,
  );
  assert.equal(saved.templateKey, 'retail-shop');
  assert.equal((await store.getBusinessTemplateConfig(tenant.chatId)).templateKey, 'retail-shop');
  assert.equal(auditCount(), 1, 'successful template save must write exactly one audit event');

  // A failed update must preserve the previously committed canonical value.
  createFailureTrigger();
  await assert.rejects(
    store.saveBusinessTemplateConfig(tenant.chatId, { templateKey: 'repair' }, actor),
    /injected business-template audit failure/,
    'template update must surface audit persistence failure',
  );
  assert.equal(templateRow().template_key, 'retail-shop',
    'failed audit must roll back the attempted template-key update');
  assert.equal((await store.getBusinessTemplateConfig(tenant.chatId)).templateKey, 'retail-shop',
    'readers must continue seeing the last successfully audited canonical template');
  assert.equal(auditCount(), 1,
    'failed update must not append partial audit evidence');

  removeFailureTrigger();
  const updated = await store.saveBusinessTemplateConfig(
    tenant.chatId, { templateKey: 'repair' }, actor,
  );
  assert.equal(updated.templateKey, 'repair');
  assert.equal(auditCount(), 2,
    'successful retry must persist one update and one matching audit event');

  await assert.rejects(
    store.saveBusinessTemplateConfig(tenant.chatId, {
      templateKey: 'other', chatId: 'attacker-controlled-tenant',
    }, actor),
    error => error?.code === 'INVALID_BUSINESS_TEMPLATE_FIELDS',
    'caller must not override the canonical tenant identity in the template payload',
  );
  await assert.rejects(
    store.saveBusinessTemplateConfig(tenant.chatId, {
      templateKey: 'repair', schemaVersion: 2,
    }, actor),
    error => error?.code === 'UNSUPPORTED_BUSINESS_TEMPLATE_SCHEMA',
    'unsupported schema versions must be rejected without changing canonical state',
  );
  assert.equal((await store.getBusinessTemplateConfig(tenant.chatId)).templateKey, 'repair');
  assert.equal(auditCount(), 2);

  console.log('Business template persistence regression: PASS');
  console.log('Template upsert + audit atomicity: PASS');
  console.log('Failed create/update rollback and safe retry: PASS');
  console.log('Tenant identity and schema validation: PASS');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
