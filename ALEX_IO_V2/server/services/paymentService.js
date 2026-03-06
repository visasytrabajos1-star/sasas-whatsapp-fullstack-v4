const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Price IDs de Stripe (configura en tu dashboard de Stripe)
const PRICES = {
    STARTER: process.env.STRIPE_PRICE_STARTER || 'price_xxx',
    PRO: process.env.STRIPE_PRICE_PRO || 'price_yyy',
    ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE || 'price_zzz'
};

class PaymentService {
    // Crear sesión de pago Stripe
    async createCheckoutSession(userEmail, priceId, successUrl, cancelUrl) {
        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                customer_email: userEmail,
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata: {
                    platform: 'ALEX_IO'
                }
            });
            return session;
        } catch (error) {
            console.error('❌ Stripe Error:', error.message);
            throw error;
        }
    }

    // Crear link de pago único (para planes prepago)
    async createPaymentLink(priceId, quantity = 1) {
        try {
            const paymentLink = await stripe.paymentLinks.create({
                line_items: [{ price: priceId, quantity }],
                metadata: { platform: 'ALEX_IO' }
            });
            return paymentLink;
        } catch (error) {
            console.error('❌ Stripe Payment Link Error:', error.message);
            throw error;
        }
    }

    // Verificar estado de suscripción
    async getSubscription(subscriptionId) {
        try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            return subscription;
        } catch (error) {
            console.error('❌ Stripe Get Subscription Error:', error.message);
            return null;
        }
    }

    // Cancelar suscripción
    async cancelSubscription(subscriptionId) {
        try {
            const subscription = await stripe.subscriptions.cancel(subscriptionId);
            return subscription;
        } catch (error) {
            console.error('❌ Stripe Cancel Error:', error.message);
            throw error;
        }
    }

    // Webhook de Stripe (para escuchar eventos)
    constructWebhookEvent(payload, signature) {
        return stripe.webhooks.constructEvent(
            payload,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    }
}

module.exports = new PaymentService();
