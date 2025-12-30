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

  function goIndex() {
    window.location.replace("/");
  }

  function goRegisterPrefill(email) {
    window.location.href = `/register?correo=${encodeURIComponent(email)}`;
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

  function showSetPasswordView() {
    const loginView = $("login-view");
    const setPassView = $("set-password-view");

    // si no existen, fallback a register
    if (!setPassView) return false;

    if (loginView) loginView.classList.add("hidden");
    setPassView.classList.remove("hidden");
    return true;
  }

  async function getAccessToken() {
    try {
      const { data } = await window.sb.auth.getSession();
      return data?.session?.access_token || "";
    } catch {
      return "";
    }
  }

  // ===================== LOGIN MANUAL (bcrypt en backend) =====================
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

    // si no existe, manda a register
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
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ correo: email, contrasena: password }),
      });

      const j = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 404) {
          hideLoader();
          goRegisterPrefill(email);
          return;
        }
        if (res.status === 401) {
          setError("Contraseña incorrecta.");
          return;
        }
        if (res.status === 409 && j?.code === "PASSWORD_NOT_SET") {
          setError("Este usuario no tiene contraseña. Inicia con Google y crea tu contraseña.");
          return;
        }

        setError(j?.message || "No se pudo iniciar sesión.");
        return;
      }

      // ✅ Setear sesión Supabase en el navegador
      if (j?.session?.access_token && j?.session?.refresh_token) {
        await window.sb.auth.setSession({
          access_token: j.session.access_token,
          refresh_token: j.session.refresh_token,
        });
      }

      goIndex();
    } catch (err) {
      console.error("[login bcrypt] error:", err);
      setError("Error inesperado iniciando sesión.");
    } finally {
      hideLoader();
    }
  }

  // ===================== GOOGLE =====================
  async function onGoogleClick() {
    setError("");
    if (!ensureSb()) return;

    showLoader("Redirigiendo a Google…");

    // volver a esta misma ruta
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

  async function checkGoogleStatusAndRoute() {
    // ya hay sesión google, validar contra backend
    const token = await getAccessToken();
    if (!token) return false;

    try {
      const res = await fetch("/api/auth/google/status", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      const j = await res.json().catch(() => null);

      if (!res.ok) {
        setError(j?.message || "No se pudo validar el usuario con Google.");
        return true;
      }

      // si NO existe -> pedir contraseña y crear
      if (!j?.exists) {
        const shown = showSetPasswordView();
        if (!shown) {
          // si tu login.html no tiene vista set-password, manda a register
          goRegisterPrefill(j?.correo || "");
        }
        return true;
      }

      // existe pero necesita password (hash faltante)
      if (j?.needs_password) {
        const shown = showSetPasswordView();
        if (!shown) goRegisterPrefill(j?.correo || "");
        return true;
      }

      // existe y todo ok
      goIndex();
      return true;
    } catch (e) {
      console.error("[google/status] error:", e);
      setError("Error validando usuario con Google.");
      return true;
    }
  }

  async function onSubmitSetPassword() {
    setSetPassError("");
    if (!ensureSb()) return;

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

    showLoader("Creando usuario…");

    try {
      const token = await getAccessToken();
      if (!token) {
        setSetPassError("No hay sesión de Google activa.");
        return;
      }

      const res = await fetch("/api/auth/google/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({ contrasena: p1 }),
      });

      const j = await res.json().catch(() => null);

      if (!res.ok) {
        setSetPassError(j?.message || "No se pudo completar el registro.");
        return;
      }

      goIndex();
    } catch (e) {
      console.error("[google/complete] error:", e);
      setSetPassError("Error inesperado guardando contraseña.");
    } finally {
      hideLoader();
    }
  }

  async function handleOAuthReturnIfAny() {
    if (!ensureSb()) return;

    // Si ya hay sesión -> revisar estado en backend
    try {
      const { data } = await window.sb.auth.getSession();
      if (data?.session) {
        await checkGoogleStatusAndRoute();
        return;
      }
    } catch {}

    // Si viene con ?code=..., forzar exchange y luego revisar estado
    const params = new URLSearchParams(window.location.search);
    if (params.has("code")) {
      showLoader("Procesando inicio de sesión…");
      try {
        const code = params.get("code");
        if (code) {
          await window.sb.auth.exchangeCodeForSession(code);
        }
        await checkGoogleStatusAndRoute();
      } catch (e) {
        console.error("[oauth return] error:", e);
        setError("Error procesando el inicio de sesión con Google.");
      } finally {
        hideLoader();
      }
    }
  }

  // ===================== INIT =====================
  document.addEventListener("DOMContentLoaded", async () => {
    const form = $("login-form");
    const googleBtn = $("google-login");
    const setPassBtn = $("setpass-btn");
    const skipBtn = $("skip-btn");

    form?.addEventListener("submit", onSubmitLogin);
    googleBtn?.addEventListener("click", onGoogleClick);

    // si tu login.html NO tiene estos botones/inputs, no pasa nada
    setPassBtn?.addEventListener("click", onSubmitSetPassword);
    skipBtn?.addEventListener("click", () => goIndex());

    await handleOAuthReturnIfAny();

    console.log("[auth] listeners listos");
  });
})();
