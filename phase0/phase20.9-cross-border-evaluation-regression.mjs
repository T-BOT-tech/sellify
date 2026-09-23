import assert from 'node:assert/strict';
import {
  evaluateCrossBorder,
  isCrossBorderEvaluation,
  crossBorderEvaluationContract,
  CROSS_BORDER_DIMENSIONS,
} from '../app/src/cross-border-evaluation.js';

const pass = async (name, fn) => { await fn(); console.log(`PASS ${name}`); };

const base = {
  opportunityReference: { id: 'opp-209', type: 'cross_border_opportunity' },
  origin: 'ET', destination: 'KE',
  commercial: { result: 'FEASIBLE', reason: 'Quote is valid' },
  capacity: { result: 'FEASIBLE', reason: 'Observed supplier capacity' },
  qualification: { result: 'FEASIBLE', reason: 'Qualification evidence verified' },
  requirements: { result: 'FEASIBLE', reason: 'Required evidence satisfied' },
  currency: { result: 'FEASIBLE', reason: 'Existing currency context is supported' },
  logistics: { result: 'FEASIBLE', reason: 'Lane logistics capability available' },
  payment: { result: 'FEASIBLE', reason: 'Payment capability available' },
};

await pass('contract is non-executing and persistent-free', () => {
  const c = crossBorderEvaluationContract();
  assert.deepEqual(c.dimensions, CROSS_BORDER_DIMENSIONS);
  assert.equal(c.persistence, 'none');
  assert.equal(c.mutation, false);
  assert.equal(c.authorization, false);
  assert.equal(c.execution, false);
  assert.equal(c.transactionCreation, false);
  assert.equal(c.providerExecution, false);
  assert.equal(c.unknownIsSuccess, false);
});

await pass('all feasible dimensions produce FEASIBLE', () => {
  const r = evaluateCrossBorder(base);
  assert.equal(r.result, 'feasible');
  assert.equal(r.failureState, 'success');
  assert.equal(r.blockers.length, 0);
  assert.equal(r.unknown.length, 0);
  assert.equal(r.review.length, 0);
  assert.equal(isCrossBorderEvaluation(r), true);
});

await pass('single blocker makes evaluation not feasible', () => {
  const r = evaluateCrossBorder({ ...base, logistics: { result: 'NOT_FEASIBLE', reason: 'No supported carrier' } });
  assert.equal(r.result, 'not_feasible');
  assert.equal(r.failureState, 'blocked');
  assert.equal(r.blockers[0].dimension, 'logistics');
});

await pass('conditional dimension requires review', () => {
  const r = evaluateCrossBorder({ ...base, requirements: { result: 'CONDITIONALLY_FEASIBLE', reason: 'Customs evidence requires review' } });
  assert.equal(r.result, 'conditionally_feasible');
  assert.equal(r.failureState, 'review_required');
  assert.equal(r.review[0].dimension, 'requirements');
});

await pass('unknown dimension stays unknown', () => {
  const r = evaluateCrossBorder({ ...base, payment: null });
  assert.equal(r.result, 'unknown');
  assert.equal(r.failureState, 'unknown');
  assert.equal(r.unknown[0].dimension, 'payment');
});

await pass('blocker dominates unknown', () => {
  const r = evaluateCrossBorder({ ...base, payment: null, logistics: { result: 'NOT_FEASIBLE', reason: 'Lane blocked' } });
  assert.equal(r.result, 'not_feasible');
});

await pass('unknown dominates conditional review', () => {
  const r = evaluateCrossBorder({ ...base, payment: null, requirements: { result: 'CONDITIONALLY_FEASIBLE' } });
  assert.equal(r.result, 'unknown');
});

await pass('same-country evaluation fails closed', () => {
  assert.throws(() => evaluateCrossBorder({ ...base, origin: 'ET', destination: 'ET' }), /different countries/);
});

await pass('invalid dimension result fails closed', () => {
  assert.throws(() => evaluateCrossBorder({ ...base, currency: { result: 'SUCCESS' } }), /Unsupported currency result/);
});

await pass('execution claims are rejected', () => {
  assert.throws(() => evaluateCrossBorder({ ...base, opportunityReference: { id: 'x', execute: true } }), /cannot execute/);
});

await pass('source contains no direct execution or persistence primitives', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(new URL('../app/src/cross-border-evaluation.js', import.meta.url), 'utf8');
  assert.equal(/(?:from\s+['"](?:[^'"]*(?:store|sqlite|indexeddb|outbox|payment|inventory|shipment|provider)[^'"]*)['"]|\b(?:enqueueEvent|createOrder|createShipment|reserveInventory|capturePayment)\s*\()/i.test(source), false);
});
