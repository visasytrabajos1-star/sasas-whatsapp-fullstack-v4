require('dotenv').config();
const axios = require('axios');

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GENAI_API_KEY;

if (!GEMINI_KEY) {
    console.error('❌ No GEMINI_API_KEY found in environment.');
    process.exit(1);
}

async function listModels() {
    try {
        console.log('Fetching available Gemini models (v1beta)...');
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`;
        const res = await axios.get(url);

        console.log('\n--- AVAILABLE MODELS ---');
        res.data.models.forEach(m => {
            console.log(`- ${m.name} (${m.displayName}) - Supported generation methods: ${m.supportedGenerationMethods.join(', ')}`);
        });
        console.log('------------------------\n');
    } catch (err) {
        console.error('❌ Error fetching models:', err.response?.data?.error?.message || err.message);
    }
}

listModels();
