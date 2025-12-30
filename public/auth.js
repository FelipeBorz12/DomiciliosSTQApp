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

  function safeNext(next) {
    if (!next) return "";
    if (next.startsWith("http://") || next.startsWith("https://")) return "";
    if (!next.startsWith("/")) return "";
    if (next.startsWith("//")) return "";
    return next;
  }

  function getNextParam() {
    const params = new URLSearchParams(window.location.search);
    return safeNext(params.get("next") || "");
  }

  function goIndex() {
    window.location.replace("/");
  }

  function goNextOrIndex() {
    const next = getNextParam();
    window.location.replace(next || "/");
  }

  // Turnstile token
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

  // ✅ backend: /api/auth/exists -> { exists: boolean }
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

  function goRegisterPrefill(email) {
    window.location.href = `/register?correo=${encodeURIComponent(email)}`;
  }

  function readEmailPasswordFromForm(form) {
    const emailEl =
      form?.querySelector('input[name="correo"]') ||
      form?.querySelector('input[name="email"]') ||
      form?.querySelector('input[type="email"]');

    const passEl =
      form?.querySelector('input[name="contrasena"]') ||
      form?.querySelector('input[name="password"]') ||
      form?.querySelector('input[type="password"]');

    const email = normalizeEmail(emailEl?.value);
    const password = String(passEl?.value || "");
    return { email, password };
  }

  // ✅ Si ya hay sesión, no mostrar login: redirigir
  async function redirectIfAlreadyLoggedIn() {
    if (!ensureSb()) return;
    try {
      const { data } = await window.sb.auth.getSession();
      if (data?.session) {
        goNextOrIndex();
      }
    } catch {}
  }

  async function onSubmitLogin(e) {
    e.preventDefault();
    setError("");

    if (!ensureSb()) return;

    const form = e.currentTarget;
    const { email, password } = readEmailPasswordFromForm(form);

    if (!email || !password) {
      setError("Correo y contraseña son obligatorios.");
      return;
    }

    showLoader("Verificando…");

    // ✅ si no existe en tu tabla usuarios -> register
    const exists = await emailExists(email);
    if (!exists) {
      hideLoader();
      goRegisterPrefill(email);
      return;
    }

    // ✅ turnstile (si está)
    const anti = await verifyAntiBotIfPresent();
    if (!anti.ok) {
      hideLoader();
      setError(anti.message || "Captcha inválido");
      return;
    }

    showLoader("Iniciando sesión…");

    try {
      // ✅ LOGIN REAL: Supabase Auth (NO /api/auth/login)
      const { data, error } = await window.sb.auth.signInWithPassword({ email, password });

      if (error || !data?.session) {
        console.error("[login] error:", error);
        setError("Credenciales inválidas. Verifica correo y contraseña.");
        return;
      }

      // ✅ después del login: index o next
      goNextOrIndex();
    } catch (err) {
      console.error("[login] error inesperado:", err);
      setError("Error inesperado iniciando sesión.");
    } finally {
      hideLoader();
    }
  }

  async function onGoogleClick() {
    setError("");
    if (!ensureSb()) return;

    showLoader("Redirigiendo a Google…");

    // volvemos a /login para completar el exchange PKCE y luego redirigir
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

  // ✅ manejo retorno de Google (PKCE)
  async function handleOAuthReturnIfAny() {
    if (!ensureSb()) return;

    const params = new URLSearchParams(window.location.search);

    // si supabase ya detectó sesión en url, redirige
    try {
      const { data } = await window.sb.auth.getSession();
      if (data?.session) {
        goNextOrIndex();
        return;
      }
    } catch {}

    if (!params.has("code")) return;

    showLoader("Procesando inicio de sesión…");
    try {
      const code = params.get("code");
      if (code) {
        const ex = await window.sb.auth.exchangeCodeForSession(code);
        if (ex?.data?.session) {
          goNextOrIndex();
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

  document.addEventListener("DOMContentLoaded", async () => {
    const form = $("login-form");
    const googleBtn = $("google-login");

    form?.addEventListener("submit", onSubmitLogin);
    googleBtn?.addEventListener("click", onGoogleClick);

    await handleOAuthReturnIfAny();
    await redirectIfAlreadyLoggedIn();

    console.log("[auth] listeners listos");
  });
})();
