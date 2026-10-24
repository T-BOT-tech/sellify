import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/src/authorization/pack-readiness.js', import.meta.url), 'utf8');
const start = source.indexOf('export function readinessFor(');
const end = source.indexOf('\n}\n', start);
assert.ok(start >= 0 && end > start, 'readinessFor must remain an isolated pure mapping helper');
const helper = source.slice(start, end + 3).replace('export function readinessFor(', 'function readinessFor(');
const context = {
  CORE_AUTHORITIES: ['commerce', 'inventory', 'payments', 'customers', 'locations', 'fulfillment', 'documents', 'audit'],
};
vm.createContext(context);
vm.runInContext(`
    function dependencyRows(pack) {
      return pack.core_dependencies.map(name => Object.freeze({
        name,
        available: CORE_AUTHORITIES.includes(String(name).toLowerCase()),
      }));
    }
    ${helper}
    globalThis.readinessFor = readinessFor;
  `, context);
const readinessFor = context.readinessFor;

const pack = { core_dependencies: ['commerce'], ui_entry_points: ['orders'] };
const enabled = { enabled: true };

assert.equal(readinessFor(pack, enabled, null), 'UNKNOWN',
  'missing server lifecycle evidence must not be treated as READY');
assert.equal(readinessFor(pack, enabled, { lifecycle: null, readiness: { state: 'UNKNOWN' } }), 'UNKNOWN',
  'an explicit UNKNOWN readiness state must remain unknown');
assert.equal(readinessFor(pack, enabled, {
  lifecycle: { state: 'UNKNOWN' },
  readiness: { state: 'ACTIVE', active: true, eligible: true },
}), 'UNKNOWN', 'server readiness alone cannot compensate for missing lifecycle state');
assert.equal(readinessFor(pack, enabled, {
  lifecycle: { state: 'ACTIVE' },
  readiness: { state: 'ACTIVE', active: false, eligible: true },
}), 'UNKNOWN', 'ACTIVE lifecycle without active readiness confirmation must not show READY');
assert.equal(readinessFor(pack, enabled, {
  lifecycle: { state: 'ELIGIBLE' },
  readiness: { state: 'ELIGIBLE', active: false, eligible: true },
}), 'ELIGIBLE', 'eligible means ready for the next authorized activation step, not operational');
assert.equal(readinessFor(pack, enabled, {
  lifecycle: { state: 'ACTIVE' },
  readiness: { state: 'ACTIVE', active: true, eligible: true },
}), 'READY', 'READY requires canonical ACTIVE lifecycle and active readiness evidence');
assert.equal(readinessFor({ ...pack, ui_entry_points: [] }, enabled, {
  lifecycle: { state: 'ACTIVE' },
  readiness: { state: 'ACTIVE', active: true, eligible: true },
}), 'JOURNEY_UNAVAILABLE', 'active Pack without an executable entry point remains unavailable as a journey');
assert.equal(readinessFor(pack, { enabled: false }, {
  lifecycle: { state: 'ACTIVE' },
  readiness: { state: 'ACTIVE', active: true, eligible: true },
}), 'CONFIGURATION_INACTIVE', 'local configuration and lifecycle state remain distinct');
assert.equal(readinessFor({ ...pack, core_dependencies: ['unknown-authority'] }, enabled, null), 'DEPENDENCY_UNAVAILABLE');

console.log('First-experience Pack readiness regression: PASS');
