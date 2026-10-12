import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
const core=readFileSync(new URL('../backend/lib/payments/payment-core.js',import.meta.url),'utf8');
const store=readFileSync(new URL('../backend/lib/store-sqlite.js',import.meta.url),'utf8');
for(const [n,p] of [['evidence',/assertUntrustedPaymentEvidenceShape/],['freshness',/evaluateVerificationFreshness/],['commit',/commitPaymentDecision/],['uniqueness',/PROVIDER_TRANSACTION_DUPLICATE/],['lineage',/payment\.verification\.recorded/]])assert.match(core+store,p,n);
for(const table of ['payment_evidence','payment_verifications','payment_decisions','payment_ledger_entries','audit_events'])assert.match(store,new RegExp(table));
assert.match(store,/organization_id = \?/);
for(const table of ['payment_evidence','payment_verifications','payment_decisions']) assert.match(store,new RegExp(table+'_no_delete'));

// Exercise deletion protection against the real SQLite schema. These rows form
// a linked evidence -> verification -> decision chain attached to a payment.
const tempDir=await mkdtemp(path.join(os.tmpdir(),'sellify-gap1-18ac-'));
process.env.SELLIFY_DATA_DIR=tempDir;
process.env.SELLIFY_DB_PATH=path.join(tempDir,'sellify.sqlite');
try {
  const dbStore=await import('../backend/lib/store-sqlite.js');
  const user=await dbStore.getOrCreateUserByTelegram('gap1-18ac-user','Payment Lineage Retention Test');
  const tenant=await dbStore.createTenantForUser({
    userId:user.id,sellerName:'Lineage Retention Test',businessType:'retail',
    country:'ET',currency:'ETB',timezone:'Africa/Addis_Ababa',
  });
  const db=new DatabaseSync(process.env.SELLIFY_DB_PATH);
  try {
    db.exec('PRAGMA foreign_keys = ON');
    const organizationId=db.prepare('SELECT organization_id FROM tenants WHERE chat_id=?').get(tenant.chatId).organization_id;
    const now=new Date().toISOString();
    db.prepare("INSERT INTO payments(id,organization_id,provider_id,channel,amount_minor,currency,created_at,updated_at) VALUES(?,?,'manual','manual',100,'ETB',?,?)")
      .run('payment-retention-test',organizationId,now,now);
    db.prepare("INSERT INTO payment_evidence(id,organization_id,payment_id,provider_id,channel,evidence_type,fingerprint,received_at,created_at,updated_at) VALUES(?,?,?,'manual','api','STATUS_OBSERVATION','fingerprint-retention-test',?,?,?)")
      .run('evidence-retention-test',organizationId,'payment-retention-test',now,now,now);
    db.prepare("INSERT INTO payment_verifications(id,organization_id,payment_id,evidence_id,provider_id,result,verifier,created_at) VALUES(?,?,?,?,'manual','MATCH','regression-test',?)")
      .run('verification-retention-test',organizationId,'payment-retention-test','evidence-retention-test',now);
    db.prepare("INSERT INTO payment_decisions(id,organization_id,payment_id,evidence_id,verification_id,decision,target_state,created_at) VALUES(?,?,?,?,?,'ACCEPT','RECEIVED',?)")
      .run('decision-retention-test',organizationId,'payment-retention-test','evidence-retention-test','verification-retention-test',now);

    assert.throws(()=>db.prepare('DELETE FROM payment_decisions WHERE id=?').run('decision-retention-test'),/payment_decisions are append-only/);
    assert.throws(()=>db.prepare('DELETE FROM payment_verifications WHERE id=?').run('verification-retention-test'),/payment_verifications are append-only/);
    assert.throws(()=>db.prepare('DELETE FROM payment_evidence WHERE id=?').run('evidence-retention-test'),/payment_evidence is append-only/);
    // Parent payment deletion must not erase linked lineage through FK actions.
    assert.throws(()=>db.prepare('DELETE FROM payments WHERE id=?').run('payment-retention-test'),/append-only/);
    for(const [table,id] of [['payment_evidence','evidence-retention-test'],['payment_verifications','verification-retention-test'],['payment_decisions','decision-retention-test']]) {
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM '+table+' WHERE id=?').get(id).n,1,table+' record must remain persisted');
    }
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM payments WHERE id=?').get('payment-retention-test').n,1,'parent payment must remain persisted');
  } finally { db.close(); }
} finally {
  await rm(tempDir,{recursive:true,force:true});
}

console.log('GAP-1.18AC end-to-end invariant and deletion-retention certification passed');
