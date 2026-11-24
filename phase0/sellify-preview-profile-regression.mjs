import assert from 'node:assert/strict';
import { classifySellifyPreviewProfile } from '../scripts/sellify-preview-profile.mjs';

const cases = [
  {
    name: 'backend-only keeps the base frontend',
    branchName: 'feature/backend-change',
    changedPaths: ['backend/server.js', 'backend/lib/orders.js', 'phase0/backend-http-regression.mjs'],
    expected: 'backend-only',
  },
  {
    name: 'frontend-only keeps the base backend',
    branchName: 'feature/frontend-change',
    changedPaths: ['app/index.html', 'app/src/ui/home.js'],
    expected: 'frontend-only',
  },
  {
    name: 'full-stack selects both head components',
    branchName: 'feature/full-stack',
    changedPaths: ['backend/server.js', 'app/src/ui/home.js'],
    expected: 'full-stack',
  },
  {
    name: 'shared browser/backend contract is full-stack',
    branchName: 'feature/shared-contract',
    changedPaths: ['app/src/platform/telegram-checkout-contract.js'],
    expected: 'full-stack',
  },
  {
    name: 'migration branch takes precedence',
    branchName: 'migration/add-index',
    changedPaths: ['backend/lib/store-sqlite.js'],
    expected: 'migration',
  },
  {
    name: 'SQLite schema implementation is migration-sensitive',
    branchName: 'feature/schema-fix',
    changedPaths: ['backend/lib/store-sqlite.js'],
    expected: 'migration',
  },
  {
    name: 'documentation-only changes fail closed to full-stack',
    branchName: 'docs/preview-notes',
    changedPaths: ['docs/preview-notes.md'],
    expected: 'full-stack',
  },
];

for (const testCase of cases) {
  const result = classifySellifyPreviewProfile(testCase);
  assert.equal(result.profile, testCase.expected, testCase.name);
}

console.log('Sellify preview profile classifier regression: PASS (7 cases)');
