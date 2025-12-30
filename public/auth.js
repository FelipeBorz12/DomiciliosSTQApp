// public/auth.js
(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function setError(msg) {
    const el = $("login-error");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }

  function setSetPassError(msg) {
    const el = $("setpass-error");
    if (!el) return;
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
      console.error("[auth] window.sb no existe (cliente supabase)");
      setError("Error interno: cliente de autenticación no cargó.");
      return false;
    }
    return true;
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

  // ✅ Backend debe responder { exists: true/false }
  async function emailExists(correo) {
    try {
      const res = await fetch(`/api/auth/exists?correo=${encodeURIComponent(correo)}`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) return false;
      const j = await res.json().catch(() => null);
      return !!j?.exists;
    } catch {
      return false;
    }
  }

  function goIndex() {
    // tu server ya sirve index.html en "/"
    window.location.replace("/");
  }

  function goRegisterPrefill(email) {
    window.location.href = `/register?correo=${encodeURIComponent(email)}`;
  }

  async function maybeForceSetPasswordAfterGoogle() {
    // Si hay sesión (Google), obligamos a crear password si no está marcado
    const { data: sData } = await window.sb.auth.getSession();
    const session = sData?.session;
    if (!session) return false;

    const { data: uData } = await window.sb.auth.getUser();
    const user = uData?.user;
    if (!user) return false;

    const already = !!user.user_metadata?.password_set;

    if (already) {
      goIndex();
      return true;
    }

    // mostrar UI crear contraseña
    const loginView = $("login-view");
    const setPassView = $("set-password-view");
    if (loginView) loginView.classList.add("hidden");
    if (setPassView) setPassView.classList.remove("hidden");

    return true;
  }

  async function onSubmitSetPassword() {
    setSetPassError("");

    const p1 = String($("new-pass")?.value || "");
    const p2 = String($("new-pass-2")?.value || "");

    if (p1.length < 8) {
      setSetPassError("La contraseña debe tener mínimo 8 caracteres.");
      return;
    }
    if (p1 !== p2) {
      setSetPassError("Las contraseñas no coinciden.");
      return;
    }

    showLoader("Guardando contraseña…");

    try {
      const { error } = await window.sb.auth.updateUser({
        password: p1,
        data: { password_set: true },
      });

      if (error) {
        console.error("[set password] error:", error);
        setSetPassError(error.message || "No se pudo guardar la contraseña.");
        return;
      }

      goIndex();
    } catch (e) {
      console.error("[set password] error:", e);
      setSetPassError("Error inesperado guardando contraseña.");
    } finally {
      hideLoader();
    }
  }

  async function onSubmitLogin(e) {
    e.preventDefault();
    setError("");

    if (!ensureSb()) return;

    const form = e.currentTarget;

    const emailEl =
      form?.querySelector('input[name="correo"]') ||
      form?.querySelector('input[type="email"]');

    const passEl =
      form?.querySelector('input[name="contrasena"]') ||
      form?.querySelector('input[type="password"]');

    const email = normalizeEmail(emailEl?.value);
    const password = String(passEl?.value || "");

    if (!email || !password) {
      setError("Correo y contraseña son obligatorios.");
      return;
    }

    showLoader("Verificando…");

    // ✅ Si el correo NO existe -> register
    const exists = await emailExists(email);
    if (!exists) {
      hideLoader();
      goRegisterPrefill(email);
      return;
    }

    // Turnstile (si está)
    const anti = await verifyAntiBotIfPresent();
    if (!anti.ok) {
      hideLoader();
      setError(anti.message || "Captcha inválido");
      return;
    }

    showLoader("Iniciando sesión…");

    try {
      const { data, error } = await window.sb.auth.signInWithPassword({ email, password });

      if (error || !data?.session) {
        const msg = String(error?.message || "No se pudo iniciar sesión");
        console.error("[login password] error:", error);
        // aquí no podemos distinguir si es password incorrecta o no existe (por seguridad),
        // pero ya verificamos exists con backend, así que lo tratamos como password incorrecta.
        setError("Contraseña incorrecta. Si la olvidaste, usa “¿Olvidaste tu contraseña?”");
        return;
      }

      goIndex();
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

    // Volver exactamente a esta misma ruta
    const redirectTo = window.location.origin + window.location.pathname;

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

  async function handleOAuthReturnIfAny() {
    if (!ensureSb()) return;

    // Si ya hay sesión, revisa si debe pedir contraseña
    try {
      const { data } = await window.sb.auth.getSession();
      if (data?.session) {
        const forced = await maybeForceSetPasswordAfterGoogle();
        if (!forced) goIndex();
        return;
      }
    } catch {}

    // Si viene con ?code=..., forzamos exchange por si acaso
    const params = new URLSearchParams(window.location.search);
    if (params.has("code")) {
      showLoader("Procesando inicio de sesión…");
      try {
        const code = params.get("code");
        if (code) {
          const ex = await window.sb.auth.exchangeCodeForSession(code);
          if (ex?.data?.session) {
            const forced = await maybeForceSetPasswordAfterGoogle();
            if (!forced) goIndex();
            return;
          }
        }
        setError("No se pudo completar el inicio de sesión con Google.");
      } catch (e) {
        console.error("[oauth return] error:", e);
        setError("Error procesando el inicio de sesión con Google.");
      } finally {
        hideLoader();
      }
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const form = $("login-form");
    const googleBtn = $("google-login");
    const setPassBtn = $("setpass-btn");
    const skipBtn = $("skip-btn");

    form?.addEventListener("submit", onSubmitLogin);
    googleBtn?.addEventListener("click", onGoogleClick);
    setPassBtn?.addEventListener("click", onSubmitSetPassword);
    skipBtn?.addEventListener("click", () => goIndex());

    await handleOAuthReturnIfAny();

    console.log("[auth] listeners listos");
  });
})();
