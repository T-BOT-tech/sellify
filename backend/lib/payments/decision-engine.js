const PRECEDENCE = Object.freeze([
  'SECURITY',
  'DUPLICATE',
  'PROVIDER_MISMATCH',
  'EXPIRED',
  'RECEIVER_MISMATCH',
  'CURRENCY_MISMATCH',
  'AMOUNT_MISMATCH',
  'REFERENCE_MISMATCH',
  'TRANSACTION_MISMATCH',
  'TRANSACTION_ID_MISSING',
  'VERIFICATION',
  'ACCEPT',
]);

function has(reasons, code) {
  return Array.isArray(reasons) && reasons.includes(code);
}

export class PaymentDecisionEngine {
  decide({ verification, invariants, payment }) {
    const reasons = [...new Set([
      ...(Array.isArray(verification?.reasonCodes) ? verification.reasonCodes : []),
      ...(Array.isArray(invariants?.reasonCodes) ? invariants.reasonCodes : []),
    ])];

    let decision = 'RETRY_VERIFICATION';
    let targetState = null;

    if (['EVIDENCE_REPLAY','AUTHORIZATION_INVALID','ORGANIZATION_MISMATCH','PAYMENT_INTENT_MISMATCH'].some(code => has(reasons, code))) {
      decision = 'REJECT';
      targetState = 'REJECTED';
    } else if (has(reasons, 'PROVIDER_TRANSACTION_DUPLICATE') || String(verification?.result).toUpperCase() === 'DUPLICATE') {
      decision = 'MARK_DUPLICATE';
      targetState = 'DUPLICATE';
    } else if (has(reasons, 'PROVIDER_MISMATCH')) {
      decision = 'MARK_MISMATCH';
      targetState = 'MISMATCH';
    } else if (has(reasons, 'INTENT_EXPIRED') || String(verification?.result).toUpperCase() === 'EXPIRED') {
      decision = 'EXPIRE';
      targetState = 'EXPIRED';
    } else if (String(verification?.result).toUpperCase() === 'MATCH' &&
               Number.isInteger(verification?.observedAmountMinor) &&
               Number.isInteger(payment?.amountMinor) &&
               verification.observedAmountMinor < payment.amountMinor &&
               !has(reasons, 'CURRENCY_MISMATCH') &&
               !has(reasons, 'RECEIVER_MISMATCH') &&
               !has(reasons, 'RECEIVER_UNAVAILABLE') &&
               !has(reasons, 'TRANSACTION_MISMATCH') && !has(reasons, 'TRANSACTION_ID_MISSING')) {
      decision = 'MARK_PARTIAL';
      targetState = 'PARTIAL';
      reasons.push('PARTIAL_PAYMENT');
    } else if (has(reasons, 'RECEIVER_MISMATCH') || has(reasons, 'RECEIVER_UNAVAILABLE') ||
               has(reasons, 'CURRENCY_MISMATCH') || has(reasons, 'AMOUNT_MISMATCH') ||
               has(reasons, 'REFERENCE_MISMATCH') || has(reasons, 'TRANSACTION_MISMATCH') ||
               has(reasons, 'TRANSACTION_ID_MISSING')) {
      decision = 'MARK_MISMATCH';
      targetState = 'MISMATCH';
    } else if (String(verification?.result).toUpperCase() === 'MATCH' && invariants?.passed) {
      decision = 'ACCEPT';
      targetState = 'VERIFIED';
    } else if (String(verification?.result).toUpperCase() === 'MISMATCH') {
      decision = 'MARK_MISMATCH';
      targetState = 'MISMATCH';
    } else if (String(verification?.result).toUpperCase() === 'DUPLICATE') {
      decision = 'MARK_DUPLICATE';
      targetState = 'DUPLICATE';
    } else if (String(verification?.result).toUpperCase() === 'EXPIRED') {
      decision = 'EXPIRE';
      targetState = 'EXPIRED';
    }

    return {
      decision,
      targetState,
      reasonCodes: [...new Set(reasons)],
      precedence: PRECEDENCE,
    };
  }
}

export function decidePayment(input) {
  return new PaymentDecisionEngine().decide(input);
}
