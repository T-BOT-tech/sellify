// GAP-1.18E provider-local response parsers.
// These parsers interpret provider payloads only. They never decide Sellify
// Payment state or perform persistence/ledger/settlement mutations.

import { providerVerificationResult } from './provider-verification-result.js';

function value(payload, keys) {
  for (const key of keys) {
    if (payload && payload[key] != null) return payload[key];
  }
  return null;
}

function classify(payload, success, failure) {
  const raw = String(value(payload, ['status', 'result', 'state', 'transactionStatus', 'transaction_status']) || '').trim().toUpperCase();
  if (success.has(raw)) return 'VERIFIED';
  if (failure.has(raw)) return 'FAILED';
  if (['NOT_FOUND', 'NOTFOUND', 'MISSING'].includes(raw)) return 'NOT_FOUND';
  if (['UNAVAILABLE', 'TIMEOUT', 'PENDING_RETRY'].includes(raw)) return 'UNAVAILABLE';
  return null;
}

function parseProvider(id, payload = {}, context = {}, success, failure) {
  const status = classify(payload, success, failure);
  const observed = {
    amountMinor: value(payload, ['amountMinor', 'amount_minor', 'observedAmountMinor', 'observed_amount_minor']),
    currency: value(payload, ['currency', 'observedCurrency', 'observed_currency']),
    receiverAccount: value(payload, ['receiverAccount', 'receiver_account', 'observedReceiverAccount', 'observed_receiver_account']),
    reference: value(payload, ['reference', 'externalReference', 'external_reference']),
    transactionId: value(payload, ['transactionId', 'transaction_id', 'providerTransactionId', 'provider_transaction_id']),
    observedAt: value(payload, ['observedAt', 'observed_at', 'timestamp', 'createdAt', 'created_at']),
  };

  const result = status
    ? providerVerificationResult(status, {
        providerId: id,
        reference: observed.reference ?? observed.transactionId,
        transactionId: observed.transactionId,
        observedAt: observed.observedAt,
        reasonCodes: status === 'VERIFIED' ? ['PROVIDER_TRANSACTION_CONFIRMED'] : ['PROVIDER_' + status],
        evidence: { providerId: id, payload, operation: context.operation || null },
      })
    : providerVerificationResult('FAILED', {
        providerId: id,
        reasonCodes: ['PROVIDER_RESPONSE_UNRECOGNIZED'],
        evidence: { providerId: id, payload, operation: context.operation || null },
      });

  // Preserve provider observations in the adapter contract. Payment Core consumes
  // these fields only as evidence and independently validates amount, currency,
  // receiver, reference, transaction identity, freshness, and tenant/payment binding.
  return {
    ...result,
    ...observed,
    observedAmountMinor: observed.amountMinor,
    observedCurrency: observed.currency,
    observedReceiverAccount: observed.receiverAccount,
    observedReference: observed.reference,
    observedTransactionId: observed.transactionId,
  };
}

export function parseTelebirrVerification(payload, context = {}) {
  return parseProvider('telebirr', payload, context,
    new Set(['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'PAID', 'CONFIRMED']),
    new Set(['FAILED', 'DECLINED', 'REJECTED', 'CANCELLED', 'CANCELED']));
}

export function parseCbeVerification(payload, context = {}) {
  return parseProvider('cbe', payload, context,
    new Set(['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'PAID', 'CONFIRMED', 'MATCHED']),
    new Set(['FAILED', 'DECLINED', 'REJECTED', 'CANCELLED', 'CANCELED', 'MISMATCH']));
}

export function parseMpesaVerification(payload, context = {}) {
  return parseProvider('mpesa', payload, context,
    new Set(['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'PAID', 'CONFIRMED']),
    new Set(['FAILED', 'DECLINED', 'REJECTED', 'CANCELLED', 'CANCELED']));
}

export function parseBoaVerification(payload, context = {}) {
  return parseProvider('boa', payload, context,
    new Set(['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'PAID', 'CONFIRMED', 'MATCHED']),
    new Set(['FAILED', 'DECLINED', 'REJECTED', 'CANCELLED', 'CANCELED', 'MISMATCH']));
}

export const PROVIDER_VERIFICATION_PARSERS = Object.freeze({
  telebirr: parseTelebirrVerification,
  cbe: parseCbeVerification,
  mpesa: parseMpesaVerification,
  boa: parseBoaVerification,
});
