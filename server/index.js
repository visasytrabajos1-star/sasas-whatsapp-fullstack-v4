require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pino = require('pino');
const helmet = require('helmet');

// --- CONFIGURATION ---
const app = express();
app.set('trust proxy', 1); // Trust Render's load balancer (1 hop)
const PORT = process.env.PORT || 3000;
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
logger.info('✅ Express trust proxy enabled');

// --- SECURITY MIDDLEWARES ---
const rateLimit = require('express-rate-limit');
const { authenticateTenant } = require('./middleware/auth');
const { createRequestMetricsMiddleware, getHealthSnapshot } = require('./services/observability');

// Rate Limiting Global (IP based)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    limit: 100, // Máximo 100 peticiones por ventana
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones. Por favor, intenta más tarde.', code: 'RATE_LIMIT_EXCEEDED' }
});

// Rate Limiting para endpoints sensibles (Auth/Connect) - TIGHTENED FOR PRODUCTION
const sensitiveLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    limit: process.env.NODE_ENV === 'production' ? 30 : 100, // 30/hr in prod, 100/hr in dev
    message: { error: 'Límite de intentos operativos excedido. Por favor, protege tu cuenta y espera una hora.', code: 'SENSITIVE_LIMIT_EXCEEDED' }
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
app.use(globalLimiter);
app.use(createRequestMetricsMiddleware());

// --- SECURE CORS ---
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : null; // null means allow all in current stabilization phase

app.use(cors({
    origin: (origin, callback) => {
        if (!allowedOrigins) {
            // WARN level in production if origins not restricted
            if (process.env.NODE_ENV === 'production') {
                console.warn('⚠️ SEGURIDAD: ALLOWED_ORIGINS no está configurado. Permitiendo todos los orígenes por compatibilidad.');
            }
            return callback(null, true);
        }
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.error(`❌ CORS BLOCKED: Origin ${origin} not in allowlist:`, allowedOrigins);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// --- SECURITY HEADERS ---
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "https://*.supabase.co", "https://*.onrender.com", "https://*.google.com"],
            "connect-src": ["'self'", "https://*.supabase.co", "https://*.onrender.com", "https://*.google.com", "https://*.openai.com"]
        }
    }
}));

// Middleware
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
const { getJwtSecret } = require('./middleware/auth');
const { supabase, isSupabaseEnabled } = require('./services/supabaseClient');

const ADMIN_EMAILS = ['visasytrabajos@gmail.com', 'admin@demo.com', 'admin@alex.io'];

const buildToken = (user) => {
    const email = user.email;
    const userRole = user.user_metadata?.role || 'OWNER';
    const isAdmin = ADMIN_EMAILS.includes(email?.toLowerCase().trim()) || userRole === 'SUPERADMIN';
    const tenantId = isAdmin
        ? 'tenant_superadmin'
        : user.id; // Use Supabase UUID as immutable tenantId

    return {
        token: jwt.sign({
            tenantId,
            email,
            plan: user.user_metadata?.plan || (isAdmin ? 'ENTERPRISE' : 'PRO'),
            role: isAdmin ? 'SUPERADMIN' : userRole
        }, getJwtSecret(), { expiresIn: '7d' }),
        tenantId,
        role: isAdmin ? 'SUPERADMIN' : userRole
    };
};

const sessionExchangeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === 'production' ? 120 : 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'Demasiados intentos de validación de sesión. Intenta nuevamente en unos minutos.', code: 'SESSION_EXCHANGE_LIMIT_EXCEEDED' }
});

// POST /api/auth/session-exchange
// Exchange a Supabase access_token for a backend JWT
app.post('/api/auth/session-exchange', sessionExchangeLimiter, async (req, res) => {
    const { access_token } = req.body;
    if (!access_token) return res.status(400).json({ error: 'Supabase access_token is required' });

    if (!isSupabaseEnabled) {
        return res.status(503).json({ error: 'Supabase connection is not available' });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(access_token);

        if (error || !user) {
            return res.status(401).json({ error: 'Sesión de Supabase inválida o expirada' });
        }

        const { token, tenantId, role } = buildToken(user);
        res.json({ token, tenantId, role });
    } catch (err) {
        console.error('Session exchange error:', err.message);
        res.status(500).json({ error: 'Error al verificar sesión' });
    }
});

// POST /api/auth/register
// Backend registration with auto-confirm to bypass Supabase email limits
app.post('/api/auth/register', async (req, res) => {
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const { supabaseAdmin } = require('./services/supabaseClient');
    if (!supabaseAdmin) {
        return res.status(501).json({ error: 'El registro automático requiere SUPABASE_SERVICE_ROLE_KEY en el servidor. Usa registro normal.' });
    }

    try {
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { role: role || 'OWNER', plan: 'PRO' }
        });

        if (error) {
            if (error.message.includes('already been registered')) {
                return res.status(409).json({ error: 'El usuario ya existe. Usa Iniciar Sesión.' });
            }
            throw error;
        }
        res.json({ success: true, message: 'Usuario creado y confirmado automáticamente.', user: data.user });
    } catch (err) {
        console.error('Registration error:', err.message);
        res.status(500).json({ error: 'Error al registrar usuario: ' + err.message });
    }
});

// Legacy login removed to enforce Supabase Auth.
app.post('/api/auth/login', (req, res) => {
    res.status(410).json({
        error: 'Este endpoint está obsoletos (AUTH_DEPRECATED). Use Supabase Auth + /api/auth/session-exchange.',
        code: 'AUTH_DEPRECATED'
    });
});

// --- SERVE FRONTEND (Static files from client build) ---
const path = require('path');
const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
const fs = require('fs');
const getFrontendPath = () => {
    const candidates = [clientBuildPath, clientDistPath];
    for (const candidate of candidates) {
        if (fs.existsSync(path.join(candidate, 'index.html'))) {
            return candidate;
        }
    }
    return null;
};
const frontendPath = getFrontendPath();

if (frontendPath) {
    // index.html: never cache (ensures fresh version after deploy)
    app.get('/', (req, res) => {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.sendFile(path.join(frontendPath, 'index.html'));
    });

    // Hashed assets (JS/CSS): cache aggressively (filename changes on rebuild)
    app.use(express.static(frontendPath, {
        maxAge: '1y',
        immutable: true,
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.html')) {
                res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            }
        }
    }));

    // If an asset hash is stale/missing, return 404 (never fallback to index for JS/CSS assets)
    app.get(/^\/assets\/.*$/, (req, res) => {
        res.status(404).type('text/plain').send('Asset not found');
    });

    logger.info(`📦 Frontend served from ${frontendPath} (cache-hardened)`);
}

// --- ROUTES ---
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        version: '2.0.5.0',
        platform: 'ALEX IO SAAS',
        features: ['V6 Protocol Hardening', 'V8 Multi-Tenancy', 'TTS Voice'],
        users: 'Optimized for scale'
    });
});

app.get('/api/sre/health', authenticateTenant, (req, res) => {
    if (req.tenant?.role !== 'SUPERADMIN') {
        return res.status(403).json({ error: 'Acceso denegado: solo SuperAdmin' });
    }
    return res.json({ success: true, health: getHealthSnapshot() });
});

// WhatsApp Routes (Protected & Rate Limited by Tenant)
const { router: whatsappSaas, restoreSessions } = require('./services/whatsappSaas');
app.post('/api/saas/connect', authenticateTenant, sensitiveLimiter); // Extra rate limit on connect
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
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/assets/')) {
            return res.status(404).type('text/plain').send('Asset not found');
        }
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        return res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
            if (err) return next(err);
        });
    });
}


app.use((err, req, res, next) => {
    console.error('❌ Express unhandled error:', err.message, 'path:', req.path);
    if (req.path.startsWith('/assets/')) {
        return res.status(404).type('text/plain').send('Asset not found');
    }
    return res.status(500).json({ error: 'Internal server error' });
});

// --- START SERVER ---
app.listen(PORT, () => {
    logger.info(`🚀 ALEX IO SERVER V2 CORRIENDO EN PUERTO ${PORT}`);
    logger.info(`📡 WhatsApp Handler Listo...`);
    logger.info(`🧠 AI Brain Listo...`);

    // Auto-restore previous sessions
    restoreSessions().catch(e => logger.error(`❌ Session restoration failed: ${e.message}`));
});
