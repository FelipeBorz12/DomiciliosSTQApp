// public/account.js
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

function saveBurgerUser(u) {
  localStorage.setItem("burgerUser", JSON.stringify(u));
}

function el(id) {
  return document.getElementById(id);
}

function fmtMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "");
  return n.toLocaleString("es-CO", { style: "currency", currency: "COP" });
}

async function loadOrders(correo) {
  const loading = el("orders-loading");
  const empty = el("orders-empty");
  const list = el("orders-list");
  const count = el("orders-count");

  try {
    loading.classList.remove("hidden");
    empty.classList.add("hidden");
    list.classList.add("hidden");
    list.innerHTML = "";

    const res = await fetch(`/api/pedidos?correo=${encodeURIComponent(correo)}`);
    const data = await res.json().catch(() => []);
    const orders = Array.isArray(data) ? data : [];

    count.textContent = `${orders.length} pedidos`;

    if (!orders.length) {
      loading.classList.add("hidden");
      empty.classList.remove("hidden");
      return;
    }

    const html = orders.map((o) => {
      const id = o?.id ?? "—";
      const fecha = o?.created_at ? new Date(o.created_at).toLocaleString("es-CO") : "";
      const total = o?.total ?? o?.valor_total ?? o?.monto ?? "";
      const estado = o?.estado ?? o?.status ?? "—";

      return `
        <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-extrabold">Pedido #${id}</p>
              <p class="text-xs text-white/60">${fecha}</p>
            </div>
            <div class="text-right">
              <p class="text-sm font-extrabold text-primary">${fmtMoney(total)}</p>
              <p class="text-xs text-white/60">${estado}</p>
            </div>
          </div>
        </div>
      `;
    }).join("");

    list.innerHTML = html;
    loading.classList.add("hidden");
    list.classList.remove("hidden");
  } catch (e) {
    console.warn("[orders] error:", e);
    loading.textContent = "No se pudieron cargar los pedidos.";
    if (count) count.textContent = "—";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const u = getBurgerUser();
  if (!u) {
    window.location.replace("/login");
    return;
  }

  // fill form
  el("p-name").value = u?.perfil?.nombre || "";
  el("p-email").value = u?.correo || "";
  el("p-phone").value = u?.perfil?.celular || "";
  el("p-address").value = u?.perfil?.direccionentrega || "";

  // load orders
  await loadOrders(u.correo);

  // save local
  el("profile-form").addEventListener("submit", (e) => {
    e.preventDefault();

    const next = { ...u };
    next.perfil = { ...(u.perfil || {}) };
    next.perfil.nombre = el("p-name").value.trim();
    next.perfil.celular = el("p-phone").value.trim();
    next.perfil.direccionentrega = el("p-address").value.trim();

    saveBurgerUser(next);

    // repintar header
    if (window.TQSession?.paintUser) window.TQSession.paintUser();

    const hint = el("save-hint");
    hint.classList.remove("hidden");
    setTimeout(() => hint.classList.add("hidden"), 1200);
  });

  // logout
  el("logout-btn").addEventListener("click", async () => {
    if (typeof window.logoutUser === "function") {
      await window.logoutUser();
      return;
    }
    // fallback
    localStorage.removeItem("burgerUser");
    window.location.replace("/login");
  });
});
