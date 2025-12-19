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

  // -----------------------------
  // Helpers localStorage / toast
  // -----------------------------
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
      toast.classList.remove("opacity-100");
    }, 2200);
  }

  // -----------------------------
  // Menú lateral
  // -----------------------------
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

  // -----------------------------
  // Contador de carrito
  // -----------------------------
  // Soporta "cart" o "burgerCart" como clave en localStorage
  function updateCartCount() {
    try {
      let raw = localStorage.getItem("cart");
      if (!raw) {
        raw = localStorage.getItem("burgerCart");
      }

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
        const q = Number(item?.quantity ?? item?.cantidad ?? 1);
        if (!Number.isFinite(q) || q <= 0) return acc + 1;
        return acc + q;
      }, 0);

      if (cartCount) {
        cartCount.textContent = String(totalItems);
      }
    } catch (err) {
      console.error("[index.js] Error leyendo carrito en updateCartCount:", err);
      if (cartCount) cartCount.textContent = "0";
    }
  }

  // -----------------------------
  // UI según usuario logueado
  // -----------------------------
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
    if (!userModal || !user) {
      // Si no está logueado, lo mandamos a login
      window.location.href = "/login";
      return;
    }

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

  // Eventos header / menú
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

  // IMPORTANTE: el click del carrito se maneja en el script del modal
  // empty-cart-modal en index.html. Aquí NO lo tocamos para no duplicar
  // comportamiento.

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

  // Fallback local (actual hardcode)
  const DEFAULT_HERO_IMAGES = [
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

  let heroImages = [];

  const heroCarousel = document.getElementById("hero-carousel");
  const heroDots = document.getElementById("hero-dots");
  const heroPrev = document.getElementById("hero-prev");
  const heroNext = document.getElementById("hero-next");

  let currentSlide = 0;
  let heroInterval;

  // Modal imagen hero
  const imgModal = document.getElementById("image-modal");
  const modalBackdrop = imgModal?.querySelector(".modal-backdrop");
  const modalClose = imgModal?.querySelector(".modal-close");
  const modalImage = document.getElementById("modal-image");
  const modalCaption = document.getElementById("modal-caption");

  function openModal(url, alt) {
    if (!imgModal || !modalImage || !modalCaption) return;
    modalImage.src = url;
    modalImage.alt = alt;
    modalCaption.textContent = alt;
    imgModal.classList.add("open");
    imgModal.classList.remove("hidden");
  }

  function closeModal() {
    if (!imgModal || !modalImage) return;
    imgModal.classList.remove("open");
    imgModal.classList.add("hidden");
    modalImage.src = "";
    modalImage.alt = "";
    modalImage.classList.remove("zoomed");
  }

  function renderHeroSlides() {
    if (!heroCarousel || !heroDots) return;

    heroCarousel.innerHTML = "";
    heroDots.innerHTML = "";

    heroImages.forEach((item, index) => {
      const slide = document.createElement("div");
      slide.className = "hero-slide";
      slide.dataset.index = index.toString();

      if (index === 0) {
        slide.classList.add("hero-slide--active");
      }

      slide.innerHTML = `
        <div class="hero-slide-inner">
          <div class="hero-slide-image">
            <img src="${item.url}" alt="${item.alt || ""}" />
          </div>
          <div class="hero-slide-text">
            ${
              item.tag
                ? `<p class="hero-tagline">${item.tag}</p>`
                : `<p class="hero-tagline">Nuevo</p>`
            }
            <h2 class="hero-title">${item.title || ""}</h2>
            <p class="hero-desc">${item.description || ""}</p>
            <button type="button" class="hero-cta">
              <span>Ver menú</span>
              <span class="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>
        </div>
      `;

      const imgEl = slide.querySelector("img");
      if (imgEl) {
        imgEl.addEventListener("click", () =>
          openModal(item.url, item.alt || item.title || "")
        );
      }

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
    if (!heroImages.length) return;
    heroInterval = window.setInterval(() => {
      const next = (currentSlide + 1) % heroImages.length;
      goToSlide(next);
    }, 5000);
  }

  function restartAutoSlide() {
    startHeroAutoSlide();
  }

  heroPrev?.addEventListener("click", () => {
    if (!heroImages.length) return;
    const prev = (currentSlide - 1 + heroImages.length) % heroImages.length;
    goToSlide(prev);
    restartAutoSlide();
  });

  heroNext?.addEventListener("click", () => {
    if (!heroImages.length) return;
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

  async function loadHeroFromApi() {
    try {
      const res = await fetch("/api/landing/hero");
      if (!res.ok) throw new Error("Respuesta no OK");
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        heroImages = data.map((item) => ({
          url: item.image_url,
          alt: item.image_alt || item.title || "Banner Tierra Querida",
          title: item.title,
          description: item.description,
          tag: item.tag || "",
        }));
      } else {
        heroImages = DEFAULT_HERO_IMAGES.slice();
      }
    } catch (err) {
      console.error("[index.js] Error cargando hero desde API:", err);
      heroImages = DEFAULT_HERO_IMAGES.slice();
    }

    renderHeroSlides();
    startHeroAutoSlide();
  }

  // =============================
  // PRODUCTOS DESDE SUPABASE
  // Carrusel: máx 4 completos + 5º asomado
  // =============================
  const zonaPrecio = "PrecioOriente"; // ajusta a tu zona si quieres
  const productsContainer = document.getElementById("products-container");
  const tabButtons = document.querySelectorAll(".tab-btn");
  const productsPrevBtn = document.getElementById("products-prev");
  const productsNextBtn = document.getElementById("products-next");
  const productsFadeRight = document.getElementById("products-fade-right");

  const MAX_VISIBLE_FULL = 4;
  const MAX_RENDER = 5; // 4 completos + 1 a la mitad

  let allProducts = [];
  let currentTipo = 1;
  let startIndex = 0;

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

  function updateProductsNavButtons() {
    if (!productsPrevBtn || !productsNextBtn) return;

    productsPrevBtn.disabled = startIndex <= 0;
    const moreToRight = startIndex + MAX_VISIBLE_FULL < allProducts.length;
    productsNextBtn.disabled = !moreToRight;

    if (productsFadeRight) {
      productsFadeRight.style.opacity = moreToRight ? "1" : "0";
    }
  }

  function buildProductCard(item, isHalf) {
    const card = document.createElement("article");
    card.className = [
      "group relative flex flex-col rounded-2xl overflow-hidden",
      "bg-[#020617] text-white",
      "border border-white/5 shadow-lg shadow-black/40",
      "min-w-[230px] max-w-[260px] flex-shrink-0",
      "backdrop-blur-sm",
      isHalf ? "opacity-70 translate-x-3 scale-[0.98]" : "",
    ].join(" ");

    if (isHalf) {
      card.style.maskImage =
        "linear-gradient(to right, transparent 0%, black 35%, black 85%, transparent 100%)";
      card.style.webkitMaskImage = card.style.maskImage;
    }

    const price =
      item[zonaPrecio] ??
      item.PrecioAreaMetrop ??
      item.PrecioRestoPais ??
      0;

    let priceDisplay;
    try {
      priceDisplay = new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(price);
    } catch {
      priceDisplay = `$${price}`;
    }

    const imgSrc = item.imagen || "/img/placeholder-product.webp";

    card.innerHTML = `
      <div class="relative w-full aspect-[4/3] overflow-hidden bg-black/40">
        <img
          loading="lazy"
          src="${imgSrc}"
          alt="${item.Nombre || "Producto Tierra Querida"}"
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div class="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none"></div>
        <div class="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
          <span class="material-symbols-outlined text-[16px]">local_fire_department</span>
          Popular
        </div>
      </div>

      <div class="flex flex-col gap-1.5 px-3 pt-3 pb-3">
        <h3 class="text-[15px] sm:text-[16px] font-extrabold text-white leading-snug line-clamp-2">
          ${item.Nombre || "Hamburguesa"}
        </h3>
        <p class="text-[12px] sm:text-[13px] text-gray-300 leading-snug line-clamp-3">
          ${item.Descripcion || ""}
        </p>
        <div class="mt-3 flex items-center justify-between">
          <span class="text-[15px] sm:text-[16px] font-extrabold text-primary bg-white/5 rounded-full px-3 py-1">
            ${priceDisplay}
          </span>
          <button
            class="product-go-detail inline-flex items-center gap-1 rounded-full bg-primary text-white text-[12px] sm:text-[13px] font-bold px-3 py-1.5 hover:brightness-110 transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
            Ver detalle
          </button>
        </div>
      </div>
    `;

    const detailBtn = card.querySelector(".product-go-detail");
    if (detailBtn) {
      detailBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.location.href = `/product?id=${item.id}`;
      });
    }

    card.addEventListener("click", () => {
      window.location.href = `/product?id=${item.id}`;
    });

    return card;
  }

  function renderProductsCarousel() {
    if (!productsContainer) return;

    productsContainer.innerHTML = "";

    if (!allProducts || allProducts.length === 0) {
      productsContainer.innerHTML = `
        <div class="w-full flex flex-col items-center justify-center py-8 text-center text-sm text-gray-300">
          <span class="material-symbols-outlined text-4xl mb-2">fastfood</span>
          <p>No hay productos disponibles en esta categoría.</p>
        </div>
      `;
    } else {
      const visibleEnd = Math.min(
        startIndex + MAX_RENDER,
        allProducts.length
      );
      const slice = allProducts.slice(startIndex, visibleEnd);

      slice.forEach((item, idx) => {
        const isHalf =
          idx === MAX_RENDER - 1 &&
          visibleEnd < allProducts.length &&
          slice.length === MAX_RENDER;

        const card = buildProductCard(item, isHalf);
        productsContainer.appendChild(card);
      });
    }

    updateProductsNavButtons();
  }

  async function loadCategory(tipo) {
    currentTipo = tipo ?? 1;
    startIndex = 0;

    if (productsContainer) {
      productsContainer.innerHTML = `
        <div class="flex gap-4 w-full">
          <div class="flex-1 h-40 rounded-2xl bg-gray-200/70 dark:bg-[#18181b] animate-pulse"></div>
          <div class="flex-1 h-40 rounded-2xl bg-gray-200/70 dark:bg-[#18181b] animate-pulse hidden sm:block"></div>
          <div class="flex-1 h-40 rounded-2xl bg-gray-200/70 dark:bg-[#18181b] animate-pulse hidden md:block"></div>
        </div>
      `;
    }

    const products = await fetchMenu(currentTipo);
    allProducts = Array.isArray(products) ? products : [];
    renderProductsCarousel();
  }

  // Eventos tabs
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("tab-btn--active"));
      btn.classList.add("tab-btn--active");

      const tipoAttr = btn.dataset.tipo;
      const tipo = tipoAttr ? Number(tipoAttr) : 1;
      loadCategory(tipo);
    });
  });

  // Flechas carrusel de productos
  productsPrevBtn?.addEventListener("click", () => {
    if (startIndex <= 0) return;
    startIndex = Math.max(0, startIndex - MAX_VISIBLE_FULL);
    renderProductsCarousel();
  });

  productsNextBtn?.addEventListener("click", () => {
    if (startIndex + MAX_VISIBLE_FULL >= allProducts.length) return;
    startIndex = Math.min(
      allProducts.length - MAX_VISIBLE_FULL,
      startIndex + MAX_VISIBLE_FULL
    );
    renderProductsCarousel();
  });

  // =============================
  // ABOUT & INSTAGRAM desde API
  // =============================

  const aboutTaglineEl = document.getElementById("about-tagline");
  const aboutTitleEl = document.getElementById("about-title");
  const aboutParagraphsEl = document.getElementById("about-paragraphs");
  const aboutBadgeTextEl = document.getElementById("about-badge-text");
  const aboutImageEl = document.getElementById("about-image");
  const aboutCtaEl = document.getElementById("about-cta-stores");
  const socialInstagramEl = document.getElementById("social-instagram");
  const instagramHandleEl = document.getElementById("instagram-handle");
  const instagramGridEl = document.getElementById("instagram-grid");

  const DEFAULT_ABOUT = {
    tagline: "#Movimiento TQ",
    title: "¿Quiénes Somos?",
    body: [
      "Hace 5 años, empezamos en una cocina pequeña con una idea grande: llevar hamburguesas honestas, hechas al momento, a cada rincón de esta Tierra Querida.",
      "Sin letreros luminosos ni grandes campañas. Solo una plancha caliente, 4 amigos con ganas de emprender y cientos de clientes que fueron pasando la voz, mordida tras mordida.",
      "Hoy seguimos siendo la misma cocina inquieta, pero con un sueño más grande: que cada pedido se sienta como comer en casa, sin perder el sabor callejero que nos trajo hasta aquí.",
    ],
    cta_text: "Pide aquí",
    cta_href: "/stores",
    badge_text: "+100 puntos de venta en Colombia",
    image_url: "./img/empleados.png",
    image_alt: "Equipo de Tierra Querida",
    instagram_handle: "@tierraquerida20",
    instagram_url: "https://www.instagram.com/tierraquerida20/",
  };

  const DEFAULT_INSTAGRAM_STORIES = [
    {
      image_url: "./img/ig-story-1.webp",
      image_alt: "Cliente disfrutando una hamburguesa Tierra Querida",
      caption: "",
      href: "https://www.instagram.com/tierraquerida20/",
    },
    {
      image_url: "./img/ig-story-2.webp",
      image_alt: "Amigos comiendo papas y hamburguesas en Tierra Querida",
      caption: "",
      href: "https://www.instagram.com/tierraquerida20/",
    },
    {
      image_url: "./img/ig-story-3.webp",
      image_alt: "Caravana de Tierra Querida por las calles de la ciudad",
      caption: "",
      href: "https://www.instagram.com/tierraquerida20/",
    },
    {
      image_url: "./img/ig-story-4.webp",
      image_alt: "Vista aérea de Cartagena con punto Tierra Querida",
      caption: "",
      href: "https://www.instagram.com/tierraquerida20/",
    },
  ];

  function renderAbout(about) {
    if (aboutTaglineEl) {
      aboutTaglineEl.childNodes[0].nodeValue = (about.tagline || "").trim() + " ";
    }
    if (aboutTitleEl) {
      aboutTitleEl.textContent = about.title || "";
    }
    if (aboutBadgeTextEl) {
      aboutBadgeTextEl.textContent =
        about.badge_text || DEFAULT_ABOUT.badge_text;
    }
    if (aboutImageEl) {
      aboutImageEl.src = about.image_url || DEFAULT_ABOUT.image_url;
      aboutImageEl.alt = about.image_alt || DEFAULT_ABOUT.image_alt;
    }
    if (aboutCtaEl) {
      aboutCtaEl.href = about.cta_href || DEFAULT_ABOUT.cta_href;
      aboutCtaEl.firstElementChild &&
        (aboutCtaEl.firstChild.nodeValue =
          (about.cta_text || DEFAULT_ABOUT.cta_text) + " ");
    }

    if (aboutParagraphsEl) {
      aboutParagraphsEl.innerHTML = "";
      const bodyParts =
        Array.isArray(about.body)
          ? about.body
          : typeof about.body === "string"
          ? about.body.split(/\n\s*\n/)
          : DEFAULT_ABOUT.body;

      bodyParts
        .filter((p) => p && p.trim().length)
        .forEach((text) => {
          const p = document.createElement("p");
          p.className =
            "text-sm sm:text-base leading-relaxed text-gray-700 dark:text-gray-300";
          p.textContent = text.trim();
          aboutParagraphsEl.appendChild(p);
        });
    }

    if (instagramHandleEl) {
      instagramHandleEl.textContent =
        about.instagram_handle || DEFAULT_ABOUT.instagram_handle;
    }
    if (socialInstagramEl) {
      socialInstagramEl.href =
        about.instagram_url || DEFAULT_ABOUT.instagram_url;
    }
  }

  async function loadAboutFromApi() {
    try {
      const res = await fetch("/api/landing/about");
      if (!res.ok) throw new Error("Respuesta no OK");
      const data = await res.json();

      const about = {
        tagline: data.tagline || DEFAULT_ABOUT.tagline,
        title: data.title || DEFAULT_ABOUT.title,
        body: data.body || DEFAULT_ABOUT.body,
        cta_text: data.cta_text || DEFAULT_ABOUT.cta_text,
        cta_href: data.cta_href || DEFAULT_ABOUT.cta_href,
        badge_text: data.badge_text || DEFAULT_ABOUT.badge_text,
        image_url: data.image_url || DEFAULT_ABOUT.image_url,
        image_alt: data.image_alt || DEFAULT_ABOUT.image_alt,
        instagram_handle:
          data.instagram_handle || DEFAULT_ABOUT.instagram_handle,
        instagram_url: data.instagram_url || DEFAULT_ABOUT.instagram_url,
      };

      renderAbout(about);
    } catch (err) {
      console.error("[index.js] Error cargando about desde API:", err);
      renderAbout(DEFAULT_ABOUT);
    }
  }

  function renderInstagramStories(stories) {
    if (!instagramGridEl) return;

    instagramGridEl.innerHTML = "";

    stories.forEach((story) => {
      const card = document.createElement("a");
      card.href = story.href || DEFAULT_ABOUT.instagram_url;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      card.className =
        "group relative aspect-[9/16] overflow-hidden rounded-3xl bg-black/50 shadow-xl";

      card.innerHTML = `
        <img
          src="${story.image_url}"
          alt="${story.image_alt || ""}"
          class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div
          class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent"
        ></div>
        <div
          class="absolute inset-x-0 bottom-0 p-3 flex items-center justify-between"
        >
          <p class="text-white text-sm font-semibold">${story.caption || ""}</p>
          <span
            class="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm group-hover:bg-white/20"
          >
            Ver en Instagram
          </span>
        </div>
      `;

      instagramGridEl.appendChild(card);
    });
  }

  async function loadInstagramFromApi() {
    try {
      const res = await fetch("/api/landing/instagram");
      if (!res.ok) throw new Error("Respuesta no OK");
      const data = await res.json();

      let stories;
      if (Array.isArray(data) && data.length > 0) {
        stories = data.map((item) => ({
          image_url: item.image_url,
          image_alt: item.image_alt || "",
          caption: item.caption || "",
          href:
            item.href ||
            DEFAULT_ABOUT.instagram_url ||
            "https://www.instagram.com/",
        }));
      } else {
        stories = DEFAULT_INSTAGRAM_STORIES;
      }

      renderInstagramStories(stories);
    } catch (err) {
      console.error(
        "[index.js] Error cargando historias de Instagram desde API:",
        err
      );
      renderInstagramStories(DEFAULT_INSTAGRAM_STORIES);
    }
  }

  // =============================
  // INICIALIZACIÓN
  // =============================

  // Categoría por defecto
  loadCategory(1);

  // Estado inicial del header
  updateCartCount();
  applyUserUI();

  // Hero / About / Instagram desde API
  loadHeroFromApi();
  loadAboutFromApi();
  loadInstagramFromApi();

  // Al volver con botón atrás (bfcache)
  window.addEventListener("pageshow", () => {
    updateCartCount();
    applyUserUI();
  });

  // Si el carrito cambia en otra pestaña
  window.addEventListener("storage", (e) => {
    if (e.key === "cart" || e.key === "burgerCart") {
      updateCartCount();
    }
  });
});
