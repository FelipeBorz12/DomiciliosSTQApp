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

const PORT = process.env.PORT || 3005;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const JWT_SECRET = process.env.JWT_SECRET || "";
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";

const CORS_ORIGIN = process.env.CORS_ORIGIN || `http://localhost:${PORT}`;

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

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();

// Seguridad headers
app.use(
  helmet({
    contentSecurityPolicy: false, // si luego quieres CSP, la armamos con tus CDNs (tailwind/fonts)
  })
);

app.use(cookieParser());

// CORS restringido (ajusta CORS_ORIGIN para tu dominio real en prod)
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.get("/health", (_req, res) => res.status(200).send("ok"));

// -------------------- RUTAS ESTÁTICAS --------------------
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

type SessionPayload = {
  userId: number;
  correo: string;
  rol: string;
  iat?: number;
  exp?: number;
};

function readSession(req: Request): SessionPayload | null {
  // cookie preferred
  const token = (req.cookies?.tq_session as string) || "";

  // opcional: Authorization header
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

// Rate limit para auth (anti brute force)
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  limit: 35, // 35 requests / 10min por IP
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Demasiados intentos. Intenta más tarde." },
});

// -------------------- RUTAS DE PÁGINAS --------------------
app.get("/", (_req: Request, res: Response) =>
  res.sendFile(path.join(publicPath, "index.html"))
);
app.get("/login", (_req: Request, res: Response) =>
  res.sendFile(path.join(publicPath, "login.html"))
);
app.get("/register", (_req: Request, res: Response) =>
  res.sendFile(path.join(publicPath, "register.html"))
);
app.get("/recover", (_req: Request, res: Response) =>
  res.sendFile(path.join(publicPath, "recover.html"))
);
app.get("/product", (_req: Request, res: Response) =>
  res.sendFile(path.join(publicPath, "product.html"))
);
app.get("/cart", (_req: Request, res: Response) =>
  res.sendFile(path.join(publicPath, "cart.html"))
);
app.get("/confirm", (_req: Request, res: Response) =>
  res.sendFile(path.join(publicPath, "confirm.html"))
);
app.get("/stores", (_req: Request, res: Response) =>
  res.sendFile(path.join(publicPath, "store.html"))
);
app.get("/history", (_req: Request, res: Response) =>
  res.sendFile(path.join(publicPath, "history.html"))
);

// -------------------- API MENÚ --------------------
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

    res.json(data || []);
  } catch (err) {
    console.error("[GET /api/menu] error inesperado:", err);
    res.status(500).json({ message: "Error inesperado en el servidor" });
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
    res.json(data);
  } catch (err) {
    console.error("[GET /api/menu/item/:id] error inesperado:", err);
    res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

// -------------------- API AUTH --------------------

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
      if (contrasena.length < 8)
        return res
          .status(400)
          .json({ message: "La contraseña debe tener mínimo 8 caracteres" });

      // 🔒 Hash de contraseña
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

      if (!correo || !contrasena)
        return res
          .status(400)
          .json({ message: "Correo y contraseña son obligatorios" });
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

      // ✅ Compatibilidad: si aún tienes usuarios legacy en texto plano, esto los migra al primer login
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

      // 🔐 Cookie de sesión
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
app.post("/api/auth/logout", (req: Request, res: Response) => {
  clearSessionCookie(res);
  return res.json({ message: "Sesión cerrada" });
});

// GET /api/auth/me (PROTEGIDO)
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

// POST /api/auth/recover (mantén respuesta genérica)
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

// -------------------- API PUNTOS DE VENTA --------------------
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

    res.json(data || []);
  } catch (err) {
    console.error("[GET /api/puntos-venta] error inesperado:", err);
    res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

// -------------------- API LANDING (HERO / ABOUT / INSTAGRAM) --------------------
app.get("/api/landing/hero", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("landing_hero")
      .select("id, title, description, tag, image_url, order_index, is_active")
      .eq("is_active", true)
      .order("order_index", { ascending: true });

    if (error) {
      console.error("[GET /api/landing/hero] error supabase:", error);
      return res
        .status(500)
        .json({ message: "Error al obtener hero", detail: error.message });
    }
    return res.json(data || []);
  } catch (err) {
    console.error("[GET /api/landing/hero] error inesperado:", err);
    return res
      .status(500)
      .json({ message: "Error inesperado en el servidor (hero)" });
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

    if (error) {
      console.error("[GET /api/landing/about] error supabase:", error);
      return res
        .status(500)
        .json({
          message: "Error al obtener sección about",
          detail: error.message,
        });
    }
    return res.json(data || null);
  } catch (err) {
    console.error("[GET /api/landing/about] error inesperado:", err);
    return res
      .status(500)
      .json({ message: "Error inesperado en el servidor (about)" });
  }
});

app.get("/api/landing/instagram", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("landing_instagram")
      .select("id, image_url, caption, href, order_index, is_active")
      .eq("is_active", true)
      .order("order_index", { ascending: true });

    if (error) {
      console.error("[GET /api/landing/instagram] error supabase:", error);
      return res
        .status(500)
        .json({
          message: "Error al obtener historias de Instagram",
          detail: error.message,
        });
    }
    return res.json(data || []);
  } catch (err) {
    console.error("[GET /api/landing/instagram] error inesperado:", err);
    return res
      .status(500)
      .json({ message: "Error inesperado en el servidor (instagram)" });
  }
});

// -------------------- API PEDIDOS --------------------
app.get("/api/pedidos", async (req: Request, res: Response) => {
  try {
    const correo = normalizeEmail(req.query.correo as string);

    if (!correo)
      return res
        .status(400)
        .json({ message: 'El parámetro "correo" es obligatorio' });

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

    if (!data || data.length === 0)
      return res.status(404).json({ message: "No se encontraron pedidos" });

    res.json(data);
  } catch (err) {
    console.error("[GET /api/pedidos] error inesperado:", err);
    res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

app.post("/api/pedidos", async (req: Request, res: Response) => {
  try {
    const {
      nombre_cliente,
      resumen_pedido,
      direccion_cliente,
      celular_cliente,
      puntoventa,
      metodo_pago,
    } = req.body;

    const resumenMissing =
      resumen_pedido === undefined || resumen_pedido === null;

    if (
      !nombre_cliente ||
      resumenMissing ||
      !direccion_cliente ||
      !celular_cliente
    ) {
      return res.status(400).json({
        message:
          "Correo, resumen (puede ser vacío), dirección y celular son obligatorios",
      });
    }

    const { data, error } = await supabase
      .from("pedidos")
      .insert([
        {
          nombre_cliente: normalizeEmail(nombre_cliente),
          resumen_pedido: String(resumen_pedido ?? ""),
          direccion_cliente,
          celular_cliente,
          estado: "Recibido",
          puntoventa: puntoventa || "",
          metodo_pago: metodo_pago || null,
        },
      ])
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[POST /api/pedidos] error supabase:", error);
      return res.status(500).json({ message: "Error al registrar pedido" });
    }

    res.status(201).json({ message: "Pedido registrado", id: data?.id });
  } catch (err) {
    console.error("[POST /api/pedidos] error inesperado:", err);
    res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});

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

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ message: "No hay campos para actualizar" });

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

    return res.json({ message: "Pedido actualizado", id: data.id });
  } catch (err) {
    console.error("[PATCH /api/pedidos/:id] error inesperado:", err);
    return res.status(500).json({ message: "Error inesperado en el servidor" });
  }
});
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // permitir requests sin origin (healthchecks, curl, server-to-server)
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0) return cb(null, true); // fallback si no configuras
      return cb(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  })
);

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Servidor escuchando en http://0.0.0.0:${PORT}`);
  console.log("CORS_ORIGIN:", process.env.CORS_ORIGIN);
});
