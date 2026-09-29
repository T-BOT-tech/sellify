import { EvidenceParseError, normalizeParsedEvidence } from '../evidence-parser.js';

function first(...values) {
  return values.find(v => v !== undefined && v !== null && String(v).trim() !== '') ?? null;
}
function amountMinor(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).replace(/,/g, '').replace(/\s*ETB\s*/i, '').trim().replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
function fromText(text) {
  const get = (...patterns) => {
    for (const p of patterns) {
      const m = text.match(p);
      if (m?.[1]) return m[1].trim();
    }
    return null;
  };
  return {
    reference: get(/(?:Reference|20 Reference)\s*[:\-]?\s*([A-Z0-9\-\/]+)/i),
    amount: get(/(?:Amount)\s*[:\-]?\s*([\d,]+(?:\.\d+)?)\s*ETB/i),
    currency: get(/32A Date, Currency, Amount\s*[:\-]?\s*\d{6}([A-Z]{3})/i) || 'ETB',
    sender: get(/(?:Ordering Customer|From)\s*[:\-]?\s*([^\n]+)/i),
    receiver: get(/(?:Beneficiary Customer|To)\s*[:\-]?\s*([^\n]+)/i),
    status: get(/Processing Status\s*[:\-]?\s*([^\n]+)/i),
    observedAt: get(/(?:Business Date|Value Date|Entry Date)\s*[:\-]?\s*(\d{8})/i),
  };
}

export const boaProvider = Object.freeze({
  id: 'boa',
  name: 'Bank of Abyssinia',
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
    id: 'boa', name: 'Bank of Abyssinia', version: '1',
    channelTypes: ['receipt-text', 'json', 'manual'],
  }),

  validateAccount: async account => ({
    valid: Boolean(first(account?.accountIdentifier, account?.accountNumber)),
    providerId: 'boa',
  }),

  parseEvidence: async input => {
    const payload = input?.payload ?? input?.rawPayload ?? input;
    if (!payload) throw new EvidenceParseError('INVALID_EVIDENCE', 'BoA evidence is required');

    let parsed;
    if (typeof payload === 'string') {
      parsed = fromText(payload);
    } else if (typeof payload === 'object') {
      parsed = {
        reference: first(payload.reference, payload.Reference, payload.transactionReference, payload.uetr),
        providerTransactionId: first(payload.transactionId, payload.TransactionID, payload.uetr),
        senderName: first(payload.senderName, payload.sender, payload.orderingCustomer),
        senderAccount: first(payload.senderAccount, payload.debitAccount),
        receiverName: first(payload.receiverName, payload.receiver, payload.beneficiaryCustomer),
        receiverAccount: first(payload.receiverAccount, payload.creditAccount, payload.beneficiaryAccount),
        amount: first(payload.amount, payload.Amount),
        currency: first(payload.currency, payload.Currency, 'ETB'),
        observedAt: first(payload.observedAt, payload.valueDate, payload.businessDate),
        status: first(payload.status, payload.processingStatus, 'COMPLETED'),
      };
    } else {
      throw new EvidenceParseError('INVALID_EVIDENCE', 'Unsupported BoA evidence payload');
    }

    const reference = first(parsed.reference, parsed.providerTransactionId);
    if (!reference) throw new EvidenceParseError('REFERENCE_UNAVAILABLE', 'BoA evidence contains no transaction reference');

    const normalized = normalizeParsedEvidence({
      providerId: 'boa',
      reference,
      providerTransactionId: first(parsed.providerTransactionId, parsed.reference),
      senderName: parsed.senderName ?? parsed.sender,
      senderAccount: parsed.senderAccount,
      receiverName: parsed.receiverName ?? parsed.receiver,
      receiverAccount: parsed.receiverAccount,
      amountMinor: amountMinor(parsed.amount),
      currency: first(parsed.currency, 'ETB'),
      observedAt: parsed.observedAt,
      status: parsed.status,
      reasonCodes: [],
      providerPayload: payload,
      parser: 'boa-receipt',
      parserVersion: '1',
    });
    return normalized;
  },

  verify: async () => { throw Object.assign(new Error('BoA live verification adapter is not configured'), { code:'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode:503, providerId:'boa' }); },
  initiate: async () => { throw Object.assign(new Error('BoA initiation adapter is not configured'), { code:'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode:503, providerId:'boa' }); },
  getStatus: async () => { throw Object.assign(new Error('BoA transaction status adapter is not configured'), { code:'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode:503, providerId:'boa' }); },
  refund: async () => { throw Object.assign(new Error('BoA refund adapter is not configured'), { code:'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode:503, providerId:'boa' }); },
  reconcile: async () => { throw Object.assign(new Error('BoA reconciliation adapter is not configured'), { code:'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode:503, providerId:'boa' }); },
});
