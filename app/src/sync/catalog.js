// sync/catalog.js
// Phase 5 extraction (see modularization plan §5): the trust-boundary
// sanitizers for anything arriving from a synced catalog/marketplace feed,
// plus the two catalog-facing network calls (push-and-merge via syncCatalog,
// background pull via fetchRemoteCatalogAndBranding) — moved out of main.js
// unchanged. sanitizeRemoteListings stays exported from here even though its
// only current caller (fetchMarketplaceListings) still lives in main.js —
// that call site moves to marketplace/*.js in Phase 6, at which point it
// will import straight from this file instead of re-exporting through
// main.js.
import { uid } from '../utils/index.js';
import { STORAGE_KEYS } from '../constants.js';
import { config, products, setProducts } from '../state.js';
import { saveJSON } from '../storage/json.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { applyStoreBranding } from '../ui/branding.js';
import { t } from '../ui/i18n.js';
import { renderAll } from '../ui/render.js';
import { markCatalogSynced } from '../products/catalog.js';
import { authHeaders as tenantAuthHeaders } from '../auth/tenant.js';

// IDs are meant to be opaque identifiers (not markup), so restricting them to a
// safe character set at the point they enter the app removes injection risk at
// the source — simpler and more robust than re-escaping every place an id later
// gets interpolated into an onclick="..." handler throughout the app (which needs
// both JS-string and HTML-attribute escaping done correctly together, and is easy
// to get subtly wrong in just one of the many call sites).
// Image URLs are handled differently: they're also assigned directly to an
// <img>.src property elsewhere (openImageModal), a path that's never HTML-decoded,
// so pre-escaping here would corrupt any legitimate URL containing "&" — i.e.
// almost any URL with a query string. Image URLs are escaped only where they're
// template-string-inserted into src="...", via escapeAttr() (utils/index.js).
export function sanitizeId(raw) {
  const cleaned = String(raw == null ? '' : raw).replace(/[^a-zA-Z0-9_\-.]/g, '').slice(0, 128);
  return cleaned || uid();
}
export function sanitizeRemoteProducts(rawList) {
  return (Array.isArray(rawList) ? rawList : []).map(p => {
    const numericPrice = Number(p.price);
    return {
      ...p,
      id: sanitizeId(p.id),
      // Coerced to a real number: besides keeping totals/arithmetic sane if a
      // synced catalog sends a malformed price, an unescaped non-numeric price
      // would otherwise be inserted as raw text content wherever it's displayed.
      // Phase 4: also rounded to a whole integer — this app stores every price
      // as integer minor units (see utils/money.js); a remote catalog sending
      // a fractional value (a stale pre-migration client, or a hand-edited
      // JSON file) must not be allowed to introduce fractional-minor-unit
      // drift into local arithmetic.
      price: Number.isFinite(numericPrice) ? Math.max(0, Math.round(numericPrice)) : 0,
      _priceMinor: true,
    };
  });
}
export function sanitizeRemoteListings(rawList) {
  return (Array.isArray(rawList) ? rawList : []).map(l => {
    const numericPrice = Number(l.price);
    return {
      ...l,
      listing_id: l.listing_id !== undefined ? sanitizeId(l.listing_id) : l.listing_id,
      price: Number.isFinite(numericPrice) ? Math.max(0, Math.round(numericPrice)) : 0
    };
  });
}

export async function fetchRemoteCatalogAndBranding() {
  if (!config.syncUrl || !config.chatId) return;
  try {
    const res = await fetch(`${config.syncUrl.replace(/\/$/, '')}/catalog/${config.chatId}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.products && data.products.length) {
      setProducts(sanitizeRemoteProducts(data.products));
      saveJSON(STORAGE_KEYS.products, products);
      markCatalogSynced();
      renderAll();
    }
    if (data.branding) {
      applyStoreBranding(data.branding);
    }
    if (data.seller_name && !config.sellerName) {
      config.sellerName = data.seller_name;
      saveJSON(STORAGE_KEYS.config, config);
    }
  } catch (e) {
    console.log('Offline/Network unavailable for background catalog fetch:', e);
  }
}

export async function syncCatalog() {
  try {
    const res = await fetch(`${config.syncUrl.replace(/\/$/, '')}/catalog/${config.chatId}`, {
      method: 'POST',
      // Seller catalog writes use the tenant-scoped device session.
      // The PWA never sends a tenant-wide API key.
      headers: { 'Content-Type': 'application/json', ...tenantAuthHeaders() },
      body: JSON.stringify({ products }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.code === 'CATALOG_STOCK_CONFLICT' || res.status === 409 && data.error?.code === 'CATALOG_STOCK_CONFLICT') {
      if (Array.isArray(data.products)) {
        setProducts(sanitizeRemoteProducts(data.products));
        saveJSON(STORAGE_KEYS.products, products);
        markCatalogSynced();
        renderAll();
      }
      throw new Error('Catalog changed on another device. Your local catalog was refreshed; review your changes before saving again.');
    }
    if (!res.ok) throw new Error(`Server responded ${res.status}`);


    if (data.branding) {
      applyStoreBranding(data.branding);
    }

    setProducts(data.products ? sanitizeRemoteProducts(data.products) : products);
    saveJSON(STORAGE_KEYS.products, products);
    markCatalogSynced();
    renderAll();
    return t('catalogSyncedMsg');
  } catch (e) {
    console.error(e);
    return t('catalogSyncFailed');
  }
}
