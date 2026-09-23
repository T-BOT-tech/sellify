// printing/escpos-adapter.js
// Phase 12.5: adapter from the canonical print-job contract to ESC/POS bytes.
// Provider-specific encoding remains in escpos.js; this adapter only maps the
// canonical document boundary to the existing encoder and never persists or
// mutates commerce state.

import { normalizePrintJob } from './contract.js';
import { escposEncodeReceipt } from './escpos.js';

export const ESC_POS_ADAPTER_ID = 'escpos';
export const ESC_POS_DOCUMENT_TYPES = new Set(['receipt']);

export function getEscPosAdapterMetadata() {
  return {
    id: ESC_POS_ADAPTER_ID,
    documentTypes: [...ESC_POS_DOCUMENT_TYPES],
    transport: 'bytes',
    providerSpecific: true,
  };
}

export function encodeEscPosPrintJob(job, options = {}) {
  const normalized = normalizePrintJob(job);
  if (!ESC_POS_DOCUMENT_TYPES.has(normalized.documentType)) {
    throw new Error(`ESC/POS adapter does not support document type: ${normalized.documentType}`);
  }

  const receipt = {
    ...normalized.document,
    orderId: normalized.orderId,
  };

  const data = escposEncodeReceipt(receipt, options);
  return {
    adapter: ESC_POS_ADAPTER_ID,
    jobId: normalized.id,
    documentType: normalized.documentType,
    copies: normalized.copies,
    data,
  };
}

export function encodeEscPosReceiptPrintJob(job, options = {}) {
  const result = encodeEscPosPrintJob(job, options);
  return result;
}
