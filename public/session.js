// /public/session.js
// Depende de window.Auth y window.sb

(function () {
  async function init() {
    if (!window.Auth || !window.sb) {
      console.error("[session] Faltan auth.js o supabaseClient.js");
      return;
    }

    const userBtn = document.getElementById("user-icon");
    const userNameHeader = document.getElementById("user-name-header");

    const mobileLoginItem = document.getElementById("mobile-login-item");
    const mobileProfileItem = document.getElementById("mobile-profile-item");
    const mobileLogoutItem = document.getElementById("mobile-logout-item");
    const mobileProfileBtn = document.getElementById("mobile-profile-btn");
    const mobileLogoutBtn = document.getElementById("mobile-logout-btn");

    const session = await window.Auth.getSession();
    const isLogged = !!session;

    // ---- UI estado login ----
    if (mobileLoginItem && mobileProfileItem && mobileLogoutItem) {
      if (isLogged) {
        mobileLoginItem.classList.add("hidden");
        mobileProfileItem.classList.remove("hidden");
        mobileLogoutItem.classList.remove("hidden");
      } else {
        mobileLoginItem.classList.remove("hidden");
        mobileProfileItem.classList.add("hidden");
        mobileLogoutItem.classList.add("hidden");
      }
    }

    // ---- Nombre en header (si logueado) ----
    if (isLogged && userNameHeader) {
      // intenta traer tu perfil desde tu API (más completo)
      try {
        const me = await window.Auth.fetchMe();
        const nombre =
          me?.perfil?.nombre ||
          session?.user?.user_metadata?.nombre ||
          session?.user?.email ||
          "";
        userNameHeader.textContent = nombre;
      } catch {
        userNameHeader.textContent = session?.user?.email || "";
      }
    } else if (userNameHeader) {
      userNameHeader.textContent = "";
    }

    // ---- Click en icono usuario ----
    // ✅ Si logueado -> /account
    // ✅ Si no -> /login
    userBtn?.addEventListener("click", async () => {
      const s = await window.Auth.getSession();
      if (s) window.location.href = "/account";
      else window.location.href = "/login";
    });

    mobileProfileBtn?.addEventListener("click", async () => {
      const s = await window.Auth.getSession();
      if (s) window.location.href = "/account";
      else window.location.href = "/login";
    });

    mobileLogoutBtn?.addEventListener("click", () => window.Auth.signOut());

    // ---- Si estás en login y ya hay sesión, redirige ----
    const path = window.location.pathname;
    if ((path === "/login" || path === "/login.html") && isLogged) {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      window.location.href = next || "/";
      return;
    }

    // ---- Mantener UI en cambios de sesión (OAuth callback / refresh) ----
    window.sb.auth.onAuthStateChange(async (_event, _session) => {
      // refresca rápido la página actual para que el estado sea consistente
      // (especialmente después del callback de Google)
      if (window.location.pathname === "/login" || window.location.pathname === "/login.html") {
        const params = new URLSearchParams(window.location.search);
        const next = params.get("next");
        window.location.href = next || "/";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
