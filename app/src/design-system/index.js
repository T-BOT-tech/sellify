// FUX-5: shared design-system contract.
// Existing styles.css owns the actual CSS tokens. This module is the stable
// semantic vocabulary consumed by new product surfaces so components do not
// invent their own state names or token semantics.
export const STATUS_VARIANTS = Object.freeze({
  success: 'success',
  info: 'info',
  warning: 'warning',
  danger: 'danger',
  neutral: 'neutral'
});

export const COMPONENT_CATEGORIES = Object.freeze({
  CORE: 'core',
  BUSINESS: 'business',
  STATE: 'state',
  NAVIGATION: 'navigation'
});

export function statusClass(variant = STATUS_VARIANTS.neutral) {
  return `fux-status fux-status-${variant}`;
}
