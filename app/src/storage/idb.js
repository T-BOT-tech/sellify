// storage/idb.js
// Phase 2 extraction (see modularization plan §5): the IndexedDB key/value
// wrapper, moved out of main.js unchanged. Vanilla IndexedDB, zero
// dependencies. Exposes a tiny Promise-based get/set/delete API over a
// single object store, keyed by the same strings used in STORAGE_KEYS.

import { IDB_DB_NAME, IDB_DB_VERSION, IDB_STORE_NAME } from '../constants.js';

// Single shared "open" promise so every caller reuses the same connection instead
// of re-opening the database on every read/write.
let _idbConnPromise = null;

// Tracks whether IndexedDB is usable at all in this browser/session (private-mode
// Safari, disabled storage, corrupted DB, etc. can all make it unavailable). Callers
// can check this after the first failed operation to decide whether to fall back.
//
// This is a plain module-level `let`, not re-exported directly: per the state.js
// live-binding rule (see modularization plan §1, Rule 1), other modules can only
// ever *reassign* it through the setter below — reading it goes through the
// getter so callers always see the current value.
let idbUnavailable = false;

export function isIdbUnavailable() {
  return idbUnavailable;
}

export function setIdbUnavailable(value) {
  idbUnavailable = value;
}

export function idbOpen() {
  if (_idbConnPromise) return _idbConnPromise;

  _idbConnPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      idbUnavailable = true;
      reject(new Error('IndexedDB not supported in this browser'));
      return;
    }

    let request;
    try {
      request = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION);
    } catch (e) {
      idbUnavailable = true;
      reject(e);
      return;
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      // If the connection is closed unexpectedly (e.g. another tab deletes the
      // DB), drop the cached promise so the next call re-opens instead of
      // reusing a dead connection.
      db.onclose = () => { _idbConnPromise = null; };
      db.onversionchange = () => { db.close(); _idbConnPromise = null; };
      resolve(db);
    };

    request.onerror = (event) => {
      idbUnavailable = true;
      _idbConnPromise = null;
      reject(event.target.error || new Error('IndexedDB open failed'));
    };

    request.onblocked = () => {
      // Another tab is holding an older-version connection open. Don't hang
      // forever — reject so callers can fall back rather than stall.
      idbUnavailable = true;
      _idbConnPromise = null;
      reject(new Error('IndexedDB open blocked by another tab'));
    };
  });

  return _idbConnPromise;
}

export function idbGet(key) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readonly');
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
    req.onerror = () => reject(req.error || new Error('IndexedDB get failed for ' + key));
  }));
}

export function idbSet(key, value) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    store.put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error('IndexedDB set failed for ' + key));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted for ' + key));
  }));
}

export function idbDelete(key) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error('IndexedDB delete failed for ' + key));
  }));
}

// Read every key at once. Used by the boot-time hydration step and by the
// migration routine. Returns a plain object of { key: value }.
export function idbGetAll(keys) {
  return Promise.all(keys.map(k => idbGet(k).then(v => [k, v])))
    .then(pairs => Object.fromEntries(pairs));
}
