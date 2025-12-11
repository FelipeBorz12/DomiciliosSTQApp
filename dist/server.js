"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
dotenv_1.default.config();
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Faltan SUPABASE_URL o SUPABASE_KEY en el .env');
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_KEY);
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// -------------------- RUTAS ESTÁTICAS --------------------
const publicPath = path_1.default.join(__dirname, '..', 'public');
app.use(express_1.default.static(publicPath));
// -------------------- RUTAS DE PÁGINAS --------------------
app.get('/', (_req, res) => {
    res.sendFile(path_1.default.join(publicPath, 'index.html'));
});
app.get('/login', (_req, res) => {
    res.sendFile(path_1.default.join(publicPath, 'login.html'));
});
app.get('/register', (_req, res) => {
    res.sendFile(path_1.default.join(publicPath, 'register.html'));
});
app.get('/recover', (_req, res) => {
    res.sendFile(path_1.default.join(publicPath, 'recover.html'));
});
app.get('/product', (_req, res) => {
    res.sendFile(path_1.default.join(publicPath, 'product.html'));
});
app.get('/cart', (_req, res) => {
    res.sendFile(path_1.default.join(publicPath, 'cart.html'));
});
app.get('/confirm', (_req, res) => {
    res.sendFile(path_1.default.join(publicPath, 'confirm.html'));
});
app.get('/stores', (_req, res) => {
    res.sendFile(path_1.default.join(publicPath, 'store.html'));
});
// -------------------- API MENÚ --------------------
// GET /api/menu?tipo=1
app.get('/api/menu', async (req, res) => {
    try {
        const { tipo } = req.query;
        let query = supabase
            .from('menu')
            .select('id, "Nombre", "Descripcion", "PrecioOriente", "PrecioRestoPais", "PrecioAreaMetrop", tipo, "Activo", imagen')
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
    }
    catch (err) {
        console.error('[GET /api/menu] error inesperado:', err);
        res.status(500).json({ message: 'Error inesperado en el servidor' });
    }
});
// GET /api/menu/item/:id
app.get('/api/menu/item/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!id || Number.isNaN(id)) {
            return res.status(400).json({ message: 'ID inválido' });
        }
        const { data, error } = await supabase
            .from('menu')
            .select('id, "Nombre", "Descripcion", "PrecioOriente", "PrecioRestoPais", "PrecioAreaMetrop", tipo, "Activo", imagen')
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
    }
    catch (err) {
        console.error('[GET /api/menu/item/:id] error inesperado:', err);
        res.status(500).json({ message: 'Error inesperado en el servidor' });
    }
});
// -------------------- API AUTH --------------------
// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { nombre, correo, tipodocumento, documento, celular, direccionentrega, Departamento, Municipio, Barrio, contrasena, } = req.body;
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
            if (userError.code === '23505') {
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
    }
    catch (err) {
        console.error('[POST /api/auth/register] error inesperado:', err);
        res.status(500).json({ message: 'Error inesperado en el servidor' });
    }
});
// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
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
        if (!user || user.Contrasena !== contrasena) {
            return res.status(401).json({ message: 'Credenciales inválidas' });
        }
        const { data: form, error: formError } = await supabase
            .from('formulario')
            .select('nombre, celular, direccionentrega, "Departamento", "Municipio", "Barrio"')
            .eq('correo', correo)
            .maybeSingle();
        if (formError) {
            console.error('[POST /api/auth/login] error formulario:', formError);
        }
        res.json({
            userId: user.id,
            rol: user.Rol,
            perfil: form || null,
            correo: user.correo,
        });
    }
    catch (err) {
        console.error('[POST /api/auth/login] error inesperado:', err);
        res.status(500).json({ message: 'Error inesperado en el servidor' });
    }
});
// POST /api/auth/recover
app.post('/api/auth/recover', async (req, res) => {
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
        // Aquí iría la lógica de envío de correo si implementas un servicio de emails.
        return res.json({
            message: 'Si el correo existe, te enviaremos instrucciones.',
        });
    }
    catch (err) {
        console.error('[POST /api/auth/recover] error inesperado:', err);
        res.status(500).json({ message: 'Error inesperado en el servidor' });
    }
});
// -------------------- API PUNTOS DE VENTA --------------------
app.get('/api/puntos-venta', async (_req, res) => {
    try {
        const { data, error } = await supabase
            .from('Coordenadas_PV')
            .select('id, "Departamento", "Municipio", "Direccion", "Latitud", "Longitud", "Barrio", num_whatsapp, "URL_image"');
        if (error) {
            console.error('[GET /api/puntos-venta] error supabase:', error);
            return res.status(500).json({ message: 'Error al obtener puntos de venta' });
        }
        res.json(data || []);
    }
    catch (err) {
        console.error('[GET /api/puntos-venta] error inesperado:', err);
        res.status(500).json({ message: 'Error inesperado en el servidor' });
    }
});
// -------------------- API PEDIDOS --------------------
app.post('/api/pedidos', async (req, res) => {
    try {
        const { nombre_cliente, // correo electrónico
        resumen_pedido, direccion_cliente, celular_cliente, puntoventa, } = req.body;
        if (!nombre_cliente || !resumen_pedido || !direccion_cliente || !celular_cliente) {
            return res.status(400).json({
                message: 'Correo, resumen, dirección y celular son obligatorios',
            });
        }
        const { data, error } = await supabase
            .from('pedidos')
            .insert([
            {
                nombre_cliente, // correo
                resumen_pedido,
                direccion_cliente,
                celular_cliente,
                estado: 'Recibido',
                puntoventa: puntoventa || '',
            },
        ])
            .select('id')
            .maybeSingle();
        if (error) {
            console.error('[POST /api/pedidos] error supabase:', error);
            return res.status(500).json({ message: 'Error al registrar pedido' });
        }
        res.status(201).json({ message: 'Pedido registrado', id: data?.id });
    }
    catch (err) {
        console.error('[POST /api/pedidos] error inesperado:', err);
        res.status(500).json({ message: 'Error inesperado en el servidor' });
    }
});
// -------------------- API USUARIO (SIN SESIÓN) --------------------
// GET /api/auth/user?correo=alguien@mail.com
app.get('/api/auth/user', async (req, res) => {
    try {
        const correo = req.query.correo || '';
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
            .select('nombre, celular, direccionentrega, "Departamento", "Municipio", "Barrio"')
            .eq('correo', user.correo)
            .maybeSingle();
        if (formError) {
            console.error('[GET /api/auth/user] error formulario:', formError);
        }
        res.json({
            userId: user.id,
            rol: user.Rol,
            perfil: form || null,
            correo: user.correo,
        });
    }
    catch (err) {
        console.error('[GET /api/auth/user] error inesperado:', err);
        res.status(500).json({ message: 'Error inesperado en el servidor' });
    }
});
// -------------------- ARRANQUE DEL SERVIDOR --------------------
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
