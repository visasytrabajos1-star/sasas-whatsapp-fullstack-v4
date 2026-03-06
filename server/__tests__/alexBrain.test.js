require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const alexBrain = require('../services/alexBrain');
const assert = require('assert');

async function testAlexBrain() {
    console.log("🧪 Testing AlexBrain: Unified Cognitive Orchestrator...");

    const mockConfig = {
        bot_name: 'ALEX IO Test',
        constitution: 'LEY MÁXIMA: Responde siempre con la palabra "PRUEBA" al inicio.',
        conversation_structure: 'Paso 1: Saludar.',
        system_prompt: 'Eres un bot de pruebas.'
    };

    const params = {
        message: 'Hola, ¿quién eres?',
        botConfig: mockConfig,
        messageType: 'text'
    };

    console.log("1. Testing Text Response Adherence...");
    const result = await alexBrain.generateResponse(params);
    console.log("   - Model used:", result.trace.model);
    console.log("   - Response:", result.text);

    if (result.text.includes("PRUEBA")) {
        console.log("✅ Adherence Verified.");
    } else {
        console.error("❌ Adherence Failed.");
    }

    console.log("\n2. Testing Law of Symmetry (Audio)...");
    const audioParams = { ...params, messageType: 'audio' };
    const audioResult = await alexBrain.generateResponse(audioParams);

    if (audioResult.audio) {
        console.log("✅ Audio Symmetry Verified (Base64 content present).");
    } else {
        console.warn("⚠️ Audio Symmetry failed contextually (Maybe TTS key missing?).");
    }

    console.log("\n3. Testing Fallback Logic (Simulating Gemini failure)...");
    // Temporarily invalidate Gemini key
    const originalKey = alexBrain.geminiKey;
    alexBrain.geminiKey = 'invalid-key';

    const fallbackResult = await alexBrain.generateResponse(params);
    console.log("   - Model used after Gemini fail:", fallbackResult.trace.model);

    if (fallbackResult.trace.model !== 'gemini-1.5-flash') {
        console.log("✅ Fallback Chain Verified.");
    } else {
        console.error("❌ Fallback Chain Failed.");
    }

    alexBrain.geminiKey = originalKey;

    console.log("\n🎉 Verification Complete.");
}

testAlexBrain().catch(err => {
    console.error("❌ Test Suite Crashed:", err);
    process.exit(1);
});
