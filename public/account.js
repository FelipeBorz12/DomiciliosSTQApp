// public/account.js
function $(id) {
  return document.getElementById(id);
}

/* =========================
   MODAL (mensajes)
========================= */
function modalIcon(type) {
  switch (type) {
    case "success":
      return { icon: "check_circle" };
    case "error":
      return { icon: "error" };
    case "info":
    default:
      return { icon: "info" };
  }
}

function showModal({ title, message, type = "info" }) {
  const m = $("tq-modal");
  if (!m) return;

  const { icon } = modalIcon(type);
  const iconWrap = $("tq-modal-icon");
  const titleEl = $("tq-modal-title");
  const msgEl = $("tq-modal-message");

  if (iconWrap) {
    iconWrap.innerHTML = `<span class="material-symbols-outlined">${icon}</span>`;
  }
  if (titleEl) titleEl.textContent = title || "Mensaje";
  if (msgEl) msgEl.textContent = message || "";

  m.classList.remove("hidden");
  m.classList.add("flex");
  m.setAttribute("aria-hidden", "false");
}

function closeModal() {
  const m = $("tq-modal");
  if (!m) return;
  m.classList.add("hidden");
  m.classList.remove("flex");
  m.setAttribute("aria-hidden", "true");
}

function bindModal() {
  $("tq-modal-backdrop")?.addEventListener("click", closeModal);
  $("tq-modal-close")?.addEventListener("click", closeModal);
  $("tq-modal-ok")?.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

/* =========================
   Tabs / Panels
========================= */
function setActiveTab(tab) {
  const buttons = document.querySelectorAll(".tq-tab-btn");
  const panels = document.querySelectorAll(".tq-tab-panel");

  buttons.forEach((b) => {
    const active = b.dataset.tab === tab;

    b.classList.toggle("bg-white/5", active);
    b.classList.toggle("border-white/10", active);
    b.classList.toggle("hover:bg-white/10", active);

    b.classList.toggle("bg-transparent", !active);
    b.classList.toggle("border-transparent", !active);
    b.classList.toggle("text-white/80", !active);
  });

  panels.forEach((p) => p.classList.add("hidden"));
  $(`tab-${tab}`)?.classList.remove("hidden");
}

function bindTabs() {
  document.querySelectorAll(".tq-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  $("go-direcciones")?.addEventListener("click", () =>
    setActiveTab("direcciones")
  );
}

/* =========================
   Helpers
========================= */
function setStatus(text) {
  const pill = $("status-pill");
  if (!pill) return;
  pill.textContent = text || "—";
}

function normalizePayload(correo) {
  const nombre = ($("f-nombre")?.value || "").trim();
  const tipodocumento = ($("f-tipodocumento")?.value || "").trim();
  const documento = ($("f-documento")?.value || "").trim();
  const celularRaw = ($("f-celular")?.value || "").trim();

  const direccionentrega = ($("f-direccion")?.value || "").trim();
  const Departamento = ($("f-departamento")?.value || "...").trim() || "...";
  const Municipio = ($("f-municipio")?.value || "...").trim() || "...";
  const Barrio = ($("f-barrio")?.value || "...").trim() || "...";

  const celular = celularRaw
    ? Number(String(celularRaw).replace(/\D/g, ""))
    : NaN;

  return {
    correo,
    nombre,
    tipodocumento,
    documento,
    celular,
    direccionentrega,
    Departamento,
    Municipio,
    Barrio,
  };
}

function fillFromRow(me, row) {
  const displayName =
    row?.nombre || me?.user_metadata?.full_name || me?.email || "—";

  $("sidebar-name").textContent = displayName;
  $("sidebar-email").textContent = me?.email || "—";

  const nameHeader = $("user-name-header");
  if (nameHeader) nameHeader.textContent = displayName;

  $("f-correo").value = me?.email || "";
  $("f-nombre").value = row?.nombre || me?.user_metadata?.full_name || "";
  $("f-tipodocumento").value = row?.tipodocumento || "";
  $("f-documento").value = row?.documento || "";
  $("f-celular").value = row?.celular != null ? String(row.celular) : "";

  $("f-direccion").value = row?.direccionentrega || "";
  $("f-departamento").value = row?.Departamento || "...";
  $("f-municipio").value = row?.Municipio || "...";
  $("f-barrio").value = row?.Barrio || "...";
}

/* =========================
   Load profile + formulario
========================= */
async function loadProfile() {
  setStatus("Cargando...");

  const ok = await window.tqSession.requireLoginOrRedirect();
  if (!ok) return;

  const me = await window.tqSession.fetchMe();
  if (!me?.email) {
    setStatus("Sin correo");
    showModal({
      type: "error",
      title: "No pude cargar tu sesión",
      message: "No detecté un correo en tu sesión. Revisa tu login.",
    });
    return;
  }

  try {
    const row = await window.tqSession.fetchFormularioByCorreo(me.email);

    if (row) {
      fillFromRow(me, row);
      setStatus("Listo");
    } else {
      fillFromRow(me, null);
      setStatus("Completar");
      showModal({
        type: "info",
        title: "Completa tu información",
        message:
          "Aún no encontramos tus datos en formulario.\nCompleta tu perfil y dirección y guarda.",
      });
    }
  } catch (e) {
    console.error("[account] fetch formulario error:", e);
    setStatus("Error");
    showModal({
      type: "error",
      title: "No pude leer tus datos",
      message:
        "No pude leer tu información desde Supabase.\n\nRevisa RLS/Policies en la tabla formulario y que el usuario tenga permiso para leer su fila por correo.",
    });
  }
}

/* =========================
   Save (perfil + dirección)
========================= */
function validatePayload(payload) {
  if (!payload.nombre) return "Escribe tu nombre.";
  if (!payload.tipodocumento) return "Selecciona tipo de documento.";
  if (!payload.documento) return "Escribe tu documento.";
  if (!payload.celular || Number.isNaN(payload.celular))
    return "Escribe un celular válido.";
  if (!payload.direccionentrega) return "Escribe tu dirección de entrega.";
  return "";
}

async function saveAll() {
  setStatus("Guardando...");

  const me = await window.tqSession.fetchMe();
  if (!me?.email) {
    setStatus("Error");
    showModal({
      type: "error",
      title: "Sesión no válida",
      message: "No hay sesión activa.",
    });
    return;
  }

  const payload = normalizePayload(me.email);
  const err = validatePayload(payload);
  if (err) {
    setStatus("Revisar");
    showModal({ type: "info", title: "Faltan datos", message: err });
    return;
  }

  try {
    await window.tqSession.saveFormulario(payload);
    setStatus("Guardado ✅");
    showModal({
      type: "success",
      title: "Guardado",
      message: "Tu información fue guardada correctamente.",
    });
  } catch (e) {
    console.error("[account] save error:", e);
    setStatus("Error");
    showModal({
      type: "error",
      title: "No pude guardar",
      message:
        e?.message ||
        "No pude guardar. Revisa policies/RLS y que exista el correo en usuarios (FK).",
    });
  }
}

/* =========================
   Contacto
========================= */
function bindContact() {
  $("contact-whatsapp")?.addEventListener("click", () => {
    const phone = "573000000000"; // cambia al real
    const text = encodeURIComponent("Hola, necesito ayuda con mi pedido.");
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
  });

  $("contact-email")?.addEventListener("click", () => {
    const to = "hola@tierraquerida.com"; // cambia al real
    const subject = encodeURIComponent("Soporte - Tierra Querida");
    const body = encodeURIComponent("Hola, necesito ayuda con...");
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  });
}

/* =========================
   Init
========================= */
document.addEventListener("DOMContentLoaded", () => {
  bindModal();
  bindTabs();
  bindContact();

  setActiveTab("perfil");

  $("logout-btn")?.addEventListener("click", () => {
    showModal({
      type: "info",
      title: "Cerrar sesión",
      message: "¿Seguro que quieres cerrar sesión?",
    });

    const okBtn = $("tq-modal-ok");
    const handler = () => {
      okBtn?.removeEventListener("click", handler);
      window.tqSession.logout();
    };
    okBtn?.addEventListener("click", handler);
  });

  $("profile-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveAll();
  });

  $("save-address-btn")?.addEventListener("click", () => saveAll());

  loadProfile();
});
