const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');
const pino = require('pino');
const express = require('express');
const router = express.Router();
const alexBrain = require('./alexBrain');

// Session Storage
const activeSessions = new Map();
const clientConfigs = new Map(); // Cache for runtime configs
const sessionsDir = './sessions';

if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

// --- 📲 QR HANDLER (MULTI-TENANT) ---
async function handleQRMessage(sock, msg, instanceId) {
    if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    // Get Config from internal cache or fallback
    const config = clientConfigs.get(instanceId) || { companyName: 'ALEX IO Business' };
    const remoteJid = msg.key.remoteJid;

    try {
        await new Promise(r => setTimeout(r, 1000));
        await sock.readMessages([msg.key]);
        await sock.sendPresenceUpdate('composing', remoteJid);

        const brainParams = {
            message: text,
            history: [],
            botConfig: config.botConfig || {
                bot_name: 'ALEX IO',
                system_prompt: config.customPrompt || 'Eres un asistente virtual de ALEX IO.'
            },
            messageType: msg.message.audioMessage ? 'audio' : 'text'
        };

        const result = await alexBrain.generateResponse(brainParams);

        if (result.audio) {
            await sock.sendMessage(remoteJid, { audio: Buffer.from(result.audio, 'base64'), mimetype: 'audio/mp4', ptt: true });
        } else {
            await sock.sendMessage(remoteJid, { text: result.text });
        }

        console.log(`📤 [QR] Replied via ${result.trace.model}`);

    } catch (err) {
        console.error('❌ QR Handler Error:', err.message);
    }
}

// --- ☁️ CLOUD API HANDLER ---
async function handleCloudMessage(message) {
    const from = message.from;
    const text = message.text?.body;

    // In production, config should be fetched from DB using the recipients phone number or an ID
    const config = {
        botConfig: {
            bot_name: 'ALEX IO API',
            system_prompt: 'Eres el cerebro cognitivo ALEX IO conectado vía API Cloud.'
        }
    };

    console.log(`📩 [API: ${from}] Msg: ${text}`);

    const brainParams = {
        message: text,
        history: [],
        botConfig: config.botConfig,
        messageType: message.type || 'text'
    };

    const result = await alexBrain.generateResponse(brainParams);

    try {
        const axios = require('axios');
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

        await axios.post(
            `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                to: from,
                type: 'text',
                text: { body: result.text }
            },
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        console.log(`📤 [API] Replied via ${result.trace.model}`);
    } catch (error) {
        console.error('❌ Cloud API Error:', error.message);
    }
}

// --- 🔗 QR CONNECTION ---
async function connectToWhatsApp(instanceId, config, res = null) {
    const sessionPath = `${sessionsDir}/${instanceId}`;
    clientConfigs.set(instanceId, config);

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'fatal' }),
        browser: ['ALEX IO', 'SaaS', '1.0']
    });

    activeSessions.set(instanceId, sock);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr && res && !res.headersSent) {
            QRCode.toDataURL(qr, (err, url) => {
                if (!err) res.json({ success: true, qr_code: url });
            });
        }
        if (connection === 'open') console.log(`✅ Instance ${instanceId} ONLINE`);
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            for (const msg of messages) await handleQRMessage(sock, msg, instanceId);
        }
    });
}

router.post('/connect', async (req, res) => {
    const { companyName, customPrompt } = req.body;
    const instanceId = `alex_io_${Date.now()}`;
    await connectToWhatsApp(instanceId, { companyName, customPrompt }, res);
});

router.post('/webhook', async (req, res) => {
    const body = req.body;
    if (body.object) {
        const msg = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
        if (msg) await handleCloudMessage(msg);
        res.sendStatus(200);
    } else res.sendStatus(404);
});

module.exports = router;
