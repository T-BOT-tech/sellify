// experience/business-readiness.js
// J1 — Start Business: a presentation-only readiness projection.
// Existing persisted app config and catalog state remain the only inputs;
// this module does not persist state or claim backend/payment certification.

function isSaleableCatalogItem(item) {
  return !!item
    && typeof item === 'object'
    && typeof item.id === 'string'
    && item.id.trim().length > 0
    && typeof item.name === 'string'
    && item.name.trim().length > 0
    && Number.isFinite(Number(item.price))
    && Number(item.price) >= 0;
}

export function getBusinessReadiness({ config = {}, catalogItems = [] } = {}) {
  const businessNameReady = typeof config.sellerName === 'string' && config.sellerName.trim().length > 0;
  const currencyCodeReady = typeof config.currencyCode === 'string' && config.currencyCode.trim().length > 0;
  // A seeded fallback (currently INR) is not evidence that the merchant
  // explicitly reviewed their currency. Settings owns this persisted flag.
  const customCurrencyReady = config.currencyCode !== 'CUSTOM'
    || (typeof config.currencySymbol === 'string' && config.currencySymbol.trim().length > 0);
  const currencyReady = config.currencyConfirmed === true && currencyCodeReady && customCurrencyReady;
  const profileReady = businessNameReady && currencyReady;
  const saleableItems = Array.isArray(catalogItems) ? catalogItems.filter(isSaleableCatalogItem) : [];
  const catalogReady = saleableItems.length > 0;
  const readyToTakeOrders = profileReady && catalogReady;

  const steps = [
    {
      id: 'business-profile',
      label: 'Business profile',
      complete: profileReady,
      action: profileReady ? null : 'settings',
      detail: profileReady
        ? 'Business name and currency are set.'
        : 'Add your business name and confirm its currency.',
    },
    {
      id: 'first-item',
      label: 'First item',
      complete: catalogReady,
      action: catalogReady ? null : 'catalog',
      detail: catalogReady
        ? `${saleableItems.length} valid catalog item${saleableItems.length === 1 ? '' : 's'} available.`
        : 'Add a product or menu item with a name and valid price before taking an order.',
    },
  ];

  return Object.freeze({
    status: readyToTakeOrders ? 'ready' : (profileReady || catalogReady ? 'in_progress' : 'setup_needed'),
    readyToTakeOrders,
    completedSteps: steps.filter(step => step.complete).length,
    totalSteps: steps.length,
    nextAction: readyToTakeOrders ? 'order' : (profileReady ? 'catalog' : 'settings'),
    steps: Object.freeze(steps.map(step => Object.freeze(step))),
    authority: 'app/src/state.js#config + app/src/state.js#products',
    financialReadinessCertified: false,
  });
}
