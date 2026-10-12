import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = await mkdtemp(path.join(os.tmpdir(), 'sellify-backup-collision-'));
process.env.SELLIFY_DATA_DIR = path.join(root, 'data');
process.env.SELLIFY_DB_PATH = path.join(root, 'data', 'sellify.sqlite');
process.env.SELLIFY_BACKUP_DIR = path.join(root, 'backups');

try {
  const store = await import(`../backend/lib/store-sqlite.js?backup-regression=${crypto.randomUUID()}`);
  await store.getOrCreateUserByTelegram('backup-regression-user', 'Backup Regression');

  // Two immediate snapshots used to collide because the filename discarded
  // milliseconds. Each call must produce a distinct, non-empty SQLite file.
  const first = await store.createDatabaseBackup();
  const second = await store.createDatabaseBackup();
  assert.notEqual(first.fileName, second.fileName, 'backup calls must not reuse a destination filename');

  const files = (await readdir(process.env.SELLIFY_BACKUP_DIR))
    .filter(file => file.startsWith('sellify-') && file.endsWith('.sqlite'));
  assert.equal(files.length, 2, 'both immediate backups must be retained');
  for (const file of files) {
    assert.ok((await stat(path.join(process.env.SELLIFY_BACKUP_DIR, file))).size > 0, `backup ${file} must be non-empty`);
  }
  console.log('Database backup collision regression passed.');
} finally {
  await rm(root, { recursive: true, force: true });
}
