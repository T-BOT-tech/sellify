// experience/business-readiness.js
// J1 — Start Business: a presentation-only readiness projection.
// Existing persisted app config and catalog state remain the only inputs;
// this module does not persist state or claim backend/payment certification.

export function getBusinessReadiness({ config = {}, catalogItems = [] } = {}) {
  const businessNameReady = typeof config.sellerName === 'string' && config.sellerName.trim().length > 0;
  const currencyReady = typeof config.currencyCode === 'string' && config.currencyCode.trim().length > 0;
  const profileReady = businessNameReady && currencyReady;
  const catalogReady = Array.isArray(catalogItems) && catalogItems.length > 0;
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
        ? `${catalogItems.length} catalog item${catalogItems.length === 1 ? '' : 's'} available.`
        : 'Add a product or menu item before taking an order.',
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
