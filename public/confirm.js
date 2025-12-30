// public/confirm.js
document.addEventListener("DOMContentLoaded", () => {
  const DELIVERY_FEE = 5000; // COP

  // ---- DOM ----
  const backButton = document.getElementById("confirm-back-button");
  const noUserWarning = document.getElementById("no-user-warning");

  const nameInput = document.getElementById("client-name");
  const emailInput = document.getElementById("client-email");
  const phoneInput = document.getElementById("client-phone"); // ✅ 10 dígitos SIN +57
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

  const cartIcon = document.getElementById("cart-icon");
  const cartCount = document.getElementById("cart-count");
  const cartCountBadge = document.getElementById("cart-count-badge");

  // ---- Estado ----
  let antiBotOk = false;
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

  function safeJson(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return null;
    }
  }

  function toInt(v, def = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : def;
  }

  function digitsOnly(v) {
    return String(v || "").replace(/\D/g, "");
  }

  function phoneFullFromInput10() {
    const ten = digitsOnly(phoneInput?.value || "");
    if (ten.length !== 10) return "";
    return "+57" + ten;
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

  function syncCartBadges() {
    const count = Array.isArray(cartItems)
      ? cartItems.reduce((acc, it) => acc + Number(it.quantity || 1), 0)
      : 0;

    if (cartCount) cartCount.textContent = String(count || 0);
    if (cartCountBadge) cartCountBadge.textContent = String(count || 0);
  }

  cartIcon?.addEventListener("click", () => {
    try {
      const raw = localStorage.getItem("burgerCart");
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        alert("Tu carrito está vacío.");
        return;
      }
      window.location.href = "/cart";
    } catch {
      window.location.href = "/cart";
    }
  });

  // ---- Validaciones ----
  function validatePhone10(value) {
    const d = digitsOnly(value);
    return /^\d{10}$/.test(d);
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

  // ---- Usuario (sesión + formulario) ----
  function saveUserToLocal(data) {
    try {
      if (!data) return;
      localStorage.setItem("burgerUser", JSON.stringify(data));
    } catch {}
  }

  function hydrateUserInputs(data) {
    if (!data) return;
    const correo = data.correo || data.email || "";
    const perfil = data.perfil || {};

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
      const d = digitsOnly(celular);
      phoneInput.value = d.length >= 10 ? d.slice(-10) : d;
    }

    if (addressInput && direccion) addressInput.value = direccion;
  }

  async function loadUser() {
    try {
      const session = await window.tqSession?.getSession?.();
      const email = session?.user?.email ? String(session.user.email) : "";

      if (!email) {
        userData = null;
        noUserWarning?.classList.remove("hidden");
        return;
      }

      noUserWarning?.classList.add("hidden");

      let form = null;
      try {
        form = await window.tqSession?.fetchFormularioByCorreo?.(email);
      } catch (e) {
        console.warn("[confirm.js] fetchFormularioByCorreo error:", e);
      }

      const merged = {
        correo: email,
        email,
        perfil: {
          nombre: form?.nombre || "",
          celular: form?.celular ? String(form.celular) : "",
          direccionentrega: form?.direccionentrega || "",
          Departamento: form?.Departamento || "",
          Municipio: form?.Municipio || "",
          Barrio: form?.Barrio || "",
        },
        formulario: form || null,
      };

      userData = merged;
      saveUserToLocal(merged);
      hydrateUserInputs(merged);
    } catch (err) {
      console.error("[confirm.js] Error cargando usuario:", err);
      userData = null;
      noUserWarning?.classList.remove("hidden");
    }
  }

  // ---- PV Card estilo stores ----
  function pvMapsLink(pv) {
    const lat = Number(pv?.Latitud);
    const lng = Number(pv?.Longitud);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return `https://www.google.com/maps?q=${lat},${lng}`;
    }
    const addr = encodeURIComponent(
      `${pv?.Direccion || ""} ${pv?.Municipio || ""} ${pv?.Departamento || ""}`
    );
    return `https://www.google.com/maps?q=${addr}`;
  }

  function renderPvCard(pv, distanceKmText = "") {
    if (!pvCard) return;
    if (!pv) {
      pvCard.classList.add("hidden");
      pvCard.innerHTML = "";
      return;
    }

    const img =
      pv.URL_image || pv.url_image || pv.imagen || pv.image || "/img/logo.png";
    const name = pv.Barrio || "Punto de venta";
    const addr = `${pv.Direccion || "Dirección no disponible"} - ${
      pv.Municipio || ""
    }`;
    const whatsapp = String(pv.num_whatsapp || "").trim();
    const maps = pvMapsLink(pv);

    pvCard.classList.remove("hidden");
    pvCard.innerHTML = `
      <div class="rounded-2xl bg-surface-dark p-4 border border-border-dark shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
        <div class="flex gap-4">
          <div class="w-20 h-20 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-black/40">
            <img src="${img}" alt="${name}" class="w-full h-full object-cover" loading="lazy"
                 onerror="this.src='/img/logo.png';" />
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-white font-extrabold text-base sm:text-lg leading-tight truncate">${name}</h3>
              ${
                distanceKmText
                  ? `<span class="shrink-0 text-xs font-extrabold px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">${distanceKmText}</span>`
                  : ""
              }
            </div>

            <p class="text-white/60 text-sm font-semibold truncate mt-1">${addr}</p>
            ${
              whatsapp
                ? `<p class="text-white/60 text-sm font-semibold truncate mt-1">WhatsApp: ${whatsapp}</p>`
                : `<p class="text-white/50 text-sm font-semibold truncate mt-1">WhatsApp no disponible</p>`
            }
          </div>
        </div>

        <div class="flex gap-3 mt-4">
          <a
            href="${maps}"
            target="_blank"
            rel="noopener"
            class="flex-1 inline-flex items-center justify-center rounded-full h-10 bg-primary hover:bg-red-700 text-white text-sm font-extrabold transition-colors gap-2"
          >
            <span class="material-symbols-outlined text-[18px]">navigation</span>
            Cómo llegar
          </a>

          ${
            whatsapp
              ? `<a
                  href="https://wa.me/${whatsapp.replace(/\D/g, "")}"
                  target="_blank"
                  rel="noopener"
                  class="inline-flex items-center justify-center rounded-full h-10 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-extrabold transition-colors gap-2"
                >
                  <span class="material-symbols-outlined text-[18px]">chat</span>
                  WhatsApp
                </a>`
              : ""
          }
        </div>

        <p class="text-xs text-white/45 mt-3">
          Este WhatsApp será el destino del mensaje y el punto de venta del pedido.
        </p>
      </div>
    `;
  }

  // ---- Form ----
  function validateForm() {
    if (!sendWhatsappBtn) return;

    const nameOk = !!(nameInput && nameInput.value.trim());

    const emailVal = emailInput ? emailInput.value.trim() : "";
    const emailOk = validateEmail(emailVal);

    const phoneVal = phoneInput ? phoneInput.value.trim() : "";
    const phoneOk = validatePhone10(phoneVal);

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
      if (phoneVal && !phoneOk) phoneError.classList.remove("hidden");
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

    // ✅ CLAVE: solo habilita si el form está ok y Turnstile está ok
    sendWhatsappBtn.disabled = !(allOk && antiBotOk);
  }

  // ---- WhatsApp message ----
  function buildOrderText(pedidoId = null) {
    const name = nameInput?.value?.trim() || "No especificado";
    const email = emailInput?.value?.trim() || "No especificado";

    const phone10 = digitsOnly(phoneInput?.value || "");
    const phone = phone10.length === 10 ? `+57${phone10}` : "No especificado";

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
      new Set(puntosVenta.map((pv) => pv.Departamento))
    ).sort();

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
      renderPvCard(null);
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
      )
    ).sort();

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
      renderPvCard(null);
    }

    if (!dept || !mpio) {
      pvBarrioSelect.disabled = true;
      return;
    }

    const barrios = puntosVenta
      .filter((pv) => pv.Departamento === dept && pv.Municipio === mpio)
      .map((pv) => pv.Barrio)
      .sort();

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
      renderPvCard(found);

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

  function toRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function distanciaKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async function suggestNearestPV() {
    try {
      await ensurePuntosVentaLoaded();
    } catch (err) {
      console.error("[confirm.js] Error cargando puntos de venta:", err);
      if (pvMessage)
        pvMessage.textContent = "No se pudieron cargar los puntos de venta.";
      return;
    }

    if (!navigator.geolocation) {
      if (pvMessage)
        pvMessage.textContent = "Tu navegador no soporta geolocalización.";
      return;
    }

    if (pvMessage) pvMessage.textContent = "Obteniendo ubicación...";

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          const userLat = pos.coords.latitude;
          const userLon = pos.coords.longitude;

          if (pvMessage)
            pvMessage.textContent = "Buscando punto de venta más cercano...";

          let best = null;
          let bestDist = Infinity;

          puntosVenta.forEach((pv) => {
            const pvLat = Number(pv.Latitud);
            const pvLon = Number(pv.Longitud);
            if (!Number.isFinite(pvLat) || !Number.isFinite(pvLon)) return;
            const d = distanciaKm(userLat, userLon, pvLat, pvLon);
            if (d < bestDist) {
              bestDist = d;
              best = pv;
            }
          });

          if (!best) {
            if (pvMessage)
              pvMessage.textContent =
                "No se pudo calcular el punto de venta más cercano.";
            return;
          }

          selectedPV = best;

          syncingPV = true;
          if (pvDeptSelect && pvMpioSelect && pvBarrioSelect) {
            pvDeptSelect.value = best.Departamento || "";
            onDeptChange();

            pvMpioSelect.value = best.Municipio || "";
            onMpioChange();

            pvBarrioSelect.value = best.Barrio || "";
          }
          syncingPV = false;

          selectedPV = best;
          renderPvCard(best, `~${bestDist.toFixed(1)} km`);

          if (orderText) orderText.dataset.userEdited = "0";
          updateOrderTextLive(true);
          validateForm();

          if (pvMessage) {
            pvMessage.textContent =
              `Punto de venta sugerido: ${best.Barrio || "Punto de venta"} ` +
              `(a ~${bestDist.toFixed(1)} km).`;
          }
        } catch (err) {
          console.error("[confirm.js] Error en sugerencia PV:", err);
          if (pvMessage)
            pvMessage.textContent =
              "Ocurrió un error al buscar el punto de venta.";
        }
      },
      (error) => {
        console.error("[confirm.js] Geolocalización error:", error);
        if (pvMessage)
          pvMessage.textContent = "No se pudo obtener tu ubicación.";
      }
    );
  }

  // ✅ Mapea carrito -> items para pedido_items
  function mapCartToPedidoItems() {
    const mapped = cartItems
      .map((item) => {
        const qty = Math.max(1, toInt(item.quantity ?? item.qty ?? 1, 1));
        const menuIdRaw =
          item.menu_id ?? item.menuId ?? item.id ?? item.productId;
        const menu_id = Number(menuIdRaw);

        if (!menu_id || Number.isNaN(menu_id)) {
          console.warn("[confirm.js] item sin menu_id válido:", item);
          return null;
        }

        const extras = Array.isArray(item.extras) ? safeJson(item.extras) : [];
        const modifications = Array.isArray(item.modifications)
          ? safeJson(item.modifications)
          : [];

        return {
          menu_id,
          qty,
          extras: extras || [],
          modifications: modifications || [],
        };
      })
      .filter(Boolean);

    return mapped;
  }

  async function sendOrder() {
    // ✅ BLOQUEO FINAL: si no pasó Turnstile NO se envía
    if (!antiBotOk) {
      alert("Completa la verificación anti-bot para enviar el pedido.");
      return;
    }

    const name = nameInput?.value?.trim();
    const email = emailInput?.value?.trim();
    const phoneFull = phoneFullFromInput10();
    const address = addressInput?.value?.trim();
    const paymentMethod = paymentMethodSelect?.value?.trim();

    if (!paymentMethodSelect || !paymentMethod) {
      paymentTouched = true;
      validateForm();
      alert("Selecciona un método de pago.");
      return;
    }

    const pv_id = Number(selectedPV?.id);
    if (
      !name ||
      !email ||
      !phoneFull ||
      !address ||
      !selectedPV ||
      !selectedPV.num_whatsapp ||
      !Number.isFinite(pv_id) ||
      pv_id <= 0
    ) {
      alert("Faltan datos obligatorios o punto de venta.");
      return;
    }

    const items = mapCartToPedidoItems();
    if (!items.length) {
      alert(
        "Tu carrito tiene productos inválidos (sin id). Vuelve al menú y agrega productos nuevamente."
      );
      return;
    }

    const subtotal = computeSubtotal();
    const total = subtotal + DELIVERY_FEE;

    // 1) Crear pedido en BD
    let pedidoId = null;
    try {
      const payload = {
        nombre_cliente: email,
        resumen_pedido: "",
        direccion_cliente: address,
        celular_cliente: phoneFull,
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
        alert(
          "Se enviará el WhatsApp, pero hubo un error registrando el pedido en el sistema."
        );
      } else {
        if (data && typeof data.id !== "undefined") pedidoId = data.id;
        else if (Array.isArray(data) && data[0]?.id) pedidoId = data[0].id;
        else if (data.pedido && data.pedido.id) pedidoId = data.pedido.id;
      }
    } catch (err) {
      console.error("[confirm.js] Error al llamar /api/pedidos:", err);
      alert(
        "Se enviará el WhatsApp, pero hubo un error registrando el pedido en el sistema."
      );
    }

    // 2) Mensaje final
    let message = orderText?.value?.trim();
    if (!message) message = buildOrderText(pedidoId ?? undefined);

    // 3) PATCH con resumen
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
    const pvPhoneDigits = String(selectedPV.num_whatsapp || "").replace(
      /\D/g,
      ""
    );
    if (!pvPhoneDigits) {
      alert("No hay WhatsApp configurado para el punto de venta.");
      return;
    }

    const url =
      "https://wa.me/" + pvPhoneDigits + "?text=" + encodeURIComponent(message);
    window.open(url, "_blank");

    // 5) Limpiar carrito y redirigir
    localStorage.removeItem("burgerCart");
    cartItems = [];
    syncCartBadges();

    const params = new URLSearchParams();
    if (email) params.set("correo", email);
    if (pedidoId !== null && pedidoId !== undefined)
      params.set("pedidoId", String(pedidoId));

    const historyUrl =
      "/history" + (params.toString() ? "?" + params.toString() : "");
    setTimeout(() => (window.location.href = historyUrl), 800);
  }

  // ---- Live update ----
  function onAnyFormChange() {
    validateForm();
    updateOrderTextLive();
  }

  // ---- Eventos ----
  backButton?.addEventListener("click", () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/cart";
  });

  suggestPvBtn?.addEventListener("click", suggestNearestPV);

  refreshMessageBtn?.addEventListener("click", () => {
    if (orderText) orderText.dataset.userEdited = "0";
    updateOrderTextLive(true);
    validateForm();
  });

  nameInput?.addEventListener("input", onAnyFormChange);
  emailInput?.addEventListener("input", onAnyFormChange);
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

  // ---- Anti-bot (Turnstile) ----
  const msgEl = document.getElementById("antibot-msg");

  function setAntiBotMsg(text, isError = false) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.classList.toggle("text-red-400", !!isError);
    msgEl.classList.toggle("text-white/60", !isError);
  }

  async function verifyAntiBotServer(token) {
    const res = await fetch("/api/antibot/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ cf_turnstile_response: token }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(data?.message || "No se pudo validar anti-bot");
    return true;
  }

  // ✅ Turnstile callbacks del HTML
  window.onOrderTurnstile = async function (token) {
    antiBotOk = false;
    if (sendWhatsappBtn) sendWhatsappBtn.disabled = true;

    try {
      setAntiBotMsg("Validando…");
      await verifyAntiBotServer(token);
      antiBotOk = true;
      setAntiBotMsg("Verificación lista ✅ Ya puedes enviar tu pedido.");
    } catch (e) {
      console.error("[anti-bot] verify error:", e);
      antiBotOk = false;
      setAntiBotMsg("Falló la verificación. Intenta de nuevo.", true);
      if (window.turnstile) {
        try {
          window.turnstile.reset();
        } catch {}
      }
    } finally {
      validateForm();
    }
  };

  window.onOrderTurnstileExpired = function () {
    antiBotOk = false;
    setAntiBotMsg("La verificación expiró. Vuélvela a completar.", true);
    validateForm();
  };

  window.onOrderTurnstileError = function () {
    antiBotOk = false;
    setAntiBotMsg(
      "Error cargando verificación anti-bot. Recarga la página.",
      true
    );
    validateForm();
  };

  // ---- init ----
  async function init() {
    // ✅ confirm requiere sesión
    const ok = await window.tqSession?.requireLoginOrRedirect?.();
    if (!ok) return;

    loadCart();
    syncCartBadges();

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
      if (pvMessage)
        pvMessage.textContent = "No se pudieron cargar los puntos de venta.";
    }

    if (orderText) orderText.dataset.userEdited = "0";
    updateOrderTextLive(true);

    // ✅ por seguridad: si no pasó Turnstile, NO habilitar aunque el form esté ok
    antiBotOk = false;
    setAntiBotMsg("Completa la verificación para habilitar el envío.");
    validateForm();
  }

  init();
});
