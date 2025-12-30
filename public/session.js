// public/session.js
(function () {
  "use strict";

  function clearSupabaseStorageEverywhere() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith("sb-")) localStorage.removeItem(k);
        if (k.includes("supabase.auth")) localStorage.removeItem(k);
      }
    } catch {}

    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (!k) continue;
        if (k.startsWith("sb-")) sessionStorage.removeItem(k);
        if (k.includes("supabase.auth")) sessionStorage.removeItem(k);
      }
    } catch {}

    try {
      localStorage.removeItem("burgerUser"); // compat legacy
    } catch {}
  }

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
      console.warn("[session.js] Faltan SUPABASE_URL / SUPABASE_ANON_KEY.");
      return null;
    }

    window.__tqSupabase = supabaseLib.createClient(url, anonKey, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    return window.__tqSupabase;
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

  async function getAccessToken() {
    const s = await getSession();
    return s?.access_token || "";
  }

  async function isLoggedIn() {
    const s = await getSession();
    return !!s;
  }

  async function fetchMe() {
    const token = await getAccessToken();
    if (!token) return null;

    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function logout() {
    const sb = getSupabase();

    try {
      if (sb) {
        // ✅ global revoca refresh token en Supabase (mejor logout real)
        const { error } = await sb.auth.signOut({ scope: "global" });
        if (error) console.warn("[logout] signOut error:", error);
      }
    } catch (e) {
      console.warn("[logout] error:", e);
    } finally {
      clearSupabaseStorageEverywhere();
      window.location.replace("/");
    }
  }

  function safeNext(next) {
    if (!next) return "";
    if (next.startsWith("http://") || next.startsWith("https://")) return "";
    if (!next.startsWith("/")) return "";
    if (next.startsWith("//")) return "";
    return next;
  }

  async function requireLoginOrRedirect(nextPath) {
    const ok = await isLoggedIn();
    if (ok) return true;

    const next = encodeURIComponent(safeNext(nextPath || (window.location.pathname + window.location.search)));
    window.location.href = `/login?next=${next}`;
    return false;
  }

  // ✅ Botón usuario (si existe en cualquier página)
  async function wireUserButtons() {
    const userIcon = document.getElementById("user-icon");
    if (userIcon) {
      userIcon.addEventListener("click", async () => {
        const ok = await isLoggedIn();
        if (ok) {
          window.location.href = "/account";
        } else {
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/login?next=${next}`;
        }
      });
    }

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) logoutBtn.addEventListener("click", logout);

    const logoutMenu = document.getElementById("logout-menu");
    if (logoutMenu) logoutMenu.addEventListener("click", logout);
  }

  // ✅ Exponer API
  window.tqSession = {
    getSupabase,
    getSession,
    getAccessToken,
    isLoggedIn,
    fetchMe,
    logout,
    requireLoginOrRedirect,
    wireUserButtons,
  };

  document.addEventListener("DOMContentLoaded", () => {
    wireUserButtons();
  });
})();
