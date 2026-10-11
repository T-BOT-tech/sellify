import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-payment-lineage-append-only-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js?append-only-regression');
  const user = await store.getOrCreateUserByTelegram('append-only-regression-user', 'Append Only Regression');
  const tenant = await store.createTenantForUser({
    userId: user.id,
    sellerName: 'Append Only Regression Store',
    businessType: 'retail',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });

  const db = new DatabaseSync(process.env.SELLIFY_DB_PATH);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO payments (
      id, organization_id, provider_id, channel, amount_minor, currency, state, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'append-only-payment', tenant.organizationId, 'manual', 'manual', 1000, 'ETB', 'UNPAID', now, now,
    );
    db.prepare(`INSERT INTO payment_evidence (
      id, organization_id, payment_id, provider_id, channel, evidence_type, fingerprint,
      received_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'append-only-evidence', tenant.organizationId, 'append-only-payment', 'manual', 'manual',
      'REGRESSION', 'append-only-fingerprint', now, now, now,
    );
    db.prepare(`INSERT INTO payment_verifications (
      id, organization_id, payment_id, evidence_id, provider_id, result, verifier, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'append-only-verification', tenant.organizationId, 'append-only-payment',
      'append-only-evidence', 'manual', 'MATCH', 'payment-core-test', now,
    );
    db.prepare(`INSERT INTO payment_decisions (
      id, organization_id, payment_id, evidence_id, verification_id, decision,
      reason_codes_json, invariant_results_json, decision_source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'append-only-decision', tenant.organizationId, 'append-only-payment',
      'append-only-evidence', 'append-only-verification', 'ACCEPT', '[]', '{}', 'PAYMENT_CORE', now,
    );

    for (const [table, id, updateSql, deleteSql] of [
      ['payment_evidence', 'append-only-evidence',
        "UPDATE payment_evidence SET fingerprint = 'changed' WHERE id = ?",
        'DELETE FROM payment_evidence WHERE id = ?'],
      ['payment_verifications', 'append-only-verification',
        "UPDATE payment_verifications SET result = 'ERROR' WHERE id = ?",
        'DELETE FROM payment_verifications WHERE id = ?'],
      ['payment_decisions', 'append-only-decision',
        "UPDATE payment_decisions SET decision = 'REJECT' WHERE id = ?",
        'DELETE FROM payment_decisions WHERE id = ?'],
    ]) {
      assert.throws(() => db.prepare(updateSql).run(id), new RegExp(table.replaceAll('_', '_') + '.*append-only|append-only', 'i'),
        `${table} must reject in-place updates`);
      assert.throws(() => db.prepare(deleteSql).run(id), /append-only/i,
        `${table} must reject direct deletes`);
    }

    // The payment decision FK is ON DELETE CASCADE; the child guard must stop
    // a parent delete from silently erasing canonical financial lineage.
    assert.throws(
      () => db.prepare('DELETE FROM payments WHERE id = ?').run('append-only-payment'),
      /append-only/i,
      'deleting the parent payment must not cascade-delete its decision history',
    );

    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_evidence WHERE id = ?').get('append-only-evidence').n, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_verifications WHERE id = ?').get('append-only-verification').n, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payment_decisions WHERE id = ?').get('append-only-decision').n, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payments WHERE id = ?').get('append-only-payment').n, 1);
    console.log('Payment lineage append-only and cascade-blocking regression passed.');
  } finally {
    db.close();
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
