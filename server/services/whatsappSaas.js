const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const fs = require('fs');
const pino = require('pino');
const express = require('express');
const router = express.Router();
const alexBrain = require('./alexBrain');
const { supabase, isSupabaseEnabled } = require('./supabaseClient');

// Session Management
const activeSessions = new Map();
const clientConfigs = new Map();
const sessionStatus = new Map();
const reconnectAttempts = new Map();
const lastMessagePerJid = new Map(); // Simple loop prevention cache
const sessionsDir = './sessions';
const sessionsTable = process.env.WHATSAPP_SESSIONS_TABLE || 'whatsapp_sessions';
const maxReconnectAttempts = Number(process.env.WHATSAPP_MAX_RECONNECT_ATTEMPTS || 100);

if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

const updateSessionStatus = async (instanceId, status, extra = {}) => {
    const payload = {
        instance_id: instanceId,
        status,
        qr_code: extra.qr_code ?? null,
        company_name: extra.companyName ?? null,
        provider: extra.provider ?? null,
        tenant_id: extra.tenantId ?? null,
        updated_at: new Date().toISOString()
    };

    sessionStatus.set(instanceId, {
        status,
        qr_code: payload.qr_code,
        updatedAt: payload.updated_at,
        companyName: payload.company_name,
        provider: payload.provider,
        tenantId: payload.tenant_id
    });

    if (!isSupabaseEnabled) return;

    const { error } = await supabase
        .from(sessionsTable)
        .upsert(payload, { onConflict: 'instance_id' });

    if (error) {
        console.warn(`⚠️ [${instanceId}] Supabase sync failed:`, error.message);
    }
};

const hydrateSessionStatus = async () => {
    if (!isSupabaseEnabled) return;

    const { data, error } = await supabase
        .from(sessionsTable)
        .select('instance_id,status,qr_code,updated_at,company_name,provider,tenant_id');

    if (error) {
        console.warn('⚠️ Could not hydrate session status:', error.message);
        return;
    }

    for (const row of data || []) {
        sessionStatus.set(row.instance_id, {
            status: row.status,
            qr_code: row.qr_code,
            updatedAt: row.updated_at,
            companyName: row.company_name,
            provider: row.provider,
            tenantId: row.tenant_id
        });
    }

    console.log(`✅ Session status hydrated (${(data || []).length} records).`);
};

const clearSessionRuntime = (instanceId) => {
    activeSessions.delete(instanceId);
    reconnectAttempts.delete(instanceId);
};

const safeDeletePersistentSession = async (instanceId) => {
    if (!isSupabaseEnabled) return;
    await supabase.from(sessionsTable).delete().eq('instance_id', instanceId);
};

hydrateSessionStatus().catch(console.error);

// --- HANDLER: QR MODE (Baileys) ---
async function handleQRMessage(sock, msg, instanceId) {
    if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.fromMe) return;

    const remoteJid = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption;
    const hasImage = !!(msg.message.imageMessage || msg.message.image);

    // Loop Prevention: Prevent processing the same message twice or too fast
    const lastMsg = lastMessagePerJid.get(remoteJid);
    const now = Date.now();
    if (lastMsg && lastMsg.text === text && (now - lastMsg.time < 3000)) return;
    lastMessagePerJid.set(remoteJid, { text, time: now });

    if (hasImage && !text) {
        await sock.sendMessage(remoteJid, { text: '¡Hola! Soy Alex. Por ahora no puedo ver imágenes, pero si me explicas qué necesitas, ¡te ayudo de inmediato! 😊' });
        return;
    }

    if (!text) return;

    const config = clientConfigs.get(instanceId) || { companyName: 'ALEX IO' };

    try {
        await sock.readMessages([msg.key]);
        await sock.sendPresenceUpdate('composing', remoteJid);

        const result = await alexBrain.generateResponse({
            message: text,
            botConfig: {
                bot_name: config.companyName,
                system_prompt: config.customPrompt || 'Eres ALEX IO, asistente virtual inteligente.'
            }
        });

        if (result.text) {
            // Support for audio responses if implemented in result
            if (result.audioBuffer) {
                await sock.sendMessage(remoteJid, { audio: result.audioBuffer, mimetype: 'audio/mp4', ptt: true });
            } else {
                await sock.sendMessage(remoteJid, { text: result.text });
            }
            console.log(`📤 [${config.companyName}] Respondido con ${result.trace.model}`);
        }
    } catch (err) {
        console.error('❌ Error handling message:', err.message);
    }
}

// --- CONNECT FUNCTION ---
let cachedVersion = null;
async function connectToWhatsApp(instanceId, config, res = null) {
    const sessionPath = `${sessionsDir}/${instanceId}`;
    clientConfigs.set(instanceId, config);

    // If Cloud Provider, just update status and finish
    if (config.provider && config.provider !== 'baileys') {
        const payload = {
            companyName: config.companyName,
            provider: config.provider,
            tenantId: config.tenantId,
            qr_code: null
        };
        await updateSessionStatus(instanceId, 'configured_cloud', payload);
        if (res && !res.headersSent) {
            res.json({
                success: true,
                instance_id: instanceId,
                provider: config.provider,
                message: config.provider === 'meta'
                    ? 'Bot configurado para Meta Cloud API. Configura webhook y token en backend.'
                    : 'Bot configurado para 360Dialog. Configura webhook y credenciales en backend.'
            });
        }
        return;
    }

    // Baileys Connection Logic (Preserved V6 Hardening)
    if (!fs.existsSync(`${sessionPath}/creds.json`)) {
        try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch (_) { }
    }
    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

    if (!cachedVersion) {
        try {
            const { version, isLatest } = await fetchLatestBaileysVersion();
            cachedVersion = version;
            console.log(`🌐 [V6 Protocol] WA Version fetched: ${version.join('.')} (isLatest: ${isLatest})`);
        } catch (err) {
            console.warn('⚠️ [V6 Protocol] Failed to fetch dynamic version, applying Hardened Fallback [2, 3000, 1015901307]');
            cachedVersion = [2, 3000, 1015901307];
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const sock = makeWASocket({
        auth: state,
        version: cachedVersion,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Windows', 'Chrome', '20.0.04']
    });

    const previous = activeSessions.get(instanceId);
    if (previous && previous !== sock) { try { previous.end(); } catch (_) { } }

    activeSessions.set(instanceId, sock);
    await updateSessionStatus(instanceId, 'connecting', {
        companyName: config.companyName,
        provider: 'baileys',
        tenantId: config.tenantId
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        const closeCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode || null;

        if (qr) {
            QRCode.toDataURL(qr).then(async (url) => {
                await updateSessionStatus(instanceId, 'qr_ready', {
                    companyName: config.companyName,
                    qr_code: url,
                    provider: 'baileys',
                    tenantId: config.tenantId
                });
                if (res && !res.headersSent) res.json({ success: true, qr_code: url, instance_id: instanceId });
            }).catch(console.error);
        }

        if (connection === 'close') {
            const isLogout = closeCode === DisconnectReason.loggedOut;
            const isBadSession = closeCode === 405;
            updateSessionStatus(instanceId, 'disconnected', { companyName: config.companyName, provider: 'baileys', tenantId: config.tenantId }).catch(() => null);

            const attempts = (reconnectAttempts.get(instanceId) || 0) + 1;
            if (!isLogout && !isBadSession && attempts <= maxReconnectAttempts) {
                reconnectAttempts.set(instanceId, attempts);
                setTimeout(() => connectToWhatsApp(instanceId, config, res), 5000);
            } else {
                if (isBadSession) try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch (_) { }
                clearSessionRuntime(instanceId);
            }
        } else if (connection === 'open') {
            reconnectAttempts.set(instanceId, 0);
            updateSessionStatus(instanceId, 'online', { companyName: config.companyName, provider: 'baileys', tenantId: config.tenantId }).catch(() => null);
        }
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) await handleQRMessage(sock, msg, instanceId);
    });

    return sock;
}

// --- ENDPOINTS ---
router.post('/connect', async (req, res) => {
    const { companyName, customPrompt, provider = 'baileys', tenantId, metaApiUrl, metaPhoneNumberId, metaAccessToken, dialogApiKey } = req.body || {};
    const cleanName = String(companyName || '').trim();

    if (!cleanName) {
        return res.status(400).json({ error: 'companyName is required' });
    }

    const instanceId = `alex_${Date.now()}`;
    const effectiveTenantId = req.tenant?.id || tenantId || req.headers['x-tenant-id'];
    const config = {
        companyName: cleanName,
        customPrompt,
        provider,
        tenantId: effectiveTenantId,
        metaApiUrl,
        metaPhoneNumberId,
        metaAccessToken,
        dialogApiKey
    };

    try {
        await connectToWhatsApp(instanceId, config, res);

        // Implementation of 90s timeout as requested for QR flow
        if (provider === 'baileys') {
            const timeoutHandle = setTimeout(async () => {
                if (!res.headersSent) {
                    await updateSessionStatus(instanceId, 'timeout_waiting_qr', {
                        companyName: cleanName,
                        provider,
                        tenantId: effectiveTenantId,
                        qr_code: null
                    });

                    res.status(408).json({
                        error: 'Timeout waiting for QR. Aún estamos conectando con WhatsApp, intenta nuevamente en unos segundos.',
                        instance_id: instanceId
                    });
                }
            }, 90000);

            res.on('close', () => clearTimeout(timeoutHandle));
            res.on('finish', () => clearTimeout(timeoutHandle));
        }
    } catch (err) {
        console.error(`❌ [${instanceId}] Connect failed:`, err.message);
        await updateSessionStatus(instanceId, 'error_connecting', {
            companyName: cleanName,
            provider,
            tenantId: effectiveTenantId,
            qr_code: null
        });
        res.status(500).json({ error: err.message });
    }
});

router.post('/config/:instanceId', async (req, res) => {
    const { instanceId } = req.params;
    const current = clientConfigs.get(instanceId);

    if (!current) return res.status(404).json({ error: 'Instance not found' });

    const nextConfig = { ...current, ...req.body };
    clientConfigs.set(instanceId, nextConfig);

    await updateSessionStatus(instanceId, 'configured', {
        companyName: nextConfig.companyName,
        provider: nextConfig.provider,
        tenantId: nextConfig.tenantId,
        qr_code: null
    });

    return res.json({ success: true, instance_id: instanceId, config: nextConfig });
});

router.post('/disconnect', async (req, res) => {
    const { instanceId } = req.body || {};
    const session = activeSessions.get(instanceId);
    if (session) {
        try { session.logout(); } catch (_) { }
        clearSessionRuntime(instanceId);
    }
    await safeDeletePersistentSession(instanceId);
    sessionStatus.delete(instanceId);
    try { fs.rmSync(`${sessionsDir}/${instanceId}`, { recursive: true, force: true }); } catch (_) { }
    res.json({ success: true });
});

router.get('/status', (req, res) => {
    const tenantId = req.tenant?.id || req.query.tenantId || req.headers['x-tenant-id'];
    let sessions = Array.from(sessionStatus.entries()).map(([id, info]) => ({ instanceId: id, ...info }));

    // Filter by tenant if provided (Multi-tenancy real)
    if (tenantId) {
        sessions = sessions.filter(s => s.tenantId === tenantId);
    }

    res.json({
        active_sessions: sessions.length,
        sessions,
        uptime: process.uptime()
    });
});

router.get('/status/:instanceId', (req, res) => {
    const info = sessionStatus.get(req.params.instanceId);
    if (!info) return res.status(404).json({ error: 'Not found' });
    res.json({ instance_id: req.params.instanceId, ...info });
});

module.exports = router;
