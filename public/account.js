// public/account.js
function $(id) {
  return document.getElementById(id);
}

function setStatus(text) {
  const pill = $("status-pill");
  if (!pill) return;
  pill.textContent = text || "—";
}

function showError(msg) {
  const box = $("error-box");
  if (!box) return;
  if (!msg) {
    box.classList.add("hidden");
    box.textContent = "";
    return;
  }
  box.textContent = msg;
  box.classList.remove("hidden");
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

  // celular es numeric en tu tabla
  const celular = celularRaw ? Number(String(celularRaw).replace(/\D/g, "")) : NaN;

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

function fillFormFromRow(me, row) {
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

async function loadProfile() {
  showError("");
  setStatus("Cargando...");

  const ok = await window.tqSession.requireLoginOrRedirect();
  if (!ok) return;

  const me = await window.tqSession.fetchMe();
  if (!me?.email) {
    setStatus("Sin correo");
    showError("No pude detectar tu correo de sesión. Revisa tu login.");
    return;
  }

  // pinta nombre en header (si existe)
  const nameHeader = document.getElementById("user-name-header");
  if (nameHeader) {
    const nm = me.user_metadata?.full_name || me.email;
    nameHeader.textContent = nm || "";
  }

  $("f-correo").value = me.email;

  try {
    const row = await window.tqSession.fetchFormularioByCorreo(me.email);

    if (row) {
      fillFormFromRow(me, row);
      setStatus("Datos cargados");
    } else {
      // no hay fila en formulario aún
      fillFormFromRow(me, null);
      setStatus("Completa tu info");
    }
  } catch (e) {
    console.error("[account] fetch formulario error:", e);
    setStatus("Error");
    showError(
      "No pude leer tu información. Revisa RLS/policies en Supabase para la tabla formulario."
    );
  }
}

async function onSave(e) {
  e.preventDefault();
  showError("");
  setStatus("Guardando...");

  const me = await window.tqSession.fetchMe();
  if (!me?.email) {
    setStatus("Error");
    showError("No hay sesión activa.");
    return;
  }

  const payload = normalizePayload(me.email);

  // validaciones mínimas (tu tabla tiene NOT NULL en casi todo)
  if (!payload.nombre) return showError("Escribe tu nombre.");
  if (!payload.tipodocumento) return showError("Selecciona tipo de documento.");
  if (!payload.documento) return showError("Escribe tu documento.");
  if (!payload.celular || Number.isNaN(payload.celular))
    return showError("Escribe un celular válido.");
  if (!payload.direccionentrega) return showError("Escribe tu dirección.");

  try {
    await window.tqSession.saveFormulario(payload);
    setStatus("Guardado ✅");
  } catch (e2) {
    console.error("[account] save error:", e2);
    setStatus("Error");
    showError(
      e2?.message ||
        "No pude guardar. Revisa policies/RLS y que exista el correo en usuarios."
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // botón logout
  document.getElementById("logout-btn")?.addEventListener("click", () => {
    window.tqSession.logout();
  });

  // form submit
  document.getElementById("profile-form")?.addEventListener("submit", onSave);

  // cargar perfil
  loadProfile();
});
