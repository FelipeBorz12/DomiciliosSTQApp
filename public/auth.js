// public/auth.js
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
      console.error(
        "[auth] window.sb no existe. Debes crear el cliente Supabase en login.html (inline)."
      );
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

  // ✅ Aquí SOLO nos importa: si hay sesión -> index.html
  async function handleOAuthReturnIfAny() {
    if (!ensureSb()) return;

    const params = new URLSearchParams(window.location.search);
    const hasError = params.has("error") || params.has("error_description");
    const hasCode = params.has("code");

    if (hasError) {
      const desc =
        params.get("error_description") || params.get("error") || "Error en Google";
      setError(decodeURIComponent(desc));
      return;
    }

    // Si supabase ya procesó la URL, con getSession basta.
    if (hasCode) {
      showLoader("Procesando inicio de sesión…");
      try {
        const { data, error } = await window.sb.auth.getSession();
        if (error) console.warn("[oauth return] getSession error:", error);

        if (data?.session?.access_token) {
          window.location.replace("/index.html");
          return;
        }

        // fallback: intenta exchange explícito
        const code = params.get("code");
        if (code) {
          const ex = await window.sb.auth.exchangeCodeForSession(code);
          if (ex?.data?.session?.access_token) {
            window.location.replace("/index.html");
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
      return;
    }

    // Si entras manualmente a /login y ya hay sesión: manda a index
    try {
      const { data } = await window.sb.auth.getSession();
      if (data?.session?.access_token) {
        window.location.replace("/index.html");
      }
    } catch {}
  }

  function readEmailPasswordFromForm(form) {
    // 1) por name (form.elements)
    const emailElByElements =
      (form?.elements && (form.elements["correo"] || form.elements["email"])) || null;
    const passElByElements =
      (form?.elements &&
        (form.elements["contrasena"] ||
          form.elements["password"] ||
          form.elements["contraseña"])) ||
      null;

    // 2) por querySelector
    const emailEl =
      emailElByElements ||
      form?.querySelector('input[name="correo"]') ||
      form?.querySelector('input[name="email"]') ||
      form?.querySelector('input[type="email"]');

    const passEl =
      passElByElements ||
      form?.querySelector('input[name="contrasena"]') ||
      form?.querySelector('input[name="password"]') ||
      form?.querySelector('input[type="password"]');

    const email = normalizeEmail(emailEl?.value);
    const password = String(passEl?.value || "");

    return { email, password };
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

    showLoader("Iniciando sesión…");

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
        console.error("[login password] error:", error);

        if (msg.toLowerCase().includes("invalid login credentials")) {
          setError(
            "Credenciales inválidas. Si tu cuenta fue creada con Google, no tiene contraseña. Usa Google o crea contraseña en 'Olvidaste tu contraseña'."
          );
        } else {
          setError(msg);
        }
        return;
      }

      // ✅ SIEMPRE index.html
      window.location.href = "/index.html";
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

    // ✅ Vuelve a /login (esta misma página), luego handleOAuthReturnIfAny manda a index.
    const redirectTo = window.location.origin + "/login";

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

    if (!form) console.warn("[auth] No existe #login-form");
    if (!googleBtn) console.warn("[auth] No existe #google-login");

    form?.addEventListener("submit", onSubmitLogin);
    googleBtn?.addEventListener("click", onGoogleClick);

    await handleOAuthReturnIfAny();

    console.log("[auth] listeners listos");
  });
})();
