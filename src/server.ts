// src/server.ts
import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
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

function normalizePhoneCO(raw: any) {
  // Devuelve formato "+57XXXXXXXXXX" o "" si no se puede
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+57${digits}`;
  if (digits.length === 12 && digits.startsWith("57")) return `+${digits}`;
  if (digits.length > 10) return `+57${digits.slice(-10)}`;
  return "";
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

    (req as any).authUser = data.user;
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
app.get("/cart", (_req, res) =>
  res.sendFile(path.join(publicPath, "cart.html"))
);
app.get("/confirm", (_req, res) =>
  res.sendFile(path.join(publicPath, "confirm.html"))
);
app.get("/stores", (_req, res) =>
  res.sendFile(path.join(publicPath, "store.html"))
);

// ✅ Historial (usar ESTE, sin rutas nuevas)
app.get("/history", (_req, res) =>
  res.sendFile(path.join(publicPath, "history.html"))
);

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

// ===================== API: AUTH (Supabase Auth) =====================

// ✅ Verificar si existe correo (para decidir login vs register)
app.get("/api/auth/exists", async (req, res) => {
  try {
    const correo = normalizeEmail(req.query?.correo);
    if (!correo)
      return res.status(400).json({ exists: false, message: "Falta correo" });

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

// ✅ Registro: crea usuario en Supabase Auth + guarda fila en usuarios + formulario
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
      return res
        .status(400)
        .json({ message: "Nombre, correo y contraseña son obligatorios" });
    }
    if (!isValidEmail(correo))
      return res.status(400).json({ message: "Correo inválido" });
    if (contrasena.length < 8) {
      return res
        .status(400)
        .json({ message: "La contraseña debe tener mínimo 8 caracteres" });
    }

    // Si ya existe en usuarios -> conflicto
    const { data: already } = await supabaseAdmin
      .from("usuarios")
      .select("id")
      .eq("correo", correo)
      .maybeSingle();

    if (already?.id)
      return res.status(409).json({ message: "El correo ya está registrado" });

    // 1) Crear user en Supabase Auth (admin)
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: correo,
        password: contrasena,
        email_confirm: true,
        user_metadata: { nombre },
      });

    if (createErr || !created?.user) {
      return res
        .status(400)
        .json({ message: createErr?.message || "Error creando usuario" });
    }

    const authUserId = created.user.id;

    // 2) Insert en usuarios
    const { error: uErr } = await supabaseAdmin
      .from("usuarios")
      .insert([{ correo, Rol: "0", auth_user_id: authUserId }]);

    if (uErr) {
      console.error("[register] insert usuarios:", uErr);
      return res.status(500).json({ message: "Error guardando usuario" });
    }

    // 3) Upsert en formulario
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
      console.error("[register] upsert formulario:", fErr);
      return res
        .status(500)
        .json({ message: "Usuario creado, pero error al guardar datos" });
    }

    return res.status(201).json({ message: "Registro exitoso" });
  } catch (err) {
    console.error("[POST /api/auth/register] error inesperado:", err);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

// ❌ Login manual por API ya NO se usa
app.post("/api/auth/login", authLimiter, (_req: Request, res: Response) => {
  return res
    .status(410)
    .json({ message: "Login se hace con Supabase Auth en el frontend." });
});

// ✅ /api/auth/me: valida Bearer token y devuelve perfil/rol
app.get("/api/auth/me", requireAuthSupabase, async (req: Request, res: Response) => {
  try {
    const user = (req as any).authUser as any;
    const correo = normalizeEmail(user?.email || "");
    if (!correo || !isValidEmail(correo))
      return res.status(400).json({ message: "Email inválido" });

    await supabaseAdmin
      .from("usuarios")
      .upsert([{ correo, Rol: "0", auth_user_id: user.id }], { onConflict: "correo" });

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

// ✅ Guardar perfil (lo usa account.js)
app.put("/api/profile", requireAuthSupabase, authLimiter, async (req: Request, res: Response) => {
  try {
    const user = (req as any).authUser as any;
    const correo = normalizeEmail(user?.email || "");
    if (!correo || !isValidEmail(correo))
      return res.status(400).json({ message: "Email inválido" });

    const nombre = String(req.body?.nombre || "").trim();
    const celularRaw = String(req.body?.celular || "");
    const direccionentrega = String(req.body?.direccionentrega || "").trim();
    const Departamento = String(req.body?.Departamento || "...").trim() || "...";
    const Municipio = String(req.body?.Municipio || "...").trim() || "...";
    const Barrio = String(req.body?.Barrio || "...").trim() || "...";

    const celular = celularRaw ? Number(String(celularRaw).replace(/\D/g, "")) : 0;

    const { error } = await supabaseAdmin.from("formulario").upsert(
      [
        {
          correo,
          nombre,
          celular: Number.isFinite(celular) ? celular : 0,
          direccionentrega,
          Departamento,
          Municipio,
          Barrio,
        },
      ],
      { onConflict: "correo" }
    );

    if (error) {
      console.error("[PUT /api/profile] error:", error);
      return res.status(500).json({ message: "No se pudo guardar el perfil" });
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("[PUT /api/profile] error:", e);
    return res.status(500).json({ message: "Error inesperado" });
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

// ✅ Listado (por correo como lo tenías, y opcional por celular)
app.get("/api/pedidos", async (req: Request, res: Response) => {
  try {
    const correo = normalizeEmail(req.query.correo as string);
    const celular = String(req.query.celular || "").trim();

    if (!correo && !celular) {
      return res.status(400).json({
        message: 'Debes enviar "correo" o "celular" como query param',
      });
    }

    let query = supabaseAdmin
      .from("pedidos")
      .select("*")
      .order("id", { ascending: false });

    if (correo) {
      // Compatibilidad: tu tabla guarda el correo en nombre_cliente
      query = query.eq("nombre_cliente", correo);
    } else {
      const phone = normalizePhoneCO(celular);
      if (!phone) return res.status(400).json({ message: "Celular inválido" });
      query = query.eq("celular_cliente", phone);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[GET /api/pedidos] error supabase:", error);
      return res.status(500).json({ message: "Error al obtener pedidos", detail: error.message });
    }

    return res.json(data || []);
  } catch (err) {
    console.error("[GET /api/pedidos] error inesperado:", err);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

// ✅ Crear pedido REAL
app.post("/api/pedidos", verifyTurnstile, async (req: Request, res: Response) => {
  try {
    const correo = normalizeEmail(
      req.body?.nombre_cliente || req.body?.correo || req.body?.correo_cliente
    );
    if (!correo || !isValidEmail(correo)) {
      return res.status(400).json({ message: "Correo inválido en nombre_cliente" });
    }

    const direccion_cliente = String(req.body?.direccion_cliente || "").trim();
    const celular_cliente = normalizePhoneCO(req.body?.celular_cliente);
    const metodo_pago = String(req.body?.metodo_pago || "").trim();

    const pv_id = Number(req.body?.pv_id);
    const delivery_fee = Number(req.body?.delivery_fee ?? 0);
    const subtotal = Number(req.body?.subtotal ?? 0);
    const total = Number(req.body?.total ?? 0);

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const resumen_pedido = String(req.body?.resumen_pedido || "").trim();

    if (!direccion_cliente) return res.status(400).json({ message: "Falta direccion_cliente" });
    if (!celular_cliente) return res.status(400).json({ message: "Celular inválido" });
    if (!metodo_pago) return res.status(400).json({ message: "Falta metodo_pago" });

    if (!Number.isFinite(pv_id) || pv_id <= 0) {
      return res.status(400).json({ message: "pv_id inválido" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "items inválidos" });
    }

    const row = {
      nombre_cliente: correo, // ✅ aquí guardas correo (como tu GET actual)
      direccion_cliente,
      celular_cliente, // "+57XXXXXXXXXX"
      metodo_pago,
      pv_id,
      delivery_fee: Number.isFinite(delivery_fee) ? delivery_fee : 0,
      subtotal: Number.isFinite(subtotal) ? subtotal : 0,
      total: Number.isFinite(total) ? total : 0,
      items, // jsonb
      resumen_pedido: resumen_pedido || "",
    };

    const { data, error } = await supabaseAdmin
      .from("pedidos")
      .insert([row])
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[POST /api/pedidos] error supabase:", error);
      return res.status(500).json({ message: "Error creando pedido", detail: error.message });
    }

    return res.status(201).json(data);
  } catch (err) {
    console.error("[POST /api/pedidos] error inesperado:", err);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

// ✅ Actualizar resumen / metodo_pago
app.patch("/api/pedidos/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: "ID inválido" });

    const resumen_pedido = String(req.body?.resumen_pedido || "").trim();
    const metodo_pago = String(req.body?.metodo_pago || "").trim();

    if (!resumen_pedido && !metodo_pago) {
      return res.status(400).json({ message: "Nada para actualizar" });
    }

    const patch: any = {};
    if (resumen_pedido) patch.resumen_pedido = resumen_pedido;
    if (metodo_pago) patch.metodo_pago = metodo_pago;

    const { data, error } = await supabaseAdmin
      .from("pedidos")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[PATCH /api/pedidos/:id] error supabase:", error);
      return res.status(500).json({ message: "Error actualizando pedido", detail: error.message });
    }

    return res.json(data || { ok: true });
  } catch (err) {
    console.error("[PATCH /api/pedidos/:id] error inesperado:", err);
    return res.status(500).json({ message: "Error inesperado" });
  }
});

// ===================== FALLBACKS =====================
app.use("/api", (_req, res) => res.status(404).json({ message: "Ruta API no encontrada" }));

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
