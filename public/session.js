// public/session.js
(function () {
  "use strict";

  function getSupabase() {
    if (window.__tqSupabase) return window.__tqSupabase;

    const supabaseLib = window.supabase;
    const url = window.SUPABASE_URL;
    const anonKey = window.SUPABASE_ANON_KEY;

    if (!supabaseLib || !supabaseLib.createClient) {
      console.warn("[session.js] Falta cargar supabase-js (CDN).");
      return null;
    }
    if (!url || !anonKey) {
      console.warn("[session.js] Faltan SUPABASE_URL / SUPABASE_ANON_KEY (config.js).");
      return null;
    }

    window.__tqSupabase = supabaseLib.createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    return window.__tqSupabase;
  }

  function getNextFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      if (!next) return "";
      if (!next.startsWith("/")) return "";
      if (next.startsWith("//")) return "";
      return next;
    } catch {
      return "";
    }
  }

  async function getSession() {
    const sb = getSupabase();
    if (!sb) return null;

    const { data, error } = await sb.auth.getSession();
    if (error) {
      console.warn("[session.js] getSession error:", error);
      return null;
    }
    return data?.session || null;
  }

  async function handleAuthCallbackIfNeeded() {
    if (window.location.pathname !== "/auth/callback") return;

    const sb = getSupabase();
    if (!sb) {
      window.location.replace("/login");
      return;
    }

    const { data } = await sb.auth.getSession();
    const session = data?.session;

    if (session?.access_token) {
      const next = getNextFromUrl();
      window.location.replace(next || "/account");
      return;
    }

    window.location.replace("/login");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await handleAuthCallbackIfNeeded();
  });

  window.tqSession = { getSupabase, getSession };
})();
