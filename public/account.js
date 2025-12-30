// public/account.js
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

  function setTab(tab) {
    const empty = $("panel-empty");
    const perfil = $("panel-perfil");
    const pqrs = $("panel-pqrs");

    if (empty) empty.classList.toggle("hidden", tab !== "empty");
    if (perfil) perfil.classList.toggle("hidden", tab !== "perfil");
    if (pqrs) pqrs.classList.toggle("hidden", tab !== "pqrs");

    document.querySelectorAll(".acct-item").forEach((btn) => {
      const t = btn.getAttribute("data-tab");
      btn.classList.toggle("bg-black/5", t === tab);
    });
  }

  function lockProfileForm(locked) {
    ["nombre", "celular", "direccionentrega", "Departamento", "Municipio", "Barrio"].forEach((id) => {
      const el = $(id);
      if (el) el.disabled = locked;
    });

    const saveBtn = $("save-btn");
    if (saveBtn) saveBtn.disabled = locked;
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

  document.addEventListener("DOMContentLoaded", async () => {
    // Requiere login
    const logged = await window.tqSession?.isLoggedIn?.();
    if (!logged) {
      window.location.href = "/login?next=" + encodeURIComponent("/account");
      return;
    }

    // Menú
    setTab("empty");
    document.querySelectorAll(".acct-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab") || "empty";
        setTab(tab);
      });
    });

    const goHistory = $("go-history");
    if (goHistory) {
      goHistory.addEventListener("click", () => {
        window.location.href = "/history";
      });
    }

    const logoutMenu = $("logout-menu");
    if (logoutMenu) {
      logoutMenu.addEventListener("click", async () => {
        await window.tqSession?.logout?.();
      });
    }

    // Cargar perfil
    const me = await loadMeWithToken();
    if (!me?.correo) {
      // si algo falla, manda a login
      window.location.href = "/login?next=" + encodeURIComponent("/account");
      return;
    }

    setText("account-email", me.correo);

    const perfil = me.perfil || {};
    setValue("nombre", perfil.nombre || "");
    setValue("celular", perfil.celular || "");
    setValue("direccionentrega", perfil.direccionentrega || "");
    setValue("Departamento", perfil.Departamento || "...");
    setValue("Municipio", perfil.Municipio || "...");
    setValue("Barrio", perfil.Barrio || "...");

    // Perfil bloqueado por defecto
    lockProfileForm(true);

    const editBtn = $("edit-btn");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        const locked = $("nombre")?.disabled !== false; // si está disabled => locked
        lockProfileForm(!locked ? true : false);
        editBtn.textContent = locked ? "Cancelar" : "Editar";
        if (locked) setTab("perfil");
        if (!locked) {
          // cancel: recargar valores desde inputs actuales no hace falta, solo bloquear
          const status = $("save-status");
          if (status) status.textContent = "";
        }
      });
    }

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
          if (status) status.textContent = r.message || "No se pudo guardar.";
          if (saveBtn) saveBtn.disabled = false;
          return;
        }

        if (status) status.textContent = "Guardado ✅";
        lockProfileForm(true);
        if (editBtn) editBtn.textContent = "Editar";
      });
    }
  });
})();
