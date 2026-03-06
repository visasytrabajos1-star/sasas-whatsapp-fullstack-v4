require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pino = require('pino');

// --- CONFIGURATION ---
const app = express();
app.set('trust proxy', true); // Explicitly trust Render's proxy
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
const { JWT_SECRET } = require('./middleware/auth');

app.post('/api/auth/login', (req, res) => {
    const { email } = req.body;

    // Simulación de login para desarrollo (En W2 implementaremos persistencia de users)
    if (!email) return res.status(400).json({ error: 'Email es requerido' });

    const tenantId = `tenant_${Buffer.from(email).toString('base64').substring(0, 8)}`;
    const token = jwt.sign({
        tenantId,
        email,
        plan: 'PRO', // Default para pruebas
        role: 'OWNER'
    }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, tenantId });
});

// --- ROUTES ---
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        version: '2.0.4',
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

// --- START SERVER ---
app.listen(PORT, () => {
    logger.info(`🚀 ALEX IO SERVER V2 CORRIENDO EN PUERTO ${PORT}`);
    logger.info(`📡 WhatsApp Handler Listo...`);
    logger.info(`🧠 AI Brain Listo...`);
});
