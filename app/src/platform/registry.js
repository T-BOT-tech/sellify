// platform/registry.js
// Phase 9 extraction (see modularization plan §5): the platform-adapter
// registry. Every place that used to ask "am I inside Telegram?" via a raw
// `window.Telegram.WebApp` check now asks this registry for the active
// platform instead, so adding WhatsApp/SMS/native later means adding an
// adapter file here, not re-scattering `if (window.X)` checks through
// main.js / theme/branding.js / orders/checkout.js / orders/cart.js /
// marketplace/checkout.js again.
//
// Follows Rule 1's pattern (state.js): the cached active-platform reference
// is local mutable state owned here, exported as a value + a setter, the
// same way orders/cart.js exports currentTenderedAmount /
// setCurrentTenderedAmount.
import { telegram } from './telegram.js';
import { whatsapp } from './whatsapp.js';
import { sms } from './sms.js';
import { native } from './native.js';
import { web } from './web.js';

// Priority order: the first adapter whose isActive() returns true wins.
// web.js is last on purpose — its isActive() always returns true, so it's
// the guaranteed fallback once nothing more specific has matched.
const ADAPTERS = [telegram, whatsapp, sms, native, web];

export let activePlatform = null;
export function setActivePlatform(next) { activePlatform = next; }

// Resolves and caches the winner on first call; every later call reuses the
// cached adapter instead of re-running every isActive() check.
export function resolveActivePlatform() {
  if (activePlatform) return activePlatform;
  activePlatform = ADAPTERS.find(a => a.isActive()) || web;
  return activePlatform;
}
