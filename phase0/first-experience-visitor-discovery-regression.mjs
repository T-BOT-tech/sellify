import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
const authSource = await readFile(new URL('../app/src/auth/tenant.js', import.meta.url), 'utf8');
const marketplaceSource = await readFile(new URL('../app/src/marketplace/listings.js', import.meta.url), 'utf8');

const pairingStart = html.indexOf('<div id="onboardingPair"');
const inviteStart = html.indexOf('<div id="onboardingInvite"', pairingStart);
assert.notEqual(pairingStart, -1, 'standalone pairing entry must remain available');
assert.notEqual(inviteStart, -1, 'invite entry must remain after pairing');
const pairingMarkup = html.slice(pairingStart, inviteStart);
assert.match(pairingMarkup, /onclick="pairThisDevice\(\)"/, 'the existing protected pairing path must remain available');
assert.match(pairingMarkup, /Browse marketplace/, 'visitors must be offered a discovery path from the blocking pairing prompt');
assert.match(pairingMarkup, /closeOnboarding\(\);\s*switchTab\('marketplace'\);/, 'browse action must dismiss onboarding and open the existing marketplace tab');
assert.match(pairingMarkup, /without setting up or joining a business/, 'visitor-facing copy must make business setup optional for discovery');
assert.match(html, /id="tab-marketplace"/, 'visitor discovery must reuse the existing marketplace surface');

const listingFetch = marketplaceSource.slice(
  marketplaceSource.indexOf('export async function fetchMarketplaceListings()'),
  marketplaceSource.indexOf('export function onMarketSearchInput')
);
assert.match(listingFetch, /\/api\/marketplace\/search/, 'listing discovery must use the existing marketplace search endpoint');
assert.doesNotMatch(listingFetch, /Authorization|sessionToken|chatId/,
  'listing discovery must not acquire a merchant-session dependency');
assert.match(authSource, /export function showPairing\(\)[\s\S]*?onboardingPair[\s\S]*?display', 'block'/,
  'standalone users must retain the existing pairing prompt and enrollment flow');

console.log('First-experience visitor discovery regression: PASS');
