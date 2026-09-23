// products/images.js
// Phase 4 extraction (see modularization plan §5): the high-resolution
// image-preview modal and new/edit product image upload+compress handlers,
// moved out of main.js unchanged.
//
// NOTE on the `../main.js` import below: showToast still lives in main.js
// at this phase (it moves out in Phase 7 — ui/toast.js). Importing it back
// from main.js creates a harmless circular import, the same temporary
// pattern storage/json.js already uses — see that file for the fuller
// explanation.
import { CS } from '../config/currency.js';
import { formatMoney } from '../utils/money.js';
import { products } from '../state.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { showToast } from '../ui/toast.js';
import { compressImage } from '../orders/payment-proof.js';
import { editingProdImages, setPendingNewProdImage } from './catalog.js';

export function openProductImageModal(productId) {
  const p = products.find(prod => prod.id === productId);
  if (!p) return;
  const imgSrc = (editingProdImages && editingProdImages[p.id]) || p.image || p.image_url;
  if (!imgSrc) return;
  openImageModal(imgSrc, p.name, p.price, p.category, p.unit);
}

export function openImageModal(imgSrc, title, price, category, unit) {
  if (!imgSrc) return;
  const modal = document.getElementById('imagePreviewModal');
  const img = document.getElementById('imgPreviewSrc');
  const titleEl = document.getElementById('imgPreviewTitle');
  const priceEl = document.getElementById('imgPreviewPrice');
  const subtitleEl = document.getElementById('imgPreviewSubtitle');

  if (img) img.src = imgSrc;
  if (titleEl) titleEl.textContent = title || 'Product Image';
  if (priceEl) priceEl.textContent = (price !== undefined && price !== null) ? `${CS()}${formatMoney(price)}${unit ? ' / ' + unit : ''}` : '';
  if (subtitleEl) subtitleEl.textContent = category || '';

  if (modal) {
    modal.style.display = 'flex';
  }
}

export function closeImageModal() {
  const modal = document.getElementById('imagePreviewModal');
  if (modal) modal.style.display = 'none';
}

export function handleImageModalBackdrop(event) {
  if (event.target.id === 'imagePreviewModal') {
    closeImageModal();
  }
}

export async function handleNewProdImageSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('newProdImgStatus');
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.textContent = 'Optimizing image on canvas... ⏳';
  }
  try {
    const compressed = await compressImage(file, 300, 0.7);
    setPendingNewProdImage(compressed);
    const previewBox = document.getElementById('newProdImgPreview');
    if (previewBox) {
      previewBox.innerHTML = `<img src="${compressed}" alt="Preview" class="thumb-img" />`;
    }
    if (statusEl) {
      const approxKb = Math.round((compressed.length * 3 / 4) / 1024);
      statusEl.textContent = `Optimized (~${approxKb} KB) 🖼️`;
      setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 3000);
    }
  } catch (err) {
    console.error('Image compression error:', err);
    if (statusEl) statusEl.textContent = 'Failed to process image.';
  }
}

export async function handleEditProdImageSelect(event, productId) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const compressed = await compressImage(file, 300, 0.7);
    editingProdImages[productId] = compressed;
    const previewBox = document.getElementById(`editProdImgPreview-${productId}`);
    if (previewBox) {
      previewBox.innerHTML = `<img src="${compressed}" class="thumb-img-sm" />`;
    }
    const approxKb = Math.round((compressed.length * 3 / 4) / 1024);
    showToast(`Image optimized: ~${approxKb} KB`);
  } catch (err) {
    console.error('Image compression error:', err);
    showToast('Failed to process image.');
  }
}
