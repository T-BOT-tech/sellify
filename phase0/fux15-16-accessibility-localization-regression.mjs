import assert from 'node:assert/strict';
import { TRANSLATIONS } from '../app/src/i18n/translations.js';
import {
  createAccessibilityContract,
  createLocalizationContract,
  getTextDirection,
  summarizeAccessibility,
} from '../app/src/experience/accessibility-localization-contract.js';

const accessibility = createAccessibilityContract({
  checks: {
    keyboard: 'PASS',
    screenReader: 'PASS',
    focus: 'PASS',
    contrast: 'PASS',
    touchTargets: 'PASS',
    statusSemantics: 'PASS',
    motion: 'PASS',
  },
});
assert.deepEqual(summarizeAccessibility(accessibility), { total: 7, passed: 7, review: 0, notApplicable: 0 });
assert.equal(accessibility.authority, 'existing semantic HTML / ARIA foundations');
assert.equal(accessibility.serverEnforcement, 'canonical authorization authority');

const localization = createLocalizationContract({
  locale: 'en',
  supportedLocales: Object.keys(TRANSLATIONS),
});
assert.equal(localization.direction, 'ltr');
assert.equal(localization.translationFallback, 'en');
assert.equal(localization.rtlReady, true);
assert.ok(localization.presentationDimensions.includes('currency'));
assert.ok(localization.presentationDimensions.includes('dates'));
assert.ok(localization.presentationDimensions.includes('units'));

assert.equal(getTextDirection('ar-EG'), 'rtl');
assert.equal(getTextDirection('en-US'), 'ltr');
assert.equal(getTextDirection('om'), 'ltr');
assert.throws(() => createAccessibilityContract({ checks: { keyboard: 'SUCCESS' } }), /Unsupported accessibility state/);
assert.throws(() => createLocalizationContract({ locale: 'xx', supportedLocales: ['en'] }), /Unsupported locale/);

console.log('FUX-15/FUX-16 Accessibility & Localization Regression: PASS');
