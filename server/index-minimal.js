// Deploy Trigger: 2026-02-22 08:00 (Stability Patch - Alex IO v7.2)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const axios = require('axios');
const { Server } = require("socket.io");
const { makeWASocket, useMultiFileAuthState, DisconnectReason, delay, downloadMediaMessage } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const OpenAI = require('openai');
const googleTTS = require('google-tts-api');
const { createClient } = require('@supabase/supabase-js');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');
// --- SERVICES ---
const whatsappCloudAPI = require('./services/whatsappCloudAPI');
const alexBrain = require('./services/alexBrain');
const useSupabaseAuthState = require('./services/supabaseAuthState');
const personas = require('./config/personas');

// --- Robust Key Cleaning ---
const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '');
const OPENAI_API_KEY = cleanKey(process.env.OPENAI_API_KEY);

// --- GLOBAL CACHE (SaaS Memory) ---
const NodeCache = require('node-cache');
global.responseCache = global.responseCache || new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// --- RECONEXIÓN CONSTANTS (GLOBAL) ---
global.MAX_RECONNECT_ATTEMPTS = 5;
global.RECONNECT_COOLDOWN = 60000;
global.reconnectAttempts = 0;

// --- SUPABASE SETUP ---
const supabaseUrl = process.env.SUPABASE_URL;
// Use SUPABASE_SERVICE_ROLE_KEY as preferred for persistence, fallback to ANON
const supabaseKey = cleanKey(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY);
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// --- SERVER SETUP ---
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());

// --- HEALTH CHECK (CRITICAL FOR RENDER) ---
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        version: '2.0.4',
        platform: 'ALEX IO SAAS (Minimal)',
        features: ['V6 Protocol Hardening', 'V8 Multi-Tenancy'],
        users: 'Optimized for scale'
    });
});
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));
app.get('/api/diagnostics', async (req, res) => {
    const diag = {
        timestamp: new Date().toISOString(),
        providers: {
            gemini: !!(process.env.GEMINI_API_KEY || process.env.GENAI_API_KEY),
            openai: !!process.env.OPENAI_API_KEY,
            deepseek: !!process.env.DEEPSEEK_API_KEY,
            supabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
            elevenlabs: !!process.env.ELEVENLABS_API_KEY
        },
        system: {
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            cache_size: global.responseCache?.getStats()?.keys || 0
        },
        whatsapp: {
            status: global.connectionStatus,
            sessions: fs.existsSync('./sessions') ? fs.readdirSync('./sessions').length : 0
        }
    };
    res.json(diag);
});

// --- DIRECT QR VIEW (BYPASS FRONTEND) ---
app.get(['/qr-final', '/qr-final**'], (req, res) => {
    if (global.qrCodeUrl) {
        res.send(`
            <div style="background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; min-height: 100vh; font-family: sans-serif; text-align: center; padding: 40px 20px; box-sizing: border-box;">
                <h1 style="color: #4ade80; margin-bottom: 30px;">📱 Escanea para conectar a Alex</h1>
                <div style="background: white; padding: 20px; border-radius: 20px; box-shadow: 0 0 50px rgba(74, 222, 128, 0.2); margin-bottom: 20px;">
                    <img src="${global.qrCodeUrl}" style="width: 300px; height: 300px; display: block;" />
                </div>
                <p style="margin-top: 10px; color: #64748b">Estado: <b>${global.connectionStatus}</b></p>
                <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px; align-items: center;">
                    <div style="display: flex; gap: 10px;">
                        <button onclick="window.location.reload()" style="padding: 12px 24px; background: #1e293b; color: white; border: 1px solid #334155; border-radius: 12px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px;">🔄 Actualizar QR</button>
                        <button onclick="window.location.href='/'" style="padding: 12px 24px; background: #059669; color: white; border: none; border-radius: 12px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px;">🏠 Dashboard</button>
                    </div>
                    <a href="/whatsapp/restart-direct" style="color: #ef4444; font-size: 11px; text-decoration: none; font-weight: bold; border: 1px solid #ef4444; padding: 8px 15px; border-radius: 8px; margin-top: 10px; opacity: 0.7;">⚠️ Limpiar Sesión y Reintentar</a>
                </div>

                <!-- MINI LOGS -->
                <div style="margin-top: 40px; background: rgba(0,0,0,0.3); padding: 20px; border-radius: 20px; width: 100%; max-width: 450px; text-align: left; font-family: monospace; font-size: 11px; border: 1px solid rgba(255,255,255,0.05); overflow-x: hidden;">
                    <p style="color: #4ade80; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; margin-bottom: 10px;">📡 EVENTOS EN TIEMPO REAL</p>
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${global.eventLogs.map(l => `<div style="margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.02); padding-bottom: 4px;"><span style="color: #64748b">[${new Date(l.timestamp).toLocaleTimeString()}]</span> <span style="color: #4ade80">${l.from}:</span> <span style="color: #94a3b8">${l.body}</span></div>`).join('')}
                    </div>
                    <p style="color: #334155; margin-top: 10px; font-size: 9px;">Server Time: ${new Date().toISOString()}</p>
                </div>
            </div>
        `);
    } else {
        res.send(`
            <div style="background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; text-align: center; padding: 40px 20px;">
                <h1 style="color: #64748b; margin-bottom: 5px;">⏳ Alex está despertando...</h1>
                <p style="color: #475569; margin-bottom: 20px;">(Baileys está negociando con la red de WhatsApp)</p>
                <div style="width: 50px; height: 50px; border: 5px solid #1e293b; border-top-color: #4ade80; border-radius: 50%; animation: spin 1s linear infinite; margin: 20px auto;"></div>
                <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
                <p>Estado actual: <b>${global.connectionStatus}</b></p>
                <p style="color: #475569; font-size: 14px; max-width: 300px; margin: 15px auto;">Si tardas más de 1 minuto aquí, es posible que la conexión esté saturada.</p>
                <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px; align-items: center;">
                    <button onclick="window.location.reload()" style="padding: 12px 24px; background: #1e293b; color: white; border: 1px solid #334155; border-radius: 12px; cursor: pointer; font-weight: bold;">🔄 Reintentar Ahora</button>
                    <a href="/whatsapp/restart-direct" style="color: #ef4444; font-size: 11px; text-decoration: none; font-weight: bold; border: 1px solid #ef4444; padding: 5px 15px; border-radius: 8px; margin-top: 10px; opacity: 0.7;">⚠️ Forzar Reinicio Total</a>
                </div>

                <!-- MINI LOGS -->
                <div style="margin-top: 30px; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 15px; width: 100%; max-width: 400px; text-align: left; font-family: monospace; font-size: 11px; border: 1px solid rgba(255,255,255,0.05);">
                    <p style="color: #4ade80; font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; margin-bottom: 10px;">📡 EVENTOS EN TIEMPO REAL</p>
                    ${global.eventLogs.length > 0 ? global.eventLogs.map(l => `<div style="margin-bottom: 4px;"><span style="color: #64748b">[${new Date(l.timestamp).toLocaleTimeString()}]</span> <span style="color: #4ade80">${l.from}:</span> <span style="color: #94a3b8">${l.body}</span></div>`).join('') : '<div style="color: #334155;">Esperando actividad...</div>'}
                    <p style="color: #334155; margin-top: 10px; font-size: 9px;">Server Time: ${new Date().toISOString()}</p>
                </div>
            </div>
        `);
    }
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

// --- STATIC ASSETS ---
const CLIENT_BUILD_PATH = path.resolve(__dirname, '../client/dist');
console.log(`📂 Client Build Path: ${CLIENT_BUILD_PATH}`);
console.log(`🔎 Path Exists?: ${fs.existsSync(CLIENT_BUILD_PATH)}`);

if (fs.existsSync(CLIENT_BUILD_PATH)) {
    console.log("✅ Serving Static Frontend from client/dist");
    app.use(express.static(CLIENT_BUILD_PATH));
} else {
    console.error("❌ client/dist NOT FOUND! Look at Dockerfile or Build Logs.");
}

// --- WHATSAPP CLOUD API ROUTES (OFFICIAL META) ---
app.get('/api/webhook/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const result = whatsappCloudAPI.verifyWebhook(mode, token, challenge);
    if (result) res.status(200).send(result);
    else res.sendStatus(403);
});

app.post('/api/webhook/whatsapp', async (req, res) => {
    try {
        const messageData = await whatsappCloudAPI.processWebhook(req.body);
        if (messageData && (messageData.text || messageData.audio)) {
            const { from, text, audio } = messageData;
            const userId = from.split('@')[0];

            // Proceso cognitivo utilizando la persona global seleccionada
            const result = await generateResponse(text || "Mensaje de audio recibido", global.currentPersona || 'ALEX_MIGRATION', userId, []);

            // Emitir al dashboard el uso de API (v5.1 con métricas)
            const m = result.metrics;
            addEventLog(`🧠 Cerebro: ${result.source} | ${result.tier} (${m.tokens.total} tk | $${m.cost} | ${m.responseTime}ms)`, 'SISTEMA');

            if (audio) {
                // ... audio logic ...
            } else {
                await whatsappCloudAPI.sendMessage(from, result.response);
            }

            // Registrar en usageStats para el Admin Dashboard
            global.usageStats.unshift({
                id: Date.now(),
                created_at: new Date().toISOString(),
                input_text: text || "Audio",
                response_text: result.response,
                source: result.source,
                tier: result.tier,
                metrics: result.metrics
            });
            if (global.usageStats.length > 50) global.usageStats.pop();
        }
        res.sendStatus(200);
    } catch (e) {
        console.error("Cloud API Error:", e.message);
        res.sendStatus(500);
    }
});

app.get('/api/whatsapp/cloud/status', (req, res) => {
    res.json(whatsappCloudAPI.getStatus());
});

app.get('/api/providers/status', (req, res) => {
    res.json(getProviderConfigStatus());
});

// --- GLOBAL STATE ---
let sock;
let isConnecting = false;
global.qrCodeUrl = null;
global.connectionStatus = 'DISCONNECTED';
global.currentPersona = 'ALEX_MIGRATION'; // Priority: Migration
global.eventLogs = [];
global.usageStats = []; // v5.1: Track detailed metrics for dashboard

const addEventLog = (body, from = 'SISTEMA') => {
    const logEntry = { body, from, timestamp: Date.now() };
    global.eventLogs.unshift(logEntry);
    if (global.eventLogs.length > 15) global.eventLogs.pop();
    if (typeof io !== 'undefined') io.emit('wa_log', logEntry);
};

const personas = require('./config/personas');
const sessionsDir = path.join(__dirname, 'auth_info_baileys');
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

// ==============================================================================
// 🧠 ALEX v5.0 COGNITIVE ENGINE (Arquitectura de Migraciones)
// ==============================================================================

// 1. MOCK DATABASE (Supabase Simulator)
const userDatabase = {};

// 3. COGNITIVE PROCESSOR (The Brain)
async function processMessageAleX(userId, userText, userAudioBuffer = null) {
    if (!userDatabase[userId]) {
        userDatabase[userId] = {
            name: 'Candidato',
            chatLog: [],
            currentPersona: 'ALEX_MIGRATION', // Always start as Migration Consultant
            lastMessageTime: 0,
            messageCount: 0
        };
    }
    const user = userDatabase[userId];

    // --- RATE LIMITING (10 per minute) ---
    const now = Date.now();
    if (now - user.lastMessageTime > 60000) {
        user.messageCount = 0;
        user.lastMessageTime = now;
    }
    user.messageCount++;
    if (user.messageCount > 10) {
        return "⚠️ Estás enviando mensajes muy rápido. Por favor, espera un momento.";
    }

    // --- HEURISTIC: COMMANDS ---
    if (userText && (userText.startsWith('!') || userText.startsWith('/'))) {
        const cmd = userText.toLowerCase().trim();

        if (cmd === '!ayuda' || cmd === '!help') {
            return "🌍 *ALEX: Consultoría Migratoria*\n\nSoy tu guía para relocalización técnica en Europa.\n\n✅ *Comandos:*\n• `!status`: Ver mi estado actual.\n• `!reset`: Reiniciar nuestra conversación.";
        }

        if (cmd === '!status') {
            const up = Math.floor(process.uptime() / 60);
            return `📊 *Estado de ALEX*\n\n` +
                `🤖 *Identidad:* Consultor Senior de Migraciones\n` +
                `📡 *Conexión:* ${global.connectionStatus}\n` +
                `⏱️ *Uptime:* ${up} minutos\n` +
                `👤 *Tu histórico:* ${user.chatLog.length} mensajes`;
        }

        if (cmd === '!reiniciar') {
            setTimeout(() => {
                if (sock) sock.end();
                connectToWhatsApp();
            }, 1000);
            return "🔄 *Reiniciando conexión...* Dame 10 segundos.";
        }

        if (cmd === '!reset') {
            user.chatLog = [];
            return "🧹 *Historial reiniciado.* ¿En qué puedo ayudarte con tu diagnóstico migratorio?";
        }
    }

    // Handle Audio
    let processedText = userText;
    if (userAudioBuffer) {
        if (!OPENAI_API_KEY || OPENAI_API_KEY.length < 10) {
            console.error('❌ [ALEX] Whisper ignorado: OpenAI Key faltante o inválida.');
            processedText = "(Audio no transcribible por falta de créditos de Whisper)";
        } else {
            try {
                const tempPath = path.join(__dirname, `audio_in_${Date.now()}.ogg`);
                fs.writeFileSync(tempPath, userAudioBuffer);
                const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
                const transcription = await openai.audio.transcriptions.create({
                    file: fs.createReadStream(tempPath),
                    model: "whisper-1", language: "es"
                });
                processedText = transcription.text;
                fs.unlinkSync(tempPath);
                console.log(`👂 (Whisper): ${processedText}`);
            } catch (e) {
                console.error('⚠️ [ALEX] Whisper fail:', e.message);
                processedText = "(Error al transcribir audio: posible falta de créditos)";
            }
        }
    }

    try {
        const currentPersona = personas[user.currentPersona] || personas['ALEX_MIGRATION'];
        const aiResult = await alexBrain.generateResponse({
            message: processedText,
            history: user.chatLog,
            botConfig: {
                id: user.currentPersona,
                bot_name: currentPersona.name,
                system_prompt: currentPersona.systemPrompt,
            },
            conversationId: user.dbId || userId // Use DB ID if available
        });

        // Mapping AlexBrain result to index-minimal expectations
        const responseText = aiResult.text;
        const trace = aiResult.trace;

        // Push both messages only if AI succeeded
        user.chatLog.push({ role: 'user', content: processedText });
        user.chatLog.push({ role: 'assistant', content: responseText });

        if (user.chatLog.length > 20) user.chatLog = user.chatLog.slice(-20);

        // Agregar logs de uso para el dashboard
        addEventLog(`🧠 Cerebro: ${trace.model} | ${trace.tier} (${trace.tokens} tk | ${trace.responseTime}ms) ${aiResult.fromCache ? '[CACHE]' : ''}`, 'SISTEMA');

        // Registrar en usageStats
        global.usageStats.unshift({
            id: Date.now(),
            created_at: new Date().toISOString(),
            input_text: processedText,
            response_text: responseText,
            source: trace.model,
            tier: trace.tier,
            metrics: {
                tokens: { total: trace.tokens },
                cost: 0, // Cost calculation deferred or simplified
                responseTime: trace.responseTime
            }
        });
        if (global.usageStats.length > 50) global.usageStats.pop();

        return { response: responseText, source: trace.model, tier: trace.tier, metrics: { cost: 0, responseTime: trace.responseTime } };
    } catch (e) {
        console.error('Brain Error:', e);
        return { response: "⚠️ ALEX está optimizando su conexión... dame un momento.", source: 'error', isPaid: false };
    }
}

// 4. VOICE ENGINE (TTS - OGG/Opus Fixed for WhatsApp)
async function speakAlex(id, text) {
    if (!text) return;
    console.log(`🎙️ [speakAlex] Preparando voz para: "${text.substring(0, 50)}..."`);

    // Detect Language Mode
    const isEnglishMode = text.includes('Correction:') || text.includes('Correction 💡');

    // Text Cleaning
    let cleanText = text
        .replace(/[*_~`]/g, '') // Markdown
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2700}-\u{27BF}]/gu, '') // Emojis
        .replace(/(https?:\/\/[^\s]+)/g, 'el enlace') // Don't read URLs
        .replace(/⚠️/g, '') // Manual fix for common emojis
        .trim();

    if (isEnglishMode) cleanText = text.split('💡')[0].trim();

    if (cleanText.length === 0) {
        console.log("⚠️ [speakAlex] Texto vacío tras limpieza. Cancelando voz.");
        return;
    }

    try {
        if (!sock || global.connectionStatus !== 'READY') {
            console.error("❌ [speakAlex] Socket no está listo. Abortando voz.");
            return;
        }

        try {
            await sock.sendPresenceUpdate('recording', id);
        } catch (presErr) {
            console.warn("⚠️ No se pudo enviar presencia 'recording':", presErr.message);
        }

        let voicedBuffer = null;
        // 1. Try OPENAI TTS (Premium Voice Onyx)
        if (OPENAI_API_KEY && OPENAI_API_KEY.length > 10) {
            try {
                const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
                const mp3 = await openai.audio.speech.create({
                    model: "tts-1",
                    voice: process.env.TTS_VOICE || "onyx",
                    input: cleanText.substring(0, 4096).replace(/Alexandra/g, 'ALEX')
                });
                voicedBuffer = Buffer.from(await mp3.arrayBuffer());
                console.log("✅ [speakAlex] Voz premium generada con OpenAI.");
            } catch (err) {
                console.error('⚠️ [speakAlex] OpenAI TTS failed:', err.message);
            }
        }

        // 2. Google Fallback - DISABLED TO AVOID FEMALE VOICE
        if (!voicedBuffer) {
            console.log("🔇 [speakAlex] OpenAI no disponible. Evitando voz de mujer (Google). Respondiendo solo por texto.");
            return; // Exit speakAlex without sending audio
        }

        if (voicedBuffer) {
            console.log("🔄 [speakAlex] Convirtiendo audio a OGG/Opus...");
            const inputStream = new PassThrough();
            inputStream.end(voicedBuffer);

            const resultBuffer = await new Promise((resolve, reject) => {
                const chunks = [];
                const outputStream = new PassThrough();
                ffmpeg(inputStream)
                    .toFormat('ogg')
                    .audioCodec('libopus')
                    .on('error', (err) => reject(err))
                    .pipe(outputStream);
                outputStream.on('data', chunk => chunks.push(chunk));
                outputStream.on('end', () => resolve(Buffer.concat(chunks)));
            });

            await sock.sendMessage(id, {
                audio: resultBuffer,
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true
            });
            console.log(`✅ [speakAlex] Audio enviado a ${id}`);
        } else {
            console.error("❌ [speakAlex] No se pudo generar el buffer de voz.");
        }
    } catch (e) {
        console.error('❌ [speakAlex] Error fatal en generación/envío:', e.message);
    } finally {
        if (sock && global.connectionStatus === 'READY') {
            try {
                await sock.sendPresenceUpdate('paused', id);
            } catch (e) { }
        }
    }
}


// --- BAILEYS CONNECTION LOGIC ---
const EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || `http://localhost:${PORT}`;

async function connectToWhatsApp() {
    console.log('🚀 [ALEX] INICIANDO MOTOR V7.1...');
    if (isConnecting && global.connectionStatus === 'CONNECTING') {
        console.log('⚠️ [ALEX] Connection already in progress. Skipping duplicate call.');
        return;
    }
    isConnecting = true;
    global.connectionStatus = 'CONNECTING';
    io.emit('wa_status', { status: 'CONNECTING' });
    addEventLog('🧠 Iniciando Motor Cognitivo...');
    console.log('🧠 [ALEX] Starting Cognitive Engine...');

    // 1. SESSION MANAGEMENT (SUPABASE PERSISTENCE)
    let authState;
    if (supabase) {
        console.log('🔗 [ALEX] Persistence enabled (Supabase).');
        addEventLog('🔗 Persistencia habilitada (Supabase)');
        try {
            authState = await useSupabaseAuthState(supabase);
        } catch (e) {
            console.error('❌ [ALEX] Supabase Auth Error:', e.message);
            addEventLog('❌ Error en Supabase: ' + e.message);
            authState = await useMultiFileAuthState(sessionsDir);
        }
    } else {
        console.warn('⚠️ [ALEX] Persistence DISABLED. Missing SUPABASE_URL/KEY.');
        addEventLog('⚠️ Persistencia local (Sin Supabase)');
        authState = await useMultiFileAuthState(sessionsDir);
    }
    const { state, saveCreds } = authState;

    // 2. BAILEYS INITIALIZATION
    console.log('📡 [ALEX] Handshaking with WhatsApp...');
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ['Ubuntu', 'Chrome', '120.0.0'],
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        markOnlineOnConnect: false, // Prevents early presence errors
        generateHighQualityLinkPreview: false,
        retryRequestDelayMs: 5000,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            global.connectionStatus = 'QR_READY';
            // Para el dashboard (socket): enviamos el string RAW del QR
            io.emit('wa_qr', { qr: qr });

            // Para la vista directa /qr-final (img tag): enviamos el DataURL
            QRCode.toDataURL(qr, (err, url) => {
                if (!err) {
                    global.qrCodeUrl = url;
                    addEventLog('📱 QR Generado. Escanea para conectar.', 'WHATSAPP');
                    console.log('📱 [ALEX] QR String:', qr);
                }
            });
        }
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`📡 [ALEX] Closed (${statusCode}). Reconnect: ${shouldReconnect}`);
            addEventLog(`📡 Conexión cerrada (${statusCode}). Reintentando: ${shouldReconnect}`);

            if (statusCode === 408 || statusCode === 405) {
                console.error(`🛑 [ALEX] Timeout/Session Error. Retrying without wiping session folder...`);
                // We no longer wipe the session folder here to allow Baileys to resume
            }

            if (shouldReconnect) {
                isConnecting = false;
                global.reconnectAttempts++;
                if (global.reconnectAttempts > global.MAX_RECONNECT_ATTEMPTS) {
                    console.error(`❌ [ALEX] Max reconnection attempts (${global.MAX_RECONNECT_ATTEMPTS}) reached.`);
                    console.error(`⏰ [ALEX] Cooldown for ${global.RECONNECT_COOLDOWN / 60000} minutes before retrying...`);
                    global.connectionStatus = 'DISCONNECTED';
                    setTimeout(() => {
                        console.log('🔄 [ALEX] Cooldown finished. Retrying connection...');
                        global.reconnectAttempts = 0;
                        connectToWhatsApp();
                    }, global.RECONNECT_COOLDOWN);
                } else {
                    const delayMs = Math.min(1000 * Math.pow(2, global.reconnectAttempts), 30000);
                    console.log(`🔄 [ALEX] Reconnecting in ${delayMs / 1000}s (Attempt ${global.reconnectAttempts}/${global.MAX_RECONNECT_ATTEMPTS})...`);
                    setTimeout(connectToWhatsApp, delayMs);
                }
            } else {
                isConnecting = false;
                console.error('❌ [ALEX] Logged out or Unauthorized (401). Manual intervention required.');

                // 1. Wipe local cache
                if (fs.existsSync(sessionsDir)) {
                    try { fs.rmSync(sessionsDir, { recursive: true, force: true }); } catch (e) { }
                }

                // 2. Wipe Supabase Session (CRITICAL TO BREAK THE 401 LOOP)
                if (supabase) {
                    console.log('🧹 [ALEX] Wiping Supabase session due to 401 logout...');
                    supabase.from('whatsapp_sessions').delete().eq('session_id', 'main_session')
                        .then(() => console.log('✅ [ALEX] Supabase session cleared.'))
                        .catch(e => console.error('❌ [ALEX] Supabase clear error:', e.message));
                }

                global.connectionStatus = 'DISCONNECTED';
                global.qrCodeUrl = null;

                // Retry with a clean state after a short delay
                addEventLog('🔄 Sesión expirada. Generando nuevo QR...', 'SISTEMA');
                setTimeout(connectToWhatsApp, 10000);
            }
        } else if (connection === 'open') {
            isConnecting = false;
            reconnectAttempts = 0; // Reset attempts on success
            global.connectionStatus = 'READY';
            global.qrCodeUrl = null;
            io.emit('wa_status', { status: 'READY' });
            addEventLog('✅ WhatsApp Conectado y Listo.', 'WHATSAPP');
            console.log('✅ [ALEX] WhatsApp Connected.');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // MESSAGE HANDLER
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            for (const msg of messages) {
                if (!msg.key.fromMe) {
                    const id = msg.key.remoteJid;
                    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                    const audioMsg = msg.message?.audioMessage || msg.message?.voiceMessage;

                    if (!text && !audioMsg) continue;

                    // Read receipt
                    await sock.readMessages([msg.key]);
                    await sock.sendPresenceUpdate('composing', id);

                    // AUDIO DOWNLOAD
                    let audioBuffer = null;
                    if (audioMsg) {
                        try {
                            audioBuffer = await downloadMediaMessage(
                                msg, 'buffer',
                                { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
                            );
                        } catch (e) { console.error('Audio download failed'); }
                    }

                    // 🧠 CORE COGNITIVE PROCESS
                    try {
                        const result = await processMessageAleX(id, text, audioBuffer);

                        if (!result || !result.response) {
                            console.warn(`⚠️ Brain returned empty response for ${id}`);
                            return;
                        }

                        // SI EL USUARIO MANDÓ AUDIO -> RESPONDE CON AUDIO
                        if (audioMsg) {
                            console.log(`🎤 Entrada de audio detectada para ${id}. Respondiendo ÚNICAMENTE con voz.`);
                            await speakAlex(id, result.response);
                        }
                        // SI NO ES AUDIO MANDÓ TEXTO -> RESPONDE CON TEXTO
                        else {
                            console.log(`💬 Entrada de texto detectada para ${id}. Respondiendo ÚNICAMENTE con texto.`);
                            await sock.sendMessage(id, { text: result.response });
                        }

                    } catch (err) {
                        console.error('Brain Error:', err);
                    }
                }
            }
        }
    });
}

// Routes moved to top

// --- SaaS ENDPOINTS (v5.3 Persistent with Supabase) ---
global.sessionStatus = global.sessionStatus || new Map();
global.sessionQRs = global.sessionQRs || new Map();

// Helper to save to Supabase
const persistInstance = async (instanceId, name, status, qr = null) => {
    if (!supabase) return;
    try {
        await supabase.from('saas_instances').upsert({
            instance_id: instanceId,
            name: name,
            status: status,
            qr_code: qr,
            updated_at: new Date()
        }, { onConflict: 'instance_id' });
    } catch (e) { console.error("Error persisting to Supabase:", e.message); }
};

app.post(['/saas/connect', '/api/saas/connect'], async (req, res) => {
    const { companyName, customPrompt } = req.body;
    const instanceId = `alex_${Date.now()}`;

    try {
        global.sessionStatus.set(instanceId, 'connecting');

        // Save to DB immediately
        await persistInstance(instanceId, companyName, 'connecting');

        if (global.connectionStatus !== 'READY' && global.connectionStatus !== 'CONNECTING') {
            connectToWhatsApp();
        }

        res.json({
            success: true,
            message: 'Iniciando conexión...',
            instance_id: instanceId,
            status: 'connecting'
        });
    } catch (err) {
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

app.get(['/whatsapp/status', '/api/saas/status/:instanceId'], async (req, res) => {
    const { instanceId } = req.params;
    let qr = global.qrCodeUrl || global.sessionQRs.get(instanceId);
    let status = global.connectionStatus;

    // If memory is empty, check DB
    if (!qr && supabase && instanceId) {
        const { data } = await supabase.from('saas_instances').select('*').eq('instance_id', instanceId).single();
        if (data) {
            qr = data.qr_code;
            status = data.status;
        }
    }

    res.json({
        status: status,
        qr: qr,
        persona: global.currentPersona,
        instance_id: instanceId
    });
});

// NEW: Get all persistent instances
app.get(['/saas/instances', '/api/saas/instances'], async (req, res) => {
    if (!supabase) return res.json([{ id: 1, name: 'Mi Negocio (Sin DB)', status: 'online', phone: '+1234567890' }]);

    const { data, error } = await supabase.from('saas_instances').select('*').order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    res.json(data.map(inst => ({
        id: inst.instance_id,
        name: inst.name,
        status: inst.status,
        phone: inst.status === 'online' ? 'Conectado' : 'Pendiente'
    })));
});


app.post('/whatsapp/persona', (req, res) => {
    const { persona } = req.body;
    if (personas[persona]) {
        global.currentPersona = persona;
        addEventLog(`👤 Persona cambiada a: ${persona}`, 'SISTEMA');
        return res.json({ success: true, persona: persona });
    }
    res.status(400).json({ success: false, error: 'Persona invalid' });
});

app.get('/admin/stats', (req, res) => {
    const totalCost = global.usageStats.reduce((acc, curr) => acc + parseFloat(curr.metrics.cost), 0);
    const deepseekCount = global.usageStats.filter(s => s.source === 'deepseek').length;

    res.json({
        summary: {
            total_cost_window: totalCost,
            deepseek_usage_pct: global.usageStats.length > 0 ? Math.round((deepseekCount / global.usageStats.length) * 100) : 0,
            cache_hits: 0, // Placeholder
            total_requests: global.usageStats.length
        },
        logs: global.usageStats.map(s => ({
            id: s.id,
            created_at: s.created_at,
            input_text: s.input_text,
            translated_text: s.response_text.substring(0, 50) + '...',
            cost_estimated: s.metrics.cost,
            provider_llm: s.source,
            tier: s.tier
        }))
    });
});

app.get('/whatsapp/logout', async (req, res) => {
    console.log('🚪 Manual Logout Triggered');
    addEventLog('🚪 Cerrando sesión y borrando datos...', 'SISTEMA');

    global.connectionStatus = 'DISCONNECTED';
    global.qrCodeUrl = null;

    try {
        if (sock) {
            sock.logout(); // Baileys standard logout
            sock.end(undefined);
        }
        // Wipe local files
        if (fs.existsSync(sessionsDir)) fs.rmSync(sessionsDir, { recursive: true, force: true });

        // Wipe Supabase
        if (supabase) {
            await supabase.from('whatsapp_sessions').delete().eq('session_id', 'main_session');
            console.log('✅ Supabase session wiped for logout.');
        }
    } catch (e) { console.error('Logout error:', e); }

    res.send(`
        <div style="background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; text-align: center;">
            <h1 style="color: #4ade80">👋 Sesión Cerrada</h1>
            <p>Se ha desconectado de WhatsApp y borrado la sesión de la base de datos.</p>
            <button onclick="window.location.href='/qr-final'" style="margin-top: 20px; padding: 12px 24px; background: #1e293b; color: white; border: 1px solid #334155; border-radius: 12px; cursor: pointer; font-weight: bold;">Volver a Conectar</button>
        </div>
    `);
});

app.get('/whatsapp/restart-direct', async (req, res) => {
    console.log('🔄 Forced Restart Triggered via URL');
    addEventLog('🔄 Reinicio forzado por el usuario...');

    global.connectionStatus = 'DISCONNECTED';
    global.qrCodeUrl = null;
    global.reconnectAttempts = 0;

    try {
        if (sock) sock.end(undefined);
        if (fs.existsSync(sessionsDir)) {
            fs.rmSync(sessionsDir, { recursive: true, force: true });
        }
    } catch (e) { }

    setTimeout(() => {
        connectToWhatsApp();
    }, 2000);

    res.send(`
        <div style="background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; text-align: center;">
            <h1 style="color: #ef4444">🧹 Sistema Reiniciado</h1>
            <p>Se ha borrado el caché local y se está reintentando la conexión.</p>
            <p>Espera 10 segundos y vuelve a la página del QR.</p>
            <button onclick="window.location.href='/qr-final'" style="margin-top: 20px; padding: 12px 24px; background: #1e293b; color: white; border: 1px solid #334155; border-radius: 12px; cursor: pointer; font-weight: bold;">Volver al QR</button>
        </div>
    `);
});

app.post('/whatsapp/restart', async (req, res) => {
    console.log('🔄 Restarting WhatsApp connection...');
    global.connectionStatus = 'DISCONNECTED';
    global.qrCodeUrl = null;
    try {
        if (sock) sock.end(undefined);
        if (fs.existsSync(sessionsDir)) fs.rmSync(sessionsDir, { recursive: true, force: true });
    } catch (e) { }
    connectToWhatsApp();
    res.json({ success: true, message: 'Restarting...' });
});

app.get('/api/logs', (req, res) => res.json([]));
app.get('*', (req, res) => {
    if (fs.existsSync(path.join(CLIENT_BUILD_PATH, 'index.html'))) {
        res.sendFile(path.join(CLIENT_BUILD_PATH, 'index.html'));
    } else {
        // If frontend is missing, redirect to the direct QR view
        res.redirect('/qr-final');
    }
});

// START
connectToWhatsApp();
server.listen(PORT, () => { console.log(`🚀 Alexandra v2.0 Live on ${PORT}`); });

// --- AGGRESSIVE ANTI-SLEEP (RENDER FIX) ---
setInterval(async () => {
    try {
        // 1. WebSocket Ping (Baileys)
        if (sock && sock.ws && sock.ws.readyState === 1) {
            try { sock.ws.ping(); } catch (e) { }
        }

        // 2. Local Self-Ping (to avoid Render idle)
        // Using localhost:PORT avoids all HTTPS/SSL protocol errors
        try {
            await axios.get(`http://localhost:${PORT}/health`, {
                timeout: 5000,
                headers: { 'User-Agent': 'Alex-Heartbeat/2.0' }
            });
            if (global.connectionStatus === 'READY') {
                // Log only occasionally or depending on debug mode
                // console.log('💓 [ALEX] Heartbeat OK');
            }
        } catch (e) {
            // Silently ignore local errors during restarts
        }
    } catch (error) {
        // Global catch for interval
    }
}, 30000); // Every 30s

// --- STUCK DETECTOR ---
let connectingSince = null;
setInterval(() => {
    if (global.connectionStatus === 'CONNECTING') {
        if (!connectingSince) connectingSince = Date.now();
        const duration = Date.now() - connectingSince;

        if (duration > 45000) { // FIX: 45 segundos para detectar el bloqueo (No 3 minutos!)
            console.warn('🕒 [ALEX] Connection STUCK for 45s. Forcing auto-restart...');
            connectingSince = null;
            global.connectionStatus = 'DISCONNECTED';
            if (sock) try { sock.end(undefined); } catch (e) { }
            connectToWhatsApp();
        }
    } else {
        connectingSince = null;
    }
}, 10000);
