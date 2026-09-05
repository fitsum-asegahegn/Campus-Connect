// auth.js
// ----------------------------------------------------------------------------
// Zero-friction auth: every visitor gets a persistent ANONYMOUS Supabase
// session (no email, no password, no OTP). This is what lets the app keep
// its original "just fill in your name and go" feel while still giving
// every shared feature (feed, directory, prayer wall, events, group
// check-ins) a real auth.uid() to enforce Row Level Security with.
//
// Requirement: Supabase Dashboard → Authentication → Providers →
// enable "Allow anonymous sign-ins" (off by default on new projects).
//
// Trade-off to know about: the session lives in this browser only. If a
// student switches phones or clears site data, they'll get a *new* identity
// and need to fill in their profile again — their old posts/history stay
// under the old identity. See the upgrade note at the bottom of this file
// for how to let someone later attach a real email to keep the same
// identity across devices.
// ----------------------------------------------------------------------------

(function () {
  "use strict";

  function sb() {
    if (!window.supabaseClient) {
      throw new Error("supabaseClient not initialized — check config.js loaded first.");
    }
    return window.supabaseClient;
  }

  var sessionPromise = null;

  async function ensureSession() {
    if (sessionPromise) return sessionPromise;

    sessionPromise = (async function () {
      var client = sb();
      var { data, error } = await client.auth.getSession();
      if (error) {
        console.error("Auth.getSession error:", error.message);
      }
      if (data && data.session) {
        return data.session;
      }

      var signIn = await client.auth.signInAnonymously();
      if (signIn.error) {
        console.error("Anonymous sign-in failed:", signIn.error.message);
        throw signIn.error;
      }
      return signIn.data.session;
    })();

    return sessionPromise;
  }

  async function getUserId() {
    var session = await ensureSession();
    return session.user.id;
  }

  window.Auth = {
    ensureSession: ensureSession,
    getUserId: getUserId
  };
})();

/* ----------------------------------------------------------------------------
   Optional upgrade — keeping the same identity across devices:

   Supabase supports converting an anonymous user into a permanent one
   without losing their data (their auth.uid() stays the same, so their
   profile/posts/history carry over automatically):

     const { error } = await supabaseClient.auth.updateUser({
       email: "student@example.com"
     });
     // Supabase emails them a confirmation link; once they click it, the
     // anonymous session becomes a permanent, email-linked one.

   This could be added later as an optional "Save my account" button in the
   profile screen — not required for the app to work today.
---------------------------------------------------------------------------- */
