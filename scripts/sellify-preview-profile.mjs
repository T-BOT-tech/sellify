import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHARED_CONTRACT_PATHS = [
  /^app\/browser-backend-modules\.mjs$/,
  /^app\/src\/[^/]+-contract\.js$/,
  /^app\/src\/platform\/[^/]*contract\.js$/,
];

function isMigrationPath(path) {
  return path.endsWith('.sql')
    || path === 'backend/lib/store-sqlite.js'
    || /^backend\/lib\/[^/]*migration[^/]*\.js$/.test(path)
    || /migration/i.test(path);
}

export function classifySellifyPreviewProfile({ branchName = '', changedPaths = [] } = {}) {
  const paths = changedPaths.map(path => String(path).replaceAll('\\', '/')).filter(Boolean);
  const backendChanged = paths.some(path => path.startsWith('backend/'));
  const frontendChanged = paths.some(path => path.startsWith('app/'));
  const sharedContractChanged = paths.some(path => SHARED_CONTRACT_PATHS.some(pattern => pattern.test(path)));
  const migrationChanged = branchName.startsWith('migration/')
    || paths.some(isMigrationPath);

  let profile = 'full-stack';
  if (migrationChanged) profile = 'migration';
  else if (backendChanged && !frontendChanged) profile = 'backend-only';
  else if (frontendChanged && !backendChanged && !sharedContractChanged) profile = 'frontend-only';

  return {
    profile,
    backendChanged,
    frontendChanged,
    sharedContractChanged,
    migrationChanged,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [branchName = '', ...changedPaths] = process.argv.slice(2);
  console.log(JSON.stringify(classifySellifyPreviewProfile({ branchName, changedPaths })));
}
