import assert from 'node:assert/strict';
import { evaluateCapabilityCertification } from '../backend/lib/payments/capability-certification.js';

const base = { providerContractCertified: true, evidence: { status: 'OBSERVED', certificationScope: 'LIVE_EXTERNAL' } };
assert.equal(evaluateCapabilityCertification(base).status, 'CERTIFIED');
assert.equal(evaluateCapabilityCertification({ ...base, providerContractCertified: false }).status, 'UNKNOWN');
assert.equal(evaluateCapabilityCertification({ ...base, evidence: { status: 'UNKNOWN', certificationScope: 'LIVE_EXTERNAL' } }).status, 'UNKNOWN');
assert.equal(evaluateCapabilityCertification({ ...base, evidence: { status: 'OBSERVED', certificationScope: 'ADAPTER_CONTRACT' } }).status, 'UNKNOWN');
assert.equal(evaluateCapabilityCertification({ ...base, evidence: { ...base.evidence, expiresAt: '2020-01-01T00:00:00.000Z' }, now: '2026-01-01T00:00:00.000Z' }).status, 'EXPIRED');
console.log('GAP-1.18C capability certification regression passed');
