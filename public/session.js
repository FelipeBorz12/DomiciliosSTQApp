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
      localStorage.removeItem("burgerUser");
    } catch {}
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
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return null;

    await ensureSupabaseLoaded();
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

  async function fetchMe() {
    const session = await getSession();
    if (!session?.user) return null;

    const u = session.user;
    return {
      id: u.id,
      email: u.email || null,
      phone: u.phone || null,
      user_metadata: u.user_metadata || {},
      created_at: u.created_at || null,
    };
  }

  async function goAccountOrLogin() {
    const logged = await isLoggedIn();
    if (logged) return goAccount();
    return goLoginWithNext();
  }

  async function requireLoginOrRedirect() {
    const logged = await isLoggedIn();
    if (!logged) {
      goLoginWithNext();
      return false;
    }
    return true;
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

  // ✅ FORMULARIO: trae la fila por correo
  async function fetchFormularioByCorreo(correo) {
    if (!correo) return null;

    await ensureSupabaseLoaded();
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase no inicializado");

    const { data, error } = await sb
      .from("formulario")
      .select("*")
      .eq("correo", correo)
      .order("id", { ascending: false })
      .limit(1);

    if (error) throw error;
    return data?.[0] || null;
  }

  // ✅ FORMULARIO: guarda (si existe actualiza, si no inserta)
  async function saveFormulario(payload) {
    await ensureSupabaseLoaded();
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase no inicializado");

    if (!payload?.correo) throw new Error("Falta correo");

    const existing = await fetchFormularioByCorreo(payload.correo);

    if (existing?.id) {
      const { data, error } = await sb
        .from("formulario")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await sb
        .from("formulario")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    }
  }

  // ✅ IMPORTANTE: CAPTURE + stopImmediatePropagation para evitar listeners viejos
  function bindAccountButtons() {
    const ids = ["user-icon", "user-btn", "mobile-profile-btn"];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.dataset.tqBound === "1") return;
      el.dataset.tqBound = "1";

      el.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          goAccountOrLogin();
        },
        { capture: true }
      );
    });

    const logoutBtn = document.getElementById("mobile-logout-btn");
    if (logoutBtn && logoutBtn.dataset.tqBound !== "1") {
      logoutBtn.dataset.tqBound = "1";
      logoutBtn.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          logout();
        },
        { capture: true }
      );
    }
  }

  async function syncMobileMenu() {
    const logged = await isLoggedIn();

    const loginItem = document.getElementById("mobile-login-item");
    const profileItem = document.getElementById("mobile-profile-item");
    const logoutItem = document.getElementById("mobile-logout-item");

    if (loginItem) loginItem.classList.toggle("hidden", logged);
    if (profileItem) profileItem.classList.toggle("hidden", !logged);
    if (logoutItem) logoutItem.classList.toggle("hidden", !logged);
  }

  window.tqSession = {
    getSupabase,
    getSession,
    isLoggedIn,
    fetchMe,
    logout,
    goAccountOrLogin,
    requireLoginOrRedirect,
    bindAccountButtons,
    fetchFormularioByCorreo,
    saveFormulario,
  };

  document.addEventListener("DOMContentLoaded", () => {
    bindAccountButtons();
    syncMobileMenu();
  });
})();
