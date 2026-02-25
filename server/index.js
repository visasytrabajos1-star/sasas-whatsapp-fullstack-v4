require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pino = require('pino');

// --- CONFIGURATION ---
const app = express();
app.set('trust proxy', 1); // Trust Render's load balancer (1 hop)
const PORT = process.env.PORT || 3000;
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
logger.info('✅ Express trust proxy enabled');

// --- SECURITY MIDDLEWARES ---
const rateLimit = require('express-rate-limit');
const { authenticateTenant } = require('./middleware/auth');

// Rate Limiting Global (IP based)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    limit: 100, // Máximo 100 peticiones por ventana
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones. Por favor, intenta más tarde.', code: 'RATE_LIMIT_EXCEEDED' }
});

// Rate Limiting por Tenant (Solo para usuarios autenticados)
const tenantLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    limit: (req) => {
        const plan = req.tenant?.plan || 'FREE';
        if (plan === 'ENTERPRISE') return 5000;
        if (plan === 'PRO') return 1000;
        return 100; // FREE/STARTER default
    },
    keyGenerator: (req) => req.tenant?.id || req.ip,
    message: { error: 'Límite de cuota de API excedido para tu plan.', code: 'TENANT_QUOTA_EXCEEDED' }
});

// Rate Limiting para endpoints sensibles (Auth/Connect) - RELAXED FOR TESTING
const sensitiveLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    limit: 100, // Máximo 100 intentos por hora (antes 10)
    message: { error: 'Límite de intentos operativos excedido. Por favor, espera una hora.', code: 'SENSITIVE_LIMIT_EXCEEDED' }
});

app.use(globalLimiter);

// Middleware
app.use(cors());
const jsonParser = express.json();

// Stripe requiere body crudo para validar firma de webhook.
app.use((req, res, next) => {
    if (req.path === '/api/payments/stripe/webhook') return next();
    return jsonParser(req, res, next);
});

// Redis Client (Optional - for scaling to 5000+ users)
let redis = null;
if (process.env.REDIS_URL) {
    try {
        const Redis = require('ioredis');
        redis = new Redis(process.env.REDIS_URL);
        logger.info('✅ Redis connected for caching');
    } catch (e) {
        logger.warn('⚠️ Redis connection failed, using in-memory cache');
    }
}

// In-Memory Cache Fallback
const NodeCache = require('node-cache');
global.responseCache = global.responseCache || new NodeCache({ stdTTL: 3600, checkperiod: 600 }); // 1 hour TTL

// --- AUTH ROUTES (Public) ---
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { JWT_SECRET } = require('./middleware/auth');
const { supabase, isSupabaseEnabled } = require('./services/supabaseClient');

const ADMIN_EMAILS = ['visasytrabajos@gmail.com', 'admin@demo.com'];

const buildToken = (email, role) => {
    const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase().trim()) || role === 'SUPERADMIN';
    const tenantId = isAdmin
        ? 'tenant_superadmin'
        : `tenant_${Buffer.from(email).toString('base64').substring(0, 8)}`;
    return {
        token: jwt.sign({
            tenantId, email,
            plan: isAdmin ? 'ENTERPRISE' : 'PRO',
            role: isAdmin ? 'SUPERADMIN' : 'OWNER'
        }, JWT_SECRET, { expiresIn: '7d' }),
        tenantId,
        role: isAdmin ? 'SUPERADMIN' : 'OWNER'
    };
};

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    try {
        const passwordHash = await bcrypt.hash(password, 10);

        if (isSupabaseEnabled) {
            // Check if user already exists
            const { data: existing } = await supabase
                .from('app_users')
                .select('id')
                .eq('email', email.toLowerCase().trim())
                .single();

            if (existing) return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });

            const { error } = await supabase
                .from('app_users')
                .insert({ email: email.toLowerCase().trim(), password_hash: passwordHash, plan: 'PRO', role: 'OWNER' });

            if (error) throw error;
        }

        const { token, tenantId, role } = buildToken(email);
        res.json({ token, tenantId, role, message: '¡Cuenta creada exitosamente!' });
    } catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({ error: 'Error al crear la cuenta: ' + err.message });
    }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ error: 'Email es requerido' });

    // Admin bypass (no password required for defined admins)
    if (ADMIN_EMAILS.includes(email.toLowerCase().trim())) {
        const { token, tenantId, role } = buildToken(email);
        return res.json({ token, tenantId, role });
    }

    try {
        if (isSupabaseEnabled && password) {
            const { data: user } = await supabase
                .from('app_users')
                .select('password_hash, role, plan')
                .eq('email', email.toLowerCase().trim())
                .single();

            if (!user) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

            const valid = await bcrypt.compare(password, user.password_hash);
            if (!valid) return res.status(401).json({ error: 'Email o contraseña incorrectos' });

            const { token, tenantId, role } = buildToken(email, user.role);
            return res.json({ token, tenantId, role });
        }

        // Fallback: passwordless (for existing users or when Supabase not configured)
        const { token, tenantId, role } = buildToken(email);
        res.json({ token, tenantId, role });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

// --- SERVE FRONTEND (Static files from client build) ---
const path = require('path');
const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
const fs = require('fs');
const frontendPath = fs.existsSync(clientBuildPath) ? clientBuildPath :
    fs.existsSync(clientDistPath) ? clientDistPath : null;

if (frontendPath) {
    app.use(express.static(frontendPath));
    logger.info(`📦 Frontend served from ${frontendPath}`);
}

// --- ROUTES ---
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        version: '2.0.4.16',
        platform: 'ALEX IO SAAS',
        features: ['V6 Protocol Hardening', 'V8 Multi-Tenancy', 'TTS Voice'],
        users: 'Optimized for scale'
    });
});

// WhatsApp Routes (Protected & Rate Limited by Tenant)
const whatsappSaas = require('./services/whatsappSaas');
app.use('/api/saas', authenticateTenant, tenantLimiter, whatsappSaas);

// Payment Routes (Protected & Rate Limited by Tenant)
const paymentsRouter = require('./routes/payments');
app.use('/api/payments', authenticateTenant, tenantLimiter, paymentsRouter);

// Health Check (Public or Internal)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        redis: redis ? 'connected' : 'disabled',
        cache: global.responseCache.getStats()
    });
});

// --- SPA CATCH-ALL (must be AFTER all API routes) ---
if (frontendPath) {
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
}

// --- START SERVER ---
app.listen(PORT, () => {
    logger.info(`🚀 ALEX IO SERVER V2 CORRIENDO EN PUERTO ${PORT}`);
    logger.info(`📡 WhatsApp Handler Listo...`);
    logger.info(`🧠 AI Brain Listo...`);
});
