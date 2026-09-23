import assert from 'node:assert/strict';
import {
  verifyLogisticsProviderCapability,
  evaluateLogisticsProviderTrustBoundary,
  logisticsProviderVerificationContract,
} from '../app/src/verticals/logistics/provider-verification-contract.js';

let pass = 0;
const check = (condition, message) => { assert.equal(Boolean(condition), true, message); pass += 1; };
const throwsCode = (fn, code, message) => { assert.throws(fn, (e) => e?.code === code, message); pass += 1; };

const contract = logisticsProviderVerificationContract();
check(contract.version === '1.0', 'version');
check(contract.persistence === 'none', 'no persistence');
check(contract.provider_selection === false, 'no provider selection');
check(contract.credential_storage === false, 'no credential storage');
check(contract.provider_trust_authority === false, 'no global trust authority');

const declared = verifyLogisticsProviderCapability({
  provider_id: 'network-x', capabilities: ['delivery'], status: 'AVAILABLE', source: 'provider', evidence_mode: 'declared',
});
check(declared.verification_result === 'UNVERIFIED', 'declared evidence remains unverified');
check(declared.scoped_claim === true, 'claim is scoped');

const observed = verifyLogisticsProviderCapability({
  provider_id: 'network-x', capabilities: ['delivery'], status: 'AVAILABLE', source: 'adapter', evidence_mode: 'observed', observed_at: '2026-09-21T10:00:00Z',
});
check(observed.verification_result === 'OBSERVED', 'observed evidence');

const verified = verifyLogisticsProviderCapability({
  provider_id: 'network-x', capabilities: ['delivery', 'tracking'], status: 'AVAILABLE', source: 'manual', evidence_mode: 'verified',
  evidence_reference: 'verification-123', verified_by: 'verifier-1', verified_at: '2026-09-21T10:00:00Z', valid_until: '2027-09-21T10:00:00Z',
});
check(verified.verification_result === 'VERIFIED', 'verified evidence');
check(verified.credential_storage === false, 'verification cannot store credentials');
check(verified.provider_selection === false, 'verification cannot select provider');

const sufficient = evaluateLogisticsProviderTrustBoundary(
  { capabilities: ['delivery', 'tracking'] },
  {
    provider_id: 'network-x', capabilities: ['delivery', 'tracking'], status: 'AVAILABLE', source: 'manual', evidence_mode: 'verified',
    evidence_reference: 'verification-123', verified_by: 'verifier-1', verified_at: '2026-09-21T10:00:00Z', valid_until: '2027-09-21T10:00:00Z',
  },
);
check(sufficient.result === 'EVIDENCE_SUFFICIENT', 'verified evidence satisfies scoped requirement');
check(sufficient.authorization_required === true, 'authorization remains required');
check(sufficient.execution === false, 'verification does not execute');

const expired = evaluateLogisticsProviderTrustBoundary(
  { capabilities: ['delivery'] },
  {
    provider_id: 'network-x', capabilities: ['delivery'], status: 'AVAILABLE', source: 'manual', evidence_mode: 'verified',
    evidence_reference: 'verification-old', verified_by: 'verifier-1', verified_at: '2025-09-21T10:00:00Z', valid_until: '2026-09-20T10:00:00Z',
  },
);
check(expired.result === 'EXPIRED', 'expired evidence is not sufficient');

throwsCode(() => verifyLogisticsProviderCapability({
  provider_id: 'network-x', capabilities: ['delivery'], status: 'AVAILABLE', source: 'manual', evidence_mode: 'verified',
}), 'LOGISTICS_PROVIDER_VERIFIER_REQUIRED', 'verified evidence requires verifier');
throwsCode(() => verifyLogisticsProviderCapability({
  provider_id: 'network-x', capabilities: ['delivery'], status: 'AVAILABLE', source: 'manual', evidence_mode: 'verified', verified_by: 'v', verified_at: '2026-09-21T10:00:00Z',
}), 'LOGISTICS_PROVIDER_EVIDENCE_REFERENCE_REQUIRED', 'verified evidence requires evidence reference');
throwsCode(() => verifyLogisticsProviderCapability({
  provider_id: 'network-x', capabilities: ['delivery'], status: 'AVAILABLE', source: 'manual', evidence_mode: 'verified', credentials: {},
}), 'LOGISTICS_PROVIDER_VERIFICATION_INVALID', 'credentials rejected');

console.log(`Phase 16.13.5 Logistics Provider Verification Regression: ${pass} PASS / 0 FAIL`);
