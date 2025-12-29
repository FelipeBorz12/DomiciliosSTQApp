// public/auth.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ================= CONFIG ================= */
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

/* ================= LOADER ================= */
function showLoader(text = "Cargando…") {
  const loader = document.getElementById("global-loader");
  const label = document.getElementById("loader-text");
  if (!loader) return;
  if (label) label.textContent = text;
  loader.classList.remove("hidden");
}

function hideLoader() {
  const loader = document.getElementById("global-loader");
  if (!loader) return;
  loader.classList.add("hidden");
}

/* ================= TURNSTILE ================= */
function resetTurnstile() {
  if (window.turnstile) {
    try {
      window.turnstile.reset();
    } catch {}
  }
}

function getTurnstileToken() {
  return (
    document.querySelector('input[name="cf-turnstile-response"]')?.value || ""
  );
}

/* ================= UTILIDADES ================= */
function togglePasswordVisibility(button) {
  const input = button
    .closest("form")
    ?.querySelector(`input[name="${button.dataset.target}"]`);
  if (!input) return;

  const icon = button.querySelector(".material-symbols-outlined");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  if (icon) icon.textContent = show ? "visibility" : "visibility_off";
}

function normalizeEmail(email) {
  return (email || "").toString().trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

/* ================= HTTP ================= */
async function postJSON(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, data };
}

async function verifyTurnstileOrThrow() {
  const token = getTurnstileToken();
  if (!token) throw new Error("Completa la verificación anti-bot.");

  const { ok, data } = await postJSON("/api/antibot/verify", {
    cf_turnstile_response: token,
  });

  if (!ok) throw new Error(data?.message || "No se pudo validar anti-bot.");
}

/* ================= PERFIL ================= */
async function fetchMeOrThrow(accessToken) {
  const res = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || "No se pudo obtener perfil");
  return data;
}

function saveBurgerUser(me) {
  localStorage.setItem(
    "burgerUser",
    JSON.stringify({
      userId: me?.userId ?? null,
      rol: me?.rol ?? "0",
      correo: me?.correo ?? "",
      auth_user_id: me?.auth_user_id ?? null,
      perfil: me?.perfil ?? {},
      v: 5,
    })
  );
}

/* ================= DOM READY ================= */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.addEventListener("click", () => togglePasswordVisibility(btn));
  });

  const loginForm = document.getElementById("login-form");
  const googleBtn = document.getElementById("google-login");
  const errorEl = document.getElementById("login-error");

  /* === SESIÓN EXISTENTE (IMPORTANTE) === */
  (async () => {
    if (!supabase) return;

    // ⛔ SI VIENE DE LOGOUT, NO AUTO-LOGIN
    if (localStorage.getItem("justLoggedOut")) {
      localStorage.removeItem("justLoggedOut");
      hideLoader();
      return;
    }

    showLoader("Preparando tu sesión…");

    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;

      if (session?.access_token) {
        const me = await fetchMeOrThrow(session.access_token);
        saveBurgerUser(me);
        window.location.replace("/");
        return;
      }
    } catch (e) {
      console.warn("[Session check]", e);
    }

    hideLoader();
  })();

  /* ================= LOGIN EMAIL ================= */
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");

    const formData = new FormData(loginForm);
    const correo = normalizeEmail(formData.get("correo"));
    const contrasena = String(formData.get("contrasena") || "");

    if (!isValidEmail(correo))
      return showMsg(errorEl, "Ingresa un correo válido.");
    if (!contrasena)
      return showMsg(errorEl, "Ingresa tu contraseña.");

    try {
      showLoader("Verificando tus datos…");
      await verifyTurnstileOrThrow();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: correo,
        password: contrasena,
      });

      if (error || !data?.session)
        throw new Error(error?.message || "No se pudo iniciar sesión.");

      const me = await fetchMeOrThrow(data.session.access_token);
      saveBurgerUser(me);
      window.location.replace("/");
    } catch (err) {
      resetTurnstile();
      hideLoader();
      showMsg(
        errorEl,
        err instanceof Error ? err.message : "Error al iniciar sesión"
      );
    }
  });

  /* ================= GOOGLE ================= */
  googleBtn?.addEventListener("click", async () => {
    errorEl.classList.add("hidden");

    try {
      showLoader("Redirigiendo a Google…");
      await verifyTurnstileOrThrow();

      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/login",
        },
      });
    } catch (err) {
      resetTurnstile();
      hideLoader();
      showMsg(
        errorEl,
        err instanceof Error ? err.message : "Error con Google"
      );
    }
  });
});

/* ================= HELPERS UI ================= */
function showMsg(el, msg) {
  if (!el) return;
  el.textContent = msg || "";
  el.classList.remove("hidden");
}

/* ================= LOGOUT ================= */
window.logoutUser = async function () {
  const modal = document.getElementById("logout-modal");
  if (modal) modal.classList.remove("hidden");

  // 🔐 MARCAR LOGOUT
  localStorage.setItem("justLoggedOut", "1");

  try {
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch (e) {
    console.warn("[Logout] error:", e);
  }

  try {
    localStorage.removeItem("burgerUser");
    sessionStorage.clear();
  } catch {}

  setTimeout(() => {
    window.location.replace("/login");
  }, 700);
};
