// GAP-1.18G provider error taxonomy.
// These errors describe provider-operation failures only. They never authorize
// Payment state changes, ledger effects, settlement, refund completion, or certification.

export const PROVIDER_ERROR_CODES = Object.freeze({
  UNSUPPORTED_OPERATION: 'PAYMENT_PROVIDER_OPERATION_UNSUPPORTED',
  NOT_CONFIGURED: 'PAYMENT_PROVIDER_NOT_CONFIGURED',
  TRANSPORT_UNAVAILABLE: 'PAYMENT_PROVIDER_TRANSPORT_UNAVAILABLE',
  TIMEOUT: 'PAYMENT_PROVIDER_PROBE_TIMEOUT',
  UPSTREAM: 'PAYMENT_PROVIDER_UPSTREAM_ERROR',
  NETWORK: 'PAYMENT_PROVIDER_NETWORK_ERROR',
  RESPONSE_INVALID: 'PAYMENT_PROVIDER_RESPONSE_INVALID',
});

export class PaymentProviderError extends Error {
  constructor(message, {
    code = PROVIDER_ERROR_CODES.UPSTREAM,
    statusCode = 502,
    providerId = null,
    operation = null,
    retryable = false,
    cause = null,
  } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'PaymentProviderError';
    this.code = code;
    this.statusCode = statusCode;
    this.providerId = providerId;
    this.operation = operation;
    this.retryable = Boolean(retryable);
  }
}

export class UnsupportedProviderOperationError extends PaymentProviderError {
  constructor(providerId, operation) {
    super(`Payment provider ${providerId} does not implement ${operation}`, {
      code: PROVIDER_ERROR_CODES.UNSUPPORTED_OPERATION,
      statusCode: 501,
      providerId,
      operation,
    });
    this.name = 'UnsupportedProviderOperationError';
  }
}

export class ProviderNotConfiguredError extends PaymentProviderError {
  constructor(providerId, operation = null) {
    super(`Payment provider ${providerId} is not configured`, {
      code: PROVIDER_ERROR_CODES.NOT_CONFIGURED,
      statusCode: 503,
      providerId,
      operation,
    });
    this.name = 'ProviderNotConfiguredError';
  }
}

export class ProviderTimeoutError extends PaymentProviderError {
  constructor(providerId = null, operation = 'probeCapability', cause = null) {
    super('Payment provider operation timed out', {
      code: PROVIDER_ERROR_CODES.TIMEOUT,
      statusCode: 504,
      providerId,
      operation,
      retryable: true,
      cause,
    });
    this.name = 'ProviderTimeoutError';
  }
}

export class ProviderNetworkError extends PaymentProviderError {
  constructor(providerId = null, operation = 'probeCapability', cause = null) {
    super('Payment provider network request failed', {
      code: PROVIDER_ERROR_CODES.NETWORK,
      statusCode: 502,
      providerId,
      operation,
      retryable: true,
      cause,
    });
    this.name = 'ProviderNetworkError';
  }
}

export function toPaymentProviderError(error, context = {}) {
  if (error instanceof PaymentProviderError) return error;
  return new PaymentProviderError(error?.message || 'Payment provider operation failed', {
    code: context.code || PROVIDER_ERROR_CODES.UPSTREAM,
    statusCode: context.statusCode || 502,
    providerId: context.providerId || null,
    operation: context.operation || null,
    retryable: Boolean(context.retryable),
    cause: error,
  });
}
