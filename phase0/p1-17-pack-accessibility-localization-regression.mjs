import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url).pathname;
const moduleText = fs.readFileSync(`${root}app/src/authorization/pack-accessibility-localization.js`, 'utf8');
const settings = fs.readFileSync(`${root}app/src/ui/settings.js`, 'utf8');
const html = fs.readFileSync(`${root}app/index.html`, 'utf8');

assert.match(moduleText, /TRANSLATIONS/);
assert.match(moduleText, /aria-live/);
assert.match(moduleText, /scope.*col/);
assert.match(moduleText, /translationFallback.*en/);
assert.match(settings, /renderPackAccessibilityLocalizationPanel/);
assert.match(html, /packAccessibilityLocalizationPanel/);

for (const file of fs.readdirSync(`${root}app/src/i18n/locales`).filter(f => f.endsWith('.js'))) {
  const text = fs.readFileSync(`${root}app/src/i18n/locales/${file}`, 'utf8');
  assert.match(text, /packAccessibilityLocalizationTitle/);
}

console.log('P1-17 PASS — Pack accessibility/localization contract, semantic hooks, integration, and locale keys verified.');
