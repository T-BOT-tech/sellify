// marketplace/cart.js
// Phase 6 extraction (see modularization plan §5): the marketplace cart
// (per-listing qty) and the sticky multi-vendor cart bar — moved out of
// main.js unchanged.
//
// NOTE on the ./listings.js import below: this is a harmless circular
// import — listings.js imports marketplaceCart/updateMultiCartBar from
// here for renderMarketplace(), and this file imports marketplaceListings
// back from listings.js to look up a listing by id. Neither call happens
// at module-evaluation time, only later from a click handler, by which
// point both modules have finished loading. Same pattern products/render.js
// documents for its own sibling modules.
import { marketplaceListings, renderMarketplace } from './listings.js';
import { formatMoney } from '../utils/money.js';

export let marketplaceCart = {}; // { listing_id: { listing, qty } }
export function setMarketplaceCart(next) { marketplaceCart = next; }

export function updateMarketCartQty(listingId, delta) {
  const listing = marketplaceListings.find(l => l.listing_id === listingId);
  if (!listing) return;

  if (!marketplaceCart[listingId]) {
    if (delta > 0) {
      marketplaceCart[listingId] = { listing, qty: delta };
    }
  } else {
    marketplaceCart[listingId].qty += delta;
    if (marketplaceCart[listingId].qty <= 0) {
      delete marketplaceCart[listingId];
    }
  }

  renderMarketplace();
}

export function updateMultiCartBar() {
  const bar = document.getElementById('multiCartBar');
  if (!bar) return;

  const entries = Object.values(marketplaceCart);
  if (entries.length === 0) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';
  const totalItems = entries.reduce((s, e) => s + e.qty, 0);
  const totalSum = entries.reduce((s, e) => s + (e.qty * e.listing.price), 0);
  const stalls = new Set(entries.map(e => e.listing.seller_name || e.listing.seller_id));
  const curr = entries[0] ? (entries[0].listing.currency || 'ETB') : 'ETB';

  document.getElementById('multiCartSummary').innerText = `${totalItems} item${totalItems === 1 ? '' : 's'} in cart`;
  document.getElementById('multiCartStalls').innerText = `Across ${stalls.size} vendor stall${stalls.size === 1 ? '' : 's'}`;
  document.getElementById('multiCartTotal').innerText = `${formatMoney(totalSum)} ${curr}`;
}
