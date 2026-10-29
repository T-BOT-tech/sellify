import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/src/ui/home.js', import.meta.url), 'utf8');

// The home screen is an operational command surface, not a financial report.
assert.doesNotMatch(source, /const\s+sales\s*=|formatMoney\s*\(|CS\s*\(/);
assert.match(source, /Needs attention/);
assert.match(source, /const attentionCount = queued \+ lowStock/);
assert.match(source, /switchTab\('\$\{queued \? 'queue' : 'catalog'\}'\)/);
assert.match(source, /switchTab\('order'\)/);
assert.match(source, /waiting to sync/);
console.log('Home command-center attention regression: PASS');
