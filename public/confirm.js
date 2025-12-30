// /public/confirm.js
document.addEventListener("DOMContentLoaded", () => {
  const DELIVERY_FEE = 5000; // COP

  // ---- DOM ----
  const backButton = document.getElementById("confirm-back-button");
  const noUserWarning = document.getElementById("no-user-warning");

  const nameInput = document.getElementById("client-name");
  const emailInput = document.getElementById("client-email");
  const phoneInput = document.getElementById("client-phone");
  const addressInput = document.getElementById("client-address");
  const notesInput = document.getElementById("client-notes");

  const phoneError = document.getElementById("phone-error");
  const emailError = document.getElementById("email-error");

  const paymentMethodSelect = document.getElementById("payment-method");
  const paymentError = document.getElementById("payment-error");
  let paymentTouched = false;

  const suggestPvBtn = document.getElementById("suggest-pv-btn");
  const pvMessage = document.getElementById("pv-message");
  const pvCard = document.getElementById("pv-card");

  const pvDeptSelect = document.getElementById("pv-departamento");
  const pvMpioSelect = document.getElementById("pv-municipio");
  const pvBarrioSelect = document.getElementById("pv-barrio");

  const orderText = document.getElementById("order-text");
  const sendWhatsappBtn = document.getElementById("send-whatsapp-btn");
  const refreshMessageBtn = document.getElementById("refresh-message-btn");

  const cartCountDesktop = document.getElementById("cart-count");
  const cartCountBadge = document.getElementById("cart-count-badge");

  const antibotMsgEl = document.getElementById("antibot-msg");

  // ---- Estado ----
  let antiBotOk = false;
  let turnstileToken = "";
  let cartItems = [];
  let userData = null;

  let puntosVenta = [];
  let selectedPV = null;

  let syncingPV = false;

  // ---- Utils ----
  function debounce(fn, wait = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function formatPrice(value) {
    const n = Number(value || 0);
    return "$" + n.toLocaleString("es-CO");
  }

  function safeText(v) {
    return (v ?? "").toString().trim();
  }

  function toInt(v, def = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : def;
  }

  function setAntiBotMsg(text, isError = false) {
    if (!antibotMsgEl) return;
    antibotMsgEl.textContent = text || "";
    antibotMsgEl.classList.toggle("text-red-400", !!isError);
    antibotMsgEl.classList.toggle("text-white/60", !isError);
  }

  // ---- LocalStorage ----
  function saveUserToLocal(data) {
    try {
      if (!data) return;
      localStorage.setItem("burgerUser", JSON.stringify(data));
    } catch {}
  }

  function getLocalUserIfAny() {
    try {
      const raw = localStorage.getItem("burgerUser");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // ---- Carrito ----
  function loadCart() {
    try {
      const raw = localStorage.getItem("burgerCart");
      cartItems = raw
        ? Array.isArray(JSON.parse(raw))
          ? JSON.parse(raw)
          : []
        : [];
    } catch (err) {
      console.error("[confirm.js] Error leyendo burgerCart:", err);
      cartItems = [];
    }
  }

  function syncBadges() {
    const count = cartItems.reduce(
      (acc, it) => acc + Number(it.quantity || 1),
      0
    );
    if (cartCountDesktop) cartCountDesktop.textContent = String(count);
    if (cartCountBadge) cartCountBadge.textContent = String(count);
  }

  // ---- Validaciones ----
  function validatePhone10Digits(value) {
    if (!value) return false;
    return /^\d{10}$/.test(value.trim());
  }

  function validateEmail(value) {
    if (!value) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function computeSubtotal() {
    return cartItems.reduce((acc, item) => {
      const t = Number(item.total);
      if (Number.isFinite(t) && t > 0) return acc + t;

      const price = Number(item.precio ?? item.price ?? item.unit_price ?? 0);
      const qty = Math.max(1, Number(item.quantity || 1));
      return acc + price * qty;
    }, 0);
  }

  // ---- Hidratar inputs ----
  function hydrateUserInputs(data) {
    if (!data) return;

    const correo = data.correo || data.email || "";
    const perfil = data.perfil || data.formulario || data.profile || {};

    const nombre = perfil.nombre || data.nombre || "";
    const celular = perfil.celular || data.celular || "";
    const direccion =
      perfil.direccionentrega ||
      perfil.direccion ||
      data.direccionentrega ||
      data.direccion ||
      "";

    if (nameInput && nombre) nameInput.value = nombre;
    if (emailInput && correo) emailInput.value = correo;

    if (phoneInput && celular) {
      const digits = String(celular).replace(/\D/g, "");
      if (digits.length === 12 && digits.startsWith("57"))
        phoneInput.value = digits.slice(2);
      else if (digits.length >= 10) phoneInput.value = digits.slice(-10);
    }

    if (addressInput && direccion) addressInput.value = direccion;
  }

  async function loadUser() {
    try {
      const s = await window.tqSession?.getSession?.();
      const emailFromSession = s?.user?.email ? String(s.user.email) : "";

      if (emailFromSession) {
        noUserWarning?.classList.add("hidden");
        if (emailInput && !emailInput.value.trim())
          emailInput.value = emailFromSession;

        let form = null;
        try {
          form = await window.tqSession?.fetchFormularioByCorreo?.(
            emailFromSession
          );
        } catch (e) {
          console.warn("[confirm.js] fetchFormularioByCorreo error:", e);
        }

        const local = getLocalUserIfAny();
        const merged = {
          ...(local || {}),
          correo: emailFromSession,
          perfil: {
            ...((local && local.perfil) || {}),
            ...(form || {}),
          },
        };

        userData = merged;
        saveUserToLocal(merged);
        hydrateUserInputs(merged);
        return;
      }

      const local = getLocalUserIfAny();
      if (local?.correo) {
        userData = local;
        noUserWarning?.classList.add("hidden");
        hydrateUserInputs(local);
        return;
      }

      userData = null;
      noUserWarning?.classList.remove("hidden");
    } catch (err) {
      console.error("[confirm.js] Error cargando usuario:", err);
      userData = null;
      noUserWarning?.classList.remove("hidden");
    }
  }

  // ---- WhatsApp message ----
  function buildOrderText(pedidoId = null) {
    const name = nameInput?.value?.trim() || "No especificado";
    const email = emailInput?.value?.trim() || "No especificado";
    const phoneDigits = phoneInput?.value?.trim() || "";
    const phone = phoneDigits ? `+57${phoneDigits}` : "No especificado";
    const address = addressInput?.value?.trim() || "No especificado";
    const notes = notesInput?.value?.trim() || "";

    const paymentMethod =
      paymentMethodSelect?.value?.trim() || "No especificado";

    const subtotal = computeSubtotal();
    const total = subtotal + DELIVERY_FEE;

    const lines = [];
    cartItems.forEach((item) => {
      const qty = Math.max(1, Number(item.quantity || 1));
      const nombre =
        item.nombre ||
        item.Nombre ||
        item.name ||
        item.productName ||
        "Producto";
      const lineTotal = Number(item.total || 0);

      lines.push(`• ${qty}x ${nombre} - ${formatPrice(lineTotal || 0)}`);

      if (Array.isArray(item.extras) && item.extras.length) {
        const extrasText = item.extras
          .map((ex) => `${ex.nombre} (${formatPrice(ex.precio || 0)})`)
          .join(", ");
        lines.push(`   → Adiciones: ${extrasText}`);
      }

      if (Array.isArray(item.modifications) && item.modifications.length) {
        lines.push(`   → Personalización: ${item.modifications.join(", ")}`);
      }
    });

    const header = [];
    header.push(pedidoId ? `🧾 *PEDIDO #${pedidoId}*` : "🧾 *NUEVO PEDIDO*");
    header.push(
      "────────────────────────────",
      "👤 *Datos del cliente:*",
      `• Nombre: ${name}`,
      `• Teléfono: ${phone}`,
      `• Email: ${email}`,
      `• Dirección: ${address}`,
      `• Método de pago: ${paymentMethod}`
    );

    if (notes) header.push(`• Notas: ${notes}`);

    header.push(
      "────────────────────────────",
      "🛒 *Pedido completo:*",
      ...lines,
      "────────────────────────────",
      `💵 *Subtotal:* ${formatPrice(subtotal)}`,
      `🛵 *Domicilio:* ${formatPrice(DELIVERY_FEE)}`,
      `✅ *Total:* ${formatPrice(total)}`,
      "────────────────────────────"
    );

    if (selectedPV) {
      const pvNameText = selectedPV.Barrio || "Punto de venta";
      const pvAddrText = `${selectedPV.Direccion || ""} - ${
        selectedPV.Municipio || ""
      }`;
      header.push(`🏬 *Punto de venta:* ${pvNameText}`, `📍 ${pvAddrText}`);
      if (selectedPV.num_whatsapp)
        header.push(`📞 WhatsApp: ${selectedPV.num_whatsapp}`);
      header.push("────────────────────────────");
    }

    return header.join("\n");
  }

  function updateOrderTextLive(force = false) {
    if (!orderText) return;
    const userEdited = orderText.dataset.userEdited === "1";
    if (!force && userEdited) return;
    orderText.value = buildOrderText();
  }

  orderText?.addEventListener("input", () => {
    orderText.dataset.userEdited = "1";
  });

  // ---- PV Card ----
  function renderPVCard(pv, distanceKmText = "") {
    if (!pvCard) return;

    if (!pv) {
      pvCard.classList.add("hidden");
      pvCard.innerHTML = "";
      return;
    }

    const name = safeText(pv.Barrio) || "Punto de venta";
    const addr = `${safeText(pv.Direccion)} - ${safeText(pv.Municipio)}`;
    const wa = safeText(pv.num_whatsapp);
    const dept = safeText(pv.Departamento);
    const mpio = safeText(pv.Municipio);

    pvCard.classList.remove("hidden");
    pvCard.innerHTML = `
      <div class="rounded-2xl bg-surface-dark border border-border-dark p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-white font-extrabold text-lg leading-tight truncate">${name}</p>
            <p class="text-white/60 text-sm font-semibold truncate mt-1">${addr}</p>
            <p class="text-white/45 text-xs font-extrabold uppercase tracking-[0.2em] mt-3">
              ${dept}${dept && mpio ? " • " : ""}${mpio}
              ${distanceKmText ? ` • ${distanceKmText}` : ""}
            </p>
          </div>
          <span class="material-symbols-outlined text-primary">storefront</span>
        </div>

        <div class="mt-4 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            id="pv-use-btn"
            class="flex-1 inline-flex items-center justify-center h-10 rounded-full bg-primary hover:bg-red-700 text-white text-sm font-extrabold transition-colors gap-2"
          >
            <span class="material-symbols-outlined text-[18px]">check_circle</span>
            Usar este punto
          </button>

          ${
            wa
              ? `
            <a
              href="https://wa.me/${wa.replace(/\D/g, "")}"
              target="_blank"
              rel="noopener"
              class="flex-1 inline-flex items-center justify-center h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-extrabold transition-colors gap-2"
            >
              <span class="material-symbols-outlined text-[18px]">chat</span>
              WhatsApp
            </a>`
              : `
            <div class="flex-1 inline-flex items-center justify-center h-10 rounded-full bg-white/5 border border-white/10 text-white/50 text-sm font-extrabold">
              Sin WhatsApp
            </div>`
          }
        </div>
      </div>
    `;

    const useBtn = document.getElementById("pv-use-btn");
    useBtn?.addEventListener("click", () => {
      syncingPV = true;
      if (pvDeptSelect && pvMpioSelect && pvBarrioSelect) {
        pvDeptSelect.value = pv.Departamento || "";
        onDeptChange();
        pvMpioSelect.value = pv.Municipio || "";
        onMpioChange();
        pvBarrioSelect.value = pv.Barrio || "";
      }
      syncingPV = false;

      selectedPV = pv;

      if (orderText) orderText.dataset.userEdited = "0";
      updateOrderTextLive(true);
      validateForm();

      if (pvMessage) {
        pvMessage.textContent =
          "Punto de venta seleccionado. El mensaje de WhatsApp se actualiza automáticamente.";
      }
    });
  }

  function validateForm() {
    if (!sendWhatsappBtn) return;

    const nameOk = !!(nameInput && nameInput.value.trim());

    const emailVal = emailInput ? emailInput.value.trim() : "";
    const emailOk = validateEmail(emailVal);

    const phoneDigits = phoneInput ? phoneInput.value.trim() : "";
    const phoneOk = validatePhone10Digits(phoneDigits);

    const addressOk = !!(addressInput && addressInput.value.trim());
    const cartOk = cartItems && cartItems.length > 0;

    const pvId = Number(selectedPV?.id);
    const pvOk = !!(
      selectedPV &&
      Number.isFinite(pvId) &&
      pvId > 0 &&
      String(selectedPV.num_whatsapp || "").trim()
    );

    const paymentOk = !!(
      paymentMethodSelect && paymentMethodSelect.value.trim()
    );

    if (phoneError) {
      if (phoneDigits && !phoneOk) phoneError.classList.remove("hidden");
      else phoneError.classList.add("hidden");
    }

    if (emailError) {
      if (emailVal && !emailOk) emailError.classList.remove("hidden");
      else emailError.classList.add("hidden");
    }

    if (paymentError) {
      if (paymentTouched && !paymentOk) paymentError.classList.remove("hidden");
      else paymentError.classList.add("hidden");
    }

    const allOk =
      nameOk && emailOk && phoneOk && addressOk && cartOk && pvOk && paymentOk;

    sendWhatsappBtn.disabled = !(allOk && antiBotOk && !!turnstileToken);
  }

  // ---- Puntos de venta ----
  async function fetchPuntosVenta() {
    const res = await fetch("/api/puntos-venta");
    if (!res.ok) throw new Error("No se pudieron obtener puntos de venta");
    return await res.json();
  }

  async function ensurePuntosVentaLoaded() {
    if (Array.isArray(puntosVenta) && puntosVenta.length > 0) return;
    puntosVenta = await fetchPuntosVenta();
    buildPvSelects();
  }

  function buildPvSelects() {
    if (!pvDeptSelect || !pvMpioSelect || !pvBarrioSelect) return;
    if (!Array.isArray(puntosVenta) || puntosVenta.length === 0) return;

    const departamentos = Array.from(
      new Set(puntosVenta.map((pv) => pv.Departamento).filter(Boolean))
    ).sort((a, b) => String(a).localeCompare(String(b), "es"));

    pvDeptSelect.innerHTML = '<option value="">Departamento</option>';
    departamentos.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      pvDeptSelect.appendChild(opt);
    });

    pvMpioSelect.innerHTML = '<option value="">Municipio</option>';
    pvMpioSelect.disabled = true;

    pvBarrioSelect.innerHTML = '<option value="">Barrio</option>';
    pvBarrioSelect.disabled = true;
  }

  function onDeptChange() {
    if (!pvDeptSelect || !pvMpioSelect || !pvBarrioSelect) return;

    const dept = pvDeptSelect.value;
    pvMpioSelect.innerHTML = '<option value="">Municipio</option>';
    pvBarrioSelect.innerHTML = '<option value="">Barrio</option>';
    pvBarrioSelect.disabled = true;

    if (!syncingPV) {
      selectedPV = null;
      renderPVCard(null);
    }

    if (!dept) {
      pvMpioSelect.disabled = true;
      return;
    }

    const municipios = Array.from(
      new Set(
        puntosVenta
          .filter((pv) => pv.Departamento === dept)
          .map((pv) => pv.Municipio)
          .filter(Boolean)
      )
    ).sort((a, b) => String(a).localeCompare(String(b), "es"));

    municipios.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      pvMpioSelect.appendChild(opt);
    });

    pvMpioSelect.disabled = false;
  }

  function onMpioChange() {
    if (!pvDeptSelect || !pvMpioSelect || !pvBarrioSelect) return;

    const dept = pvDeptSelect.value;
    const mpio = pvMpioSelect.value;

    pvBarrioSelect.innerHTML = '<option value="">Barrio</option>';

    if (!syncingPV) {
      selectedPV = null;
      renderPVCard(null);
    }

    if (!dept || !mpio) {
      pvBarrioSelect.disabled = true;
      return;
    }

    const barrios = puntosVenta
      .filter((pv) => pv.Departamento === dept && pv.Municipio === mpio)
      .map((pv) => pv.Barrio)
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b), "es"));

    barrios.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b;
      opt.textContent = b;
      pvBarrioSelect.appendChild(opt);
    });

    pvBarrioSelect.disabled = false;
  }

  function onBarrioChange() {
    if (!pvDeptSelect || !pvMpioSelect || !pvBarrioSelect) return;

    const dept = pvDeptSelect.value;
    const mpio = pvMpioSelect.value;
    const barrio = pvBarrioSelect.value;

    if (!dept || !mpio || !barrio) return;

    const found = puntosVenta.find(
      (pv) =>
        pv.Departamento === dept &&
        pv.Municipio === mpio &&
        pv.Barrio === barrio
    );

    if (found) {
      selectedPV = found;
      renderPVCard(found);

      if (orderText) orderText.dataset.userEdited = "0";
      updateOrderTextLive(true);
      validateForm();

      if (pvMessage) {
        pvMessage.textContent =
          `Punto de venta seleccionado: ${found.Barrio}. ` +
          `El mensaje de WhatsApp se actualiza automáticamente.`;
      }
    }
  }

  // ✅ Turnstile callbacks
  window.onOrderTurnstile = function (token) {
    turnstileToken = String(token || "");
    antiBotOk = !!turnstileToken;

    if (antiBotOk) setAntiBotMsg("Verificación lista ✅ Ya puedes enviar tu pedido.");
    else setAntiBotMsg("Falló la verificación. Intenta de nuevo.", true);

    validateForm();
  };

  window.onOrderTurnstileExpired = function () {
    antiBotOk = false;
    turnstileToken = "";
    setAntiBotMsg("La verificación expiró. Vuélvela a completar.", true);
    validateForm();
  };

  window.onOrderTurnstileError = function () {
    antiBotOk = false;
    turnstileToken = "";
    setAntiBotMsg("Error cargando verificación anti-bot. Recarga la página.", true);
    validateForm();
  };

  function mapCartToPedidoItems() {
    return (cartItems || [])
      .map((item) => {
        const qty = Math.max(1, toInt(item.quantity ?? item.qty ?? 1, 1));
        const menuIdRaw = item.menu_id ?? item.menuId ?? item.id ?? item.productId;
        const menu_id = Number(menuIdRaw);

        if (!menu_id || Number.isNaN(menu_id)) return null;

        const extras = Array.isArray(item.extras) ? item.extras : [];
        const modifications = Array.isArray(item.modifications) ? item.modifications : [];

        return { menu_id, qty, extras, modifications };
      })
      .filter(Boolean);
  }

  async function sendOrder() {
    if (!antiBotOk || !turnstileToken) {
      alert("Completa la verificación anti-bot antes de enviar.");
      return;
    }

    const name = nameInput?.value?.trim();
    const email = emailInput?.value?.trim();
    const phoneDigits = phoneInput?.value?.trim();
    const address = addressInput?.value?.trim();
    const paymentMethod = paymentMethodSelect?.value?.trim();

    if (!paymentMethodSelect || !paymentMethod) {
      paymentTouched = true;
      validateForm();
      alert("Selecciona un método de pago.");
      return;
    }

    if (!name) return alert("Ingresa tu nombre.");
    if (!validateEmail(email || "")) return alert("Ingresa un correo válido.");
    if (!validatePhone10Digits(phoneDigits || "")) {
      return alert("Tu celular debe tener 10 dígitos (sin +57).");
    }
    if (!address) return alert("Ingresa tu dirección.");

    const pv_id = Number(selectedPV?.id);
    if (!selectedPV || !selectedPV.num_whatsapp || !Number.isFinite(pv_id) || pv_id <= 0) {
      alert("Selecciona un punto de venta válido (con WhatsApp).");
      return;
    }

    const items = mapCartToPedidoItems();
    if (!items.length) {
      alert("Tu carrito tiene productos inválidos (sin id). Vuelve al menú y agrega productos nuevamente.");
      return;
    }

    const subtotal = computeSubtotal();
    const total = subtotal + DELIVERY_FEE;

    let pedidoId = null;

    // 1) Crear pedido en BD
    try {
      const payload = {
        cf_turnstile_response: turnstileToken,
        nombre_cliente: email, // compatibilidad: tu backend usa esto como correo
        resumen_pedido: "",
        direccion_cliente: address,
        celular_cliente: `+57${phoneDigits}`,
        metodo_pago: paymentMethod,
        pv_id,
        delivery_fee: DELIVERY_FEE,
        subtotal,
        total,
        items,
      };

      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("[confirm.js] POST /api/pedidos NO OK:", res.status, data);
        alert("Se enviará el WhatsApp, pero hubo un error registrando el pedido en el sistema.");
      } else {
        if (data && typeof data.id !== "undefined") pedidoId = data.id;
        else if (Array.isArray(data) && data[0]?.id) pedidoId = data[0].id;
        else if (data.pedido && data.pedido.id) pedidoId = data.pedido.id;
      }
    } catch (err) {
      console.error("[confirm.js] Error al llamar /api/pedidos:", err);
      alert("Se enviará el WhatsApp, pero hubo un error registrando el pedido en el sistema.");
    }

    // 2) Mensaje final
    let message = orderText?.value?.trim();
    if (!message) message = buildOrderText(pedidoId ?? undefined);

    // 3) PATCH resumen
    if (pedidoId !== null && pedidoId !== undefined) {
      try {
        await fetch(`/api/pedidos/${pedidoId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resumen_pedido: message,
            metodo_pago: paymentMethod,
          }),
        });
      } catch (e) {
        console.warn("[confirm.js] PATCH resumen falló:", e);
      }
    }

    // 4) Abrir WhatsApp
    const pvPhoneDigits = String(selectedPV.num_whatsapp || "").replace(/\D/g, "");
    if (!pvPhoneDigits) {
      alert("No hay WhatsApp configurado para el punto de venta.");
      return;
    }

    const url = "https://wa.me/" + pvPhoneDigits + "?text=" + encodeURIComponent(message);
    window.open(url, "_blank");

    // 5) Limpiar carrito y redirigir a /history (sin rutas nuevas)
    localStorage.removeItem("burgerCart");
    cartItems = [];
    syncBadges();

    antiBotOk = false;
    turnstileToken = "";
    try {
      if (window.turnstile) window.turnstile.reset();
    } catch {}

    const params = new URLSearchParams();
    if (email) params.set("correo", email);
    if (pedidoId !== null && pedidoId !== undefined) params.set("pedidoId", String(pedidoId));

    const historyUrl = "/history" + (params.toString() ? "?" + params.toString() : "");
    setTimeout(() => (window.location.href = historyUrl), 800);
  }

  // ---- Live update ----
  function onAnyFormChange() {
    validateForm();
    updateOrderTextLive();
  }

  const tryHydrateByEmail = debounce(async () => {
    const emailVal = emailInput?.value?.trim() || "";
    if (!validateEmail(emailVal)) return;

    try {
      const form = await window.tqSession?.fetchFormularioByCorreo?.(emailVal);
      if (form) {
        const local = getLocalUserIfAny();
        const merged = {
          ...(local || {}),
          correo: emailVal,
          perfil: {
            ...((local && local.perfil) || {}),
            ...(form || {}),
          },
        };
        userData = merged;
        saveUserToLocal(merged);
        hydrateUserInputs(merged);

        if (orderText) orderText.dataset.userEdited = "0";
        updateOrderTextLive(true);
        validateForm();
      }
    } catch {}
  }, 450);

  // ---- Eventos ----
  backButton?.addEventListener("click", () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/cart";
  });

  suggestPvBtn?.addEventListener("click", async () => {
    try {
      await ensurePuntosVentaLoaded();
    } catch (e) {
      console.error("[confirm.js] ensurePuntosVentaLoaded error:", e);
    }
  });

  refreshMessageBtn?.addEventListener("click", () => {
    if (orderText) orderText.dataset.userEdited = "0";
    updateOrderTextLive(true);
    validateForm();
  });

  nameInput?.addEventListener("input", onAnyFormChange);

  emailInput?.addEventListener("input", () => {
    onAnyFormChange();
    tryHydrateByEmail();
  });

  phoneInput?.addEventListener("input", onAnyFormChange);
  addressInput?.addEventListener("input", onAnyFormChange);
  notesInput?.addEventListener("input", onAnyFormChange);

  paymentMethodSelect?.addEventListener("change", () => {
    paymentTouched = true;
    onAnyFormChange();
  });

  pvDeptSelect?.addEventListener("change", () => {
    onDeptChange();
    validateForm();
    updateOrderTextLive();
  });

  pvMpioSelect?.addEventListener("change", () => {
    onMpioChange();
    validateForm();
    updateOrderTextLive();
  });

  pvBarrioSelect?.addEventListener("change", onBarrioChange);

  sendWhatsappBtn?.addEventListener("click", sendOrder);

  // ---- init ----
  async function init() {
    antiBotOk = false;
    turnstileToken = "";
    setAntiBotMsg("Valida la verificación para evitar bots.");

    loadCart();
    syncBadges();

    await loadUser();

    if (!cartItems.length) {
      if (orderText) {
        orderText.value =
          "No hay productos en el carrito.\nVuelve al menú y agrega productos antes de confirmar el pedido.";
      }
      if (pvMessage) pvMessage.textContent = "No hay productos en el carrito.";
      if (sendWhatsappBtn) sendWhatsappBtn.disabled = true;
      return;
    }

    try {
      await ensurePuntosVentaLoaded();
    } catch (err) {
      console.error("[confirm.js] Error inicial cargando PV:", err);
      if (pvMessage) pvMessage.textContent = "No se pudieron cargar los puntos de venta.";
    }

    if (orderText) orderText.dataset.userEdited = "0";
    updateOrderTextLive(true);
    validateForm();
  }

  init();
});
