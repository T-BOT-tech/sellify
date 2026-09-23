// products/catalog.js
// Phase 4 extraction (see modularization plan §5): the product catalog tab
// (CRUD, edit-in-place, image/tag/modifier form state) moved out of main.js
// unchanged. editingProductId / pendingNewProdImage / editingProdImages /
// pendingNewProdTags are local editing state owned here and exported as
// live bindings for sibling products/*.js modules to read (Rule 1's
// pattern, applied at feature scope instead of app scope). pendingNewProdImage
// is fully reassigned from products/images.js (a file-select handler), so it
// gets a setter the same way state.js gives every reassigned singleton one;
// editingProdImages only ever has properties set/deleted from outside this
// file, which a live-binding import allows directly, no setter needed.
//
// NOTE on the `../main.js` import below: renderAll/showToast/t all still
// live in main.js at this phase (they move out in Phase 7 per the plan's
// migration order). Importing them back from main.js creates a harmless
// circular import, the same temporary pattern storage/json.js established —
// see that file for the fuller explanation. It goes away once those have
// their own modules.
import { CS } from '../config/currency.js';
import { toMinorUnits, fromMinorUnits, formatMoney } from '../utils/money.js';
import { getNichePreset, isRestaurant } from '../config/niche.js';
import { escapeHtml, escapeAttr, uid } from '../utils/index.js';
import { STORAGE_KEYS, RESTAURANT_COURSES } from '../constants.js';
import { products, setProducts, currentOrder, currentOrderNotes, currentStaff } from '../state.js';
import { saveJSON } from '../storage/json.js';
import { hasPermission } from '../auth/permissions.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { t } from '../ui/i18n.js';
import { renderAll } from '../ui/render.js';
import { showToast } from '../ui/toast.js';

export let editingProductId = null;
let catalogDirty = false;
export function markCatalogDirty() { catalogDirty = true; renderCatalogSyncStatus(); }
export function markCatalogSynced() { catalogDirty = false; renderCatalogSyncStatus(); }
export function renderCatalogSyncStatus() {
  const el = document.getElementById('catalogSyncStatus');
  if (!el) return;
  el.className = `catalog-sync-status ${catalogDirty ? 'dirty' : 'synced'}`;
  el.textContent = catalogDirty ? '● Changes waiting to sync' : '✓ Catalog synced';
}
export let pendingNewProdImage = null;
export function setPendingNewProdImage(next) { pendingNewProdImage = next; }
export let editingProdImages = {};

export function renderCatalog() {
  const list = document.getElementById('catalogList');
  renderCatalogSyncStatus();
  if (products.length === 0) {
    list.innerHTML = `<div class="empty">${t('noProductsCatalog')}</div>`;
    return;
  }
  const preset = getNichePreset();
  const restaurant = isRestaurant();
  const catChoices = new Set(restaurant ? RESTAURANT_COURSES : (preset ? preset.categories : []));
  products.forEach(p => { if (p.category) catChoices.add(p.category); });
  const unitChoices = preset ? preset.units : ['piece', 'kg', 'g', 'liter', 'meter', 'set', 'box'];
  const tagChoices = preset ? preset.tags : [];

  list.innerHTML = products.map(p => {
    const imgSrc = editingProdImages[p.id] !== undefined ? editingProdImages[p.id] : (p.image || p.image_url);

    if (p.id === editingProductId) {
      const catOptionsHtml = ['<option value="">No category</option>']
        .concat(Array.from(catChoices).map(c => `<option value="${escapeAttr(c)}" ${p.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`)).join('');
      const unitOptionsHtml = ['<option value="">No unit</option>']
        .concat(unitChoices.map(u => `<option value="${escapeAttr(u)}" ${p.unit === u ? 'selected' : ''}>${escapeHtml(u)}</option>`)).join('');
      const editTagsHtml = tagChoices.length ? `
        <div class="niche-tags-picker" id="editTags-${p.id}">
          ${tagChoices.map(tag => {
            const checked = Array.isArray(p.tags) && p.tags.includes(tag);
            return `<label class="niche-tag-check ${checked ? 'checked' : ''}">
              <input type="checkbox" value="${escapeAttr(tag)}" ${checked ? 'checked' : ''} onchange="this.closest('label').classList.toggle('checked', this.checked)">${escapeHtml(tag)}
            </label>`;
          }).join('')}
        </div>` : '';
      const editModifiersHtml = restaurant ? `
        <input type="text" class="editModifiers" id="editModifiers-${p.id}" value="${escapeAttr((p.modifiers || []).join(', '))}" placeholder="Modifiers, comma-separated" style="margin-top:8px;">` : '';
      return `
        <div class="catalog-row-edit">
          <label class="img-upload-btn-sm" title="Change Image">
            <span id="editProdImgPreview-${p.id}">${imgSrc ? `<img src="${escapeAttr(imgSrc)}" class="thumb-img-sm" />` : '<svg class="icon icon-muted"><use href="#i-camera"/></svg>'}</span>
            <input type="file" id="editProdImgInput-${p.id}" accept="image/*" style="display:none;" onchange="handleEditProdImageSelect(event, '${p.id}')">
          </label>
          <input type="text" class="editName" id="editName-${p.id}" value="${escapeAttr(p.name)}">
          <input type="number" step="0.01" class="editPrice" id="editPrice-${p.id}" value="${fromMinorUnits(p.price)}">
          <select class="editCategory" id="editCategory-${p.id}">${catOptionsHtml}</select>
          <select class="editUnit" id="editUnit-${p.id}">${unitOptionsHtml}</select>
          <button class="save-edit" onclick="saveProductEdit('${p.id}')">${t('save')}</button>
          <button class="cancel-edit" onclick="cancelProductEdit()">${t('cancel')}</button>
          <label class="niche-tag-check" style="margin-top:8px; display:inline-flex;">
            <input type="checkbox" id="editMarketListed-${p.id}" ${p.marketplace_listed ? 'checked' : ''}>
            <span>${t('listOnMarketplace')}</span>
          </label>
          ${editTagsHtml}
          ${editModifiersHtml}
        </div>`;
    }

    const imgHtml = imgSrc 
      ? `<img src="${escapeAttr(imgSrc)}" class="cat-thumb-img" alt="${escapeAttr(p.name)}" title="Tap to view high-resolution photo" onclick="openProductImageModal('${p.id}')" />`
      : `<div class="cat-thumb-placeholder"><svg class="icon icon-muted"><use href="#i-camera"/></svg></div>`;

    const badges = [];
    if (p.category) badges.push(`<span class="prod-badge cat"><svg class="icon icon-sm"><use href="#i-tag"/></svg> ${escapeHtml(p.category)}</span>`);
    if (p.unit) badges.push(`<span class="prod-badge unit">${escapeHtml(p.unit)}</span>`);
    if (Array.isArray(p.tags)) p.tags.forEach(tag => badges.push(`<span class="prod-badge tag">${escapeHtml(tag)}</span>`));
    if (Array.isArray(p.modifiers)) p.modifiers.forEach(mod => badges.push(`<span class="prod-badge tag"><svg class="icon icon-sm"><use href="#i-edit"/></svg> ${escapeHtml(mod)}</span>`));
    if (p.marketplace_listed) badges.push(`<span class="prod-badge cat"><svg class="icon icon-sm"><use href="#i-store"/></svg> ${escapeHtml(t('marketListedBadge'))}</span>`);
    const badgesHtml = badges.length ? `<div class="prod-badges">${badges.join('')}</div>` : '';

    const canEdit = hasPermission(currentStaff ? currentStaff.role : 'owner', 'inventory:edit');
    const actionsHtml = canEdit
      ? `<button class="edit" onclick="startProductEdit('${p.id}')">${t('edit')}</button>
         <button class="remove" onclick="removeProduct('${p.id}')">${t('remove')}</button>`
      : '';

    return `
      <div class="catalog-row">
        <div class="cat-item-info">
          ${imgHtml}
          <div>
            <div class="cat-item-name">${escapeHtml(p.name)}</div>
            <div class="cat-item-price">${CS()}${formatMoney(p.price)}${p.unit ? ` / ${escapeHtml(p.unit)}` : ''}</div>
            ${badgesHtml}
          </div>
        </div>
        <span>
          ${actionsHtml}
        </span>
      </div>`;
  }).join('');
}

export function startProductEdit(id) {
  editingProductId = id;
  renderCatalog();
}

export function cancelProductEdit() {
  if (editingProductId) {
    delete editingProdImages[editingProductId];
  }
  editingProductId = null;
  renderCatalog();
}

export function saveProductEdit(id) {
  // Phase 3 fix (see modularization plan §5, Phase 3): editing a product
  // previously had no permission gate — the "Edit" button was already
  // hidden for roles without inventory:add (see applyRolePermissions), but
  // that only hid the button; the save function itself would happily run
  // for any role that reached it another way. Gated the same as
  // removeProduct, on inventory:edit.
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'inventory:edit')) return;
  const name = document.getElementById(`editName-${id}`).value.trim();
  // Phase 4 (validate on the way in): the price field is still entered in
  // major units (e.g. "19.99") — Number.isFinite rather than a bare isNaN
  // check also rejects Infinity/-Infinity, which isNaN() alone lets
  // through and toMinorUnits() would otherwise silently turn into 0.
  const priceMajor = parseFloat(document.getElementById(`editPrice-${id}`).value);
  if (!name || !Number.isFinite(priceMajor) || priceMajor < 0) {
    showToast(t('validNamePrice'));
    return;
  }
  const price = toMinorUnits(priceMajor);
  const catSel = document.getElementById(`editCategory-${id}`);
  const unitSel = document.getElementById(`editUnit-${id}`);
  const category = catSel ? catSel.value : '';
  const unit = unitSel ? unitSel.value : '';
  const tagsBox = document.getElementById(`editTags-${id}`);
  const tags = tagsBox ? Array.from(tagsBox.querySelectorAll('input[type="checkbox"]:checked')).map(el => el.value) : undefined;
  const modInput = document.getElementById(`editModifiers-${id}`);
  const modifiers = modInput ? modInput.value.split(',').map(m => m.trim()).filter(Boolean) : undefined;
  const marketListedBox = document.getElementById(`editMarketListed-${id}`);
  const marketplace_listed = marketListedBox ? marketListedBox.checked : undefined;

  const newImg = editingProdImages[id];
  setProducts(products.map(p => {
    if (p.id === id) {
      const updated = { ...p, name, price, _priceMinor: true, category: category || undefined, unit: unit || undefined, tags: (tags && tags.length) ? tags : undefined, modifiers: (modifiers && modifiers.length) ? modifiers : undefined, marketplace_listed, updated_at: Date.now() };
      if (newImg !== undefined) {
        updated.image = newImg;
        updated.image_url = newImg;
      }
      return updated;
    }
    return p;
  }));
  saveJSON(STORAGE_KEYS.products, products);
  markCatalogDirty();
  delete editingProdImages[id];
  editingProductId = null;
  renderAll();
  showToast(t('productUpdated'));
}

export let pendingNewProdTags = [];

export function renderProductFormSelects() {
  const catSel = document.getElementById('newProdCategory');
  const unitSel = document.getElementById('newProdUnit');
  const tagsBox = document.getElementById('newProdTagsContainer');
  const modInput = document.getElementById('newProdModifiers');
  if (!catSel || !unitSel) return;

  const restaurant = isRestaurant();
  if (modInput) modInput.style.display = restaurant ? 'block' : 'none';

  const preset = getNichePreset();
  const extraCats = new Set(products.map(p => p.category).filter(Boolean));
  const catOptions = ['<option value="">No category</option>'];
  const seenCats = new Set();
  (restaurant ? RESTAURANT_COURSES : (preset ? preset.categories : [])).concat(Array.from(extraCats)).forEach(c => {
    if (!c || seenCats.has(c)) return;
    seenCats.add(c);
    catOptions.push(`<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`);
  });
  catOptions.push('<option value="__custom__">+ New category…</option>');
  catSel.innerHTML = catOptions.join('');

  const defaultUnits = ['piece', 'kg', 'g', 'liter', 'meter', 'set', 'box'];
  const unitList = preset ? preset.units : defaultUnits;
  const unitOptions = ['<option value="">No unit</option>']
    .concat(unitList.map(u => `<option value="${escapeAttr(u)}">${escapeHtml(u)}</option>`));
  unitSel.innerHTML = unitOptions.join('');

  if (tagsBox) {
    if (!preset || !preset.tags || preset.tags.length === 0) {
      tagsBox.innerHTML = '';
    } else {
      tagsBox.innerHTML = preset.tags.map(tag => {
        const checked = pendingNewProdTags.includes(tag);
        return `<label class="niche-tag-check ${checked ? 'checked' : ''}">
          <input type="checkbox" value="${escapeAttr(tag)}" data-tag="${escapeAttr(tag)}" ${checked ? 'checked' : ''} onchange="toggleNewProdTag(this)">${escapeHtml(tag)}
        </label>`;
      }).join('');
    }
  }
}

// Takes the checkbox element, not a raw tag string — tags come from
// niche presets today but the same rendering pattern is used elsewhere
// for values that *do* arrive over the wire, and interpolating a value
// into an inline handler's JS string (as this used to:
// onchange="toggleNewProdTag('${tag}', this.checked)") breaks the
// moment that value contains a single quote, since escapeHtml() doesn't
// encode one. Reading tag + checked state off the element itself avoids
// the JS-string-escaping problem rather than relying on getting an
// inline-quoting escape right.
export function toggleNewProdTag(el, isCheckedArg) {
  const tag = typeof el === 'string' ? el : el.dataset.tag;
  const isChecked = typeof el === 'string' ? isCheckedArg : el.checked;
  if (isChecked) {
    if (!pendingNewProdTags.includes(tag)) pendingNewProdTags.push(tag);
  } else {
    pendingNewProdTags = pendingNewProdTags.filter(t => t !== tag);
  }
  renderProductFormSelects();
}

export function onNewProdCategoryChange() {
  const catSel = document.getElementById('newProdCategory');
  if (catSel && catSel.value === '__custom__') {
    const name = prompt('New category name:');
    if (name && name.trim()) {
      const opt = document.createElement('option');
      opt.value = name.trim();
      opt.textContent = name.trim();
      catSel.insertBefore(opt, catSel.lastElementChild);
      catSel.value = name.trim();
    } else {
      catSel.value = '';
    }
  }
}

export function addProduct() {
  // Phase 3 fix (see modularization plan §5, Phase 3): same gap as
  // saveProductEdit/removeProduct — the form itself was hidden for roles
  // without inventory:add, but adding a product was never actually
  // enforced at the point that writes to `products`.
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'inventory:add')) return;
  const nameInput = document.getElementById('newProdName');
  const priceInput = document.getElementById('newProdPrice');
  const catSel = document.getElementById('newProdCategory');
  const unitSel = document.getElementById('newProdUnit');
  const name = nameInput.value.trim();
  const priceMajor = parseFloat(priceInput.value);
  if (!name || !Number.isFinite(priceMajor) || priceMajor < 0) {
    showToast(t('validProdNamePrice'));
    return;
  }
  const price = toMinorUnits(priceMajor);
  const category = (catSel && catSel.value && catSel.value !== '__custom__') ? catSel.value : '';
  const unit = unitSel ? unitSel.value : '';
  const modInput = document.getElementById('newProdModifiers');
  const modifiers = (isRestaurant() && modInput && modInput.value.trim())
    ? modInput.value.split(',').map(m => m.trim()).filter(Boolean)
    : undefined;
  const marketListedBox = document.getElementById('newProdMarketListed');
  const newProd = {
    id: uid(),
    name,
    price,
    _priceMinor: true,
    category: category || undefined,
    unit: unit || undefined,
    tags: pendingNewProdTags.length ? [...pendingNewProdTags] : undefined,
    modifiers,
    image: pendingNewProdImage || undefined,
    image_url: pendingNewProdImage || undefined,
    marketplace_listed: marketListedBox ? marketListedBox.checked : false,
    updated_at: Date.now()
  };
  products.push(newProd);
  saveJSON(STORAGE_KEYS.products, products);
  markCatalogDirty();

  nameInput.value = ''; priceInput.value = '';
  if (modInput) modInput.value = '';
  if (marketListedBox) marketListedBox.checked = false;
  pendingNewProdImage = null;
  pendingNewProdTags = [];
  const previewBox = document.getElementById('newProdImgPreview');
  if (previewBox) previewBox.innerHTML = '<svg class="icon icon-muted"><use href="#i-camera"/></svg>';
  const fileInput = document.getElementById('newProdImgInput');
  if (fileInput) fileInput.value = '';

  renderAll();
}

export function removeProduct(id) {
  // Phase 3 fix (see modularization plan §5, Phase 3): this previously had
  // no permission gate at all — any role could remove a product. Gated on
  // inventory:edit (same permission that already governs stock adjustment).
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'inventory:edit')) return;
  if (!confirm('Remove this product from the catalog? This change will be included on the next sync.')) return;
  setProducts(products.filter(p => p.id !== id));
  saveJSON(STORAGE_KEYS.products, products);
  markCatalogDirty();
  delete currentOrder[id];
  delete currentOrderNotes[id];
  renderAll();
}
