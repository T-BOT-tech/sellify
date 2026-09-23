// products/search-filter.js
// Phase 4 extraction (see modularization plan §5): product-list search box
// and category-pill filtering, moved out of main.js unchanged. searchQuery /
// activeCategory are the two pieces of local filter state — owned here and
// exported as live bindings (only this module ever reassigns them), the
// same pattern state.js established for the app-wide singletons in Rule 1.
//
// NOTE on the `../main.js` import below and the `./render.js` one: this is
// mutually recursive with products/render.js (renderProducts() lives there
// and calls back into renderCategoryPills() here) — a real coupling, not an
// accident. See products/render.js for the fuller explanation; ES modules
// handle this fine since neither side calls the other at module-evaluation
// time, only later from event handlers.
import { escapeHtml, escapeAttr } from '../utils/index.js';
import { products } from '../state.js';
import { getNichePreset } from '../config/niche.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { t } from '../ui/i18n.js';
import { renderProducts } from './render.js';

export let searchQuery = '';
export let activeCategory = 'ALL';

export function onSearchInput(val) {
  searchQuery = val.trim().toLowerCase();
  const clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) clearBtn.style.display = searchQuery ? 'block' : 'none';
  renderProducts();
}

export function clearSearch() {
  searchQuery = '';
  const input = document.getElementById('productSearchInput');
  if (input) input.value = '';
  const clearBtn = document.getElementById('clearSearchBtn');
  if (clearBtn) clearBtn.style.display = 'none';
  renderProducts();
}

// Takes the clicked pill element, not a raw category string — a category
// comes from product data, which can arrive via catalog sync, so it isn't
// safe to interpolate into an inline handler's JS string (escapeHtml()
// doesn't encode a bare single quote, which is all it'd take to break out
// of onclick="...('...')" and run arbitrary script). Reading it off a
// data-* attribute instead avoids the JS-string-escaping problem rather
// than trying to solve it inline. `typeof el === 'string'` keeps this
// backward-compatible for any future programmatic caller that already has
// a plain category string in hand.
export function setCategory(el) {
  activeCategory = typeof el === 'string' ? el : el.dataset.cat;
  renderCategoryPills();
  renderProducts();
}

export function renderCategoryPills() {
  const container = document.getElementById('categoryPillsContainer');
  if (!container) return;
  const categoriesSet = new Set(['ALL']);
  const preset = getNichePreset();
  if (preset) {
    preset.categories.forEach(c => categoriesSet.add(c));
  }
  products.forEach(p => {
    if (p.category) categoriesSet.add(p.category);
  });
  const categories = Array.from(categoriesSet);

  if (categories.length <= 1) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = categories.map(cat => {
    const label = cat === 'ALL' ? t('allCategories') : cat;
    const isActive = activeCategory === cat;
    return `<button type="button" class="cat-pill ${isActive ? 'active' : ''}" data-cat="${escapeAttr(cat)}" onclick="setCategory(this)">${escapeHtml(label)}</button>`;
  }).join('');
}
