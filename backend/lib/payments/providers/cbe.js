import { EvidenceParseError, normalizeParsedEvidence } from '../evidence-parser.js';

function first(...values) {
  return values.find(v => v !== undefined && v !== null && String(v).trim() !== '') ?? null;
}

function amountMinor(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isInteger(value)) return value * 100;
  const text = String(value).replace(/,/g, '').replace(/ETB/gi, '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

function parseCbePdfText(text) {
  if (!text || !text.includes('Commercial Bank of Ethiopia')) return null;
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const find = pattern => {
    const line = lines.find(value => pattern.test(value));
    return line ? line.replace(pattern, '').trim() : null;
  };
  const accounts = [...text.matchAll(/Account\s*([0-9*]+)/gi)].map(match => match[1]);
  const amountMatch = text.match(/Transferred Amount\s*([0-9,]+(?:\.\d{1,2})?)\s*ETB/i);
  const dateMatch = text.match(/Payment Date & Time\s*([^\n]+)/i);
  const refMatch = text.match(/Reference No\.?(?: \(VAT Invoice No\))?\s*([^\n]+)/i);

  return {
    providerId: 'cbe',
    reference: first(refMatch?.[1]),
    senderName: find(/^Payer\s*/i),
    senderAccount: accounts[0] || null,
    receiverName: find(/^Receiver\s*/i),
    receiverAccount: accounts[1] || null,
    amountMinor: amountMatch ? amountMinor(amountMatch[1]) : null,
    currency: amountMatch ? 'ETB' : null,
    observedAt: first(dateMatch?.[1]),
    providerPayload: { pdfText: text },
    parser: 'cbe-pdf',
    parserVersion: '1',
  };
}

function parseCbeJson(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const reference = first(payload.id, payload.reference, payload.transactionId, payload.transactionReference);
  if (!reference) return null;
  const amount = first(payload.amountCredited, payload.amount, payload.transferredAmount);
  return {
    providerId: 'cbe',
    reference,
    providerTransactionId: first(payload.transactionId, payload.transId, payload.id),
    senderName: first(payload.debitAccountHolder, payload.senderName, payload.payerName),
    senderAccount: first(payload.debitAccountNo, payload.senderAccount, payload.payerAccount),
    receiverName: first(payload.creditAccountHolder, payload.receiverName, payload.beneficiaryName),
    receiverAccount: first(payload.creditAccountNo, payload.receiverAccount, payload.beneficiaryAccount),
    amountMinor: amountMinor(amount),
    currency: first(payload.creditCurrency, payload.currency, 'ETB'),
    observedAt: first(payload.dateTimes?.[0], payload.transactionDate, payload.observedAt),
    status: first(payload.status, payload.transactionStatus),
    providerPayload: payload,
    parser: 'cbe-json',
    parserVersion: '1',
  };
}

export const cbeProvider = Object.freeze({
  id: 'cbe',
  name: 'Commercial Bank of Ethiopia',
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
    id: 'cbe',
    name: 'Commercial Bank of Ethiopia',
    version: '1',
    channelTypes: ['manual', 'pdf', 'api', 'image'],
  }),

  validateAccount: async account => ({
    valid: Boolean(String(account?.accountIdentifier || account?.accountNumber || '').replace(/\s/g, '').length >= 8),
    providerId: 'cbe',
  }),

  parseEvidence: async input => {
    const payload = input?.payload ?? input?.rawPayload ?? input;
    let parsed = null;

    if (typeof payload === 'string') parsed = parseCbePdfText(payload);
    else if (payload?.pdfText) parsed = parseCbePdfText(String(payload.pdfText));
    else if (payload?.json && typeof payload.json === 'object') parsed = parseCbeJson(payload.json);
    else parsed = parseCbeJson(payload);

    if (!parsed) {
      throw new EvidenceParseError('INVALID_EVIDENCE', 'CBE evidence is not a recognized PDF-text or structured transaction payload');
    }
    if (!parsed.reference && !parsed.providerTransactionId) {
      throw new EvidenceParseError('REFERENCE_UNAVAILABLE', 'CBE evidence contains neither a transaction reference nor transaction ID');
    }
    return normalizeParsedEvidence(parsed);
  },

  verify: async () => {
    throw Object.assign(new Error('CBE live verification adapter is not configured'), {
      code: 'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode: 503, providerId: 'cbe'
    });
  },
  initiate: async () => { throw Object.assign(new Error('CBE initiation adapter is not configured'), { code:'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode:503, providerId:'cbe' }); },
  getStatus: async () => { throw Object.assign(new Error('CBE status adapter is not configured'), { code:'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode:503, providerId:'cbe' }); },
  refund: async () => { throw Object.assign(new Error('CBE refund adapter is not configured'), { code:'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode:503, providerId:'cbe' }); },
  reconcile: async () => { throw Object.assign(new Error('CBE reconciliation adapter is not configured'), { code:'PAYMENT_PROVIDER_NOT_CONFIGURED', statusCode:503, providerId:'cbe' }); },
});
