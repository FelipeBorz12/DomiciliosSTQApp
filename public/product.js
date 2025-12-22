document.addEventListener("DOMContentLoaded", () => {
  const ZONA_PRECIO = "PrecioOriente";

  // =============================
  // LOADER
  // =============================
  const pageLoader = document.getElementById("product-page-loader");

  function showLoader() {
    if (!pageLoader) return;
    pageLoader.style.display = "flex";
    pageLoader.classList.remove("opacity-0", "pointer-events-none");
  }

  function hideLoader() {
    if (!pageLoader) return;
    pageLoader.classList.add("opacity-0", "pointer-events-none");
    setTimeout(() => {
      pageLoader.style.display = "none";
    }, 300);
  }

  // =============================
  // Header carrito + contador
  // =============================
  const cartIcon = document.getElementById("cart-icon");
  const cartCount = document.getElementById("cart-count");
  const cartCountBadge = document.getElementById("cart-count-badge");

  function updateCartCount() {
    try {
      let raw = localStorage.getItem("burgerCart");
      if (!raw) raw = localStorage.getItem("cart");

      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) throw new Error("Carrito inválido");

      const totalItems = parsed.reduce((acc, item) => {
        const q = Number(item?.quantity ?? item?.cantidad ?? 1);
        if (!Number.isFinite(q) || q <= 0) return acc + 1;
        return acc + q;
      }, 0);

      if (cartCount) cartCount.textContent = String(totalItems);
      if (cartCountBadge) cartCountBadge.textContent = String(totalItems);
    } catch {
      if (cartCount) cartCount.textContent = "0";
      if (cartCountBadge) cartCountBadge.textContent = "0";
    }
  }

  cartIcon?.addEventListener("click", () => {
    try {
      const raw = localStorage.getItem("burgerCart");
      if (!raw) {
        alert("Tu carrito está vacío. Agrega un producto desde el menú.");
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        alert("Tu carrito está vacío. Agrega un producto desde el menú.");
        return;
      }
      window.location.href = "/cart";
    } catch (err) {
      console.error("[product.js] Error leyendo carrito:", err);
      alert("Hubo un problema leyendo tu carrito. Intenta de nuevo.");
    }
  });

  // =============================
  // Helpers
  // =============================
  function parseQuery() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    return { id: id ? Number(id) : null };
  }

  function formatPrice(value) {
    const n = Number(value || 0);
    return `$${n.toLocaleString("es-CO")}`;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // =============================
  // DOM
  // =============================
  const backButton = document.getElementById("back-button");

  const productImage = document.getElementById("product-image");
  const productNameEl = document.getElementById("product-name");
  const productDescriptionEl = document.getElementById("product-description");
  const productPriceEl = document.getElementById("product-price");

  const breadcrumbCategory = document.getElementById("breadcrumb-category");
  const breadcrumbProduct = document.getElementById("breadcrumb-product");
  const topline = document.getElementById("product-topline");

  const extrasContainer = document.getElementById("extras-container");
  const extrasEmpty = document.getElementById("extras-empty");
  const extrasPanel = document.getElementById("extras-panel");

  const modifySection = document.getElementById("modify-section");
  const cookingSection = document.getElementById("cooking-section");

  const qtyDecrease = document.getElementById("qty-decrease");
  const qtyIncrease = document.getElementById("qty-increase");
  const qtyValue = document.getElementById("qty-value");
  const addToCartBtn = document.getElementById("add-to-cart-btn");
  const addToCartLabel = document.getElementById("add-to-cart-label");
  const addToCartSub = document.getElementById("add-to-cart-sub");

  // Modal
  const imageModal = document.getElementById("image-modal");
  const modalImage = document.getElementById("modal-image");
  const closeModalBtn = document.getElementById("close-modal");
  const modalBackdrop = document.getElementById("modal-backdrop");

  // Related
  const relatedViewport = document.getElementById("related-viewport");
  const relatedPrev = document.getElementById("related-prev");
  const relatedNext = document.getElementById("related-next");

  // =============================
  // Estado
  // =============================
  let product = null;
  let extras = [];
  let quantity = 1;

  // =============================
  // Back
  // =============================
  backButton?.addEventListener("click", () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/";
  });

  // =============================
  // Fetch
  // =============================
  async function fetchProduct(id) {
    const res = await fetch(`/api/menu/item/${id}`);
    if (!res.ok) throw new Error("No se pudo cargar el producto");
    return await res.json();
  }

  async function fetchExtras() {
    const res = await fetch("/api/menu?tipo=2");
    if (!res.ok) return [];
    return await res.json();
  }

  async function fetchByTipo(tipo) {
    const res = await fetch(`/api/menu?tipo=${tipo}`);
    if (!res.ok) return [];
    return await res.json();
  }

  // =============================
  // Render producto
  // =============================
  function tipoToLabel(tipo) {
    switch (Number(tipo)) {
      case 1:
        return "Hamburguesas";
      case 3:
        return "Combos";
      case 4:
        return "Papas";
      case 6:
        return "Bebidas";
      default:
        return "Menú";
    }
  }

  function renderProduct() {
    if (!product) return;

    const priceBase = product[ZONA_PRECIO] || 0;

    // Imagen
    if (productImage) {
      productImage.style.backgroundImage = product.imagen
        ? `url('${product.imagen}')`
        : "";
    }

    // Textos
    if (productNameEl) productNameEl.textContent = product.Nombre || "Producto";
    if (productDescriptionEl)
      productDescriptionEl.textContent = product.Descripcion || "";
    if (productPriceEl) productPriceEl.textContent = formatPrice(priceBase);

    // Breadcrumb
    if (breadcrumbProduct)
      breadcrumbProduct.textContent = product.Nombre || "Producto";
    if (breadcrumbCategory)
      breadcrumbCategory.textContent = tipoToLabel(product.tipo);

    // Topline
    if (topline)
      topline.textContent = `Categoría: ${tipoToLabel(
        product.tipo
      )}`.toUpperCase();

    // 1 y 3 sí; 4 y 6 no
    const esHamburguesaOCombo = product.tipo === 1 || product.tipo === 3;

    if (!esHamburguesaOCombo) {
      if (extrasPanel && extrasPanel.parentElement)
        extrasPanel.parentElement.classList.add("hidden");
      if (modifySection) modifySection.classList.add("hidden");
      if (cookingSection) cookingSection.classList.add("hidden");
    }
  }

  // =============================
  // Render extras
  // =============================
  function renderExtras() {
    if (!extrasContainer) return;

    extrasContainer.innerHTML = "";

    if (!extras || extras.length === 0) {
      if (extrasEmpty) {
        extrasEmpty.textContent = "No hay adiciones disponibles.";
        extrasEmpty.classList.remove("hidden");
      }
      return;
    }

    extrasEmpty?.classList.add("hidden");

    extras.forEach((extra) => {
      const price = extra[ZONA_PRECIO] || 0;
      const id = `extra-${extra.id}`;

      const row = document.createElement("label");
      row.className =
        "flex items-center justify-between p-3 rounded-xl bg-background-dark/40 border border-white/5 hover:border-primary/50 cursor-pointer transition-colors";

      row.setAttribute("for", id);

      row.innerHTML = `
        <div class="flex items-center gap-3">
          <input
            id="${id}"
            type="checkbox"
            data-extra-id="${extra.id}"
            data-extra-price="${price}"
            class="rounded text-primary bg-surface-dark border-gray-600 focus:ring-primary focus:ring-offset-background-dark"
          />
          <span class="text-sm text-white/80 font-semibold">${
            extra.Nombre
          }</span>
        </div>
        <span class="text-sm font-extrabold text-primary">+${formatPrice(
          price
        )}</span>
      `;

      extrasContainer.appendChild(row);
    });
  }

  // =============================
  // Totales
  // =============================
  function getSelectedExtrasTotal() {
    if (!extrasContainer) return 0;
    const inputs = extrasContainer.querySelectorAll('input[type="checkbox"]');
    let total = 0;
    inputs.forEach((input) => {
      if (input.checked) total += Number(input.dataset.extraPrice || 0);
    });
    return total;
  }

  function updateTotals() {
    if (!product) return;

    const basePrice = Number(product[ZONA_PRECIO] || 0);
    const extrasTotal = getSelectedExtrasTotal();
    const unitTotal = basePrice + extrasTotal;
    const grandTotal = unitTotal * quantity;

    if (addToCartLabel)
      addToCartLabel.textContent = `Agregar al carrito - ${formatPrice(
        grandTotal
      )}`;

    if (addToCartSub) {
      if (extrasTotal > 0) {
        addToCartSub.textContent = `Base: ${formatPrice(
          basePrice
        )} + adiciones: ${formatPrice(extrasTotal)} × ${quantity}`;
      } else {
        addToCartSub.textContent =
          quantity > 1
            ? `Unitario: ${formatPrice(basePrice)} × ${quantity}`
            : `Unitario: ${formatPrice(basePrice)}`;
      }
    }
  }

  function onExtrasChange() {
    updateTotals();
  }

  // =============================
  // Cantidad
  // =============================
  function setQuantity(newQty) {
    const safe = Math.max(1, Math.min(99, newQty));
    quantity = safe;
    if (qtyValue) qtyValue.textContent = String(quantity);
    updateTotals();
  }

  qtyDecrease?.addEventListener("click", () => setQuantity(quantity - 1));
  qtyIncrease?.addEventListener("click", () => setQuantity(quantity + 1));

  // =============================
  // Acordeones (misma lógica)
  // =============================
  document.querySelectorAll(".accordion-header").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetSelector = btn.getAttribute("data-target");
      if (!targetSelector) return;
      const panel = document.querySelector(targetSelector);
      if (!panel) return;

      panel.classList.toggle("hidden");

      const arrow = btn.querySelector(".material-symbols-outlined");
      arrow?.classList.toggle("rotate-180");
    });
  });

  // Abiertos por defecto
  document.querySelectorAll(".accordion-panel").forEach((panel) => {
    panel.classList.remove("hidden");
  });

  // =============================
  // Personalización helpers
  // =============================
  function getCooking() {
    const selected = document.querySelector('input[name="cooking"]:checked');
    return selected ? selected.value : "normal";
  }

  function getModifications() {
    const mods = [];
    const mapping = [
      ["no-tomate", "Sin tomate"],
      ["no-pepinillos", "Sin pepinillos"],
      ["no-lechuga", "Sin lechuga"],
      ["no-queso-americano", "Sin queso americano"],
      ["no-salsa-ajo", "Sin salsa de ajo"],
      ["no-tocineta", "Sin tocineta"],
      ["no-salsa-pan", "Sin salsa de pan"],
      ["no-queso-cheddar", "Sin queso cheddar"],
    ];
    mapping.forEach(([id, label]) => {
      const input = document.getElementById(id);
      if (input?.checked) mods.push(label);
    });
    return mods;
  }

  function getSelectedExtras() {
    if (!extrasContainer) return [];
    const inputs = extrasContainer.querySelectorAll(
      'input[type="checkbox"]:checked'
    );
    const selected = [];
    inputs.forEach((input) => {
      const extraId = Number(input.dataset.extraId || 0);
      const extra = extras.find((e) => e.id === extraId);
      if (extra) {
        selected.push({
          id: extra.id,
          nombre: extra.Nombre,
          precio: extra[ZONA_PRECIO] || 0,
        });
      }
    });
    return selected;
  }

  // =============================
  // Agregar al carrito
  // =============================
  addToCartBtn?.addEventListener("click", () => {
    if (!product) {
      alert(
        "No se pudo identificar el producto. Vuelve al menú e inténtalo de nuevo."
      );
      window.location.href = "/";
      return;
    }

    try {
      const basePrice = Number(product[ZONA_PRECIO] || 0);
      const selectedExtras = getSelectedExtras();
      const modifications = getModifications();
      const cooking = getCooking();

      const extrasTotal = selectedExtras.reduce(
        (acc, ex) => acc + Number(ex.precio || 0),
        0
      );
      const unitTotal = basePrice + extrasTotal;
      const grandTotal = unitTotal * quantity;

      const lineItem = {
        productId: product.id,
        nombre: product.Nombre,
        tipo: product.tipo,
        basePrice,
        extras: selectedExtras,
        modifications,
        cooking,
        quantity,
        total: grandTotal,
      };

      let cart = [];
      const raw = localStorage.getItem("burgerCart");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) cart = parsed;
      }
      cart.push(lineItem);
      localStorage.setItem("burgerCart", JSON.stringify(cart));

      updateCartCount();
      window.location.href = "/cart";
    } catch (err) {
      console.error("[product.js] Error guardando en carrito:", err);
      alert(
        "Hubo un problema guardando el producto en el carrito. Intenta de nuevo."
      );
    }
  });

  // =============================
  // Modal imagen
  // =============================
  function openModal(url, alt) {
    if (!imageModal || !modalImage) return;
    modalImage.src = url;
    modalImage.alt = alt || "";
    imageModal.classList.remove("hidden");
    imageModal.classList.add("flex");
  }

  function closeModal() {
    if (!imageModal || !modalImage) return;
    imageModal.classList.add("hidden");
    imageModal.classList.remove("flex");
    modalImage.src = "";
    modalImage.alt = "";
  }

  productImage?.addEventListener("click", () => {
    const bg = productImage.style.backgroundImage || "";
    const url = bg.startsWith("url(") ? bg.slice(5, -2) : "";
    const alt = productImage.getAttribute("data-alt") || "";
    if (url) openModal(url, alt);
  });

  closeModalBtn?.addEventListener("click", closeModal);
  modalBackdrop?.addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // =============================
  // SUGERENCIAS
  // =============================
  function buildRelatedCard(item) {
    const price = item[ZONA_PRECIO] || 0;

    const card = document.createElement("div");
    card.className =
      "min-w-[220px] sm:min-w-[240px] bg-surface-dark rounded-2xl overflow-hidden group cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all border border-white/5";

    const img = item.imagen || "/img/placeholder-product.webp";

    card.innerHTML = `
      <div class="relative aspect-square overflow-hidden">
        <div class="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
             style="background-image:url('${img}')"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-70"></div>
        <button class="related-add absolute bottom-3 right-3 size-10 bg-primary rounded-full flex items-center justify-center text-white shadow-lg translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300"
                type="button" aria-label="Ver producto">
          <span class="material-symbols-outlined">arrow_forward</span>
        </button>
      </div>
      <div class="p-5">
        <h4 class="font-extrabold text-white text-lg mb-1 line-clamp-1">${
          item.Nombre || "Producto"
        }</h4>
        <p class="text-white/50 text-sm mb-3 line-clamp-1">${
          item.Descripcion || ""
        }</p>
        <span class="font-extrabold text-primary">${formatPrice(price)}</span>
      </div>
    `;

    const go = () => (window.location.href = `/product?id=${item.id}`);
    card.addEventListener("click", go);
    card.querySelector(".related-add")?.addEventListener("click", (e) => {
      e.stopPropagation();
      go();
    });

    return card;
  }

  function setupRelatedNav() {
    if (!relatedViewport) return;

    const canScroll =
      relatedViewport.scrollWidth > relatedViewport.clientWidth + 5;
    if (relatedPrev) relatedPrev.disabled = !canScroll;
    if (relatedNext) relatedNext.disabled = !canScroll;

    const updateDisabled = () => {
      const maxScroll =
        relatedViewport.scrollWidth - relatedViewport.clientWidth;
      const x = relatedViewport.scrollLeft;

      if (relatedPrev) relatedPrev.disabled = x <= 2;
      if (relatedNext) relatedNext.disabled = x >= maxScroll - 2;
    };

    relatedViewport.addEventListener("scroll", updateDisabled, {
      passive: true,
    });
    updateDisabled();

    relatedPrev?.addEventListener("click", () => {
      relatedViewport.scrollBy({ left: -420, behavior: "smooth" });
    });

    relatedNext?.addEventListener("click", () => {
      relatedViewport.scrollBy({ left: 420, behavior: "smooth" });
    });
  }

  async function loadRelated() {
    if (!product || !relatedViewport) return;

    // Si no hay tipo numérico, no mostramos nada
    const tipo = Number(product.tipo);
    if (!Number.isFinite(tipo)) return;

    try {
      const list = await fetchByTipo(tipo);
      const items = Array.isArray(list) ? list : [];

      const filtered = items.filter((x) => x?.id && x.id !== product.id);
      const picked = shuffle(filtered).slice(0, 10);

      relatedViewport.innerHTML = "";
      picked.forEach((it) => relatedViewport.appendChild(buildRelatedCard(it)));

      // Si quedó vacío, ocultamos el bloque
      if (picked.length === 0) {
        relatedViewport.parentElement?.classList?.add("hidden");
        return;
      }

      setupRelatedNav();
    } catch (err) {
      console.error("[related] Error:", err);
    }
  }

  // =============================
  // INIT
  // =============================
  async function init() {
    showLoader();
    updateCartCount();

    const { id } = parseQuery();
    if (!id || isNaN(id)) {
      alert("Producto inválido. Volviendo al inicio.");
      window.location.href = "/";
      return;
    }

    try {
      const [prod, extrasList] = await Promise.all([
        fetchProduct(id),
        fetchExtras(),
      ]);
      product = prod;
      extras = extrasList || [];

      renderProduct();
      renderExtras();

      extrasContainer?.addEventListener("change", onExtrasChange);

      setQuantity(1);
      await loadRelated();
    } catch (err) {
      console.error("[product.js] Error inicializando detalle:", err);
      alert("No se pudo cargar el producto, intenta de nuevo.");
      window.location.href = "/";
    } finally {
      hideLoader();
    }
  }

  init();

  window.addEventListener("storage", (e) => {
    if (e.key === "burgerCart" || e.key === "cart") updateCartCount();
  });
});
