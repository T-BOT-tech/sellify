// P1-IMPLEMENTATION-17 — Pack Accessibility & Localization UX.
// Read-only productization over the existing i18n and accessibility foundations.
// This module does not create a second locale, translation, or accessibility authority.
import { config } from '../state.js';
import { TRANSLATIONS } from '../i18n/translations.js';
import { getLang, t } from '../ui/i18n.js';

const RTL_LANGUAGES = Object.freeze(['ar', 'fa', 'he', 'ur']);
const PACK_SURFACES = Object.freeze([
  'packEntitlementPanel', 'packReadinessPanel', 'packRecoveryPanel',
  'packAuditPanel', 'packSecurityPanel', 'roleAccessPanel',
  'rolePermissionMatrixPanel', 'scopeContextPanel', 'conditionsApprovalPanel',
  'approvalDelegationPanel', 'iamCertificationPanel', 'membershipAdministrationPanel'
]);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function localeLanguage(value) {
  return String(value || 'en').toLowerCase().replace('_', '-').split('-')[0];
}

function applySemanticAccessibility() {
  PACK_SURFACES.forEach(id => {
    const panel = document.getElementById(id);
    if (!panel) return;
    panel.setAttribute('aria-live', 'polite');
    panel.querySelectorAll('.status').forEach(status => {
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
    });
    panel.querySelectorAll('table').forEach(table => {
      table.setAttribute('role', 'table');
      table.querySelectorAll('thead th').forEach(th => th.setAttribute('scope', 'col'));
    });
    panel.querySelectorAll('button, a').forEach(control => {
      if (!control.getAttribute('aria-label') && !control.textContent.trim()) {
        control.setAttribute('aria-label', 'Action');
      }
    });
  });
}

function contract() {
  const lang = getLang();
  const language = localeLanguage(lang);
  const supported = Object.keys(TRANSLATIONS);
  const direction = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
  return Object.freeze({
    authority: 'app/src/ui/i18n.js + app/src/i18n/translations.js',
    accessibilityAuthority: 'existing semantic HTML / ARIA foundations',
    locale: lang,
    language,
    direction,
    supportedLocales: supported,
    translationFallback: 'en',
    packSurfaces: PACK_SURFACES,
    authenticatedSession: Boolean(config.sessionToken && config.chatId),
  });
}

export function renderPackAccessibilityLocalizationPanel(containerId = 'packAccessibilityLocalizationPanel') {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  const c = contract();
  applySemanticAccessibility();

  const checks = [
    ['Document language', document.documentElement.lang === c.locale],
    ['Pack/IAM live regions', PACK_SURFACES.filter(id => document.getElementById(id)?.getAttribute('aria-live') === 'polite').length === PACK_SURFACES.filter(id => document.getElementById(id)).length],
    ['Table column semantics', [...document.querySelectorAll('#packAuditPanel table thead th, #packSecurityPanel table thead th')].every(th => th.getAttribute('scope') === 'col')],
  ];
  const passed = checks.filter(([, ok]) => ok).length;

  wrap.innerHTML = `
    <section class="settings-section" aria-labelledby="pack-accessibility-localization-title">
      <h3 id="pack-accessibility-localization-title">${esc(t('packAccessibilityLocalizationTitle'))}</h3>
      <div class="hint">${esc(t('packAccessibilityLocalizationHint'))}</div>
      <dl class="settings-definition-list">
        <dt>${esc(t('activeLanguage'))}</dt><dd><code>${esc(c.locale)}</code></dd>
        <dt>${esc(t('textDirection'))}</dt><dd><code>${esc(c.direction)}</code></dd>
        <dt>${esc(t('supportedLocales'))}</dt><dd>${c.supportedLocales.map(esc).join(', ')}</dd>
        <dt>${esc(t('translationFallback'))}</dt><dd><code>${esc(c.translationFallback)}</code></dd>
      </dl>
      <div class="status" role="status" aria-live="polite">${esc(t('accessibilityChecks'))}: ${passed}/${checks.length} ${esc(t('checksPassing'))}</div>
      <ul aria-label="${esc(t('accessibilityChecks'))}">
        ${checks.map(([label, ok]) => `<li>${ok ? '✓' : '⚠'} ${esc(label)} — ${esc(ok ? t('pass') : t('review'))}</li>`).join('')}
      </ul>
      <div class="hint">${esc(t('packLocalizationAuthority'))}: <code>${esc(c.authority)}</code>. ${esc(t('packAccessibilityAuthority'))}: <code>${esc(c.accessibilityAuthority)}</code>.</div>
      <div class="hint">${esc(t('packAccessibilityBoundary'))}</div>
    </section>`;
  applySemanticAccessibility();
}
