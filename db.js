// db.js
// ----------------------------------------------------------------------------
// All Supabase reads/writes live here, one function per feature. Each getter
// returns data already shaped the way app.js's render functions expect
// (e.g. profile.birthday = {day, month, year}), so app.js itself doesn't
// need to know anything about table/column names.
// ----------------------------------------------------------------------------

(function () {
  "use strict";

  function sb() { return window.supabaseClient; }

  function logIfError(where, error) {
    if (error) console.error("[DB] " + where + ":", error.message || error);
  }

  function mapProfile(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      gender: row.gender,
      university: row.university || "",
      city: row.city || "",
      birthday: (row.bday_day && row.bday_month)
        ? { day: row.bday_day, month: row.bday_month, year: row.bday_year || null }
        : null
    };
  }

  /* ---------------- profile / directory ---------------- */

  async function getMyProfile(userId) {
    var { data, error } = await sb().from("profiles").select("*").eq("id", userId).maybeSingle();
    logIfError("getMyProfile", error);
    return mapProfile(data);
  }

  async function saveMyProfile(userId, profile) {
    var row = {
      id: userId,
      name: profile.name,
      gender: profile.gender,
      university: profile.university || "",
      city: profile.city || "",
      bday_day: profile.birthday ? profile.birthday.day : null,
      bday_month: profile.birthday ? profile.birthday.month : null,
      bday_year: profile.birthday ? profile.birthday.year : null
    };
    var { error } = await sb().from("profiles").upsert(row);
    logIfError("saveMyProfile", error);
    return !error;
  }

  async function getDirectory() {
    var { data, error } = await sb().from("profiles").select("*").order("name", { ascending: true });
    logIfError("getDirectory", error);
    return (data || []).map(mapProfile);
  }

  /* ---------------- feed ---------------- */

  async function getFeed() {
    var { data, error } = await sb()
      .from("feed_posts")
      .select("id, text, created_at, profiles(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    logIfError("getFeed", error);
    return (data || []).map(function (r) {
      return {
        id: r.id,
        author: (r.profiles && r.profiles.name) || "—",
        text: r.text,
        time: new Date(r.created_at).getTime()
      };
    });
  }

  async function createPost(userId, text) {
    var { error } = await sb().from("feed_posts").insert({ author_id: userId, text: text });
    logIfError("createPost", error);
    return !error;
  }

  /* ---------------- events ---------------- */

  async function getEvents() {
    var { data, error } = await sb().from("events").select("*").order("event_date", { ascending: true });
    logIfError("getEvents", error);
    return (data || []).map(function (r) {
      return { id: r.id, title_am: r.title_am, title_en: r.title_en, date: r.event_date, type: r.type, note: r.note };
    });
  }

  async function createEvent(userId, ev) {
    var { error } = await sb().from("events").insert({
      title_am: ev.title_am,
      title_en: ev.title_en,
      event_date: ev.date,
      type: ev.type || "assembly",
      note: ev.note || null,
      created_by: userId
    });
    logIfError("createEvent", error);
    return !error;
  }

  async function getMyRsvps(userId) {
    var { data, error } = await sb().from("event_rsvps").select("event_id").eq("user_id", userId);
    logIfError("getMyRsvps", error);
    return (data || []).map(function (r) { return r.event_id; });
  }

  async function setRsvp(userId, eventId, joining) {
    if (joining) {
      var { error } = await sb().from("event_rsvps").insert({ event_id: eventId, user_id: userId });
      if (error && error.code !== "23505") logIfError("setRsvp(insert)", error);
    } else {
      var { error: delErr } = await sb().from("event_rsvps")
        .delete().eq("event_id", eventId).eq("user_id", userId);
      logIfError("setRsvp(delete)", delErr);
    }
  }

  /* ---------------- prayer wall ---------------- */

  async function getPrayerWall() {
    var { data, error } = await sb()
      .from("prayer_requests")
      .select("id, text, is_anon, pray_count, created_at, profiles(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    logIfError("getPrayerWall", error);
    return (data || []).map(function (r) {
      return {
        id: r.id,
        text: r.text,
        anon: r.is_anon,
        author: r.is_anon ? null : ((r.profiles && r.profiles.name) || null),
        prayCount: r.pray_count
      };
    });
  }

  async function createPrayerRequest(userId, text, anon) {
    var { error } = await sb().from("prayer_requests").insert({ user_id: userId, text: text, is_anon: !!anon });
    logIfError("createPrayerRequest", error);
    return !error;
  }

  async function getMyPrayed(userId) {
    var { data, error } = await sb().from("prayer_reactions").select("request_id").eq("user_id", userId);
    logIfError("getMyPrayed", error);
    return (data || []).map(function (r) { return r.request_id; });
  }

  async function prayForRequest(userId, requestId) {
    var { error } = await sb().from("prayer_reactions").insert({ request_id: requestId, user_id: userId });
    if (error && error.code !== "23505") { logIfError("prayForRequest", error); return false; }
    return true;
  }

  /* ---------------- reading plan ---------------- */

  async function getMyReadingChecks(userId) {
    var { data, error } = await sb().from("reading_checks").select("day_index").eq("user_id", userId);
    logIfError("getMyReadingChecks", error);
    return (data || []).map(function (r) { return r.day_index; });
  }

  async function setReadingCheck(userId, dayIndex, checked) {
    if (checked) {
      var { error } = await sb().from("reading_checks").insert({ user_id: userId, day_index: dayIndex });
      if (error && error.code !== "23505") logIfError("setReadingCheck(insert)", error);
    } else {
      var { error: delErr } = await sb().from("reading_checks")
        .delete().eq("user_id", userId).eq("day_index", dayIndex);
      logIfError("setReadingCheck(delete)", delErr);
    }
  }

  /* ---------------- weekly group challenge ---------------- */

  async function getWeekCompletions(weekKey) {
    var { data, error } = await sb()
      .from("group_challenge_completions")
      .select("user_id, profiles(name)")
      .eq("week_key", weekKey);
    logIfError("getWeekCompletions", error);
    return (data || []).map(function (r) { return (r.profiles && r.profiles.name) || "—"; });
  }

  async function markWeekDone(userId, weekKey) {
    var { error } = await sb().from("group_challenge_completions")
      .insert({ week_key: weekKey, user_id: userId });
    if (error && error.code !== "23505") logIfError("markWeekDone", error);
  }

  window.DB = {
    getMyProfile: getMyProfile,
    saveMyProfile: saveMyProfile,
    getDirectory: getDirectory,
    getFeed: getFeed,
    createPost: createPost,
    getEvents: getEvents,
    createEvent: createEvent,
    getMyRsvps: getMyRsvps,
    setRsvp: setRsvp,
    getPrayerWall: getPrayerWall,
    createPrayerRequest: createPrayerRequest,
    getMyPrayed: getMyPrayed,
    prayForRequest: prayForRequest,
    getMyReadingChecks: getMyReadingChecks,
    setReadingCheck: setReadingCheck,
    getWeekCompletions: getWeekCompletions,
    markWeekDone: markWeekDone
  };
})();
