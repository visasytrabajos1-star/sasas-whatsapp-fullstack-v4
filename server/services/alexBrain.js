const axios = require('axios');
const OpenAI = require('openai');
const NodeCache = require('node-cache');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const personas = require('../config/personas');

// Circuit Breaker for expired keys
const deadKeys = new Set();
const KEY_COOLDOWN_MS = 3600000; // 1 hour

// --- CONSTANTS ---
const GEMINI_KEY = (process.env.GEMINI_API_KEY || process.env.GENAI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
const OPENAI_KEY = (process.env.OPENAI_API_KEY || "").trim();
const DEEPSEEK_KEY = (process.env.DEEPSEEK_API_KEY || "").trim();

// Global Response Cache
global.responseCache = global.responseCache || new NodeCache({ stdTTL: 1800, checkperiod: 300 });

// OpenAI Client (for TTS)
const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

const mask = (key) => key ? `${key.substring(0, 7)}...${key.substring(key.length - 4)}` : 'MISSING';
console.log(`🧠 [CASCADE] Inicializando Cerebro:`);
console.log(`   - Gemini: ${mask(GEMINI_KEY)}`);
console.log(`   - OpenAI: ${mask(OPENAI_KEY)} (CRÍTICO PARA VOZ Y FALLBACK)`);
console.log(`   - DeepSeek: ${mask(DEEPSEEK_KEY)}`);

/**
 * ARCHITECTURE: Cascade / Circuit Breaker
 * 1. Gemini (Primario) -> 2. OpenAI (Secondary) -> 3. Safeguard (Static)
 * ALWAY TTS at the end.
 */
async function generateResponse({ message, history = [], botConfig = {}, isAudio = false }) {
    const botName = botConfig.bot_name || 'ALEX IO';
    const personaKey = botConfig.persona || 'ALEX_MIGRATION';
    const currentPersona = personas[personaKey] || personas['ALEX_MIGRATION'];
    const systemPrompt = botConfig.system_prompt || currentPersona.systemPrompt;

    const cacheKey = crypto.createHash('md5').update(`v2:${botName}:${message}`).digest('hex');
    let cached = global.responseCache.get(cacheKey);

    if (cached) {
        console.log(`🎯 [${botName}] Cache hit`);
        return { ...cached, fromCache: true };
    }

    let responseText = '';
    let usedModel = '';
    const normalizedUserMsg = String(message || "").trim();

    // 1. GEMINI (AXIOS implementation for stability)
    if (GEMINI_KEY && GEMINI_KEY.length > 20 && !deadKeys.has('GEMINI')) {
        // Try multiple Gemini versions/models
        const gems = [
            { v: 'v1beta', m: 'gemini-2.0-flash-exp' }, // Try experimental if latest fails
            { v: 'v1beta', m: 'gemini-1.5-flash-latest' },
            { v: 'v1', m: 'gemini-1.5-flash' },
            { v: 'v1beta', m: 'gemini-pro' } // Fallback to pro if flash is saturated
        ];

        for (const g of gems) {
            try {
                console.log(`🚀 [${botName}] Consultando ${g.m} (${g.v})...`);
                const url = `https://generativelanguage.googleapis.com/${g.v}/models/${g.m}:generateContent?key=${GEMINI_KEY}`;

                const contents = [];
                (history || []).slice(-6).forEach(h => {
                    contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content || h.text || "" }] });
                });
                contents.push({ role: 'user', parts: [{ text: normalizedUserMsg }] });

                const payload = {
                    contents,
                    generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
                };
                if (g.v === 'v1beta') payload.system_instruction = { parts: [{ text: systemPrompt }] };

                const res = await axios.post(url, payload, { timeout: 6000 });
                if (res.data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    responseText = res.data.candidates[0].content.parts[0].text;
                    usedModel = g.m;
                    break;
                }
            } catch (err) {
                const errorMsg = err.response?.data?.error?.message || err.message;
                const statusCode = err.response?.status;
                console.warn(`⚠️ [${botName}] ${g.m} falló (${statusCode}):`, errorMsg);

                // If quota exceeded (429) or model not found (404), try next model in list
                if (statusCode === 429 && errorMsg.includes('quota')) {
                    continue;
                }

                if (statusCode === 400 && (errorMsg.includes('expired') || errorMsg.includes('API key'))) {
                    console.error(`🛑 [${botName}] Gemini API Key EXPIRED. Disabling for 1 hour.`);
                    deadKeys.add('GEMINI');
                    setTimeout(() => deadKeys.delete('GEMINI'), KEY_COOLDOWN_MS);
                    break;
                }
            }
        }
    }

    // 2. DEEPSEEK FALLBACK (If configured and Gemini failed)
    if (!responseText && DEEPSEEK_KEY && !deadKeys.has('DEEPSEEK')) {
        try {
            console.log(`🚀 [${botName}] Fallback extra: DeepSeek...`);
            const dsRes = await axios.post('https://api.deepseek.com/v1/chat/completions', {
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...(history || []).slice(-6).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content || h.text })),
                    { role: 'user', content: normalizedUserMsg }
                ]
            }, { headers: { Authorization: `Bearer ${DEEPSEEK_KEY}` }, timeout: 7000 });

            responseText = dsRes.data.choices[0].message.content;
            usedModel = 'deepseek-chat';
        } catch (err) {
            const errorMsg = err.response?.data?.error?.message || err.message;
            console.warn(`⚠️ [${botName}] DeepSeek Fallback Error:`, errorMsg);
            if (errorMsg.includes('Balance') || errorMsg.includes('API key')) {
                deadKeys.add('DEEPSEEK');
                setTimeout(() => deadKeys.delete('DEEPSEEK'), KEY_COOLDOWN_MS);
            }
        }
    }

    // 3. OPENAI FALLBACK (Secondary)
    if (!responseText && OPENAI_KEY && !deadKeys.has('OPENAI')) {
        try {
            console.log(`🚀 [${botName}] Fallback: GPT-4o-mini...`);
            const completion = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...(history || []).slice(-6).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content || h.text })),
                    { role: 'user', content: normalizedUserMsg }
                ]
            }, { headers: { Authorization: `Bearer ${OPENAI_KEY}` }, timeout: 8000 });

            responseText = completion.data.choices[0].message.content;
            usedModel = 'gpt-4o-mini';
        } catch (err) {
            const errorMsg = err.response?.data?.error?.message || err.message;
            console.error(`❌ [${botName}] OpenAI Error:`, errorMsg);
            if (errorMsg.includes('expired') || errorMsg.includes('Insufficient')) {
                deadKeys.add('OPENAI');
                setTimeout(() => deadKeys.delete('OPENAI'), KEY_COOLDOWN_MS);
            }
        }
    }

    // 3. SAFEGUARD
    if (!responseText) {
        responseText = '¡Hola! Soy ALEX. Estoy experimentando una alta demanda en mis sistemas de IA, pero no te preocupes, sigo aquí. ¿En qué puedo ayudarte mientras recupero mi conexión total?';
        usedModel = 'safeguard';
    }

    const result = {
        text: responseText,
        trace: { model: usedModel, timestamp: new Date().toISOString() }
    };

    // 4. VOZ (RE-ENABLED - Condicional)
    if (openai && responseText && isAudio) {
        try {
            console.log(`🎙️ [${botName}] Generando Audio PTT (${botConfig.voice || 'nova'})...`);
            const mp3 = await openai.audio.speech.create({
                model: 'tts-1',
                voice: botConfig.voice || 'nova',
                input: responseText.slice(0, 3500),
                response_format: 'opus'
            });
            result.audioBuffer = Buffer.from(await mp3.arrayBuffer());
            result.audioMime = 'audio/ogg; codecs=opus';
            console.log(`✅ Audio PTT generado (${result.audioBuffer.length} bytes).`);
        } catch (err) {
            console.error(`❌ [${botName}] TTS Error:`, err.message);
        }
    }

    global.responseCache.set(cacheKey, result);
    return result;
}

/**
 * Función en segundo plano para analizar si la conversación actual forma a un prospecto (Lead)
 * y extraer su temperatura y datos para el CRM.
 */
async function extractLeadInfo({ history = [], systemPrompt }) {
    if (!GEMINI_KEY || history.length < 2) return null;

    try {
        console.log(`🤖 [LeadExtractor] Analizando conversación de ${history.length} mensajes...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

        const contents = [];
        // Analizar últimos 8 mensajes para contexto
        history.slice(-8).forEach(h => {
            contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content || h.text || "" }] });
        });

        const analysisPrompt = `
Analiza la conversación anterior. 
El System Prompt del Bot actuante era: "${systemPrompt || ''}"

Extrae la información del usuario en un objeto JSON estricto con esta estructura EXACTA (sin markdown adicional):
{
    "isLead": boolean (true si el usuario mostró interés, pidió info, precios, agendar, o dio sus datos),
    "name": string (nombre del usuario si lo dio, o "desconocido"),
    "email": string (correo si lo dio, o null),
    "temperature": string ("COLD" si solo saluda/curiosea, "WARM" si pregunta detalles/precios, "HOT" si quiere comprar/agendar o da sus datos),
    "summary": string (resumen de 1-2 líneas de lo que quiere el usuario o de la interacción)
}
`;
        contents.push({ role: 'user', parts: [{ text: analysisPrompt }] });

        const payload = {
            contents,
            generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json"
            }
        };

        const res = await axios.post(url, payload, { timeout: 8000 });
        if (res.data.candidates?.[0]?.content?.parts?.[0]?.text) {
            const parsed = JSON.parse(res.data.candidates[0].content.parts[0].text);
            return parsed;
        }
    } catch (err) {
        console.warn(`⚠️ [LeadExtractor] Falló la extracción:`, err.response?.data?.error?.message || err.message);
    }
    return null;
}

/**
 * Transcribe un archivo de audio usando OpenAI Whisper.
 */
async function transcribeAudio(audioBuffer) {
    if (!openai) throw new Error('OpenAI no configurado para STT');

    // Whisper requires a file, so we write the buffer to a temp file
    const tmpFilePath = path.join(os.tmpdir(), `audio_${Date.now()}.ogg`);
    fs.writeFileSync(tmpFilePath, audioBuffer);

    try {
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tmpFilePath),
            model: 'whisper-1',
            response_format: 'text' // Returns a raw string directly
        });
        return { text: transcription };
    } catch (err) {
        console.error('❌ Error en STT Whisper:', err);
        throw err;
    } finally {
        if (fs.existsSync(tmpFilePath)) {
            fs.unlinkSync(tmpFilePath);
        }
    }
}

module.exports = { generateResponse, extractLeadInfo, transcribeAudio };

