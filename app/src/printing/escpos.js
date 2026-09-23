// printing/escpos.js
// Phase 12.1: provider-neutral ESC/POS encoding. No browser or printer API.

const encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

function bytes(text) {
  if (!encoder) throw new Error('TextEncoder is required for ESC/POS encoding');
  return Array.from(encoder.encode(String(text)));
}

function command(...values) { return values.flat(); }

export function escposInit() { return [0x1b, 0x40]; }
export function escposAlign(align = 'left') {
  const n = align === 'center' ? 1 : align === 'right' ? 2 : 0;
  return [0x1b, 0x61, n];
}
export function escposBold(enabled = true) { return [0x1b, 0x45, enabled ? 1 : 0]; }
export function escposText(text, { newline = true } = {}) {
  return command(bytes(text), newline ? [0x0a] : []);
}
export function escposCut() { return [0x1d, 0x56, 0x00]; }
export function escposCashDrawer() { return [0x1b, 0x70, 0x00, 0x19, 0xfa]; }
export function escposEncodeReceipt(receipt, { cut = true, drawer = false } = {}) {
  const r = receipt || {};
  const out = [];
  out.push(escposInit(), escposAlign('center'), escposBold(true));
  out.push(escposText(r.store || 'SELLIFY'));
  out.push(escposBold(false), escposText(r.header || 'RECEIPT'));
  out.push(escposAlign('left'), escposText('------------------------------'));
  if (r.orderId) out.push(escposText(`Order: ${r.orderId}`));
  if (r.date) out.push(escposText(`Date: ${r.date}`));
  for (const item of r.items || []) {
    out.push(escposText(`${item.qty} x ${item.name} = ${item.amount}`));
  }
  out.push(escposText('------------------------------'), escposBold(true));
  out.push(escposText(`TOTAL: ${r.total || ''}`), escposBold(false));
  if (r.cashTendered != null) out.push(escposText(`Cash: ${r.cashTendered}`));
  if (r.changeDue != null) out.push(escposText(`Change: ${r.changeDue}`));
  if (r.footer) out.push(escposAlign('center'), escposText(r.footer));
  out.push(escposText('\n'));
  if (drawer) out.push(escposCashDrawer());
  if (cut) out.push(escposCut());
  return Uint8Array.from(out.flat());
}
