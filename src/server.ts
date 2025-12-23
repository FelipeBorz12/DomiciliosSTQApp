// src/server.ts
import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

// ===================== ENV =====================
const PORT = Number(process.env.PORT || 3005);
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";
const JWT_SECRET = process.env.JWT_SECRET || "";

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";

// ✅ CORS (permite varios orígenes por coma)
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Validaciones mínimas de env
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Faltan SUPABASE_URL o SUPABASE_KEY en el .env");
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error(
    "Falta JWT_SECRET en el .env (obligatorio para sesiones seguras)."
  );
  process.exit(1);
}

// ===================== SUPABASE =====================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===================== APP =====================
const app = express();

// -------------------- MIDDLEWARES --------------------
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(cookieParser());

// ✅ CORS bien ubicado (ANTES de rutas)
app.use(
  cors({
    origin: (origin, cb) => {
      // permitir requests sin origin (curl, healthchecks, server-to-server)
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

// Favicon (evita 404)
app.get("/favicon.ico", (_req, res) => res.status(204).end());

// -------------------- STATIC --------------------
const publicPath = path.join(__dirname, "..", "public");
app.use(express.static(publicPath));

// -------------------- HELPERS AUTH --------------------
function normalizeEmail(email: any) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

type SessionPayload = {
  userId: number;
  correo: string;
  rol: string;
  iat?: number;
  exp?: number;
};

function signSession(payload: { userId: number; correo: string; rol: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function setSessionCookie(res: Response, token: string) {
  res.cookie("tq_session", token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    path: "/",
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie("tq_session", {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
  });
}

function readSession(req: Request): SessionPayload | null {
  // Cookie primero
  const token = (req.cookies?.tq_session as string) || "";

  // Opcional: Authorization Bearer
  const auth = req.header("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  const finalToken = token || bearer;
  if (!finalToken) return null;

  try {
    return jwt.verify(finalToken, JWT_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const s = readSession(req);
  if (!s) return res.status(401).json({ message: "No autenticado" });
  (req as any).session = s;
  next();
}

// Rate limit auth (anti brute force)
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
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
app.get("/history", (_req, res) =>
  res.sendFile(path.join(publicPath, "history.html"))
);

// ===================== API: LANDING =====================
// ✅ Para que no rompa tu index.js aunque aún no tengas tablas
app.get("/api/landing/hero", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("landing_hero")
      .select("id, title, description, tag, image_url, order_index, is_active")
      .eq("is_active", true)
      .order("order_index", { ascending: true });

    // Si no existe la tabla o hay error, devuelve [] (no rompe front)
    if (error) return res.json([]);
    return res.json(data || []);
  } catch {
    return res.json([]);
  }
});

app.get("/api/landing/about", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("landing_about")
      .select(
        "id, title, tagline, body, image_url, badge_text, cta_text, cta_href, instagram_handle"
      )
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Si no existe tabla o error, devuelve null
    if (error) return res.json(null);
    return res.json(data || null);
  } catch {
    return res.json(null);
  }
});

app.get("/api/landing/instagram", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("landing_instagram")
      .select("id, image_url, caption, href, order_index, is_active")
      .eq("is_active", true)
      .order("order_index", { ascending: true });

    // Si no existe tabla o error, devuelve []
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

    let query = supabase
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

    const { data, error } = await supabase
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

    if (!data)
      return res.status(404).json({ message: "Producto no encontrado" });
    return res.json(data);
  } catch (err) {
    console.error("[GET /api/menu/item/:id] error inesperado:", err);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

// ===================== API: AUTH =====================

// POST /api/auth/register
app.post(
  "/api/auth/register",
  authLimiter,
  async (req: Request, res: Response) => {
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

      const hashed = await bcrypt.hash(contrasena, 10);

      const { data: userInsert, error: userError } = await supabase
        .from("usuarios")
        .insert([{ correo, Contrasena: hashed, Rol: "0" }])
        .select("id")
        .maybeSingle();

      if (userError) {
        console.error("[POST /api/auth/register] error usuarios:", userError);
        if ((userError as any).code === "23505") {
          return res
            .status(400)
            .json({ message: "El correo ya está registrado" });
        }
        return res.status(500).json({ message: "Error al crear usuario" });
      }

      const celular = celularRaw
        ? Number(String(celularRaw).replace(/\D/g, ""))
        : 0;

      const { error: formError } = await supabase.from("formulario").insert([
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
      ]);

      if (formError) {
        console.error("[POST /api/auth/register] error formulario:", formError);
        return res
          .status(500)
          .json({ message: "Usuario creado, pero error al guardar datos" });
      }

      return res
        .status(201)
        .json({ message: "Registro exitoso", userId: userInsert?.id });
    } catch (err) {
      console.error("[POST /api/auth/register] error inesperado:", err);
      return res
        .status(500)
        .json({ message: "Error inesperado en el servidor" });
    }
  }
);

// POST /api/auth/login
app.post(
  "/api/auth/login",
  authLimiter,
  async (req: Request, res: Response) => {
    try {
      const correo = normalizeEmail(req.body?.correo);
      const contrasena = String(req.body?.contrasena || "");

      if (!correo || !contrasena) {
        return res
          .status(400)
          .json({ message: "Correo y contraseña son obligatorios" });
      }
      if (!isValidEmail(correo))
        return res.status(400).json({ message: "Correo inválido" });

      const { data: user, error } = await supabase
        .from("usuarios")
        .select('id, correo, "Contrasena", "Rol"')
        .eq("correo", correo)
        .maybeSingle();

      if (error) {
        console.error("[POST /api/auth/login] error supabase:", error);
        return res.status(500).json({ message: "Error al buscar usuario" });
      }

      if (!user || !(user as any).Contrasena) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      const stored = String((user as any).Contrasena);

      // ✅ Compatibilidad: migra legacy en texto plano al primer login
      let ok = false;
      if (stored.startsWith("$2")) {
        ok = await bcrypt.compare(contrasena, stored);
      } else {
        ok = stored === contrasena;
        if (ok) {
          try {
            const newHash = await bcrypt.hash(contrasena, 10);
            await supabase
              .from("usuarios")
              .update({ Contrasena: newHash })
              .eq("id", (user as any).id);
          } catch (rehashErr) {
            console.warn("[login] no se pudo re-hashear:", rehashErr);
          }
        }
      }

      if (!ok)
        return res.status(401).json({ message: "Credenciales inválidas" });

      const { data: form, error: formError } = await supabase
        .from("formulario")
        .select(
          'nombre, celular, direccionentrega, "Departamento", "Municipio", "Barrio"'
        )
        .eq("correo", correo)
        .maybeSingle();

      if (formError)
        console.error("[POST /api/auth/login] error formulario:", formError);

      const token = signSession({
        userId: Number((user as any).id),
        correo: String((user as any).correo),
        rol: String((user as any).Rol || "0"),
      });

      setSessionCookie(res, token);

      return res.json({
        userId: (user as any).id,
        rol: (user as any).Rol,
        perfil: form || null,
        correo: (user as any).correo,
      });
    } catch (err) {
      console.error("[POST /api/auth/login] error inesperado:", err);
      return res
        .status(500)
        .json({ message: "Error inesperado en el servidor" });
    }
  }
);

// POST /api/auth/logout
app.post("/api/auth/logout", (_req: Request, res: Response) => {
  clearSessionCookie(res);
  return res.json({ message: "Sesión cerrada" });
});

// GET /api/auth/me
app.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const s = (req as any).session as SessionPayload;

    const { data: form, error: formError } = await supabase
      .from("formulario")
      .select(
        'nombre, celular, direccionentrega, "Departamento", "Municipio", "Barrio"'
      )
      .eq("correo", s.correo)
      .maybeSingle();

    if (formError)
      console.error("[GET /api/auth/me] error formulario:", formError);

    return res.json({
      userId: s.userId,
      rol: s.rol,
      correo: s.correo,
      perfil: form || null,
    });
  } catch (err) {
    console.error("[GET /api/auth/me] error:", err);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

// ✅ GET /api/auth/user?correo=...  (lo usa tu confirm.js)
app.get("/api/auth/user", async (req: Request, res: Response) => {
  try {
    const correo = normalizeEmail(req.query.correo as string);
    if (!correo || !isValidEmail(correo))
      return res.status(400).json({ message: "Correo inválido" });

    const { data: user, error } = await supabase
      .from("usuarios")
      .select('id, correo, "Rol"')
      .eq("correo", correo)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/auth/user] error usuarios:", error);
      return res.status(500).json({ message: "Error buscando usuario" });
    }
    if (!user) return res.status(404).json({ message: "No encontrado" });

    const { data: form, error: formError } = await supabase
      .from("formulario")
      .select(
        'nombre, celular, direccionentrega, "Departamento", "Municipio", "Barrio"'
      )
      .eq("correo", correo)
      .maybeSingle();

    if (formError)
      console.error("[GET /api/auth/user] error formulario:", formError);

    return res.json({
      userId: (user as any).id,
      rol: (user as any).Rol,
      correo: (user as any).correo,
      perfil: form || null,
    });
  } catch (err) {
    console.error("[GET /api/auth/user] error inesperado:", err);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

// POST /api/auth/recover
app.post(
  "/api/auth/recover",
  authLimiter,
  async (req: Request, res: Response) => {
    try {
      const correo = normalizeEmail(req.body?.correo);
      if (!correo || !isValidEmail(correo)) {
        return res.status(400).json({ message: "Correo es obligatorio" });
      }

      // NO revelar si existe o no
      console.log("[Recover] Solicitud de recuperación para:", correo);
      return res.json({
        message: "Si el correo existe, te enviaremos instrucciones.",
      });
    } catch (err) {
      console.error("[POST /api/auth/recover] error inesperado:", err);
      return res
        .status(500)
        .json({ message: "Error inesperado en el servidor" });
    }
  }
);

// ===================== API: PUNTOS DE VENTA =====================
// ✅ quitado zona_precio porque tu tabla no lo tiene (esto te estaba rompiendo)
app.get("/api/puntos-venta", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("Coordenadas_PV")
      .select(
        'id, "Departamento", "Municipio", "Direccion", "Latitud", "Longitud", "Barrio", num_whatsapp, "URL_image"'
      );

    if (error) {
      console.error("[GET /api/puntos-venta] error supabase:", error);
      return res
        .status(500)
        .json({ message: "Error al obtener puntos de venta" });
    }

    return res.json(data || []);
  } catch (err) {
    console.error("[GET /api/puntos-venta] error inesperado:", err);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

// ===================== API: PEDIDOS =====================

// GET /api/pedidos?correo=...
app.get("/api/pedidos", async (req: Request, res: Response) => {
  try {
    const correo = normalizeEmail(req.query.correo as string);

    if (!correo) {
      return res
        .status(400)
        .json({ message: 'El parámetro "correo" es obligatorio' });
    }

    const { data, error } = await supabase
      .from("pedidos")
      .select("*")
      .eq("nombre_cliente", correo)
      .order("id", { ascending: false });

    if (error) {
      console.error("[GET /api/pedidos] error supabase:", error);
      return res
        .status(500)
        .json({ message: "Error al obtener pedidos", detail: error.message });
    }

    // Mejor: devuelve [] en vez de 404 (front suele romper con 404)
    return res.json(data || []);
  } catch (err) {
    console.error("[GET /api/pedidos] error inesperado:", err);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

// ✅ POST /api/pedidos (cabecera + detalle en pedido_items) usando un solo precio
app.post("/api/pedidos", async (req: Request, res: Response) => {
  try {
    const nombre_cliente = normalizeEmail(req.body?.nombre_cliente);
    const direccion_cliente = String(req.body?.direccion_cliente || "");
    const celular_cliente = String(req.body?.celular_cliente || "");
    const metodo_pago = req.body?.metodo_pago
      ? String(req.body.metodo_pago)
      : null;

    const pv_id = Number(req.body?.pv_id);
    const items = req.body?.items;

    const resumen_pedido = req.body?.resumen_pedido ?? "";

    // si tu front los manda (recomendado), tu tabla pedidos los tiene
    const delivery_fee = Number(req.body?.delivery_fee ?? 0);
    const subtotal_in = Number(req.body?.subtotal ?? 0);
    const total_in = Number(req.body?.total ?? 0);

    if (!nombre_cliente || !direccion_cliente || !celular_cliente) {
      return res
        .status(400)
        .json({ message: "Correo, dirección y celular son obligatorios" });
    }
    if (!pv_id || Number.isNaN(pv_id)) {
      return res
        .status(400)
        .json({ message: "pv_id es obligatorio (id de Coordenadas_PV)" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "items[] es obligatorio y no puede ser vacío" });
    }

    // 1) PV -> puntoventa = Barrio
    const { data: pv, error: pvErr } = await supabase
      .from("Coordenadas_PV")
      .select('id, "Barrio", "Direccion", "Municipio"')
      .eq("id", pv_id)
      .maybeSingle();

    if (pvErr) {
      console.error("[POST /api/pedidos] error PV:", pvErr);
      return res
        .status(500)
        .json({
          message: "Error consultando punto de venta",
          detail: pvErr.message,
        });
    }
    if (!pv)
      return res.status(400).json({ message: "Punto de venta inválido" });

    const puntoventaName =
      (pv as any).Barrio || (pv as any).Direccion || String((pv as any).id);

    // 2) Insert cabecera
    const insertPedido: any = {
      nombre_cliente,
      resumen_pedido: String(resumen_pedido ?? ""),
      direccion_cliente,
      celular_cliente,
      estado: "Recibido",
      puntoventa: puntoventaName,
      metodo_pago,
      pv_id, // tu tabla pedidos sí lo tiene
      delivery_fee: Number.isFinite(delivery_fee) ? delivery_fee : 0,
      subtotal: Number.isFinite(subtotal_in) ? subtotal_in : 0,
      total: Number.isFinite(total_in) ? total_in : 0,
    };

    const { data: pedido, error: pedidoErr } = await supabase
      .from("pedidos")
      .insert([insertPedido])
      .select("id")
      .maybeSingle();

    if (pedidoErr) {
      console.error("[POST /api/pedidos] error insert pedido:", pedidoErr);
      return res
        .status(500)
        .json({
          message: "Error al registrar pedido",
          detail: pedidoErr.message,
        });
    }

    const pedidoId = Number((pedido as any)?.id || 0) || null;
    if (!pedidoId)
      return res
        .status(500)
        .json({ message: "No se pudo obtener id del pedido" });

    // 3) Menu rows (precio único)
    const menuIds = Array.from(
      new Set(
        items
          .map((it: any) => Number(it?.menu_id))
          .filter((x: any) => x && !Number.isNaN(x))
      )
    );

    if (menuIds.length === 0) {
      await supabase.from("pedidos").delete().eq("id", pedidoId);
      return res
        .status(400)
        .json({ message: "items[] inválido: falta menu_id" });
    }

    const { data: menuRows, error: menuErr } = await supabase
      .from("menu")
      .select('id, "Nombre", "PrecioOriente", precio, "Activo"')
      .in("id", menuIds);

    if (menuErr) {
      console.error("[POST /api/pedidos] error trayendo menu:", menuErr);
      await supabase.from("pedidos").delete().eq("id", pedidoId);
      return res
        .status(500)
        .json({
          message: "Error consultando productos del menú",
          detail: menuErr.message,
        });
    }

    const menuMap = new Map<number, any>();
    (menuRows || []).forEach((m: any) => menuMap.set(Number(m.id), m));

    // 4) Construir filas de pedido_items (⚠️ NO cooking: tu tabla no tiene esa columna)
    const itemRows = items.map((it: any) => {
      const menu_id = Number(it.menu_id);
      const qty = Math.max(1, Number(it.qty || 1));

      const extras = Array.isArray(it.extras) ? it.extras : [];
      const modifications = Array.isArray(it.modifications)
        ? it.modifications
        : [];

      const menuRow = menuMap.get(menu_id);
      if (!menuRow) throw new Error(`Producto menu_id=${menu_id} no existe`);

      // ✅ precio único: usa menu.precio si >0, si no PrecioOriente
      const basePrice =
        Number(menuRow?.precio || 0) > 0
          ? Number(menuRow?.precio || 0)
          : Number(menuRow?.PrecioOriente || 0);

      // extras: suma precios (si vienen con {precio})
      const extrasSum = extras.reduce(
        (acc: number, ex: any) => acc + Number(ex?.precio || 0),
        0
      );

      const unit_price = basePrice + extrasSum;
      const line_total = unit_price * qty;

      return {
        pedido_id: pedidoId,
        menu_id,
        nombre_snapshot: String(
          menuRow?.Nombre || it.product_name || "Producto"
        ),
        qty,
        unit_price,
        line_total,
        price_source:
          Number(menuRow?.precio || 0) > 0
            ? "menu.precio"
            : "menu.PrecioOriente",
        extras: extras.length ? extras : null,
        modifications: modifications.length ? modifications : null,
        pv_id: pv_id, // en tu tabla pedido_items es numeric (no FK). Esto entra bien.
      };
    });

    // 5) Insert detalle
    const { error: itemsErr } = await supabase
      .from("pedido_items")
      .insert(itemRows as any);

    if (itemsErr) {
      console.error("[POST /api/pedidos] error insert pedido_items:", itemsErr);
      await supabase.from("pedidos").delete().eq("id", pedidoId);
      return res.status(500).json({
        message: "Error guardando detalle del pedido",
        detail: itemsErr.message,
      });
    }

    return res.status(201).json({ message: "Pedido registrado", id: pedidoId });
  } catch (err: any) {
    console.error("[POST /api/pedidos] error inesperado:", err);
    return res
      .status(500)
      .json({ message: err?.message || "Error inesperado en el servidor" });
  }
});

// PATCH /api/pedidos/:id (solo resumen/metodo_pago)
app.patch("/api/pedidos/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id))
      return res.status(400).json({ message: "ID inválido" });

    const { resumen_pedido, metodo_pago } = req.body;

    const updates: any = {};
    if (resumen_pedido !== undefined)
      updates.resumen_pedido = String(resumen_pedido);
    if (metodo_pago !== undefined)
      updates.metodo_pago = metodo_pago ? String(metodo_pago) : null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No hay campos para actualizar" });
    }

    const { data, error } = await supabase
      .from("pedidos")
      .update(updates)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[PATCH /api/pedidos/:id] error supabase:", error);
      return res.status(500).json({ message: "Error al actualizar pedido" });
    }
    if (!data) return res.status(404).json({ message: "Pedido no encontrado" });

    return res.json({ message: "Pedido actualizado", id: (data as any).id });
  } catch (err) {
    console.error("[PATCH /api/pedidos/:id] error inesperado:", err);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

// ===================== FALLBACKS =====================

// 404 JSON para /api/*
app.use("/api", (_req, res) => {
  return res.status(404).json({ message: "Ruta API no encontrada" });
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[SERVER ERROR]", err);
  return res.status(500).json({ message: "Error inesperado en el servidor" });
});

// ===================== LISTEN =====================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor escuchando en http://0.0.0.0:${PORT}`);
  console.log("NODE_ENV:", NODE_ENV);
  console.log("CORS_ORIGIN:", process.env.CORS_ORIGIN || "(no definido)");
});
