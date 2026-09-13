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
      phone: row.phone || "",
      avatarIcon: row.avatar_icon || null,
      avatarColor: row.avatar_color || null,
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
      phone: profile.phone || "",
      avatar_icon: profile.avatarIcon || null,
      avatar_color: profile.avatarColor || null,
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

  function getPostImageUrl(path) {
    if (!path) return null;
    var { data } = sb().storage.from("post-images").getPublicUrl(path);
    return data ? data.publicUrl : null;
  }

  async function uploadPostImage(userId, file) {
    var extMatch = /\.([a-zA-Z0-9]+)$/.exec(file.name || "");
    var ext = (extMatch ? extMatch[1] : "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    var path = userId + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
    var { error } = await sb().storage.from("post-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined
    });
    if (error) { logIfError("uploadPostImage", error); return null; }
    return path;
  }

  async function getFeed() {
    var { data, error } = await sb()
      .from("feed_posts")
      .select("id, text, image_path, created_at, profiles(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    logIfError("getFeed", error);
    return (data || []).map(function (r) {
      return {
        id: r.id,
        author: (r.profiles && r.profiles.name) || "—",
        text: r.text,
        time: new Date(r.created_at).getTime(),
        imageUrl: getPostImageUrl(r.image_path)
      };
    });
  }

  async function createPost(userId, text, imagePath) {
    var { error } = await sb().from("feed_posts").insert({
      author_id: userId,
      text: text,
      image_path: imagePath || null
    });
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

  /* ---------------- journey steps (additive per-action, per day) ---------------- */

  // Fetches full history so app.js can total everyone's points per Ethiopian
  // year — see computeJourney() in app.js. "points" here = reading_done +
  // prayer_done + challenge_done + app_opens, computed once so the caller
  // doesn't need to know the column layout.
  async function getAllJourneyDays() {
    var { data, error } = await sb()
      .from("journey_steps")
      .select("user_id, step_date, reading_done, prayer_done, challenge_done, app_opens, profiles(name, gender, avatar_icon, avatar_color)");
    logIfError("getAllJourneyDays", error);
    return (data || []).map(function (r) {
      var points = (r.reading_done ? 1 : 0) + (r.prayer_done ? 1 : 0) + (r.challenge_done ? 1 : 0) + (r.app_opens || 0);
      return {
        userId: r.user_id,
        name: (r.profiles && r.profiles.name) || "—",
        gender: r.profiles && r.profiles.gender,
        avatarIcon: r.profiles && r.profiles.avatar_icon,
        avatarColor: r.profiles && r.profiles.avatar_color,
        stepDate: r.step_date,
        points: points
      };
    });
  }

  async function getMyTodayRecord(userId, dateStr) {
    var { data, error } = await sb()
      .from("journey_steps")
      .select("reading_done, prayer_done, challenge_done, app_opens")
      .eq("user_id", userId).eq("step_date", dateStr)
      .maybeSingle();
    logIfError("getMyTodayRecord", error);
    return data || { reading_done: false, prayer_done: false, challenge_done: false, app_opens: 0 };
  }

  // Sets ONE flag column true for today. Upsert only touches the column
  // given here — it never resets the other three, whichever order someone
  // does today's actions in.
  async function setTodayFlag(userId, dateStr, field, value) {
    var payload = { user_id: userId, step_date: dateStr };
    payload[field] = value;
    var { error } = await sb().from("journey_steps").upsert(payload);
    logIfError("setTodayFlag:" + field, error);
    return !error;
  }

  // Capped at 3: reads the current count first so a 4th+ open today is
  // simply not written (rather than growing without limit).
  async function incrementAppOpenToday(userId, dateStr) {
    var current = await getMyTodayRecord(userId, dateStr);
    var count = current.app_opens || 0;
    if (count >= 3) return false;
    var { error } = await sb().from("journey_steps").upsert({ user_id: userId, step_date: dateStr, app_opens: count + 1 });
    logIfError("incrementAppOpenToday", error);
    return !error;
  }

  /* ---------------- care calls (self-serve calling rotation) ---------------- */

  async function getCareCallHistory() {
    var { data, error } = await sb()
      .from("care_calls")
      .select("caller_user_id, target_user_id, called_at, verified")
      .order("called_at", { ascending: false })
      .limit(500);
    logIfError("getCareCallHistory", error);
    return (data || []).map(function (r) {
      return { callerUserId: r.caller_user_id, targetUserId: r.target_user_id, calledAt: r.called_at, verified: r.verified };
    });
  }

  // Creates a CLAIM, not a confirmed credit — verified defaults to false.
  // See verifyPendingCallsForMe() for how a claim actually becomes real.
  async function logCareCall(callerUserId, targetUserId) {
    var { error } = await sb().from("care_calls").insert({
      caller_user_id: callerUserId,
      target_user_id: targetUserId
    });
    logIfError("logCareCall", error);
    return !error;
  }

  // Called by the RECEIVER, not the caller. Confirms every one of their own
  // still-pending claims within the given local-day window at once — the
  // UI never lets them pick a specific claim, since the whole point is that
  // the prompt never reveals who claims to have called.
  async function verifyPendingCallsForMe(userId, dayStartISO, dayEndISO) {
    var { error } = await sb()
      .from("care_calls")
      .update({ verified: true, verified_at: new Date().toISOString() })
      .eq("target_user_id", userId)
      .eq("verified", false)
      .gte("called_at", dayStartISO)
      .lt("called_at", dayEndISO);
    logIfError("verifyPendingCallsForMe", error);
    return !error;
  }

  window.DB = {
    getMyProfile: getMyProfile,
    saveMyProfile: saveMyProfile,
    getDirectory: getDirectory,
    getFeed: getFeed,
    createPost: createPost,
    uploadPostImage: uploadPostImage,
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
    getAllJourneyDays: getAllJourneyDays,
    getMyTodayRecord: getMyTodayRecord,
    setTodayFlag: setTodayFlag,
    incrementAppOpenToday: incrementAppOpenToday,
    getCareCallHistory: getCareCallHistory,
    logCareCall: logCareCall,
    verifyPendingCallsForMe: verifyPendingCallsForMe
  };
})();
