// GAP-1.18D provider verification result boundary.
// Provider adapters may report external observations here. This result is
// evidence-shaped only: it never authorizes Payment state, ledger mutation,
// settlement, refund completion, or certification.

export const PROVIDER_VERIFICATION_STATUSES = Object.freeze([
  'VERIFIED',
  'NOT_FOUND',
  'FAILED',
  'UNAVAILABLE',
  'UNSUPPORTED',
]);

const AUTHORITY_FIELDS = new Set([
  'decision', 'decisionId', 'decision_id', 'targetState', 'target_state',
  'paymentState', 'payment_state', 'ledgerMutated', 'ledger_mutated',
  'financialEffect', 'financial_effect', 'certification',
  'certificationStatus', 'certification_status', 'authoritative',
  'authority', 'verification', 'verificationResult', 'verification_result', 'verificationId', 'verification_id', 'verifier',
]);

const SENSITIVE_FIELDS = new Set([
  'authorization', 'proxy-authorization', 'cookie', 'set-cookie',
  'access_token', 'refresh_token', 'client_secret', 'api_key', 'bot_token',
]);

function sanitize(value, depth = 0) {
  if (value == null) return value;
  if (depth > 4) return '[TRUNCATED_DEPTH]';
  if (typeof value === 'string') return value.length > 4096 ? value.slice(0, 4096) : value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map(item => sanitize(item, depth + 1));

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    const lower = String(key).toLowerCase();
    if (SENSITIVE_FIELDS.has(lower)) continue;
    if (AUTHORITY_FIELDS.has(key) || AUTHORITY_FIELDS.has(lower)) continue;
    output[key] = sanitize(item, depth + 1);
  }
  return output;
}

function normalizeStatus(value) {
  const status = String(value || '').trim().toUpperCase();
  return PROVIDER_VERIFICATION_STATUSES.includes(status) ? status : 'FAILED';
}

export function normalizeProviderVerificationResult(result = {}, context = {}) {
  const status = normalizeStatus(result.status ?? result.result ?? result.state);
  const reasonCodes = Array.isArray(result.reasonCodes)
    ? result.reasonCodes.map(value => String(value)).slice(0, 20)
    : [];

  return {
    status,
    providerId: String(context.providerId || result.providerId || result.provider_id || '').trim().toLowerCase(),
    providerReference: result.providerReference ?? result.provider_reference ?? result.reference ?? null,
    providerTransactionId: result.providerTransactionId ?? result.provider_transaction_id ?? result.transactionId ?? result.transaction_id ?? null,
    observedAt: result.observedAt ?? result.observed_at ?? new Date().toISOString(),
    reasonCodes,
    evidence: sanitize(result.evidence ?? result.raw ?? result.response ?? {}),
  };
}

export function providerVerificationResult(status, fields = {}) {
  return normalizeProviderVerificationResult({ ...fields, status });
}
