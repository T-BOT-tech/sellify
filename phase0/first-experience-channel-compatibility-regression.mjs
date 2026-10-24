import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  TELEGRAM_STOREFRONT_CAPABILITIES,
  TELEGRAM_STOREFRONT_FULFILLMENT_CAPABILITIES,
  TELEGRAM_STOREFRONT_UNSUPPORTED_CAPABILITIES,
  normalizeTelegramStorefrontConfig,
} from '../app/src/telegram-storefront-contract.js';
import { TELEGRAM_BUYER_CAPABILITIES } from '../app/src/telegram-buyer-storefront.js';
import { buildSellerStorefrontChannelSummary } from '../app/src/platform/seller-channel-storefront-contract.js';

assert.ok(!TELEGRAM_STOREFRONT_CAPABILITIES.includes('returns'),
  'unsupported Telegram returns must not be configurable as an enabled capability');
assert.ok(!TELEGRAM_BUYER_CAPABILITIES.includes('returns'),
  'buyer-facing capability checks must not advertise unsupported Telegram returns');
assert.deepEqual(TELEGRAM_STOREFRONT_UNSUPPORTED_CAPABILITIES, ['returns']);
assert.deepEqual(TELEGRAM_STOREFRONT_FULFILLMENT_CAPABILITIES, ['tracking', 'proof_of_delivery']);
assert.ok(!normalizeTelegramStorefrontConfig({ enabledCapabilities: ['browse', 'returns'] }).enabledCapabilities.includes('returns'),
  'the shared client normalization must remove unsupported operations');

const summary = buildSellerStorefrontChannelSummary({
  channelType: 'telegram',
  status: 'PUBLISHED',
  enabledCapabilities: ['browse', 'checkout'],
  unsupportedCapabilities: ['returns'],
});
assert.deepEqual(summary.capabilities, ['browse', 'checkout']);
assert.deepEqual(summary.unsupportedCapabilities, ['returns']);

const [ui, store, server, buyerStore] = await Promise.all([
  readFile(new URL('../app/src/channels/storefront.js', import.meta.url), 'utf8'),
  readFile(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8'),
  readFile(new URL('../backend/server.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/telegram-buyer-storefront.js', import.meta.url), 'utf8'),
]);
assert.match(ui, /Returns are not supported as a Telegram operation/);
assert.match(ui, /not readiness confirmation/);
assert.match(store, /UNSUPPORTED_TELEGRAM_STOREFRONT_CAPABILITY/,
  'the server must reject unsupported operation flags');
assert.match(store, /unsupportedCapabilities/,
  'legacy unsupported flags must be projected separately from enabled capabilities');
assert.match(server, /TELEGRAM_STOREFRONT_FULFILLMENT_CAPABILITIES\.includes\(c\)/,
  'the fulfillment endpoint must be gated by supported operations only');
assert.doesNotMatch(server, /\['tracking','proof_of_delivery','returns'\]/,
  'returns must not unlock the Telegram tracking/proof endpoint');
assert.match(buyerStore, /hasTelegramCapability/);

console.log('First-experience channel compatibility regression: PASS');
