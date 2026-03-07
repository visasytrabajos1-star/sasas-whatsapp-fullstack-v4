const express = require('express');
const router = express.Router();
const { handleIncomingMetaEvent } = require('../services/metaService');
const { handleIncomingTikTokEvent, verifyTikTokSignature } = require('../services/tiktokService');
const { verifyWebhookSignature, captureRawBody } = require('../middleware/webhookSecurity');

// Use raw body for TikTok/Meta signature verification before JSON parsing
const rawParser = express.json({
    verify: captureRawBody
});

// --- META WEBHOOKS (Facebook / Instagram) ---

// Facebook/Meta verifies the endpoint with a GET request
router.get('/meta', (req, res) => {
    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'alex_io_secure_webhook';

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('✅ [META] Webhook verified');
            return res.status(200).send(challenge);
        } else {
            console.error('❌ [META] Webhook verification failed v-token mismatch');
            return res.sendStatus(403);
        }
    }
    return res.status(400).send('Missing Meta Hub params');
});

// Meta sends messages via POST
// (Security: verifyWebhookSignature ideally needs process.env.META_APP_SECRET, but since Saas supports multiple tenants, we might need a generic or bypass based on the request)
const metaAuthLayer = process.env.META_APP_SECRET ? verifyWebhookSignature(process.env.META_APP_SECRET) : (req, res, next) => next();

router.post('/meta', rawParser, metaAuthLayer, async (req, res) => {
    const body = req.body;

    if (body.object === 'page' || body.object === 'instagram') {
        res.status(200).send('EVENT_RECEIVED'); // Always acknowledge quickly

        // Process asynchronously
        handleIncomingMetaEvent(body, req).catch(err => {
            console.error('❌ [META ERROR] Processing webhook:', err);
        });
    } else {
        res.sendStatus(404);
    }
});

// --- TIKTOK WEBHOOKS ---

router.post('/tiktok', rawParser, async (req, res) => {
    // Optionally verify signature if TIKTOK_APP_SECRET is global
    if (process.env.TIKTOK_APP_SECRET && !verifyTikTokSignature(req, process.env.TIKTOK_APP_SECRET)) {
        console.warn('⚠️ [TIKTOK] Invalid webhook signature');
        return res.status(403).send('Invalid signature');
    }

    res.status(200).send('EVENT_RECEIVED');

    handleIncomingTikTokEvent(req.body).catch(err => {
        console.error('❌ [TIKTOK ERROR] Processing webhook:', err);
    });
});

module.exports = router;
