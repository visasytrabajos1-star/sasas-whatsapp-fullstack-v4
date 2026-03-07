const axios = require('axios');
const crypto = require('crypto');
const { generateResponse, runComplianceAudit, translateIncomingMessage, extractLeadInfo } = require('./alexBrain');
const { supabase, isSupabaseEnabled } = require('./supabaseClient');
const hubspotService = require('./hubspotService');

const processedMessages = new Set();
const clientConfigs = new Map();

/**
 * Register a TikTok configuration
 * Using metaPhoneNumberId conceptually as TikTok App Key / Account ID for generic storage
 */
const registerTikTokConfig = (instanceId, config) => {
    clientConfigs.set(instanceId, config);
    console.log(`✅ [TIKTOK] Registered config for instance ${instanceId}`);
};

/**
 * Signature validation for TikTok Webhooks
 */
const verifyTikTokSignature = (req, appSecret) => {
    const signature = req.headers['x-tt-signature'];
    const timestamp = req.headers['x-tt-timestamp'];
    const nonce = req.headers['x-tt-nonce'];
    const body = req.rawBody || JSON.stringify(req.body);

    if (!signature || !timestamp || !nonce) return false;

    const stringToSign = `${appSecret}${timestamp}${nonce}${body}`;
    const expectedSignature = crypto.createHash('sha256').update(stringToSign).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
};

/**
 * Send a reply back via TikTok direct messaging API
 */
const sendTikTokReply = async (conversationId, text, accessToken) => {
    if (!accessToken) return false;

    try {
        const url = `https://open.tiktokapis.com/v2/message/send/`;
        const payload = {
            conversation_id: conversationId,
            message: { content: text }
        };

        const res = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 8000
        });
        console.log(`✅ [TIKTOK] Message sent to conv ${conversationId}`);
        return true;
    } catch (err) {
        console.error(`❌ [TIKTOK ERROR] Failed to send:`, err.response?.data || err.message);
        return false;
    }
};

/**
 * Handle incoming TikTok Webhook events
 */
const handleIncomingTikTokEvent = async (event) => {
    // TikTok Event format usually contains data.conversation_id, data.sender_id, data.message
    if (!event.data || !event.data.message) return;

    const { conversation_id, sender_id, message } = event.data;
    const messageId = message.message_id || event.log_id;
    const rawText = message.content;

    // Deduplicate
    if (processedMessages.has(messageId)) return;
    processedMessages.add(messageId);
    if (processedMessages.size > 1000) processedMessages.clear();

    console.log(`📩 [TIKTOK] Incoming from ${sender_id}: "${rawText.substring(0, 50)}"`);

    // Find the right instance (for TikTok we normally use 1 app per backend or map by some token ID)
    // For simplicity in SaaS, assume finding first tiktok config or map by metadata
    let activeConfig = null;
    let activeInstanceId = null;

    for (const [instanceId, conf] of clientConfigs.entries()) {
        if (conf.provider === 'tiktok') {
            activeConfig = conf;
            activeInstanceId = instanceId;
            break;
        }
    }

    if (!activeConfig) {
        console.warn(`⚠️ [TIKTOK] No active TikTok bot configured on this server.`);
        return;
    }

    await processTikTokMessage(conversation_id, sender_id, rawText, activeInstanceId, activeConfig);
};

const processTikTokMessage = async (conversationId, senderId, rawText, instanceId, config) => {
    const tenantId = config.tenantId;

    // Translation
    const translationResult = await translateIncomingMessage(rawText, 'es');
    const processedText = translationResult.translated || translationResult.original;

    if (tenantId && isSupabaseEnabled) {
        supabase.from('messages').insert({
            instance_id: instanceId, tenant_id: tenantId, remote_jid: senderId,
            direction: 'INBOUND', message_type: 'text', content: processedText
        }).catch(e => null);
    }

    // AI Brain
    const result = await generateResponse({
        message: processedText,
        history: [{ role: 'user', content: processedText }], // Short history for tiktok
        botConfig: {
            bot_name: config.companyName,
            system_prompt: config.customPrompt,
            tenantId, instanceId
        }
    });

    if (result.text && !result.botPaused) {
        // Send reply
        await sendTikTokReply(conversationId, result.text, config.metaAccessToken); // Reusing field for token

        if (tenantId && isSupabaseEnabled) {
            supabase.from('messages').insert({
                instance_id: instanceId, tenant_id: tenantId, remote_jid: senderId,
                direction: 'OUTBOUND', message_type: 'text', content: result.text
            }).catch(e => null);
        }
    }
};

module.exports = {
    registerTikTokConfig,
    handleIncomingTikTokEvent,
    verifyTikTokSignature
};
