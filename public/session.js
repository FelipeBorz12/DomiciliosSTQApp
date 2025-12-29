// public/session.js
(function () {
  "use strict";

  /* ================= HELPERS ================= */
  function safeJSONParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  function getBurgerUser() {
    return safeJSONParse(localStorage.getItem("burgerUser") || "null");
  }

  function isLoggedIn() {
    const bu = getBurgerUser();
    return !!(bu && (bu.correo || bu.auth_user_id));
  }

  function setHeaderUserName(name) {
    const el = document.getElementById("user-name-header");
    if (!el) return;
    el.textContent = name || "";
    el.classList.toggle("hidden", !name);
  }

  function setUserIconLogged(logged) {
    const btn = document.getElementById("user-icon");
    if (!btn) return;

    btn.dataset.logged = logged ? "1" : "0";

    // Indicador visual (ring)
    btn.classList.toggle("ring-2", logged);
    btn.classList.toggle("ring-primary/60", logged);
  }

  function updateCartBadges() {
    // Lee del carrito (soporta burgerCart o cart)
    let items = [];
    try {
      let raw = localStorage.getItem("burgerCart");
      if (!raw) raw = localStorage.getItem("cart");
      items = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(items)) items = [];
    } catch {
      items = [];
    }

    const count = items.reduce((acc, it) => {
      const q = Number(it?.cantidad ?? it?.qty ?? 1);
      return acc + (Number.isFinite(q) ? q : 1);
    }, 0);

    const desktop = document.getElementById("cart-count");
    const mobile = document.getElementById("cart-count-badge");
    if (desktop) desktop.textContent = String(count);
    if (mobile) mobile.textContent = String(count);

    return { items, count };
  }

  function toggleMobileMenuItems(logged) {
    const loginItem = document.getElementById("mobile-login-item");
    const profileItem = document.getElementById("mobile-profile-item");
    const logoutItem = document.getElementById("mobile-logout-item");

    if (loginItem) loginItem.classList.toggle("hidden", logged);
    if (profileItem) profileItem.classList.toggle("hidden", !logged);
    if (logoutItem) logoutItem.classList.toggle("hidden", !logged);
  }

  /* ================= NAV ================= */
  function goAccountOrLogin() {
    if (isLoggedIn()) {
      window.location.href = "/account";
    } else {
      window.location.href = "/login";
    }
  }

  function goCartOrEmptyModal() {
    const { count } = updateCartBadges();

    if (!count) {
      // Si existe tu modal "empty-cart-modal", lo abre
      const modal = document.getElementById("empty-cart-modal");
      if (modal) {
        modal.classList.remove("hidden");
        modal.classList.add("open");
        return;
      }
    }
    window.location.href = "/cart";
  }

  /* ================= LOGOUT ================= */
  window.logoutUser = async function () {
    const modal = document.getElementById("logout-modal");
    if (modal) modal.classList.remove("hidden");

    // Si auth.js existe y creó supabase como global, intenta cerrar sesión
    // (si no existe, solo limpia storage)
    try {
      if (window.supabase && window.supabase.auth && window.supabase.auth.signOut) {
        await window.supabase.auth.signOut();
      }
    } catch (e) {
      console.warn("[logoutUser] signOut error:", e);
    }

    try {
      localStorage.removeItem("burgerUser");
      localStorage.removeItem("burgerCart");
      localStorage.removeItem("cart");
      sessionStorage.clear();
    } catch {}

    setTimeout(() => {
      window.location.href = "/login";
    }, 600);
  };

  /* ================= MENU MÓVIL ================= */
  function initMobileMenu() {
    const menu = document.getElementById("mobile-menu");
    const openBtn = document.getElementById("menu-toggle");
    const closeBtn = document.getElementById("menu-close");
    const backdrop = document.getElementById("menu-backdrop");

    function openMenu() {
      if (!menu) return;
      menu.classList.remove("hidden");
      menu.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function closeMenu() {
      if (!menu) return;
      menu.classList.add("hidden");
      menu.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    openBtn?.addEventListener("click", openMenu);
    closeBtn?.addEventListener("click", closeMenu);
    backdrop?.addEventListener("click", closeMenu);

    // cerrar menú al hacer click en un link
    menu?.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", closeMenu);
    });

    // botones del menú
    document.getElementById("mobile-profile-btn")?.addEventListener("click", () => {
      closeMenu();
      window.location.href = "/account";
    });

    document.getElementById("mobile-logout-btn")?.addEventListener("click", () => {
      closeMenu();
      window.logoutUser?.();
    });
  }

  /* ================= INIT ================= */
  document.addEventListener("DOMContentLoaded", () => {
    // Usuario
    const userBtn = document.getElementById("user-icon");
    if (userBtn) {
      userBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        goAccountOrLogin();
      });
    }

    // Carrito (bolsa)
    const cartBtn = document.getElementById("cart-icon");
    if (cartBtn) {
      cartBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        goCartOrEmptyModal();
      });
    }

    // Pintar estado de sesión en header
    const logged = isLoggedIn();
    const bu = getBurgerUser();
    const name = bu?.perfil?.nombre || bu?.correo || "";
    setUserIconLogged(logged);
    setHeaderUserName(logged ? name : "");
    toggleMobileMenuItems(logged);

    // Pintar badges carrito
    updateCartBadges();

    // Menu móvil
    initMobileMenu();
  });
})();
