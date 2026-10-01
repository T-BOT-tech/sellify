// GAP-1.18B provider HTTP transport.
// Provider-neutral: this layer knows HTTP mechanics only. Authentication is
// constructed by the provider adapter and passed as explicit headers.

export async function requestProviderProbe({
  baseUrl,
  path = '/',
  method = 'GET',
  timeoutMs = 5000,
  headers = {},
  body,
  fetchImpl = globalThis.fetch,
}) {
  if (!baseUrl) {
    const error = new Error('Provider endpoint is not configured');
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
      headers: { accept: 'application/json', ...headers },
      body: body == null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { responseText: text.slice(0, 4096) }; }

    return { ok: response.ok, statusCode: response.status, payload };
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
