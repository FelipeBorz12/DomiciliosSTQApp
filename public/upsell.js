// /public/upsell.js
(function () {
  const ZONA_PRECIO = "PrecioOriente";
  const PLACEHOLDER_IMG = "/img/placeholder-product.webp";

  const TIPO_ADICIONES = 2;
  const TIPO_HAMBURGUESAS = 1;
  const TIPO_COMBOS = 3;
  const TIPO_PAPAS = 4;
  const TIPO_BEBIDAS = 6;

  // =========================
  // NOTIFICACIONES (RESPONSIVE)
  //  - Mobile: bottom
  //  - Desktop: top-right
  // =========================
  function ensureToastContainer() {
    let el = document.getElementById("tq-toast-container");
    if (el) return el;

    el = document.createElement("div");
    el.id = "tq-toast-container";
    el.className =
      [
        "fixed z-[10050] pointer-events-none",
        "w-[92vw] left-1/2 -translate-x-1/2 bottom-4",
        "sm:w-auto sm:left-auto sm:translate-x-0 sm:bottom-auto sm:top-6 sm:right-6",
        "flex flex-col gap-3",
      ].join(" ");

    el.setAttribute("aria-live", "polite");
    el.setAttribute("role", "status");
    document.body.appendChild(el);
    return el;
  }

  function TQNotify(opts) {
    const o = opts || {};
    const type = o.type || "info"; // success | error | info | warning
    const title = (o.title || "").trim();
    const message = (o.message || "").trim();
    const duration = Number.isFinite(o.duration) ? o.duration : 2400;

    const container = ensureToastContainer();

    const icon =
      type === "success"
        ? "check_circle"
        : type === "error"
        ? "error"
        : type === "warning"
        ? "warning"
        : "info";

    const leftBorder =
      type === "success"
        ? "border-l-4 border-emerald-400/80"
        : type === "error"
        ? "border-l-4 border-red-400/80"
        : type === "warning"
        ? "border-l-4 border-amber-300/80"
        : "border-l-4 border-white/30";

    const toast = document.createElement("div");
    toast.className =
      [
        "pointer-events-auto",
        "w-full sm:w-[380px] max-w-[92vw]",
        "rounded-2xl border border-white/10",
        leftBorder,
        "bg-[#120a0a]/95 backdrop-blur-md shadow-2xl",
        "px-4 py-3",
        "opacity-0 translate-y-2 sm:translate-y-0 sm:translate-x-2",
        "transition-all duration-200",
      ].join(" ");

    toast.innerHTML = `
      <div class="flex items-start gap-3">
        <span class="material-symbols-outlined text-white/85 mt-0.5">${icon}</span>

        <div class="min-w-0 flex-1">
          ${
            title
              ? `<p class="text-sm font-extrabold text-white leading-tight">${title}</p>`
              : ""
          }
          ${
            message
              ? `<p class="text-xs sm:text-sm font-semibold text-white/65 mt-0.5 leading-relaxed">${message}</p>`
              : ""
          }
        </div>

        <button
          type="button"
          class="shrink-0 inline-flex items-center justify-center size-9 rounded-full hover:bg-white/10 transition-colors text-white/70"
          aria-label="Cerrar"
        >
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
    `;

    const closeBtn = toast.querySelector("button");
    const removeToast = () => {
      toast.classList.add("opacity-0");
      toast.classList.add("translate-y-2");
      toast.classList.add("sm:translate-x-2");
      setTimeout(() => toast.remove(), 220);
    };

    closeBtn?.addEventListener("click", removeToast);

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove("opacity-0", "translate-y-2", "sm:translate-x-2");
    });

    if (duration > 0) setTimeout(removeToast, duration);
  }

  // Exponer global (para product.js también)
  window.TQNotify = window.TQNotify || TQNotify;

  // =========================
  // Modal DOM
  // =========================
  const modal = document.getElementById("upsell-modal");
  const backdrop = document.getElementById("upsell-backdrop");
  const closeBtn = document.getElementById("upsell-close");

  const goCartBtn = document.getElementById("upsell-go-cart");
  const goCartBtnMobile = document.getElementById("upsell-go-cart-mobile");

  const titleEl = document.getElementById("upsell-title");
  const subtitleEl = document.getElementById("upsell-subtitle");
  const stepPillEl = document.getElementById("upsell-step-pill");

  const summaryProductEl = document.getElementById("upsell-summary-product");
  const summaryExtrasEl = document.getElementById("upsell-summary-extras");
  const summaryModsEl = document.getElementById("upsell-summary-mods");

  const grid = document.getElementById("upsell-grid");

  const skipBtn = document.getElementById("upsell-skip");
  const continueBtn = document.getElementById("upsell-continue");

  const loading = document.getElementById("upsell-loading");

  const state = {
    steps: [],
    stepIndex: 0,
    cartIndex: null,
    seedTipo: null,
    cached: new Map(), // tipo -> items
    selectedAdditions: new Set(), // ids seleccionadas
    menuItemCache: new Map(), // id -> item
  };

  // =========================
  // Utils
  // =========================
  function formatPrice(value) {
    const n = Number(value || 0);
    return `$${n.toLocaleString("es-CO")}`;
  }

  function readCart() {
    try {
      const raw = localStorage.getItem("burgerCart");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeCart(cart) {
    localStorage.setItem("burgerCart", JSON.stringify(cart));
    // Notificar a listeners (product.js ya escucha storage también)
    window.dispatchEvent(new StorageEvent("storage", { key: "burgerCart" }));
  }

  async function fetchByTipo(tipo) {
    if (state.cached.has(tipo)) return state.cached.get(tipo);

    const res = await fetch(`/api/menu?tipo=${tipo}`);
    if (!res.ok) return [];

    const data = await res.json();
    const items = Array.isArray(data) ? data : [];
    state.cached.set(tipo, items);
    return items;
  }

  function showLoading(flag) {
    if (!loading) return;
    if (flag) {
      loading.classList.remove("hidden");
      loading.classList.add("flex");
    } else {
      loading.classList.add("hidden");
      loading.classList.remove("flex");
    }
  }

  function openModal() {
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    if (!modal) return;
    showLoading(false);
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
  }

  function goToCart() {
    closeModal();
    window.location.href = "/cart";
  }

  backdrop?.addEventListener("click", closeModal);
  closeBtn?.addEventListener("click", closeModal);
  goCartBtn?.addEventListener("click", goToCart);
  goCartBtnMobile?.addEventListener("click", goToCart);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && !modal.classList.contains("hidden")) closeModal();
  });

  function labelTipo(tipo) {
    switch (Number(tipo)) {
      case TIPO_ADICIONES:
        return "Adiciones";
      case TIPO_PAPAS:
        return "Papas";
      case TIPO_BEBIDAS:
        return "Bebidas";
      case TIPO_HAMBURGUESAS:
        return "Hamburguesas";
      default:
        return "Sugerencias";
    }
  }

  function headerForStep(tipo) {
    if (tipo === TIPO_ADICIONES) {
      return { title: "Elige tus adiciones", sub: "Se aplicarán al producto que acabas de agregar." };
    }
    if (tipo === TIPO_PAPAS) {
      return { title: "¿Le metemos papitas?", sub: "Una buena elección con tu pedido 🍟" };
    }
    if (tipo === TIPO_BEBIDAS) {
      return { title: "¿Algo para tomar?", sub: "Completa tu pedido con una bebida 🥤" };
    }
    if (tipo === TIPO_HAMBURGUESAS) {
      return { title: "Agrega otra hamburguesa", sub: "Una extra para compartir o probar otra." };
    }
    return { title: "Sugerencias", sub: "Completa tu pedido" };
  }

  function setHeader(tipo, idx, total) {
    const h = headerForStep(tipo);
    if (stepPillEl) stepPillEl.textContent = `Paso ${idx + 1}/${total}`;
    if (titleEl) titleEl.textContent = h.title;
    if (subtitleEl) subtitleEl.textContent = h.sub;

    // Botón siempre visible
    if (continueBtn) {
      const isLast = idx >= total - 1;
      const label = isLast ? "Finalizar" : "Siguiente";
      continueBtn.innerHTML = `
        <span class="material-symbols-outlined text-[18px]">${isLast ? "check" : "arrow_forward"}</span>
        ${label}
      `;
      continueBtn.disabled = false;
    }
  }

  function clearGrid() {
    if (!grid) return;
    grid.innerHTML = "";
  }

  function chip(text) {
    const span = document.createElement("span");
    span.className =
      "px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs font-extrabold";
    span.textContent = text;
    return span;
  }

  async function renderSummary() {
    if (!summaryProductEl || !summaryExtrasEl || !summaryModsEl) return;

    const cart = readCart();
    const idx = Number(state.cartIndex);

    summaryExtrasEl.innerHTML = "";
    summaryModsEl.innerHTML = "";

    if (!Number.isFinite(idx) || idx < 0 || idx >= cart.length) {
      summaryProductEl.textContent = "Tu producto: —";
      summaryExtrasEl.appendChild(chip("—"));
      summaryModsEl.appendChild(chip("—"));
      return;
    }

    const item = cart[idx];
    const name = item?.nombre || "Producto";
    summaryProductEl.textContent = `Tu producto: ${name}`;

    const extras = Array.isArray(item?.extras) ? item.extras : [];
    if (!extras.length) summaryExtrasEl.appendChild(chip("—"));
    else extras.slice(0, 12).forEach((ex) => summaryExtrasEl.appendChild(chip(ex?.nombre || "Adición")));

    const mods = Array.isArray(item?.modifications) ? item.modifications : [];
    if (!mods.length) summaryModsEl.appendChild(chip("—"));
    else mods.slice(0, 12).forEach((m) => summaryModsEl.appendChild(chip(String(m))));

    // Precargar selección de adiciones
    state.selectedAdditions.clear();
    extras.forEach((ex) => {
      const id = Number(ex?.id);
      if (id) state.selectedAdditions.add(id);
    });
  }

  function isLastStep() {
    return state.stepIndex >= state.steps.length - 1;
  }

  // ✅ FIN: ahora termina en carrito
  function nextStepOrGoCart() {
    if (isLastStep()) {
      // pequeño delay para que se sienta “fluido”
      setTimeout(() => goToCart(), 250);
      return;
    }
    state.stepIndex += 1;
    renderStep();
  }

  // =========================
  // Cards (misma UI para todo)
  // =========================
  function buildCard(item, { tipo }) {
    const img = item?.imagen || PLACEHOLDER_IMG;
    const price = Number(item?.[ZONA_PRECIO] || 0);
    const name = item?.Nombre || "Producto";
    const desc = item?.Descripcion || "";

    const isAdditions = tipo === TIPO_ADICIONES;
    const selected = isAdditions ? state.selectedAdditions.has(Number(item?.id)) : false;

    const card = document.createElement("div");
    card.className =
      "rounded-2xl overflow-hidden border border-white/10 bg-white/5 hover:bg-white/7 transition-colors";

    card.innerHTML = `
      <div class="relative aspect-[4/3] overflow-hidden">
        <img
          src="${img}"
          alt="${name}"
          class="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          onerror="this.src='${PLACEHOLDER_IMG}'"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent"></div>

        <div class="absolute top-3 left-3 flex items-center gap-2">
          <span class="px-3 py-1 rounded-full bg-black/45 border border-white/10 text-white text-xs font-extrabold">
            ${labelTipo(tipo)}
          </span>
          ${
            isAdditions && selected
              ? `
            <span class="px-3 py-1 rounded-full bg-primary/25 border border-primary/40 text-white text-xs font-extrabold">
              Seleccionado
            </span>
          `
              : ""
          }
        </div>

        <div class="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
          <div class="min-w-0">
            <h4 class="text-white font-extrabold text-base sm:text-lg leading-tight line-clamp-2">
              ${name}
            </h4>
          </div>
          <span class="shrink-0 px-3 py-1 rounded-full bg-black/45 border border-white/10 text-white text-xs font-extrabold">
            ${formatPrice(price)}
          </span>
        </div>
      </div>

      <div class="p-4 sm:p-5">
        <p class="text-white/55 text-sm line-clamp-2 min-h-[2.5rem]">
          ${desc || "&nbsp;"}
        </p>

        <div class="mt-4 flex items-center justify-between gap-3">
          ${
            isAdditions
              ? `
                <button
                  type="button"
                  class="upsell-toggle flex-1 px-4 py-3 rounded-full ${
                    selected ? "bg-primary hover:bg-red-700" : "bg-white/5 hover:bg-white/10"
                  } border border-white/10 text-white font-extrabold text-sm transition-colors"
                >
                  ${selected ? "Quitar" : "Agregar"}
                </button>
                <button
                  type="button"
                  class="upsell-view px-4 py-3 rounded-full border border-white/15 text-white/85 hover:bg-white/10 font-extrabold text-sm transition-colors"
                >
                  Ver
                </button>
              `
              : `
                <button
                  type="button"
                  class="upsell-add flex-1 px-4 py-3 rounded-full bg-primary hover:bg-red-700 text-white font-extrabold text-sm transition-colors"
                >
                  Agregar
                </button>
                <button
                  type="button"
                  class="upsell-view px-4 py-3 rounded-full border border-white/15 text-white/85 hover:bg-white/10 font-extrabold text-sm transition-colors"
                >
                  Ver
                </button>
              `
          }
        </div>
      </div>
    `;

    // Ver producto
    card.querySelector(".upsell-view")?.addEventListener("click", () => {
      closeModal();
      window.location.href = `/product?id=${item.id}`;
    });

    if (isAdditions) {
      card.querySelector(".upsell-toggle")?.addEventListener("click", () => {
        const id = Number(item?.id);
        if (!id) return;

        if (state.selectedAdditions.has(id)) state.selectedAdditions.delete(id);
        else state.selectedAdditions.add(id);

        renderStep(); // refrescar para ver “Seleccionado”
      });
    } else {
      card.querySelector(".upsell-add")?.addEventListener("click", () => {
        addProductToCart(item, tipo);
      });
    }

    return card;
  }

  function addProductToCart(menuItem, tipo) {
    const cart = readCart();

    const basePrice = Number(menuItem?.[ZONA_PRECIO] || 0);
    const lineItem = {
      menu_id: menuItem.id,
      productId: menuItem.id,
      nombre: menuItem.Nombre,
      tipo: menuItem.tipo,
      basePrice,
      extras: [],
      modifications: [],
      cooking: null,
      quantity: 1,
      total: basePrice,
    };

    cart.push(lineItem);
    writeCart(cart);

    // Si agregan hamburguesa dentro del flujo, esa se vuelve el target de adiciones
    if (Number(tipo) === TIPO_HAMBURGUESAS) {
      state.cartIndex = cart.length - 1;
      renderSummary();
    }

    window.TQNotify?.({
      type: "success",
      title: "Agregado",
      message: menuItem?.Nombre || "Producto",
      duration: 2200,
    });

    // Auto-avanza a siguiente paso, o finaliza en carrito
    if (isLastStep()) {
      setTimeout(() => goToCart(), 450);
    } else {
      setTimeout(() => {
        state.stepIndex += 1;
        renderStep();
      }, 350);
    }
  }

  function applyAdditionsToCartItem() {
    const cart = readCart();
    const idx = Number(state.cartIndex);

    if (!Number.isFinite(idx) || idx < 0 || idx >= cart.length) return;

    const item = cart[idx];
    item.extras = Array.isArray(item.extras) ? item.extras : [];

    const cachedAdditions = state.cached.get(TIPO_ADICIONES) || [];
    const additionsById = new Map(cachedAdditions.map((x) => [Number(x.id), x]));

    // Merge por id
    const merged = new Map();

    item.extras.forEach((ex) => {
      const id = Number(ex?.id);
      if (id) merged.set(id, ex);
    });

    state.selectedAdditions.forEach((id) => {
      const full = additionsById.get(Number(id));
      const price = Number(full?.[ZONA_PRECIO] || 0);
      const nombre = full?.Nombre || "Adición";
      merged.set(Number(id), { id: Number(id), nombre, precio: price });
    });

    item.extras = Array.from(merged.values());

    // recalcular total del item principal
    const basePrice = Number(item.basePrice || 0);
    const qty = Math.max(1, Number(item.quantity || 1));
    const extrasSum = item.extras.reduce((acc, ex) => acc + Number(ex?.precio || 0), 0);
    const unit = basePrice + extrasSum;
    item.total = unit * qty;

    writeCart(cart);

    window.TQNotify?.({
      type: "success",
      title: "Listo",
      message: "Adiciones aplicadas al producto",
      duration: 2200,
    });

    renderSummary();
  }

  // =========================
  // Steps
  // =========================
  function buildSteps(seedTipo) {
    const t = Number(seedTipo);

    // hamburguesa o combo -> flujo completo
    if (t === TIPO_HAMBURGUESAS || t === TIPO_COMBOS) return [TIPO_ADICIONES, TIPO_PAPAS, TIPO_BEBIDAS];

    // otros
    if (t === TIPO_PAPAS) return [TIPO_HAMBURGUESAS, TIPO_ADICIONES, TIPO_BEBIDAS];
    if (t === TIPO_BEBIDAS) return [TIPO_HAMBURGUESAS, TIPO_ADICIONES, TIPO_PAPAS];

    return [TIPO_ADICIONES, TIPO_PAPAS, TIPO_BEBIDAS];
  }

  async function renderStep() {
    if (!modal || !grid) return;

    const tipo = Number(state.steps[state.stepIndex]);
    const total = state.steps.length;

    setHeader(tipo, state.stepIndex, total);

    clearGrid();
    showLoading(true);

    try {
      grid.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-auto pr-1";
      grid.style.maxHeight = "calc(92vh - 320px)";

      const items = await fetchByTipo(tipo);

      if (!items.length) {
        grid.innerHTML = `
          <div class="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p class="text-sm text-white font-extrabold">No hay ${labelTipo(tipo).toLowerCase()} disponibles.</p>
            <p class="text-xs text-white/60 font-semibold mt-1">Puedes tocar “Omitir” o “Siguiente”.</p>
          </div>
        `;
        return;
      }

      items.forEach((it) => grid.appendChild(buildCard(it, { tipo })));
    } catch (e) {
      console.error("[upsell.js] renderStep error:", e);

      grid.innerHTML = `
        <div class="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p class="text-sm text-white font-extrabold">No se pudo cargar esta sección.</p>
          <p class="text-xs text-white/60 font-semibold mt-1">Intenta “Siguiente” o cierra y vuelve a intentar.</p>
        </div>
      `;

      window.TQNotify?.({
        type: "error",
        title: "Error",
        message: "No se pudo cargar el menú de sugerencias",
        duration: 2600,
      });
    } finally {
      showLoading(false);
    }
  }

  // =========================
  // Footer buttons
  // =========================
  skipBtn?.addEventListener("click", () => {
    // Omitir => avanzar o terminar en carrito
    nextStepOrGoCart();
  });

  continueBtn?.addEventListener("click", () => {
    const tipo = Number(state.steps[state.stepIndex]);

    // Si estamos en adiciones, aplicarlas antes de avanzar/terminar
    if (tipo === TIPO_ADICIONES) {
      applyAdditionsToCartItem();
    }

    nextStepOrGoCart();
  });

  // =========================
  // Public API
  // =========================
  window.UpsellFlow = {
    start: async function ({ cartIndex, seedTipo }) {
      state.seedTipo = Number(seedTipo);
      state.cartIndex = typeof cartIndex === "number" ? cartIndex : null;

      state.steps = buildSteps(seedTipo);
      state.stepIndex = 0;

      openModal();
      await renderSummary();
      await renderStep();
    },
    close: closeModal,
  };
})();
