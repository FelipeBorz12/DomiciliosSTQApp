// public/account.js
// Página /account: muestra y permite actualizar el perfil.

(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value ?? "";
  }

  function setValue(id, value) {
    const el = $(id);
    if (el) el.value = value ?? "";
  }

  function toast(msg, ms = 3500) {
    const el = $("toast");
    if (!el) return alert(msg);
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), ms);
  }

  async function loadMeWithToken() {
    const supa = window.tqSession?.getSupabase?.();
    if (!supa) return null;
    const { data } = await supa.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return null;

    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    if (!res.ok) return null;
    return await res.json();
  }

  async function saveProfile(payload) {
    const supa = window.tqSession?.getSupabase?.();
    if (!supa) return { ok: false, message: "Supabase no disponible" };

    const { data } = await supa.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return { ok: false, message: "Sin sesión" };

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: json?.message || "Error guardando" };
    return { ok: true };
  }

  function disableForm(msg) {
    const note = $("legacy-note");
    if (note) {
      note.textContent = msg;
      note.classList.remove("hidden");
    }

    const saveBtn = $("save-btn");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.classList.add("opacity-50", "cursor-not-allowed");
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const logoutBtn = $("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await window.tqSession?.signOutAll?.();
        window.location.href = "/";
      });
    }

      const loggedIn = await window.tqSession.isLoggedIn();
      if (!loggedIn) {
        // Fallback: sesión legacy (solo localStorage). Útil para usuarios antiguos.
        const local = window.tqSession.getLocalUser();
        if (local && local.correo) {
          setText("account-email", local.correo);
          setText("account-status", local.legacy ? "(legacy)" : "");

          const perfil = local.perfil || {};
          setValue("nombre", perfil.nombre || "");
          setValue("celular", perfil.celular || "");
          setValue("direccionentrega", perfil.direccionentrega || "");
          setValue("Departamento", perfil.Departamento || perfil.Departamento || "...");
          setValue("Municipio", perfil.Municipio || "...");
          setValue("Barrio", perfil.Barrio || "...");

          disableForm(
            "Tu sesión es legacy (usuarios antiguos). Para editar tu perfil aquí, inicia sesión con Google o con una cuenta creada en Supabase Auth."
          );
          return;
        }

        const next = encodeURIComponent("/account");
        window.location.href = `/login?next=${next}`;
        return;
      }

    // Carga perfil real
    const me = await loadMeWithToken();
    if (!me?.correo) {
      toast("No se pudo cargar tu perfil.");
      return;
    }

    setText("account-email", me.correo);
    setText("account-status", "");

    const perfil = me.perfil || {};
    setValue("nombre", perfil.nombre || "");
    setValue("celular", perfil.celular || "");
    setValue("direccionentrega", perfil.direccionentrega || "");
    setValue("Departamento", perfil.Departamento || "...");
    setValue("Municipio", perfil.Municipio || "...");
    setValue("Barrio", perfil.Barrio || "...");

    // Guardar
    const form = $("account-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const saveBtn = $("save-btn");
        const status = $("save-status");

        if (saveBtn) saveBtn.disabled = true;
        if (status) status.textContent = "Guardando...";

        const payload = {
          nombre: ($("nombre")?.value || "").trim(),
          celular: ($("celular")?.value || "").trim(),
          direccionentrega: ($("direccionentrega")?.value || "").trim(),
          Departamento: ($("Departamento")?.value || "...").trim() || "...",
          Municipio: ($("Municipio")?.value || "...").trim() || "...",
          Barrio: ($("Barrio")?.value || "...").trim() || "...",
        };

        const r = await saveProfile(payload);
        if (!r.ok) {
          toast(r.message || "No se pudo guardar.");
          if (status) status.textContent = "";
          if (saveBtn) saveBtn.disabled = false;
          return;
        }

        // refresca burgerUser
        try {
          const cached = JSON.parse(localStorage.getItem("burgerUser") || "null") || {};
          cached.perfil = { ...(cached.perfil || {}), ...payload };
          localStorage.setItem("burgerUser", JSON.stringify(cached));
        } catch {}

        toast("Perfil actualizado ✅");
        if (status) status.textContent = "Guardado.";
        if (saveBtn) saveBtn.disabled = false;
      });
    }
  });
})();
