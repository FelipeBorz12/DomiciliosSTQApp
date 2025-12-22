// history.js
document.addEventListener("DOMContentLoaded", () => {
  // --------------------------
  // Elementos DOM
  // --------------------------
  const backButton = document.getElementById("back-button");
  const ordersContainer = document.getElementById("orders-container");
  const filterChips = document.querySelectorAll(".filter-chip");

  const emailSearchWrapper = document.getElementById("email-search-wrapper");
  const emailSearchForm = document.getElementById("email-search-form");
  const emailInput = document.getElementById("email-input");
  const loadStatusMessage = document.getElementById("load-status-message");

  const sessionInfo = document.getElementById("session-info");
  const sessionEmailLabel = document.getElementById("session-email-label");

  const cartCountDesktop = document.getElementById("cart-count-desktop");
  const cartCountMobile = document.getElementById("cart-count-mobile");

  const countAll = document.getElementById("count-all");
  const countEnProceso = document.getElementById("count-en-proceso");
  const countListo = document.getElementById("count-listo");
  const countCamino = document.getElementById("count-camino");
  const countEntregado = document.getElementById("count-entregado");

  // --------------------------
  // Parámetros URL
  // --------------------------
  const urlParams = new URLSearchParams(window.location.search);
  const paramCorreo = urlParams.get("correo");
  const paramPedidoId = urlParams.get("pedidoId");

  // --------------------------
  // Estado
  // --------------------------
  let currentEmail = null;
  let hasSession = false;
  let allOrders = [];
  let currentFilter = "all";
  const expandedOrders = new Set(); // guarda ids expandidos

  // --------------------------
  // Helpers UI
  // --------------------------
  function goHome() {
    window.location.href = "/";
  }
  if (backButton) backButton.addEventListener("click", goHome);

  function setLoadingMessage(msg) {
    if (!loadStatusMessage) return;
    if (!msg) {
      loadStatusMessage.classList.add("hidden");
      loadStatusMessage.textContent = "";
    } else {
      loadStatusMessage.textContent = msg;
      loadStatusMessage.classList.remove("hidden");
    }
  }

  function safeText(v) {
    return (v ?? "").toString();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // --------------------------
  // Carrito count
  // --------------------------
  function updateCartCount() {
    let count = 0;
    try {
      const raw = localStorage.getItem("burgerCart");
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        count = parsed.reduce((acc, it) => acc + Number(it.quantity || 1), 0);
      }
    } catch (_) {}
    if (cartCountDesktop) cartCountDesktop.textContent = String(count);
    if (cartCountMobile) cartCountMobile.textContent = String(count);
  }
  updateCartCount();
  window.addEventListener("storage", (e) => {
    if (e.key === "burgerCart") updateCartCount();
  });

  // --------------------------
  // Sesión local (burgerUser)
  // --------------------------
  try {
    const userRaw = localStorage.getItem("burgerUser");
    if (userRaw) {
      const user = JSON.parse(userRaw);
      if (user && user.correo) {
        currentEmail = user.correo;
        hasSession = true;
      }
    }
  } catch (err) {
    console.warn("[history.js] No se pudo leer burgerUser:", err);
  }

  // Si viene ?correo, tiene prioridad
  if (paramCorreo) currentEmail = paramCorreo;

  // UI sesión / buscador
  if (currentEmail) {
    if (hasSession) {
      if (sessionInfo) sessionInfo.classList.remove("hidden");
      if (sessionEmailLabel) sessionEmailLabel.textContent = `Mostrando pedidos para: ${currentEmail}`;
      if (emailSearchWrapper) emailSearchWrapper.classList.add("hidden");
    } else {
      if (sessionInfo) sessionInfo.classList.add("hidden");
      if (emailSearchWrapper) emailSearchWrapper.classList.remove("hidden");
      if (emailInput) emailInput.value = currentEmail;
    }
    loadOrders(currentEmail);
  } else {
    if (sessionInfo) sessionInfo.classList.add("hidden");
    if (emailSearchWrapper) emailSearchWrapper.classList.remove("hidden");
    setLoadingMessage("Ingresa tu correo para consultar tus pedidos.");
  }

  // --------------------------
  // Buscar por correo
  // --------------------------
  if (emailSearchForm) {
    emailSearchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = (emailInput?.value || "").trim();
      if (!email) {
        alert("Ingresa un correo para buscar tus pedidos.");
        return;
      }
      currentEmail = email;
      loadOrders(email);
    });
  }

  // --------------------------
  // Estados / filtros
  // --------------------------
  const STATUS_ORDER = ["Recibido", "En preparación", "Listo", "En camino", "Entregado"];

  function normalizeStatus(raw) {
    if (!raw) return "Recibido";
    const val = String(raw).toLowerCase();
    if (val.includes("cancel")) return "Cancelado";
    if (val.includes("prepar")) return "En preparación";
    if (val.includes("listo")) return "Listo";
    if (val.includes("camino")) return "En camino";
    if (val.includes("entregado")) return "Entregado";
    if (val.includes("recib")) return "Recibido";
    return "Recibido";
  }

  function statusToIndex(status) {
    const norm = normalizeStatus(status);
    const idx = STATUS_ORDER.findIndex((s) => s.toLowerCase() === norm.toLowerCase());
    return idx === -1 ? 0 : idx;
  }

  function getFilterKeyFromOrder(order) {
    const norm = normalizeStatus(order.estado);
    if (norm === "Cancelado") return "cancelado"; // no hay chip, pero queda por si un día lo pones
    if (norm === "Recibido" || norm === "En preparación") return "en-proceso";
    if (norm === "Listo") return "listo";
    if (norm === "En camino") return "camino";
    if (norm === "Entregado") return "entregado";
    return "en-proceso";
  }

  function filterOrders(rawOrders) {
    if (currentFilter === "all") return rawOrders;
    return rawOrders.filter((o) => getFilterKeyFromOrder(o) === currentFilter);
  }

  function statusBadge(status) {
    const norm = normalizeStatus(status);

    if (norm === "Cancelado") {
      return {
        text: "Cancelado",
        icon: "cancel",
        classes:
          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-xs font-extrabold border border-red-500/20",
      };
    }

    switch (norm) {
      case "Recibido":
        return {
          text: "Recibido",
          icon: "markunread_mailbox",
          classes:
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-500/10 text-gray-500 text-xs font-extrabold border border-gray-500/20",
        };
      case "En preparación":
        return {
          text: "En cocina",
          icon: "skillet",
          classes:
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 text-xs font-extrabold border border-orange-500/20",
        };
      case "Listo":
        return {
          text: "Listo",
          icon: "restaurant",
          classes:
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-extrabold border border-emerald-500/20",
        };
      case "En camino":
        return {
          text: "En camino",
          icon: "two_wheeler",
          classes:
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-extrabold border border-blue-500/20",
        };
      case "Entregado":
        return {
          text: "Entregado",
          icon: "check_circle",
          classes:
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-extrabold border border-green-500/20",
        };
      default:
        return {
          text: norm,
          icon: "info",
          classes:
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-500/10 text-gray-400 text-xs font-extrabold border border-gray-500/20",
        };
    }
  }

  function setActiveChip(activeChip) {
    filterChips.forEach((chip) => {
      const isActive = chip === activeChip;
      if (isActive) {
        chip.classList.add("bg-primary", "text-white", "shadow-lg", "shadow-primary/30");
        chip.classList.remove(
          "bg-white",
          "dark:bg-surface-dark",
          "border",
          "border-gray-200",
          "dark:border-[#382929]",
          "text-gray-700",
          "dark:text-gray-200"
        );
      } else {
        chip.classList.remove("bg-primary", "text-white", "shadow-lg", "shadow-primary/30");
        chip.classList.add(
          "bg-white",
          "dark:bg-surface-dark",
          "border",
          "border-gray-200",
          "dark:border-[#382929]",
          "text-gray-700",
          "dark:text-gray-200"
        );
      }
    });
  }

  filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      currentFilter = chip.dataset.filter || "all";
      setActiveChip(chip);
      renderOrders();
    });
  });

  // --------------------------
  // Formatos
  // --------------------------
  function formatCOPFromNumber(n) {
    const num = Number(n || 0);
    return "$" + num.toLocaleString("es-CO");
  }

  function formatWhen(isoString) {
    if (!isoString) return "Fecha desconocida";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "Fecha desconocida";

    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    const isYesterday =
      d.getFullYear() === y.getFullYear() &&
      d.getMonth() === y.getMonth() &&
      d.getDate() === y.getDate();

    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");

    if (sameDay) return `Hoy, ${hh}:${mm}`;
    if (isYesterday) return `Ayer, ${hh}:${mm}`;

    const date = d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
    return `${date}, ${hh}:${mm}`;
  }

  // Trata de sacar "Total con envío" del resumen_pedido (tu formato de confirm.js)
  function extractTotalFromResumen(resumen) {
    const text = safeText(resumen);
    // ejemplos típicos:
    // "🛵 *Total con envío:* $45.000"
    // "Total con envío: $45.000"
    const m =
      text.match(/Total\s*con\s*env[ií]o[^$]*\$\s*([\d\.\,]+)/i) ||
      text.match(/Total[^$]*\$\s*([\d\.\,]+)/i);
    if (!m) return null;

    const raw = m[1].replace(/\./g, "").replace(/,/g, ".");
    const n = Number(raw);
    if (Number.isNaN(n)) return null;
    return n;
  }

  // Saca 3-4 items del resumen (líneas con "• 2x ... - $")
  function extractItemsFromResumen(resumen, max = 4) {
    const text = safeText(resumen);
    const lines = text.split("\n").map((l) => l.trim());
    const items = [];
    for (const line of lines) {
      // "• 2x Hamburguesa - $30.000"
      const m = line.match(/^•\s*(.+?)\s*-\s*(\$\s*[\d\.\,]+)/);
      if (m) {
        items.push({ label: m[1], price: m[2].replace(/\s+/g, " ").trim() });
      }
      if (items.length >= max) break;
    }
    return items;
  }

  // --------------------------
  // Contadores por filtro
  // --------------------------
  function updateCounts() {
    const total = allOrders.length;

    const enProceso = allOrders.filter((o) => getFilterKeyFromOrder(o) === "en-proceso").length;
    const listo = allOrders.filter((o) => getFilterKeyFromOrder(o) === "listo").length;
    const camino = allOrders.filter((o) => getFilterKeyFromOrder(o) === "camino").length;
    const entregado = allOrders.filter((o) => getFilterKeyFromOrder(o) === "entregado").length;

    if (countAll) countAll.textContent = String(total);
    if (countEnProceso) countEnProceso.textContent = String(enProceso);
    if (countListo) countListo.textContent = String(listo);
    if (countCamino) countCamino.textContent = String(camino);
    if (countEntregado) countEntregado.textContent = String(entregado);
  }

  // --------------------------
  // Cargar pedidos
  // --------------------------
  async function loadOrders(email) {
    if (!email) {
      setLoadingMessage("Ingresa un correo para ver tus pedidos.");
      if (ordersContainer) ordersContainer.innerHTML = "";
      return;
    }

    setLoadingMessage("Cargando pedidos...");
    if (ordersContainer) ordersContainer.innerHTML = "";

    renderSkeleton();

    try {
      const res = await fetch(`/api/pedidos?correo=${encodeURIComponent(email)}`);
      if (!res.ok) {
        if (ordersContainer) ordersContainer.innerHTML = "";
        if (res.status === 404) setLoadingMessage("No se encontraron pedidos para este correo.");
        else setLoadingMessage("Error al obtener los pedidos. Intenta de nuevo.");
        allOrders = [];
        updateCounts();
        renderOrders();
        return;
      }

      const data = await res.json();
      allOrders = Array.isArray(data) ? data : [];

      // pedidoId en URL: focus
      if (paramPedidoId) {
        const idNum = Number(paramPedidoId);
        if (!Number.isNaN(idNum)) {
          const only = allOrders.filter((o) => Number(o.id) === idNum);
          if (only.length) {
            allOrders = only;
            setLoadingMessage(`Mostrando el pedido #${idNum}.`);
          } else {
            setLoadingMessage(
              `No se encontró el pedido #${idNum} para este correo. Mostrando ${allOrders.length} pedido(s).`
            );
          }
        }
      } else {
        setLoadingMessage(`Mostrando ${allOrders.length} pedido(s).`);
      }

      updateCounts();
      renderOrders();
    } catch (err) {
      console.error("[history.js] Error cargando pedidos:", err);
      if (ordersContainer) ordersContainer.innerHTML = "";
      setLoadingMessage("Error inesperado al cargar los pedidos.");
      allOrders = [];
      updateCounts();
      renderOrders();
    }
  }

  function renderSkeleton() {
    if (!ordersContainer) return;
    ordersContainer.innerHTML = `
      <div class="grid grid-cols-1 gap-4 animate-pulse">
        ${Array.from({ length: 3 })
          .map(
            () => `
          <div class="rounded-3xl p-6 bg-white/60 dark:bg-surface-dark/60 border border-gray-200/40 dark:border-[#382929]/60">
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="size-12 rounded-2xl bg-gray-200 dark:bg-[#3a2a2a]"></div>
                <div class="space-y-2">
                  <div class="h-4 w-40 bg-gray-200 dark:bg-[#3a2a2a] rounded"></div>
                  <div class="h-3 w-56 bg-gray-200 dark:bg-[#3a2a2a] rounded"></div>
                </div>
              </div>
              <div class="h-6 w-24 bg-gray-200 dark:bg-[#3a2a2a] rounded-full"></div>
            </div>
            <div class="mt-4 h-20 bg-gray-200 dark:bg-[#3a2a2a] rounded-2xl"></div>
            <div class="mt-4 h-3 bg-gray-200 dark:bg-[#3a2a2a] rounded-full"></div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  // --------------------------
  // Render
  // --------------------------
  function renderOrders() {
    if (!ordersContainer) return;

    const visible = filterOrders(allOrders);

    if (!visible.length) {
      ordersContainer.innerHTML = `
        <div class="bg-white dark:bg-surface-dark border border-gray-100 dark:border-[#382929] rounded-3xl p-8 text-center animate-fade-in">
          <div class="mx-auto size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <span class="material-symbols-outlined text-3xl">receipt_long</span>
          </div>
          <h3 class="mt-4 text-lg font-extrabold">Sin resultados</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            No hay pedidos que coincidan con el filtro seleccionado.
          </p>
        </div>
      `;
      return;
    }

    ordersContainer.innerHTML = "";
    visible.forEach((order, idx) => {
      const card = buildOrderCard(order, idx);
      ordersContainer.appendChild(card);
    });

    // listeners (detalles / copiar)
    visible.forEach((order) => {
      const id = Number(order.id);
      const detailsBtn = document.getElementById(`toggle-${id}`);
      const copyBtn = document.getElementById(`copy-${id}`);

      if (detailsBtn) {
        detailsBtn.addEventListener("click", () => {
          if (expandedOrders.has(id)) expandedOrders.delete(id);
          else expandedOrders.add(id);
          renderOrders();
        });
      }

      if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
          const resumen = safeText(order.resumen_pedido).trim();
          if (!resumen) {
            alert("Este pedido no tiene detalle para copiar.");
            return;
          }
          try {
            await navigator.clipboard.writeText(resumen);
            toast("Copiado ✅");
          } catch (_) {
            // fallback
            const ta = document.createElement("textarea");
            ta.value = resumen;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            toast("Copiado ✅");
          }
        });
      }
    });
  }

  function buildOrderCard(order, idx) {
    const id = Number(order.id || 0);
    const norm = normalizeStatus(order.estado);
    const badge = statusBadge(order.estado);
    const statusIndex = statusToIndex(order.estado);

    const createdAt = order.created_at || order.inserted_at || null;
    const when = formatWhen(createdAt);

    const resumen = safeText(order.resumen_pedido).trim();
    const expanded = expandedOrders.has(id);

    const items = extractItemsFromResumen(resumen, 4);
    const totalNumber = extractTotalFromResumen(resumen);
    const totalText = totalNumber ? formatCOPFromNumber(totalNumber) : null;

    const metodoPago = safeText(order.metodo_pago).trim();
    const pv = safeText(order.puntoventa).trim();

    const progressPercent = norm === "Cancelado" ? 0 : ((statusIndex + 1) / STATUS_ORDER.length) * 100;

    const icon =
      norm === "En preparación"
        ? "skillet"
        : norm === "Listo"
        ? "restaurant"
        : norm === "En camino"
        ? "two_wheeler"
        : norm === "Entregado"
        ? "check_circle"
        : norm === "Cancelado"
        ? "cancel"
        : "receipt_long";

    const headerLine = pv ? pv : safeText(order.direccion_cliente).trim() || safeText(order.nombre_cliente);

    const article = document.createElement("article");
    article.className =
      "relative w-full bg-white dark:bg-surface-dark rounded-3xl p-6 md:p-8 border border-gray-100 dark:border-[#382929] shadow-sm hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-300 animate-slide-up";
    article.style.animationDelay = `${Math.min(idx * 0.04, 0.25)}s`;

    // mini resumen (si no hay items)
    const miniResumen =
      items.length > 0
        ? items
            .map(
              (it) => `
            <div class="flex justify-between text-sm text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800 pb-2 border-dashed">
              <span class="truncate pr-3">${escapeHtml(it.label)}</span>
              <span class="font-semibold whitespace-nowrap">${escapeHtml(it.price)}</span>
            </div>
          `
            )
            .join("")
        : `
          <p class="text-sm text-gray-500 dark:text-gray-400">
            ${escapeHtml(resumen ? resumen.slice(0, 140) + (resumen.length > 140 ? "..." : "") : "Sin detalle")}
          </p>
        `;

    const metaChips = `
      <div class="flex flex-wrap gap-2 mt-3">
        ${
          metodoPago
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/70 dark:bg-background-dark border border-gray-200 dark:border-gray-700 text-[11px] font-extrabold text-gray-700 dark:text-gray-200">
                <span class="material-symbols-outlined text-[14px]">payments</span>
                ${escapeHtml(metodoPago)}
              </span>`
            : ""
        }
        ${
          pv
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/70 dark:bg-background-dark border border-gray-200 dark:border-gray-700 text-[11px] font-extrabold text-gray-700 dark:text-gray-200">
                <span class="material-symbols-outlined text-[14px]">storefront</span>
                ${escapeHtml(pv)}
              </span>`
            : ""
        }
        ${
          createdAt
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/70 dark:bg-background-dark border border-gray-200 dark:border-gray-700 text-[11px] font-extrabold text-gray-700 dark:text-gray-200">
                <span class="material-symbols-outlined text-[14px]">schedule</span>
                ${escapeHtml(when)}
              </span>`
            : ""
        }
      </div>
    `;

    article.innerHTML = `
      <div class="absolute top-0 right-0 p-6">
        <span class="${badge.classes}">
          <span class="material-symbols-outlined text-[14px]">${badge.icon}</span>
          ${badge.text}
        </span>
      </div>

      <div class="flex flex-col md:flex-row gap-8 items-start">
        <!-- Left: icon + meta -->
        <div class="flex md:flex-col items-center gap-4 md:gap-2">
          <div class="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-3xl">
            <span class="material-symbols-outlined">${icon}</span>
          </div>
          <div class="text-center md:text-left">
            <p class="text-xs font-extrabold text-gray-400 uppercase tracking-wider">Pedido #${escapeHtml(
              safeText(order.id || "--")
            )}</p>
            <p class="text-sm font-extrabold text-gray-900 dark:text-white">${escapeHtml(when)}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">${escapeHtml(headerLine || "")}</p>
          </div>
        </div>

        <!-- Middle: summary + progress -->
        <div class="flex-1 w-full">
          <h3 class="text-lg font-extrabold mb-2">
            ${norm === "Entregado" ? "Pedido completado" : norm === "Cancelado" ? "Pedido cancelado" : "Pedido en curso"}
          </h3>

          <div class="flex flex-col gap-2 mb-4">
            ${miniResumen}
          </div>

          ${
            norm !== "Cancelado"
              ? `
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2 overflow-hidden">
                <div
                  class="bg-primary h-2 rounded-full"
                  style="width: ${progressPercent}%; background-image: linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent); background-size: 1rem 1rem;"
                ></div>
              </div>
              <p class="text-xs text-gray-500 mb-2">
                Estado actual: <strong class="text-gray-900 dark:text-white">${escapeHtml(badge.text)}</strong>
              </p>
              `
              : `
              <div class="w-full bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl p-3 text-xs font-semibold">
                Este pedido fue cancelado.
              </div>
              `
          }

          ${metaChips}

          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-5">
            <button
              id="toggle-${id}"
              class="flex-1 sm:flex-none bg-primary hover:bg-red-700 text-white px-6 py-2.5 rounded-xl text-sm font-extrabold transition-colors flex items-center justify-center gap-2"
            >
              ${expanded ? "Ocultar detalles" : "Ver detalles"}
              <span class="material-symbols-outlined text-base">${expanded ? "expand_less" : "arrow_forward"}</span>
            </button>

            <button
              id="copy-${id}"
              class="flex-1 sm:flex-none px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-surface-dark-hover transition-colors text-gray-700 dark:text-gray-200 text-sm font-extrabold flex items-center justify-center gap-2"
              ${resumen ? "" : "disabled"}
              title="Copiar el mensaje completo"
            >
              <span class="material-symbols-outlined text-base">content_copy</span>
              Copiar
            </button>
          </div>

          ${
            expanded
              ? `
              <div class="mt-4 rounded-2xl bg-background-light dark:bg-background-dark border border-gray-200 dark:border-gray-800 p-4">
                <p class="text-xs font-extrabold uppercase text-gray-500 mb-2">Detalle completo</p>
                <pre class="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200 font-mono leading-relaxed">${escapeHtml(
                  resumen || "Sin detalle"
                )}</pre>
              </div>
              `
              : ""
          }
        </div>

        <!-- Right: total -->
        <div class="w-full md:w-auto flex md:flex-col justify-between md:items-end gap-1 md:text-right border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-800 pt-4 md:pt-0 md:pl-8">
          <span class="text-xs font-extrabold text-gray-400 uppercase">Total</span>
          <span class="text-2xl font-extrabold text-primary">${totalText ? escapeHtml(totalText) : "—"}</span>
          <span class="text-xs text-gray-500 dark:text-gray-400">${totalText ? "Estimado del mensaje" : "No disponible"}</span>
        </div>
      </div>
    `;

    return article;
  }

  // mini toast
  function toast(message) {
    const el = document.createElement("div");
    el.className =
      "fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-surface-dark text-white px-4 py-2 rounded-full text-sm font-extrabold shadow-lg animate-fade-in";
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 200ms ease";
      setTimeout(() => el.remove(), 220);
    }, 900);
  }

  // refresco “suave” para tiempos
  setInterval(() => {
    if (allOrders && allOrders.length > 0) renderOrders();
  }, 60000);
});
