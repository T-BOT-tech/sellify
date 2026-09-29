// Sellify parser port inspired by Cheki's parser registry.
// Parsers observe and normalize evidence. They never mutate payments, ledgers, or accounts.
export class EvidenceParseError extends Error {
  constructor(code, message, details = {}) { super(message); this.name='EvidenceParseError'; this.code=code; this.details=details; }
}
const registry = new Map();
export function registerEvidenceParser(parser, { replace=false } = {}) {
  if (!parser || !parser.id || typeof parser.parse !== 'function') throw new TypeError('Evidence parser requires id and parse()');
  const id=String(parser.id).toLowerCase();
  if (registry.has(id) && !replace) throw Object.assign(new Error('Evidence parser already registered'), {code:'EVIDENCE_PARSER_ALREADY_REGISTERED',statusCode:409});
  registry.set(id,Object.freeze({ ...parser, id }));
  return registry.get(id);
}
export function getEvidenceParser(providerId) { return registry.get(String(providerId || '').toLowerCase()) || null; }
export function listEvidenceParsers() { return [...registry.values()].map(p=>({id:p.id,name:p.name||p.id,version:p.version||'1',responseType:p.responseType||null})); }

export function normalizeParsedEvidence(parsed = {}, context = {}) {
  if (!parsed || typeof parsed !== 'object') throw new EvidenceParseError('EXTRACTION_ERROR', 'Parser returned invalid evidence');
  return Object.freeze({
    providerId: String(parsed.providerId || context.providerId || '').toLowerCase() || null,
    reference: parsed.reference || parsed.externalReference || null,
    providerTransactionId: parsed.providerTransactionId || parsed.transactionId || null,
    senderName: parsed.senderName || parsed.sender || null,
    senderAccount: parsed.senderAccount || null,
    receiverName: parsed.receiverName || parsed.receiver || null,
    receiverAccount: parsed.receiverAccount || null,
    amountMinor: parsed.amountMinor ?? parsed.amount ?? null,
    currency: parsed.currency || null,
    observedAt: parsed.observedAt || parsed.date || null,
    status: parsed.status || parsed.transactionStatus || null,
    reasonCodes: Array.isArray(parsed.reasonCodes) ? parsed.reasonCodes : [],
    providerPayload: parsed.providerPayload ?? parsed.raw ?? null,
    parser: parsed.parser || context.parser || null,
    parserVersion: parsed.parserVersion || context.parserVersion || null,
  });
}
