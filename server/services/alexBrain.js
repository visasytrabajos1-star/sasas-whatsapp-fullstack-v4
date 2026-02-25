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
console.log(`🧠 AI Providers: Gemini=${!!genAI} | DeepSeek=${!!DEEPSEEK_KEY} | Claude=${!!ANTHROPIC_KEY} | OpenAI=${!!openai}`);

/**
 * Generates a response using the available AI providers (Gemini -> DeepSeek -> OpenAI -> Safeguard)
 * and optionally converts the result to speech if OpenAI is available.
 */
async function generateResponse({ message, history = [], botConfig = {} }) {
    const botName = botConfig.bot_name || 'ALEX IO';
    const systemPrompt = botConfig.system_prompt || 'Eres ALEX IO, asistente virtual inteligente.';

    // 1. Check Cache
    const cacheKey = crypto.createHash('md5').update(`${botName}:${message}`).digest('hex');
    const cached = global.responseCache.get(cacheKey);
    if (cached) return { ...cached, fromCache: true };

    let responseText = '';
    let usedModel = '';

    // 2. Primary: Gemini (Multimodal & Fast) — try multiple models
    if (genAI) {
        const geminiModels = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-pro'];
        for (const modelName of geminiModels) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const chat = model.startChat({
                    history: history.slice(-6).map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content || h.text }] })),
                    generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
                });
                const result = await chat.sendMessage([{ text: `${systemPrompt}\n\nUsuario: ${message}` }]);
                responseText = result.response.text();
                usedModel = modelName;
                break; // Success, stop trying models
            } catch (err) {
                console.warn(`⚠️ Gemini ${modelName} error:`, err.message);
            }
        }
    }

    // 3. Fallback: DeepSeek
    if (!responseText && DEEPSEEK_KEY) {
        try {
            const dsRes = await axios.post('https://api.deepseek.com/v1/chat/completions', {
                model: 'deepseek-chat',
                messages: [{ role: 'system', content: systemPrompt }, ...history.slice(-6), { role: 'user', content: message }]
            }, { headers: { Authorization: `Bearer ${DEEPSEEK_KEY}` }, timeout: 10000 });
            responseText = dsRes.data.choices[0].message.content;
            usedModel = 'deepseek-chat';
        } catch (err) {
            console.warn('⚠️ DeepSeek error:', err.message);
        }
    }

    // 4. Fallback: Claude (Anthropic)
    if (!responseText && ANTHROPIC_KEY) {
        try {
            const claudeMessages = [
                ...history.slice(-6).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content || h.text })),
                { role: 'user', content: message }
            ];
            const claudeRes = await axios.post('https://api.anthropic.com/v1/messages', {
                model: ANTHROPIC_MODEL,
                max_tokens: 500,
                system: systemPrompt,
                messages: claudeMessages
            }, {
                headers: {
                    'x-api-key': ANTHROPIC_KEY,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                timeout: 15000
            });
            const claudeContent = claudeRes.data?.content;
            if (Array.isArray(claudeContent) && claudeContent.length > 0) {
                responseText = claudeContent.map(c => c.text || '').join('');
                usedModel = ANTHROPIC_MODEL;
            }
        } catch (err) {
            console.warn('⚠️ Claude error:', err.message);
        }
    }

    // 5. Fallback: OpenAI
    if (!responseText && openai) {
        try {
            const gptRes = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'system', content: systemPrompt }, ...history.slice(-6), { role: 'user', content: message }]
            });
            responseText = gptRes.choices[0].message.content;
            usedModel = 'gpt-4o-mini';
        } catch (err) {
            console.warn('⚠️ OpenAI error:', err.message);
        }
    }

    // 6. Final Safeguard (No loop)
    if (!responseText) {
        responseText = '¡Hola! Parece que mi conexión a la IA está un poco lenta. ¿Podrías repetirme tu mensaje? Estoy aquí para ayudarte.';
        usedModel = 'safeguard';
    }

    const result = {
        text: responseText,
        trace: { model: usedModel, timestamp: new Date().toISOString() }
    };

    // 7. TTS Implementation (Voice)
    if (openai) {
        try {
            const mp3 = await openai.audio.speech.create({
                model: 'tts-1',
                voice: 'nova',
                input: responseText.slice(0, 4000) // Support long messages but cap at limit
            });
            result.audioBuffer = Buffer.from(await mp3.arrayBuffer());
        } catch (err) {
            console.error('❌ TTS Error:', err.message);
        }
    }

    // 8. Save to Cache
    global.responseCache.set(cacheKey, result);

    return result;
}

module.exports = { generateResponse };
