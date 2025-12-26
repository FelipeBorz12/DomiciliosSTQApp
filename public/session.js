// public/session.js
(function () {
  const STORAGE_KEY = "burgerUser";

  function getUser() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setUser(user) {
    if (!user) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }

  function isLogged() {
    const u = getUser();
    return !!(u && u.correo);
  }

  function goLogin() {
    window.location.href = "/login";
  }

  function goHistory() {
    const user = getUser();
    if (user?.correo) {
      window.location.href = `/history?correo=${encodeURIComponent(user.correo)}`;
    } else {
      goLogin();
    }
  }

  function logout() {
    setUser(null);
    window.location.href = "/";
  }

  // 🔑 Intercepta TODOS los botones de perfil
  function bindProfileButtons() {
    const candidates = document.querySelectorAll(
      '[aria-label="Perfil"], [aria-label="Cuenta"], .user-btn'
    );

    candidates.forEach((btn) => {
      // elimina onclick HTML duro
      btn.onclick = null;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isLogged()) goHistory();
        else goLogin();
      });
    });
  }

  // Opcional: esconder links login si ya hay sesión
  function hideLoginLinks() {
    if (!isLogged()) return;
    document.querySelectorAll('a[href="/login"]').forEach((a) => {
      a.classList.add("hidden");
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindProfileButtons();
    hideLoginLinks();
  });

  // API pública por si otros scripts la necesitan
  window.Session = {
    getUser,
    setUser,
    isLogged,
    logout,
    goLogin,
    goHistory,
  };
})();
