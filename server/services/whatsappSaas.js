const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
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
        updated_at: new Date().toISOString()
    };

    sessionStatus.set(instanceId, {
        status,
        qr_code: payload.qr_code,
        updatedAt: payload.updated_at,
        companyName: payload.company_name,
        provider: payload.provider
    });

    if (!isSupabaseEnabled) return;

    const { provider, ...dbPayload } = payload;
    const { error } = await supabase
        .from(sessionsTable)
        .upsert(dbPayload, { onConflict: 'instance_id' });

    if (error) {
        console.warn(`⚠️ Supabase session sync failed for ${instanceId}:`, error.message);
    }
};

const hydrateSessionStatus = async () => {
    if (!isSupabaseEnabled) {
        console.log('ℹ️ Supabase session persistence disabled (missing credentials).');
        return;
    }

    const { data, error } = await supabase
        .from(sessionsTable)
        .select('instance_id,status,qr_code,updated_at,company_name')
        .order('updated_at', { ascending: false })
        .limit(200);

    if (error) {
        console.warn('⚠️ Could not hydrate session status from Supabase:', error.message);
        return;
    }

    for (const row of data || []) {
        sessionStatus.set(row.instance_id, {
            status: row.status,
            qr_code: row.qr_code,
            updatedAt: row.updated_at,
            companyName: row.company_name,
            provider: null
        });
    }

    console.log(`✅ Session status hydrated from Supabase (${(data || []).length} records).`);
};

const clearSessionRuntime = (instanceId) => {
    activeSessions.delete(instanceId);
    reconnectAttempts.delete(instanceId);
};

const safeDeletePersistentSession = async (instanceId) => {
    if (!isSupabaseEnabled) return;

    const { error } = await supabase.from(sessionsTable).delete().eq('instance_id', instanceId);
    if (error) console.warn(`⚠️ Failed deleting ${instanceId} from Supabase:`, error.message);
};

hydrateSessionStatus().catch((error) => {
    console.warn('⚠️ Session hydration bootstrap error:', error.message);
});

// --- HANDLER: QR MODE (Baileys) ---
async function handleQRMessage(sock, msg, instanceId) {
    if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.fromMe) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption;
    const hasImage = !!(msg.message.imageMessage || msg.message.image);

    if (hasImage && !text) {
        const remoteJid = msg.key.remoteJid;
        await sock.sendMessage(remoteJid, { text: '¡Hola! Soy Alex. Lamentablemente, en este momento no puedo ver imágenes. ¿Podrías describirme con palabras lo que necesitas? Así podré ayudarte mejor 😊' });
        return;
    }

    if (!text) return;

    const config = clientConfigs.get(instanceId) || { companyName: 'ALEX IO' };
    const remoteJid = msg.key.remoteJid;

    try {
        await sock.readMessages([msg.key]);
        await sock.sendPresenceUpdate('composing', remoteJid);

        const result = await alexBrain.generateResponse({
            message: text,
            history: [],
            botConfig: {
                bot_name: config.companyName,
                system_prompt: config.customPrompt || 'Eres ALEX IO, asistente virtual inteligente.'
            }
        });

        if (result.text) {
            await sock.sendMessage(remoteJid, { text: result.text });
            console.log(`📤 [${config.companyName}] Respondido con ${result.trace.model}`);
        }
    } catch (err) {
        console.error('❌ Error handling message:', err.message);
    }
}

// --- CONNECT FUNCTION ---
async function connectToWhatsApp(instanceId, config, res = null) {
    const sessionPath = `${sessionsDir}/${instanceId}`;
    clientConfigs.set(instanceId, config);

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'fatal' }),
        browser: ['Ubuntu', 'Chrome', '120.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000
    });

    const previous = activeSessions.get(instanceId);
    if (previous && previous !== sock) {
        try { previous.end?.(); } catch (_) { }
    }

    activeSessions.set(instanceId, sock);
    await updateSessionStatus(instanceId, 'connecting', { companyName: config.companyName });
    console.log(`🔄 [${instanceId}] Connecting for ${config.companyName || 'ALEX IO'}...`);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        const closeCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode || null;

        if (qr) {
            QRCode.toDataURL(qr)
                .then(async (url) => {
                    await updateSessionStatus(instanceId, 'qr_ready', {
                        companyName: config.companyName,
                        qr_code: url
                    });

                    console.log(`📲 [${instanceId}] QR generated.`);

                    if (res && !res.headersSent) {
                        res.json({ success: true, qr_code: url, instance_id: instanceId });
                    }
                })
                .catch((error) => {
                    console.error(`❌ [${instanceId}] QR conversion failed:`, error.message);
                });
        }

        if (connection === 'close') {
            updateSessionStatus(instanceId, 'disconnected', {
                companyName: config.companyName,
                qr_code: null
            }).catch(() => null);

            const shouldReconnect = closeCode !== DisconnectReason.loggedOut;
            const attempts = (reconnectAttempts.get(instanceId) || 0) + 1;
            reconnectAttempts.set(instanceId, attempts);

            console.log(`⚠️ [${instanceId}] Connection closed (code: ${closeCode ?? 'unknown'}). Reconnect: ${shouldReconnect ? 'yes' : 'no'} (attempt ${attempts}/${maxReconnectAttempts})`);

            if (shouldReconnect && attempts <= maxReconnectAttempts) {
                setTimeout(() => connectToWhatsApp(instanceId, config, res), 5000);
            } else {
                updateSessionStatus(instanceId, 'failed_max_retries', {
                    companyName: config.companyName,
                    qr_code: null
                }).catch(() => null);

                if (res && !res.headersSent) {
                    res.status(503).json({
                        error: `No se pudo establecer conexión con WhatsApp tras ${attempts} intentos.`,
                        instance_id: instanceId,
                        close_code: closeCode
                    });
                }

                clearSessionRuntime(instanceId);
            }
        } else if (connection === 'open') {
            reconnectAttempts.set(instanceId, 0);
            updateSessionStatus(instanceId, 'online', {
                companyName: config.companyName,
                qr_code: null
            }).catch(() => null);
            console.log(`✅ [${instanceId}] ${config.companyName} ONLINE!`);
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
    const { companyName, customPrompt, provider = 'baileys', metaApiUrl, metaPhoneNumberId, metaAccessToken, dialogApiKey } = req.body || {};
    const cleanName = String(companyName || '').trim();

    if (!cleanName) {
        return res.status(400).json({ error: 'companyName es requerido.' });
    }

    const instanceId = `alex_${Date.now()}`;
    const tenantId = req.tenant?.id || 'unknown';
    const config = {
        companyName: cleanName,
        customPrompt,
        provider,
        tenantId,
        ownerEmail: req.tenant?.email || '',
        metaApiUrl,
        metaPhoneNumberId,
        metaAccessToken,
        dialogApiKey
    };

    try {
        if (provider !== 'baileys') {
            clientConfigs.set(instanceId, config);
            await updateSessionStatus(instanceId, 'configured_cloud', {
                companyName: cleanName,
                provider,
                qr_code: null
            });

            return res.json({
                success: true,
                instance_id: instanceId,
                provider,
                message: provider === 'meta'
                    ? 'Bot configurado para Meta Cloud API. Configura webhook y token en backend.'
                    : 'Bot configurado para 360Dialog. Configura webhook y credenciales en backend.'
            });
        }

        await connectToWhatsApp(instanceId, config, res);

        const timeoutHandle = setTimeout(async () => {
            if (!res.headersSent) {
                await updateSessionStatus(instanceId, 'timeout_waiting_qr', {
                    companyName: cleanName,
                    provider,
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
    } catch (err) {
        console.error(`❌ [${instanceId}] Connect failed:`, err.message);
        await updateSessionStatus(instanceId, 'error_connecting', {
            companyName: cleanName,
            provider,
            qr_code: null
        });
        res.status(500).json({ error: err.message });
    }
});

router.post('/disconnect', async (req, res) => {
    const { instanceId } = req.body || {};
    if (!instanceId || (!activeSessions.has(instanceId) && !clientConfigs.has(instanceId) && !sessionStatus.has(instanceId))) {
        return res.status(404).json({ error: 'Instance not found' });
    }

    if (activeSessions.has(instanceId)) {
        try {
            activeSessions.get(instanceId).logout();
        } catch (_) { }
    }

    clearSessionRuntime(instanceId);
    clientConfigs.delete(instanceId);
    sessionStatus.delete(instanceId);
    await safeDeletePersistentSession(instanceId);

    try { fs.rmSync(`./sessions/${instanceId}`, { recursive: true, force: true }); } catch (_) { }

    return res.json({ success: true });
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
        qr_code: null
    });

    return res.json({ success: true, instance_id: instanceId, config: nextConfig });
});

router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
});

router.post('/webhook', async (req, res) => {
    const body = req.body;
    if (body.object) {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const messages = changes?.value?.messages;

        if (messages && messages[0]) {
            const msg = messages[0];
            const from = msg.from;
            const text = msg.text?.body;

            if (text) {
                const result = await alexBrain.generateResponse({
                    message: text,
                    botConfig: { bot_name: 'ALEX IO SaaS', system_prompt: 'Eres ALEX IO.' }
                });

                console.log(`📩 [Cloud] ${from}: ${text} -> ${result.text.substring(0, 30)}...`);
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

router.get('/status', (req, res) => {
    const tenantId = req.tenant?.id;
    const isAdmin = req.tenant?.role === 'SUPERADMIN';

    const allSessions = Array.from(sessionStatus.entries()).map(([instanceId, info]) => ({
        instanceId,
        ...info,
        tenantId: clientConfigs.get(instanceId)?.tenantId || null,
        ownerEmail: clientConfigs.get(instanceId)?.ownerEmail || null,
        provider: info.provider || clientConfigs.get(instanceId)?.provider || 'baileys'
    }));

    // Filter by tenant unless admin
    const sessions = isAdmin
        ? allSessions
        : allSessions.filter(s => s.tenantId === tenantId);

    res.json({
        active_sessions: sessions.length,
        reconnecting_sessions: Array.from(reconnectAttempts.entries()).filter(([, attempts]) => attempts > 0).length,
        sessions,
        uptime: process.uptime(),
        cache_stats: global.responseCache?.getStats()
    });
});

router.get('/status/:instanceId', (req, res) => {
    const { instanceId } = req.params;
    const info = sessionStatus.get(instanceId);

    if (!info) return res.status(404).json({ error: 'Instance not found' });

    res.json({
        instance_id: instanceId,
        reconnect_attempts: reconnectAttempts.get(instanceId) || 0,
        ...info,
        provider: info.provider || clientConfigs.get(instanceId)?.provider || 'baileys'
    });
});

// --- GENERATE PROMPT VIA AI ---
router.post('/generate-prompt', async (req, res) => {
    const { businessType, objective, tone, formality, emojis, faqs, limits, humanHandoff, businessName, hours, location, socials, extra } = req.body || {};

    if (!businessName && !businessType) {
        return res.status(400).json({ error: 'Se requiere al menos el nombre del negocio o tipo de negocio.' });
    }

    // Build context from wizard answers
    const wizardContext = [];
    if (businessName) wizardContext.push(`Nombre del negocio: ${businessName}`);
    if (businessType) wizardContext.push(`Tipo: ${businessType}`);
    if (objective) wizardContext.push(`Objetivo principal del bot: ${objective}`);
    if (tone) wizardContext.push(`Tono de comunicación: ${tone}`);
    if (formality) wizardContext.push(`Formalidad: ${formality}`);
    if (emojis) wizardContext.push(`Uso de emojis: ${emojis}`);
    if (hours) wizardContext.push(`Horarios: ${hours}`);
    if (location) wizardContext.push(`Ubicación: ${location}`);
    if (socials) wizardContext.push(`Redes/Web: ${socials}`);

    const validFaqs = (faqs || []).filter(f => f.question && f.question.trim());
    if (validFaqs.length > 0) {
        wizardContext.push('Preguntas frecuentes de clientes:');
        validFaqs.forEach(f => wizardContext.push(`- P: "${f.question}" R: "${f.answer || '(sin respuesta aún)'}"`));
    }

    if (limits && limits.length > 0) {
        wizardContext.push('Reglas y límites del bot:');
        limits.forEach(l => wizardContext.push(`- ${l}`));
    }
    if (humanHandoff) wizardContext.push(`Derivar a humano cuando: ${humanHandoff}`);
    if (extra) wizardContext.push(`Info adicional: ${extra}`);

    const metaPrompt = `Eres un experto en diseño de asistentes virtuales para WhatsApp. 
Un cliente acaba de responder un cuestionario sobre su negocio. 
Tu tarea es generar un SYSTEM PROMPT optimizado para un chatbot de WhatsApp basándote en sus respuestas.

DATOS DEL CUESTIONARIO:
${wizardContext.join('\n')}

REGLAS PARA GENERAR EL PROMPT:
1. El prompt debe estar en español.
2. Debe ser específico para el tipo de negocio.
3. Debe incluir instrucciones claras sobre tono, formalidad y uso de emojis.
4. Debe incorporar las FAQs como conocimiento base.
5. Debe respetar las reglas y límites definidos.
6. Debe ser conciso pero completo (máximo 600 palabras).
7. NO generes nada más que el system prompt. Sin explicaciones, sin markdown, solo el texto del prompt.

Generá el system prompt ahora:`;

    try {
        const result = await alexBrain.generateResponse({
            message: metaPrompt,
            history: [],
            botConfig: {
                bot_name: 'PromptGenerator',
                system_prompt: 'Eres un generador de prompts para chatbots. Solo respondés con el prompt generado, sin explicaciones adicionales.'
            }
        });

        if (result.text && result.text.length > 50) {
            return res.json({
                success: true,
                prompt: result.text,
                model_used: result.trace?.model || 'unknown'
            });
        }
        throw new Error('Respuesta del modelo demasiado corta');
    } catch (err) {
        console.warn('⚠️ AI prompt generation failed, using template:', err.message);

        // Fallback: deterministic template
        const lines = [];
        lines.push(`Eres el asistente virtual de "${businessName || 'nuestro negocio'}".`);
        if (businessType) lines.push(`Tipo de negocio: ${businessType}.`);
        if (objective) lines.push(`Tu objetivo principal es: ${objective.toLowerCase()}.`);
        if (tone) lines.push(`Tu tono es ${tone.toLowerCase()}.`);
        if (formality === 'Usted') lines.push('Siempre tratá al cliente de usted.');
        else lines.push('Podés tutear al cliente.');
        if (emojis?.includes('No')) lines.push('No uses emojis.');
        else if (emojis?.includes('muchos')) lines.push('Usá emojis frecuentemente.');
        else lines.push('Usá emojis con moderación.');
        if (hours) lines.push(`Horarios: ${hours}.`);
        if (location) lines.push(`Ubicación: ${location}.`);
        if (socials) lines.push(`Redes/Web: ${socials}.`);
        if (validFaqs.length > 0) {
            lines.push('\nPreguntas frecuentes:');
            validFaqs.forEach(f => lines.push(`- "${f.question}" → "${f.answer}"`));
        }
        if (limits?.length > 0) {
            lines.push('\nReglas:');
            limits.forEach(l => lines.push(`- ${l}`));
        }
        if (humanHandoff) lines.push(`\nDerivar a humano: ${humanHandoff}`);
        if (extra) lines.push(`\nInfo adicional: ${extra}`);
        lines.push('\nSiempre sé útil, conciso y amable.');

        return res.json({
            success: true,
            prompt: lines.join('\n'),
            model_used: 'template-fallback'
        });
    }
});

module.exports = router;
