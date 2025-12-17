document.addEventListener("DOMContentLoaded", () => {
  const ZONA_PRECIO = "PrecioOriente"; // zona de precios que estás usando

  // =============================
  // LOADER DE LA PÁGINA
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
  // HEADER: usuario / carrito
  // (estos selectores no siempre matchean aquí, pero son seguros)
  // =============================
  const userButton = document.querySelector(
    "header .flex.flex-1.items-center.justify-start .icon-button"
  );
  const rightButtons = document.querySelectorAll(
    "header .flex.flex-1.items-center.justify-end .icon-button"
  );
  const cartButton = rightButtons[0] || null;

  if (userButton) {
    userButton.addEventListener("click", () => {
      window.location.href = "/login";
    });
  }

  if (cartButton) {
    cartButton.addEventListener("click", () => {
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
        alert(
          "Hubo un problema leyendo tu carrito. Intenta agregar un producto de nuevo."
        );
      }
    });
  }

  // =============================
  // Helpers
  // =============================
  function parseQuery() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    return {
      id: id ? Number(id) : null,
    };
  }

  function formatPrice(value) {
    const n = Number(value || 0);
    return `$${n.toLocaleString("es-CO")}`;
  }

  // =============================
  // Elementos del DOM
  // =============================
  const backButton = document.getElementById("back-button");

  const productImage = document.getElementById("product-image");
  const productNameEl = document.getElementById("product-name");
  const productDescriptionEl = document.getElementById("product-description");
  const productBasePriceEl = document.getElementById("product-base-price");

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

  const imageModal = document.getElementById("image-modal");
  const modalImage = document.getElementById("modal-image");
  const closeModalBtn = document.getElementById("close-modal");
  const modalBackdrop = document.getElementById("modal-backdrop");

  // =============================
  // Estado
  // =============================
  let product = null;
  let extras = [];
  let quantity = 1;

  // =============================
  // Navegación back
  // =============================
  if (backButton) {
    backButton.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "/";
      }
    });
  }

  // =============================
  // Fetch data
  // =============================
  async function fetchProduct(id) {
    const res = await fetch(`/api/menu/item/${id}`);
    if (!res.ok) {
      throw new Error("No se pudo cargar el producto");
    }
    return await res.json();
  }

  async function fetchExtras() {
    const res = await fetch("/api/menu?tipo=2");
    if (!res.ok) {
      console.error("No se pudieron cargar adiciones");
      return [];
    }
    return await res.json();
  }

  // =============================
  // Render producto
  // =============================
  function renderProduct() {
    if (!product) return;

    const priceBase = product[ZONA_PRECIO] || 0;

    if (productImage) {
      productImage.style.backgroundImage = product.imagen
        ? `url('${product.imagen}')`
        : "";
    }
    if (productNameEl) {
      productNameEl.textContent = product.Nombre;
    }
    if (productDescriptionEl) {
      productDescriptionEl.textContent = product.Descripcion;
    }
    if (productBasePriceEl) {
      productBasePriceEl.textContent = `Precio base: ${formatPrice(priceBase)}`;
    }

    // 1 = hamburguesa, 3 = combo → tienen adiciones / modificar / término
    // 4 = papas, 6 = bebidas → NO adiciones, NO modificar, NO término
    const esHamburguesaOCombo = product.tipo === 1 || product.tipo === 3;

    if (!esHamburguesaOCombo) {
      if (extrasPanel && extrasPanel.parentElement) {
        extrasPanel.parentElement.classList.add("hidden");
      }
      if (modifySection) modifySection.classList.add("hidden");
      if (cookingSection) cookingSection.classList.add("hidden");
    }
  }

  // =============================
  // Render adiciones
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

    if (extrasEmpty) {
      extrasEmpty.classList.add("hidden");
    }

    extras.forEach((extra) => {
      const price = extra[ZONA_PRECIO] || 0;

      const row = document.createElement("div");
      row.className = "flex items-center justify-between";

      const id = `extra-${extra.id}`;

      row.innerHTML = `
        <label class="flex items-center space-x-3 flex-1 cursor-pointer" for="${id}">
          <input
            id="${id}"
            type="checkbox"
            data-extra-id="${extra.id}"
            data-extra-price="${price}"
            class="h-5 w-5 rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary bg-transparent dark:bg-transparent"
          />
          <span class="text-base text-text-light-primary dark:text-text-dark-primary">${
            extra.Nombre
          }</span>
        </label>
        <span class="text-base font-medium text-text-light-secondary dark:text-text-dark-secondary">
          +${formatPrice(price)}
        </span>
      `;

      extrasContainer.appendChild(row);
    });
  }

  // =============================
  // Precio total dinámico
  // =============================
  function getSelectedExtrasTotal() {
    if (!extrasContainer) return 0;
    const inputs = extrasContainer.querySelectorAll('input[type="checkbox"]');
    let total = 0;
    inputs.forEach((input) => {
      if (input.checked) {
        const price = Number(input.dataset.extraPrice || 0);
        total += price;
      }
    });
    return total;
  }

  function updateTotals() {
    if (!product) return;

    const basePrice = Number(product[ZONA_PRECIO] || 0);
    const extrasTotal = getSelectedExtrasTotal();

    const unitTotal = basePrice + extrasTotal;
    const grandTotal = unitTotal * quantity;

    if (addToCartLabel) {
      addToCartLabel.textContent = `Agregar al carrito - ${formatPrice(
        grandTotal
      )}`;
    }

    if (addToCartSub) {
      if (extrasTotal > 0) {
        addToCartSub.textContent = `Base: ${formatPrice(
          basePrice
        )} + adiciones: ${formatPrice(extrasTotal)} x ${quantity}`;
      } else {
        addToCartSub.textContent =
          quantity > 1
            ? `Unitario: ${formatPrice(basePrice)} x ${quantity}`
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
    if (qtyValue) {
      qtyValue.textContent = String(quantity);
    }
    updateTotals();
  }

  if (qtyDecrease) {
    qtyDecrease.addEventListener("click", () => {
      setQuantity(quantity - 1);
    });
  }

  if (qtyIncrease) {
    qtyIncrease.addEventListener("click", () => {
      setQuantity(quantity + 1);
    });
  }

  // =============================
  // Acordeones
  // =============================
  document.querySelectorAll(".accordion-header").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetSelector = btn.getAttribute("data-target");
      if (!targetSelector) return;
      const panel = document.querySelector(targetSelector);
      if (!panel) return;

      panel.classList.toggle("hidden");

      const arrow = btn.querySelector(".material-symbols-outlined");
      if (arrow) {
        arrow.classList.toggle("rotate-180");
      }
    });
  });

  document.querySelectorAll(".accordion-panel").forEach((panel) => {
    panel.classList.remove("hidden");
  });

  // =============================
  // Helpers de personalización
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
      if (input && input.checked) {
        mods.push(label);
      }
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
  if (addToCartBtn) {
    addToCartBtn.addEventListener("click", () => {
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
          if (Array.isArray(parsed)) {
            cart = parsed;
          }
        }
        cart.push(lineItem);
        localStorage.setItem("burgerCart", JSON.stringify(cart));

        // ir al carrito
        window.location.href = "/cart";
      } catch (err) {
        console.error("[product.js] Error guardando en carrito:", err);
        alert(
          "Hubo un problema guardando el producto en el carrito. Intenta de nuevo."
        );
      }
    });
  }

  // =============================
  // Modal de imagen
  // =============================
  function openModal(url, alt) {
    if (!imageModal || !modalImage) return;
    modalImage.src = url;
    modalImage.alt = alt || "";
    imageModal.classList.remove("hidden");
  }

  function closeModal() {
    if (!imageModal || !modalImage) return;
    imageModal.classList.add("hidden");
    modalImage.src = "";
    modalImage.alt = "";
    modalImage.classList.remove("zoomed");
  }

  if (productImage) {
    productImage.addEventListener("click", () => {
      const url = productImage.style.backgroundImage.slice(5, -2);
      const alt = productImage.getAttribute("data-alt");
      openModal(url, alt);
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => {
      closeModal();
    });
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", () => {
      closeModal();
    });
  }

  modalImage?.addEventListener("click", () => {
    modalImage.classList.toggle("zoomed");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  });

  // =============================
  // init
  // =============================
  async function init() {
    showLoader();

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

      if (extrasContainer) {
        extrasContainer.addEventListener("change", onExtrasChange);
      }

      setQuantity(1);
    } catch (err) {
      console.error("[product.js] Error inicializando detalle:", err);
      alert("No se pudo cargar el producto, intenta de nuevo.");
      window.location.href = "/";
    } finally {
      // aquí ya está todo renderizado y las secciones ocultas si toca
      hideLoader();
    }
  }

  init();
});
