// TG-5 — Seller-owned Telegram buyer identity/session boundary.
// The seller bot credential is resolved only through the TG-2 secure credential
// provider. No buyer session is persisted here; verification is stateless and
// short-lived, while canonical customer/order authorities remain unchanged.
import crypto from 'node:crypto';
import { normalizeTelegramCredentialRef } from './telegram-bot-credential-contract.js';

export const TELEGRAM_BUYER_IDENTITY_CONSTITUTION = Object.freeze({
  rawTokenPersistence: false,
  sessionPersistence: false,
  buyerIdentityAuthority: 'existing_identity_customer_authorities',
  verificationAuthority: 'telegram_webapp_init_data_via_seller_bot_credential',
  tenantIsolation: true,
  failClosedWhenProviderUnavailable: true,
  authorization: 'seller_storefront_public_capability_plus_canonical_domain_authorization',
});

function keysMatch(a, b) {
  try {
    const aa = Buffer.from(String(a), 'hex');
    const bb = Buffer.from(String(b), 'hex');
    return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
  } catch { return false; }
}

export function normalizeTelegramBuyerInitData(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw Object.assign(new Error('Telegram initData is required'), { statusCode: 400, code: 'TELEGRAM_INIT_DATA_REQUIRED' });
  }
  if (raw.length > 10000) {
    throw Object.assign(new Error('Telegram initData is too large'), { statusCode: 400, code: 'TELEGRAM_INIT_DATA_TOO_LARGE' });
  }
  return raw.trim();
}

export function verifyTelegramBuyerInitDataWithSecret(raw, botToken, maxAgeSec = 86400) {
  const initData = normalizeTelegramBuyerInitData(raw);
  const token = String(botToken || '');
  if (!token) throw Object.assign(new Error('Telegram bot credential is unavailable'), { statusCode: 503, code: 'TELEGRAM_CREDENTIAL_UNAVAILABLE' });
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  if (!receivedHash || !Number.isFinite(authDate)) throw Object.assign(new Error('Invalid Telegram initData'), { statusCode: 401, code: 'INVALID_TELEGRAM_INIT_DATA' });
  if (Math.abs(Date.now() / 1000 - authDate) > Math.max(60, Number(maxAgeSec) || 86400)) {
    throw Object.assign(new Error('Telegram initData is expired'), { statusCode: 401, code: 'TELEGRAM_INIT_DATA_EXPIRED' });
  }
  const pairs = [];
  for (const [key, value] of params.entries()) if (key !== 'hash') pairs.push(`${key}=${value}`);
  pairs.sort();
  const dataCheckString = pairs.join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (!keysMatch(receivedHash, expectedHash)) throw Object.assign(new Error('Invalid Telegram initData signature'), { statusCode: 401, code: 'INVALID_TELEGRAM_INIT_DATA_SIGNATURE' });
  let user = null;
  try { user = params.get('user') ? JSON.parse(params.get('user')) : null; } catch {}
  if (!user || user.id == null) throw Object.assign(new Error('Telegram user is missing'), { statusCode: 401, code: 'TELEGRAM_USER_REQUIRED' });
  return {
    telegramUserId: String(user.id),
    user: {
      id: String(user.id),
      firstName: String(user.first_name || ''),
      lastName: String(user.last_name || ''),
      username: user.username ? String(user.username) : null,
      languageCode: user.language_code ? String(user.language_code) : null,
    },
    authDate,
    queryId: params.get('query_id') || null,
  };
}

export async function verifyTelegramBuyerInitData({ credentialRef, rawInitData, maxAgeSec = 86400, credentialProvider = null }) {
  const ref = normalizeTelegramCredentialRef(credentialRef);
  if (!ref) throw Object.assign(new Error('Telegram bot credential is not configured'), { statusCode: 409, code: 'TELEGRAM_CREDENTIAL_REQUIRED' });
  if (!credentialProvider || typeof credentialProvider.getSecret !== 'function') {
    throw Object.assign(new Error('Telegram secure credential provider is not configured'), { statusCode: 503, code: 'TELEGRAM_CREDENTIAL_PROVIDER_UNAVAILABLE' });
  }
  const secret = await credentialProvider.getSecret(ref);
  if (!secret || typeof secret !== 'string') throw Object.assign(new Error('Telegram bot credential could not be resolved'), { statusCode: 503, code: 'TELEGRAM_CREDENTIAL_UNAVAILABLE' });
  return verifyTelegramBuyerInitDataWithSecret(rawInitData, secret, maxAgeSec);
}
