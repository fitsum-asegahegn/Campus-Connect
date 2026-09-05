// config.js 
// ----------------------------------------------------------------------------
// Fill these in from: Supabase Dashboard → Project Settings → API
//   - "Project URL"      → SUPABASE_URL
//   - "anon public" key  → SUPABASE_ANON_KEY  (this key is safe to expose in
//     client-side code — it has no power on its own; Row Level Security in
//     supabase-schema.sql is what actually controls who can read/write what)
// ----------------------------------------------------------------------------

window.SUPABASE_URL = "https://oerjwnrbiwomxdrckcjc.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lcmp3bnJiaXdvbXhkcmNrY2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NzgwMTYsImV4cCI6MjEwNDE1NDAxNn0.bwQ0-9wPYqm-wbJLL2Lxg86DKmPqwZa7mC12mahyzuA";

(function () {
  "use strict";

  if (typeof supabase === "undefined") {
    console.error(
      "Supabase client library did not load. Check the <script> tag for " +
      "@supabase/supabase-js in index.html (and your network connection)."
    );
    return;
  }

  if (window.SUPABASE_URL.indexOf("YOUR-PROJECT-REF") !== -1) {
    console.warn(
      "config.js still has placeholder Supabase credentials. " +
      "Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project's values."
    );
  }

  window.supabaseClient = supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    }
  );
})();
