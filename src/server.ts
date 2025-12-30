// src/server.ts
import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { verifyTurnstile } from "./middleware/turnstile";

// ✅ Importa los 2 clientes desde el módulo centralizado
import { supabaseAdmin, supabaseAnon } from "./supabaseClient";

dotenv.config();

// ===================== ENV =====================
const PORT = Number(process.env.PORT || 3005);

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";

// ✅ CORS (permite varios orígenes por coma)
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ===================== APP =====================
const app = express();

// -------------------- MIDDLEWARES --------------------
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(cookieParser());

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0) return cb(null, true);
      return cb(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

// Health
app.get("/health", (_req, res) => res.status(200).send("ok"));

// Favicon
app.get("/favicon.ico", (_req, res) => res.status(204).end());

// -------------------- STATIC --------------------
const publicPath = path.join(__dirname, "..", "public");
app.use(express.static(publicPath));

// -------------------- HELPERS --------------------
function normalizeEmail(email: any) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function requireAuthSupabase(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const auth = req.header("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) return res.status(401).json({ message: "Falta Bearer token" });

    // ✅ Validación con supabaseAnon (no admin)
    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (error || !data?.user)
      return res.status(401).json({ message: "Token inválido" });

    (req as any).authUser = data.user; // { id, email, user_metadata, ... }
    next();
  } catch (e) {
    console.error("[requireAuthSupabase] error:", e);
    return res.status(500).json({ message: "Error validando sesión" });
  }
}

// Rate limit auth (anti brute force)
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 35,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Demasiados intentos. Intenta más tarde." },
});

// ===================== PAGES =====================
app.get("/", (_req, res) => res.sendFile(path.join(publicPath, "index.html")));
app.get("/login", (_req, res) =>
  res.sendFile(path.join(publicPath, "login.html"))
);
app.get("/register", (_req, res) =>
  res.sendFile(path.join(publicPath, "register.html"))
);
app.get("/recover", (_req, res) =>
  res.sendFile(path.join(publicPath, "recover.html"))
);
app.get("/product", (_req, res) =>
  res.sendFile(path.join(publicPath, "product.html"))
);
app.get("/cart", (_req, res) => res.sendFile(path.join(publicPath, "cart.html")));
app.get("/confirm", (_req, res) =>
  res.sendFile(path.join(publicPath, "confirm.html"))
);
app.get("/stores", (_req, res) =>
  res.sendFile(path.join(publicPath, "store.html"))
);
app.get("/history", (_req, res) =>
  res.sendFile(path.join(publicPath, "history.html"))
);

// ✅ Ruta account
app.get("/account", (_req, res) =>
  res.sendFile(path.join(publicPath, "account.html"))
);

app.get("/auth/callback", (_req, res) =>
  res.sendFile(path.join(publicPath, "auth-callback.html"))
);

// ===================== ANTI-BOT =====================
app.post(
  "/api/antibot/verify",
  verifyTurnstile,
  (_req: Request, res: Response) => {
    return res.json({ ok: true });
  }
);

// ===================== API: LANDING =====================
app.get("/api/landing/hero", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("landing_hero")
      .select("id, title, description, tag, image_url, order_index, is_active")
      .eq("is_active", true)
      .order("order_index", { ascending: true });

    if (error) return res.json([]);
    return res.json(data || []);
  } catch {
    return res.json([]);
  }
});

app.get("/api/landing/about", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("landing_about")
      .select(
        "id, title, tagline, body, image_url, badge_text, cta_text, cta_href, instagram_handle"
      )
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) return res.json(null);
    return res.json(data || null);
  } catch {
    return res.json(null);
  }
});

app.get("/api/landing/instagram", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("landing_instagram")
      .select("id, image_url, caption, href, order_index, is_active")
      .eq("is_active", true)
      .order("order_index", { ascending: true });

    if (error) return res.json([]);
    return res.json(data || []);
  } catch {
    return res.json([]);
  }
});

// ===================== API: MENU =====================
app.get("/api/menu", async (req: Request, res: Response) => {
  try {
    const { tipo } = req.query;

    let query = supabaseAdmin
      .from("menu")
      .select(
        'id, "Nombre", "Descripcion", "PrecioOriente", "PrecioRestoPais", "PrecioAreaMetrop", tipo, "Activo", imagen'
      )
      .eq("Activo", 1);

    if (tipo) query = query.eq("tipo", Number(tipo));

    const { data, error } = await query.order("id", { ascending: true });

    if (error) {
      console.error("[GET /api/menu] error supabase:", error);
      return res.status(500).json({ message: "Error al obtener menú" });
    }

    return res.json(data || []);
  } catch (err) {
    console.error("[GET /api/menu] error inesperado:", err);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

app.get("/api/menu/item/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id))
      return res.status(400).json({ message: "ID inválido" });

    const { data, error } = await supabaseAdmin
      .from("menu")
      .select(
        'id, "Nombre", "Descripcion", "PrecioOriente", "PrecioRestoPais", "PrecioAreaMetrop", tipo, "Activo", imagen'
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/menu/item/:id] error supabase:", error);
      return res.status(500).json({ message: "Error al obtener producto" });
    }

    if (!data) return res.status(404).json({ message: "Producto no encontrado" });
    return res.json(data);
  } catch (err) {
    console.error("[GET /api/menu/item/:id] error inesperado:", err);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

// ===================== API: AUTH (bcrypt + Supabase sesión) =====================

// ✅ Verificar si existe correo (para decidir login vs register)
app.get("/api/auth/exists", async (req, res) => {
  try {
    const correo = normalizeEmail(req.query?.correo);
    if (!correo) return res.status(400).json({ exists: false, message: "Falta correo" });

    const { data, error } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("correo", correo)
      .maybeSingle();

    if (error) {
      console.warn("[/api/auth/exists] error:", error);
      return res.status(200).json({ exists: false });
    }

    return res.status(200).json({ exists: !!data });
  } catch (e) {
    console.error("[/api/auth/exists] error:", e);
    return res.status(200).json({ exists: false });
  }
});

// ✅ Registro: crea usuario en Supabase Auth + guarda bcrypt hash + guarda perfil
app.post("/api/auth/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const nombre = String(req.body?.nombre || "").trim();
    const correo = normalizeEmail(req.body?.correo);
    const contrasena = String(req.body?.contrasena || "");

    const tipodocumento = String(req.body?.tipodocumento || "");
    const documento = String(req.body?.documento || "");
    const celularRaw = String(req.body?.celular || "");
    const direccionentrega = String(req.body?.direccionentrega || "");
    const Departamento = String(req.body?.Departamento || "...");
    const Municipio = String(req.body?.Municipio || "...");
    const Barrio = String(req.body?.Barrio || "...");

    if (!nombre || !correo || !contrasena) {
      return res.status(400).json({
        message: "Nombre, correo y contraseña son obligatorios",
      });
    }
    if (!isValidEmail(correo))
      return res.status(400).json({ message: "Correo inválido" });
    if (contrasena.length < 8) {
      return res.status(400).json({
        message: "La contraseña debe tener mínimo 8 caracteres",
      });
    }

    // Si ya existe en usuarios -> conflicto
    const { data: already } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("correo", correo)
      .maybeSingle();

    if (already?.id) {
      return res.status(409).json({ message: "El correo ya está registrado" });
    }

    // bcrypt hash (tu control)
    const contrasena_hash = await bcrypt.hash(contrasena, 10);

    // 1) Crear user en Supabase Auth (admin)
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: correo,
        password: contrasena,
        email_confirm: true,
        user_metadata: { nombre, password_set: true },
      });

    if (createErr || !created?.user) {
      return res.status(400).json({
        message: createErr?.message || "Error creando usuario",
      });
    }

    const authUserId = created.user.id;

    // 2) Insert en usuarios con hash
    const { error: uErr } = await supabaseAdmin
      .from("usuarios")
      .insert([{ correo, Rol: "0", auth_user_id: authUserId, contrasena_hash }]);

    if (uErr) {
      console.error("[register] insert usuarios:", uErr);
      return res.status(500).json({ message: "Error guardando usuario" });
    }

    // 3) Upsert en formulario
    const celular = celularRaw
      ? Number(String(celularRaw).replace(/\D/g, ""))
      : 0;

    const { error: fErr } = await supabaseAdmin.from("formulario").upsert(
      [
        {
          correo,
          nombre,
          tipodocumento,
          documento,
          celular: Number.isFinite(celular) ? celular : 0,
          direccionentrega,
          Departamento,
          Municipio,
          Barrio,
        },
      ],
      { onConflict: "correo" }
    );

    if (fErr) {
      console.error("[register] upsert formulario:", fErr);
      return res.status(500).json({
        message: "Usuario creado, pero error al guardar datos",
      });
    }

    return res.status(201).json({ message: "Registro exitoso" });
  } catch (err) {
    console.error("[POST /api/auth/register] error inesperado:", err);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

// ✅ Login manual: verifica bcrypt contra usuarios.contrasena_hash
// y luego crea sesión Supabase (para que el front tenga access_token/refresh_token)
app.post("/api/auth/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const correo = normalizeEmail(req.body?.correo);
    const contrasena = String(req.body?.contrasena || "");

    if (!correo || !contrasena) {
      return res.status(400).json({ message: "Correo y contraseña son obligatorios" });
    }
    if (!isValidEmail(correo)) return res.status(400).json({ message: "Correo inválido" });

    // buscar user en tu tabla
    const { data: u, error: uErr } = await supabaseAdmin
      .from("usuarios")
      .select('id, correo, "Rol", auth_user_id, contrasena_hash')
      .eq("correo", correo)
      .maybeSingle();

    if (uErr) {
      console.error("[/api/auth/login] usuarios error:", uErr);
      return res.status(500).json({ message: "Error buscando usuario" });
    }

    if (!u) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (!u.contrasena_hash) {
      // existe pero no tiene password en DB -> obligar a setear
      return res.status(409).json({
        message: "Este usuario aún no tiene contraseña. Inicia con Google y crea tu contraseña.",
        code: "PASSWORD_NOT_SET",
      });
    }

    const ok = await bcrypt.compare(contrasena, String(u.contrasena_hash || ""));
    if (!ok) {
      return res.status(401).json({ message: "Contraseña incorrecta" });
    }

    // ✅ iniciar sesión en Supabase Auth para que el front tenga token
    const { data: sData, error: sErr } = await supabaseAnon.auth.signInWithPassword({
      email: correo,
      password: contrasena,
    });

    if (sErr || !sData?.session) {
      console.error("[/api/auth/login] supabase signIn error:", sErr);
      return res.status(500).json({
        message:
          "Contraseña válida, pero no se pudo iniciar sesión en Supabase. Verifica que el usuario tenga password en Supabase Auth.",
      });
    }

    return res.status(200).json({
      ok: true,
      usuario: { id: u.id, correo: u.correo, rol: u.Rol, auth_user_id: u.auth_user_id || null },
      session: sData.session, // access_token + refresh_token
    });
  } catch (e) {
    console.error("[/api/auth/login] error:", e);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

// ✅ Google: verificar si el correo ya existe en "usuarios"
app.post("/api/auth/google/status", requireAuthSupabase, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as any;
    const correo = normalizeEmail(authUser?.email || "");
    if (!correo || !isValidEmail(correo)) return res.status(400).json({ message: "Email inválido" });

    const { data: u, error: uErr } = await supabaseAdmin
      .from("usuarios")
      .select('id, correo, contrasena_hash')
      .eq("correo", correo)
      .maybeSingle();

    if (uErr) {
      console.error("[google/status] error usuarios:", uErr);
      return res.status(500).json({ message: "Error validando usuario" });
    }

    if (!u) return res.status(200).json({ exists: false, needs_password: true, correo });

    // existe, pero si no tiene hash, exigir contraseña
    const needs_password = !u.contrasena_hash;
    return res.status(200).json({ exists: true, needs_password, correo });
  } catch (e) {
    console.error("[google/status] error:", e);
    return res.status(500).json({ message: "Error inesperado" });
  }
});

// ✅ Google: completar registro (crear usuario en tabla + setear password en Supabase + guardar formulario)
app.post("/api/auth/google/complete", requireAuthSupabase, authLimiter, async (req: Request, res: Response) => {
  try {
    const authUser = (req as any).authUser as any;

    const correo = normalizeEmail(authUser?.email || "");
    if (!correo || !isValidEmail(correo)) return res.status(400).json({ message: "Email inválido" });

    const contrasena = String(req.body?.contrasena || "");
    if (contrasena.length < 8) {
      return res.status(400).json({ message: "La contraseña debe tener mínimo 8 caracteres" });
    }

    // Datos opcionales
    const nombre =
      String(req.body?.nombre || authUser?.user_metadata?.full_name || authUser?.user_metadata?.nombre || "").trim();

    const tipodocumento = String(req.body?.tipodocumento || "");
    const documento = String(req.body?.documento || "");
    const celularRaw = String(req.body?.celular || "");
    const direccionentrega = String(req.body?.direccionentrega || "");
    const Departamento = String(req.body?.Departamento || "...");
    const Municipio = String(req.body?.Municipio || "...");
    const Barrio = String(req.body?.Barrio || "...");

    const contrasena_hash = await bcrypt.hash(contrasena, 10);

    // 1) asegurar password en Supabase Auth (para login manual futuro)
    const up = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      password: contrasena,
      user_metadata: { ...(authUser?.user_metadata || {}), nombre, password_set: true },
    });

    if (up.error) {
      console.error("[google/complete] updateUserById error:", up.error);
      return res.status(500).json({ message: "No se pudo guardar contraseña (Supabase)" });
    }

    // 2) upsert usuarios con hash + auth_user_id
    const { error: uErr } = await supabaseAdmin
      .from("usuarios")
      .upsert(
        [{ correo, Rol: "0", auth_user_id: authUser.id, contrasena_hash }],
        { onConflict: "correo" }
      );

    if (uErr) {
      console.error("[google/complete] upsert usuarios:", uErr);
      return res.status(500).json({ message: "Error guardando usuario" });
    }

    // 3) upsert formulario
    const celular = celularRaw ? Number(String(celularRaw).replace(/\D/g, "")) : 0;

    const { error: fErr } = await supabaseAdmin.from("formulario").upsert(
      [
        {
          correo,
          nombre,
          tipodocumento,
          documento,
          celular: Number.isFinite(celular) ? celular : 0,
          direccionentrega,
          Departamento,
          Municipio,
          Barrio,
        },
      ],
      { onConflict: "correo" }
    );

    if (fErr) {
      console.error("[google/complete] upsert formulario:", fErr);
      // no bloqueamos login, pero lo reportamos
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[google/complete] error:", e);
    return res.status(500).json({ message: "Error inesperado" });
  }
});

// ✅ /api/auth/me: valida Bearer token y devuelve perfil/rol
app.get("/api/auth/me", requireAuthSupabase, async (req: Request, res: Response) => {
  try {
    const user = (req as any).authUser as any;
    const correo = normalizeEmail(user?.email || "");
    if (!correo || !isValidEmail(correo))
      return res.status(400).json({ message: "Email inválido" });

    // Asegura fila en usuarios (para Google users)
    await supabaseAdmin
      .from("usuarios")
      .upsert([{ correo, Rol: "0", auth_user_id: user.id }], {
        onConflict: "correo",
      });

    const { data: urow } = await supabaseAdmin
      .from("usuarios")
      .select('id, correo, "Rol", auth_user_id')
      .eq("correo", correo)
      .maybeSingle();

    const { data: form } = await supabaseAdmin
      .from("formulario")
      .select('nombre, celular, direccionentrega, "Departamento", "Municipio", "Barrio"')
      .eq("correo", correo)
      .maybeSingle();

    return res.json({
      userId: (urow as any)?.id ?? null,
      rol: (urow as any)?.Rol ?? "0",
      correo,
      auth_user_id: (urow as any)?.auth_user_id ?? user.id,
      perfil: form || null,
    });
  } catch (e) {
    console.error("[GET /api/auth/me] error:", e);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

// (compat) /api/auth/user?correo=...
app.get("/api/auth/user", async (req: Request, res: Response) => {
  try {
    const correo = normalizeEmail(req.query.correo as string);
    if (!correo || !isValidEmail(correo))
      return res.status(400).json({ message: "Correo inválido" });

    const { data: user, error } = await supabaseAdmin
      .from("usuarios")
      .select('id, correo, "Rol", auth_user_id')
      .eq("correo", correo)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/auth/user] error usuarios:", error);
      return res.status(500).json({ message: "Error buscando usuario" });
    }
    if (!user) return res.status(404).json({ message: "No encontrado" });

    const { data: form, error: formError } = await supabaseAdmin
      .from("formulario")
      .select('nombre, celular, direccionentrega, "Departamento", "Municipio", "Barrio"')
      .eq("correo", correo)
      .maybeSingle();

    if (formError) console.error("[GET /api/auth/user] error formulario:", formError);

    return res.json({
      userId: (user as any).id,
      rol: (user as any).Rol,
      correo: (user as any).correo,
      auth_user_id: (user as any).auth_user_id || null,
      perfil: form || null,
    });
  } catch (err) {
    console.error("[GET /api/auth/user] error inesperado:", err);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

app.post("/api/auth/recover", authLimiter, async (req: Request, res: Response) => {
  try {
    const correo = normalizeEmail(req.body?.correo);
    if (!correo || !isValidEmail(correo)) {
      return res.status(400).json({ message: "Correo es obligatorio" });
    }
    console.log("[Recover] Solicitud de recuperación para:", correo);
    return res.json({ message: "Si el correo existe, te enviaremos instrucciones." });
  } catch (err) {
    console.error("[POST /api/auth/recover] error inesperado:", err);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

// ===================== API: PUNTOS DE VENTA =====================
app.get("/api/puntos-venta", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("Coordenadas_PV")
      .select(
        'id, "Departamento", "Municipio", "Direccion", "Latitud", "Longitud", "Barrio", num_whatsapp, "URL_image"'
      );

    if (error) {
      console.error("[GET /api/puntos-venta] error supabase:", error);
      return res.status(500).json({ message: "Error al obtener puntos de venta" });
    }

    return res.json(data || []);
  } catch (err) {
    console.error("[GET /api/puntos-venta] error inesperado:", err);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

// ===================== API: PEDIDOS =====================
app.get("/api/pedidos", async (req: Request, res: Response) => {
  try {
    const correo = normalizeEmail(req.query.correo as string);

    if (!correo) {
      return res.status(400).json({ message: 'El parámetro "correo" es obligatorio' });
    }

    const { data, error } = await supabaseAdmin
      .from("pedidos")
      .select("*")
      .eq("nombre_cliente", correo)
      .order("id", { ascending: false });

    if (error) {
      console.error("[GET /api/pedidos] error supabase:", error);
      return res.status(500).json({
        message: "Error al obtener pedidos",
        detail: error.message,
      });
    }

    return res.json(data || []);
  } catch (err) {
    console.error("[GET /api/pedidos] error inesperado:", err);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

app.post("/api/pedidos", async (_req: Request, res: Response) => {
  return res.status(501).json({
    message:
      "Pega aquí tu bloque de /api/pedidos tal cual y cambia supabase->supabaseAdmin",
  });
});

// ===================== FALLBACKS =====================
app.use("/api", (_req, res) =>
  res.status(404).json({ message: "Ruta API no encontrada" })
);

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[SERVER ERROR]", err);
  return res.status(500).json({ message: "Error inesperado en el servidor" });
});

// ===================== LISTEN =====================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor escuchando en http://0.0.0.0:${PORT}`);
  console.log("NODE_ENV:", NODE_ENV);
  console.log("CORS_ORIGIN:", process.env.CORS_ORIGIN || "(no definido)");
  console.log("IS_PROD:", IS_PROD);
});
