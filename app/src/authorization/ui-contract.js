// FUX-2: frontend authorization contract.
// This module intentionally does NOT implement authorization. The server and
// existing canonical auth layer remain authoritative. It only normalizes the
// UI representation of an authorization result.
export const UI_AUTH = Object.freeze({
  HIDDEN: 'hidden',
  AUTHORIZED: 'authorized',
  REQUIRES_APPROVAL: 'requires_approval',
  DENIED: 'denied'
});

export function authorizationPresentation(result) {
  switch (result) {
    case 'ALLOW': return UI_AUTH.AUTHORIZED;
    case 'REQUIRES_APPROVAL': return UI_AUTH.REQUIRES_APPROVAL;
    case 'DENY': return UI_AUTH.DENIED;
    default: return UI_AUTH.HIDDEN;
  }
}
