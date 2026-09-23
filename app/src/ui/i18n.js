// ui/i18n.js
// Phase 7 extraction (see modularization plan §5): the language/translation
// helpers — moved out of main.js unchanged. renderAll() is imported from
// ui/render.js for changeLanguage()'s re-render; render.js calls back into
// updateI18n() here, which is fine since both are only ever invoked from
// inside a function body, never at module-init time.
import { TRANSLATIONS } from '../i18n/translations.js';
import { STORAGE_KEYS } from '../constants.js';
import { config } from '../state.js';
import { saveJSON } from '../storage/json.js';
import { renderAll } from './render.js';

export function getLang() {
  return config.lang || 'en';
}

export function t(key) {
  const lang = getLang();
  if (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) {
    return TRANSLATIONS[lang][key];
  }
  if (TRANSLATIONS['en'] && TRANSLATIONS['en'][key]) {
    return TRANSLATIONS['en'][key];
  }
  return key;
}

export function changeLanguage(lang) {
  config.lang = lang;
  saveJSON(STORAGE_KEYS.config, config);
  updateI18n();
  renderAll();
}

export function updateI18n() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = t(key);
  });
  const headerSelect = document.getElementById('headerLangSelect');
  if (headerSelect) headerSelect.value = lang;
  const setSelect = document.getElementById('setLang');
  if (setSelect) setSelect.value = lang;
}
