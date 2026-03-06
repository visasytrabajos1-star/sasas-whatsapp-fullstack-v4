const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'alex_io_ultra_secure_default_secret_2026';

/**
 * Middleware para validar el token JWT y extraer el tenantId.
 */
const authenticateTenant = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'No se proporcionó un token de acceso válido.',
            code: 'AUTH_REQUIRED'
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Inyectamos el tenant en el request para uso posterior
        req.tenant = {
            id: decoded.tenantId,
            plan: decoded.plan || 'FREE',
            email: decoded.email,
            role: decoded.role || 'USER' // RBAC: USER, ADMIN, OWNER
        };

        next();
    } catch (error) {
        console.error('❌ Error de autenticación JWT:', error.message);
        return res.status(403).json({
            error: 'Token inválido o expirado.',
            code: 'INVALID_TOKEN'
        });
    }
};

/**
 * Middleware para restringir acceso según el rol (RBAC).
 */
const requireRole = (roles) => {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    return (req, res, next) => {
        if (!req.tenant || !allowedRoles.includes(req.tenant.role)) {
            return res.status(403).json({
                error: 'No tienes permisos suficientes para realizar esta acción.',
                code: 'FORBIDDEN_ROLE'
            });
        }
        next();
    };
};

/**
 * Middleware para restringir acceso según el plan del tenant.
 */
const requirePlan = (minPlan) => {
    const plans = { 'FREE': 0, 'STARTER': 1, 'PRO': 2, 'ENTERPRISE': 3 };

    return (req, res, next) => {
        const currentPlan = req.tenant?.plan || 'FREE';

        if (plans[currentPlan] < plans[minPlan]) {
            return res.status(403).json({
                error: `Esta función requiere un plan ${minPlan} o superior.`,
                code: 'INSUFFICIENT_PLAN'
            });
        }

        next();
    };
};

module.exports = {
    authenticateTenant,
    requireRole,
    requirePlan,
    JWT_SECRET
};
