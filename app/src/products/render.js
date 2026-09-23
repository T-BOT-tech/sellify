// products/render.js
// Phase 4 extraction (see modularization plan §5): the product-grid/list
// rendering path (renderProducts, its price/stock badge markup, and the
// single-card DOM patch used by the quantity stepper) moved out of main.js
// unchanged.
//
// NOTE on the circular imports below (./search-filter.js and
// ../orders/cart.js): renderProducts() calls renderCategoryPills() and
// updateOrderSummary(), while search-filter.js's handlers and orders/cart.js's
// changeQty()/updateOrderSummary() call back into renderProducts()/
// patchProductCard() here. This is a genuine mutual dependency between the
// product grid and (a) its own filter UI and (b) the cart it feeds — not an
// accident of the split. ES modules handle it fine: none of these calls
// happen at module-evaluation time, only later from render/event-handler
// code, by which point both modules have finished loading. See
// modularization plan §4 for when this kind of cross-feature import is the
// right call versus a sign to merge two folders.
import { CS } from '../config/currency.js';
import { formatMoney } from '../utils/money.js';
import { isRestaurant } from '../config/niche.js';
import { escapeHtml, escapeAttr } from '../utils/index.js';
import { STORAGE_KEYS } from '../constants.js';
import { products, currentOrder, orderViewMode, setOrderViewModeValue } from '../state.js';
import { saveJSON } from '../storage/json.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { effectiveUnitPrice } from '../b2b/pricing.js';
import { t } from '../ui/i18n.js';
import { isStockTracked } from '../warehouse/inventory.js';
import { searchQuery, activeCategory, renderCategoryPills } from './search-filter.js';
import { modifierNoteMarkup } from './modifiers.js';
import { editingProdImages } from './catalog.js';
import { updateOrderSummary } from '../orders/cart.js';

export function setOrderViewMode(mode) {
  setOrderViewModeValue(mode);
  saveJSON(STORAGE_KEYS.orderViewMode, mode);
  updateViewToggleButtons();
  renderProducts();
}

export function updateViewToggleButtons() {
  const btnList = document.getElementById('btnViewList');
  const btnGrid = document.getElementById('btnViewGrid');
  if (btnList && btnGrid) {
    if (orderViewMode === 'grid') {
      btnGrid.classList.add('active');
      btnList.classList.remove('active');
    } else {
      btnList.classList.add('active');
      btnGrid.classList.remove('active');
    }
  }
}

export function renderProducts() {
  renderCategoryPills();
  updateViewToggleButtons();
  const list = document.getElementById('productList');
  if (!list) return;

  if (orderViewMode === 'grid') {
    list.classList.add('grid-view');
  } else {
    list.classList.remove('grid-view');
  }

  if (products.length === 0) {
    list.innerHTML = `<div class="empty">${t('noProducts')}</div>`;
    updateOrderSummary();
    return;
  }

  let filtered = products.filter(p => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery);
    const matchesCat = activeCategory === 'ALL' || p.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty">${t('noProducts')}</div>`;
    updateOrderSummary();
    return;
  }

  const restaurant = isRestaurant();

  if (orderViewMode === 'grid') {
    list.innerHTML = filtered.map(p => {
      const qty = currentOrder[p.id] || 0;
      const imgSrc = (editingProdImages && editingProdImages[p.id]) || p.image || p.image_url;
      const imgHtml = imgSrc 
        ? `<img src="${escapeAttr(imgSrc)}" class="grid-prod-img" alt="${escapeAttr(p.name)}" />`
        : `<div class="grid-prod-img-placeholder"><svg class="icon icon-lg icon-muted"><use href="#i-box"/></svg></div>`;
      const qtyBadge = qty > 0 ? `<div class="grid-prod-badge-qty">${qty}</div>` : '';
      const stockBadge = stockBadgeMarkup(p, 'dot');
      const modifierHtml = (restaurant && Array.isArray(p.modifiers) && p.modifiers.length) ? modifierNoteMarkup(p) : '';
      const priceHtml = productPriceMarkup(p, qty);

      return `
        <div class="grid-prod-card ${qty > 0 ? 'has-qty' : ''}" id="prodCard-${p.id}">
          <div class="grid-prod-img-wrap" title="Tap to view high-resolution photo" onclick="openProductImageModal('${p.id}')">
            ${imgHtml}
            ${qtyBadge}
            ${stockBadge}
          </div>
          <div class="grid-prod-body">
            <div>
              <div class="grid-prod-name" title="${escapeAttr(p.name)}">${escapeHtml(p.name)}</div>
              <div class="grid-prod-price">${priceHtml}${p.unit ? `<span style="opacity:0.6;"> / ${escapeHtml(p.unit)}</span>` : ''}</div>
              ${modifierHtml}
            </div>
            <div class="grid-prod-stepper">
              <button type="button" onclick="changeQty('${p.id}', -1)" aria-label="Decrease quantity">−</button>
              <span class="qty">${qty}</span>
              <button type="button" onclick="changeQty('${p.id}', 1)" aria-label="Increase quantity">+</button>
            </div>
          </div>
        </div>`;
    }).join('');
  } else {
    list.innerHTML = filtered.map(p => {
      const qty = currentOrder[p.id] || 0;
      const imgSrc = (editingProdImages && editingProdImages[p.id]) || p.image || p.image_url;
      const imgHtml = imgSrc 
        ? `<img src="${escapeAttr(imgSrc)}" class="prod-thumb" alt="${escapeAttr(p.name)}" title="Tap to view high-resolution photo" onclick="openProductImageModal('${p.id}')" />`
        : `<div class="prod-thumb-placeholder"><svg class="icon icon-muted"><use href="#i-box"/></svg></div>`;
      const modifierHtml = (restaurant && Array.isArray(p.modifiers) && p.modifiers.length) ? modifierNoteMarkup(p) : '';
      const priceHtml = productPriceMarkup(p, qty);

      return `
        <div class="product-row" id="prodRow-${p.id}">
          <div class="product-main">
            ${imgHtml}
            <div class="info">
              <div class="pname">${escapeHtml(p.name)}</div>
              <div class="pprice">${priceHtml}${p.unit ? ` / ${escapeHtml(p.unit)}` : ''}${stockBadgeMarkup(p, 'text')}</div>
              ${modifierHtml}
            </div>
          </div>
          <div class="stepper">
            <button onclick="changeQty('${p.id}', -1)">−</button>
            <span class="qty">${qty}</span>
            <button onclick="changeQty('${p.id}', 1)">+</button>
          </div>
        </div>`;
    }).join('');
  }
  updateOrderSummary();
}

export function productPriceMarkup(p, qty) {
  const effective = effectiveUnitPrice(p, qty);
  if (effective === p.price) return `${CS()}${formatMoney(p.price)}`;
  return `<span class="tier-price-orig">${CS()}${formatMoney(p.price)}</span>${CS()}${formatMoney(effective)}`;
}

export function stockBadgeMarkup(p, kind) {
  if (!isStockTracked(p)) return '';
  const out = p.stock <= 0;
  const low = !out && p.stock <= (p.reorder_point || 0);
  if (!out && !low) return '';
  const cls = out ? 'out' : 'low';
  if (kind === 'text') {
    const label = out ? t('whOutOfStock') || 'Out' : t('whLowStock') || 'Low';
    return `<span class="pstock ${cls}">${escapeHtml(label)}</span>`;
  }
  const label = out ? '0' : String(p.stock);
  return `<div class="grid-prod-badge-stock ${cls}">${escapeHtml(label)}</div>`;
}

export function patchProductCard(productId) {
  const p = products.find(pr => pr.id === productId);
  if (!p) { renderProducts(); return; }
  const qty = currentOrder[productId] || 0;
  const priceHtml = productPriceMarkup(p, qty);

  const gridCard = document.getElementById('prodCard-' + productId);
  if (gridCard) {
    gridCard.classList.toggle('has-qty', qty > 0);
    const imgWrap = gridCard.querySelector('.grid-prod-img-wrap');
    let badge = imgWrap ? imgWrap.querySelector('.grid-prod-badge-qty') : null;
    if (qty > 0) {
      if (!badge && imgWrap) {
        badge = document.createElement('div');
        badge.className = 'grid-prod-badge-qty';
        imgWrap.appendChild(badge);
      }
      if (badge) badge.textContent = qty;
    } else if (badge) {
      badge.remove();
    }
    const priceEl = gridCard.querySelector('.grid-prod-price');
    if (priceEl) {
      const unitSuffix = p.unit ? `<span style="opacity:0.6;"> / ${escapeHtml(p.unit)}</span>` : '';
      priceEl.innerHTML = priceHtml + unitSuffix;
    }
    const qtyEl = gridCard.querySelector('.grid-prod-stepper .qty');
    if (qtyEl) qtyEl.textContent = qty;
    return;
  }

  const row = document.getElementById('prodRow-' + productId);
  if (row) {
    const priceEl = row.querySelector('.pprice');
    if (priceEl) {
      const unitSuffix = p.unit ? ` / ${escapeHtml(p.unit)}` : '';
      priceEl.innerHTML = priceHtml + unitSuffix;
    }
    const qtyEl = row.querySelector('.stepper .qty');
    if (qtyEl) qtyEl.textContent = qty;
    return;
  }

  // Card not found in the current DOM — fall back to a full render.
  renderProducts();
}
