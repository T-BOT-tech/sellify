import assert from 'node:assert/strict';
import { getPlatformCapability } from '../app/src/platform/capability-contract.js';
const c=getPlatformCapability('payments.core'); assert.ok(c); assert.equal(c.authority,'payments'); assert.ok(c.actions.includes('outbound:create')); assert.ok(c.actions.includes('outbound:confirm')); console.log('Phase 17.8 Payment Contract Regression: PASS');
