// GAP-1.18 provider HTTP probe transport.
// Deliberately provider-neutral: approved provider adapters supply the endpoint
// path and method. Secrets stay in memory and are never returned or persisted.

export async function requestProviderProbe({
  baseUrl,
  apiKey,
  path = '/',
  method = 'GET',
  timeoutMs = 5000,
  headers = {},
  body,
  fetchImpl = globalThis.fetch,
}) {
  if (!baseUrl || !apiKey) {
    const error = new Error('Provider is not configured');
    error.code = 'PAYMENT_PROVIDER_NOT_CONFIGURED';
    throw error;
  }
  if (typeof fetchImpl !== 'function') {
    const error = new Error('Fetch transport unavailable');
    error.code = 'PAYMENT_PROVIDER_TRANSPORT_UNAVAILABLE';
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(250, Number(timeoutMs) || 5000));

  try {
    const url = new URL(path, baseUrl).toString();
    const response = await fetchImpl(url, {
      method,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${apiKey}`,
        ...headers,
      },
      body: body == null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { responseText: text.slice(0, 4096) }; }

    return {
      ok: response.ok,
      statusCode: response.status,
      payload,
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Provider probe timed out');
      timeoutError.code = 'PAYMENT_PROVIDER_PROBE_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
