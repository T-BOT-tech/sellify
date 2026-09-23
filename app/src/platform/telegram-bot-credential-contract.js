// TG-2 — Seller-owned Telegram bot credential boundary.
// Raw bot tokens never enter SELLIFY business persistence. A credential provider
// owns secret storage/retrieval; the Telegram adapter receives a short-lived
// provider result only when verification is explicitly requested.

export const TELEGRAM_CREDENTIAL_REFERENCE_SCHEME = 'secret://';

export const TELEGRAM_BOT_CREDENTIAL_CONSTITUTION = Object.freeze({
  rawTokenPersistence: false,
  sqlitePersistence: false,
  businessAuthority: false,
  credentialAuthority: 'external_secure_credential_provider',
  verificationAuthority: 'telegram_bot_api_via_controlled_adapter',
  failClosedWhenProviderUnavailable: true,
});

export function normalizeTelegramCredentialRef(value) {
  const ref = String(value ?? '').trim();
  if (!ref) return null;
  if (!ref.startsWith(TELEGRAM_CREDENTIAL_REFERENCE_SCHEME)) {
    throw Object.assign(new Error('credentialRef must use the secret:// reference scheme'), {
      statusCode: 400, code: 'INVALID_TELEGRAM_CREDENTIAL_REF'
    });
  }
  if (ref.length > 512) {
    throw Object.assign(new Error('credentialRef is too long'), {
      statusCode: 400, code: 'INVALID_TELEGRAM_CREDENTIAL_REF'
    });
  }
  return ref;
}

// Provider boundary. A deployment may register an implementation without
// changing the storefront or business authorities. TG-2 intentionally ships
// with no provider: activation must fail closed rather than pretending a bot
// is verified.
let credentialProvider = null;

export function registerTelegramBotCredentialProvider(provider) {
  if (!provider || typeof provider.getSecret !== 'function' || typeof provider.verifyBot !== 'function') {
    throw new TypeError('Telegram credential provider must implement getSecret() and verifyBot()');
  }
  credentialProvider = provider;
}

export function clearTelegramBotCredentialProvider() {
  credentialProvider = null;
}

export function telegramBotCredentialProviderAvailable() {
  return !!credentialProvider;
}

export async function resolveTelegramBotCredential(credentialRef) {
  const ref = normalizeTelegramCredentialRef(credentialRef);
  if (!ref) throw Object.assign(new Error('Telegram bot credential is not configured'), { statusCode: 409, code: 'TELEGRAM_CREDENTIAL_REQUIRED' });
  if (!credentialProvider) throw Object.assign(new Error('Telegram secure credential provider is not configured'), { statusCode: 503, code: 'TELEGRAM_CREDENTIAL_PROVIDER_UNAVAILABLE' });
  const secret = await credentialProvider.getSecret(ref);
  if (!secret || typeof secret !== 'string') throw Object.assign(new Error('Telegram bot credential could not be resolved'), { statusCode: 503, code: 'TELEGRAM_CREDENTIAL_UNAVAILABLE' });
  return secret;
}

export async function verifyTelegramBotCredential(credentialRef) {
  const ref = normalizeTelegramCredentialRef(credentialRef);
  if (!ref) throw Object.assign(new Error('Telegram bot credential is not configured'), {
    statusCode: 409, code: 'TELEGRAM_CREDENTIAL_REQUIRED'
  });
  if (!credentialProvider) throw Object.assign(new Error('Telegram secure credential provider is not configured'), {
    statusCode: 503, code: 'TELEGRAM_CREDENTIAL_PROVIDER_UNAVAILABLE'
  });
  const secret = await resolveTelegramBotCredential(ref);
  if (!secret || typeof secret !== 'string') throw Object.assign(new Error('Telegram bot credential could not be resolved'), {
    statusCode: 503, code: 'TELEGRAM_CREDENTIAL_UNAVAILABLE'
  });
  const identity = await credentialProvider.verifyBot(secret);
  if (!identity || identity.ok !== true) throw Object.assign(new Error('Telegram bot verification failed'), {
    statusCode: 422, code: 'TELEGRAM_BOT_VERIFICATION_FAILED'
  });
  return { botId: identity.botId != null ? String(identity.botId) : null, botUsername: identity.botUsername ? String(identity.botUsername) : null };
}
