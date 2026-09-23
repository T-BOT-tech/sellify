// utils/index.js
// Phase 1 — leaf utilities. Each of these takes plain arguments and returns
// a value; none of them read `config`/`products`/`orders` or call another
// app function, so they're the lowest-risk cut in the whole migration.

export function uid() {
  return 'L' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Safe for HTML attribute contexts like src="${escapeAttr(url)}" — unlike
// escapeHtml(), this also encodes quotes, which is what actually matters for
// breaking out of an attribute value.
export function escapeAttr(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function formatElapsed(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

// W5: short relative-time label for the queue provenance line ("queued
// 4m ago"). Deliberately coarser than the kitchen's mm:ss timer — this
// isn't something that needs second-by-second escalation, just a sense
// of how long an order has been sitting unsynced.
export function formatElapsedShort(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'queued just now';
  if (min < 60) return `queued ${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `queued ${hrs}h ago`;
  return `queued ${Math.floor(hrs / 24)}d ago`;
}
