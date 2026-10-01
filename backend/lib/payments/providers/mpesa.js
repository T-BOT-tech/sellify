import { createHmac, timingSafeEqual } from 'node:crypto';

const PROVIDER_ID = 'mpesa';

function authError(message, details = {}) {
  return Object.assign(new Error(message), {
    code: 'PAYMENT_NOTIFICATION_AUTH_FAILED',
    statusCode: 401,
    providerId: PROVIDER_ID,
    ...details,
  });
}

function configuredError(message) {
  return Object.assign(new Error(message), {
    code: 'PAYMENT_NOTIFICATION_NOT_CONFIGURED',
    statusCode: 503,
    providerId: PROVIDER_ID,
  });
}

function normalized(value) {
  return String(value ?? '').trim();
}

function constantTimeHexEqual(expectedHex, actualHex) {
  if (!/^[a-f0-9]+$/i.test(expectedHex) || !/^[a-f0-9]+$/i.test(actualHex)) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(actualHex, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function getHeader(headers = {}, name) {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (String(key).toLowerCase() === wanted) return normalized(value);
  }
  return '';
}

function authenticateByConfiguredBoundary({ rawRequest, requestContext, config }) {
  const policy = config?.notificationAuthentication;
  if (!policy?.mode) throw configuredError('M-Pesa notification authentication is not configured');

  if (policy.mode === 'trusted-transport') {
    if (requestContext?.providerAuthenticated !== true) {
      throw authError('M-Pesa notification did not pass the configured trusted transport boundary');
    }
    return { signatureVersion: 'trusted-transport' };
  }

  if (policy.mode === 'shared-secret') {
    const secret = normalized(policy.secret);
    const headerName = normalized(policy.headerName || 'x-sellify-notification-signature');
    const provided = getHeader(rawRequest?.headers, headerName);
    const rawBody = rawRequest?.rawBody;

    if (!secret || !provided || rawBody == null) {
      throw configuredError('M-Pesa shared-secret notification authentication is incomplete');
    }

    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    if (!constantTimeHexEqual(expected, provided)) {
      throw authError('Invalid M-Pesa notification authentication');
    }

    return { signatureVersion: 'infrastructure-hmac-sha256' };
  }

  throw configuredError(`Unsupported M-Pesa notification authentication mode: ${policy.mode}`);
}

function callbackBody(rawRequest) {
  return rawRequest?.body && typeof rawRequest.body === 'object' ? rawRequest.body : rawRequest;
}

export const mpesaProvider = Object.freeze({
  id: PROVIDER_ID,
  name: 'M-Pesa',
  version: '1',
  capabilities: Object.freeze({
    getMetadata: true,
    validateAccount: true,
    authenticateNotification: true,
    parseEvidence: true,
    parseConfirmation: true,
    verify: true,
    initiate: false,
    getStatus: false,
    refund: false,
    reconcile: false,
  }),

  getMetadata: async () => ({
    id: PROVIDER_ID,
    name: 'M-Pesa',
    version: '1',
    notificationTypes: ['c2b-confirmation', 'c2b-validation'],
  }),

  validateAccount: async account => ({
    valid: /^\d{5,6}$/.test(normalized(account?.accountIdentifier)),
    providerId: PROVIDER_ID,
  }),

  authenticateNotification: async ({ rawRequest, requestContext, config }) => {
    const body = callbackBody(rawRequest);
    const configuredAccount = normalized(config?.accountIdentifier);
    const callbackAccount = normalized(body?.BusinessShortCode);

    if (!/^\d{5,6}$/.test(configuredAccount)) {
      throw configuredError('M-Pesa accountIdentifier must be a configured 5-6 digit shortcode');
    }

    if (!callbackAccount || callbackAccount !== configuredAccount) {
      throw authError('M-Pesa notification is not addressed to the configured shortcode');
    }

    const boundary = authenticateByConfiguredBoundary({ rawRequest, requestContext, config });

    const notificationId = normalized(body?.TransID) || null;
    const authenticationReference = notificationId
      ? `mpesa:notification-auth:${notificationId}:${boundary.signatureVersion}`
      : `mpesa:notification-auth:unidentified:${boundary.signatureVersion}`;

    return {
      authenticated: true,
      providerId: PROVIDER_ID,
      accountIdentifier: configuredAccount,
      providerAccountReference: configuredAccount,
      notificationId,
      authenticationReference,
      signatureVersion: boundary.signatureVersion,
      receivedAt: new Date().toISOString(),
    };
  },

  parseEvidence: async ({ rawRequest, config }) => {
    const body = callbackBody(rawRequest);
    const transactionId = normalized(body?.TransID);
    if (!transactionId) {
      throw Object.assign(new Error('M-Pesa callback is missing TransID'), {
        code: 'INVALID_PROVIDER_NOTIFICATION',
        statusCode: 400,
        providerId: PROVIDER_ID,
      });
    }

    const amount = Number(body?.TransAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw Object.assign(new Error('M-Pesa callback contains an invalid TransAmount'), {
        code: 'INVALID_PROVIDER_NOTIFICATION',
        statusCode: 400,
        providerId: PROVIDER_ID,
      });
    }

    return {
      providerId: PROVIDER_ID,
      providerTransactionId: transactionId,
      amountMinor: Math.round(amount * 100),
      currency: normalized(config?.currency),
      receiver: normalized(body?.BusinessShortCode),
      merchantReference: normalized(body?.BillRefNumber) || null,
      providerTimestamp: normalized(body?.TransTime) || null,
      rawProviderReference: transactionId,
    };
  },

  verify: async ({ evidence, paymentIntent, paymentAccount }) => {
    const normalizedEvidence = evidence?.normalizedPayload || evidence || {};
    const transactionId = normalized(normalizedEvidence.providerTransactionId || evidence?.providerTransactionId);
    const receiver = normalized(normalizedEvidence.receiver || normalizedEvidence.observedReceiver);
    const currency = normalized(normalizedEvidence.currency || paymentAccount?.currency);
    const amountMinor = Number(normalizedEvidence.amountMinor);
    const reference = normalized(
      normalizedEvidence.merchantReference ||
      normalizedEvidence.externalReference ||
      evidence?.externalReference
    ) || null;

    const reasonCodes = [];
    if (!transactionId) reasonCodes.push('PROVIDER_TRANSACTION_UNAVAILABLE');
    if (!Number.isInteger(amountMinor) || amountMinor < 0) reasonCodes.push('PROVIDER_AMOUNT_UNAVAILABLE');
    if (!currency) reasonCodes.push('PROVIDER_CURRENCY_UNAVAILABLE');
    if (!receiver) reasonCodes.push('RECEIVER_UNAVAILABLE');

    const expectedProvider = String(paymentIntent?.providerId || paymentAccount?.providerId || PROVIDER_ID).toLowerCase();
    if (expectedProvider !== PROVIDER_ID) reasonCodes.push('PROVIDER_MISMATCH');

    return {
      providerId: PROVIDER_ID,
      result: reasonCodes.length ? 'UNVERIFIABLE' : 'MATCH',
      confidence: reasonCodes.length ? 0 : 1,
      observedAmountMinor: Number.isInteger(amountMinor) ? amountMinor : null,
      observedCurrency: currency || null,
      observedReceiver: receiver || null,
      observedReceiverAccount: receiver || null,
      observedReference: reference,
      observedTransactionId: transactionId || null,
      observedAt: normalizedEvidence.providerTimestamp || evidence?.observedAt || null,
      reasonCodes: [...new Set(reasonCodes)],
      rawResult: {
        source: evidence?.source || 'provider-evidence',
        provider: PROVIDER_ID,
        verificationMode: 'authenticated-notification-evidence',
      },
      verifier: 'mpesa-provider-adapter',
      verifierVersion: 'notification-evidence-v1',
    };
  },

});

export default mpesaProvider;
