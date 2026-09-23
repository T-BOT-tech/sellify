import { createDatabaseBackup, getDatabasePath } from './lib/store-sqlite.js';

try {
  const backup = await createDatabaseBackup();
  console.log(`Sellify backup created: ${backup.path}`);
  console.log(`Database source: ${getDatabasePath()}`);
} catch (error) {
  console.error(`Sellify backup failed: ${error.message}`);
  process.exitCode = 1;
}