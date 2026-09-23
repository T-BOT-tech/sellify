// printing/contract.js
// Phase 12.4: provider-neutral print-job contract.
// This is a pure document/job boundary. It does not talk to printers,
// browser APIs, Bluetooth, USB, network transports, or persistence.

export const PRINT_DOCUMENT_TYPES = new Set(['receipt']);

function positiveInteger(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error('Print job copies must be a positive integer');
  return n;
}

function cleanString(value, fallback = '') {
  return value == null ? fallback : String(value);
}

export function isPrintJob(job) {
  return !!job
    && typeof job === 'object'
    && typeof job.id === 'string'
    && typeof job.documentType === 'string'
    && PRINT_DOCUMENT_TYPES.has(job.documentType)
    && job.document
    && typeof job.document === 'object'
    && Number.isInteger(job.copies)
    && job.copies > 0;
}

export function createReceiptPrintJob({
  id,
  orderId,
  document,
  copies = 1,
  metadata = {},
} = {}) {
  const resolvedId = cleanString(id || (orderId != null ? `order:${orderId}:receipt` : ''));
  if (!resolvedId) throw new Error('Print job id is required');
  if (orderId == null || String(orderId) === '') throw new Error('Print job orderId is required');
  if (!document || typeof document !== 'object') throw new Error('Print job document is required');

  const job = {
    id: resolvedId,
    source: 'sellify.printing',
    documentType: 'receipt',
    orderId: String(orderId),
    copies: positiveInteger(copies == null ? 1 : copies),
    document: {
      store: cleanString(document.store, 'SELLIFY'),
      header: cleanString(document.header, 'RECEIPT'),
      date: document.date ?? null,
      customer: document.customer ?? null,
      items: Array.isArray(document.items) ? document.items.map(item => ({
        qty: item?.qty ?? 0,
        name: cleanString(item?.name),
        amount: cleanString(item?.amount),
      })) : [],
      total: cleanString(document.total),
      cashTendered: document.cashTendered ?? null,
      changeDue: document.changeDue ?? null,
      footer: document.footer ?? null,
    },
    metadata: { ...metadata },
  };

  return job;
}

export function normalizePrintJob(job) {
  if (!job || typeof job !== 'object') throw new Error('Print job is required');
  if (!PRINT_DOCUMENT_TYPES.has(job.documentType)) {
    throw new Error(`Unsupported print document type: ${job.documentType || 'unknown'}`);
  }
  return createReceiptPrintJob({
    id: job.id,
    orderId: job.orderId,
    document: job.document,
    copies: job.copies,
    metadata: job.metadata,
  });
}
