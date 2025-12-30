// public/auth.js
// Login por contraseña + Google OAuth (sin archivos extra)

(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function setError(msg) {
    const el = $("login-error");
    if (!el) return alert(msg);
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }

  function showLoader(msg) {
    const loader = $("global-loader");
    const txt = $("loader-text");
    if (txt && msg) txt.textContent = msg;
    if (loader) loader.classList.remove("hidden");
  }

  function hideLoader() {
    const loader = $("global-loader");
    if (loader) loader.classList.add("hidden");
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function ensureSb() {
    if (!window.sb) {
      console.error("[auth] window.sb no existe. Debes crear el cliente Supabase en login.html (inline).");
      setError("Error interno: cliente de autenticación no cargó.");
      return false;
    }
    return true;
  }

  function getNextParam() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "";
    if (!next.startsWith("/")) return "";
    if (next.startsWith("//")) return "";
    return next;
  }

  function getTurnstileToken() {
    const el = document.querySelector('input[name="cf-turnstile-response"]');
    return String(el?.value || "").trim();
  }

  async function verifyAntiBotIfPresent() {
    const token = getTurnstileToken();
    if (!token) return { ok: true };

    try {
      const res = await fetch("/api/antibot/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cf_turnstile_response: token }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        return { ok: false, message: data?.message || "Captcha inválido" };
      }
      return { ok: true };
    } catch (e) {
      console.warn("[antibot] error:", e);
      return { ok: false, message: "No se pudo validar captcha" };
    }
  }

  async function handleOAuthReturnIfAny() {
    // Si Supabase vuelve con ?code=..., detectSessionInUrl ya lo procesa,
    // pero hacemos esto para asegurar redirección automática.
    if (!ensureSb()) return;

    const params = new URLSearchParams(window.location.search);
    const hasCode = params.has("code");
    const hasError = params.has("error") || params.has("error_description");

    if (hasError) {
      const desc = params.get("error_description") || params.get("error") || "Error en Google";
      setError(decodeURIComponent(desc));
      return;
    }

    // Si volvimos de Google, espera sesión y redirige
    if (hasCode) {
      showLoader("Procesando inicio de sesión…");

      // supabase-js suele intercambiar el code automáticamente,
      // pero por estabilidad intentamos obtener sesión y, si no, intercambiamos.
      try {
        let { data } = await window.sb.auth.getSession();
        let session = data?.session;

        if (!session) {
          const code = params.get("code");
          if (code) {
            const ex = await window.sb.auth.exchangeCodeForSession(code);
            if (ex?.data?.session) session = ex.data.session;
          }
        }

        if (session) {
          const next = getNextParam();
          window.location.replace(next || "/account");
          return;
        }

        setError("No se pudo completar el inicio de sesión con Google.");
      } catch (e) {
        console.error("[oauth return] error:", e);
        setError("Error procesando el inicio de sesión con Google.");
      } finally {
        hideLoader();
      }
    } else {
      // Si ya hay sesión (usuario vuelve a /login estando logueado), reenvía
      try {
        const { data } = await window.sb.auth.getSession();
        if (data?.session) {
          const next = getNextParam();
          window.location.replace(next || "/account");
        }
      } catch {}
    }
  }

  async function onSubmitLogin(e) {
    e.preventDefault();
    setError("");

    if (!ensureSb()) return;

    const form = e.currentTarget;
    const email = normalizeEmail(form.querySelector('input[name="correo"]')?.value);
    const password = String(form.querySelector('input[name="contrasena"]')?.value || "");

    if (!email || !password) {
      setError("Correo y contraseña son obligatorios.");
      return;
    }

    showLoader("Iniciando sesión…");

    const anti = await verifyAntiBotIfPresent();
    if (!anti.ok) {
      hideLoader();
      setError(anti.message || "Captcha inválido");
      return;
    }

    try {
      const { data, error } = await window.sb.auth.signInWithPassword({ email, password });

      if (error || !data?.session) {
        const msg = String(error?.message || "No se pudo iniciar sesión");
        if (msg.toLowerCase().includes("invalid login credentials")) {
          setError("Credenciales inválidas. Verifica correo/contraseña.");
        } else {
          setError(msg);
        }
        return;
      }

      const next = getNextParam();
      window.location.href = next || "/account";
    } catch (err) {
      console.error("[login] error:", err);
      setError("Error inesperado iniciando sesión.");
    } finally {
      hideLoader();
    }
  }

  async function onGoogleClick() {
    setError("");
    if (!ensureSb()) return;

    showLoader("Redirigiendo a Google…");

    const next = getNextParam();
    const redirectTo = window.location.origin + "/login" + (next ? `?next=${encodeURIComponent(next)}` : "");

    try {
      const { error } = await window.sb.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (error) {
        console.error("[google] error:", error);
        setError(error.message || "No se pudo iniciar con Google.");
        hideLoader();
      }
    } catch (err) {
      console.error("[google] error:", err);
      setError("Error inesperado con Google.");
      hideLoader();
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const form = $("login-form");
    const googleBtn = $("google-login");

    form?.addEventListener("submit", onSubmitLogin);
    googleBtn?.addEventListener("click", onGoogleClick);

    // ✅ importante: procesa retorno de Google y/o sesión existente
    await handleOAuthReturnIfAny();

    console.log("[auth] listeners listos");
  });
})();
