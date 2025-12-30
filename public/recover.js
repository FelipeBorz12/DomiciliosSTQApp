// public/recover.js
(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function show(id) {
    const el = $(id);
    if (el) el.classList.remove("hidden");
  }

  function hide(id) {
    const el = $(id);
    if (el) el.classList.add("hidden");
  }

  function setText(id, msg) {
    const el = $(id);
    if (el) el.textContent = msg || "";
  }

  function setErr(id, msg) {
    setText(id, msg);
    const el = $(id);
    if (el) el.classList.toggle("hidden", !msg);
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  async function detectRecoverySession() {
    // Si Supabase detecta sesión en URL (detectSessionInUrl), aquí ya debería estar lista.
    const sb = window.tqSession.getSupabase();
    if (!sb) return false;

    try {
      const { data } = await sb.auth.getSession();
      return !!data?.session;
    } catch {
      return false;
    }
  }

  async function onRecoverSubmit(e) {
    e.preventDefault();

    setErr("recover-error", "");
    setErr("recover-ok", "");

    const sb = window.tqSession.getSupabase();
    if (!sb) {
      setErr("recover-error", "Supabase no disponible.");
      return;
    }

    const email = normalizeEmail($("recover-email")?.value);
    if (!email) {
      setErr("recover-error", "Escribe tu correo.");
      return;
    }

    try {
      // ✅ Enviar correo con link que vuelve a /recover
      const redirectTo = window.location.origin + "/recover";
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });

      if (error) {
        console.error("[recover] error:", error);
        setErr("recover-error", error.message || "No se pudo enviar el enlace.");
        return;
      }

      // Por seguridad Supabase no confirma si existe o no
      setErr("recover-ok", "Si el correo existe, te llegará un enlace para cambiar tu contraseña.");
      show("recover-ok");
    } catch (err) {
      console.error("[recover] error:", err);
      setErr("recover-error", "Error inesperado enviando el enlace.");
    }
  }

  async function onSetPassSubmit(e) {
    e.preventDefault();

    setErr("setpass-error", "");
    setErr("setpass-ok", "");

    const sb = window.tqSession.getSupabase();
    if (!sb) {
      setErr("setpass-error", "Supabase no disponible.");
      return;
    }

    const p1 = String($("new-pass")?.value || "");
    const p2 = String($("new-pass-2")?.value || "");

    if (p1.length < 8) {
      setErr("setpass-error", "La contraseña debe tener mínimo 8 caracteres.");
      return;
    }
    if (p1 !== p2) {
      setErr("setpass-error", "Las contraseñas no coinciden.");
      return;
    }

    try {
      // ✅ Cambiar contraseña del usuario autenticado por link recovery
      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) {
        console.error("[setpass] error:", error);
        setErr("setpass-error", error.message || "No se pudo guardar la contraseña.");
        return;
      }

      setErr("setpass-ok", "Contraseña actualizada ✅");
      show("setpass-ok");

      // opcional: cerrar sesión y mandar a login
      setTimeout(async () => {
        try {
          await window.tqSession.logout();
        } catch {
          window.location.href = "/login";
        }
      }, 900);
    } catch (err) {
      console.error("[setpass] error:", err);
      setErr("setpass-error", "Error inesperado guardando la contraseña.");
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const recoverForm = $("recover-form");
    const setPassForm = $("setpass-form");

    recoverForm?.addEventListener("submit", onRecoverSubmit);
    setPassForm?.addEventListener("submit", onSetPassSubmit);

    // ✅ si llegó desde link recovery, Supabase detecta sesión y mostramos set password
    const hasSession = await detectRecoverySession();
    if (hasSession) {
      hide("recover-view");
      show("setpass-view");
    } else {
      show("recover-view");
      hide("setpass-view");
    }
  });
})();
