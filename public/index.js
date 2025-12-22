// index.js
document.addEventListener("DOMContentLoaded", () => {
  // =============================
  // HEADER / MENÚ / USUARIO / CARRITO
  // =============================
  const userButton = document.getElementById("user-icon");
  const menuIcon = document.getElementById("menu-icon");
  const menu = document.getElementById("menu");
  const overlay = document.getElementById("overlay");
  const cartCount = document.getElementById("cart-count");
  const cartCountBadge = document.getElementById("cart-count-badge");
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

  // =============================
  // Helpers localStorage / toast
  // =============================
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
    setTimeout(() => toast.classList.add("hidden"), 2200);
  }

  // =============================
  // Menú lateral
  // =============================
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
    if (menu.classList.contains("open")) closeMenu();
    else openMenu();
  }

  // =============================
  // Contador carrito
  // =============================
  function updateCartCount() {
    try {
      let raw = localStorage.getItem("burgerCart");
      if (!raw) raw = localStorage.getItem("cart");

      if (!raw) {
        if (cartCount) cartCount.textContent = "0";
        if (cartCountBadge) cartCountBadge.textContent = "0";
        return;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        if (cartCount) cartCount.textContent = "0";
        if (cartCountBadge) cartCountBadge.textContent = "0";
        return;
      }

      const totalItems = parsed.reduce((acc, item) => {
        const q = Number(item?.quantity ?? item?.cantidad ?? 1);
        if (!Number.isFinite(q) || q <= 0) return acc + 1;
        return acc + q;
      }, 0);

      if (cartCount) cartCount.textContent = String(totalItems);
      if (cartCountBadge) cartCountBadge.textContent = String(totalItems);
    } catch (err) {
      if (cartCount) cartCount.textContent = "0";
      if (cartCountBadge) cartCountBadge.textContent = "0";
    }
  }

  // =============================
  // UI según usuario
  // =============================
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

  // =============================
  // Eventos header / menú
  // =============================
  menuIcon?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  closeMenuButton?.addEventListener("click", (e) => {
    e.stopPropagation();
    closeMenu();
  });

  overlay?.addEventListener("click", closeMenu);

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

  userButton?.addEventListener("click", () => {
    const user = getStoredUser();
    if (!user) window.location.href = "/login";
    else openUserModal();
  });

  userModalClose?.addEventListener("click", closeUserModal);

  userModal?.addEventListener("click", (e) => {
    if (e.target === userModal) closeUserModal();
  });

  logoutButton?.addEventListener("click", () => {
    setStoredUser(null);
    applyUserUI();
    closeMenu();
    showToast("Sesión cerrada.");
    setTimeout(() => (window.location.href = "/"), 500);
  });

  userForm?.addEventListener("submit", (e) => {
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
    if (celularLimpio.startsWith("57")) celularLimpio = celularLimpio.slice(2);

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
    showToast("Perfil actualizado.");
    closeUserModal();
  });

  // =============================
  // MODAL ZOOM HERO
  // =============================
  const imgModal = document.getElementById("image-modal");
  const modalBackdrop = imgModal?.querySelector(".modal-backdrop");
  const modalClose = imgModal?.querySelector(".modal-close");
  const modalImage = document.getElementById("modal-image");
  const modalCaption = document.getElementById("modal-caption");

  function openModal(url, alt) {
    if (!imgModal || !modalImage || !modalCaption) return;
    modalImage.src = url;
    modalImage.alt = alt || "";
    modalCaption.textContent = alt || "";
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

  modalClose?.addEventListener("click", closeModal);
  modalBackdrop?.addEventListener("click", closeModal);
  modalImage?.addEventListener("click", () =>
    modalImage.classList.toggle("zoomed")
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // =============================
  // HERO (nuevo layout) - landing_hero
  // =============================
  const heroFeature = document.getElementById("hero-feature");
  const heroSideA = document.getElementById("hero-side-a");
  const heroSideB = document.getElementById("hero-side-b");
  const heroDots = document.getElementById("hero-dots");
  const heroPrev = document.getElementById("hero-prev");
  const heroNext = document.getElementById("hero-next");

  const DEFAULT_HERO = [
    {
      title: "Especial de temporada",
      description: "Ingredientes frescos y sabor real.",
      tag: "Edición limitada",
      image_url:
        "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1600&q=75",
    },
    {
      title: "Bebidas exóticas",
      description: "Solo por temporada.",
      tag: "Nuevo",
      image_url:
        "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1600&q=75",
    },
    {
      title: "Postres de temporada",
      description: "Dulces para cerrar perfecto.",
      tag: "Recomendado",
      image_url:
        "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=1600&q=75",
    },
  ];

  let heroItems = [];
  let heroIndex = 0;
  let heroTimer;

  function safeHero(i) {
    const n = heroItems.length || 1;
    return ((i % n) + n) % n;
  }

  function buildHeroHTML(item, opts = {}) {
    const title = item?.title || "";
    const desc = item?.description || "";
    const tag = item?.tag || "Nuevo";
    const img = item?.image_url || "";
    const isFeatured = !!opts.featured;

    // overlay tipo diseño nuevo
    const overlay = isFeatured
      ? "linear-gradient(to right, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.20) 60%),"
      : "linear-gradient(to right, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.20) 70%),";

    return `
      <div class="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
           style="background-image:${overlay} url('${img}');">
      </div>

      <div class="relative h-full flex flex-col justify-end p-6 sm:p-8 lg:p-12 items-start gap-3">
        <span class="bg-primary text-white text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
          ${tag}
        </span>

        <h1 class="${
          isFeatured ? "text-3xl sm:text-4xl lg:text-5xl" : "text-2xl"
        } font-extrabold leading-tight max-w-lg">
          ${title}
        </h1>

        <p class="text-white/80 max-w-md text-sm sm:text-base font-medium">
          ${desc}
        </p>

        ${
          isFeatured
            ? `<button class="mt-1 bg-white text-black hover:bg-gray-200 px-6 py-3 rounded-full font-extrabold text-sm flex items-center gap-2 transition-colors" type="button" id="hero-cta">
                 Descubrir ahora
                 <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
               </button>`
            : `<span class="text-primary font-extrabold text-sm flex items-center hover:underline">
                 Ver más <span class="material-symbols-outlined text-[16px]">chevron_right</span>
               </span>`
        }
      </div>
    `;
  }

  function renderHeroDots() {
    if (!heroDots) return;
    heroDots.innerHTML = "";

    heroItems.forEach((_, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className =
        "h-2.5 w-2.5 rounded-full transition-colors " +
        (i === heroIndex ? "bg-white" : "bg-white/40 hover:bg-white/70");
      dot.addEventListener("click", () => {
        heroIndex = i;
        renderHero();
        restartHero();
      });
      heroDots.appendChild(dot);
    });
  }

  function renderHero() {
    if (!heroFeature || heroItems.length === 0) return;

    const featured = heroItems[heroIndex];
    const side1 = heroItems[safeHero(heroIndex + 1)];
    const side2 = heroItems[safeHero(heroIndex + 2)];

    heroFeature.innerHTML = buildHeroHTML(featured, { featured: true });

    heroSideA &&
      (heroSideA.innerHTML = buildHeroHTML(side1, { featured: false }));
    heroSideB &&
      (heroSideB.innerHTML = buildHeroHTML(side2, { featured: false }));

    // CTA: scroll a menú
    heroFeature.querySelector("#hero-cta")?.addEventListener("click", (e) => {
      e.preventDefault();
      document
        .getElementById("products-section")
        ?.scrollIntoView({ behavior: "smooth" });
    });

    // Click en hero: modal zoom (buena para “zoom”)
    heroFeature.addEventListener("click", () => {
      openModal(featured.image_url, featured.title);
    });

    // Click side cards: cambia slide
    heroSideA?.addEventListener("click", () => {
      heroIndex = safeHero(heroIndex + 1);
      renderHero();
      restartHero();
    });
    heroSideB?.addEventListener("click", () => {
      heroIndex = safeHero(heroIndex + 2);
      renderHero();
      restartHero();
    });

    renderHeroDots();
  }

  function startHero() {
    if (heroTimer) clearInterval(heroTimer);
    if (heroItems.length <= 1) return;

    heroTimer = setInterval(() => {
      heroIndex = safeHero(heroIndex + 1);
      renderHero();
    }, 5200);
  }

  function restartHero() {
    startHero();
  }

  heroPrev?.addEventListener("click", () => {
    heroIndex = safeHero(heroIndex - 1);
    renderHero();
    restartHero();
  });

  heroNext?.addEventListener("click", () => {
    heroIndex = safeHero(heroIndex + 1);
    renderHero();
    restartHero();
  });

  async function loadHeroFromApi() {
    try {
      const res = await fetch("/api/landing/hero");
      if (!res.ok) throw new Error("Respuesta no OK");
      const data = await res.json();

      // Esperado: rows activos ordenados por order_index (idealmente el backend ya lo hace)
      heroItems = Array.isArray(data) && data.length ? data : DEFAULT_HERO;
    } catch (err) {
      console.error("[hero] Error API:", err);
      heroItems = DEFAULT_HERO;
    }

    heroIndex = 0;
    renderHero();
    startHero();
  }

  // =============================
  // PRODUCTOS + SEARCH (header-search)
  // =============================
  const zonaPrecio = "PrecioOriente";
  const productsContainer = document.getElementById("products-container");
  const tabButtons = document.querySelectorAll(".tab-btn");
  const productsPrevBtn = document.getElementById("products-prev");
  const productsNextBtn = document.getElementById("products-next");
  const productsFadeRight = document.getElementById("products-fade-right");

  const productsWrapper = document.getElementById("products-carousel-wrapper");
  const productsViewport = document.getElementById("products-viewport");

  const MAX_VISIBLE_FULL = 4;
  const MAX_RENDER = 5;

  // =============================
  // SEARCH MULTI-CATEGORÍA (cache + auto-tab + auto-scroll)
  // =============================
  const SEARCH_TIPOS = [1, 3, 4, 6]; // hamburguesas, combos, papas, bebidas
  const productsCache = new Map(); // tipo -> array productos
  let searchSeq = 0; // evita carreras async

  // Mapa tipo -> botón (para activar tab programáticamente)
  const tabByTipo = new Map();
  tabButtons.forEach((b) => {
    const t = Number(b.dataset.tipo);
    if (Number.isFinite(t)) tabByTipo.set(t, b);
  });

  function setActiveTab(tipo) {
    tabButtons.forEach((b) => b.classList.remove("tab-btn--active"));
    const btn = tabByTipo.get(Number(tipo));
    if (btn) btn.classList.add("tab-btn--active");
  }

  function scrollToProductsSection() {
    const section = document.getElementById("products-section");
    if (!section) return;

    // offset por header sticky
    const header = document.querySelector("header");
    const headerH = header
      ? Math.ceil(header.getBoundingClientRect().height)
      : 0;

    const y =
      window.scrollY + section.getBoundingClientRect().top - headerH - 12;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });

    // opcional: llevar el carrusel al inicio
    productsViewport?.scrollTo({ left: 0, behavior: "smooth" });
  }

  async function fetchMenuCached(tipo) {
    const t = Number(tipo);
    if (productsCache.has(t)) return productsCache.get(t);

    const products = await fetchMenu(t);
    const arr = Array.isArray(products) ? products : [];
    productsCache.set(t, arr);
    return arr;
  }

  function countMatches(list, term) {
    const t = normalizeText(term).trim();
    if (!t) return 0;

    let c = 0;
    for (const p of list) {
      const name = normalizeText(p?.Nombre);
      const desc = normalizeText(p?.Descripcion);
      if (name.includes(t) || desc.includes(t)) c++;
    }
    return c;
  }

  async function pickBestTipoForTerm(term) {
    // elegimos el tipo con más matches (si empatan, el primero del orden)
    let bestTipo = currentTipo;
    let bestCount = 0;

    for (const tipo of SEARCH_TIPOS) {
      const list = await fetchMenuCached(tipo);
      const m = countMatches(list, term);
      if (m > bestCount) {
        bestCount = m;
        bestTipo = tipo;
      }
    }

    return { bestTipo, bestCount };
  }

  let allProducts = [];
  let allProductsRaw = [];
  let currentTipo = 1;
  let startIndex = 0;

  // Search
  let searchTerm = "";
  const searchInput = document.getElementById("header-search");

  function normalizeText(str) {
    return (str || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function debounce(fn, wait = 160) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function applySearchFilter(resetIndex = true) {
    const term = normalizeText(searchTerm).trim();

    if (!term) {
      allProducts = allProductsRaw.slice();
    } else {
      allProducts = allProductsRaw.filter((p) => {
        const name = normalizeText(p?.Nombre);
        const desc = normalizeText(p?.Descripcion);
        return name.includes(term) || desc.includes(term);
      });
    }

    if (resetIndex) startIndex = 0;
    renderProductsCarousel();
  }

  if (searchInput) {
    const onSearch = debounce(async () => {
      const mySeq = ++searchSeq;

      searchTerm = searchInput.value || "";
      const term = normalizeText(searchTerm).trim();

      // Siempre al buscar: baja a productos
      scrollToProductsSection();

      // si está vacío, solo aplica filtro normal en la categoría actual
      if (!term) {
        applySearchFilter(true);
        return;
      }

      // decide la mejor categoría para ese término
      const { bestTipo, bestCount } = await pickBestTipoForTerm(term);

      // si el usuario escribió más y esta búsqueda quedó vieja, no hagas nada
      if (mySeq !== searchSeq) return;

      // si no hay matches en ninguna, deja la categoría actual y muestra vacío
      if (!bestCount) {
        applySearchFilter(true);
        return;
      }

      // si hay matches en otra categoría, cámbiate automáticamente
      if (Number(bestTipo) !== Number(currentTipo)) {
        setActiveTab(bestTipo);
        await loadCategory(bestTipo);
        if (mySeq !== searchSeq) return; // por si tardó el fetch
      } else {
        // misma categoría: solo filtra
        applySearchFilter(true);
      }

      // asegurar carrusel al inicio con los resultados
      productsViewport?.scrollTo({ left: 0, behavior: "smooth" });
    }, 180);

    searchInput.addEventListener("input", onSearch);
  }

  function lockHeight(el) {
    if (!el) return;
    const h = Math.ceil(el.getBoundingClientRect().height);
    el.style.minHeight = h ? `${h}px` : "360px";
  }

  function unlockHeight(el) {
    if (!el) return;
    el.style.minHeight = "";
  }

  function setProductsLoading(isLoading) {
    if (!productsViewport) return;
    productsViewport.style.opacity = isLoading ? "0.6" : "1";
    productsViewport.style.transform = isLoading
      ? "translateY(2px)"
      : "translateY(0)";
    productsViewport.style.transition =
      "opacity 180ms ease, transform 180ms ease";
  }

  async function fetchMenu(tipo) {
    const url =
      typeof tipo === "number" ? `/api/menu?tipo=${tipo}` : "/api/menu";
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  }

  function updateProductsNavButtons() {
    if (!productsPrevBtn || !productsNextBtn) return;

    productsPrevBtn.disabled = startIndex <= 0;
    const moreToRight = startIndex + MAX_VISIBLE_FULL < allProducts.length;
    productsNextBtn.disabled = !moreToRight;

    if (productsFadeRight)
      productsFadeRight.style.opacity = moreToRight ? "1" : "0";
  }

  function buildProductCard(item, isHalf) {
    const card = document.createElement("article");

    card.className = [
      "group relative flex flex-col rounded-2xl overflow-hidden",
      "bg-[#020617] text-white",
      "border border-white/5 shadow-lg shadow-black/40",
      "min-w-[260px] sm:min-w-[260px] max-w-[280px] flex-shrink-0",
      isHalf ? "opacity-70 translate-x-3 scale-[0.98]" : "",
    ].join(" ");

    if (isHalf) {
      card.style.maskImage =
        "linear-gradient(to right, transparent 0%, black 35%, black 85%, transparent 100%)";
      card.style.webkitMaskImage = card.style.maskImage;
    }

    const price =
      item[zonaPrecio] ?? item.PrecioAreaMetrop ?? item.PrecioRestoPais ?? 0;

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
      <div class="relative w-full aspect-[16/10] overflow-hidden bg-black/40">
        <img
          loading="lazy"
          src="${imgSrc}"
          alt="${item.Nombre || "Producto Tierra Querida"}"
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div class="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none"></div>
      </div>

      <div class="flex flex-col gap-1.5 px-3 pt-3 pb-3">
        <h3 class="text-[15px] sm:text-[16px] font-extrabold text-white leading-snug line-clamp-2">
          ${item.Nombre || "Producto"}
        </h3>
        <p class="text-[12px] sm:text-[13px] text-white/70 leading-snug line-clamp-3">
          ${item.Descripcion || ""}
        </p>
        <div class="mt-3 flex items-center justify-between">
          <span class="text-[15px] sm:text-[16px] font-extrabold text-primary bg-white/5 rounded-full px-3 py-1">
            ${priceDisplay}
          </span>
          <button
            class="product-go-detail inline-flex items-center gap-1 rounded-full bg-primary text-white text-[12px] sm:text-[13px] font-extrabold px-3 py-1.5 hover:brightness-110 transition-colors"
            type="button"
          >
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
            Ver detalle
          </button>
        </div>
      </div>
    `;

    card.querySelector(".product-go-detail")?.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = `/product?id=${item.id}`;
    });

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
        <div class="w-full flex flex-col items-center justify-center py-8 text-center text-sm text-white/70">
          <span class="material-symbols-outlined text-4xl mb-2">fastfood</span>
          <p>No hay productos disponibles en esta categoría.</p>
        </div>
      `;
    } else {
      const visibleEnd = Math.min(startIndex + MAX_RENDER, allProducts.length);
      const slice = allProducts.slice(startIndex, visibleEnd);

      slice.forEach((item, idx) => {
        const isHalf =
          idx === MAX_RENDER - 1 &&
          visibleEnd < allProducts.length &&
          slice.length === MAX_RENDER;

        productsContainer.appendChild(buildProductCard(item, isHalf));
      });
    }

    updateProductsNavButtons();
  }

  async function loadCategory(tipo) {
    currentTipo = tipo ?? 1;
    startIndex = 0;

    // ✅ si ya está en cache, úsalo sin “loading”
    if (productsCache.has(currentTipo)) {
      allProductsRaw = productsCache.get(currentTipo) || [];
      applySearchFilter(true);
      return;
    }

    lockHeight(productsWrapper);
    setProductsLoading(true);

    if (productsContainer) {
      productsContainer.innerHTML = `
        <div class="flex gap-4 w-full">
          <div class="min-w-[260px] h-[320px] rounded-2xl bg-white/5 border border-white/10 animate-pulse"></div>
          <div class="min-w-[260px] h-[320px] rounded-2xl bg-white/5 border border-white/10 animate-pulse hidden sm:block"></div>
          <div class="min-w-[260px] h-[320px] rounded-2xl bg-white/5 border border-white/10 animate-pulse hidden md:block"></div>
        </div>
      `;
    }

    const products = await fetchMenu(currentTipo);
    allProductsRaw = Array.isArray(products) ? products : [];
    productsCache.set(currentTipo, allProductsRaw); // ✅ guarda cache
    applySearchFilter(true);

    requestAnimationFrame(() => {
      setProductsLoading(false);
      unlockHeight(productsWrapper);
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("tab-btn--active"));
      btn.classList.add("tab-btn--active");

      const tipoAttr = btn.dataset.tipo;
      const tipo = tipoAttr ? Number(tipoAttr) : 1;
      loadCategory(tipo);
    });
  });

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
  // ABOUT (landing_about)
  // =============================
  const aboutTaglineEl = document.getElementById("about-tagline");
  const aboutTitleEl = document.getElementById("about-title");
  const aboutParagraphsEl = document.getElementById("about-paragraphs");
  const aboutBadgeTextEl = document.getElementById("about-badge-text");
  const aboutImageEl = document.getElementById("about-image");
  const aboutCtaEl = document.getElementById("about-cta-stores");
  const socialInstagramEl = document.getElementById("social-instagram");
  const instagramHandleEl = document.getElementById("instagram-handle");

  const DEFAULT_ABOUT = {
    tagline: "#Movimiento TQ",
    title: "¿Quiénes somos?",
    body: "Hace 5 años empezamos en una cocina pequeña con una idea grande: llevar hamburguesas honestas a cada rincón.\n\nHoy seguimos siendo la misma cocina inquieta, pero con un sueño más grande: que cada pedido se sienta como comer en casa.",
    image_url: "./img/empleados.png",
    badge_text: "+100 puntos de venta en Colombia",
    cta_text: "Pide aquí",
    cta_href: "/stores",
    instagram_handle: "@tierraquerida20",
  };

  function renderAbout(about) {
    if (aboutTaglineEl)
      aboutTaglineEl.textContent = (
        about.tagline || DEFAULT_ABOUT.tagline
      ).trim();
    if (aboutTitleEl)
      aboutTitleEl.textContent = about.title || DEFAULT_ABOUT.title;

    if (aboutBadgeTextEl)
      aboutBadgeTextEl.textContent =
        about.badge_text || DEFAULT_ABOUT.badge_text;

    if (aboutImageEl)
      aboutImageEl.src = about.image_url || DEFAULT_ABOUT.image_url;

    if (aboutCtaEl) {
      aboutCtaEl.href = about.cta_href || DEFAULT_ABOUT.cta_href;
      const span = aboutCtaEl.querySelector("span");
      if (span) span.textContent = about.cta_text || DEFAULT_ABOUT.cta_text;
    }

    if (aboutParagraphsEl) {
      aboutParagraphsEl.innerHTML = "";
      const raw = about.body || DEFAULT_ABOUT.body;
      const parts = typeof raw === "string" ? raw.split(/\n\s*\n/) : [];
      (parts.length ? parts : DEFAULT_ABOUT.body.split(/\n\s*\n/)).forEach(
        (t) => {
          const p = document.createElement("p");
          p.className = "text-white/70 text-sm md:text-base leading-relaxed";
          p.textContent = t.trim();
          aboutParagraphsEl.appendChild(p);
        }
      );
    }

    if (instagramHandleEl)
      instagramHandleEl.textContent =
        about.instagram_handle || DEFAULT_ABOUT.instagram_handle;
    if (socialInstagramEl)
      socialInstagramEl.href = `https://www.instagram.com/${(
        about.instagram_handle || DEFAULT_ABOUT.instagram_handle
      ).replace("@", "")}/`;
  }

  async function loadAboutFromApi() {
    try {
      const res = await fetch("/api/landing/about");
      if (!res.ok) throw new Error("Respuesta no OK");
      const data = await res.json();

      // tu tabla landing_about: {title, tagline, body, image_url, badge_text, cta_text, cta_href, instagram_handle}
      renderAbout({
        tagline: data.tagline,
        title: data.title,
        body: data.body,
        image_url: data.image_url,
        badge_text: data.badge_text,
        cta_text: data.cta_text,
        cta_href: data.cta_href,
        instagram_handle: data.instagram_handle,
      });
    } catch (err) {
      console.error("[about] Error API:", err);
      renderAbout(DEFAULT_ABOUT);
    }
  }

  // =============================
  // INSTAGRAM (landing_instagram)
  // =============================
  const instagramGridEl = document.getElementById("instagram-grid");

  function renderInstagramStories(stories) {
    if (!instagramGridEl) return;
    instagramGridEl.innerHTML = "";

    stories.forEach((story) => {
      const a = document.createElement("a");
      a.href = story.href || "https://www.instagram.com/tierraquerida20/";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className =
        "min-w-[200px] md:min-w-[240px] aspect-square rounded-xl bg-[#261c1c] overflow-hidden relative group snap-start border border-white/5";

      a.innerHTML = `
        <img
          loading="lazy"
          src="${story.image_url}"
          alt="${story.caption || "Instagram Tierra Querida"}"
          class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span class="material-symbols-outlined text-white">favorite</span>
        </div>
      `;

      instagramGridEl.appendChild(a);
    });
  }

  async function loadInstagramFromApi() {
    try {
      const res = await fetch("/api/landing/instagram");
      if (!res.ok) throw new Error("Respuesta no OK");
      const data = await res.json();

      // tu tabla landing_instagram: {image_url, caption, href, order_index, is_active}
      const stories =
        Array.isArray(data) && data.length
          ? data.map((item) => ({
              image_url: item.image_url,
              caption: item.caption || "",
              href: item.href || "https://www.instagram.com/tierraquerida20/",
            }))
          : [];

      renderInstagramStories(stories);
    } catch (err) {
      console.error("[instagram] Error API:", err);
      renderInstagramStories([]);
    }
  }

  // =============================
  // INICIALIZACIÓN
  // =============================
  loadCategory(1);
  updateCartCount();
  applyUserUI();

  loadHeroFromApi();
  loadAboutFromApi();
  loadInstagramFromApi();

  window.addEventListener("pageshow", () => {
    updateCartCount();
    applyUserUI();
  });

  window.addEventListener("storage", (e) => {
    if (e.key === "cart" || e.key === "burgerCart") updateCartCount();
  });
});
