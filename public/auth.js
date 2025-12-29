// public/auth.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// ================= TURNSTILE =================
function resetTurnstile() {
  if (window.turnstile) {
    try {
      window.turnstile.reset();
    } catch {}
  }
}

// ================= UTILIDADES =================
function togglePasswordVisibility(button) {
  const inputName = button.dataset.target;
  if (!inputName) return;

  const form = button.closest("form");
  if (!form) return;

  const input = form.querySelector(`input[name="${inputName}"]`);
  if (!input) return;

  const icon = button.querySelector(".material-symbols-outlined");

  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";

  if (icon) icon.textContent = isHidden ? "visibility" : "visibility_off";
  button.setAttribute("aria-pressed", String(isHidden));
}

function normalizeEmail(email) {
  return (email || "").toString().trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function isStrongPassword(pw) {
  const s = (pw || "").toString();
  if (s.length < 8) return false;
  if (!/[A-Za-z]/.test(s)) return false;
  if (!/\d/.test(s)) return false;
  return true;
}

function getTurnstileToken() {
  return (
    document.querySelector('input[name="cf-turnstile-response"]')?.value || ""
  );
}

function setLoading(form, isLoading) {
  if (!form) return;
  const btn = form.querySelector('button[type="submit"]');
  if (!btn) return;

  btn.disabled = !!isLoading;
  btn.dataset.loading = isLoading ? "1" : "0";

  if (isLoading) {
    btn.dataset.originalText = btn.textContent || "";
    btn.textContent = "Procesando...";
  } else {
    if (btn.dataset.originalText) btn.textContent = btn.dataset.originalText;
  }
}

function showMsg(el, msg) {
  if (!el) return;
  el.textContent = msg || "";
  el.classList.remove("hidden");
}

function hideMsg(el) {
  if (!el) return;
  el.textContent = "";
  el.classList.add("hidden");
}

// ================= HTTP =================
async function postJSON(url, payload, { timeoutMs = 12000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(t);
  }
}

async function verifyTurnstileOrThrow() {
  const token = getTurnstileToken();
  if (!token) throw new Error("Completa la verificación anti-bot.");

  const { ok, data } = await postJSON("/api/antibot/verify", {
    cf_turnstile_response: token,
  });

  if (!ok) throw new Error(data?.message || "No se pudo validar anti-bot.");
  return true;
}

// ================= PERFIL =================
async function fetchMeOrThrow(accessToken) {
  const res = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || "No se pudo obtener perfil");
  return data;
}

function saveBurgerUser(me) {
  const perfil = me?.perfil || {};
  const payload = {
    userId: me?.userId ?? null,
    rol: me?.rol ?? "0",
    correo: me?.correo ?? "",
    auth_user_id: me?.auth_user_id ?? null,
    perfil: {
      nombre: perfil?.nombre || "",
      direccionentrega: perfil?.direccionentrega || "",
      celular: perfil?.celular || null,
      Departamento: perfil?.Departamento || "",
      Municipio: perfil?.Municipio || "",
      Barrio: perfil?.Barrio || "",
    },
    v: 3,
  };

  try {
    localStorage.setItem("burgerUser", JSON.stringify(payload));
  } catch {}
}

// ================= DOM READY =================
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.addEventListener("click", () => togglePasswordVisibility(btn));
  });

  // ================= LOGIN =================
  const loginForm = document.getElementById("login-form");
  const googleBtn = document.getElementById("google-login");

  if (loginForm) {
    const errorEl = document.getElementById("login-error");
    let busy = false;

    // Si vienes del redirect Google
    (async () => {
      if (!supabase) return;
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (session?.access_token) {
          const me = await fetchMeOrThrow(session.access_token);
          saveBurgerUser(me);
          window.location.href = "/";
        }
      } catch {}
    })();

    // -------- LOGIN EMAIL --------
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;

      hideMsg(errorEl);

      if (!supabase) {
        return showMsg(
          errorEl,
          "Falta configurar SUPABASE_URL / SUPABASE_ANON_KEY en login.html"
        );
      }

      const formData = new FormData(loginForm);
      const correo = normalizeEmail(formData.get("correo")?.toString());
      const contrasena = formData.get("contrasena")?.toString() || "";

      if (!isValidEmail(correo))
        return showMsg(errorEl, "Ingresa un correo válido.");
      if (!contrasena)
        return showMsg(errorEl, "Ingresa tu contraseña.");

      busy = true;
      setLoading(loginForm, true);

      try {
        await verifyTurnstileOrThrow();

        const { data, error } = await supabase.auth.signInWithPassword({
          email: correo,
          password: contrasena,
        });

        if (error) throw new Error(error.message);
        if (!data?.session?.access_token)
          throw new Error("No se pudo crear sesión.");

        const me = await fetchMeOrThrow(data.session.access_token);
        saveBurgerUser(me);
        window.location.href = "/";
      } catch (err) {
        resetTurnstile();
        console.error("[Login] error:", err);
        showMsg(
          errorEl,
          err instanceof Error ? err.message : "Error al iniciar sesión"
        );
      } finally {
        busy = false;
        setLoading(loginForm, false);
      }
    });

    // -------- GOOGLE --------
    googleBtn?.addEventListener("click", async () => {
      hideMsg(errorEl);

      if (!supabase) {
        return showMsg(
          errorEl,
          "Falta configurar SUPABASE_URL / SUPABASE_ANON_KEY en login.html"
        );
      }

      try {
        await verifyTurnstileOrThrow();

        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin + "/login",
          },
        });

        if (error) throw new Error(error.message);
      } catch (err) {
        resetTurnstile();
        console.error("[Google] error:", err);
        showMsg(
          errorEl,
          err instanceof Error ? err.message : "Error con Google"
        );
      }
    });
  }

  // ================= REGISTRO =================
  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    const errorEl = document.getElementById("register-error");
    const successEl = document.getElementById("register-success");
    let busy = false;

    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;

      hideMsg(errorEl);
      hideMsg(successEl);

      const formData = new FormData(registerForm);

      const nombre = (formData.get("nombre") || "").toString().trim();
      const correo = normalizeEmail(formData.get("correo")?.toString());
      const contrasena = formData.get("contrasena")?.toString() || "";
      const confirmar =
        formData.get("confirmarContrasena")?.toString() || "";

      if (!nombre) return showMsg(errorEl, "Ingresa tu nombre.");
      if (!isValidEmail(correo))
        return showMsg(errorEl, "Ingresa un correo válido.");
      if (contrasena !== confirmar)
        return showMsg(errorEl, "Las contraseñas no coinciden.");
      if (!isStrongPassword(contrasena)) {
        return showMsg(
          errorEl,
          "La contraseña debe tener mínimo 8 caracteres e incluir letras y números."
        );
      }

      const payload = {
        nombre,
        correo,
        tipodocumento: formData.get("tipodocumento")?.toString() || "",
        documento: formData.get("documento")?.toString() || "",
        celular: formData.get("celular")?.toString() || "",
        direccionentrega:
          formData.get("direccionentrega")?.toString() || "",
        Departamento: formData.get("Departamento")?.toString() || "",
        Municipio: formData.get("Municipio")?.toString() || "",
        Barrio: formData.get("Barrio")?.toString() || "",
        contrasena,
      };

      busy = true;
      setLoading(registerForm, true);

      try {
        const { ok, data } = await postJSON("/api/auth/register", payload);
        if (!ok) throw new Error(data?.message || "Error al registrar usuario");

        showMsg(successEl, "Registro exitoso. Redirigiendo…");
        setTimeout(() => (window.location.href = "/login"), 900);
      } catch (err) {
        console.error("[Register] error:", err);
        showMsg(
          errorEl,
          err instanceof Error ? err.message : "Error al registrar"
        );
      } finally {
        busy = false;
        setLoading(registerForm, false);
      }
    });
  }

  // ================= RECUPERAR =================
  const recoverForm = document.getElementById("recover-form");
  if (recoverForm) {
    const errorEl = document.getElementById("recover-error");
    const successEl = document.getElementById("recover-success");
    let busy = false;

    recoverForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;

      hideMsg(errorEl);
      hideMsg(successEl);

      const formData = new FormData(recoverForm);
      const correo = normalizeEmail(formData.get("correo")?.toString());

      if (!isValidEmail(correo))
        return showMsg(errorEl, "Ingresa un correo válido.");

      busy = true;
      setLoading(recoverForm, true);

      try {
        const { ok, data } = await postJSON("/api/auth/recover", { correo });
        if (!ok)
          throw new Error(data?.message || "Error al procesar solicitud");

        showMsg(
          successEl,
          "Si el correo existe, te enviaremos instrucciones."
        );
      } catch (err) {
        console.error("[Recover] error:", err);
        showMsg(successEl, "");
        showMsg(
          errorEl,
          err instanceof Error
            ? err.message
            : "Error al procesar solicitud"
        );
      } finally {
        busy = false;
        setLoading(recoverForm, false);
      }
    });
  }
});
