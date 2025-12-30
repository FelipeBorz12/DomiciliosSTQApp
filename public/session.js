// public/session.js
(function () {
  "use strict";

  // =========================
  // Config
  // =========================
  const CART_KEYS = ["tqCart", "cart", "burgerCart", "tq_cart", "tq-cart"];
  const CART_PATH = window.TQ_CART_PATH || "/cart"; // cambia a "/cart.html" si lo usas así

  // =========================
  // Utils
  // =========================
  function clearSupabaseStorageEverywhere() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith("sb-")) localStorage.removeItem(k);
        if (k.includes("supabase.auth")) localStorage.removeItem(k);
      }
    } catch {}

    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (!k) continue;
        if (k.startsWith("sb-")) sessionStorage.removeItem(k);
        if (k.includes("supabase.auth")) sessionStorage.removeItem(k);
      }
    } catch {}

    try {
      localStorage.removeItem("burgerUser");
    } catch {}
  }

  function safePath(path) {
    if (!path) return "/";
    if (path.startsWith("http://") || path.startsWith("https://")) return "/";
    if (!path.startsWith("/")) return "/";
    if (path.startsWith("//")) return "/";
    return path;
  }

  function buildNext() {
    const p = safePath(window.location.pathname);
    const q = window.location.search || "";
    if (p.startsWith("/login") || p.startsWith("/auth/callback")) return "";
    return encodeURIComponent(p + q);
  }

  function goLoginWithNext(loginPath = "/login") {
    const next = buildNext();
    window.location.href = next ? `${loginPath}?next=${next}` : loginPath;
  }

  // ✅ si tu archivo es account.html, esto evita rutas raras
  function goAccount() {
    window.location.href = "/account.html";
  }

  function ensureSupabaseLoaded() {
    return new Promise((resolve) => {
      if (window.supabase && window.supabase.createClient) return resolve(true);

      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  function getSupabase() {
    if (window.__tqSupabase) return window.__tqSupabase;

    const supabaseLib = window.supabase;
    const url = window.SUPABASE_URL;
    const anonKey = window.SUPABASE_ANON_KEY;

    if (!supabaseLib || !supabaseLib.createClient) return null;
    if (!url || !anonKey) return null;

    window.__tqSupabase = supabaseLib.createClient(url, anonKey, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    return window.__tqSupabase;
  }

  async function getSession() {
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return null;

    const loaded = await ensureSupabaseLoaded();
    if (!loaded) return null;

    const sb = getSupabase();
    if (!sb) return null;

    const { data, error } = await sb.auth.getSession();
    if (error) {
      console.warn("[session.js] getSession error:", error);
      return null;
    }
    return data?.session || null;
  }

  async function isLoggedIn() {
    const s = await getSession();
    return !!s;
  }

  async function fetchMe() {
    const session = await getSession();
    if (!session?.user) return null;

    const u = session.user;
    return {
      id: u.id,
      email: u.email || null,
      phone: u.phone || null,
      user_metadata: u.user_metadata || {},
      created_at: u.created_at || null,
    };
  }

  async function goAccountOrLogin() {
    const logged = await isLoggedIn();
    if (logged) return goAccount();
    return goLoginWithNext("/login");
  }

  async function requireLoginOrRedirect(loginPath = "/login") {
    const logged = await isLoggedIn();
    if (!logged) {
      goLoginWithNext(loginPath);
      return false;
    }
    return true;
  }

  async function logout() {
    await ensureSupabaseLoaded();
    const sb = getSupabase();
    try {
      if (sb) {
        const { error } = await sb.auth.signOut({ scope: "local" });
        if (error) console.warn("[logout] signOut error:", error);
      }
    } catch (e) {
      console.warn("[logout] error:", e);
    } finally {
      clearSupabaseStorageEverywhere();
      window.location.replace("/");
    }
  }

  function formatMoney(n) {
    try {
      return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(Number(n || 0));
    } catch {
      return `$${n || 0}`;
    }
  }

  // =========================
  // Carrito (global)
  // =========================
  function tryParseJSON(v) {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }

  function normalizeCartItems(raw) {
    if (!raw) return [];

    // Caso 1: ya es array
    if (Array.isArray(raw)) return raw;

    // Caso 2: objeto con items
    if (typeof raw === "object") {
      if (Array.isArray(raw.items)) return raw.items;
      if (Array.isArray(raw.cart)) return raw.cart;
      if (Array.isArray(raw.productos)) return raw.productos;
      if (Array.isArray(raw.products)) return raw.products;
    }

    return [];
  }

  function getCartState() {
    for (const key of CART_KEYS) {
      const v = localStorage.getItem(key);
      if (!v) continue;
      const parsed = tryParseJSON(v);
      const items = normalizeCartItems(parsed);
      if (items && Array.isArray(items)) {
        return { key, raw: parsed, items };
      }
    }
    return { key: null, raw: null, items: [] };
  }

  function getCartCount() {
    const { items } = getCartState();
    if (!items?.length) return 0;

    let total = 0;
    for (const it of items) {
      const q =
        Number(it?.qty ?? it?.cantidad ?? it?.quantity ?? it?.count ?? 1) || 1;
      total += q;
    }
    return total;
  }

  function setText(el, txt) {
    if (!el) return;
    el.textContent = String(txt);
  }

  function updateCartBadges() {
    const count = getCartCount();

    // IDs típicos en tus páginas
    const cartCount = document.getElementById("cart-count");
    const cartBadge = document.getElementById("cart-count-badge");

    setText(cartCount, count);
    setText(cartBadge, count);

    // Mostrar/ocultar badge “puntico”
    // (en tu index el contenedor tiene class="cart-count ...", lo dejamos visible solo si hay items)
    const badgeWraps = document.querySelectorAll(".cart-count");
    badgeWraps.forEach((w) => {
      if (!w) return;
      w.classList.toggle("hidden", count <= 0);
    });

    // si hay spans badges alternativos, también
    if (cartBadge && cartBadge.parentElement) {
      cartBadge.parentElement.classList.toggle("hidden", count <= 0);
    }
  }

  function ensureEmptyCartModal() {
    // Si la página ya lo tiene (index), lo usamos
    let modal = document.getElementById("empty-cart-modal");
    if (modal) return modal;

    // Si no existe, lo creamos con el mismo estilo
    modal = document.createElement("div");
    modal.id = "empty-cart-modal";
    modal.className = "modal hidden";

    modal.innerHTML = `
      <div class="modal-backdrop fixed inset-0 bg-black/70 backdrop-blur-sm"></div>
      <div class="modal-content fixed inset-0 flex items-center justify-center p-4">
        <div class="relative max-w-sm w-full bg-[#120a0a] rounded-2xl p-5 shadow-2xl border border-white/10 flex flex-col gap-3">
          <button
            id="empty-cart-close"
            class="absolute top-3 right-3 text-gray-300 hover:text-[#e02424] transition-colors text-sm"
            aria-label="Cerrar"
            type="button"
          >✕</button>

          <h2 class="text-lg font-black text-white">Tu carrito está vacío</h2>
          <p class="text-sm text-white/70">
            Aún no has agregado nada. Explora el menú y arma tu pedido 🍔🍟
          </p>

          <button
            id="empty-cart-go"
            class="mt-2 inline-flex items-center justify-center px-4 py-3 rounded-full bg-[#e02424] hover:bg-red-700 text-white text-sm font-extrabold tracking-wide transition"
            type="button"
          >Ir al menú</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const backdrop = modal.querySelector(".modal-backdrop");
    const closeBtn = modal.querySelector("#empty-cart-close");
    const goBtn = modal.querySelector("#empty-cart-go");

    function closeEmptyCartModal() {
      modal.classList.add("hidden");
      modal.classList.remove("open");
    }

    closeBtn?.addEventListener("click", closeEmptyCartModal);
    backdrop?.addEventListener("click", closeEmptyCartModal);

    goBtn?.addEventListener("click", () => {
      closeEmptyCartModal();
      // ir a home y posicionar en menú
      window.location.href = "/#products-section";
    });

    return modal;
  }

  function openEmptyCartModal() {
    const modal = ensureEmptyCartModal();
    if (!modal) return;

    modal.classList.remove("hidden");
    modal.classList.add("open");
  }

  function goCartOrEmpty() {
    const count = getCartCount();
    if (count > 0) {
      window.location.href = CART_PATH;
    } else {
      openEmptyCartModal();
    }
  }

  function bindCartButtons() {
    const ids = ["cart-icon", "cart-btn", "cart-button"];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.dataset.tqCartBound === "1") return;
      el.dataset.tqCartBound = "1";

      el.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          goCartOrEmpty();
        },
        { capture: true }
      );
    });
  }

  function patchLocalStorageForCartUpdates() {
    if (window.__tqCartPatched) return;
    window.__tqCartPatched = true;

    try {
      const _setItem = localStorage.setItem.bind(localStorage);
      const _removeItem = localStorage.removeItem.bind(localStorage);

      localStorage.setItem = (k, v) => {
        _setItem(k, v);
        if (CART_KEYS.includes(k)) {
          updateCartBadges();
          window.dispatchEvent(new CustomEvent("tq:cart:updated"));
        }
      };

      localStorage.removeItem = (k) => {
        _removeItem(k);
        if (CART_KEYS.includes(k)) {
          updateCartBadges();
          window.dispatchEvent(new CustomEvent("tq:cart:updated"));
        }
      };
    } catch {}
  }

  // sync cross-tab
  window.addEventListener("storage", (e) => {
    if (!e?.key) return;
    if (CART_KEYS.includes(e.key)) updateCartBadges();
  });

  // =========================
  // Formulario + Cobertura + Pedidos (lo que ya tenías)
  // =========================
  async function fetchFormularioByCorreo(correo) {
    if (!correo) return null;

    await ensureSupabaseLoaded();
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase no inicializado");

    const { data, error } = await sb
      .from("formulario")
      .select("*")
      .eq("correo", correo)
      .order("id", { ascending: false })
      .limit(1);

    if (error) throw error;
    return data?.[0] || null;
  }

  async function saveFormulario(payload) {
    await ensureSupabaseLoaded();
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase no inicializado");
    if (!payload?.correo) throw new Error("Falta correo");

    const existing = await fetchFormularioByCorreo(payload.correo);

    if (existing?.id) {
      const { data, error } = await sb
        .from("formulario")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await sb
        .from("formulario")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    }
  }

  async function fetchDepartamentos() {
    await ensureSupabaseLoaded();
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase no inicializado");

    const { data, error } = await sb
      .from("Departamentos_list")
      .select('"Nombre"')
      .order('"Nombre"', { ascending: true });

    if (error) throw error;
    return (data || []).map((r) => r?.Nombre).filter(Boolean);
  }

  async function fetchMunicipiosByDepartamento(departamento) {
    await ensureSupabaseLoaded();
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase no inicializado");
    if (!departamento) return [];

    const { data, error } = await sb
      .from("Municipio_list")
      .select('"Nombre"')
      .eq('"Departamento"', departamento)
      .order('"Nombre"', { ascending: true });

    if (error) throw error;
    return (data || []).map((r) => r?.Nombre).filter(Boolean);
  }

  async function fetchBarriosByDeptMun(departamento, municipio) {
    await ensureSupabaseLoaded();
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase no inicializado");
    if (!departamento || !municipio) return [];

    const { data, error } = await sb
      .from("formulario")
      .select('"Barrio"')
      .eq('"Departamento"', departamento)
      .eq('"Municipio"', municipio)
      .limit(300);

    if (error) throw error;

    const barrios = (data || [])
      .map((r) => (r?.Barrio || "").trim())
      .filter((b) => b && b !== "...");

    return Array.from(new Set(barrios)).sort((a, b) => a.localeCompare(b, "es"));
  }

  function normalizePhone(v) {
    return String(v || "").replace(/\D/g, "");
  }

  async function fetchLastPedidosByCelular(celular, limit = 5) {
    await ensureSupabaseLoaded();
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase no inicializado");

    const cel = normalizePhone(celular);
    if (!cel) return [];

    const { data, error } = await sb
      .from("pedidos")
      .select("id, resumen_pedido, estado, total, created_at, puntoventa")
      .eq("celular_cliente", cel)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // ✅ IMPORTANTE: CAPTURE + stopImmediatePropagation para evitar listeners viejos
  function bindAccountButtons() {
    const ids = ["user-icon", "user-btn", "mobile-profile-btn"];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.dataset.tqBound === "1") return;
      el.dataset.tqBound = "1";

      el.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          goAccountOrLogin();
        },
        { capture: true }
      );
    });

    const logoutBtn = document.getElementById("mobile-logout-btn");
    if (logoutBtn && logoutBtn.dataset.tqBound !== "1") {
      logoutBtn.dataset.tqBound = "1";
      logoutBtn.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          logout();
        },
        { capture: true }
      );
    }
  }

  async function syncMobileMenu() {
    const logged = await isLoggedIn();

    const loginItem = document.getElementById("mobile-login-item");
    const profileItem = document.getElementById("mobile-profile-item");
    const logoutItem = document.getElementById("mobile-logout-item");

    if (loginItem) loginItem.classList.toggle("hidden", logged);
    if (profileItem) profileItem.classList.toggle("hidden", !logged);
    if (logoutItem) logoutItem.classList.toggle("hidden", !logged);
  }

  // =========================
  // Exponer API
  // =========================
  window.tqSession = {
    // core
    getSupabase,
    client: getSupabase(),
    getSession,
    isLoggedIn,
    fetchMe,
    logout,
    goAccountOrLogin,
    requireLoginOrRedirect,
    bindAccountButtons,

    // utils
    formatMoney,

    // cart
    CART_PATH,
    getCartCount,
    updateCartBadges,
    goCartOrEmpty,
    openEmptyCartModal,

    // formulario
    fetchFormularioByCorreo,
    saveFormulario,

    // cobertura
    fetchDepartamentos,
    fetchMunicipiosByDepartamento,
    fetchBarriosByDeptMun,

    // pedidos
    fetchLastPedidosByCelular,
  };

  // =========================
  // Boot
  // =========================
  document.addEventListener("DOMContentLoaded", () => {
    bindAccountButtons();
    bindCartButtons();
    patchLocalStorageForCartUpdates();

    // contador apenas carga
    updateCartBadges();

    // y menú móvil
    syncMobileMenu();
  });

  // si alguna página dispara esto manualmente
  window.addEventListener("tq:cart:updated", updateCartBadges);
})();
