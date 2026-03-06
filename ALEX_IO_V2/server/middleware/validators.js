const { z } = require('zod');

/**
 * Esquema de validación para la creación de una instancia de WhatsApp.
 */
const connectSchema = z.object({
    companyName: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(50, "Nombre demasiado largo"),
    customPrompt: z.string().max(1000, "El prompt es demasiado largo").optional()
});

/**
 * Middleware genérico para validar el body de un request contra un esquema Zod.
 */
const validate = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: 'Datos de entrada inválidos',
                details: error.errors.map(e => ({ path: e.path, message: e.message }))
            });
        }
        next(error);
    }
};

module.exports = {
    validate,
    connectSchema
};
