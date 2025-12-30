// public/account.js
// Layout tipo "Cuenta" con sidebar + vistas dinámicas: Inicio/Perfil/Pedidos/PQRS/Logout

(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg, ms = 3200) {
    const el = $("toast");
    if (!el) return alert(msg);
    el.textContent = msg || "";
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), ms);
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

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value ?? "";
  }

  function setValue(id, value) {
    const el = $(id);
    if (el) el.value = value ?? "";
  }

  function disableProfileForm(disabled) {
    const ids = ["nombre", "celular", "direccionentrega", "Departamento", "Municipio", "Barrio"];
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.disabled = !!disabled;
      el.classList.toggle("opacity-60", !!disabled);
      el.classList.toggle("cursor-not-allowed", !!disabled);
    });
  }

  function setActiveMenu(view) {
    document.querySelectorAll("[data-view]").forEach((btn) => {
      // Evita marcar botones de "acciones" dentro de la tarjeta
      if (!btn.classList.contains("tq-item") && !btn.classList.contains("tq-tab") && !btn.classList.contains("quick-btn")) return;
      btn.classList.toggle("bg-[#7a0f1a]", btn.classList.contains("quick-btn") ? false : false);
    });

    // Sidebar desktop
    document.querySelectorAll(".tq-item[data-view]").forEach((btn) => {
      const isActive = btn.getAttribute("data-view") === view;
      btn.classList.toggle("bg-black/5", isActive);
    });

    // Tabs mobile
    document.querySelectorAll(".tq-tab[data-view]").forEach((btn) => {
      const isActive = btn.getAttribute("data-view") === view;
      btn.classList.toggle("bg-black/10", isActive);
      btn.classList.toggle("bg-black/5", !isActive);
    });
  }

  function showView(view) {
    const views = ["home", "profile", "orders", "pqrs", "logout"];
    views.forEach((v) => {
      const el = $("view-" + v);
      if (!el) return;
      el.classList.toggle("hidden", v !== view);
    });

    setActiveMenu(view);

    // Persistimos vista (opcional)
    try {
      sessionStorage.setItem("tq_account_view", view);
    } catch {}
  }

  function getSavedView() {
    try {
      return sessionStorage.getItem("tq_account_view") || "home";
    } catch {
      return "home";
    }
  }

  async function getToken() {
    const supa = window.tqSession?.getSupabase?.();
    if (!supa) return "";
    const { data } = await supa.auth.getSession();
    return data?.session?.access_token || "";
  }

  async function fetchMe() {
    const token = await getToken();
    if (!token) return null;

    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function saveProfile(payload) {
    const token = await getToken();
    if (!token) return { ok: false, message: "Sin sesión" };

    try {
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
    } catch (e) {
      return { ok: false, message: "Error de red guardando perfil" };
    }
  }

  function disableFormLegacy(msg) {
    const note = $("legacy-note");
    if (note) {
      note.textContent = msg;
      note.classList.remove("hidden");
    }
    disableProfileForm(true);

    const editBtn = $("edit-profile-btn");
    const saveBtn = $("save-profile-btn");
    if (editBtn) editBtn.disabled = true;
    if (saveBtn) saveBtn.disabled = true;
  }

  async function ensureLoggedOrRedirect() {
    const ok = await window.tqSession?.isLoggedIn?.();
    if (ok) return true;

    const local = window.tqSession?.getLocalUser?.();
    if (local && local.correo) {
      // legacy: mostramos algo, pero no permitimos edición
      setText("account-email", local.correo);
      setText("account-status", local.legacy ? "(legacy)" : "");

      const perfil = local.perfil || {};
      setValue("nombre", perfil.nombre || "");
      setValue("celular", perfil.celular || "");
      setValue("direccionentrega", perfil.direccionentrega || "");
      setValue("Departamento", perfil.Departamento || "...");
      setValue("Municipio", perfil.Municipio || "...");
      setValue("Barrio", perfil.Barrio || "...");

      disableFormLegacy(
        "Tu sesión es legacy (usuarios antiguos). Para editar tu perfil aquí, inicia sesión con Google o con una cuenta creada en Supabase Auth."
      );

      return true;
    }

    const next = encodeURIComponent("/account");
    window.location.href = `/login?next=${next}`;
    return false;
  }

  async function loadProfileIntoForm() {
    showLoader("Cargando perfil…");

    try {
      const me = await fetchMe();
      if (!me?.correo) {
        toast("No se pudo cargar tu perfil.");
        return { ok: false, correo: "" };
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

      // locked por defecto
      disableProfileForm(true);

      // cachea burgerUser para otras páginas (history, etc.)
      try {
        localStorage.setItem(
          "burgerUser",
          JSON.stringify({
            correo: me.correo,
            rol: me.rol,
            userId: me.userId,
            perfil: me.perfil,
            legacy: false,
          })
        );
      } catch {}

      return { ok: true, correo: me.correo };
    } finally {
      hideLoader();
    }
  }

  function wireNavigation() {
    // Clicks en items del menú (sidebar y tabs y botones rápidos)
    document.querySelectorAll("[data-view]").forEach((node) => {
      node.addEventListener("click", async (e) => {
        const view = node.getAttribute("data-view");
        if (!view) return;

        if (view === "orders") {
          // vista orders muestra botón, pero si el usuario clickea "Pedidos" directo, mostramos vista
          showView("orders");
          return;
        }

        if (view === "logout") {
          showView("logout");
          return;
        }

        showView(view);
      });
    });
  }

  function wireProfileEditSave() {
    const editBtn = $("edit-profile-btn");
    const saveBtn = $("save-profile-btn");
    const status = $("save-status");
    const form = $("account-form");

    let isEditing = false;

    function setEditing(on) {
      isEditing = !!on;
      disableProfileForm(!isEditing);

      if (editBtn) editBtn.textContent = isEditing ? "Cancelar" : "Editar";
      if (saveBtn) saveBtn.disabled = !isEditing;

      if (status) status.textContent = isEditing ? "Edición habilitada." : "";
    }

    editBtn?.addEventListener("click", async () => {
      // Si es legacy, tqSession no deja editar (se deshabilita arriba)
      setEditing(!isEditing);
      if (!isEditing) {
        // canceló: recargar datos por si se ensució
        await loadProfileIntoForm();
      }
    });

    async function doSave() {
      if (!isEditing) return;

      const payload = {
        nombre: ($("nombre")?.value || "").trim(),
        celular: ($("celular")?.value || "").trim(),
        direccionentrega: ($("direccionentrega")?.value || "").trim(),
        Departamento: ($("Departamento")?.value || "...").trim() || "...",
        Municipio: ($("Municipio")?.value || "...").trim() || "...",
        Barrio: ($("Barrio")?.value || "...").trim() || "...",
      };

      if (saveBtn) saveBtn.disabled = true;
      if (status) status.textContent = "Guardando…";
      showLoader("Guardando perfil…");

      try {
        const r = await saveProfile(payload);
        if (!r.ok) {
          toast(r.message || "No se pudo guardar.");
          if (status) status.textContent = "";
          if (saveBtn) saveBtn.disabled = false;
          return;
        }

        // Actualiza burgerUser
        try {
          const cached = JSON.parse(localStorage.getItem("burgerUser") || "null") || {};
          cached.perfil = { ...(cached.perfil || {}), ...payload };
          localStorage.setItem("burgerUser", JSON.stringify(cached));
        } catch {}

        toast("Perfil actualizado ✅");
        if (status) status.textContent = "Guardado.";
        setEditing(false);
      } finally {
        hideLoader();
        if (saveBtn) saveBtn.disabled = !isEditing;
      }
    }

    saveBtn?.addEventListener("click", doSave);

    // Por si alguien presiona Enter accidental
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      doSave();
    });
  }

  function wireOrders(meCorreoRef) {
    const goBtn = $("go-history-btn");
    goBtn?.addEventListener("click", async () => {
      showLoader("Abriendo tus pedidos…");

      try {
        // si ya tenemos correo en memoria úsalo
        let correo = meCorreoRef.value || "";

        // si no, intenta leer de burgerUser
        if (!correo) {
          try {
            const local = JSON.parse(localStorage.getItem("burgerUser") || "null");
            correo = local?.correo || "";
          } catch {}
        }

        // si no, pega a /api/auth/me
        if (!correo) {
          const me = await fetchMe();
          correo = me?.correo || "";
        }

        // Redirige a /history (history.html), pasando correo por query por compatibilidad
        const url = correo ? `/history?correo=${encodeURIComponent(correo)}` : "/history";
        window.location.href = url;
      } finally {
        hideLoader();
      }
    });
  }

  function wirePQRS(meCorreoRef) {
    const wa = $("pqrs-wa");
    const mail = $("pqrs-mail");
    const sendBtn = $("pqrs-send-btn");

    // Ajusta estos 2 destinos a tus datos reales si quieres
    const WHATSAPP_NUMBER = "573000000000"; // +57...
    const EMAIL_TO = "hola@tierraquerida.com";

    function buildUserLine() {
      const correo = meCorreoRef.value || "";
      return correo ? `Usuario: ${correo}\n` : "";
    }

    if (wa) {
      wa.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        "Hola, necesito ayuda con una PQRS.\n" + buildUserLine()
      )}`;
      wa.target = "_blank";
      wa.rel = "noopener noreferrer";
    }

    if (mail) {
      mail.href = `mailto:${EMAIL_TO}?subject=${encodeURIComponent("PQRS - Tierra Querida")}&body=${encodeURIComponent(
        buildUserLine() + "\nEscribe tu mensaje aquí..."
      )}`;
    }

    sendBtn?.addEventListener("click", () => {
      const subject = ($("pqrs-subject")?.value || "").trim() || "PQRS - Tierra Querida";
      const message = ($("pqrs-message")?.value || "").trim() || "(Sin mensaje)";

      const body = buildUserLine() + "\n" + message;

      window.location.href =
        `mailto:${EMAIL_TO}` +
        `?subject=${encodeURIComponent(subject)}` +
        `&body=${encodeURIComponent(body)}`;
    });
  }

  function wireLogout() {
    const btn = $("logout-confirm-btn");
    btn?.addEventListener("click", async () => {
      showLoader("Cerrando sesión…");
      try {
        if (window.tqSession?.signOutAll) {
          await window.tqSession.signOutAll();
        } else {
          // fallback
          try { localStorage.removeItem("burgerUser"); } catch {}
          try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && k.startsWith("sb-") && k.includes("-auth-token")) keys.push(k);
            }
            keys.forEach((k) => localStorage.removeItem(k));
          } catch {}
        }
      } finally {
        hideLoader();
        window.location.href = "/";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    // 1) Validar sesión o redirigir
    const ok = await ensureLoggedOrRedirect();
    if (!ok) return;

    // 2) Wiring UI
    wireNavigation();
    wireProfileEditSave();
    wireLogout();

    // 3) Cargar perfil y guardar correo para Pedidos/PQRS
    const meCorreoRef = { value: "" };
    const loaded = await loadProfileIntoForm();
    if (loaded?.ok) meCorreoRef.value = loaded.correo || "";

    wireOrders(meCorreoRef);
    wirePQRS(meCorreoRef);

    // 4) Vista inicial (persistida)
    const view = getSavedView();

    // Si el usuario viene buscando directo perfil (ej: ?view=profile)
    try {
      const p = new URLSearchParams(window.location.search);
      const v = p.get("view");
      if (v && ["home", "profile", "orders", "pqrs", "logout"].includes(v)) {
        showView(v);
        return;
      }
    } catch {}

    showView(view || "home");
  });
})();
