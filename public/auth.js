// public/auth.js
// Login por contraseña + Google OAuth
(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function setError(msg) {
    const el = $("login-error");
    if (!el) return alert(msg);
    el.textContent = msg;
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
      console.error("[auth] window.sb no existe. Revisa que cargues supabase-js + config.js + supabaseClient.js.");
      setError("Error interno: cliente de autenticación no cargó.");
      return false;
    }
    return true;
  }

  function getNextParam() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "";
    // evita open-redirect
    if (!next.startsWith("/")) return "";
    if (next.startsWith("//")) return "";
    return next;
  }

  function getTurnstileToken() {
    // Turnstile mete un input hidden llamado "cf-turnstile-response"
    const el = document.querySelector('input[name="cf-turnstile-response"]');
    return String(el?.value || "").trim();
  }

  async function verifyAntiBotIfPresent() {
    // Si tienes Turnstile en la página, verificamos antes de auth (opcional pero recomendado)
    const token = getTurnstileToken();
    if (!token) return { ok: true }; // si no hay token, no bloqueamos

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

    // (opcional) captcha
    const anti = await verifyAntiBotIfPresent();
    if (!anti.ok) {
      hideLoader();
      setError(anti.message || "Captcha inválido");
      return;
    }

    try {
      const { data, error } = await window.sb.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data?.session) {
        const msg = String(error?.message || "No se pudo iniciar sesión");

        // mensaje más útil
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

    // mandamos next también al callback para volver donde quieres
    const next = getNextParam();
    const redirectTo =
      window.location.origin + "/auth/callback" + (next ? `?next=${encodeURIComponent(next)}` : "");

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
      // si no hay error, Supabase redirige (no hacemos nada más)
    } catch (err) {
      console.error("[google] error:", err);
      setError("Error inesperado con Google.");
      hideLoader();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = $("login-form");
    const googleBtn = $("google-login");

    if (!form) console.warn("[auth] No existe #login-form");
    if (!googleBtn) console.warn("[auth] No existe #google-login");

    form?.addEventListener("submit", onSubmitLogin);
    googleBtn?.addEventListener("click", onGoogleClick);

    console.log("[auth] listeners listos");
  });
})();
