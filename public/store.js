// /public/store.js
document.addEventListener("DOMContentLoaded", () => {
  // =========================
  // Config
  // =========================
  const PLACEHOLDER_BG = "bg-black/50"; // cuadro negro si no hay imagen
  const DEFAULT_SCHEDULE = "3:00pm – 11:00pm";
  const MALL_SCHEDULE = "9:00am – 9:00pm";

  // Centro “fácil de leer”
  const DEFAULT_CENTER = [6.2442, -75.5812]; // Medellín
  const DEFAULT_ZOOM = 12;

  const ENDPOINTS = ["/api/stores", "/api/puntos-venta", "/api/stores-data"];

  // =========================
  // DOM
  // =========================
  const searchInput = document.getElementById("store-search");
  const deptSelect = document.getElementById("department-select");
  const muniSelect = document.getElementById("municipality-select");
  const barrioSelect = document.getElementById("barrio-select");

  const listEl = document.getElementById("stores-list");
  const emptyEl = document.getElementById("stores-empty");
  const countEl = document.getElementById("stores-count");
  const clearBtn = document.getElementById("clear-filters");

  // header carrito (si existe)
  const cartIcon = document.getElementById("cart-icon");
  const cartCountBadge = document.getElementById("cart-count-badge");

  // map
  const mapEl = document.getElementById("map");

  // =========================
  // State
  // =========================
  let stores = [];
  let map = null;
  let markersLayer = null;
  let activeId = null;

  // =========================
  // Helpers
  // =========================
  function safeText(v) {
    return (v ?? "").toString().trim();
  }

  function norm(s) {
    return safeText(s).toLowerCase();
  }

  function isMall(store) {
    const haystack = [
      store.nombre,
      store.Nombre,
      store.Sede,
      store.Direccion,
      store.Barrio,
    ]
      .map(norm)
      .join(" ");

    return (
      haystack.includes("centro comercial") ||
      haystack.includes("c.c") ||
      haystack.includes(" cc ") ||
      haystack.includes("mall") ||
      haystack.includes("plaza") ||
      haystack.includes("multiplaza") ||
      haystack.includes("unicentro") ||
      haystack.includes("viva") ||
      haystack.includes("arkadia") ||
      haystack.includes("premium plaza")
    );
  }

  function getSchedule(store) {
    return isMall(store) ? MALL_SCHEDULE : DEFAULT_SCHEDULE;
  }

  function getName(store) {
    return (
      safeText(store.nombre) ||
      safeText(store.Nombre) ||
      safeText(store.Sede) ||
      safeText(store.PuntoVenta) ||
      (safeText(store.Barrio) ? safeText(store.Barrio) : "Punto de venta")
    );
  }

  function getAddress(store) {
    return (
      safeText(store.Direccion) ||
      safeText(store.direccion) ||
      safeText(store.address) ||
      "Dirección no disponible"
    );
  }

  function getPhone(store) {
    return (
      safeText(store.num_whatsapp) ||
      safeText(store.whatsapp) ||
      safeText(store.celular) ||
      safeText(store.phone) ||
      ""
    );
  }

  function getImage(store) {
    return (
      safeText(store.URL_image) ||
      safeText(store.url_image) ||
      safeText(store.imagen) ||
      safeText(store.image) ||
      ""
    );
  }

  function getLatLng(store) {
    const lat = Number(store.Latitud ?? store.lat ?? store.latitude);
    const lng = Number(store.Longitud ?? store.lng ?? store.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  }

  function mapsLink(store) {
    const ll = getLatLng(store);
    if (ll) return `https://www.google.com/maps?q=${ll[0]},${ll[1]}`;
    const addr = encodeURIComponent(getAddress(store));
    return `https://www.google.com/maps?q=${addr}`;
  }

  // Normaliza "id" si no existe (para que activeId funcione)
  function ensureIds(list) {
    return list.map((s, idx) => {
      const id = s.id ?? s.ID ?? s.store_id ?? s.StoreId ?? null;
      if (id !== null && id !== undefined && safeText(id) !== "") {
        return { ...s, id };
      }
      return { ...s, id: `store_${idx + 1}` };
    });
  }

  // =========================
  // Cart count (opcional)
  // =========================
  function updateCartCount() {
    try {
      let raw = localStorage.getItem("burgerCart");
      if (!raw) raw = localStorage.getItem("cart");
      const parsed = raw ? JSON.parse(raw) : [];
      const total = Array.isArray(parsed)
        ? parsed.reduce((acc, it) => {
            const q = Number(it?.quantity ?? it?.cantidad ?? 1);
            return acc + (Number.isFinite(q) && q > 0 ? q : 1);
          }, 0)
        : 0;

      if (cartCountBadge) cartCountBadge.textContent = String(total || 0);
    } catch {
      if (cartCountBadge) cartCountBadge.textContent = "0";
    }
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

  // =========================
  // Fetch stores (fallback endpoints)
  // =========================
  async function fetchFirstOk(urls) {
    for (const url of urls) {
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) continue;

        const data = await res.json();
        if (Array.isArray(data)) return { url, data };

        // algunos backends devuelven { data: [...] }
        if (data && Array.isArray(data.data)) return { url, data: data.data };
      } catch {
        // sigue intentando
      }
    }
    return { url: null, data: [] };
  }

  function getStoresFallbackFromWindow() {
    // Si en algún momento decides inyectar las sedes en el HTML:
    // <script>window.STORES_DATA = [...]</script>
    const d = window.STORES_DATA;
    return Array.isArray(d) ? d : [];
  }

  // =========================
  // Filters setup
  // =========================
  function uniqSorted(arr) {
    return Array.from(new Set(arr.filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "es")
    );
  }

  function setOptions(select, values, placeholder = "Todos") {
    if (!select) return;
    const current = select.value;

    select.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder;
    select.appendChild(opt0);

    values.forEach((v) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      select.appendChild(o);
    });

    if (current && values.includes(current)) select.value = current;
  }

  function buildFilterOptions() {
    const depts = uniqSorted(stores.map((s) => safeText(s.Departamento)));
    setOptions(deptSelect, depts, "Todos");

    const dept = safeText(deptSelect?.value);
    const baseForMuni = dept
      ? stores.filter((s) => safeText(s.Departamento) === dept)
      : stores;

    const munis = uniqSorted(baseForMuni.map((s) => safeText(s.Municipio)));
    setOptions(muniSelect, munis, "Todos");

    const muni = safeText(muniSelect?.value);
    const baseForBarrio =
      dept && muni
        ? stores.filter(
            (s) =>
              safeText(s.Departamento) === dept &&
              safeText(s.Municipio) === muni
          )
        : dept
        ? stores.filter((s) => safeText(s.Departamento) === dept)
        : muni
        ? stores.filter((s) => safeText(s.Municipio) === muni)
        : stores;

    const barrios = uniqSorted(baseForBarrio.map((s) => safeText(s.Barrio)));
    setOptions(barrioSelect, barrios, "Todos");
  }

  function getFiltered() {
    const q = norm(searchInput?.value);
    const dept = safeText(deptSelect?.value);
    const muni = safeText(muniSelect?.value);
    const barrio = safeText(barrioSelect?.value);

    return stores.filter((s) => {
      if (dept && safeText(s.Departamento) !== dept) return false;
      if (muni && safeText(s.Municipio) !== muni) return false;
      if (barrio && safeText(s.Barrio) !== barrio) return false;

      if (!q) return true;

      const hay = [
        getName(s),
        getAddress(s),
        safeText(s.Barrio),
        safeText(s.Municipio),
        safeText(s.Departamento),
      ]
        .map(norm)
        .join(" ");

      return hay.includes(q);
    });
  }

  // =========================
  // Map
  // =========================
  function initMap() {
    if (!mapEl || typeof L === "undefined") return;

    map = L.map(mapEl, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    // ✅ Tiles blancos (OSM claro)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);

    // ✅ Fix responsive (Leaflet necesita recalcular tamaño)
    setTimeout(() => map.invalidateSize(), 60);
    window.addEventListener("resize", () => {
      if (!map) return;
      setTimeout(() => map.invalidateSize(), 60);
    });
  }

  function renderMarkers(filtered) {
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    const bounds = [];

    filtered.forEach((s) => {
      const ll = getLatLng(s);
      if (!ll) return;

      bounds.push(ll);

      const name = getName(s);
      const addr = getAddress(s);

      // 🔻 Si NO quieres horario/telefono ni en el popup del mapa, borra estas 2 líneas
      const schedule = getSchedule(s);
      const phone = getPhone(s);

      const popup = `
        <div style="min-width:220px">
          <div style="font-weight:800;margin-bottom:4px">${name}</div>
          <div style="font-size:12px;opacity:.85">${addr}</div>

          <!-- Si quieres quitar estos campos también del popup, elimina este bloque -->
          <div style="font-size:12px;opacity:.85;margin-top:6px"><b>Horario:</b> ${schedule}</div>
          ${
            phone
              ? `<div style="font-size:12px;opacity:.85;margin-top:4px"><b>Cel:</b> ${phone}</div>`
              : ""
          }

          <div style="margin-top:8px">
            <a href="${mapsLink(s)}" target="_blank" rel="noopener"
               style="font-weight:800;color:#ec1313;text-decoration:none">
              Ver en Google Maps
            </a>
          </div>
        </div>
      `;

      const marker = L.marker(ll).bindPopup(popup);
      marker.on("click", () => {
        activeId = s.id ?? null;
        highlightActiveCard();
      });

      markersLayer.addLayer(marker);
    });

    // ✅ Si hay marcadores, encuadra. Si no, vuelve al centro por defecto.
    if (bounds.length) {
      const b = L.latLngBounds(bounds);
      map.fitBounds(b.pad(0.18));
    } else {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
  }

  function flyToStore(store) {
    if (!map) return;
    const ll = getLatLng(store);
    if (!ll) return;
    map.flyTo(ll, 15, { duration: 0.8 });
  }

  // =========================
  // UI list
  // =========================
  function cardHTML(store) {
    const name = getName(store);
    const addr = getAddress(store);
    const img = getImage(store);

    const isActive = (store.id ?? null) === activeId;

    const imgBlock = img
      ? `
        <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-black/40">
          <img src="${img}" alt="${name}" class="w-full h-full object-cover" loading="lazy"
               onerror="this.remove(); this.parentElement.classList.add('${PLACEHOLDER_BG}')" />
        </div>
      `
      : `
        <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border border-white/10 shrink-0 ${PLACEHOLDER_BG}"></div>
      `;

    // ✅ Como pediste: SIN botón de llamar, SIN horario/cel en la card
    return `
      <div
        class="store-card flex flex-col gap-3 rounded-2xl bg-surface-dark p-4 border border-border-dark shadow-[0_10px_30px_rgba(0,0,0,0.35)]
               hover:border-primary/50 transition-colors cursor-pointer ${
                 isActive ? "ring-1 ring-primary/60" : ""
               }"
        data-store-id="${store.id ?? ""}"
      >
        <div class="flex gap-4">
          ${imgBlock}

          <div class="flex-1 min-w-0">
            <h3 class="text-white font-extrabold text-base sm:text-lg leading-tight truncate">
              ${name}
            </h3>

            <p class="text-white/60 text-sm font-semibold truncate mt-1">
              ${addr}
            </p>
          </div>
        </div>

        <div class="flex gap-3">
          <a
            href="${mapsLink(store)}"
            target="_blank"
            rel="noopener"
            class="flex-1 inline-flex items-center justify-center rounded-full h-10 bg-primary hover:bg-red-700 text-white text-sm font-extrabold transition-colors gap-2"
          >
            <span class="material-symbols-outlined text-[18px]">navigation</span>
            Cómo llegar
          </a>
        </div>
      </div>
    `;
  }

  function highlightActiveCard() {
    if (!listEl) return;
    const cards = listEl.querySelectorAll(".store-card");
    cards.forEach((c) => c.classList.remove("ring-1", "ring-primary/60"));
    if (!activeId) return;

    const active = listEl.querySelector(
      `.store-card[data-store-id="${activeId}"]`
    );
    if (active) {
      active.classList.add("ring-1", "ring-primary/60");
      active.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function renderList(filtered) {
    if (!listEl || !emptyEl || !countEl) return;

    countEl.textContent = `${filtered.length} sede${
      filtered.length === 1 ? "" : "s"
    }`;

    if (!filtered.length) {
      emptyEl.classList.remove("hidden");
      listEl.innerHTML = "";
      return;
    }

    emptyEl.classList.add("hidden");
    listEl.innerHTML = filtered.map(cardHTML).join("");

    listEl.querySelectorAll(".store-card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-store-id");
        const store = stores.find((s) => String(s.id) === String(id));
        if (!store) return;
        activeId = store.id ?? null;
        highlightActiveCard();
        flyToStore(store);
      });
    });
  }

  function renderAll() {
    const filtered = getFiltered();
    renderList(filtered);
    renderMarkers(filtered);
  }

  // =========================
  // Events
  // =========================
  searchInput?.addEventListener("input", () => renderAll());

  deptSelect?.addEventListener("change", () => {
    buildFilterOptions();
    renderAll();
  });

  muniSelect?.addEventListener("change", () => {
    buildFilterOptions();
    renderAll();
  });

  barrioSelect?.addEventListener("change", () => renderAll());

  clearBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (deptSelect) deptSelect.value = "";
    if (muniSelect) muniSelect.value = "";
    if (barrioSelect) barrioSelect.value = "";
    buildFilterOptions();
    renderAll();
  });

  // =========================
  // Init
  // =========================
  async function init() {
    updateCartCount();
    initMap();

    const { url, data } = await fetchFirstOk(ENDPOINTS);

    // ✅ Si API falla, intenta fallback del window
    const fallback = getStoresFallbackFromWindow();
    const rawStores = Array.isArray(data) && data.length ? data : fallback;

    stores = ensureIds(Array.isArray(rawStores) ? rawStores : []);

    if (!stores.length) {
      console.warn("[store.js] No se cargaron sedes. Endpoint probado:", url);
    }

    // ✅ Mostrar TODO por defecto
    buildFilterOptions();
    renderAll();

    // ✅ Leaflet resize fix (para que no quede chiquito)
    if (map) setTimeout(() => map.invalidateSize(), 120);
  }

  init().catch((err) => {
    console.error("[store.js] init error:", err);
    stores = [];
    buildFilterOptions();
    renderAll();
    if (map) map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  });

  window.addEventListener("storage", (e) => {
    if (e.key === "burgerCart" || e.key === "cart") updateCartCount();
  });
});
