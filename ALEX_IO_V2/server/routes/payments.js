const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const cryptoService = require('../services/cryptoPaymentService');

// --- STRIPE ROUTES ---

// Crear sesión de pago Stripe
router.post('/stripe/checkout', async (req, res) => {
    try {
        const { email, plan } = req.body; // plan: STARTER, PRO, ENTERPRISE
        
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
            `${process.env.FRONTEND_URL}/pricing`
        );

        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Webhook de Stripe
router.post('/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    try {
        const event = paymentService.constructWebhookEvent(req.body, sig);

        // Manejar eventos
        switch (event.type) {
            case 'checkout.session.completed':
                // Activar suscripción en DB
                console.log('✅ Pago completado:', event.data.object);
                break;
            case 'customer.subscription.deleted':
                // Desactivar cuenta
                console.log('❌ Suscripción cancelada');
                break;
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
