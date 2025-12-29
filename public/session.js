// public/session.js
(function () {
  /* ================== HELPERS ================== */
  function safeParseJSON(raw, fallback) {
    try {
      const v = JSON.parse(raw);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  function getBurgerUser() {
    const raw = localStorage.getItem("burgerUser");
    if (!raw) return null;
    const u = safeParseJSON(raw, null);
    if (!u || typeof u !== "object") return null;
    if (!u.correo) return null;
    return u;
  }

  function isLoggedIn() {
    return !!getBurgerUser();
  }

  function getCartItems() {
    let raw = localStorage.getItem("burgerCart");
    if (!raw) raw = localStorage.getItem("cart");
    const items = safeParseJSON(raw, []);
    return Array.isArray(items) ? items : [];
  }

  function getCartCount(items) {
    // soporta [{qty}] o [{quantity}] o lista simple
    let total = 0;
    for (const it of items || []) {
      const q = Number(it?.qty ?? it?.quantity ?? 1);
      total += Number.isFinite(q) ? q : 1;
    }
    return total;
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = String(text ?? "");
  }

  function show(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("hidden");
  }

  function hide(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("hidden");
  }

  /* ================== UI: USER ================== */
  function paintUser() {
    const u = getBurgerUser();

    // header label
    const name =
      u?.perfil?.nombre ||
      u?.correo ||
      "";

    const headerName = document.getElementById("user-name-header");
    if (headerName) {
      headerName.textContent = u ? name : "";
      headerName.classList.toggle("hidden", !u);
    }

    // mobile menu items (si existen)
    const mobileLogin = document.getElementById("mobile-login-item");
    const mobileProfile = document.getElementById("mobile-profile-item");
    const mobileLogout = document.getElementById("mobile-logout-item");

    if (mobileLogin) mobileLogin.classList.toggle("hidden", !!u);
    if (mobileProfile) mobileProfile.classList.toggle("hidden", !u);
    if (mobileLogout) mobileLogout.classList.toggle("hidden", !u);
  }

  /* ================== UI: CART BADGE ================== */
  function paintCart() {
    const items = getCartItems();
    const count = getCartCount(items);

    setText("cart-count", count);
    setText("cart-count-badge", count);

    // compat en otras páginas
    setText("cart-badge-desktop", count);
    setText("cart-badge-mobile", count);
  }

  /* ================== NAV ACTIONS ================== */
  function wireUserIcon() {
    const btn = document.getElementById("user-icon");
    if (!btn) return;

    btn.addEventListener("click", () => {
      if (isLoggedIn()) {
        window.location.href = "/account.html";
      } else {
        window.location.href = "/login";
      }
    });

    // mobile "Mi perfil"
    const mobileProfileBtn = document.getElementById("mobile-profile-btn");
    mobileProfileBtn?.addEventListener("click", () => {
      if (isLoggedIn()) window.location.href = "/account.html";
      else window.location.href = "/login";
    });

    // mobile "Cerrar sesión" (si existe)
    const mobileLogoutBtn = document.getElementById("mobile-logout-btn");
    mobileLogoutBtn?.addEventListener("click", async () => {
      // si existe logoutUser (de auth.js), úsalo
      if (typeof window.logoutUser === "function") return window.logoutUser();
      // fallback
      try {
        localStorage.removeItem("burgerUser");
      } catch {}
      window.location.href = "/login";
    });
  }

  function wireCartIcon() {
    const btn = document.getElementById("cart-icon");
    if (!btn) return;

    btn.addEventListener("click", (e) => {
      e.preventDefault();

      const items = getCartItems();
      const count = getCartCount(items);

      if (!count) {
        // si existe modal de carrito vacío
        if (typeof window.openEmptyCartModal === "function") {
          window.openEmptyCartModal();
          return;
        }
        // fallback simple
        alert("Tu carrito está vacío.");
        return;
      }

      window.location.href = "/cart";
    });
  }

  /* ================== INIT ================== */
  function init() {
    paintUser();
    paintCart();
    wireUserIcon();
    wireCartIcon();

    // re-render si cambia storage en otra pestaña
    window.addEventListener("storage", () => {
      paintUser();
      paintCart();
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  // Exponer helpers si quieres usarlos en otros scripts
  window.TQSession = {
    isLoggedIn,
    getBurgerUser,
    paintUser,
    paintCart,
  };
})();
