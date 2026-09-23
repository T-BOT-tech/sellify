// orders/receipts.js
// Phase 4 extraction (see modularization plan §5): receipt generation and
// distribution — plain text, copy-to-clipboard, share, print, and canvas
// image receipts — moved out of main.js unchanged.
//
// NOTE on the `../main.js` import below: showToast and t still live in
// main.js at this phase (showToast moves out in Phase 7 — ui/toast.js).
// Importing them back from main.js creates a harmless circular import, the
// same temporary pattern storage/json.js already uses — see that file for
// the fuller explanation.
import { CS } from '../config/currency.js';
import { escapeHtml } from '../utils/index.js';
import { formatMoney } from '../utils/money.js';
import { config } from '../state.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { t } from '../ui/i18n.js';
import { showToast } from '../ui/toast.js';
import { getOrderById } from './queue.js';

export function formatReceiptText(o) {
  if (!o) return '';
  const store = config.sellerName || 'STALL LEDGER';
  const dateStr = new Date(o.created_at || Date.now()).toLocaleString();
  let text = `========================\n`;
  text += `   ${store.toUpperCase()}\n`;
  text += `   ${t('receiptHeader')}\n`;
  text += `========================\n`;
  text += `${t('date')}: ${dateStr}\n`;
  text += `Order ID: ${o.id}\n`;
  if (o.customer_name) text += `Customer: ${o.customer_name}\n`;
  if (o.customer_phone) text += `Phone: ${o.customer_phone}\n`;
  text += `------------------------\n`;
  o.items.forEach(i => {
    text += `${i.qty} x ${i.name} = ${CS()}${formatMoney(i.qty * i.price)}\n`;
  });
  text += `------------------------\n`;
  text += `${t('total').toUpperCase()}: ${CS()}${formatMoney(o.total)}\n`;
  if (o.cash_tendered !== null && o.cash_tendered !== undefined) {
    text += `${t('cashTendered')}: ${CS()}${formatMoney(o.cash_tendered)}\n`;
    text += `${t('changeDue')}: ${CS()}${formatMoney(o.change_due || 0)}\n`;
  }
  text += `========================\n`;
  text += `${t('thankYou')}\n`;
  return text;
}

export function copyReceipt(id) {
  const o = getOrderById(id);
  if (!o) return;
  const text = formatReceiptText(o);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(t('receiptCopied'));
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

export function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  showToast(t('receiptCopied'));
}

export function shareReceipt(id) {
  const o = getOrderById(id);
  if (!o) return;
  const text = formatReceiptText(o);
  if (navigator.share) {
    navigator.share({
      title: `${config.sellerName || 'Stall Ledger'} Receipt`,
      text: text
    }).catch(() => {});
  } else {
    const encoded = encodeURIComponent(text);
    const phone = o.customer_phone ? o.customer_phone.replace(/\D/g, '') : '';
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    }
  }
}

export function printReceipt(id) {
  const o = getOrderById(id);
  if (!o) return;
  const store = escapeHtml(config.sellerName || 'STALL LEDGER');
  const dateStr = new Date(o.created_at || Date.now()).toLocaleString();
  const container = document.getElementById('printableReceipt');
  if (!container) return;

  const itemsHtml = o.items.map(i =>
    `<div style="display:flex; justify-content:space-between; margin:4px 0;">
      <span>${i.qty} x ${escapeHtml(i.name)}</span>
      <span>${CS()}${formatMoney(i.qty * i.price)}</span>
    </div>`
  ).join('');

  const cashHtml = (o.cash_tendered !== null && o.cash_tendered !== undefined)
    ? `<div style="display:flex; justify-content:space-between; margin-top:4px;">
        <span>${t('cashTendered')}</span><span>${CS()}${formatMoney(o.cash_tendered)}</span>
       </div>
       <div style="display:flex; justify-content:space-between;">
        <span>${t('changeDue')}</span><span>${CS()}${formatMoney(o.change_due || 0)}</span>
       </div>`
    : '';

  const custHtml = (o.customer_name || o.customer_phone)
    ? `<div style="margin-top:6px; font-size:11px;">Customer: ${escapeHtml(o.customer_name || '')} ${escapeHtml(o.customer_phone || '')}</div>`
    : '';

  container.innerHTML = `
    <div style="text-align:center; font-weight:bold; font-size:14px;">${store}</div>
    <div style="text-align:center; font-size:11px; margin-bottom:8px;">${t('receiptHeader')}</div>
    <div style="border-top:1px dashed #000; padding-top:6px; font-size:11px;">
      <div>Order: #${o.id}</div>
      <div>Date: ${dateStr}</div>
      ${custHtml}
    </div>
    <div style="border-top:1px dashed #000; margin:6px 0; padding-top:6px;">
      ${itemsHtml}
    </div>
    <div style="border-top:1px dashed #000; padding-top:6px; font-weight:bold; display:flex; justify-content:space-between;">
      <span>${t('total')}</span>
      <span>${CS()}${formatMoney(o.total)}</span>
    </div>
    ${cashHtml}
    <div style="border-top:1px dashed #000; margin-top:8px; padding-top:8px; text-align:center; font-size:11px;">
      ${t('thankYou')}
    </div>
  `;

  window.print();
}

export function drawCanvasReceipt(o) {
  const canvas = document.createElement('canvas');
  const width = 480;
  const padding = 28;
  const storeName = (config.sellerName || 'STALL LEDGER').toUpperCase();
  const dateStr = new Date(o.created_at || Date.now()).toLocaleString();

  const baseHeight = 220;
  const itemHeight = ((o && o.items) ? o.items.length : 0) * 30;
  const cashHeight = (o && o.cash_tendered !== null && o.cash_tendered !== undefined) ? 60 : 0;
  const custHeight = (o && (o.customer_name || o.customer_phone)) ? 40 : 0;
  const height = baseHeight + itemHeight + cashHeight + custHeight;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#e2e2e0';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, width - 16, height - 16);

  ctx.fillStyle = '#1c1b18';
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(storeName, width / 2, 48);

  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#6e6d6a';
  ctx.fillText(t('receiptHeader'), width / 2, 72);

  function drawDashedLine(y) {
    ctx.beginPath();
    ctx.setLineDash([6, 6]);
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.strokeStyle = '#d0cfcc';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  let y = 88;
  drawDashedLine(y);

  y += 24;
  ctx.textAlign = 'left';
  ctx.font = '13px monospace';
  ctx.fillStyle = '#1c1b18';
  ctx.fillText(`Order: #${o.id}`, padding, y);
  y += 20;
  ctx.fillText(`${t('date')}: ${dateStr}`, padding, y);

  if (o.customer_name || o.customer_phone) {
    y += 20;
    const custTxt = `Customer: ${o.customer_name || ''} ${o.customer_phone || ''}`.trim();
    ctx.fillText(custTxt, padding, y);
  }

  y += 16;
  drawDashedLine(y);

  y += 24;
  ctx.font = '14px monospace';
  o.items.forEach(i => {
    ctx.textAlign = 'left';
    ctx.fillText(`${i.qty} x ${i.name}`, padding, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${CS()}${formatMoney(i.qty * i.price)}`, width - padding, y);
    y += 28;
  });

  drawDashedLine(y);

  y += 28;
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(t('total').toUpperCase(), padding, y);
  ctx.textAlign = 'right';
  ctx.fillText(`${CS()}${formatMoney(o.total)}`, width - padding, y);

  if (o.cash_tendered !== null && o.cash_tendered !== undefined) {
    y += 26;
    ctx.font = '14px monospace';
    ctx.fillStyle = '#6e6d6a';
    ctx.textAlign = 'left';
    ctx.fillText(t('cashTendered'), padding, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${CS()}${formatMoney(o.cash_tendered)}`, width - padding, y);

    y += 22;
    ctx.textAlign = 'left';
    ctx.fillText(t('changeDue'), padding, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${CS()}${formatMoney(o.change_due || 0)}`, width - padding, y);
  }

  y += 20;
  drawDashedLine(y);

  y += 32;
  ctx.textAlign = 'center';
  ctx.font = 'italic 13px monospace';
  ctx.fillStyle = '#6e6d6a';
  ctx.fillText(t('thankYou'), width / 2, y);

  return canvas;
}

export function generateAndShareImageReceipt(id) {
  const o = getOrderById(id);
  if (!o) return;
  showToast(t('imageReceiptGen'));

  const canvas = drawCanvasReceipt(o);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const file = new File([blob], `receipt_${o.id}.png`, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({
        title: `${config.sellerName || 'Stall Ledger'} Receipt #${o.id}`,
        files: [file]
      }).catch(() => {
        downloadImageFile(blob, `receipt_${o.id}.png`);
      });
    } else {
      downloadImageFile(blob, `receipt_${o.id}.png`);
    }
  }, 'image/png');
}

export function downloadImageFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(t('imageReceiptSaved'));
}
