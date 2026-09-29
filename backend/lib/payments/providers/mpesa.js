import crypto from 'node:crypto';
import { EvidenceParseError, normalizeParsedEvidence } from '../evidence-parser.js';

function timingSafeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}


function first(...values) {
  return values.find(v => v !== undefined && v !== null && String(v).trim() !== '') ?? null;
}
function amountMinor(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
function resultParameters(root) {
  const items = root?.ResultParameters?.ResultParameter;
  const list = Array.isArray(items) ? items : items ? [items] : [];
  return Object.fromEntries(list.filter(x => x?.Key).map(x => [x.Key, x.Value]));
}

export const mpesaProvider = Object.freeze({
  id: 'mpesa',
  name: 'M-Pesa',
  version: '1',
  capabilities: {
    getMetadata: true,
    validateAccount: true,
    parseEvidence: true,
    authenticateNotification: true,
    verify: false,
    initiate: false,
    getStatus: false,
    refund: false,
    reconcile: false,
  },

  getMetadata: async () => ({
    id: 'mpesa',
    name: 'M-Pesa',
    version: '1',
    channelTypes: ['c2b-callback', 'api', 'manual'],
  }),

  authenticateNotification: async input => {
    const headers = input?.headers || {};
    const expectedToken = String(input?.expectedToken || process.env.MPESA_NOTIFICATION_TOKEN || '').trim();
    if (!expectedToken) {
      throw Object.assign(new Error('M-Pesa notification authentication is not configured'), {
        code: 'PAYMENT_PROVIDER_AUTH_NOT_CONFIGURED', statusCode: 503, providerId: 'mpesa'
      });
    }
    const supplied = String(headers['x-mpesa-notification-token'] || headers['x-notification-token'] || input?.token || '').trim();
    if (!supplied || supplied.length !== expectedToken.length || !timingSafeEqual(supplied, expectedToken)) {
      throw Object.assign(new Error('M-Pesa notification authentication failed'), {
        code: 'PAYMENT_NOTIFICATION_UNAUTHORIZED', statusCode: 401, providerId: 'mpesa'
      });
    }
    return Object.freeze({ authenticated: true, providerId: 'mpesa', method: 'shared-secret' });
  },

  validateAccount: async account => ({
    valid: Boolean(first(account?.accountIdentifier, account?.shortCode, account?.phone)),
    providerId: 'mpesa',
  }),

  parseEvidence: async input => {
    const payload = input?.payload ?? input?.rawPayload ?? input;
    if (!payload || typeof payload !== 'object') {
      throw new EvidenceParseError('INVALID_EVIDENCE', 'M-Pesa evidence must be a structured object');
    }

    const root = payload.Body?.stkCallback || payload.Body?.Result || payload.Result || payload;
    const params = resultParameters(root);
    const transactionId = first(root.TransactionID, params.TransID, params.TransactionReceipt, params.ReceiptNo);
    const reference = first(
      payload.BillRefNumber,
      payload.billRefNumber,
      params.BillRefNumber,
      params.AccountReference,
      transactionId,
      root.OriginatorConversationID
    );

    if (!transactionId && !reference) {
      throw new EvidenceParseError('REFERENCE_UNAVAILABLE', 'M-Pesa evidence contains neither transaction ID nor reference');
    }

    const resultCode = root.ResultCode ?? root.ResponseCode ?? null;
    const success = resultCode === 0 || String(resultCode) === '0' || String(root.ResultCode || '').toUpperCase() === 'SUCCESS';

    return normalizeParsedEvidence({
      providerId: 'mpesa',
      reference,
      providerTransactionId: transactionId,
      senderName: first(params.MSISDN, params.DebitPartyName, params.PayerName),
      senderAccount: first(params.MSISDN, params.DebitParty),
      receiverName: first(params.BusinessShortCode, params.BusinessName, params.CreditPartyName, params.ReceiverPartyPublicName),
      receiverAccount: first(payload.BusinessShortCode, payload.BuyGoodsTillNumber, params.BusinessShortCode),
      amountMinor: amountMinor(first(params.TransAmount, params.TransactionAmount, params.Amount, payload.TransAmount)),
      currency: first(payload.Currency, params.Currency, 'KES'),
      observedAt: first(params.TransTime, params.TransactionCompletedDateTime, params.TransactionCompletedTime, payload.TransTime),
      status: success ? 'COMPLETED' : first(root.ResultDesc, root.ResponseDescription, 'FAILED'),
      reasonCodes: success ? [] : ['PROVIDER_TRANSACTION_FAILED'],
      providerPayload: payload,
      parser: 'mpesa-c2b',
      parserVersion: '1',
    });
  },

  verify: async () => {
    throw Object.assign(new Error('M-Pesa live verification adapter is not configured'), {
      code: 'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode: 503, providerId: 'mpesa'
    });
  },
  initiate: async () => { throw Object.assign(new Error('M-Pesa initiation adapter is not configured'), { code:'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode:503, providerId:'mpesa' }); },
  getStatus: async () => { throw Object.assign(new Error('M-Pesa transaction status adapter is not configured'), { code:'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode:503, providerId:'mpesa' }); },
  refund: async () => { throw Object.assign(new Error('M-Pesa refund adapter is not configured'), { code:'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode:503, providerId:'mpesa' }); },
  reconcile: async () => { throw Object.assign(new Error('M-Pesa reconciliation adapter is not configured'), { code:'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode:503, providerId:'mpesa' }); },
});
