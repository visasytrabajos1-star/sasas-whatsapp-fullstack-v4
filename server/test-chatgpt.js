const OpenAI = require('openai');
const fs = require('fs');
require('dotenv').config();

const cleanKey = (k) => (k || "").trim().replace(/[\r\n\t]/g, '').replace(/\s/g, '').replace(/["']/g, '');
const OPENAI_KEY = cleanKey(process.env.OPENAI_API_KEY);

if (!OPENAI_KEY) {
    console.error("❌ START FAILED: Sin OPENAI_API_KEY en .env");
    process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });

async function run() {
    console.log("--- 1. Testing GPT-4o-mini ---");
    let responseText = "";
    try {
        const res = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Responde de forma muy corta y directa." },
                { role: "user", content: "Dime hola y tu nombre." }
            ]
        });
        responseText = res.choices[0].message.content;
        console.log("✅ Respuesta Chat:", responseText);
    } catch (e) {
        console.error("❌ GPT-4o-mini Falló:", e.message);
        return;
    }

    console.log("\n--- 2. Testing OpenAI TTS (Opus/OGG) ---");
    try {
        const audioRes = await openai.audio.speech.create({
            model: "tts-1",
            voice: "nova",
            input: responseText,
            response_format: "opus"
        });

        const buffer = Buffer.from(await audioRes.arrayBuffer());
        fs.writeFileSync('test_audio.ogg', buffer);
        console.log(`✅ Audio creado correctamente: test_audio.ogg (${buffer.length} bytes)`);
    } catch (e) {
        console.error("❌ OpenAI TTS Falló:", e.message);
    }
}

run();
