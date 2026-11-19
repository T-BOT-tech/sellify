import { appendInventoryMovement, getTenant, processSyncEvent } from '../backend/lib/store-sqlite.js';

const chatId = String(process.argv[2] || '');
if (!chatId) throw new Error('chatId argument is required');

// Open and initialize this process's independent SQLite connection before the
// parent releases the competing commands.
await getTenant(chatId);
process.stdout.write('READY\n');

let input = '';
for await (const chunk of process.stdin) input += chunk;
const { command, event, actor, mode } = JSON.parse(input);
try {
  if (mode === 'sync-event') {
    const result = await processSyncEvent(chatId, event, actor || null);
    process.stdout.write(JSON.stringify({ ok: true, result }) + '\n');
  } else {
    const movement = await appendInventoryMovement(chatId, command, actor || null);
    process.stdout.write(JSON.stringify({ ok: true, id: movement.id }) + '\n');
  }
} catch (error) {
  process.stdout.write(JSON.stringify({
    ok: false,
    statusCode: error?.statusCode || null,
    code: error?.code || null,
    message: error?.message || String(error),
  }) + '\n');
}
