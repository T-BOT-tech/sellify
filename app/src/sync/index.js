// sync/index.js
// Phase 5 extraction (see modularization plan §5): syncNow() is the single
// entry point the "Sync now" UI calls — it fans out to orders.js and
// catalog.js and reports a combined toast. Moved out of main.js unchanged.
import { config } from '../state.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { t } from '../ui/i18n.js';
import { openSettings } from '../ui/settings.js';
import { showToast } from '../ui/toast.js';
import { syncOrders } from './orders.js';
import { syncCatalog } from './catalog.js';
import { flushOutbox } from './outbox.js';

export async function syncNow() {
  if (!config.syncUrl || !config.chatId) {
    showToast(t('setSettingsFirst'));
    openSettings();
    return;
  }
  if (!navigator.onLine) {
    showToast(t('noConnection'));
    return;
  }

  showToast(t('syncing'));
  const orderResult = await syncOrders();
  const catalogResult = await syncCatalog();
  const outboxResult = await flushOutbox();

  const parts = [];
  if (orderResult) parts.push(orderResult);
  if (catalogResult) parts.push(catalogResult);
  if (outboxResult.processed) parts.push(`${outboxResult.processed} events synced`);
  showToast(parts.length ? parts.join(' · ') : t('nothingToSync'));
}
