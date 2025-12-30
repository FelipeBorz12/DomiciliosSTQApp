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
  }

  function hasStoredSbSession() {
    // Supabase v2 suele guardar algo como: sb-<ref>-auth-token
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || "";
        if (k.startsWith("sb-") && k.includes("-auth-token")) {
          const raw = localStorage.getItem(k);
          if (raw && raw.length > 10) return true;
        }
      }
    } catch {}
    return false;
  }

  function safePath(path) {
    if (!path) return "/";
    if (path.startsWith("http://") || path.startsWith("https://")) return "/";
    if (!path.startsWith("/")) return "/";
    if (path.startsWith("//")) return "/";
    return path;
  }

  function buildNext() {
    const p = safePath(window.location.pathname);
    const q = window.location.search || "";
    if (p.startsWith("/login") || p.startsWith("/auth/callback")) return "";
    return encodeURIComponent(p + q);
  }

  function goLoginWithNext() {
    const next = buildNext();
    window.location.href = next ? `/login?next=${next}` : "/login";
  }

  function goAccount() {
    window.location.href = "/account";
  }

  function ensureSupabaseLoaded() {
    return new Promise((resolve) => {
      if (window.supabase && window.supabase.createClient) return resolve(true);

      // si no está cargada la lib, la inyectamos
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  function getSupabase() {
    if (window.__tqSupabase) return window.__tqSupabase;

    const supabaseLib = window.supabase;
    const url = window.SUPABASE_URL;
    const anonKey = window.SUPABASE_ANON_KEY;

    if (!supabaseLib || !supabaseLib.createClient) return null;
    if (!url || !anonKey) return null;

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
    // si no hay lib o config, igual evitamos mandarte a login si ya hay token guardado
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return null;

    const sb = getSupabase();
    if (!sb) return null;

    const { data, error } = await sb.auth.getSession();
    if (error) {
      console.warn("[session.js] getSession error:", error);
      return null;
    }
    return data?.session || null;
  }

  async function goAccountOrLogin() {
    // 1) si hay token guardado, NO rebotes al login
    if (hasStoredSbSession()) return goAccount();

    // 2) intenta supabase real
    await ensureSupabaseLoaded();
    const s = await getSession();
    if (s) return goAccount();

    // 3) no hay sesión
    return goLoginWithNext();
  }

  async function logout() {
    await ensureSupabaseLoaded();
    const sb = getSupabase();
    try {
      if (sb) {
        const { error } = await sb.auth.signOut({ scope: "local" });
        if (error) console.warn("[logout] signOut error:", error);
      }
    } catch (e) {
      console.warn("[logout] error:", e);
    } finally {
      clearSupabaseStorageEverywhere();
      window.location.replace("/");
    }
  }

  function bindAccountButtons() {
    const ids = ["user-icon", "user-btn", "mobile-profile-btn"];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.dataset.tqBound === "1") return;
      el.dataset.tqBound = "1";

      el.addEventListener("click", (e) => {
        e.preventDefault();
        goAccountOrLogin();
      });
    });
  }

  async function syncMobileMenu() {
    // Si hay token guardado, asumimos logueado para UI (sin esperar red)
    const logged = hasStoredSbSession() || !!(await getSession());

    const loginItem = document.getElementById("mobile-login-item");
    const profileItem = document.getElementById("mobile-profile-item");
    const logoutItem = document.getElementById("mobile-logout-item");
    const logoutBtn = document.getElementById("mobile-logout-btn");

    if (loginItem) loginItem.classList.toggle("hidden", logged);
    if (profileItem) profileItem.classList.toggle("hidden", !logged);
    if (logoutItem) logoutItem.classList.toggle("hidden", !logged);

    if (logoutBtn && logoutBtn.dataset.tqBound !== "1") {
      logoutBtn.dataset.tqBound = "1";
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        logout();
      });
    }
  }

  window.tqSession = {
    getSupabase,
    getSession,
    logout,
    goAccountOrLogin,
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindAccountButtons();
    syncMobileMenu();
  });
})();
