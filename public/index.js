// index.js
document.addEventListener("DOMContentLoaded", () => {
  // =============================
  // HEADER / MENÚ / USUARIO / CARRITO
  // =============================
  const userButton = document.getElementById("user-icon");
  const cartButton = document.getElementById("cart-icon");
  const menuIcon = document.getElementById("menu-icon");
  const menu = document.getElementById("menu");
  const overlay = document.getElementById("overlay");
  const cartCount = document.getElementById("cart-count");
  const logoutButton = document.getElementById("logout-button");
  const closeMenuButton = document.getElementById("close-menu");
  const userNameHeader = document.getElementById("user-name-header");
  const menuLoginItem = document.getElementById("menu-login-item");
  const menuLogoutItem = document.getElementById("menu-logout-item");
  const toast = document.getElementById("toast");

  // Modal usuario
  const userModal = document.getElementById("user-modal");
  const userModalClose = document.getElementById("user-modal-close");
  const userForm = document.getElementById("user-form");
  const userNameInput = document.getElementById("user-name-input");
  const userEmailInput = document.getElementById("user-email-input");
  const userPhoneInput = document.getElementById("user-phone-input");
  const userAddressInput = document.getElementById("user-address-input");

  function getStoredUser() {
    try {
      const raw = localStorage.getItem("burgerUser");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function setStoredUser(user) {
    if (!user) {
      localStorage.removeItem("burgerUser");
      return;
    }
    localStorage.setItem("burgerUser", JSON.stringify(user));
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    toast.classList.add("opacity-100");
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 2200);
  }

  function openMenu() {
    if (!menu || !overlay) return;
    menu.classList.add("open");
    overlay.classList.add("active");
  }

  function closeMenu() {
    if (!menu || !overlay) return;
    menu.classList.remove("open");
    overlay.classList.remove("active");
  }

  function toggleMenu() {
    if (!menu) return;
    if (menu.classList.contains("open")) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  // 🔁 Versión mejorada
  function updateCartCount() {
    try {
      const raw = localStorage.getItem("burgerCart");
      if (!raw) {
        if (cartCount) cartCount.textContent = "0";
        return;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        if (cartCount) cartCount.textContent = "0";
        return;
      }

      const totalItems = parsed.reduce((acc, item) => {
        // Soporta item.quantity, item.cantidad o default 1
        const q = Number(item?.quantity ?? item?.cantidad ?? 1);
        if (!Number.isFinite(q) || q <= 0) return acc + 1;
        return acc + q;
      }, 0);

      if (cartCount) {
        cartCount.textContent = String(totalItems);
      }
    } catch (err) {
      console.error(
        "[index.js] Error leyendo carrito en updateCartCount:",
        err
      );
      if (cartCount) cartCount.textContent = "0";
    }
  }

  function applyUserUI() {
    const user = getStoredUser();
    if (user && user.correo) {
      if (userNameHeader) {
        userNameHeader.textContent = user.perfil?.nombre || user.correo;
        userNameHeader.classList.remove("hidden");
      }
      if (menuLoginItem) menuLoginItem.classList.add("hidden");
      if (menuLogoutItem) menuLogoutItem.classList.remove("hidden");
    } else {
      if (userNameHeader) {
        userNameHeader.textContent = "";
        userNameHeader.classList.add("hidden");
      }
      if (menuLoginItem) menuLoginItem.classList.remove("hidden");
      if (menuLogoutItem) menuLogoutItem.classList.add("hidden");
    }
  }

  function openUserModal() {
    const user = getStoredUser();
    if (!userModal || !user) return;
    userModal.classList.remove("hidden");
    userModal.classList.add("flex");

    if (userNameInput)
      userNameInput.value = user.perfil?.nombre || user.nombre || "";
    if (userEmailInput) userEmailInput.value = user.correo || "";
    if (userPhoneInput)
      userPhoneInput.value = user.perfil?.celular
        ? `+57${user.perfil.celular}`
        : "";
    if (userAddressInput)
      userAddressInput.value = user.perfil?.direccionentrega || "";
  }

  function closeUserModal() {
    if (!userModal) return;
    userModal.classList.add("hidden");
    userModal.classList.remove("flex");
  }

  // eventos de header
  if (menuIcon) {
    menuIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu();
    });
  }
  if (closeMenuButton) {
    closeMenuButton.addEventListener("click", (e) => {
      e.stopPropagation();
      closeMenu();
    });
  }
  if (overlay) {
    overlay.addEventListener("click", () => {
      closeMenu();
    });
  }
  document.addEventListener("click", (e) => {
    if (!menu || !menuIcon) return;
    if (
      menu.classList.contains("open") &&
      !menu.contains(e.target) &&
      !menuIcon.contains(e.target)
    ) {
      closeMenu();
    }
  });

  if (cartButton) {
    cartButton.addEventListener("click", () => {
      try {
        const raw = localStorage.getItem("burgerCart");
        const parsed = raw ? JSON.parse(raw) : [];
        if (!raw || !Array.isArray(parsed) || parsed.length === 0) {
          showToast("Tu carrito está vacío. Agrega productos desde el menú.");
          return;
        }
        window.location.href = "/cart";
      } catch (err) {
        console.error("[index.js] Error leyendo carrito:", err);
        showToast("Hubo un problema leyendo tu carrito.");
      }
    });
  }

  if (userButton) {
    userButton.addEventListener("click", () => {
      const user = getStoredUser();
      if (!user) {
        window.location.href = "/login";
      } else {
        openUserModal();
      }
    });
  }

  if (userModalClose) {
    userModalClose.addEventListener("click", () => {
      closeUserModal();
    });
  }
  if (userModal) {
    userModal.addEventListener("click", (e) => {
      if (e.target === userModal) {
        closeUserModal();
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      setStoredUser(null);
      applyUserUI();
      closeMenu();
      showToast("Sesión cerrada.");
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    });
  }

  if (userForm) {
    userForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const user = getStoredUser();
      if (!user) {
        closeUserModal();
        window.location.href = "/login";
        return;
      }
      const nombre = userNameInput?.value?.trim() || "";
      const phoneRaw = userPhoneInput?.value?.trim() || "";
      const direccion = userAddressInput?.value?.trim() || "";

      let celularLimpio = phoneRaw.replace(/\D/g, "");
      if (celularLimpio.startsWith("57")) {
        celularLimpio = celularLimpio.slice(2);
      }
      if (celularLimpio && celularLimpio.length !== 10) {
        showToast("El celular debe tener 10 dígitos después de +57.");
        return;
      }

      user.perfil = user.perfil || {};
      user.perfil.nombre = nombre;
      user.perfil.celular = celularLimpio || null;
      user.perfil.direccionentrega = direccion;

      setStoredUser(user);
      applyUserUI();
      showToast("Perfil actualizado localmente.");
      closeUserModal();
    });
  }

  // =============================
  // CARRUSEL HERO (imagen izquierda + texto derecha)
  // =============================
  const heroImages = [
    {
      url: "https://lh3.googleusercontent.com/aida-public/AB6AXuASEb-HyXI6AJNvlivFv0Qp7nWz0FsGB4PuFIgOa46zbaQ2yZXx8x9piDRUnfXOZuee2ni2gf1RvTerVysshQ4ZQPusSy2H4zr-dNwTI-UYaS8hnsPq38o3uId47Lf_jQmHQLe0SZ3SMaadkC29NjD0_zp-Ui8wMCDwHqiJ7o7uqbJRWnKtFB7pgWwHJGm5kEA9n4LPu9ru_1fs6jtwgA6jupWr9PuzC070KqTxw6CIdmZ5XqSIofKuRx2nrvKW7pkk7BMvhZvqamo",
      alt: "Hamburguesa clásica",
      title: "Hamburguesa clásica de la casa",
      description:
        "Pan brioche, carne 100% res, queso americano y vegetales frescos. Simple, contundente y perfecta para cualquier antojo.",
      tag: "Favorita de siempre",
    },
    {
      url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBCIJdajBCiOGKvR6jQFEAA5D8TeOdEQz-KCoWOZvboPDAvf-mSb8_DGtiJKTjvxzFDBoRsyqMOcWIUaOrVLHn5JK07YHXo6Zpw1umMVCb8B2E4ol66ZDg_97kUjAsG_0CImrHnppTvtEDhdSMj4OUiBFP1lz-zLWiodNhrkAFgtiaK1qbEUQ7sycUIgYoU2T-rKeHg1bVgy808NyTZf2oyS_qHH66lXfJPaKvEBowgcRDaEhWWb_P53HapQMDtzyUU3XLNgGwsOME",
      alt: "Hamburguesa crispy",
      title: "Crispy burger dorada y crocante",
      description:
        "Pollo apanado extra crocante, doble queso, ensalada fresca y salsas de la casa. La textura que pide el cuerpo.",
      tag: "Edición especial",
    },
    {
      url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDlDqWB6Fwl4shFIrDQwpKwhJejim4QrnPrqqOVGFp75VMzQ6m5-Dw_wxRHpw96gxRSMuSyrsBE37Yy9RAEvSsj8XpSzn583CniqYPOOaCMoZiyt_vWrOpBuxOm084mO7tWyQY_D03FZTwDefpfTjvpYXzxjsH9u6c45UsK9dlZDHF4hIo-RLspFLhJCqujRKn9n5TtBKGlbWZAJEkUgeGBGbaRo1H_BSORim6r_A0_pgbAOH_4H_j9K4K5EjYAga_elG1EQY-t9v8",
      alt: "Hamburguesa gourmet",
      title: "Tierra Querida gourmet",
      description:
        "Doble carne, tocineta ahumada, mix de quesos y reducción de cebolla caramelizada. Para cuando quieres darte un premio serio.",
      tag: "Recomendado del chef",
    },
  ];

  const heroCarousel = document.getElementById("hero-carousel");
  const heroDots = document.getElementById("hero-dots");
  const heroPrev = document.getElementById("hero-prev");
  const heroNext = document.getElementById("hero-next");

  let currentSlide = 0;
  let heroInterval;

  // Modal imagen
  const modal = document.getElementById("image-modal");
  const modalBackdrop = modal?.querySelector(".modal-backdrop");
  const modalClose = modal?.querySelector(".modal-close");
  const modalImage = document.getElementById("modal-image");
  const modalCaption = document.getElementById("modal-caption");

  function openModal(url, alt) {
    if (!modal || !modalImage || !modalCaption) return;
    modalImage.src = url;
    modalImage.alt = alt;
    modalCaption.textContent = alt;
    modal.classList.add("open");
    modal.classList.remove("hidden");
  }

  function closeModal() {
    if (!modal || !modalImage) return;
    modal.classList.remove("open");
    modal.classList.add("hidden");
    modalImage.src = "";
    modalImage.alt = "";
    modalImage.classList.remove("zoomed");
  }

  function renderProducts(products) {
  const productsContainer = document.getElementById('products-container');
  if (!productsContainer) return;

  productsContainer.innerHTML = '';

  if (!products || products.length === 0) {
    productsContainer.innerHTML =
      '<p class="text-center text-sm text-gray-500 mt-4">No hay productos disponibles en esta categoría.</p>';
    return;
  }

  products.forEach((item) => {
    const price = item[zonaPrecio] ?? 0;

    const card = document.createElement('div');
    card.className =
      'product-card flex h-full flex-col gap-4 rounded-xl bg-white dark:bg-black/20 shadow-md overflow-hidden';

    const imgUrl = item.imagen || '';

    card.innerHTML = `
      <div class="product-image-wrapper">
        <img
          src="${imgUrl}"
          alt="${item.Nombre || 'Producto'}"
          loading="lazy"
          class="product-image-img"
        />
      </div>
      <div class="flex flex-col flex-1 justify-between p-4 pt-0 gap-4">
        <div>
          <p class="text-black dark:text-white text-base md:text-lg font-semibold leading-normal">
            ${item.Nombre}
          </p>
          <p class="text-gray-600 dark:text-gray-400 text-xs md:text-sm leading-normal mb-1 line-clamp-2">
            ${item.Descripcion}
          </p>
          <p class="text-gray-800 dark:text-gray-200 text-sm md:text-base font-semibold leading-normal">
            $${Number(price).toLocaleString('es-CO')}
          </p>
        </div>
        <button
          class="product-go-detail flex min-w-[110px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-11 px-4 bg-primary text-white text-sm md:text-base font-bold leading-normal tracking-[0.015em]"
        >
          <span class="truncate">Agregar al carrito</span>
        </button>
      </div>
    `;

    const detailBtn = card.querySelector('.product-go-detail');
    if (detailBtn) {
      detailBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `/product?id=${item.id}`;
      });
    }

    productsContainer.appendChild(card);
  });
}


  function renderHeroSlides() {
    if (!heroCarousel || !heroDots) return;

    heroCarousel.innerHTML = "";
    heroDots.innerHTML = "";

    heroImages.forEach((item, index) => {
      const slide = document.createElement("div");
      slide.className = "hero-slide";
      slide.dataset.index = index.toString();

      // marcamos el primero como activo
      if (index === 0) {
        slide.classList.add("hero-slide--active");
      }

      slide.innerHTML = `
        <div class="hero-slide-inner">
          <div class="hero-slide-image">
            <img src="${item.url}" alt="${item.alt}" />
          </div>
          <div class="hero-slide-text">
            ${
              item.tag
                ? `<p class="hero-tagline">${item.tag}</p>`
                : `<p class="hero-tagline">Nuevo</p>`
            }
            <h2 class="hero-title">${item.title}</h2>
            <p class="hero-desc">${item.description}</p>
            <button type="button" class="hero-cta">
              <span>Ver menú</span>
              <span class="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>
      `;

      // click en la imagen -> zoom
      const imgEl = slide.querySelector("img");
      if (imgEl) {
        imgEl.addEventListener("click", () => openModal(item.url, item.alt));
      }

      // CTA -> hacer scroll a productos
      const cta = slide.querySelector(".hero-cta");
      if (cta) {
        cta.addEventListener("click", () => {
          const productsSection = document.querySelector(".products-section");
          if (productsSection) {
            productsSection.scrollIntoView({ behavior: "smooth" });
          }
        });
      }

      heroCarousel.appendChild(slide);

      const dot = document.createElement("button");
      dot.className =
        "w-2.5 h-2.5 rounded-full transition-colors bg-white/40 hover:bg-white focus:outline-none";
      dot.dataset.index = index.toString();
      dot.addEventListener("click", () => {
        goToSlide(index);
        restartAutoSlide();
      });
      heroDots.appendChild(dot);
    });

    updateDots();
  }

  function goToSlide(index) {
    if (!heroCarousel) return;
    const slides = heroCarousel.querySelectorAll(".hero-slide");

    slides.forEach((slide, i) => {
      if (i === index) {
        slide.classList.add("hero-slide--active");
      } else {
        slide.classList.remove("hero-slide--active");
      }
    });

    currentSlide = index;
    updateDots();
  }

  function updateDots() {
    if (!heroDots) return;
    const dots = heroDots.querySelectorAll("button");
    dots.forEach((dot, i) => {
      dot.className =
        "w-2.5 h-2.5 rounded-full transition-colors " +
        (i === currentSlide ? "bg-white" : "bg-white/40");
    });
  }

  function startHeroAutoSlide() {
    if (heroInterval) {
      window.clearInterval(heroInterval);
    }
    heroInterval = window.setInterval(() => {
      const next = (currentSlide + 1) % heroImages.length;
      goToSlide(next);
    }, 5000);
  }

  function restartAutoSlide() {
    startHeroAutoSlide();
  }

  heroPrev?.addEventListener("click", () => {
    const prev = (currentSlide - 1 + heroImages.length) % heroImages.length;
    goToSlide(prev);
    restartAutoSlide();
  });

  heroNext?.addEventListener("click", () => {
    const next = (currentSlide + 1) % heroImages.length;
    goToSlide(next);
    restartAutoSlide();
  });

  modalClose?.addEventListener("click", () => {
    closeModal();
  });

  modalBackdrop?.addEventListener("click", () => {
    if (window.innerWidth >= 1024) {
      closeModal();
    }
  });

  modalImage?.addEventListener("click", () => {
    modalImage.classList.toggle("zoomed");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  });

  renderHeroSlides();
  startHeroAutoSlide();

  // =============================
  // PRODUCTOS DESDE SUPABASE
  // =============================
  const zonaPrecio = "PrecioOriente"; // puedes cambiar según la zona que uses
  const productsContainer = document.getElementById("products-container");
  const tabButtons = document.querySelectorAll(".tab-btn");

  async function fetchMenu(tipo) {
    const url =
      typeof tipo === "number" ? `/api/menu?tipo=${tipo}` : "/api/menu";
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Error al cargar menú", res.status);
      if (productsContainer) {
        productsContainer.innerHTML =
          '<p class="text-center text-sm text-red-500 mt-4">Error al cargar el menú. Intenta de nuevo.</p>';
      }
      return [];
    }
    return await res.json();
  }

  function renderProducts(products) {
    if (!productsContainer) return;

    productsContainer.innerHTML = "";

    if (!products || products.length === 0) {
      productsContainer.innerHTML =
        '<p class="text-center text-sm text-gray-300 mt-4">No hay productos disponibles en esta categoría.</p>';
      return;
    }

    products.forEach((item) => {
      const price = item[zonaPrecio] ?? 0;

      const card = document.createElement("div");
      card.className =
        "product-card flex h-full flex-col gap-3 rounded-xl bg-white dark:bg-black/30";

      card.innerHTML = `
        <div
          class="product-image"
          style="background-image: url('${item.imagen || ""}');"
        ></div>
        <div class="flex flex-col flex-1 justify-between p-4 pt-1 gap-3">
          <div>
            <p class="text-black dark:text-white text-base md:text-lg font-semibold leading-snug">
              ${item.Nombre}
            </p>
            <p class="text-gray-600 dark:text-gray-400 text-xs md:text-sm leading-normal mb-1 line-clamp-2">
              ${item.Descripcion}
            </p>
            <p class="text-gray-900 dark:text-gray-100 text-sm md:text-base font-semibold leading-normal">
              $${Number(price).toLocaleString("es-CO")}
            </p>
          </div>
          <button
            class="product-go-detail flex min-w-[110px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-11 px-4 bg-primary text-white text-sm md:text-base font-bold leading-normal tracking-[0.015em]"
          >
            <span class="truncate">Agregar al carrito</span>
          </button>
        </div>
      `;

      const detailBtn = card.querySelector(".product-go-detail");
      if (detailBtn) {
        detailBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          window.location.href = `/product?id=${item.id}`;
        });
      }

      productsContainer.appendChild(card);
    });
  }

  async function loadCategory(tipo) {
    const products = await fetchMenu(tipo);
    renderProducts(products);
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("tab-btn--active"));
      btn.classList.add("tab-btn--active");

      const tipoAttr = btn.dataset.tipo;
      const tipo = tipoAttr ? Number(tipoAttr) : undefined;
      loadCategory(tipo);
    });
  });

  // cargar hamburguesas por defecto
  loadCategory(1);

  // =============================
  // INICIALIZACIÓN
  // =============================
  updateCartCount();
  applyUserUI();

  // 🔄 al volver con el botón Atrás (bfcache)
  window.addEventListener("pageshow", () => {
    updateCartCount();
    applyUserUI();
  });

  // 🧠 si cambia el carrito en otra pestaña
  window.addEventListener("storage", (e) => {
    if (e.key === "burgerCart") {
      updateCartCount();
    }
  });
});
