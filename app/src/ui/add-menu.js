// Ecosystem Add (+) entry point.
// This is navigation/composition only: domain actions remain owned by their existing screens.
export const ADD_MENU_ACTIONS = Object.freeze([
  Object.freeze({ id: 'take-order', destination: 'order' }),
  Object.freeze({ id: 'add-product', destination: 'catalog' }),
  Object.freeze({ id: 'discover-marketplace', destination: 'marketplace' }),
  Object.freeze({ id: 'configure-packs', destination: 'settings', target: 'packReadinessPanel' }),
  Object.freeze({ id: 'connect-sales-channels', destination: 'settings', target: 'sellerStorefrontChannelsPanel' }),
  Object.freeze({ id: 'business-setup', destination: 'settings', target: 'setBusinessModel' }),
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
  if (typeof window !== 'undefined' && typeof window.switchTab === 'function') window.switchTab('catalog');
  const input = typeof document === 'undefined' ? null : document.getElementById('newProdName');
  if (input) {
    window.setTimeout(() => {
      input.focus();
      input.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 80);
  }
  return true;
}

// Opens the existing Settings surface and takes the user to the relevant section.
// This does not create a second settings, pack, or channel authority.
export function openAddSettings(section = 'packs-and-channels') {
  closeAddSheet();
  const button = typeof document === 'undefined' ? null : document.getElementById('gearSettingsBtn');
  if (!button) return false;

  const targetIds = {
    'configure-packs': 'packReadinessPanel',
    'connect-sales-channels': 'sellerStorefrontChannelsPanel',
    'business-setup': 'setBusinessModel',
  };
  const targetId = targetIds[section];
  if (!targetId) return false;
  const target = document.getElementById(targetId);
  if (!target) return false;
  button.click();

  if (target && typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
    window.setTimeout(() => {
      target.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      if (section === 'business-setup') target.focus?.();
    }, 80);
  }
  return true;
}
