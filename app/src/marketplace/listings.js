// marketplace/listings.js
// Phase 6 extraction (see modularization plan §5): the "Global Hybrid
// Marketplace Client Engine" — cached/fetched listings, search/category
// filtering, and the marketplace product grid — moved out of main.js
// unchanged.
//
// NOTE on the ../sync/catalog.js import: sanitizeRemoteListings is a
// trust-boundary sanitizer for anything arriving from a synced feed. It
// already lived in sync/catalog.js as of Phase 5 (its only caller,
// fetchMarketplaceListings, was still in main.js at the time — see that
// file's note). This is the same category of narrow, explicit cross-layer
// import the plan's §4 describes (sync/ sits alongside storage/ as
// data-layer code every feature may call into), not a feature-to-feature
// reach-in.
import { config } from '../state.js';
import { escapeHtml, escapeAttr } from '../utils/index.js';
import { formatMoney } from '../utils/money.js';
import { loadJSON, saveJSON } from '../storage/json.js';
import { sanitizeRemoteListings } from '../sync/catalog.js';
import { marketplaceCart, updateMultiCartBar } from './cart.js';

// Phase 4: seed/fallback prices below are in integer minor units (birr
// cents), matching the convention every product/order price in the app
// now uses (see utils/money.js) — 12000 = 120.00 ETB, not 12000 ETB. This
// is only ever shown until the first real fetchMarketplaceListings() call
// replaces it with the server's own (also minor-unit) catalog data.
export let marketplaceListings = loadJSON('ledger_marketplace_listings', [
  { listing_id: '123456789_1', seller_id: '123456789', item_id: '1', title: 'Yirgacheffe Pour-Over', price: 12000, currency: 'ETB', category: 'Coffee', seller_name: 'Blue Nile Coffee Roasters', vendor_code: 'SC1001', is_available: true },
  { listing_id: '123456789_2', seller_id: '123456789', item_id: '2', title: 'Sidama Washed Beans (250g)', price: 45000, currency: 'ETB', category: 'Coffee', seller_name: 'Blue Nile Coffee Roasters', vendor_code: 'SC1001', is_available: true },
  { listing_id: '987654321_1', seller_id: '987654321', item_id: '1', title: 'Handwoven Habesha Shawl', price: 85000, currency: 'ETB', category: 'Apparel', seller_name: 'Addis Artisan Crafts', vendor_code: 'SC2002', is_available: true },
  { listing_id: '987654321_2', seller_id: '987654321', item_id: '2', title: 'Hand-Carved Clay Incense Burner', price: 30000, currency: 'ETB', category: 'Crafts', seller_name: 'Addis Artisan Crafts', vendor_code: 'SC2002', is_available: true },
  { listing_id: '555444333_1', seller_id: '555444333', item_id: '1', title: 'Raw Organic Forest Honey (500g)', price: 38000, currency: 'ETB', category: 'Food', seller_name: 'Bale Mountain Botanicals', vendor_code: 'SC3003', is_available: true }
]);
function setMarketplaceListings(next) { marketplaceListings = next; }

let marketSearchQuery = '';
let marketActiveCategory = 'ALL';

export async function fetchMarketplaceListings() {
  const syncBase = config.syncUrl || window.location.origin;
  try {
    const res = await fetch(`${syncBase.replace(/\/$/, '')}/api/marketplace/search`);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length) {
        setMarketplaceListings(sanitizeRemoteListings(data.results));
        saveJSON('ledger_marketplace_listings', marketplaceListings);
        renderMarketplace();
      }
    }
  } catch (e) {
    console.log('[Marketplace] Offline mode — using cached marketplace listings:', e);
  }
}

export function onMarketSearchInput(val) {
  marketSearchQuery = (val || '').trim().toLowerCase();
  const clearBtn = document.getElementById('clearMarketSearchBtn');
  if (clearBtn) clearBtn.style.display = marketSearchQuery ? 'block' : 'none';
  renderMarketplace();
}

export function clearMarketSearch() {
  const input = document.getElementById('marketSearchInput');
  if (input) input.value = '';
  marketSearchQuery = '';
  const clearBtn = document.getElementById('clearMarketSearchBtn');
  if (clearBtn) clearBtn.style.display = 'none';
  renderMarketplace();
}

// Takes the clicked pill element (not a raw category string) — see the
// button markup below for why. A category value comes from marketplace
// listing data (potentially another seller's, over the wire), so it
// can't be trusted to interpolate into an inline handler's JS string:
// escapeHtml() only encodes &, <, > (safe for HTML text/attribute
// content) but not a bare single quote, so a category containing one
// could break out of the onclick="...('...')" string and run arbitrary
// script. Reading it back off a data-* attribute (itself escaped for
// the *attribute* context via escapeAttr, not escapeHtml) sidesteps the
// JS-string-escaping problem entirely instead of trying to get it right
// inline.
export function setMarketCategory(el) {
  marketActiveCategory = typeof el === 'string' ? el : el.dataset.cat;
  renderMarketplace();
}

export function renderMarketplace() {
  const container = document.getElementById('marketProductList');
  const pillsContainer = document.getElementById('marketCategoryPills');
  if (!container) return;

  // Render Category Pills
  if (pillsContainer) {
    const categories = ['ALL', ...new Set(marketplaceListings.map(l => l.category || 'General'))];
    pillsContainer.innerHTML = categories.map(cat => `
      <button type="button" class="cat-pill ${marketActiveCategory === cat ? 'active' : ''}" data-cat="${escapeAttr(cat)}" onclick="setMarketCategory(this)">
        ${escapeHtml(cat)}
      </button>
    `).join('');
  }

  // Filter listings
  let filtered = marketplaceListings.filter(item => {
    if (marketActiveCategory !== 'ALL' && (item.category || 'General').toLowerCase() !== marketActiveCategory.toLowerCase()) {
      return false;
    }
    if (marketSearchQuery) {
      const matchTitle = (item.title || '').toLowerCase().includes(marketSearchQuery);
      const matchCat = (item.category || '').toLowerCase().includes(marketSearchQuery);
      const matchSeller = (item.seller_name || '').toLowerCase().includes(marketSearchQuery);
      const matchCode = (item.vendor_code || '').toLowerCase().includes(marketSearchQuery);
      if (!matchTitle && !matchCat && !matchSeller && !matchCode) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty">
        <svg class="icon"><use href="#i-search"/></svg> No items found matching "${escapeHtml(marketSearchQuery || marketActiveCategory)}"<br>
        <small style="opacity:0.7;">Try searching for "coffee", "craft", or switch category.</small>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const inCart = marketplaceCart[item.listing_id];
    const qty = inCart ? inCart.qty : 0;
    const curr = item.currency || 'ETB';
    const sName = item.seller_name || 'Community Stall';
    const vCode = item.vendor_code || item.seller_id;

    return `
      <div class="product-row" style="flex-direction:column; align-items:stretch; gap:8px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <div style="font-weight:700; font-size:15px; color:var(--ink);">${escapeHtml(item.title)}</div>
            <div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
              <span class="stall-badge"><svg class="icon icon-sm"><use href="#i-store"/></svg> ${escapeHtml(sName)} (${escapeHtml(vCode)})</span>
              <span style="font-size:11px; opacity:0.7;">${escapeHtml(item.category || 'General')}</span>
            </div>
          </div>
          <div style="font-family:var(--mono); font-weight:700; font-size:15px; color:var(--teal); text-align:right;">
            ${formatMoney(item.price)} ${escapeHtml(curr)}
          </div>
        </div>
        <div style="display:flex; justify-content:flex-end; align-items:center; border-top:1px dashed var(--line); padding-top:6px;">
          <div class="stepper">
            <button type="button" onclick="updateMarketCartQty('${item.listing_id}', -1)">−</button>
            <span class="qty">${qty}</span>
            <button type="button" onclick="updateMarketCartQty('${item.listing_id}', 1)">+</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  updateMultiCartBar();
}
