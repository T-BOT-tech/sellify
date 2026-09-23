// i18n/translations.js
// Combines the per-locale data files into the same TRANSLATIONS shape the
// rest of the app already expects (TRANSLATIONS[lang][key]).
//
// Phase 1 note: this file — and everything under i18n/locales/ — is pure
// data with zero dependencies, which is why it's safe to extract this early.
// The *behavioral* i18n helpers (getLang, t, changeLanguage, updateI18n)
// stay in main.js for now: they read/write `config` (state) and call
// renderAll(), so they belong with state.js in a later phase, not here.

import en from './locales/en.js';
import am from './locales/am.js';
import om from './locales/om.js';
import so from './locales/so.js';
import sw from './locales/sw.js';
import es from './locales/es.js';
import hi from './locales/hi.js';

export const TRANSLATIONS = { en, am, om, so, sw, es, hi };
