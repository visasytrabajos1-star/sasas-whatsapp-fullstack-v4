const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { chatWithDeepSeek } = require('./adapters/deepseek');
const { speakWithGoogle } = require('./adapters/google');
const { MIGRATION_SYSTEM_PROMPT_V1 } = require('../config/migrationPrompt');

// Load Constitution at startup
const constitutionPath = path.resolve(__dirname, '../../CONSTITUCION_ALEXANDRA.md');
let baseConstitution = "";
try {
    baseConstitution = fs.readFileSync(constitutionPath, 'utf8');
} catch (err) {
    console.error("❌ Failed to load CONSTITUCION_ALEXANDRA.md:", err.message);
}

// Supabase Setup
let supabase = null;
if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
} else {
    console.warn("⚠️ Supabase credentials missing. AlexBrain will run in Limited Mode (No DB Logging).");
    supabase = {
        from: () => ({
            insert: async () => ({ error: null })
        })
    };
}

/**
 * AlexBrain: The unified cognitive orchestrator.
 * Follows the Constitution v5.1 fallback chain and Laws of Symmetry/Transparency.
 */
class AlexBrain {
    constructor() {
        this.baseConstitution = baseConstitution;
        this.geminiKey = process.env.GEMINI_API_KEY || process.env.GENAI_API_KEY || process.env.GOOGLE_API_KEY;
        this.openaiKey = process.env.OPENAI_API_KEY;
    }

    /**
     * Generate response based on incoming message and bot configuration.
     */
    async generateResponse(params) {
        const {
            message,
            history = [],
            botConfig = {},
            conversationId,
            messageType = 'text' // text, audio, image, etc.
        } = params;

        const startTime = Date.now();
        let responseText = null;
        let usedModel = "none";
        let tier = "FREE";
        let retryCount = 0;
        let fallbackUsed = false;
        let tokensUsed = 0;

        // Merge Contexts
        const fullSystemPrompt = this._buildSystemPrompt(botConfig);

        // --- FALLBACK CHAIN (REORDERED: ChatGPT Priority) ---

        // 1. OPENAI GPT-4O-MINI (Primary)
        if (this.openaiKey) {
            try {
                const openaiResult = await this._tryOpenAI(message, history, fullSystemPrompt);
                if (openaiResult) {
                    responseText = openaiResult.text;
                    usedModel = "openai-mini";
                    tier = "PAID";
                    tokensUsed = openaiResult.tokens;
                }
            } catch (err) {
                console.warn("⚠️ AlexBrain: OpenAI Primary Failed. Falling back to Gemini...");
                retryCount++;
            }
        }

        // 2. GEMINI FLASH 1.5 (Secondary)
        if (!responseText) {
            try {
                const geminiResult = await this._tryGemini(message, history, fullSystemPrompt);
                if (geminiResult) {
                    responseText = geminiResult.text;
                    usedModel = "gemini-1.5-flash";
                    tier = "FREE";
                }
            } catch (err) {
                console.warn("⚠️ AlexBrain: Gemini Secondary Failed. Retrying...");
                retryCount++;
                // RETRY (1 time)
                try {
                    const geminiRetry = await this._tryGemini(message, history, fullSystemPrompt);
                    if (geminiRetry) {
                        responseText = geminiRetry.text;
                        usedModel = "gemini-1.5-flash";
                        tier = "FREE";
                    }
                } catch (retryErr) {
                    console.warn("⚠️ AlexBrain: Gemini Retry Failed.");
                }
            }
        }

        // 3. DEEPSEEK (Tertiary)
        if (!responseText && process.env.DEEPSEEK_API_KEY) {
            fallbackUsed = true;
            try {
                const deepseekResult = await chatWithDeepSeek([
                    { role: "system", content: fullSystemPrompt },
                    ...history,
                    { role: "user", content: message }
                ]);
                if (deepseekResult) {
                    responseText = deepseekResult.text;
                    usedModel = "deepseek-chat";
                    tier = "LOW COST";
                }
            } catch (err) {
                console.warn("⚠️ AlexBrain: DeepSeek Failed.");
            }
        }

        // 4. ALEX-BRAIN (Internal/Minimal Fallback)
        if (!responseText) {
            fallbackUsed = true;
            console.info("ℹ️ AlexBrain: Using local fallback logic.");
            responseText = this._generateLocalResponse(message);
            usedModel = "alex-brain";
            tier = "PRO";
        }

        // Final Safeguard (Law of Guaranteed Response)
        if (!responseText) {
            responseText = "Alex IO está procesando tu solicitud, dame un momento.";
            usedModel = "safeguard";
        }

        const responseTimeMs = Date.now() - startTime;

        // Cogitive Trace Logging (Law of Transparency)
        const trace = {
            model: usedModel,
            tier: tier,
            responseTime: responseTimeMs,
            tokens: tokensUsed,
            retryCount,
            fallbackUsed
        };

        // --- LAW OF SYMMETRY (AUDIO) ---
        let audioContent = null;
        if (messageType === 'audio' && responseText) {
            try {
                console.log("🎙️ Law of Symmetry: Generating Audio Response...");
                audioContent = await speakWithGoogle(responseText, botConfig.language || 'es');
            } catch (err) {
                console.error("❌ Audio Symmetry Failed:", err.message);
            }
        }

        // DB Log to messages table if conversationId is provided
        if (conversationId) {
            await this._logToDatabase(conversationId, responseText, trace, audioContent ? 'audio' : 'text');
        }

        return {
            text: responseText,
            audio: audioContent, // Base64 encoded audio
            trace
        };
    }

    _buildSystemPrompt(config) {
        let prompt = this.baseConstitution + "\n\n";
        if (config.constitution) prompt += `📜 LEYES ESPECÍFICAS DEL CLIENTE:\n${config.constitution}\n\n`;
        if (config.conversation_structure) prompt += `📐 ESTRUCTURA DE CONVERSACIÓN:\n${config.conversation_structure}\n\n`;
        if (config.system_prompt) prompt += `👤 PERSONA:\n${config.system_prompt}\n\n`;

        prompt += `INSTRUCCIÓN: Responde siempre como "Alex de Alex IO". Respeta las leyes de simetría y transparencia.`;
        return prompt;
    }

    async _tryGemini(message, history, systemPrompt) {
        if (!this.geminiKey) return null;

        // Usar API oficial v1 en lugar de v1beta para mayor estabilidad
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${this.geminiKey}`;

        const contents = [];
        history.slice(-10).forEach(h => {
            contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content || h.text }] });
        });
        contents.push({ role: 'user', parts: [{ text: message }] });

        const payload = {
            contents,
            systemInstruction: { parts: [{ text: systemPrompt }] }, // Cambiado a camelCase
            generationConfig: { temperature: 0.7, maxOutputTokens: 800 }
        };

        try {
            const res = await axios.post(url, payload, { timeout: 15000 }); // Aumentado timeout
            if (res.data.candidates?.[0]?.content) {
                return { text: res.data.candidates[0].content.parts[0].text };
            }
        } catch (error) {
            console.error("❌ Gemini API Error Details:", error.response?.data || error.message);
            throw error; // Rethrow to trigger the fallback chain
        }
        return null;
    }

    async _tryOpenAI(message, history, systemPrompt) {
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                ...history.slice(-8).map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content || h.text })),
                { role: "user", content: message }
            ]
        }, { headers: { 'Authorization': `Bearer ${this.openaiKey}` }, timeout: 15000 });

        return {
            text: res.data.choices[0].message.content,
            tokens: res.data.usage?.total_tokens || 0
        };
    }

    _generateLocalResponse(message) {
        // Minimal logic for technical/fallback scenarios
        if (message.toLowerCase().includes("hola")) return "Hola, soy Alex de Alex IO. ¿Cómo puedo ayudarte hoy?";
        return "Entiendo. Estoy procesando tu consulta con mis módulos de respaldo.";
    }

    async _logToDatabase(conversationId, text, trace, messageType = 'text') {
        try {
            await supabase.from('messages').insert({
                conversation_id: conversationId,
                direction: 'outbound',
                content: text,
                message_type: messageType,
                is_ai_generated: true,
                ai_model: trace.model,
                ai_tokens_used: trace.tokens,
                processing_time_ms: trace.responseTime,
                status: 'sent'
            });
        } catch (err) {
            console.error("❌ Failed to log AI message to DB:", err.message);
        }
    }
}

module.exports = new AlexBrain();
