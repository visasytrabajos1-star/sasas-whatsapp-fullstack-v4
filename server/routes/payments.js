const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const cryptoService = require('../services/cryptoPaymentService');
const { supabase } = require('../services/supabaseClient');

// --- STRIPE ROUTES ---

// Crear sesión de pago Stripe
router.post('/stripe/checkout', async (req, res) => {
    try {
        const { email, plan, tenantId } = req.body; // plan: STARTER, PRO, ENTERPRISE

        const PRICES = {
            'STARTER': process.env.STRIPE_PRICE_STARTER,
            'PRO': process.env.STRIPE_PRICE_PRO,
            'ENTERPRISE': process.env.STRIPE_PRICE_ENTERPRISE
        };

        const priceId = PRICES[plan];
        if (!priceId) return res.status(400).json({ error: 'Plan inválido' });

        const session = await paymentService.createCheckoutSession(
            email,
            priceId,
            `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            `${process.env.FRONTEND_URL}/pricing`,
            { plan, tenantId: tenantId || email }
        );

        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Webhook de Stripe
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    try {
        const event = paymentService.constructWebhookEvent(req.body, sig);

        // Manejar eventos
        if (event.type === 'checkout.session.completed' || event.type === 'invoice.payment_succeeded') {
            const dataObject = event.data.object;
            const metadata = dataObject.metadata || {};
            const plan = metadata.plan;
            const tenantId = metadata.tenantId || dataObject.customer_email;

            if (tenantId && plan && supabase) {
                const planLimits = { 'STARTER': 1000, 'PRO': 5000, 'ENTERPRISE': 20000 };
                const newLimit = planLimits[plan] || 500;

                try {
                    // Update usage limits automatically
                    await supabase.from('tenant_usage_metrics')
                        .upsert({ tenant_id: tenantId, plan_limit: newLimit, updated_at: new Date().toISOString() })
                        .select();

                    // Update user profile if exists
                    await supabase.from('profiles')
                        .update({ role: plan.toLowerCase(), updated_at: new Date().toISOString() })
                        .eq('email', tenantId); // Assumes email is often used as tenantId

                    console.log(`✅ [Stripe] Suscripción activada para ${tenantId}. Plan: ${plan}, Límite: ${newLimit}`);
                } catch (dbErr) {
                    console.error(`⚠️ [Stripe DB Update Error]:`, dbErr.message);
                }
            } else {
                console.log('✅ Pago completado (sin tenant tracking):', event.data.object.id);
            }
        } else if (event.type === 'customer.subscription.deleted') {
            // Desactivar cuenta
            console.log('❌ Suscripción cancelada');
        }

        res.json({ received: true });
    } catch (err) {
        console.error('❌ Webhook Error:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
    }
});

// --- CRYPTO ROUTES ---

// Obtener direcciones de pago
router.get('/crypto/addresses', (req, res) => {
    res.json(cryptoService.getPaymentAddresses());
});

// Crear factura Crypto
router.post('/crypto/invoice', async (req, res) => {
    try {
        const { email, plan, currency } = req.body; // currency: BTC, USDT, ETH
        const invoice = await cryptoService.createInvoice(email, plan, currency);
        res.json(invoice);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verificar estado de pago Crypto
router.get('/crypto/invoice/:id', async (req, res) => {
    try {
        const status = await cryptoService.verifyPayment(req.params.id);
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
