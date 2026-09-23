// products/modifiers.js
// Phase 4 extraction (see modularization plan §5): restaurant-mode item
// modifiers / per-line customization notes on the current order, moved out
// of main.js unchanged. modifierNoteEditingProductId is local state owned
// here (only this module reassigns it).
import { escapeHtml, escapeAttr } from '../utils/index.js';
import { products, currentOrderNotes } from '../state.js';
import { renderProducts } from './render.js';

let modifierNoteEditingProductId = null;

export function modifierNoteMarkup(p) {
  const note = currentOrderNotes[p.id];
  return note
    ? `<button type="button" class="modifier-note-btn" onclick="event.stopPropagation(); openModifierNoteModal('${p.id}')"><svg class="icon icon-sm"><use href="#i-edit"/></svg> ${escapeHtml(note)}</button>`
    : `<button type="button" class="modifier-note-btn" onclick="event.stopPropagation(); openModifierNoteModal('${p.id}')">+ Customize</button>`;
}

export function openModifierNoteModal(productId) {
  const p = products.find(prod => prod.id === productId);
  if (!p) return;
  modifierNoteEditingProductId = productId;
  document.getElementById('modifierNoteModalTitle').textContent = `Customize: ${p.name}`;
  const existingNote = currentOrderNotes[productId] || '';
  const existingParts = existingNote.split(',').map(s => s.trim()).filter(Boolean);
  const chipList = document.getElementById('modifierChipList');
  chipList.innerHTML = (p.modifiers || []).map(mod => {
    const checked = existingParts.includes(mod);
    return `<label class="modifier-chip ${checked ? 'checked' : ''}">
      <input type="checkbox" value="${escapeAttr(mod)}" ${checked ? 'checked' : ''} onchange="this.closest('label').classList.toggle('checked', this.checked)">${escapeHtml(mod)}
    </label>`;
  }).join('');
  const knownMods = p.modifiers || [];
  const freeText = existingParts.filter(part => !knownMods.includes(part)).join(', ');
  document.getElementById('modifierFreeText').value = freeText;
  document.getElementById('modifierNoteModal').style.display = 'flex';
}

export function closeModifierNoteModal() {
  document.getElementById('modifierNoteModal').style.display = 'none';
  modifierNoteEditingProductId = null;
}

export function saveModifierNote() {
  if (!modifierNoteEditingProductId) return;
  const checked = Array.from(document.querySelectorAll('#modifierChipList input[type="checkbox"]:checked')).map(el => el.value);
  const freeText = document.getElementById('modifierFreeText').value.trim();
  const allParts = freeText ? checked.concat([freeText]) : checked;
  if (allParts.length) currentOrderNotes[modifierNoteEditingProductId] = allParts.join(', ');
  else delete currentOrderNotes[modifierNoteEditingProductId];
  closeModifierNoteModal();
  renderProducts();
}
