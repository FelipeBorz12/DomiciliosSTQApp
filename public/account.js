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

function sanitizePhone(v) {
  const raw = String(v || "").replace(/\D/g, "");
  return raw || "";
}

function formatMoneyCOP(value) {
  const n = Number(value || 0);
  return "$" + n.toLocaleString("es-CO");
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

  const celularNum = celularRaw ? Number(sanitizePhone(celularRaw)) : NaN;

  return {
    correo,
    nombre,
    tipodocumento,
    documento,
    celular: celularNum,
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
}

/* =========================
   Cobertura: Dept / Mun / Barrio (dropdowns)
========================= */
function setSelectOptions(selectEl, items, { placeholder = "Selecciona" } = {}) {
  if (!selectEl) return;

  selectEl.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = placeholder;
  selectEl.appendChild(opt0);

  (items || []).forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    selectEl.appendChild(opt);
  });
}

async function initCoverageDropdowns(existingRow) {
  const depSel = $("f-departamento");
  const munSel = $("f-municipio");
  const barSel = $("f-barrio");

  depSel.disabled = true;
  munSel.disabled = true;
  barSel.disabled = true;

  try {
    const deps = await window.tqSession.fetchDepartamentos();
    setSelectOptions(depSel, deps, { placeholder: "Selecciona departamento" });
    depSel.disabled = false;

    const existingDep =
      existingRow?.Departamento && existingRow.Departamento !== "..."
        ? existingRow.Departamento
        : "";
    const existingMun =
      existingRow?.Municipio && existingRow.Municipio !== "..."
        ? existingRow.Municipio
        : "";
    const existingBar =
      existingRow?.Barrio && existingRow.Barrio !== "..."
        ? existingRow.Barrio
        : "";

    if (existingDep) depSel.value = existingDep;

    async function loadMunicipiosAndMaybeBarrios({ setExisting = false } = {}) {
      const dep = depSel.value;
      if (!dep) {
        setSelectOptions(munSel, [], {
          placeholder: "Selecciona un departamento",
        });
        munSel.disabled = true;

        setSelectOptions(barSel, [], { placeholder: "Selecciona municipio" });
        barSel.disabled = true;
        return;
      }

      munSel.disabled = true;
      setSelectOptions(munSel, [], { placeholder: "Cargando municipios..." });

      const municipios = await window.tqSession.fetchMunicipiosByDepartamento(
        dep
      );
      setSelectOptions(munSel, municipios, {
        placeholder: "Selecciona municipio",
      });
      munSel.disabled = false;

      if (setExisting && existingMun) munSel.value = existingMun;

      await loadBarrios({ setExisting });
    }

    async function loadBarrios({ setExisting = false } = {}) {
      const dep = depSel.value;
      const mun = munSel.value;

      if (!dep || !mun) {
        setSelectOptions(barSel, [], { placeholder: "Selecciona municipio" });
        barSel.disabled = true;
        return;
      }

      barSel.disabled = true;
      setSelectOptions(barSel, [], { placeholder: "Cargando barrios..." });

      const barrios = await window.tqSession.fetchBarriosByDeptMun(dep, mun);
      const finalBarrios = barrios?.length ? barrios : ["..."];

      setSelectOptions(barSel, finalBarrios, { placeholder: "Selecciona barrio" });
      barSel.disabled = false;

      if (setExisting && existingBar) {
        const exists = Array.from(barSel.options).some(
          (o) => o.value === existingBar
        );
        if (!exists) {
          const opt = document.createElement("option");
          opt.value = existingBar;
          opt.textContent = existingBar;
          barSel.appendChild(opt);
        }
        barSel.value = existingBar;
      }
    }

    depSel.addEventListener("change", () => {
      munSel.value = "";
      barSel.value = "";
      loadMunicipiosAndMaybeBarrios({ setExisting: false });
    });

    munSel.addEventListener("change", () => {
      barSel.value = "";
      loadBarrios({ setExisting: false });
    });

    await loadMunicipiosAndMaybeBarrios({ setExisting: true });
  } catch (e) {
    console.error("[account] coverage dropdowns error:", e);

    depSel.innerHTML = `<option value="">No disponible</option>`;
    munSel.innerHTML = `<option value="">No disponible</option>`;
    barSel.innerHTML = `<option value="">No disponible</option>`;
    depSel.disabled = true;
    munSel.disabled = true;
    barSel.disabled = true;

    showModal({
      type: "error",
      title: "Cobertura no disponible",
      message:
        "No pude cargar Departamentos/Municipios.\nRevisa políticas (RLS) en Departamentos_list y Municipio_list.",
    });
  }
}

/* =========================
   Pedidos: últimos 5 (por correo)
========================= */
function renderOrders(orders, correo) {
  const loading = $("orders-loading");
  const empty = $("orders-empty");
  const list = $("orders-list");

  loading?.classList.add("hidden");

  if (!orders || orders.length === 0) {
    empty?.classList.remove("hidden");
    list?.classList.add("hidden");
    return;
  }

  empty?.classList.add("hidden");
  list?.classList.remove("hidden");
  list.innerHTML = "";

  orders.forEach((o) => {
    const date = o.created_at ? new Date(o.created_at) : null;
    const dateLabel = date
      ? date.toLocaleString("es-CO", {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

    const totalLabel = formatMoneyCOP(Number(o.total || 0));

    const row = document.createElement("div");
    row.className =
      "px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors";

    const href =
      "/history" +
      "?correo=" +
      encodeURIComponent(correo || "") +
      "&pedidoId=" +
      encodeURIComponent(String(o.id));

    row.innerHTML = `
      <div class="min-w-0 flex-1">
        <p class="text-sm font-extrabold text-white/90 truncate">
          Pedido #${o.id} · <span class="text-white/60 font-semibold">${dateLabel}</span>
        </p>
        <p class="text-xs text-white/60 font-semibold mt-1 truncate">
          Estado: <span class="text-white/80 font-extrabold">${o.estado || "—"}</span>
          · Total: <span class="text-white/80 font-extrabold">${totalLabel}</span>
        </p>
      </div>

      <a
        class="shrink-0 size-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 inline-flex items-center justify-center text-white/80"
        title="Ver detalle"
        href="${href}"
      >
        <span class="material-symbols-outlined text-[20px]">visibility</span>
      </a>
    `;

    list.appendChild(row);
  });
}

async function loadLastOrdersByCorreo(correo, limit = 5) {
  const loading = $("orders-loading");
  const empty = $("orders-empty");
  const list = $("orders-list");

  loading?.classList.remove("hidden");
  empty?.classList.add("hidden");
  list?.classList.add("hidden");

  const email = String(correo || "").trim().toLowerCase();
  if (!email) {
    loading?.classList.add("hidden");
    empty?.classList.remove("hidden");
    empty.textContent = "No puedo cargar pedidos: falta tu correo.";
    return;
  }

  try {
    const res = await fetch(`/api/pedidos?correo=${encodeURIComponent(email)}`);
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data?.message || "Error consultando pedidos");

    const orders = Array.isArray(data) ? data.slice(0, limit) : [];
    renderOrders(orders, email);

    // también ajusta el link “Ver historial completo” con el correo
    const fullLink = $("orders-history-link");
    if (fullLink) fullLink.href = `/history?correo=${encodeURIComponent(email)}`;
  } catch (e) {
    console.error("[account] load orders error:", e);
    loading?.classList.add("hidden");
    showModal({
      type: "error",
      title: "No pude cargar tus pedidos",
      message:
        "No pude leer pedidos desde el servidor.\nRevisa que /api/pedidos esté respondiendo y que Supabase Admin funcione.",
    });
  }
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

    fillFromRow(me, row);

    await initCoverageDropdowns(row || null);

    if (row) {
      $("f-direccion").value = row?.direccionentrega || "";
      if (row?.Departamento && row.Departamento !== "...")
        $("f-departamento").value = row.Departamento;
    }

    setStatus(row ? "Listo" : "Completar");

    // ✅ pedidos por correo (últimos 5)
    await loadLastOrdersByCorreo(me.email, 5);

    if (!row) {
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
  if (!payload.Departamento) return "Selecciona un departamento.";
  if (!payload.Municipio) return "Selecciona un municipio.";
  if (!payload.Barrio) return "Selecciona un barrio.";
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

    // refrescar pedidos (por correo)
    await loadLastOrdersByCorreo(me.email, 5);
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
