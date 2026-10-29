// Pure catalog identity contract shared by Warehouse UI and Node regressions.
// Canonical item_type is authoritative; type is only the legacy fallback.
export function isServiceCatalogItem(p) {
  return String(p?.item_type ?? p?.type ?? '').trim().toLowerCase() === 'service';
}
