// GAP-1.18: canonical authenticated provider notification boundary.
// This module normalizes authentication output only. It never resolves a payment,
// decides verification, mutates payment state, or writes financial records.

export const PAYMENT_NOTIFICATION_AUTHENTICATED_FIELDS = Object.freeze([
  'authenticated',
  'providerId',
  'accountIdentifier',
  'notificationId',
  'signatureVersion',
  'receivedAt',
]);

export const PAYMENT_NOTIFICATION_FORBIDDEN_AUTH_FIELDS = Object.freeze([
  'paymentId', 'payment_id',
  'paymentIntentId', 'payment_intent_id',
  'organizationId', 'organization_id',
  'tenantId', 'tenant_id',
  'verified', 'verification', 'decision', 'targetState', 'target_state',
  'ledgerMutated', 'ledger_mutated', 'financialEffect', 'financial_effect',
]);

export function assertAuthenticatedNotificationContext(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new TypeError('Authenticated provider notification must be an object'), {
      statusCode: 400, code: 'INVALID_PAYMENT_NOTIFICATION_AUTH_CONTEXT',
    });
  }
  for (const field of PAYMENT_NOTIFICATION_FORBIDDEN_AUTH_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      throw Object.assign(new Error('Provider notification cannot supply authoritative payment or tenant fields'), {
        statusCode: 409, code: 'PAYMENT_NOTIFICATION_AUTHORITY_FIELD_FORBIDDEN', field,
      });
    }
  }
  if (input.authenticated !== true) {
    throw Object.assign(new Error('Provider notification authentication failed'), {
      statusCode: 401, code: 'PAYMENT_NOTIFICATION_AUTH_FAILED',
    });
  }
  const providerId = String(input.providerId || '').trim().toLowerCase();
  const accountIdentifier = String(input.accountIdentifier || '').trim();
  const notificationId = String(input.notificationId || '').trim();
  if (!providerId || !accountIdentifier || !notificationId) {
    throw Object.assign(new Error('Authenticated notification requires providerId, accountIdentifier and notificationId'), {
      statusCode: 400, code: 'PAYMENT_NOTIFICATION_AUTH_CONTEXT_REQUIRED',
    });
  }
  const receivedAt = String(input.receivedAt || '').trim();
  const signatureVersion = input.signatureVersion == null ? null : String(input.signatureVersion).trim();
  return Object.freeze({ authenticated: true, providerId, accountIdentifier, notificationId, signatureVersion, receivedAt: receivedAt || new Date().toISOString() });
}

export function assertProviderNotificationEvidenceShape(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw Object.assign(new TypeError('Provider notification evidence must be an object'), {
      statusCode: 400, code: 'INVALID_PAYMENT_NOTIFICATION_EVIDENCE',
    });
  }
  for (const field of [...PAYMENT_NOTIFICATION_FORBIDDEN_AUTH_FIELDS, 'authoritative', 'authority', 'verifier']) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      throw Object.assign(new Error('Provider notification evidence contains an authority field'), {
        statusCode: 409, code: 'PAYMENT_NOTIFICATION_AUTHORITY_FIELD_FORBIDDEN', field,
      });
    }
  }
  const evidenceType = String(input.evidenceType || input.evidence_type || '').trim().toUpperCase();
  if (!evidenceType) throw Object.assign(new Error('evidenceType is required'), { statusCode: 400, code: 'EVIDENCE_TYPE_REQUIRED' });
  return true;
}
