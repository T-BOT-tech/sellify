import { appendInventoryMovement, getTenant } from '../backend/lib/store-sqlite.js';

const chatId = String(process.argv[2] || '');
if (!chatId) throw new Error('chatId argument is required');

// Open and initialize this process's independent SQLite connection before the
// parent releases the competing commands.
await getTenant(chatId);
process.stdout.write('READY\n');

let input = '';
for await (const chunk of process.stdin) input += chunk;
const { command, actor } = JSON.parse(input);
try {
  const movement = await appendInventoryMovement(chatId, command, actor || null);
  process.stdout.write(JSON.stringify({ ok: true, id: movement.id }) + '\n');
} catch (error) {
  process.stdout.write(JSON.stringify({
    ok: false,
    statusCode: error?.statusCode || null,
    code: error?.code || null,
    message: error?.message || String(error),
  }) + '\n');
}
