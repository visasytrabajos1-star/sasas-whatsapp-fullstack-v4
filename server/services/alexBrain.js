const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const OpenAI = require('openai');
const NodeCache = require('node-cache');
const crypto = require('crypto');

// --- CONSTANTS ---
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GENAI_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest';

// Global Response Cache
global.responseCache = global.responseCache || new NodeCache({ stdTTL: 1800, checkperiod: 300 });

// AI Clients
const genAI = GEMINI_KEY ? new GoogleGenerativeAI(GEMINI_KEY) : null;
const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

// Log available providers on startup
console.log(`🧠 AI Brain initialized: OpenAI=${!!openai} | Gemini=${!!genAI} | DeepSeek=${!!DEEPSEEK_KEY}`);

/**
 * ARQUITECTURA DE IA (PRIORIDAD CHATGPT MINI 4.0):
 *   TEXTO  → GPT-4o-mini (principal) → Gemini → DeepSeek → Claude → Safeguard
 *   VOZ    → OpenAI TTS-1 (siempre activo si hay key)
 */
async function generateResponse({ message, history = [], botConfig = {} }) {
    const botName = botConfig.bot_name || 'ALEX IO';
    const systemPrompt = botConfig.system_prompt || 'Eres ALEX IO, asistente virtual inteligente.';

    // 1. Check Cache
    const cacheKey = crypto.createHash('md5').update(`${botName}:${message}`).digest('hex');
    const cached = global.responseCache.get(cacheKey);
    if (cached) {
        console.log(`🎯 [${botName}] Cache hit for message`);
        return { ...cached, fromCache: true };
    }

    let responseText = '';
    let usedModel = '';

    // ═══════════════════════════════════════════════
    // 2. TEXTO — PRIORIDAD 1: OpenAI GPT-4o-mini
    // ═══════════════════════════════════════════════
    if (openai) {
        try {
            console.log(`🚀 [${botName}] Solicitando texto a GPT-4o-mini...`);
            const gptRes = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...history.slice(-6).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content || h.text })),
                    { role: 'user', content: message }
                ],
                temperature: 0.7,
                max_tokens: 500
            });
            responseText = gptRes.choices[0].message.content;
            usedModel = 'gpt-4o-mini';
        } catch (err) {
            console.warn('⚠️ OpenAI Text Error:', err.message);
        }
    }

    // 3. Fallback: Gemini
    if (!responseText && genAI) {
        try {
            console.log(`🚀 [${botName}] Fallback a Gemini...`);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const chat = model.startChat({
                history: history.slice(-6).map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content || h.text }] })),
            });
            const result = await chat.sendMessage([{ text: `${systemPrompt}\n\nUsuario: ${message}` }]);
            responseText = result.response.text();
            usedModel = 'gemini-2.0-flash';
        } catch (err) {
            console.warn('⚠️ Gemini Fallback Error:', err.message);
        }
    }

    // 4. Fallback: DeepSeek
    if (!responseText && DEEPSEEK_KEY) {
        try {
            console.log(`🚀 [${botName}] Fallback a DeepSeek...`);
            const dsRes = await axios.post('https://api.deepseek.com/v1/chat/completions', {
                model: 'deepseek-chat',
                messages: [{ role: 'system', content: systemPrompt }, ...history.slice(-6), { role: 'user', content: message }]
            }, { headers: { Authorization: `Bearer ${DEEPSEEK_KEY}` }, timeout: 10000 });
            responseText = dsRes.data.choices[0].message.content;
            usedModel = 'deepseek-chat';
        } catch (err) {
            console.warn('⚠️ DeepSeek Fallback Error:', err.message);
        }
    }

    // 5. Safeguard
    if (!responseText) {
        responseText = '¡Hola! Estoy procesando mucha información ahora mismo. ¿Podrías repetirme eso?';
        usedModel = 'safeguard';
    }

    const result = {
        text: responseText,
        trace: { model: usedModel, timestamp: new Date().toISOString() }
    };

    // ═══════════════════════════════════════════════
    // 6. VOZ — SIEMPRE OpenAI TTS-1 (Push-To-Talk)
    // ═══════════════════════════════════════════════
    if (openai && responseText && usedModel !== 'safeguard') {
        try {
            console.log(`🎙️ [${botName}] Generando nota de voz con OpenAI TTS (Nova)...`);
            const opusAudio = await openai.audio.speech.create({
                model: 'tts-1',
                voice: 'nova',
                input: responseText.slice(0, 4000), // Max allowed roughly
                response_format: 'opus' // Formato nativo de WhatsApp
            });

            const buffer = Buffer.from(await opusAudio.arrayBuffer());
            if (buffer && buffer.length > 0) {
                result.audioBuffer = buffer;
                result.audioMime = 'audio/ogg; codecs=opus';
                console.log(`✅ TTS generado exitosamente (${buffer.length} bytes)`);
            } else {
                console.warn('⚠️ TTS generado pero el buffer está vacío.');
            }
        } catch (err) {
            console.error('❌ Error fatal generando TTS:', err.message);
        }
    } else if (!openai) {
        console.warn('⚠️ OpenAI no está configurado (falta KEY), no se generará voz.');
    }

    // Save to Cache
    global.responseCache.set(cacheKey, result);

    return result;
}

module.exports = { generateResponse };
