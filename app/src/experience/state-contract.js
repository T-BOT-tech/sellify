// FUX-6: Global UI state contract.
// Semantic UI states are shared across channels; they never imply a server
// result unless the canonical authority has confirmed it.
export const UI_STATES = Object.freeze({
  LOADING: 'loading',
  EMPTY: 'empty',
  PARTIAL: 'partial',
  OFFLINE: 'offline',
  QUEUED: 'queued',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  FAILURE: 'failure',
  CONFLICT: 'conflict',
  UNKNOWN: 'unknown',
  PERMISSION_DENIED: 'permission_denied',
  SESSION_EXPIRED: 'session_expired',
  PROVIDER_UNAVAILABLE: 'provider_unavailable'
});

export const CONFIRMED_SERVER_STATES = Object.freeze(new Set([
  UI_STATES.SUCCESS,
  UI_STATES.FAILURE,
  UI_STATES.CONFLICT,
  UI_STATES.PERMISSION_DENIED,
  UI_STATES.SESSION_EXPIRED,
  UI_STATES.PROVIDER_UNAVAILABLE
]));

export function isTerminalState(state) {
  return CONFIRMED_SERVER_STATES.has(state);
}

export function isConfirmedSuccess(state) {
  return state === UI_STATES.SUCCESS;
}

export function assertNotFalseSuccess(state) {
  if ([UI_STATES.QUEUED, UI_STATES.SYNCING, UI_STATES.OFFLINE, UI_STATES.UNKNOWN].includes(state)) {
    return false;
  }
  return true;
}
