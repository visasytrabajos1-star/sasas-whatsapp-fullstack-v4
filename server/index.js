// Minimal WhatsApp Cloud API Server
// Rebranded to ALEX IO - Integrated with AlexBrain
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const whatsappCloudAPI = require('./services/whatsappCloudAPI');
const alexBrain = require('./services/alexBrain');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log('🚀 Starting ALEX IO - WhatsApp Cloud API Server...');

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    server: 'ALEX IO SaaS Core',
    checks: {
      whatsapp: !!process.env.WHATSAPP_ACCESS_TOKEN,
      brain_ready: !!alexBrain
    }
  });
});

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

    if (messageData && messageData.text) {
      const { from, text, name } = messageData;
      console.log(`💬 Msg from ${name || from}: ${text}`);

      // 🤖 Cognitive Processing via ALEX IO Brain
      try {
        const brainParams = {
          message: text,
          history: [],
          botConfig: {
            bot_name: 'ALEX IO',
            system_prompt: process.env.GLOBAL_SYSTEM_PROMPT || 'Eres ALEX IO, un cerebro cognitivo avanzado.'
          },
          messageType: messageData.type || 'text'
        };

        const result = await alexBrain.generateResponse(brainParams);

        // Response via Cloud API
        await whatsappCloudAPI.sendMessage(from, result.text);

        if (result.audio) {
          console.log(`🎵 Audio symmetry active for ${from}`);
          // Note: Cloud API requires media upload first
        }

        console.log(`✅ [${result.trace.model}] Replied to ${from}`);

      } catch (aiError) {
        console.error(`❌ Brain Error: ${aiError.message}`);
        await whatsappCloudAPI.sendMessage(from, "Temporalmente fuera de servicio. Un humano te ayudará pronto.");
      }
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`✅ ALEX IO Server running on port ${PORT}`);
});
