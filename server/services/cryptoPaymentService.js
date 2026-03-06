const axios = require('axios');

// Configuración de Criptomonedas
const CRYPTO_CONFIG = {
    BTC_ADDRESS: process.env.BTC_WALLET || 'bc1q...',
    USDT_ADDRESS: process.env.USDT_WALLET || 'TX...',
    ETH_ADDRESS: process.env.ETH_WALLET || '0x...'
};

const RATES = {
    STARTER: 29,
    PRO: 79,
    ENTERPRISE: 199
};

class CryptoPaymentService {
    constructor() {
        this.invoices = new Map();
    }

    async getRates() {
        try {
            const res = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd');
            return {
                BTC: res.data.bitcoin.usd,
                ETH: res.data.ethereum.usd,
                USDT: 1
            };
        } catch (e) {
            console.warn('⚠️ Could not fetch crypto rates, using static');
            return { BTC: 65000, ETH: 3500, USDT: 1 };
        }
    }

    async createInvoice(email, plan, cryptoCurrency) {
        const amountUSD = RATES[plan] || RATES.STARTER;
        const rates = await this.getRates();
        const amountCrypto = amountUSD / rates[cryptoCurrency];

        const invoice = {
            id: `INV_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            email,
            plan,
            currency: cryptoCurrency,
            amount_usd: amountUSD,
            amount_crypto: amountCrypto.toFixed(8),
            wallet: CRYPTO_CONFIG[`${cryptoCurrency}_ADDRESS`],
            status: 'pending',
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        };

        this.invoices.set(invoice.id, invoice);
        console.log('📄 Invoice Created:', invoice);
        return invoice;
    }

    async verifyPayment(invoiceId) {
        const invoice = this.invoices.get(invoiceId);

        if (!invoice) {
            return {
                verified: false,
                status: 'not_found',
                message: 'Invoice no encontrada o expirada.'
            };
        }

        return {
            verified: false,
            status: invoice.status,
            invoice_id: invoice.id,
            message: `Por favor envía exactamente ${invoice.amount_crypto} ${invoice.currency} a la siguiente dirección: ${invoice.wallet}`
        };
    }

    getPaymentAddresses() {
        return {
            BTC: CRYPTO_CONFIG.BTC_ADDRESS,
            USDT: CRYPTO_CONFIG.USDT_ADDRESS,
            ETH: CRYPTO_CONFIG.ETH_ADDRESS
        };
    }
}

module.exports = new CryptoPaymentService();
