import { EvidenceParseError, normalizeParsedEvidence } from '../evidence-parser.js';
import { normalizeVerificationResult } from '../provider-registry.js';

function first(...values) { return values.find(v => v !== undefined && v !== null && String(v).trim() !== '') ?? null; }

export const telebirrProvider = Object.freeze({
  id: 'telebirr',
  name: 'Telebirr',
  version: '1',
  capabilities: {
    getMetadata: true,
    validateAccount: true,
    parseEvidence: true,
    verify: false,
    initiate: false,
    getStatus: false,
    refund: false,
    reconcile: false,
  },

  getMetadata: async () => ({
    id: 'telebirr',
    name: 'Telebirr',
    version: '1',
    channelTypes: ['manual', 'sms', 'api', 'image'],
  }),

  validateAccount: async account => ({
    valid: Boolean(first(account?.accountIdentifier, account?.phone)),
    providerId: 'telebirr',
  }),

  parseEvidence: async input => {
    const payload = input?.payload ?? input?.rawPayload ?? input;
    if (!payload || typeof payload !== 'object') {
      throw new EvidenceParseError('INVALID_EVIDENCE', 'Telebirr evidence must be a structured object');
    }

    const parsed = normalizeParsedEvidence({
      providerId: 'telebirr',
      reference: first(payload.reference, payload.externalReference, payload.transactionReference, payload.receiptNo),
      providerTransactionId: first(payload.transactionId, payload.transId, payload.transaction_id),
      senderName: first(payload.senderName, payload.payerName, payload.sender),
      senderAccount: first(payload.senderAccount, payload.payerAccount, payload.senderPhone),
      receiverName: first(payload.receiverName, payload.payeeName, payload.receiver),
      receiverAccount: first(payload.receiverAccount, payload.payeeAccount, payload.merchantAccount),
      amountMinor: payload.amountMinor ?? payload.amount_minor ?? payload.amount ?? null,
      currency: first(payload.currency, payload.currencyCode),
      observedAt: first(payload.observedAt, payload.transactionTime, payload.transTime, payload.timestamp),
      status: first(payload.status, payload.transactionStatus),
      providerPayload: payload,
      parser: 'telebirr',
      parserVersion: '1',
    });

    if (!parsed.reference && !parsed.providerTransactionId) {
      throw new EvidenceParseError('REFERENCE_UNAVAILABLE', 'Telebirr evidence contains neither a transaction reference nor transaction ID');
    }
    return parsed;
  },

  verify: async () => {
    const error = new Error('Telebirr live verification adapter is not configured');
    error.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
    error.statusCode = 503;
    error.providerId = 'telebirr';
    throw error;
  },

  initiate: async () => { throw Object.assign(new Error('Telebirr initiation adapter is not configured'), { code:'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode:503, providerId:'telebirr' }); },
  getStatus: async () => { throw Object.assign(new Error('Telebirr status adapter is not configured'), { code:'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode:503, providerId:'telebirr' }); },
  refund: async () => { throw Object.assign(new Error('Telebirr refund adapter is not configured'), { code:'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode:503, providerId:'telebirr' }); },
  reconcile: async () => { throw Object.assign(new Error('Telebirr reconciliation adapter is not configured'), { code:'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode:503, providerId:'telebirr' }); },
});
