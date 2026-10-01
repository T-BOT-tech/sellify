import { parentPort, workerData } from 'node:worker_threads';

try {
  const store = await import('../backend/lib/store-sqlite.js');

  if (workerData.operation === 'create-payment') {
    const result = await store.createPaymentWithIntent(workerData.chatId, workerData.input);
    parentPort.postMessage({
      ok: true,
      paymentId: result.payment?.id || null,
      intentId: result.intent?.id || null,
      idempotent: Boolean(result.idempotent),
    });
  } else if (workerData.operation === 'insert-evidence') {
    const result = await store.insertPaymentEvidence(workerData.chatId, workerData.input);
    parentPort.postMessage({
      ok: true,
      evidenceId: result.evidence?.id || null,
      duplicate: Boolean(result.duplicate),
    });
  } else {
    throw new Error(`Unknown worker operation: ${workerData.operation}`);
  }
} catch (error) {
  parentPort.postMessage({
    ok: false,
    name: error?.name || 'Error',
    code: error?.code || null,
    message: error?.message || String(error),
  });
}
