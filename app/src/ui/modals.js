// ui/modals.js
// Phase 7 extraction (see modularization plan §5): the app-wide Escape-key
// handler and the generic modal-sheet focus trap — moved out of main.js
// unchanged. Both are side-effect-only (they wire document-level listeners
// on import); nothing here is called directly by other modules, so this
// file exports nothing — importing it for its side effect is the point,
// same as the IIFE in ui/tabs.js.
import { closeImageModal } from '../products/images.js';
import { closePinModal } from '../auth/pin.js';

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeImageModal();
    if (typeof closePinModal === 'function') closePinModal();
  }
});

// ---------- W4: sheet focus trap / restore / Escape-to-close ----------
// There are ~15 open*Modal()/close*Modal() function pairs in this file, and
// they don't share one code path: some toggle a `.open` class, others set
// `style.display` directly. Rather than touch every pair, this watches all
// `.modal-backdrop` elements generically via MutationObserver — whichever
// mechanism a given modal uses, becoming visible or hidden is always a
// class or style attribute mutation, so one observer covers all of them
// with zero changes to the existing open/close functions.
(function initSheetFocusManager() {
  let lastFocused = null;
  let openBackdrop = null;

  function isVisible(el) {
    return el.classList.contains('open') || el.style.display === 'flex';
  }
  function focusablesIn(container) {
    return Array.from(container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetParent !== null);
  }
  function onBackdropOpened(backdrop) {
    openBackdrop = backdrop;
    lastFocused = document.activeElement;
    const sheet = backdrop.querySelector('.modal');
    const focusables = sheet ? focusablesIn(sheet) : [];
    if (focusables.length) focusables[0].focus();
  }
  function onBackdropClosed() {
    openBackdrop = null;
    if (lastFocused && document.body.contains(lastFocused)) lastFocused.focus();
    lastFocused = null;
  }

  document.addEventListener('keydown', (e) => {
    if (!openBackdrop || !isVisible(openBackdrop)) return;
    if (e.key === 'Tab') {
      const sheet = openBackdrop.querySelector('.modal');
      if (!sheet) return;
      const focusables = focusablesIn(sheet);
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    // Escape is intentionally NOT wired to auto-close here: several sheets
    // (payment proof, checkout) shouldn't silently discard input on a stray
    // key. Individual close*Modal() functions remain the source of truth
    // for what "cancel" means on that screen.
  });

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      const el = m.target;
      if (!(el instanceof Element) || !el.classList.contains('modal-backdrop')) continue;
      const visible = isVisible(el);
      if (visible && openBackdrop !== el) onBackdropOpened(el);
      else if (!visible && openBackdrop === el) onBackdropClosed();
    }
  });
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.modal-backdrop').forEach(el => {
      observer.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
    });
  });
})();
