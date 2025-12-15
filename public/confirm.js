document.addEventListener("DOMContentLoaded", () => {
  const DELIVERY_FEE = 5000; // COP

  // ---- Elementos DOM ----
  const backButton = document.getElementById("confirm-back-button");
  const noUserWarning = document.getElementById("no-user-warning");
  const nameInput = document.getElementById("client-name");
  const emailInput = document.getElementById("client-email");
  const phoneInput = document.getElementById("client-phone");
  const addressInput = document.getElementById("client-address");
  const phoneError = document.getElementById("phone-error");
  const emailError = document.getElementById("email-error");
  const suggestPvBtn = document.getElementById("suggest-pv-btn");
  const pvMessage = document.getElementById("pv-message");
  const pvCard = document.getElementById("pv-card");
  const pvImage = document.getElementById("pv-image");
  const pvName = document.getElementById("pv-name");
  const pvAddress = document.getElementById("pv-address");
  const pvWhatsapp = document.getElementById("pv-whatsapp");
  const pvDeptSelect = document.getElementById("pv-departamento");
  const pvMpioSelect = document.getElementById("pv-municipio");
  const pvBarrioSelect = document.getElementById("pv-barrio");
  const orderText = document.getElementById("order-text");
  const sendWhatsappBtn = document.getElementById("send-whatsapp-btn");

  // Botones existentes y botón nuevo para refrescar mensaje
  const confirmInfoBtn = document.getElementById("confirm-info-btn");
  const saveInfoBtn = document.getElementById("save-info-btn");
  const refreshMessageBtn = document.getElementById("refresh-message-btn");

  // ---- Estado ----
  let cartItems = [];
  let userData = null;
  let puntosVenta = [];
  let selectedPV = null;
  let isUserLoggedIn = false;

  // ---- Helpers ----
  function formatPrice(value) {
    const n = Number(value || 0);
    return "$" + n.toLocaleString("es-CO");
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem("burgerCart");
      if (!raw) {
        cartItems = [];
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cartItems = parsed;
      } else {
        cartItems = [];
      }
    } catch (err) {
      console.error("[confirm.js] Error leyendo burgerCart:", err);
      cartItems = [];
    }
  }

  async function loadUser() {
    try {
      const raw = localStorage.getItem("burgerUser");
      if (raw) {
        const parsed = JSON.parse(raw);
        userData = parsed || null;
        isUserLoggedIn = true;

        if (noUserWarning) noUserWarning.classList.add("hidden");

        if (nameInput && parsed.perfil && parsed.perfil.nombre) {
          nameInput.value = parsed.perfil.nombre;
        }

        if (emailInput && parsed.correo) {
          emailInput.value = parsed.correo;
        }

        if (phoneInput && parsed.perfil && parsed.perfil.celular) {
          const phone = String(parsed.perfil.celular);
          if (phone.startsWith("+57")) {
            phoneInput.value = phone;
          } else if (phone.startsWith("57")) {
            phoneInput.value = "+" + phone;
          } else {
            phoneInput.value = "+57" + phone.replace(/\D/g, "");
          }
        }

        if (
          addressInput &&
          parsed.perfil &&
          (parsed.perfil.direccionentrega || parsed.perfil.direccion)
        ) {
          addressInput.value =
            parsed.perfil.direccionentrega || parsed.perfil.direccion;
        }
      } else {
        await fetchUserDataFromSupabase();
      }
    } catch (err) {
      console.error("[confirm.js] Error leyendo burgerUser:", err);
      userData = null;
      isUserLoggedIn = false;
      if (noUserWarning) noUserWarning.classList.remove("hidden");
    }
  }

  async function fetchUserDataFromSupabase() {
    try {
      const res = await fetch("/api/auth/user");
      if (!res.ok) {
        throw new Error("No se pudieron obtener los datos del usuario");
      }
      const data = await res.json();
      userData = data;
      isUserLoggedIn = true;

      if (noUserWarning) noUserWarning.classList.add("hidden");

      if (nameInput && data.perfil && data.perfil.nombre) {
        nameInput.value = data.perfil.nombre;
      }

      if (emailInput && data.correo) {
        emailInput.value = data.correo;
      }

      if (phoneInput && data.perfil && data.perfil.celular) {
        const phone = String(data.perfil.celular);
        if (phone.startsWith("+57")) {
          phoneInput.value = phone;
        } else if (phone.startsWith("57")) {
          phoneInput.value = "+" + phone;
        } else {
          phoneInput.value = "+57" + phone.replace(/\D/g, "");
        }
      }

      if (
        addressInput &&
        data.perfil &&
        (data.perfil.direccionentrega || data.perfil.direccion)
      ) {
        addressInput.value =
          data.perfil.direccionentrega || data.perfil.direccion;
      }

      localStorage.setItem("burgerUser", JSON.stringify(data));
    } catch (err) {
      console.error("[confirm.js] Error obteniendo datos del usuario:", err);
      userData = null;
      isUserLoggedIn = false;
      if (noUserWarning) noUserWarning.classList.remove("hidden");
    }
  }

  function validatePhone(value) {
    if (!value) return false;
    const trimmed = value.trim();
    const regex = /^\+57\d{10}$/;
    return regex.test(trimmed);
  }

  function validateEmail(value) {
    if (!value) return false;
    const trimmed = value.trim();
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(trimmed);
  }

  function computeSubtotal() {
    return cartItems.reduce((acc, item) => acc + Number(item.total || 0), 0);
  }

  // Construye el texto del pedido (SIEMPRE genera uno nuevo)
  function buildOrderText() {
    const name = nameInput?.value?.trim() || "No especificado";
    const email = emailInput?.value?.trim() || "No especificado";
    const phone = phoneInput?.value?.trim() || "No especificado";
    const address = addressInput?.value?.trim() || "No especificado";

    const subtotal = computeSubtotal();
    const total = subtotal + DELIVERY_FEE;

    const lines = [];

    cartItems.forEach((item) => {
      const qty = Number(item.quantity || 1);
      const lineTotal = Number(item.total || 0);

      lines.push(
        `• ${qty}x ${item.nombre || "Producto"} - ${formatPrice(lineTotal)}`
      );

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
        let term = "Normal";
        if (item.cooking === "medio") term = "Medio hecha";
        else if (item.cooking === "bien_cocida") term = "Bien cocida";
        lines.push(`   → Término: ${term}`);
      }
    });

    const pvNameText = selectedPV
      ? `${selectedPV.Barrio || "Punto de venta"}`
      : "No seleccionado";
    const pvAddrText = selectedPV
      ? `${selectedPV.Direccion || ""} - ${selectedPV.Municipio || ""}`
      : "";

    const headerLines = [
      "🧾 *NUEVO PEDIDO*",
      "────────────────────────────",
      "👤 *Datos del cliente:*",
      `• Nombre: ${name}`,
      `• Teléfono: ${phone}`,
      `• Email: ${email}`,
      `• Dirección: ${address}`,
      "────────────────────────────",
      "🛒 *Pedido completo:*",
      ...lines,
      "────────────────────────────",
      `💵 *Subtotal:* ${formatPrice(subtotal)}`,
      `🛵 *Total con envío:* ${formatPrice(total)}`,
      "────────────────────────────",
    ];

    if (selectedPV) {
      headerLines.push(
        `🏬 *Punto de venta:* ${pvNameText}`,
        `📍 ${pvAddrText}`,
        selectedPV.num_whatsapp
          ? `📞 WhatsApp: ${selectedPV.num_whatsapp}`
          : ""
      );
      headerLines.push("────────────────────────────");
    }

    return headerLines.join("\n");
  }

  // Ahora acepta `force`: si true, siempre regenera aunque el textarea tenga texto
  function updateOrderTextIfEmpty(force = false) {
    if (!orderText) return;

    if (force || orderText.value.trim() === "") {
      orderText.value = buildOrderText();
    }
  }

  function updatePVCard() {
    if (!pvCard || !pvName || !pvAddress || !pvWhatsapp) return;

    if (!selectedPV) {
      pvCard.classList.add("hidden");
      return;
    }

    pvCard.classList.remove("hidden");

    const name = selectedPV.Barrio || "Punto de venta";
    const addr = `${selectedPV.Direccion || ""} - ${selectedPV.Municipio || ""}`;
    const whats = selectedPV.num_whatsapp || "No disponible";

    pvName.textContent = name;
    pvAddress.textContent = addr;
    pvWhatsapp.textContent = `WhatsApp: ${whats}`;

    if (pvImage) {
      if (selectedPV.URL_image) {
        pvImage.style.backgroundImage = `url('${selectedPV.URL_image}')`;
      } else {
        pvImage.style.backgroundImage = "";
      }
    }
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
    const pvOk = selectedPV && selectedPV.num_whatsapp;

    if (phoneError) {
      if (phoneVal && !phoneOk) {
        phoneError.classList.remove("hidden");
      } else {
        phoneError.classList.add("hidden");
      }
    }

    if (emailError) {
      if (emailVal && !emailOk) {
        emailError.classList.remove("hidden");
      } else {
        emailError.classList.add("hidden");
      }
    }

    const allOk = nameOk && emailOk && phoneOk && addressOk && cartOk && pvOk;
    sendWhatsappBtn.disabled = !allOk;
  }

  // ---- Puntos de venta ----
  async function fetchPuntosVenta() {
    const res = await fetch("/api/puntos-venta");
    if (!res.ok) {
      throw new Error("No se pudieron obtener puntos de venta");
    }
    const data = await res.json();
    console.log("Datos obtenidos de la API:", data);
    return data;
  }

  async function ensurePuntosVentaLoaded() {
    if (Array.isArray(puntosVenta) && puntosVenta.length > 0) return;
    puntosVenta = await fetchPuntosVenta();
    console.log("Puntos de venta cargados:", puntosVenta);
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

    if (!dept || !mpio || !barrio) {
      return;
    }

    const found = puntosVenta.find(
      (pv) =>
        pv.Departamento === dept &&
        pv.Municipio === mpio &&
        pv.Barrio === barrio
    );

    if (found) {
      selectedPV = found;
      console.log("Punto de venta seleccionado:", selectedPV);
      console.log("Número de WhatsApp:", selectedPV.num_whatsapp);
      updatePVCard();
      // Solo generamos texto automático si está vacío
      updateOrderTextIfEmpty();
      validateForm();
      if (pvMessage) {
        pvMessage.textContent =
          `Punto de venta seleccionado: ${found.Barrio}. ` +
          `Si cambias de punto de venta y quieres actualizar el texto, usa el botón "Actualizar mensaje".`;
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
      if (pvMessage) {
        pvMessage.textContent =
          "No se pudieron cargar los puntos de venta para sugerir uno cercano.";
      }
      return;
    }

    if (!navigator.geolocation) {
      if (pvMessage) {
        pvMessage.textContent =
          "Tu navegador no soporta geolocalización. Selecciona el punto de venta manualmente.";
      }
      return;
    }

    if (pvMessage) {
      pvMessage.textContent = "Obteniendo ubicación...";
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          const userLat = pos.coords.latitude;
          const userLon = pos.coords.longitude;

          if (pvMessage) {
            pvMessage.textContent = "Buscando punto de venta más cercano...";
          }

          if (!Array.isArray(puntosVenta) || puntosVenta.length === 0) {
            if (pvMessage) {
              pvMessage.textContent =
                "No hay puntos de venta configurados en el sistema.";
            }
            return;
          }

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
            if (pvMessage) {
              pvMessage.textContent =
                "No se pudo calcular el punto de venta más cercano.";
            }
            return;
          }

          selectedPV = best;
          updatePVCard();

          if (pvMessage) {
            pvMessage.textContent =
              `Punto de venta sugerido: ${best.Barrio || "Punto de venta"} ` +
              `(a ~${bestDist.toFixed(
                1
              )} km). Si luego cambias a uno manual, usa "Actualizar mensaje" para regenerar el texto.`;
          }

          // Opcional: setear selects según sugerido
          if (pvDeptSelect && pvMpioSelect && pvBarrioSelect) {
            pvDeptSelect.value = best.Departamento;
            onDeptChange();
            pvMpioSelect.value = best.Municipio;
            onMpioChange();
            pvBarrioSelect.value = best.Barrio;
          }

          updateOrderTextIfEmpty();
          validateForm();
        } catch (err) {
          console.error("[confirm.js] Error en sugerencia PV:", err);
          if (pvMessage) {
            pvMessage.textContent =
              "Ocurrió un error al buscar el punto de venta más cercano.";
          }
        }
      },
      (error) => {
        console.error("[confirm.js] Geolocalización error:", error);
        if (pvMessage) {
          pvMessage.textContent =
            "No se pudo obtener tu ubicación. Revisa los permisos de geolocalización o selecciona el punto de venta manualmente.";
        }
      }
    );
  }

  // ---- Enviar pedido ----
  async function sendOrder() {
    if (!sendWhatsappBtn) return;

    const name = nameInput?.value?.trim();
    const email = emailInput?.value?.trim() || "No especificado";
    const phone = phoneInput?.value?.trim();
    const address = addressInput?.value?.trim();

    if (
      !name ||
      !email ||
      !phone ||
      !address ||
      !selectedPV ||
      !selectedPV.num_whatsapp
    ) {
      alert("Faltan datos obligatorios o punto de venta.");
      return;
    }

    // Mensaje final
    let message = orderText?.value?.trim();
    if (!message) {
      message = buildOrderText();
    }

    const puntoventaName =
      selectedPV.Barrio || selectedPV.Direccion || String(selectedPV.id);

    let pedidoId = null;

    // 1. Registrar en tabla pedidos
    try {
      const payload = {
        nombre_cliente: email, // correo va en nombre_cliente
        resumen_pedido: message,
        direccion_cliente: address,
        celular_cliente: phone,
        puntoventa: puntoventaName,
      };

      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error(
          "[confirm.js] Error al registrar pedido:",
          await res.text()
        );
        alert(
          "Se enviará el WhatsApp, pero hubo un error registrando el pedido en el sistema."
        );
      } else {
        try {
          const data = await res.json();
          if (data) {
            if (typeof data.id !== "undefined") {
              pedidoId = data.id;
            } else if (Array.isArray(data) && data[0]?.id) {
              pedidoId = data[0].id;
            } else if (data.pedido && data.pedido.id) {
              pedidoId = data.pedido.id;
            }
          }
        } catch (jsonErr) {
          console.warn(
            "[confirm.js] No se pudo obtener el id del pedido de la respuesta:",
            jsonErr
          );
        }
      }
    } catch (err) {
      console.error("[confirm.js] Error al llamar /api/pedidos:", err);
      alert(
        "Se enviará el WhatsApp, pero hubo un error registrando el pedido en el sistema."
      );
    }

    // 2. Abrir WhatsApp
    try {
      const pvPhoneRaw = selectedPV.num_whatsapp || "";
      const pvPhoneDigits = pvPhoneRaw.replace(/\D/g, "");
      if (!pvPhoneDigits) {
        alert(
          "No hay número de WhatsApp configurado para el punto de venta. No se puede abrir WhatsApp."
        );
        return;
      }

      const url =
        "https://wa.me/" +
        pvPhoneDigits +
        "?text=" +
        encodeURIComponent(message);

      window.open(url, "_blank");
    } catch (err) {
      console.error("[confirm.js] Error al abrir WhatsApp:", err);
      alert("No se pudo abrir WhatsApp desde el navegador.");
    }

    // 3. Borrar el carrito del JSON (localStorage) y redirigir al historial
    localStorage.removeItem("burgerCart");
    cartItems = [];

    const params = new URLSearchParams();
    if (email && email !== "No especificado") {
      params.set("correo", email);
    }
    if (pedidoId !== null && pedidoId !== undefined) {
      params.set("pedidoId", String(pedidoId));
    }

    const historyUrl =
      "/history" + (params.toString() ? "?" + params.toString() : "");

    setTimeout(() => {
      window.location.href = historyUrl;
    }, 800);
  }

  // ---- Eventos ----
  if (backButton) {
    backButton.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "/cart";
      }
    });
  }

  if (suggestPvBtn) {
    suggestPvBtn.addEventListener("click", () => {
      suggestNearestPV();
    });
  }

  // Botón NUEVO: refrescar mensaje manualmente
  if (refreshMessageBtn) {
    refreshMessageBtn.addEventListener("click", () => {
      updateOrderTextIfEmpty(true); // fuerza regeneración
      validateForm();
    });
  }

  if (nameInput) {
    nameInput.addEventListener("input", () => {
      validateForm();
    });
  }

  if (emailInput) {
    emailInput.addEventListener("input", () => {
      validateForm();
    });
  }

  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      validateForm();
    });
  }

  if (addressInput) {
    addressInput.addEventListener("input", () => {
      validateForm();
    });
  }

  if (pvDeptSelect) {
    pvDeptSelect.addEventListener("change", () => {
      onDeptChange();
      validateForm();
    });
  }

  if (pvMpioSelect) {
    pvMpioSelect.addEventListener("change", () => {
      onMpioChange();
      validateForm();
    });
  }

  if (pvBarrioSelect) {
    pvBarrioSelect.addEventListener("change", () => {
      onBarrioChange();
    });
  }

  // Estos botones ahora también regeneran siempre el mensaje
  if (confirmInfoBtn) {
    confirmInfoBtn.addEventListener("click", () => {
      updateOrderTextIfEmpty(true);
      validateForm();
    });
  }

  if (saveInfoBtn) {
    saveInfoBtn.addEventListener("click", () => {
      updateOrderTextIfEmpty(true);
      validateForm();
    });
  }

  if (sendWhatsappBtn) {
    sendWhatsappBtn.addEventListener("click", () => {
      sendOrder();
    });
  }

  // ---- Cerrar sesión al cerrar la página ----
  window.addEventListener("beforeunload", () => {
    localStorage.removeItem("burgerUser");
    userData = null;
    isUserLoggedIn = false;
    if (noUserWarning) noUserWarning.classList.remove("hidden");
  });

  // ---- init ----
  async function init() {
    loadCart();
    await loadUser();

    if (!cartItems.length) {
      if (orderText) {
        orderText.value =
          "No hay productos en el carrito.\nVuelve al menú y agrega productos antes de confirmar el pedido.";
      }
      if (pvMessage) {
        pvMessage.textContent =
          "No hay productos en el carrito. No se puede sugerir un punto de venta.";
      }
      if (sendWhatsappBtn) {
        sendWhatsappBtn.disabled = true;
      }
      return;
    }

    try {
      await ensurePuntosVentaLoaded();
    } catch (err) {
      console.error("[confirm.js] Error inicial cargando PV:", err);
      if (pvMessage) {
        pvMessage.textContent =
          "No se pudieron cargar los puntos de venta. Puedes intentar recargar la página.";
      }
    }

    if (isUserLoggedIn) {
      if (confirmInfoBtn) {
        confirmInfoBtn.classList.remove("hidden");
      }
      if (saveInfoBtn) {
        saveInfoBtn.classList.add("hidden");
      }
    } else {
      if (confirmInfoBtn) {
        confirmInfoBtn.classList.add("hidden");
      }
      if (saveInfoBtn) {
        saveInfoBtn.classList.remove("hidden");
      }
    }

    validateForm();
  }

  init();
});
