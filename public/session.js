// public/session.js
// Manejo de sesión (Supabase) + UI de header (user/cart/menu) + helpers.
// Nota: este archivo NO usa imports. Debe funcionar con <script src="..."></script>

(function () {
  "use strict";

  // -------------------- Supabase client (singleton) --------------------
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

  // -------------------- Local user (compat) --------------------
  function getLocalUser() {
    try {
      return JSON.parse(localStorage.getItem("burgerUser") || "null");
    } catch {
      return null;
    }
  }
  function setLocalUser(user) {
    try {
      localStorage.setItem("burgerUser", JSON.stringify(user));
    } catch {}
  }
  function clearLocalUser() {
    try {
      localStorage.removeItem("burgerUser");
    } catch {}
  }

  // -------------------- Helpers --------------------
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
    const session = await getSession();
    if (session) return true;
    const local = getLocalUser();
    return !!(local && local.correo);
  }

  async function signOutAll() {
    const sb = getSupabase();
    try {
      if (sb) await sb.auth.signOut();
    } catch (e) {
      console.warn("[session.js] signOut error:", e);
    }
    clearLocalUser();
  }

  function getNextFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      if (!next) return "";
      // evita open redirect
      if (next.startsWith("http://") || next.startsWith("https://")) return "";
      if (!next.startsWith("/")) return "";
      return next;
    } catch {
      return "";
    }
  }

  async function fetchMe() {
    // Requiere sesión Supabase (Bearer token)
    const session = await getSession();
    if (!session?.access_token) return null;

    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        credentials: "include",
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // -------------------- UI: Header & Menú móvil --------------------
  async function refreshHeaderUI() {
    const logged = await isLoggedIn();
    const cached = getLocalUser();

    // Elementos que pueden o no existir según la página
    const userNameEl = document.getElementById("user-name");
    const userIconBtn = document.getElementById("user-icon");
    const mobileLoginItem = document.getElementById("mobile-login-item");
    const mobileProfileItem = document.getElementById("mobile-profile-item");
    const mobileLogoutItem = document.getElementById("mobile-logout-item");
    const mobileProfileBtn = document.getElementById("mobile-profile-btn");
    const mobileLogoutBtn = document.getElementById("mobile-logout-btn");

    // Intenta traer perfil real si hay sesión Supabase
    let profileName = "";
    if (logged) {
      // si ya hay algo en localStorage úsalo, si no intenta /api/auth/me
      profileName =
        cached?.perfil?.nombre ||
        cached?.nombre ||
        "";

      if (!profileName) {
        const me = await fetchMe();
        if (me?.perfil) {
          profileName = me.perfil.nombre || "";
          setLocalUser({
            correo: me.correo,
            rol: me.rol,
            userId: me.userId,
            perfil: me.perfil,
            legacy: false,
          });
        }
      }
    }

    if (userNameEl) userNameEl.textContent = profileName || "";

    if (mobileLoginItem) mobileLoginItem.classList.toggle("hidden", logged);
    if (mobileProfileItem) mobileProfileItem.classList.toggle("hidden", !logged);
    if (mobileLogoutItem) mobileLogoutItem.classList.toggle("hidden", !logged);

    if (userIconBtn) {
      userIconBtn.onclick = async () => {
        const ok = await isLoggedIn();
        if (ok) {
          window.location.href = "/account";
        } else {
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/login?next=${next}`;
        }
      };
    }

    if (mobileProfileBtn) {
      mobileProfileBtn.onclick = async () => {
        const ok = await isLoggedIn();
        if (ok) window.location.href = "/account";
      };
    }

    if (mobileLogoutBtn) {
      mobileLogoutBtn.onclick = async () => {
        await signOutAll();
        window.location.href = "/";
      };
    }
  }

  // -------------------- Auth callback flow --------------------
  async function handleAuthCallbackIfNeeded() {
    const path = window.location.pathname;
    if (path !== "/auth/callback") return;

    // Espera a que Supabase procese la URL (PKCE)
    const sb = getSupabase();
    if (!sb) {
      window.location.href = "/login";
      return;
    }

    // fuerza el procesamiento
    const { data } = await sb.auth.getSession();
    const session = data?.session;

    if (session?.access_token) {
      // guarda burgerUser para compatibilidad
      const me = await fetchMe();
      if (me?.correo) {
        setLocalUser({
          correo: me.correo,
          rol: me.rol,
          userId: me.userId,
          perfil: me.perfil,
          legacy: false,
        });
      }

      const next = getNextFromUrl();
      window.location.replace(next || "/account");
      return;
    }

    // si no hay sesión, manda a login
    window.location.replace("/login");
  }

  // -------------------- Public API --------------------
  window.tqSession = {
    getSupabase,
    getSession,
    isLoggedIn,
    fetchMe,
    getLocalUser,
    setLocalUser,
    clearLocalUser,
    signOutAll,
    requireAuthOnPage: async function () {
      const ok = await isLoggedIn();
      if (!ok) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?next=${next}`;
        return false;
      }
      return true;
    },
  };

  // -------------------- Init --------------------
  document.addEventListener("DOMContentLoaded", async () => {
    await handleAuthCallbackIfNeeded();
    await refreshHeaderUI();
  });
})();
