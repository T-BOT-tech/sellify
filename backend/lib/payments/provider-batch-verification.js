// GAP-1.18H provider batch verification boundary.
//
// This module only orchestrates provider adapter verification/status calls.
// It deliberately does not persist evidence, mutate Payment state, write the
// ledger, settle funds, or make certification decisions.

import {
  normalizeProviderVerificationResult,
} from './provider-verification-result.js';
import {
  PROVIDER_ERROR_CODES,
} from './provider-errors.js';

const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 8;

function boundedConcurrency(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_CONCURRENCY;
  return Math.min(parsed, MAX_CONCURRENCY);
}

function normalizeBatchError(error, providerId, operation) {
  const code = String(error?.code || '').trim();
  const status = code === PROVIDER_ERROR_CODES.UNSUPPORTED_OPERATION
    ? 'UNSUPPORTED'
    : (error?.retryable === true ||
      code === PROVIDER_ERROR_CODES.TRANSPORT_UNAVAILABLE ||
      code === PROVIDER_ERROR_CODES.TIMEOUT ||
      code === PROVIDER_ERROR_CODES.NETWORK ||
      code === PROVIDER_ERROR_CODES.UPSTREAM)
      ? 'UNAVAILABLE'
      : 'FAILED';

  return normalizeProviderVerificationResult({
    status,
    providerId,
    reasonCodes: [code || 'PROVIDER_VERIFICATION_ERROR'],
    evidence: {
      operation,
      errorCode: code || null,
      retryable: error?.retryable === true,
      statusCode: Number.isInteger(error?.statusCode) ? error.statusCode : null,
    },
  }, { providerId });
}

function normalizeItem(item, index) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw Object.assign(new TypeError('Batch verification item must be an object'), {
      code: 'PROVIDER_BATCH_ITEM_INVALID',
      itemIndex: index,
    });
  }
  const providerId = String(item.providerId || item.provider_id || '').trim().toLowerCase();
  const operation = String(item.operation || 'status').trim().toLowerCase();
  if (!providerId) {
    throw Object.assign(new TypeError('Batch verification item providerId is required'), {
      code: 'PROVIDER_BATCH_PROVIDER_REQUIRED',
      itemIndex: index,
    });
  }
  if (!['verify', 'status'].includes(operation)) {
    throw Object.assign(new TypeError('Batch verification operation must be verify or status'), {
      code: 'PROVIDER_BATCH_OPERATION_INVALID',
      itemIndex: index,
    });
  }
  return { ...item, providerId, operation };
}

async function executeItem(item, index, providerResolver) {
  let normalized;
  try {
    const provider = await providerResolver(item.providerId, item);
    if (!provider) {
      normalized = normalizeProviderVerificationResult({
        status: 'UNSUPPORTED',
        providerId: item.providerId,
        reasonCodes: ['UNKNOWN_PAYMENT_PROVIDER'],
        evidence: { operation: item.operation },
      }, { providerId: item.providerId });
    } else {
      const method = item.operation === 'verify' ? provider.verify : provider.getStatus;
      if (typeof method !== 'function') {
        normalized = normalizeProviderVerificationResult({
          status: 'UNSUPPORTED',
          providerId: item.providerId,
          reasonCodes: ['PROVIDER_OPERATION_NOT_IMPLEMENTED'],
          evidence: { operation: item.operation },
        }, { providerId: item.providerId });
      } else {
        const result = await method({
          context: item.context || {},
          query: item.query || {},
          payment: item.payment || null,
          paymentIntent: item.paymentIntent || null,
          paymentAccount: item.paymentAccount || null,
        });
        normalized = normalizeProviderVerificationResult(result, {
          providerId: item.providerId,
        });
      }
    }
  } catch (error) {
    normalized = normalizeBatchError(error, item.providerId, item.operation);
  }

  return {
    index,
    providerId: item.providerId,
    operation: item.operation,
    status: normalized.status,
    result: normalized,
  };
}

export async function batchVerifyProviderPayments({
  items = [],
  providerRegistry = null,
  providerResolver = null,
  concurrency = DEFAULT_CONCURRENCY,
} = {}) {
  if (!Array.isArray(items)) {
    throw Object.assign(new TypeError('Batch verification items must be an array'), {
      code: 'PROVIDER_BATCH_ITEMS_INVALID',
    });
  }

  const limit = boundedConcurrency(concurrency);
  const resolveProvider = providerResolver || (async providerId =>
    providerRegistry?.getPaymentProvider?.(providerId) || null);

  const normalizedItems = items.map(normalizeItem);
  const results = new Array(normalizedItems.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= normalizedItems.length) return;
      results[index] = await executeItem(normalizedItems[index], index, resolveProvider);
    }
  }

  const workerCount = Math.min(limit, normalizedItems.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const summary = results.reduce((acc, item) => {
    acc.total += 1;
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {
    total: 0,
    VERIFIED: 0,
    NOT_FOUND: 0,
    FAILED: 0,
    UNAVAILABLE: 0,
    UNSUPPORTED: 0,
  });

  return {
    results,
    summary,
    concurrency: limit,
    financialEffect: false,
    paymentStateMutated: false,
    ledgerMutated: false,
  };
}

export const PROVIDER_BATCH_VERIFICATION_DEFAULTS = Object.freeze({
  concurrency: DEFAULT_CONCURRENCY,
  maxConcurrency: MAX_CONCURRENCY,
});
