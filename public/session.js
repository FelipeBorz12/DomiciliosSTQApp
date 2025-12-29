// public/session.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ================= CONFIG ================= */
const SUPABASE_URL = window.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "";

// Si no hay keys en esta página, igual intentamos con burgerUser (fallback).
const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

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

function setHeaderUserName(name) {
  const el = document.getElementById("user-name-header");
  if (!el) return;
  el.textContent = name || "";
  el.classList.toggle("hidden", !name);
}

function setUserIconLogged(isLogged) {
  const btn = document.getElementById("user-icon");
  if (!btn) return;

  // Indicador visual (puntito)
  btn.dataset.logged = isLogged ? "1" : "0";
  btn.classList.toggle("ring-2", isLogged);
  btn.classList.toggle("ring-primary/60", isLogged);
}

function toggleMenuItems(isLogged) {
  // Menú móvil (si existe)
  const login = document.getElementById("mobile-login-item");
  const profile = document.getElementById("mobile-profile-item");
  const logout = document.getElementById("mobile-logout-item");

  if (login) login.classList.toggle("hidden", isLogged);
  if (profile) profile.classList.toggle("hidden", !isLogged);
  if (logout) logout.classList.toggle("hidden", !isLogged);
}

/* ================= AUTH STATE ================= */
async function getAuthState() {
  // 1) Preferir Supabase session
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const s = data?.session;
      if (s?.access_token) {
        return {
          logged: true,
          accessToken: s.access_token,
          email: s.user?.email || "",
        };
      }
    } catch {}
  }

  // 2) Fallback: burgerUser (si existe)
  const bu = getBurgerUser();
  if (bu?.correo) {
    return {
      logged: true,
      accessToken: null,
      email: bu.correo,
      fromLocal: true,
    };
  }

  return { logged: false, accessToken: null, email: "" };
}

async function refreshHeader() {
  const state = await getAuthState();

  setUserIconLogged(state.logged);

  const bu = getBurgerUser();
  const name = bu?.perfil?.nombre || bu?.correo || state.email || "";
  setHeaderUserName(state.logged ? name : "");

  toggleMenuItems(state.logged);
}

/* ================= NAV LOGIC ================= */
async function goAccountOrLogin() {
  const state = await getAuthState();
  if (state.logged) {
    window.location.href = "/account";
  } else {
    window.location.href = "/login";
  }
}

/* ================= LOGOUT (opcional global) ================= */
window.logoutUser = async function () {
  const modal = document.getElementById("logout-modal");
  if (modal) modal.classList.remove("hidden");

  try {
    if (supabase) await supabase.auth.signOut();
  } catch (e) {
    console.warn("[logoutUser] supabase.signOut error:", e);
  }

  try {
    localStorage.removeItem("burgerUser");
    // si tienes estas llaves en tu app:
    localStorage.removeItem("burgerCart");
    localStorage.removeItem("cart");
    sessionStorage.clear();
  } catch {}

  setTimeout(() => {
    window.location.href = "/login";
  }, 600);
};

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  // Botón usuario (header)
  const userBtn = document.getElementById("user-icon");
  if (userBtn) {
    userBtn.addEventListener("click", (e) => {
      e.preventDefault();
      goAccountOrLogin();
    });
  }

  // Botón perfil en menú móvil
  const mobileProfileBtn = document.getElementById("mobile-profile-btn");
  mobileProfileBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "/account";
  });

  // Botón logout en menú móvil
  const mobileLogoutBtn = document.getElementById("mobile-logout-btn");
  mobileLogoutBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    window.logoutUser?.();
  });

  // Pintar estado inicial
  await refreshHeader();

  // Si hay supabase, escuchar cambios de auth
  if (supabase) {
    supabase.auth.onAuthStateChange(async () => {
      await refreshHeader();
    });
  }
});
