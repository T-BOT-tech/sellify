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

// Atomically read, reconcile, and write one key inside a single readwrite
// transaction. The updater must be synchronous: awaiting inside an IndexedDB
// transaction can let the browser auto-commit before the write is queued.
function updateInTransaction(key, updater, additionalWrite = null) {
  if (typeof updater !== 'function') return Promise.reject(new TypeError('idbUpdate requires an updater function'));
  return idbOpen().then(db => new Promise((resolve, reject) => {
    let nextValue;
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => {
      try {
        nextValue = updater(request.result !== undefined ? request.result : null);
        if (nextValue === undefined) throw new TypeError('idbUpdate updater must return a value');
        store.put(nextValue, key);
        const sidecars = Array.isArray(additionalWrite) ? additionalWrite : additionalWrite ? [additionalWrite] : [];
        for (const sidecar of sidecars) {
          if (typeof sidecar.update === 'function') {
            // Read-modify-write sidecars inside this same transaction. This is
            // needed for shared ledgers where replacing a previously-read
            // snapshot could erase another tab's committed entries.
            const sidecarRequest = store.get(sidecar.key);
            sidecarRequest.onsuccess = () => {
              try {
                const current = sidecarRequest.result !== undefined ? sidecarRequest.result : null;
                const sidecarValue = sidecar.update(current, nextValue);
                if (sidecarValue === undefined) throw new TypeError('IndexedDB sidecar updater must return a value');
                store.put(sidecarValue, sidecar.key);
              } catch (error) {
                try { tx.abort(); } catch {}
                reject(error);
              }
            };
            sidecarRequest.onerror = () => {
              try { tx.abort(); } catch {}
              reject(sidecarRequest.error || new Error('IndexedDB sidecar read failed for ' + sidecar.key));
            };
          } else {
            const sidecarValue = typeof sidecar.value === 'function'
              ? sidecar.value(nextValue)
              : sidecar.value;
            store.put(sidecarValue, sidecar.key);
          }
        }
      } catch (error) {
        try { tx.abort(); } catch {}
        reject(error);
      }
    };
    request.onerror = () => {
      try { tx.abort(); } catch {}
      reject(request.error || new Error('IndexedDB update read failed for ' + key));
    };
    tx.oncomplete = () => resolve(nextValue);
    tx.onerror = () => reject(tx.error || new Error('IndexedDB update failed for ' + key));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB update transaction aborted for ' + key));
  }));
}

export function idbUpdate(key, updater) {
  return updateInTransaction(key, updater);
}

// Commit an outbox value and its recovery-journal marker in one readwrite
// transaction so hydration can distinguish a journal ahead of an interrupted
// write from a stale journal left behind by a successful commit.
export function idbUpdateAndSet(key, updater, sidecarKey, sidecarValue) {
  if (!sidecarKey) return Promise.reject(new TypeError('idbUpdateAndSet requires a sidecar key'));
  // Accept one sidecar for existing callers or multiple sidecars for atomic
  // outbox + recovery-marker + fallback-checkpoint commits.
  const sidecars = Array.isArray(sidecarKey) ? sidecarKey : [{ key: sidecarKey, value: sidecarValue }];
  // Sidecar factories run after the updater, still inside the same transaction.
  // This lets the outbox derive its recovery marker from a journal write that is
  // serialized by the IndexedDB transaction itself when Web Locks are unavailable.
  return updateInTransaction(key, updater, sidecars);
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

// Read every requested key from one readonly snapshot. Used by boot hydration
// and migration; callers may rely on related keys coming from the same commit.
export function idbGetAll(keys) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readonly');
    const store = tx.objectStore(IDB_STORE_NAME);
    const values = {};
    let rejected = false;
    for (const key of keys) {
      const request = store.get(key);
      request.onsuccess = () => {
        values[key] = request.result !== undefined ? request.result : null;
      };
      request.onerror = () => {
        if (rejected) return;
        rejected = true;
        try { tx.abort(); } catch {}
        reject(request.error || new Error('IndexedDB get failed for ' + key));
      };
    }
    tx.oncomplete = () => resolve(values);
    tx.onerror = () => reject(tx.error || new Error('IndexedDB getAll failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB getAll transaction aborted'));
  }));
}
