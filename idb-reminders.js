// idb-reminders.js
// ----------------------------------------------------------------------------
// Tiny IndexedDB wrapper for the local reminder schedule. Plain script (no
// ES module syntax) on purpose: it's loaded two different ways —
//   - in the page, via <script src="idb-reminders.js" defer>
//   - in the service worker, via importScripts("idb-reminders.js")
// IndexedDB (unlike localStorage) is available in both contexts, which is
// why reminders live here instead of localStorage — the service worker
// needs to be able to read/update the schedule on its own during a
// periodic background sync, without the page being open.
//
// Reminder item shapes:
//   { id, type: "recurring-daily",  hour, minute, title_am, title_en, body_am, body_en, lastFiredDateKey }
//   { id, type: "recurring-weekly", weekday, hour, minute, title_am, title_en, body_am, body_en, lastFiredWeekKey }
//   { id, type: "one-off",          fireAt, title_am, title_en, body_am, body_en, fired }
// ----------------------------------------------------------------------------

var RemindersDB = (function () {
  var DB_NAME = "campus-connect-reminders";
  var STORE = "reminders";
  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function getAll() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readonly");
        var req = tx.objectStore(STORE).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function get(id) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readonly");
        var req = tx.objectStore(STORE).get(id);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function put(item) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(item);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function remove(id) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  return { getAll: getAll, get: get, put: put, remove: remove };
})();

// Expose in whichever global scope we're running in (window or the
// service worker's self).
(function (root) { root.RemindersDB = RemindersDB; })(typeof self !== "undefined" ? self : this);
