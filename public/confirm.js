// public/confirm.js
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
  const pvName = document.getElementById("pv-name");
  const pvAddress = document.getElementById("pv-address");
  const pvWhatsapp = document.getElementById("pv-whatsapp");

  const pvDeptSelect = document.getElementById("pv-departamento");
  const pvMpioSelect = document.getElementById("pv-municipio");
  const pvBarrioSelect = document.getElementById("pv-barrio");

  const orderText = document.getElementById("order-text");
  const sendWhatsappBtn = document.getElementById("send-whatsapp-btn");
  const refreshMessageBtn = document.getElementById("refresh-message-btn");

  const cartBadgeDesktop = document.getElementById("cart-badge-desktop");
  const cartBadgeMobile = document.getElementById("cart-badge-mobile");

  // NUEVO (si lo agregas al HTML)
  const saveProfileBtn = document.getElementById("save-profile-btn");
  const saveProfileStatus = document.getElementById("save-profile-status");

  // ---- Estado ----
  let cartItems = [];
  let userData = null;
  let puntosVenta = [];
  let selectedPV = null;
  let isUserLoggedIn = false;

  // Para no romper selectedPV cuando sincronizas selects por geolocalización
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

  function setSaveStatus(msg) {
    if (!saveProfileStatus) return;
    saveProfileStatus.textContent = msg;
    saveProfileStatus.classList.remove("hidden");
    clearTimeout(setSaveStatus._t);
    setSaveStatus._t = setTimeout(() => {
      saveProfileStatus.classList.add("hidden");
    }, 2000);
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
      cartItems = raw ? (Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []) : [];
    } catch (err) {
      console.error("[confirm.js] Error leyendo burgerCart:", err);
      cartItems = [];
    }
  }

  function syncBadges() {
    const count = cartItems.reduce((acc, it) => acc + Number(it.quantity || 1), 0);
    if (cartBadgeDesktop) cartBadgeDesktop.textContent = String(count);
    if (cartBadgeMobile) cartBadgeMobile.textContent = String(count);
  }

  // ---- Validaciones ----
  function validatePhone(value) {
    if (!value) return false;
    return /^\+57\d{10}$/.test(value.trim());
  }

  function validateEmail(value) {
    if (!value) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function computeSubtotal() {
    return cartItems.reduce((acc, item) => acc + Number(item.total || 0), 0);
  }

  function cookingLabel(value) {
    if (value === "medio") return "Medio hecha";
    if (value === "bien_cocida") return "Bien cocida";
    return "Normal";
  }

  // ---- Hidratar inputs (acepta dos formatos) ----
  function hydrateUserInputs(data) {
    if (!data) return;

    const correo = data.correo || data.email || "";
    const perfil = data.perfil || {};

    // Compat: localStorage (auth.js) guarda plano: nombre/celular/direccionentrega
    const nombre = perfil.nombre || data.nombre || "";
    const celular = perfil.celular || data.celular || "";
    const direccion = perfil.direccionentrega || perfil.direccion || data.direccionentrega || data.direccion || "";

    if (nameInput && nombre) nameInput.value = nombre;
    if (emailInput && correo) emailInput.value = correo;

    if (phoneInput && celular) {
      const digits = String(celular).replace(/\D/g, "");
      if (digits.length === 12 && digits.startsWith("57")) phoneInput.value = "+" + digits;
      else if (digits.length === 10) phoneInput.value = "+57" + digits;
      else if (String(celular).startsWith("+57")) phoneInput.value = String(celular);
      else phoneInput.value = "+57" + digits;
    }

    if (addressInput && direccion) addressInput.value = direccion;
  }

  function getCorreoFromURL() {
    try {
      const params = new URLSearchParams(window.location.search);
      const c = params.get("correo");
      return c ? c.trim() : "";
    } catch {
      return "";
    }
  }

  async function fetchUserByCorreo(correo) {
    const res = await fetch(`/api/auth/user?correo=${encodeURIComponent(correo)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data || null;
  }

  async function loadUser() {
    try {
      // 1) intenta localStorage
      const local = getLocalUserIfAny();
      const correoLocal = local?.correo ? String(local.correo).trim() : "";

      // 2) URL param
      const correoUrl = getCorreoFromURL();

      // 3) si ya hay correo en local, úsalo
      const correoBase = correoLocal || correoUrl || "";

      if (correoBase) {
        // muestra algo rápido con local, y luego refresca con BD
        if (local?.correo && local.correo === correoBase) {
          userData = local;
          isUserLoggedIn = true;
          noUserWarning?.classList.add("hidden");
          hydrateUserInputs(local);
        }

        const fromDb = await fetchUserByCorreo(correoBase);
        if (fromDb?.correo) {
          userData = fromDb;
          isUserLoggedIn = true;
          noUserWarning?.classList.add("hidden");
          hydrateUserInputs(fromDb);

          // mezcla lo que hubiera local + perfil BD
          const merged = { ...(local || {}), ...(fromDb || {}), perfil: fromDb.perfil || (local && local.perfil) || {} };
          saveUserToLocal(merged);
        }
        return;
      }

      // 4) sin correo: no logueado (pero igual puede llenar manual)
      userData = null;
      isUserLoggedIn = false;
      noUserWarning?.classList.remove("hidden");
    } catch (err) {
      console.error("[confirm.js] Error cargando usuario:", err);
      userData = null;
      isUserLoggedIn = false;
      noUserWarning?.classList.remove("hidden");
    }
  }

  // ---- WhatsApp message ----
  function buildOrderText(pedidoId = null) {
    const name = nameInput?.value?.trim() || "No especificado";
    const email = emailInput?.value?.trim() || "No especificado";
    const phone = phoneInput?.value?.trim() || "No especificado";
    const address = addressInput?.value?.trim() || "No especificado";
    const notes = notesInput?.value?.trim() || "";

    const paymentMethod = paymentMethodSelect?.value?.trim() || "No especificado";

    const subtotal = computeSubtotal();
    const total = subtotal + DELIVERY_FEE;

    const lines = [];
    cartItems.forEach((item) => {
      const qty = Number(item.quantity || 1);
      const lineTotal = Number(item.total || 0);

      lines.push(`• ${qty}x ${item.nombre || "Producto"} - ${formatPrice(lineTotal)}`);

      if (Array.isArray(item.extras) && item.extras.length) {
        const extrasText = item.extras
          .map((ex) => `${ex.nombre} (${formatPrice(ex.precio || 0)})`)
          .join(", ");
        lines.push(`   → Adiciones: ${extrasText}`);
      }

      if (Array.isArray(item.modifications) && item.modifications.length) {
        lines.push(`   → Personalización: ${item.modifications.join(", ")}`);
      }

      if (item.tipo === 1 || item.tipo === 3) {
        lines.push(`   → Término: ${cookingLabel(item.cooking)}`);
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
      `🛵 *Total con envío:* ${formatPrice(total)}`,
      "────────────────────────────"
    );

    if (selectedPV) {
      const pvNameText = selectedPV.Barrio || "Punto de venta";
      const pvAddrText = `${selectedPV.Direccion || ""} - ${selectedPV.Municipio || ""}`;
      header.push(`🏬 *Punto de venta:* ${pvNameText}`, `📍 ${pvAddrText}`);
      if (selectedPV.num_whatsapp) header.push(`📞 WhatsApp: ${selectedPV.num_whatsapp}`);
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

  function updatePVCard() {
    if (!pvCard || !pvName || !pvAddress || !pvWhatsapp) return;

    if (!selectedPV) {
      pvCard.classList.add("hidden");
      return;
    }

    pvCard.classList.remove("hidden");
    pvName.textContent = selectedPV.Barrio || "Punto de venta";
    pvAddress.textContent = `${selectedPV.Direccion || ""} - ${selectedPV.Municipio || ""}`;
    pvWhatsapp.textContent = `WhatsApp: ${selectedPV.num_whatsapp || "No disponible"}`;
  }

  function validateForm() {
    if (!sendWhatsappBtn) return;

    const nameOk = !!(nameInput && nameInput.value.trim());

    const emailVal = emailInput ? emailInput.value.trim() : "";
    const emailOk = validateEmail(emailVal);

    const phoneVal = phoneInput ? phoneInput.value.trim() : "";
    const phoneOk = validatePhone(phoneVal);

    const addressOk = !!(addressInput && addressInput.value.trim());

    const cartOk = cartItems && cartItems.length > 0;
    const pvOk = !!(selectedPV && String(selectedPV.num_whatsapp || "").trim());

    const paymentOk = !!(paymentMethodSelect && paymentMethodSelect.value.trim());

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

    const allOk = nameOk && emailOk && phoneOk && addressOk && cartOk && pvOk && paymentOk;
    sendWhatsappBtn.disabled = !allOk;
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

    const departamentos = Array.from(new Set(puntosVenta.map((pv) => pv.Departamento))).sort();

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

    // 👇 NO borres selectedPV si estás sincronizando por geolocalización
    if (!syncingPV) {
      selectedPV = null;
      updatePVCard();
    }

    if (!dept) {
      pvMpioSelect.disabled = true;
      return;
    }

    const municipios = Array.from(
      new Set(puntosVenta.filter((pv) => pv.Departamento === dept).map((pv) => pv.Municipio))
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
      updatePVCard();
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
      (pv) => pv.Departamento === dept && pv.Municipio === mpio && pv.Barrio === barrio
    );

    if (found) {
      selectedPV = found;
      updatePVCard();

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
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async function suggestNearestPV() {
    try {
      await ensurePuntosVentaLoaded();
    } catch (err) {
      console.error("[confirm.js] Error cargando puntos de venta:", err);
      if (pvMessage) pvMessage.textContent = "No se pudieron cargar los puntos de venta.";
      return;
    }

    if (!navigator.geolocation) {
      if (pvMessage) pvMessage.textContent = "Tu navegador no soporta geolocalización.";
      return;
    }

    if (pvMessage) pvMessage.textContent = "Obteniendo ubicación...";

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          const userLat = pos.coords.latitude;
          const userLon = pos.coords.longitude;

          if (pvMessage) pvMessage.textContent = "Buscando punto de venta más cercano...";

          let best = null;
          let bestDist = Infinity;

          puntosVenta.forEach((pv) => {
            const pvLat = Number(pv.Latitud);
            const pvLon = Number(pv.Longitud);
            if (Number.isNaN(pvLat) || Number.isNaN(pvLon)) return;
            const d = distanciaKm(userLat, userLon, pvLat, pvLon);
            if (d < bestDist) {
              bestDist = d;
              best = pv;
            }
          });

          if (!best) {
            if (pvMessage) pvMessage.textContent = "No se pudo calcular el punto de venta más cercano.";
            return;
          }

          // 1) Set PV
          selectedPV = best;
          updatePVCard();

          // 2) Sincroniza selects sin borrar selectedPV
          syncingPV = true;
          if (pvDeptSelect && pvMpioSelect && pvBarrioSelect) {
            pvDeptSelect.value = best.Departamento || "";
            onDeptChange();

            pvMpioSelect.value = best.Municipio || "";
            onMpioChange();

            pvBarrioSelect.value = best.Barrio || "";
          }
          syncingPV = false;

          // 3) Reafirma selectedPV y refresca mensaje + validación
          selectedPV = best;
          updatePVCard();

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
          if (pvMessage) pvMessage.textContent = "Ocurrió un error al buscar el punto de venta.";
        }
      },
      (error) => {
        console.error("[confirm.js] Geolocalización error:", error);
        if (pvMessage) pvMessage.textContent = "No se pudo obtener tu ubicación.";
      }
    );
  }

  // ---- Guardar perfil (local + opcional backend) ----
  async function saveProfile() {
    const name = nameInput?.value?.trim() || "";
    const email = emailInput?.value?.trim() || "";
    const phone = phoneInput?.value?.trim() || "";
    const address = addressInput?.value?.trim() || "";

    if (!name) return alert("Ingresa tu nombre.");
    if (!validateEmail(email)) return alert("Ingresa un correo válido.");
    if (!validatePhone(phone)) return alert("Tu celular debe ser +57 y 10 dígitos.");
    if (!address) return alert("Ingresa tu dirección.");

    // Guarda en local para no pedirlo de nuevo
    const merged = userData && typeof userData === "object" ? userData : {};
    merged.correo = email;
    merged.nombre = merged.nombre || name;
    merged.celular = merged.celular || phone;
    merged.direccionentrega = merged.direccionentrega || address;
    merged.perfil = merged.perfil || {};
    merged.perfil.nombre = name;
    merged.perfil.celular = phone;
    merged.perfil.direccionentrega = address;

    userData = merged;
    saveUserToLocal(merged);

    // ✅ Opcional: si creas endpoint PATCH /api/formulario (recomendado)
    // try {
    //   await fetch("/api/formulario", {
    //     method: "PATCH",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({ correo: email, nombre: name, celular: phone, direccionentrega: address }),
    //   });
    // } catch {}

    setSaveStatus("✅ Datos actualizados");

    if (orderText) orderText.dataset.userEdited = "0";
    updateOrderTextLive(true);
    validateForm();
  }

  // ---- Enviar ----
  async function sendOrder() {
    const name = nameInput?.value?.trim();
    const email = emailInput?.value?.trim();
    const phone = phoneInput?.value?.trim();
    const address = addressInput?.value?.trim();
    const paymentMethod = paymentMethodSelect?.value?.trim();

    if (!paymentMethodSelect || !paymentMethod) {
      paymentTouched = true;
      validateForm();
      alert("Selecciona un método de pago.");
      return;
    }

    if (!name || !email || !phone || !address || !selectedPV || !selectedPV.num_whatsapp) {
      alert("Faltan datos obligatorios o punto de venta.");
      return;
    }

    const puntoventaName = selectedPV.Barrio || selectedPV.Direccion || String(selectedPV.id);
    let pedidoId = null;

    // 1) Crear pedido en BD
    try {
      const payload = {
        nombre_cliente: email,
        resumen_pedido: "",
        direccion_cliente: address,
        celular_cliente: phone,
        puntoventa: puntoventaName,
        metodo_pago: paymentMethod,
      };

      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error("[confirm.js] Error al registrar pedido:", await res.text());
        alert("Se enviará el WhatsApp, pero hubo un error registrando el pedido en el sistema.");
      } else {
        try {
          const data = await res.json();
          if (data) {
            if (typeof data.id !== "undefined") pedidoId = data.id;
            else if (Array.isArray(data) && data[0]?.id) pedidoId = data[0].id;
            else if (data.pedido && data.pedido.id) pedidoId = data.pedido.id;
          }
        } catch {}
      }
    } catch (err) {
      console.error("[confirm.js] Error al llamar /api/pedidos:", err);
      alert("Se enviará el WhatsApp, pero hubo un error registrando el pedido en el sistema.");
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
      } catch {}
    }

    // 4) Abrir WhatsApp
    const pvPhoneDigits = String(selectedPV.num_whatsapp || "").replace(/\D/g, "");
    if (!pvPhoneDigits) {
      alert("No hay WhatsApp configurado para el punto de venta.");
      return;
    }

    const url = "https://wa.me/" + pvPhoneDigits + "?text=" + encodeURIComponent(message);
    window.open(url, "_blank");

    // 5) Limpiar carrito y redirigir
    localStorage.removeItem("burgerCart");
    cartItems = [];
    syncBadges();

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

  // Si escriben el email y existe en BD, autocompleta
  const tryHydrateByEmail = debounce(async () => {
    const emailVal = emailInput?.value?.trim() || "";
    if (!validateEmail(emailVal)) return;

    if (userData?.correo && userData.correo === emailVal) return;

    const local = getLocalUserIfAny();
    if (local?.correo === emailVal) {
      userData = local;
      hydrateUserInputs(local);
      if (orderText) orderText.dataset.userEdited = "0";
      updateOrderTextLive(true);
      validateForm();
      return;
    }

    const fromDb = await fetchUserByCorreo(emailVal);
    if (fromDb?.correo) {
      userData = fromDb;
      hydrateUserInputs(fromDb);
      saveUserToLocal(fromDb);
      if (orderText) orderText.dataset.userEdited = "0";
      updateOrderTextLive(true);
      validateForm();
    }
  }, 450);

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

  saveProfileBtn?.addEventListener("click", saveProfile);

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
