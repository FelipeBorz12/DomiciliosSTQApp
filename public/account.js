// public/account.js
(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function showPanel(name) {
    const map = {
      empty: $("panel-empty"),
      perfil: $("panel-perfil"),
      pqrs: $("panel-pqrs"),
    };

    Object.keys(map).forEach((k) => {
      if (!map[k]) return;
      map[k].classList.toggle("hidden", k !== name);
    });

    const items = document.querySelectorAll(".acct-item");
    items.forEach((btn) => {
      const tab = btn.getAttribute("data-tab");
      const active = tab === name;
      btn.classList.toggle("bg-black/5", active);
    });
  }

  function setValue(id, v) {
    const el = $(id);
    if (el) el.value = v ?? "";
  }

  function setText(id, v) {
    const el = $(id);
    if (el) el.textContent = v ?? "";
  }

  function setDisabledProfile(disabled) {
    const ids = ["nombre", "celular", "direccionentrega", "Departamento", "Municipio", "Barrio"];
    ids.forEach((id) => {
      const el = $(id);
      if (el) el.disabled = disabled;
    });

    const saveBtn = $("save-btn");
    if (saveBtn) saveBtn.disabled = disabled;
  }

  function toast(msg, ms = 3200) {
    // si no tienes toast, usa alert
    const el = $("toast");
    if (!el) return alert(msg);
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), ms);
  }

  async function loadProfile() {
    const me = await window.tqSession.fetchMe();
    if (!me?.correo) return null;

    setText("account-email", me.correo);

    const p = me.perfil || {};
    setValue("nombre", p.nombre || "");
    setValue("celular", p.celular || "");
    setValue("direccionentrega", p.direccionentrega || "");
    setValue("Departamento", p.Departamento || "...");
    setValue("Municipio", p.Municipio || "...");
    setValue("Barrio", p.Barrio || "...");

    return me;
  }

  async function saveProfile() {
    const token = await window.tqSession.getAccessToken();
    if (!token) return { ok: false, message: "Sin sesión" };

    const payload = {
      nombre: String($("nombre")?.value || "").trim(),
      celular: String($("celular")?.value || "").trim(),
      direccionentrega: String($("direccionentrega")?.value || "").trim(),
      Departamento: String($("Departamento")?.value || "...").trim() || "...",
      Municipio: String($("Municipio")?.value || "...").trim() || "...",
      Barrio: String($("Barrio")?.value || "...").trim() || "...",
    };

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
    if (!res.ok) return { ok: false, message: json?.message || "No se pudo guardar" };
    return { ok: true };
  }

  document.addEventListener("DOMContentLoaded", async () => {
    // ✅ obliga sesión
    const ok = await window.tqSession.requireLoginOrRedirect("/account");
    if (!ok) return;

    // ✅ tabs
    showPanel("empty");

    document.querySelectorAll(".acct-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab") || "empty";
        showPanel(tab);
      });
    });

    // ✅ history
    const goHistory = $("go-history");
    if (goHistory) {
      goHistory.addEventListener("click", () => {
        window.location.href = "/history";
      });
    }

    // ✅ logout (menú)
    const logoutMenu = $("logout-menu");
    if (logoutMenu) {
      logoutMenu.addEventListener("click", () => window.tqSession.logout());
    }

    // ✅ perfil: cargar y bloquear campos
    setDisabledProfile(true);
    await loadProfile();

    // ✅ botón editar
    const editBtn = $("edit-btn");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        const nowDisabled = !!$("nombre")?.disabled;
        setDisabledProfile(!nowDisabled); // toggle
        editBtn.textContent = nowDisabled ? "Bloquear" : "Editar";
      });
    }

    // ✅ guardar
    const form = $("account-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const saveBtn = $("save-btn");
        const status = $("save-status");

        if (saveBtn) saveBtn.disabled = true;
        if (status) status.textContent = "Guardando...";

        const r = await saveProfile();
        if (!r.ok) {
          toast(r.message || "No se pudo guardar.");
          if (status) status.textContent = "";
          // si estamos en modo edición, re-habilita
          const editMode = $("nombre") && !$("nombre").disabled;
          if (saveBtn && editMode) saveBtn.disabled = false;
          return;
        }

        toast("Perfil actualizado ✅");
        if (status) status.textContent = "Guardado.";
        // mantener editable si estaban editando
        const editMode = $("nombre") && !$("nombre").disabled;
        if (saveBtn && editMode) saveBtn.disabled = false;
      });
    }
  });
})();
