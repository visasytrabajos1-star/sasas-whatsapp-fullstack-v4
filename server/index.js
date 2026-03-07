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
app.use(helmet());

// Middleware
const allowedOrigins = [
    'https://alex-io-v4-frontend.onrender.com', // Explicit production URL
    'http://localhost:5173',
    'http://localhost:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        // Match specific origins or check if it matches onrender.com subdomains
        if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.onrender.com')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

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

const ADMIN_EMAILS = ['visasytrabajos@gmail.com', 'admin@demo.com'];

const buildToken = (user) => {
    const email = user.email;
    const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase().trim()) || user.user_metadata?.role === 'SUPERADMIN';
    const tenantId = isAdmin
        ? 'tenant_superadmin'
        : user.id; // Use Supabase UUID as immutable tenantId

    return {
        token: jwt.sign({
            tenantId,
            email,
            plan: user.user_metadata?.plan || (isAdmin ? 'ENTERPRISE' : 'PRO'),
            role: isAdmin ? 'SUPERADMIN' : (user.user_metadata?.role || 'OWNER')
        }, getJwtSecret(), { expiresIn: '7d' }),
        tenantId,
        role: isAdmin ? 'SUPERADMIN' : (user.user_metadata?.role || 'OWNER')
    };
};

// POST /api/auth/session-exchange
// Exchange a Supabase access_token for a backend JWT
app.post('/api/auth/session-exchange', sensitiveLimiter, async (req, res) => {
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

// Legacy login/register removed to enforce Supabase Auth.
// Use Supabase Client SDK in frontend to login/signup.
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
const frontendPath = fs.existsSync(clientBuildPath) ? clientBuildPath :
    fs.existsSync(clientDistPath) ? clientDistPath : null;

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

    logger.info(`📦 Frontend served from ${frontendPath} (cache-hardened)`);
}

// --- ROUTES ---
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        version: '2.0.4.17',
        platform: 'ALEX IO SAAS',
        features: ['V6 Protocol Hardening', 'V8 Multi-Tenancy', 'TTS Voice', 'Omnichannel Connectors'],
        users: 'Optimized for scale'
    });
});

// Webhooks (Public - Unauthenticated logic handles signature validation)
const webhooksRouter = require('./routes/webhooks');
app.use('/api/webhooks', webhooksRouter);

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
    app.get('*', (req, res) => {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
}

// --- START SERVER ---
app.listen(PORT, () => {
    logger.info(`🚀 ALEX IO SERVER V2 CORRIENDO EN PUERTO ${PORT}`);
    logger.info(`📡 WhatsApp Handler Listo...`);
    logger.info(`🧠 AI Brain Listo...`);

    // Auto-restore previous sessions
    restoreSessions().catch(e => logger.error(`❌ Session restoration failed: ${e.message}`));
});
