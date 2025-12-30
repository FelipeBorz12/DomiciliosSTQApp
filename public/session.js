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

  async function isLoggedIn() {
    const s = await getSession();
    return !!s;
  }

  function safePath(path) {
    if (!path) return "/";
    // solo rutas internas
    if (path.startsWith("http://") || path.startsWith("https://")) return "/";
    if (!path.startsWith("/")) return "/";
    if (path.startsWith("//")) return "/";
    return path;
  }

  function buildNext() {
    // guarda ruta + query actual para volver después del login
    const p = safePath(window.location.pathname);
    const q = window.location.search || "";
    // no queremos next hacia /login ni /auth/callback
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

  async function goAccountOrLogin() {
    const s = await getSession();
    if (s) return goAccount();
    return goLoginWithNext();
  }

  async function logout() {
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

  // ✅ En páginas con navbar: engancha el botón de usuario
  function bindAccountButtons() {
    const ids = [
      "user-icon",         // la mayoría de páginas
      "user-btn",          // history.html usa este
      "mobile-profile-btn" // menú móvil (si existe)
    ];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;

      // evita doble binding si session.js se carga dos veces
      if (el.dataset.tqBound === "1") return;
      el.dataset.tqBound = "1";

      el.addEventListener("click", (e) => {
        e.preventDefault();
        goAccountOrLogin();
      });
    });
  }

  // ✅ Alterna items del menú móvil si existen
  async function syncMobileMenu() {
    const s = await getSession();
    const logged = !!s;

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

  // ✅ Exponer API global (lo que ya usas)
  window.tqSession = {
    getSupabase,
    getSession,
    isLoggedIn,
    logout,
    goAccountOrLogin,
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindAccountButtons();
    syncMobileMenu();
  });
})();
