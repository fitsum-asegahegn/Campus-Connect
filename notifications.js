// notifications.js
// ----------------------------------------------------------------------------
// LOCAL notifications only — no server, no push service, no VAPID keys.
// Honest scope of what this can and can't do:
//
//   ✅ Fires a real notification in the OS notification bar when the app
//      (or its service worker) is running and a scheduled reminder is due.
//   ✅ Checks for due reminders every time the app is opened, and every
//      60 seconds while it stays open in a tab.
//   ✅ Best-effort "Periodic Background Sync" registration, which lets
//      Chrome/Edge on Android (and some desktop cases), for an *installed*
//      PWA the user opens somewhat regularly, occasionally wake the service
//      worker in the background to check for due reminders even when the
//      app isn't open. Support for this varies by browser/OS and is NOT
//      guaranteed — iOS Safari does not support it at all.
//   ❌ This is NOT the same as a real push notification service. A
//      reminder scheduled for 8:00 AM will reliably fire at 8:00 AM only
//      if the app or its periodic sync happens to run around then. For a
//      guaranteed-timing system (e.g. "everyone gets pinged at exactly
//      8:00 AM"), you'd need real Web Push from a server — see README.md.
// ----------------------------------------------------------------------------

var Notifications = (function () {
  "use strict";

  function isSupported() {
    return "Notification" in window && "serviceWorker" in navigator && "indexedDB" in window;
  }

  function permission() {
    return isSupported() ? Notification.permission : "unsupported";
  }

  async function requestPermission() {
    if (!isSupported()) return "unsupported";
    var result = await Notification.requestPermission();
    if (result === "granted") registerPeriodicSync();
    return result;
  }

  async function showLocalNotification(title, body, tag) {
    if (permission() !== "granted") return;
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        var reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, {
          body: body,
          icon: "icons/icon-192.png",
          badge: "icons/icon-192.png",
          tag: tag
        });
      } else {
        new Notification(title, { body: body, icon: "icons/icon-192.png" });
      }
    } catch (e) {
      console.warn("showLocalNotification failed:", e);
    }
  }

  async function registerPeriodicSync() {
    try {
      var reg = await navigator.serviceWorker.ready;
      if (!("periodicSync" in reg)) return false;
      var status = await navigator.permissions.query({ name: "periodic-background-sync" });
      if (status.state !== "granted") return false;
      await reg.periodicSync.register("campus-connect-check", { minInterval: 12 * 60 * 60 * 1000 });
      return true;
    } catch (e) {
      return false; // not supported on this browser — that's fine, foreground checks still work
    }
  }

  /* ---------------- scheduling helpers ---------------- */

  async function enableDailyVerse(hour, minute, textPair) {
    await RemindersDB.put({
      id: "daily-verse",
      type: "recurring-daily",
      hour: hour, minute: minute,
      title_am: textPair.title_am, title_en: textPair.title_en,
      body_am: textPair.body_am, body_en: textPair.body_en,
      lastFiredDateKey: null
    });
  }
  async function disableDailyVerse() { await RemindersDB.remove("daily-verse"); }

  async function enableWeeklyChallenge(weekday, hour, minute, textPair) {
    await RemindersDB.put({
      id: "weekly-challenge",
      type: "recurring-weekly",
      weekday: weekday, hour: hour, minute: minute,
      title_am: textPair.title_am, title_en: textPair.title_en,
      body_am: textPair.body_am, body_en: textPair.body_en,
      lastFiredWeekKey: null
    });
  }
  async function disableWeeklyChallenge() { await RemindersDB.remove("weekly-challenge"); }

  async function isEnabled(id) {
    var item = await RemindersDB.get(id);
    return !!item;
  }

  // One-off reminder for a specific event a person RSVP'd to. Fires at
  // 18:00 the evening before, or immediately-ish if the event is sooner
  // than that.
  async function scheduleEventReminder(eventId, eventDateStr, textPair) {
    var eventDate = new Date(eventDateStr + "T00:00:00");
    var reminderTime = new Date(eventDate.getTime());
    reminderTime.setDate(reminderTime.getDate() - 1);
    reminderTime.setHours(18, 0, 0, 0);

    var fireAt = reminderTime.getTime();
    if (fireAt < Date.now()) fireAt = Date.now() + 60 * 1000; // event is very soon — remind shortly

    await RemindersDB.put({
      id: "event-" + eventId,
      type: "one-off",
      fireAt: fireAt,
      title_am: textPair.title_am, title_en: textPair.title_en,
      body_am: textPair.body_am, body_en: textPair.body_en,
      fired: false
    });
  }
  async function cancelEventReminder(eventId) { await RemindersDB.remove("event-" + eventId); }

  /* ---------------- due-check loop (foreground) ---------------- */

  function todayKey(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function weekKeyLocal(d) {
    var onejan = new Date(d.getFullYear(), 0, 1);
    var week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return d.getFullYear() + "-W" + week;
  }

  function isDue(r, now) {
    if (r.type === "one-off") return !r.fired && r.fireAt <= now.getTime();
    if (r.type === "recurring-daily") {
      var target = new Date(now); target.setHours(r.hour, r.minute, 0, 0);
      return now.getTime() >= target.getTime() && r.lastFiredDateKey !== todayKey(now);
    }
    if (r.type === "recurring-weekly") {
      var targetW = new Date(now); targetW.setHours(r.hour, r.minute, 0, 0);
      return now.getDay() === r.weekday && now.getTime() >= targetW.getTime() && r.lastFiredWeekKey !== weekKeyLocal(now);
    }
    return false;
  }

  async function checkDue(lang) {
    if (permission() !== "granted") return;
    var items = await RemindersDB.getAll();
    var now = new Date();
    for (var i = 0; i < items.length; i++) {
      var r = items[i];
      if (isDue(r, now)) {
        var title = lang === "am" ? r.title_am : r.title_en;
        var body = lang === "am" ? r.body_am : r.body_en;
        await showLocalNotification(title, body, r.id);
        if (r.type === "one-off") { r.fired = true; }
        if (r.type === "recurring-daily") { r.lastFiredDateKey = todayKey(now); }
        if (r.type === "recurring-weekly") { r.lastFiredWeekKey = weekKeyLocal(now); }
        await RemindersDB.put(r);
      }
    }
  }

  var watcherHandle = null;
  function startWatcher(getLang) {
    checkDue(getLang());
    if (watcherHandle) clearInterval(watcherHandle);
    watcherHandle = setInterval(function () { checkDue(getLang()); }, 60 * 1000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") checkDue(getLang());
    });
  }

  return {
    isSupported: isSupported,
    permission: permission,
    requestPermission: requestPermission,
    enableDailyVerse: enableDailyVerse,
    disableDailyVerse: disableDailyVerse,
    enableWeeklyChallenge: enableWeeklyChallenge,
    disableWeeklyChallenge: disableWeeklyChallenge,
    isEnabled: isEnabled,
    scheduleEventReminder: scheduleEventReminder,
    cancelEventReminder: cancelEventReminder,
    startWatcher: startWatcher
  };
})();
