// Ecosystem Add (+) entry point.
// This is navigation/composition only: domain actions remain owned by their existing screens.
import { switchTab } from './tabs.js';

export const ADD_MENU_ACTIONS = Object.freeze([
  Object.freeze({ id: 'take-order', destination: 'order' }),
  Object.freeze({ id: 'add-product', destination: 'catalog' }),
  Object.freeze({ id: 'discover-marketplace', destination: 'marketplace' }),
  Object.freeze({ id: 'configure-packs-and-channels', destination: 'settings' }),
  Object.freeze({ id: 'business-setup', destination: 'settings' }),
]);

function getSheet() {
  return typeof document === 'undefined' ? null : document.getElementById('addSheet');
}

export function openAddSheet() {
  const sheet = getSheet();
  if (!sheet) return false;
  sheet.style.display = 'flex';
  sheet.classList.add('open');
  return true;
}

export function closeAddSheet() {
  const sheet = getSheet();
  if (!sheet) return false;
  sheet.classList.remove('open');
  sheet.style.display = 'none';
  return true;
}

export function openAddProduct() {
  closeAddSheet();
  switchTab('catalog');
  const input = typeof document === 'undefined' ? null : document.getElementById('newProdName');
  if (input) {
    window.setTimeout(() => {
      input.focus();
      input.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 80);
  }
  return true;
}

export function openAddSettings() {
  closeAddSheet();
  const button = typeof document === 'undefined' ? null : document.getElementById('gearSettingsBtn');
  if (button) button.click();
  return !!button;
}
