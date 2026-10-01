// Payment evidence authority boundary.
// Evidence is an observation/claim; verification, decisions, certification and
// financial state remain exclusively owned by Payment Core and its trusted
// verification paths.

export const PAYMENT_EVIDENCE_FORBIDDEN_FIELDS = Object.freeze([
  'verification', 'verificationId', 'verification_id',
  'verificationResult', 'verification_result',
  'decision', 'decisionId', 'decision_id',
  'targetState', 'target_state',
  'certification', 'certificationStatus', 'certification_status',
  'liveExternalCertification', 'live_external_certification',
  'ledgerMutated', 'ledger_mutated',
  'financialEffect', 'financial_effect',
  'paymentState', 'payment_state',
  'authoritative', 'authority',
  'verifier', 'verifierVersion', 'verifier_version',
]);

export function assertUntrustedPaymentEvidenceShape(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new TypeError('Payment evidence input must be an object'), {
      statusCode: 400,
      code: 'INVALID_PAYMENT_EVIDENCE_INPUT',
    });
  }

  for (const field of PAYMENT_EVIDENCE_FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      throw Object.assign(new Error('Evidence field ' + field + ' is controlled by Payment Core'), {
        statusCode: 409,
        code: 'EVIDENCE_AUTHORITY_FIELD_FORBIDDEN',
        field,
      });
    }
  }

  return true;
}

export function normalizePaymentEvidenceSource(source) {
  const value = String(source || '').trim();
  return value || 'caller.submitted';
}
