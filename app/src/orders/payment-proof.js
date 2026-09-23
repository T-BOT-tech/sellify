// orders/payment-proof.js
// Phase 4 extraction (see modularization plan §5): camera-captured payment
// proof — compression, OPFS storage with an inline-data-URL fallback, the
// capture modal, and the shared image-compression helper (also used by
// products/images.js for product photos) — moved out of main.js unchanged.
// pendingProofFile / pendingProofMeta are local capture state owned here;
// pendingProofMeta gets a setter (Rule 1's pattern) since orders/checkout.js
// needs to clear it once an order is saved.
//
// NOTE on the `../main.js` import below and the checkout.js one: this file
// and orders/checkout.js import each other (setPendingProofMeta here,
// saveOrder there) — confirmOrderWithProof() is the checkout entry point
// for the proof-capture flow, so it necessarily calls into checkout.js,
// while checkout.js's saveOrder() needs to reset proof state that lives
// here once the order is saved. See orders/cart.js for the fuller
// reasoning on why these small feature-level cycles are expected, not a
// sign of a bad split. effectiveUnitPrice and showToast still live in
// main.js at this phase — see storage/json.js for that circular-import
// pattern.
import { escapeHtml, escapeAttr, uid } from '../utils/index.js';
import { config, currentOrder, products } from '../state.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { effectiveUnitPrice } from '../b2b/pricing.js';
import { showToast } from '../ui/toast.js';
import { getOrderById } from './queue.js';
import { saveOrder } from './checkout.js';

export async function viewPaymentProof(orderId) {
  const o = getOrderById(orderId);
  if (!o || !o.payment_proof) return;
  const url = await ProofStorage.getProofUrl(o.payment_proof);
  if (!url) { showToast('Proof image unavailable on this device.'); return; }
  window.open(url, '_blank');
}

const ProofStorage = {
  async processAndSaveProof(file, orderId) {
    const compressedBlob = await this.compressToWebp(file, 1024, 1024, 0.75);

    if (navigator.storage && navigator.storage.getDirectory) {
      try {
        const root = await navigator.storage.getDirectory();
        const proofsDir = await root.getDirectoryHandle('payment_proofs', { create: true });
        const fileName = `proof_${orderId}_${Date.now()}.webp`;
        const fileHandle = await proofsDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(compressedBlob);
        await writable.close();
        return { path: `opfs://payment_proofs/${fileName}`, fileName, sizeBytes: compressedBlob.size, dataUrl: null };
      } catch (e) {
        console.warn('OPFS proof save failed, falling back to inline data URL:', e);
      }
    }
    // Fallback: store as a small inline data URL directly on the order record
    const dataUrl = await this.blobToDataUrl(compressedBlob);
    return { path: 'inline', fileName: `proof_${orderId}.webp`, sizeBytes: compressedBlob.size, dataUrl };
  },

  blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  async getProofUrl(proof) {
    if (!proof) return null;
    if (proof.dataUrl) return proof.dataUrl;
    if (proof.path && proof.path.startsWith('opfs://') && navigator.storage && navigator.storage.getDirectory) {
      try {
        const root = await navigator.storage.getDirectory();
        const proofsDir = await root.getDirectoryHandle('payment_proofs', { create: false });
        const fileHandle = await proofsDir.getFileHandle(proof.fileName, { create: false });
        const file = await fileHandle.getFile();
        return URL.createObjectURL(file);
      } catch (e) {
        console.warn('Could not read proof from OPFS:', e);
        return null;
      }
    }
    return null;
  },

  compressToWebp(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        let width = img.width, height = img.height;
        if (width > height) {
          if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
        } else {
          if (height > maxHeight) { width = Math.round((width * maxHeight) / height); height = maxHeight; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(img.src);
          if (blob) resolve(blob); else reject(new Error('Canvas compression failed'));
        }, 'image/webp', quality);
      };
      img.onerror = (err) => reject(err);
    });
  }
};

let pendingProofFile = null;
export let pendingProofMeta = null;
export function setPendingProofMeta(next) { pendingProofMeta = next; }

export function onOrderPayMethodChange() {
  const sel = document.getElementById('orderPayMethod');
  const hint = document.getElementById('payMethodDetailsHint');
  const proofBlock = document.getElementById('proofCaptureBlock');
  if (!sel) return;
  const pm = (config.paymentMethods || []).find(p => p.id === sel.value);
  if (pm && pm.type !== 'cash') {
    hint.style.display = pm.details ? 'block' : 'none';
    hint.textContent = pm.details ? `${pm.name} — ${pm.details}` : '';
    proofBlock.style.display = 'block';
  } else {
    hint.style.display = 'none';
    proofBlock.style.display = 'none';
  }
}

export function openPaymentProofModal() {
  const items = Object.entries(currentOrder).map(([id, qty]) => {
    const p = products.find(p => p.id === id);
    return p ? { name: p.name, qty, price: effectiveUnitPrice(p, qty) } : null;
  }).filter(Boolean);
  if (items.length === 0) return;

  const sel = document.getElementById('orderPayMethod');
  const enabledMethods = (config.paymentMethods || []).filter(pm => pm.enabled);
  // pm.id is derived from the user-entered method name (see
  // addCustomPaymentMethod in config/payment-methods.js), which only
  // strips whitespace — a name containing a `"` survives into the id
  // unchanged, so this was rendering it into an attribute completely
  // unescaped. escapeAttr closes that.
  sel.innerHTML = enabledMethods.map(pm => `<option value="${escapeAttr(pm.id)}">${escapeHtml(pm.name)}</option>`).join('');
  pendingProofFile = null;
  pendingProofMeta = null;
  document.getElementById('proofCameraInput').value = '';
  document.getElementById('proofPreviewWrap').style.display = 'none';
  onOrderPayMethodChange();
  document.getElementById('paymentProofModal').style.display = 'flex';

  const camInput = document.getElementById('proofCameraInput');
  camInput.onchange = () => {
    if (camInput.files && camInput.files[0]) {
      pendingProofFile = camInput.files[0];
      const previewWrap = document.getElementById('proofPreviewWrap');
      const previewImg = document.getElementById('proofPreviewImg');
      previewImg.src = URL.createObjectURL(pendingProofFile);
      previewWrap.style.display = 'block';
    }
  };
}

export function closePaymentProofModal() {
  document.getElementById('paymentProofModal').style.display = 'none';
}

export async function confirmOrderWithProof() {
  const sel = document.getElementById('orderPayMethod');
  const payMethodId = sel ? sel.value : 'cash';

  if (pendingProofFile) {
    try {
      setPendingProofMeta(await ProofStorage.processAndSaveProof(pendingProofFile, uid()));
    } catch (e) {
      console.error('Proof capture failed:', e);
      setPendingProofMeta(null);
    }
  }

  closePaymentProofModal();
  saveOrder(payMethodId, pendingProofMeta);
}

export function compressImage(file, maxDimension = 300, quality = 0.7) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Invalid image file'));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context error'));
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
