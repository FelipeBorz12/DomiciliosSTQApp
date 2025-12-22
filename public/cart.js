// public/cart.js
document.addEventListener("DOMContentLoaded", () => {
  const DELIVERY_FEE = 5000;

  // ----- DOM -----
  const backButton = document.getElementById("cart-back-button");

  const cartEmptyMessage = document.getElementById("cart-empty-message");
  const cartGrid = document.getElementById("cart-grid");
  const cartItemsContainer = document.getElementById("cart-items");
  const addMoreItemsBtn = document.getElementById("add-more-items-btn");

  const cartCountLabel = document.getElementById("cart-count-label");
  const cartBadgeDesktop = document.getElementById("cart-badge-desktop");
  const cartBadgeMobile = document.getElementById("cart-badge-mobile");

  const orderSummarySection = document.getElementById("order-summary");
  const summarySubtotal = document.getElementById("summary-subtotal");
  const summaryDelivery = document.getElementById("summary-delivery");
  const summaryTotal = document.getElementById("summary-total");

  // Radios ocultos
  const shippingDelivery = document.getElementById("shipping-delivery");
  const shippingPickup = document.getElementById("shipping-pickup");

  // Botones visuales toggle
  const shippingToggleDelivery = document.getElementById(
    "shipping-toggle-delivery"
  );
  const shippingTogglePickup = document.getElementById(
    "shipping-toggle-pickup"
  );

  const checkoutButton = document.getElementById("checkout-button");

  // Modal eliminar
  const deleteModal = document.getElementById("delete-modal");
  const deleteCancelBtn = document.getElementById("delete-cancel");
  const deleteConfirmBtn = document.getElementById("delete-confirm");

  // ----- Estado -----
  let cartItems = [];
  let deleteIndex = null;

  // ----- Helpers -----
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
      cartItems = Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("[cart.js] Error leyendo burgerCart:", err);
      cartItems = [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem("burgerCart", JSON.stringify(cartItems));
    } catch (err) {
      console.error("[cart.js] Error guardando burgerCart:", err);
    }
  }

  function getUnitPrice(item) {
    const total = Number(item.total || 0);
    const qty = Number(item.quantity || 1) || 1;
    return total / qty;
  }

  function computeSubtotal() {
    return cartItems.reduce((acc, item) => acc + Number(item.total || 0), 0);
  }

  function isDeliverySelected() {
    return shippingDelivery && shippingDelivery.checked;
  }

  function updateSummary() {
    if (!summarySubtotal || !summaryDelivery || !summaryTotal) return;

    const subtotal = computeSubtotal();
    const delivery =
      isDeliverySelected() && cartItems.length > 0 ? DELIVERY_FEE : 0;
    const total = subtotal + delivery;

    summarySubtotal.textContent = formatPrice(subtotal);
    summaryDelivery.textContent = formatPrice(delivery);
    summaryTotal.textContent = formatPrice(total);
  }

  function updateCheckoutButtonState() {
    if (!checkoutButton) return;
    const hasItems = cartItems && cartItems.length > 0;
    checkoutButton.disabled = !hasItems;
  }

  function syncBadges() {
    const count = cartItems.reduce((acc, it) => acc + Number(it.quantity || 1), 0);
    const labelCount = cartItems.length;

    if (cartCountLabel) cartCountLabel.textContent = `(${labelCount} productos)`;
    if (cartBadgeDesktop) cartBadgeDesktop.textContent = String(count);
    if (cartBadgeMobile) cartBadgeMobile.textContent = String(count);
  }

  function showEmptyState() {
    cartEmptyMessage?.classList.remove("hidden");
    cartGrid?.classList.add("hidden");
    orderSummarySection?.classList.add("hidden");
    updateCheckoutButtonState();
    syncBadges();
  }

  function hideEmptyState() {
    cartEmptyMessage?.classList.add("hidden");
    cartGrid?.classList.remove("hidden");
    orderSummarySection?.classList.remove("hidden");
    updateCheckoutButtonState();
    syncBadges();
  }

  function openDeleteModal(index) {
    deleteIndex = index;
    if (!deleteModal) return;
    deleteModal.classList.remove("hidden");
    deleteModal.classList.add("flex");
  }

  function closeDeleteModal() {
    deleteIndex = null;
    if (!deleteModal) return;
    deleteModal.classList.add("hidden");
    deleteModal.classList.remove("flex");
  }

  function handleQtyMinus(index) {
    const item = cartItems[index];
    if (!item) return;

    const qty = Number(item.quantity || 1);

    if (qty > 1) {
      const newQty = qty - 1;
      const unitPrice = getUnitPrice(item);
      item.quantity = newQty;
      item.total = unitPrice * newQty;

      saveCart();
      renderCart();
    } else {
      openDeleteModal(index);
    }
  }

  function handleQtyPlus(index) {
    const item = cartItems[index];
    if (!item) return;

    const qty = Number(item.quantity || 1);
    const newQty = qty + 1;
    const unitPrice = getUnitPrice(item);

    item.quantity = newQty;
    item.total = unitPrice * newQty;

    saveCart();
    renderCart();
  }

  function deleteItemConfirmed() {
    if (deleteIndex === null || deleteIndex === undefined) return;

    cartItems.splice(deleteIndex, 1);
    saveCart();
    closeDeleteModal();
    renderCart();
  }

  function cookingLabel(value) {
    if (value === "medio") return "Medio hecha";
    if (value === "bien_cocida") return "Bien cocida";
    return "Normal";
  }

  function buildDetailsLine(item) {
    const parts = [];

    // Para hamburguesas/combos
    if (item.tipo === 1 || item.tipo === 3) {
      parts.push(`Término: ${cookingLabel(item.cooking)}`);
    }

    // Modificaciones
    if (Array.isArray(item.modifications) && item.modifications.length) {
      parts.push(item.modifications.join(", "));
    }

    // Adiciones (con nombre y precio)
    if (Array.isArray(item.extras) && item.extras.length) {
      const exText = item.extras
        .map((ex) => {
          const n = ex?.nombre || "";
          const p = Number(ex?.precio || 0);
          return n ? `${n} (${formatPrice(p)})` : "";
        })
        .filter(Boolean)
        .join(", ");
      if (exText) parts.push(`Adiciones: ${exText}`);
    }

    return parts.join(" · ");
  }

  function renderCart() {
    if (!cartItemsContainer) return;

    cartItemsContainer.innerHTML = "";

    if (!cartItems || cartItems.length === 0) {
      showEmptyState();
      return;
    }

    hideEmptyState();

    cartItems.forEach((item, index) => {
      const qty = Number(item.quantity || 1);
      const lineTotal = Number(item.total || 0);
      const details = buildDetailsLine(item);

      const card = document.createElement("article");
      card.className =
        "group bg-surface-dark hover:bg-surface-dark-hover p-4 rounded-2xl flex flex-col gap-4 transition-all duration-300 border border-transparent hover:border-primary/20 relative overflow-hidden";

      card.innerHTML = `
        <div class="flex justify-between items-start w-full gap-3">
          <div class="min-w-0">
            <h3 class="text-xl font-bold text-white truncate">
              ${item.nombre || "Producto"}
            </h3>

            ${
              details
                ? `<p class="text-gray-400 text-sm mt-1 leading-relaxed">${details}</p>`
                : `<p class="text-gray-500 text-sm mt-1">Sin personalizaciones</p>`
            }
          </div>

          <button
            class="delete-item-btn text-gray-500 hover:text-red-500 transition-colors p-2 hover:bg-white/5 rounded-full z-10"
            data-index="${index}"
            aria-label="Eliminar"
            type="button"
          >
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>

        <div class="flex justify-between items-end">
          <p class="text-xl font-bold text-primary">${formatPrice(lineTotal)}</p>

          <div class="flex items-center bg-background-dark rounded-full p-1 border border-[#382929]">
            <button
              class="qty-minus-btn size-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-white"
              data-index="${index}"
              aria-label="Restar"
              type="button"
            >
              <span class="material-symbols-outlined text-[16px]">remove</span>
            </button>

            <span class="w-8 text-center font-bold text-sm text-white">${qty}</span>

            <button
              class="qty-plus-btn size-8 rounded-full flex items-center justify-center bg-white text-black hover:bg-gray-200 transition-colors shadow-lg"
              data-index="${index}"
              aria-label="Sumar"
              type="button"
            >
              <span class="material-symbols-outlined text-[16px]">add</span>
            </button>
          </div>
        </div>
      `;

      cartItemsContainer.appendChild(card);
    });

    // Eventos eliminar
    cartItemsContainer.querySelectorAll(".delete-item-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const index = Number(e.currentTarget.getAttribute("data-index"));
        if (Number.isNaN(index)) return;
        openDeleteModal(index);
      });
    });

    // Eventos qty -
    cartItemsContainer.querySelectorAll(".qty-minus-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const index = Number(e.currentTarget.getAttribute("data-index"));
        if (Number.isNaN(index)) return;
        handleQtyMinus(index);
      });
    });

    // Eventos qty +
    cartItemsContainer.querySelectorAll(".qty-plus-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const index = Number(e.currentTarget.getAttribute("data-index"));
        if (Number.isNaN(index)) return;
        handleQtyPlus(index);
      });
    });

    updateSummary();
    updateCheckoutButtonState();
    syncBadges();
  }

  // ----- Toggle shipping visual -----
  function setShipping(mode) {
    const isDelivery = mode === "delivery";

    if (shippingDelivery) shippingDelivery.checked = isDelivery;
    if (shippingPickup) shippingPickup.checked = !isDelivery;

    if (shippingToggleDelivery) {
      shippingToggleDelivery.className =
        "flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-xs shadow-md transition-all " +
        (isDelivery ? "bg-primary text-white" : "text-gray-400 hover:text-white hover:bg-white/5");
    }

    if (shippingTogglePickup) {
      shippingTogglePickup.className =
        "flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold text-xs shadow-md transition-all " +
        (!isDelivery ? "bg-primary text-white" : "text-gray-400 hover:text-white hover:bg-white/5");
    }

    updateSummary();
  }

  // ----- Eventos generales -----
  backButton?.addEventListener("click", () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/";
  });

  addMoreItemsBtn?.addEventListener("click", () => {
    window.location.href = "/";
  });

  shippingToggleDelivery?.addEventListener("click", () => setShipping("delivery"));
  shippingTogglePickup?.addEventListener("click", () => setShipping("pickup"));

  // Modal eliminar
  deleteCancelBtn?.addEventListener("click", () => closeDeleteModal());
  deleteConfirmBtn?.addEventListener("click", () => deleteItemConfirmed());

  // Checkout → /confirm
  checkoutButton?.addEventListener("click", () => {
    if (!cartItems || cartItems.length === 0) {
      alert("Tu carrito está vacío. Agrega productos antes de confirmar el pedido.");
      return;
    }
    window.location.href = "/confirm";
  });

  // init
  function init() {
    loadCart();
    setShipping("delivery");
    renderCart();
  }

  init();
});
