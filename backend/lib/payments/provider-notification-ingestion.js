// GAP-1.18: provider notification ingestion boundary.
// Authentication and evidence parsing are provider responsibilities. Persistence
// remains an observation-only operation; Payment Core owns correlation, verification,
// lifecycle decisions and all financial effects.

import { assertAuthenticatedNotificationContext, assertProviderNotificationEvidenceShape } from './provider-notification-authority.js';

export async function ingestProviderNotification({
  providerRegistry,
  store,
  providerId,
  rawNotification,
} = {}) {
  if (!providerRegistry?.getPaymentProvider) {
    throw Object.assign(new Error('Payment provider registry is required'), { statusCode: 503, code: 'PAYMENT_PROVIDER_REGISTRY_UNAVAILABLE' });
  }
  if (!store?.insertProviderNotificationEvidence) {
    throw Object.assign(new Error('Provider notification evidence storage is unavailable'), { statusCode: 503, code: 'PAYMENT_NOTIFICATION_STORAGE_UNAVAILABLE' });
  }

  const requestedProviderId = String(providerId || '').trim().toLowerCase();
  if (!requestedProviderId) {
    throw Object.assign(new Error('providerId is required'), { statusCode: 400, code: 'PAYMENT_NOTIFICATION_PROVIDER_REQUIRED' });
  }

  const provider = providerRegistry.getPaymentProvider(requestedProviderId);
  if (!provider) {
    throw Object.assign(new Error('Unknown payment provider'), { statusCode: 400, code: 'UNKNOWN_PAYMENT_PROVIDER' });
  }

  const authenticated = assertAuthenticatedNotificationContext(
    await provider.authenticateNotification(rawNotification)
  );
  if (authenticated.providerId !== requestedProviderId) {
    throw Object.assign(new Error('Authenticated provider does not match notification route'), {
      statusCode: 409, code: 'PAYMENT_NOTIFICATION_PROVIDER_MISMATCH',
    });
  }

  const parsed = await provider.parseEvidence({
    notification: rawNotification,
    authentication: authenticated,
  });
  assertProviderNotificationEvidenceShape(parsed);

  return store.insertProviderNotificationEvidence({
    authenticatedContext: authenticated,
    rawPayload: rawNotification,
    evidence: {
      ...parsed,
      rawPayload: parsed.rawPayload ?? rawNotification,
    },
  });
}
