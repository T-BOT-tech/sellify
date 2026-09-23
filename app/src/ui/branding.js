// ui/branding.js
// Phase 7 extraction (see modularization plan §5): the "Dynamic Store Theme
// & Branding Engine" that applies a remote-catalog-supplied branding
// payload (colors, logo, name, currency, language) — moved out of main.js
// unchanged. This is distinct from theme/branding.js's Theme controller
// (light/dark/sunlight mode + Telegram theme ingestion) — that one governs
// the merchant's own theme choice; this one is what a synced catalog can
// push onto the storefront.
import { STORAGE_KEYS } from '../constants.js';
import { config } from '../state.js';
import { saveJSON } from '../storage/json.js';
import { changeLanguage } from './i18n.js';

export function applyStoreBranding(branding) {
  if (!branding || typeof branding !== 'object') return;

  // 1. CSS Custom Properties
  if (branding.primary_color) {
    document.documentElement.style.setProperty('--teal', branding.primary_color);
    document.documentElement.style.setProperty('--primary-color', branding.primary_color);
    document.documentElement.style.setProperty('--amber', branding.primary_color);
  }

  // 2. Header Title & Brand
  if (branding.business_name) {
    const brandEl = document.querySelector('.statusbar .brand');
    if (brandEl) {
      let titleSpan = brandEl.querySelector('.brand-title-text');
      if (!titleSpan) {
        titleSpan = document.createElement('span');
        titleSpan.className = 'brand-title-text';
        brandEl.prepend(titleSpan);
      }
      titleSpan.textContent = branding.business_name + ' ';
    }
  }

  // 3. Logo Image
  if (branding.logo_url) {
    let logoImg = document.getElementById('storefrontLogo');
    if (!logoImg) {
      logoImg = document.createElement('img');
      logoImg.id = 'storefrontLogo';
      logoImg.style.width = '24px';
      logoImg.style.height = '24px';
      logoImg.style.borderRadius = '50%';
      logoImg.style.objectFit = 'cover';
      logoImg.style.marginRight = '8px';
      logoImg.style.verticalAlign = 'middle';
      const brandEl = document.querySelector('.statusbar .brand');
      if (brandEl) brandEl.prepend(logoImg);
    }
    logoImg.src = branding.logo_url;
  }

  // 4. Currency Symbol (remote catalog can set the store's currency; local Settings override still wins if user customized it)
  if (branding.currency) {
    window.STORE_CURRENCY = branding.currency;
    if (!config.currencySymbol) {
      config.currencyCode = branding.currency;
      saveJSON(STORAGE_KEYS.config, config);
    }
  }

  // 5. Language Localization
  if (branding.language) {
    const langSelect = document.getElementById('setLang');
    if (langSelect && langSelect.value !== branding.language) {
      langSelect.value = branding.language;
      changeLanguage(branding.language); // was calling a never-defined setLang() — the select's id, "setLang", isn't a function name
    }
  }
}
