// GAP-1.18C capability certification decision boundary.
// Observation is evidence. Certification is a separate decision and never
// occurs merely because an observation exists.

export function evaluateCapabilityCertification({
  providerContractCertified = false,
  evidence = null,
  now = new Date().toISOString(),
} = {}) {
  if (!providerContractCertified) {
    return { status: 'UNKNOWN', certified: false, reasonCodes: ['ADAPTER_CONTRACT_NOT_CERTIFIED'] };
  }
  if (!evidence) {
    return { status: 'UNKNOWN', certified: false, reasonCodes: ['LIVE_EXTERNAL_EVIDENCE_REQUIRED'] };
  }
  if (String(evidence.status || '').toUpperCase() !== 'OBSERVED') {
    return { status: 'UNKNOWN', certified: false, reasonCodes: ['OBSERVED_EVIDENCE_REQUIRED'] };
  }
  if (String(evidence.certificationScope || '').toUpperCase() !== 'LIVE_EXTERNAL') {
    return { status: 'UNKNOWN', certified: false, reasonCodes: ['LIVE_EXTERNAL_SCOPE_REQUIRED'] };
  }
  if (evidence.expiresAt && new Date(evidence.expiresAt).getTime() <= new Date(now).getTime()) {
    return { status: 'EXPIRED', certified: false, reasonCodes: ['CAPABILITY_EVIDENCE_EXPIRED'] };
  }
  return {
    status: 'CERTIFIED',
    certified: true,
    reasonCodes: ['ADAPTER_CONTRACT_CERTIFIED', 'LIVE_EXTERNAL_EVIDENCE_VERIFIED'],
  };
}
