// ui/toast.js
// Phase 7 extraction (see modularization plan §5): the toast/undo-toast
// helpers — moved out of main.js unchanged.
import { escapeHtml } from '../utils/index.js';
import { t } from './i18n.js';

let toastTimer;
let toastUndoHandler = null;

export function showToast(msg) {
  showUndoToast(msg, null);
}

// Toast with an optional inline Undo action, reusing the same #toast element.
// Used by the optimistic delete/serve flows so a destructive action is
// instantly reversible instead of gated behind a confirm() dialog.
export function showUndoToast(msg, onUndo) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  clearTimeout(toastTimer);
  toastUndoHandler = onUndo;
  toast.innerHTML = onUndo
    ? `<span>${escapeHtml(msg)}</span><button type="button" class="toast-undo-btn" onclick="handleToastUndo()"><svg class="icon icon-sm"><use href="#i-undo"/></svg> ${t('undo')}</button>`
    : escapeHtml(msg);
  toast.classList.add('show');
  const duration = onUndo ? 5000 : 2200;
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    toastUndoHandler = null;
  }, duration);
}

export function handleToastUndo() {
  const toast = document.getElementById('toast');
  const handler = toastUndoHandler;
  toastUndoHandler = null;
  clearTimeout(toastTimer);
  if (toast) toast.classList.remove('show');
  if (handler) handler();
}
