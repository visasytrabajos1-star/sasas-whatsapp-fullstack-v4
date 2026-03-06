require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function testTTS() {
    console.log("⏳ Testando OpenAI TTS con la clave actual...");
    try {
        const response = await openai.audio.speech.create({
            model: "tts-1",
            voice: "nova",
            input: "Hola, soy Alex. Esta es una prueba de voz para verificar que la API está funcionando correctamente.",
            response_format: "opus"
        });

        const buffer = Buffer.from(await response.arrayBuffer());
        console.log(`✅ TTS Exitoso. Buffer recibido: ${buffer.length} bytes.`);
        fs.writeFileSync('test_audio.ogg', buffer);
        console.log("📁 Archivo 'test_audio.ogg' guardado localmente para verificación.");
    } catch (err) {
        console.error("❌ Error en OpenAI TTS:", err.message);
        if (err.message.includes("insufficient_quota")) {
            console.error("👉 El error es de cuota (dinero insuficiente en la cuenta de OpenAI).");
        }
    }
}

testTTS();
