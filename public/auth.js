// /public/auth.js
// Depende de window.sb (supabaseClient.js)

(function () {
  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return alert(msg);
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => el.classList.add("hidden"), 2800);
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function ensureSb() {
    if (!window.sb) {
      console.error("[auth] Supabase client no inicializado. Falta supabaseClient.js");
      return false;
    }
    return true;
  }

  async function getSession() {
    if (!ensureSb()) return null;
    const { data, error } = await window.sb.auth.getSession();
    if (error) console.warn("[auth.getSession] error:", error);
    return data?.session || null;
  }

  async function getAccessToken() {
    const session = await getSession();
    return session?.access_token || "";
  }

  async function fetchMe() {
    const token = await getAccessToken();
    if (!token) return null;

    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;
    return await res.json();
  }

  async function signInWithPassword(email, password) {
    if (!ensureSb()) return { ok: false, message: "Supabase no inicializado" };

    const correo = normalizeEmail(email);
    const contrasena = String(password || "");

    if (!correo || !contrasena) {
      return { ok: false, message: "Correo y contraseña son obligatorios" };
    }

    // OJO: Este es exactamente el endpoint que te da el 400 cuando falla:
    // /auth/v1/token?grant_type=password
    const { data, error } = await window.sb.auth.signInWithPassword({
      email: correo,
      password: contrasena,
    });

    if (error || !data?.session) {
      // Mensaje más útil para tu caso (Google-only / sin password)
      const msg = String(error?.message || "No se pudo iniciar sesión");
      if (msg.toLowerCase().includes("invalid login credentials")) {
        return {
          ok: false,
          message:
            "Credenciales inválidas. Si tu cuenta fue creada con Google, no tiene contraseña. Usa 'Iniciar con Google' o crea una contraseña con 'Olvidé mi contraseña'.",
        };
      }
      return { ok: false, message: msg };
    }

    return { ok: true, session: data.session };
  }

  async function signInWithGoogle() {
    if (!ensureSb()) return { ok: false, message: "Supabase no inicializado" };

    const { data, error } = await window.sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        // ✅ vuelve al sitio y Supabase procesará el callback
        redirectTo: window.location.origin + "/login",
      },
    });

    if (error) return { ok: false, message: error.message };
    return { ok: true, data };
  }

  async function signOut() {
    if (!ensureSb()) return;

    // opcional: muestra modal si existe
    const modal = document.getElementById("logout-modal");
    if (modal) modal.classList.remove("hidden");

    try {
      const { error } = await window.sb.auth.signOut();
      if (error) console.warn("[auth.signOut] error:", error);
    } finally {
      if (modal) modal.classList.add("hidden");
      // Limpieza extra por si acaso
      try {
        localStorage.removeItem("tq_sb_session");
      } catch {}
      window.location.href = "/";
    }
  }

  async function requireSessionOrRedirect(nextPath) {
    const session = await getSession();
    if (session) return session;

    const next = nextPath || window.location.pathname;
    window.location.href = `/login?next=${encodeURIComponent(next)}`;
    return null;
  }

  // Exponer API global
  window.Auth = {
    toast,
    getSession,
    getAccessToken,
    fetchMe,
    signInWithPassword,
    signInWithGoogle,
    signOut,
    requireSessionOrRedirect,
  };
})();
