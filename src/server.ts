import express, { Request, Response } from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_KEY en el .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
app.use(cors());
app.use(express.json());

// -------------------- RUTAS ESTÁTICAS --------------------
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// -------------------- RUTAS DE PÁGINAS --------------------
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/login', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'login.html'));
});

app.get('/register', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'register.html'));
});

app.get('/recover', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'recover.html'));
});

app.get('/product', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'product.html'));
});

app.get('/cart', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'cart.html'));
});

app.get('/confirm', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'confirm.html'));
});

app.get('/stores', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'store.html'));
});

// Historial de pedidos
app.get('/history', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicPath, 'history.html'));
});

// -------------------- API MENÚ --------------------
// GET /api/menu?tipo=1
app.get('/api/menu', async (req: Request, res: Response) => {
  try {
    const { tipo } = req.query;

    let query = supabase
      .from('menu')
      .select(
        'id, "Nombre", "Descripcion", "PrecioOriente", "PrecioRestoPais", "PrecioAreaMetrop", tipo, "Activo", imagen'
      )
      .eq('Activo', 1);

    if (tipo) {
      query = query.eq('tipo', Number(tipo));
    }

    const { data, error } = await query.order('id', { ascending: true });

    if (error) {
      console.error('[GET /api/menu] error supabase:', error);
      return res.status(500).json({ message: 'Error al obtener menú' });
    }

    res.json(data || []);
  } catch (err) {
    console.error('[GET /api/menu] error inesperado:', err);
    res.status(500).json({ message: 'Error inesperado en el servidor' });
  }
});

// GET /api/menu/item/:id
app.get('/api/menu/item/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const { data, error } = await supabase
      .from('menu')
      .select(
        'id, "Nombre", "Descripcion", "PrecioOriente", "PrecioRestoPais", "PrecioAreaMetrop", tipo, "Activo", imagen'
      )
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[GET /api/menu/item/:id] error supabase:', error);
      return res.status(500).json({ message: 'Error al obtener producto' });
    }

    if (!data) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json(data);
  } catch (err) {
    console.error('[GET /api/menu/item/:id] error inesperado:', err);
    res.status(500).json({ message: 'Error inesperado en el servidor' });
  }
});

// -------------------- API AUTH --------------------
// POST /api/auth/register
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const {
      nombre,
      correo,
      tipodocumento,
      documento,
      celular,
      direccionentrega,
      Departamento,
      Municipio,
      Barrio,
      contrasena,
    } = req.body;

    if (!nombre || !correo || !contrasena) {
      return res.status(400).json({
        message: 'Nombre, correo y contraseña son obligatorios',
      });
    }

    const { data: userInsert, error: userError } = await supabase
      .from('usuarios')
      .insert([
        {
          correo,
          Contrasena: contrasena,
          Rol: '0',
        },
      ])
      .select('id')
      .maybeSingle();

    if (userError) {
      console.error('[POST /api/auth/register] error usuarios:', userError);
      if ((userError as any).code === '23505') {
        return res.status(400).json({ message: 'El correo ya está registrado' });
      }
      return res.status(500).json({ message: 'Error al crear usuario' });
    }

    const { error: formError } = await supabase.from('formulario').insert([
      {
        correo,
        nombre,
        tipodocumento,
        documento,
        celular: celular ? Number(celular) : 0,
        direccionentrega,
        Departamento: Departamento || '...',
        Municipio: Municipio || '...',
        Barrio: Barrio || '...',
      },
    ]);

    if (formError) {
      console.error('[POST /api/auth/register] error formulario:', formError);
      return res
        .status(500)
        .json({ message: 'Usuario creado, pero error al guardar datos' });
    }

    res.status(201).json({ message: 'Registro exitoso', userId: userInsert?.id });
  } catch (err) {
    console.error('[POST /api/auth/register] error inesperado:', err);
    res.status(500).json({ message: 'Error inesperado en el servidor' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
      return res
        .status(400)
        .json({ message: 'Correo y contraseña son obligatorios' });
    }

    const { data: user, error } = await supabase
      .from('usuarios')
      .select('id, correo, "Contrasena", "Rol"')
      .eq('correo', correo)
      .maybeSingle();

    if (error) {
      console.error('[POST /api/auth/login] error supabase:', error);
      return res.status(500).json({ message: 'Error al buscar usuario' });
    }

    if (!user || (user as any).Contrasena !== contrasena) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const { data: form, error: formError } = await supabase
      .from('formulario')
      .select(
        'nombre, celular, direccionentrega, "Departamento", "Municipio", "Barrio"'
      )
      .eq('correo', correo)
      .maybeSingle();

    if (formError) {
      console.error('[POST /api/auth/login] error formulario:', formError);
    }

    res.json({
      userId: (user as any).id,
      rol: (user as any).Rol,
      perfil: form || null,
      correo: (user as any).correo,
    });
  } catch (err) {
    console.error('[POST /api/auth/login] error inesperado:', err);
    res.status(500).json({ message: 'Error inesperado en el servidor' });
  }
});

// POST /api/auth/recover
app.post('/api/auth/recover', async (req: Request, res: Response) => {
  try {
    const { correo } = req.body;
    if (!correo) {
      return res.status(400).json({ message: 'Correo es obligatorio' });
    }

    const { data: user, error } = await supabase
      .from('usuarios')
      .select('id')
      .eq('correo', correo)
      .maybeSingle();

    if (error) {
      console.error('[POST /api/auth/recover] error supabase:', error);
      return res.status(500).json({ message: 'Error en el servidor' });
    }

    console.log('[Recover] Solicitud de recuperación para:', correo, 'existe?', !!user);

    return res.json({
      message: 'Si el correo existe, te enviaremos instrucciones.',
    });
  } catch (err) {
    console.error('[POST /api/auth/recover] error inesperado:', err);
    res.status(500).json({ message: 'Error inesperado en el servidor' });
  }
});

// -------------------- API PUNTOS DE VENTA --------------------
app.get('/api/puntos-venta', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('Coordenadas_PV')
      .select(
        'id, "Departamento", "Municipio", "Direccion", "Latitud", "Longitud", "Barrio", num_whatsapp, "URL_image"'
      );

    if (error) {
      console.error('[GET /api/puntos-venta] error supabase:', error);
      return res.status(500).json({ message: 'Error al obtener puntos de venta' });
    }

    res.json(data || []);
  } catch (err) {
    console.error('[GET /api/puntos-venta] error inesperado:', err);
    res.status(500).json({ message: 'Error inesperado en el servidor' });
  }
});

// -------------------- API LANDING (HERO / ABOUT / INSTAGRAM) --------------------
app.get('/api/landing/hero', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('landing_hero')
      .select('id, title, description, tag, image_url, order_index, is_active')
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('[GET /api/landing/hero] error supabase:', error);
      return res.status(500).json({
        message: 'Error al obtener hero',
        detail: error.message,
      });
    }

    return res.json(data || []);
  } catch (err) {
    console.error('[GET /api/landing/hero] error inesperado:', err);
    return res.status(500).json({ message: 'Error inesperado en el servidor (hero)' });
  }
});

app.get('/api/landing/about', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('landing_about')
      .select(
        'id, title, tagline, body, image_url, badge_text, cta_text, cta_href, instagram_handle'
      )
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[GET /api/landing/about] error supabase:', error);
      return res.status(500).json({
        message: 'Error al obtener sección about',
        detail: error.message,
      });
    }

    return res.json(data || null);
  } catch (err) {
    console.error('[GET /api/landing/about] error inesperado:', err);
    return res.status(500).json({ message: 'Error inesperado en el servidor (about)' });
  }
});

app.get('/api/landing/instagram', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('landing_instagram')
      .select('id, image_url, caption, href, order_index, is_active')
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (error) {
      console.error('[GET /api/landing/instagram] error supabase:', error);
      return res.status(500).json({
        message: 'Error al obtener historias de Instagram',
        detail: error.message,
      });
    }

    return res.json(data || []);
  } catch (err) {
    console.error('[GET /api/landing/instagram] error inesperado:', err);
    return res.status(500).json({ message: 'Error inesperado en el servidor (instagram)' });
  }
});

// -------------------- API PEDIDOS --------------------

// GET /api/pedidos?correo=algo@mail.com
app.get('/api/pedidos', async (req: Request, res: Response) => {
  try {
    const correo = (req.query.correo as string) || '';

    if (!correo) {
      return res.status(400).json({ message: 'El parámetro "correo" es obligatorio' });
    }

    console.log('[GET /api/pedidos] Buscando pedidos para correo:', correo);

    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('nombre_cliente', correo)
      .order('id', { ascending: false });

    if (error) {
      console.error('[GET /api/pedidos] error supabase:', error);
      return res.status(500).json({
        message: 'Error al obtener pedidos',
        detail: error.message,
      });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'No se encontraron pedidos' });
    }

    res.json(data);
  } catch (err) {
    console.error('[GET /api/pedidos] error inesperado:', err);
    res.status(500).json({ message: 'Error inesperado en el servidor' });
  }
});

// ✅ POST /api/pedidos (ahora acepta metodo_pago y permite resumen_pedido = "")
app.post('/api/pedidos', async (req: Request, res: Response) => {
  try {
    const {
      nombre_cliente, // correo electrónico
      resumen_pedido,
      direccion_cliente,
      celular_cliente,
      puntoventa,
      metodo_pago, // ✅ NUEVO
    } = req.body;

    // ✅ OJO: resumen_pedido puede ser "" (lo insertas vacío y luego haces PATCH)
    const resumenMissing = resumen_pedido === undefined || resumen_pedido === null;

    if (!nombre_cliente || resumenMissing || !direccion_cliente || !celular_cliente) {
      return res.status(400).json({
        message: 'Correo, resumen (puede ser vacío), dirección y celular son obligatorios',
      });
    }

    const { data, error } = await supabase
      .from('pedidos')
      .insert([
        {
          nombre_cliente,
          resumen_pedido: String(resumen_pedido ?? ''),
          direccion_cliente,
          celular_cliente,
          estado: 'Recibido',
          puntoventa: puntoventa || '',
          metodo_pago: metodo_pago || null, // ✅ guarda el método
        },
      ])
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[POST /api/pedidos] error supabase:', error);
      return res.status(500).json({ message: 'Error al registrar pedido' });
    }

    res.status(201).json({ message: 'Pedido registrado', id: data?.id });
  } catch (err) {
    console.error('[POST /api/pedidos] error inesperado:', err);
    res.status(500).json({ message: 'Error inesperado en el servidor' });
  }
});

// ✅ PATCH /api/pedidos/:id (para actualizar resumen_pedido y/o metodo_pago)
app.patch('/api/pedidos/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const { resumen_pedido, metodo_pago } = req.body;

    const updates: any = {};
    if (resumen_pedido !== undefined) updates.resumen_pedido = String(resumen_pedido);
    if (metodo_pago !== undefined) updates.metodo_pago = metodo_pago ? String(metodo_pago) : null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No hay campos para actualizar' });
    }

    const { data, error } = await supabase
      .from('pedidos')
      .update(updates)
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[PATCH /api/pedidos/:id] error supabase:', error);
      return res.status(500).json({ message: 'Error al actualizar pedido' });
    }

    if (!data) {
      return res.status(404).json({ message: 'Pedido no encontrado' });
    }

    return res.json({ message: 'Pedido actualizado', id: data.id });
  } catch (err) {
    console.error('[PATCH /api/pedidos/:id] error inesperado:', err);
    return res.status(500).json({ message: 'Error inesperado en el servidor' });
  }
});

// -------------------- API USUARIO (SIN SESIÓN) --------------------
// GET /api/auth/user?correo=alguien@mail.com
app.get('/api/auth/user', async (req: Request, res: Response) => {
  try {
    const correo = (req.query.correo as string) || '';

    if (!correo) {
      return res.status(400).json({ message: 'Correo es obligatorio' });
    }

    const { data: user, error: userError } = await supabase
      .from('usuarios')
      .select('id, correo, "Contrasena", "Rol"')
      .eq('correo', correo)
      .maybeSingle();

    if (userError) {
      console.error('[GET /api/auth/user] error supabase:', userError);
      return res.status(500).json({ message: 'Error al obtener datos del usuario' });
    }

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const { data: form, error: formError } = await supabase
      .from('formulario')
      .select(
        'nombre, celular, direccionentrega, "Departamento", "Municipio", "Barrio"'
      )
      .eq('correo', (user as any).correo)
      .maybeSingle();

    if (formError) {
      console.error('[GET /api/auth/user] error formulario:', formError);
    }

    res.json({
      userId: (user as any).id,
      rol: (user as any).Rol,
      perfil: form || null,
      correo: (user as any).correo,
    });
  } catch (err) {
    console.error('[GET /api/auth/user] error inesperado:', err);
    res.status(500).json({ message: 'Error inesperado en el servidor' });
  }
});

// -------------------- ARRANQUE DEL SERVIDOR --------------------
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
