let stores = [];

let map;
let markersLayer;

// Inicializa el mapa
function initMap() {
  if (map) return;

  // Centro aproximado de Colombia
  map = L.map("map").setView([4.5, -74.1], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

// Dibuja marcadores según la lista filtrada
function updateMarkers(storeList) {
  if (!map || !markersLayer) return;

  markersLayer.clearLayers();
  const bounds = [];

  storeList.forEach((store) => {
    const lat = Number(store.Latitud);
    const lng = Number(store.Longitud);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const marker = L.marker([lat, lng]).bindPopup(
      `<strong>${store.Direccion}</strong><br>${store.Municipio} - ${store.Barrio}`
    );

    marker.addTo(markersLayer);
    bounds.push([lat, lng]);
  });

  if (bounds.length > 0) {
    const leafletBounds = L.latLngBounds(bounds);
    map.fitBounds(leafletBounds, { padding: [32, 32] });
  }
}

// Rellena un select de texto
function fillSelect(selectEl, placeholder, values) {
  selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  values.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

function loadStores() {
  fetch("/api/puntos-venta")
    .then((response) => response.json())
    .then((data) => {
      stores = data;

      initMap();
      updateMarkers(stores);

      const departmentSelect = document.getElementById("department-select");
      const municipalitySelect =
        document.getElementById("municipality-select");
      const barrioSelect = document.getElementById("barrio-select");

      // 1) Departamentos
      const departments = [...new Set(stores.map((s) => s.Departamento))].sort();
      fillSelect(departmentSelect, "Selecciona un departamento", departments);

      // Cambia Departamento
      departmentSelect.addEventListener("change", () => {
        const dep = departmentSelect.value;

        fillSelect(municipalitySelect, "Selecciona un municipio", []);
        fillSelect(barrioSelect, "Selecciona un barrio", []);

        let filtered = stores;
        if (dep) filtered = filtered.filter((s) => s.Departamento === dep);

        updateMarkers(filtered);

        if (!dep) return;

        const municipios = [...new Set(filtered.map((s) => s.Municipio))].sort();
        fillSelect(municipalitySelect, "Selecciona un municipio", municipios);
      });

      // Cambia Municipio
      municipalitySelect.addEventListener("change", () => {
        const dep = departmentSelect.value;
        const muni = municipalitySelect.value;

        fillSelect(barrioSelect, "Selecciona un barrio", []);

        let filtered = stores;
        if (dep) filtered = filtered.filter((s) => s.Departamento === dep);
        if (muni) filtered = filtered.filter((s) => s.Municipio === muni);

        updateMarkers(filtered);

        if (!muni) return;

        const barrios = [...new Set(filtered.map((s) => s.Barrio))].sort();
        fillSelect(barrioSelect, "Selecciona un barrio", barrios);
      });

      // Cambia Barrio
      barrioSelect.addEventListener("change", () => {
        const dep = departmentSelect.value;
        const muni = municipalitySelect.value;
        const barrio = barrioSelect.value;

        let filtered = stores;
        if (dep) filtered = filtered.filter((s) => s.Departamento === dep);
        if (muni) filtered = filtered.filter((s) => s.Municipio === muni);
        if (barrio) filtered = filtered.filter((s) => s.Barrio === barrio);

        updateMarkers(filtered);
      });
    })
    .catch((error) => {
      console.error("Error al obtener los puntos de venta:", error);
    });
}

function openGoogleMaps(location) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
  window.open(url, "_blank");
}

// Usa el barrio seleccionado para ir a Google Maps
function openGoogleMapsForSelectedBarrio() {
  const barrioSelect = document.getElementById("barrio-select");
  const barrio = barrioSelect.value;

  if (!barrio) {
    alert("Selecciona un barrio.");
    return;
  }

  // Por la constraint unique("Barrio") en la tabla, hay solo una fila por barrio
  const store = stores.find((s) => s.Barrio === barrio);
  if (!store) {
    alert("No se encontró la coordenada para ese barrio.");
    return;
  }

  openGoogleMaps({ lat: store.Latitud, lng: store.Longitud });
}

// Cuando el DOM esté listo, conectamos el botón y cargamos los datos
document.addEventListener("DOMContentLoaded", () => {
  const traceBtn = document.getElementById("trace-route");
  if (traceBtn) {
    traceBtn.addEventListener("click", openGoogleMapsForSelectedBarrio);
  }

  loadStores();
});
