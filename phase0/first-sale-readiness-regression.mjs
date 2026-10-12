import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const home = readFileSync('app/src/ui/home.js', 'utf8');
assert.match(home, /products\.length > 0 \? t\('catalogReady'\) : t\('firstSaleAddProduct'\)/,
  'home readiness must depend on catalog contents, not connectivity');
assert.match(home, /navigator\.onLine \? 'online' : 'offline'/i,
  'connectivity indicator should remain separate from catalog readiness');

const localesDir = 'app/src/i18n/locales';
const localeFiles = readdirSync(localesDir).filter(file => file.endsWith('.js'));
assert.ok(localeFiles.length > 0, 'locale files must exist');
for (const file of localeFiles) {
  const source = readFileSync(join(localesDir, file), 'utf8');
  assert.match(source, /firstSaleAddProduct\s*:/, `${file} must define firstSaleAddProduct`);
  assert.match(source, /catalogReady\s*:/, `${file} must define catalogReady`);
}
console.log(`First-sale readiness regression passed (${localeFiles.length} locales).`);
