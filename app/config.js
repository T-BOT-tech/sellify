// config.js — local/deployment config, NOT meant to be committed with real
// values. This file exists so a fresh checkout has something to load (see
// index.html's <script src="config.js">) without a 404. Copy the pattern
// from config.js.example and fill in real values per environment, or leave
// as-is to run fully offline with no default sync server.
//
// See config.js.example for full documentation of each key.
//
// Phase 1 note: when this app is served BY the merged backend
// (backend/server.js with STATIC_DIR pointing here), the backend serves
// /config.js itself at request time instead of this static file — see
// handleConfigJs in server.js — and defaults SYNC_SERVER_URL to same-origin
// automatically. This static file only matters if you serve app/ on its
// own (e.g. a plain static host, frontend-only local dev).

window.__APP_CONFIG__ = {
  SYNC_SERVER_URL: ''
};
