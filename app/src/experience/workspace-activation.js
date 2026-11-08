// Pure workspace activation decision. Keep this independent of browser/UI imports
// so the role- and catalog-aware choice can be tested without a DOM runtime.
export function getWorkspaceActivationAction({ offeringCount = 0, canAddOffering = false } = {}) {
  if (Number(offeringCount) > 0) return 'TAKE_ORDER';
  return canAddOffering ? 'SET_UP_CATALOG' : 'CATALOG_SETUP_REQUIRED';
}
