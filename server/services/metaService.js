const axios = require('axios');
const { generateResponse, runComplianceAudit, translateIncomingMessage, extractLeadInfo } = require('./alexBrain');
const { supabase, isSupabaseEnabled } = require('./supabaseClient');
const hubspotService = require('./hubspotService');
const copperService = require('./copperService');

// Caches for basic rate limit and dedup
const processedMessages = new Set();
const clientConfigs = new Map(); // Store active Meta configs

/**
 * Register a Meta configuration (Page Access Token, etc) in memory.
 */
const registerMetaConfig = (instanceId, config) => {
    clientConfigs.set(instanceId, config);
    console.log(`✅ [META] Registered config for instance ${instanceId} (Page: ${config.metaPhoneNumberId})`);
};

/**
 * Send a reply back via the Meta Graph API v18+ (Messenger or Instagram)
 */
const sendMetaReply = async (recipientId, text, pageAccessToken) => {
    if (!pageAccessToken) {
        console.error('❌ [META ERROR] Missing Page Access Token for reply');
        return false;
    }

    try {
        const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`;
        const payload = {
            recipient: { id: recipientId },
            message: { text }
        };

        const res = await axios.post(url, payload, { timeout: 8000 });
        console.log(`✅ [META] Message sent to ${recipientId} (Msg ID: ${res.data.message_id})`);
        return true;
    } catch (err) {
        console.error(`❌ [META ERROR] Failed to send to ${recipientId}:`, err.response?.data || err.message);
        return false;
    }
};

/**
 * Handle incoming Meta Webhook events (from messaging payload)
 */
const handleIncomingMetaEvent = async (event, req) => {
    const { object, entry } = event;

    // We only care about page / instagram events
    if (object !== 'page' && object !== 'instagram') return;

    for (const ent of entry) {
        // Find which instance is configured for this page/account ID
        const pageId = ent.id;

        let activeConfig = null;
        let activeInstanceId = null;

        for (const [instanceId, conf] of clientConfigs.entries()) {
            // We use metaPhoneNumberId as a generic field to store the Page ID or IG Account ID
            if (conf.metaPhoneNumberId === pageId) {
                activeConfig = conf;
                activeInstanceId = instanceId;
                break;
            }
        }

        if (!activeConfig) {
            console.warn(`⚠️ [META] Unrecognized Page ID: ${pageId}. No active bot configured.`);
            continue; // Not an error, maybe another app handles it
        }

        // Process messaging events
        if (ent.messaging) {
            for (const msgEvent of ent.messaging) {
                // Must have a sender and text message
                if (msgEvent.sender && msgEvent.sender.id && msgEvent.message && msgEvent.message.text) {
                    const senderId = msgEvent.sender.id;
                    const messageId = msgEvent.message.mid;
                    const rawText = msgEvent.message.text;

                    // Deduplicate messages (Webhooks can retry)
                    if (processedMessages.has(messageId)) {
                        console.log(`[META] Ignoring duplicate message: ${messageId}`);
                        continue;
                    }
                    processedMessages.add(messageId);
                    if (processedMessages.size > 1000) processedMessages.clear(); // simple LRU

                    console.log(`📩 [META ${object}] Incoming from ${senderId}: "${rawText.substring(0, 50)}"`);

                    // Process through the standard AI Brain pipeline
                    await processMetaMessage(senderId, rawText, activeInstanceId, activeConfig, object);
                }
            }
        }
    }
};

/**
 * Shared logic to process the normalized message, log to DB, hit Brain, and reply
 */
const processMetaMessage = async (remoteJid, rawText, instanceId, config, platform) => {
    const tenantId = config.tenantId;

    // Translate (standard inbox approach)
    const translationResult = await translateIncomingMessage(rawText, 'es');
    const processedText = translationResult.translated || translationResult.original;

    if (tenantId && isSupabaseEnabled) {
        supabase.from('messages').insert({
            instance_id: instanceId,
            tenant_id: tenantId,
            remote_jid: remoteJid,
            direction: 'INBOUND',
            message_type: 'text',
            content: processedText,
            content_original: translationResult.original,
            translation_model: translationResult.model || 'none'
        }).catch(e => console.warn(`⚠️ [META] Error logging inbound message:`, e.message));
    }

    // Prepare History
    let history = [];
    if (tenantId && isSupabaseEnabled) {
        try {
            const { data: dbHistory } = await supabase
                .from('messages')
                .select('direction, content')
                .eq('instance_id', instanceId)
                .eq('remote_jid', remoteJid)
                .order('created_at', { ascending: false })
                .limit(10);

            if (dbHistory && dbHistory.length > 0) {
                history = dbHistory.reverse().map(row => ({
                    role: row.direction === 'INBOUND' ? 'user' : 'assistant',
                    content: row.content
                }));
            }
        } catch (err) {
            // Ignore history fetch errors
        }
    }
    history.push({ role: 'user', content: processedText });

    // AI Brain
    const result = await generateResponse({
        message: processedText,
        history,
        botConfig: {
            bot_name: config.companyName,
            system_prompt: config.customPrompt,
            tenantId,
            instanceId,
            maxWords: config.maxWords || 50,
            maxMessages: config.maxMessages || 15
        },
        isAudio: false // Meta webhooks usually text for now
    });

    if (result.botPaused) {
        console.log(`⏸️ [META] Limiter triggered for ${remoteJid}`);
        if (result.text) await sendMetaReply(remoteJid, result.text, config.metaAccessToken);
        return;
    }

    if (result.text) {
        // Send reply
        await sendMetaReply(remoteJid, result.text, config.metaAccessToken);

        // Log Outbound
        if (tenantId && isSupabaseEnabled) {
            supabase.from('messages').insert({
                instance_id: instanceId,
                tenant_id: tenantId,
                remote_jid: remoteJid,
                direction: 'OUTBOUND',
                message_type: 'text',
                content: result.text
            }).select().then(({ data, error }) => {
                if (!error && data && data.length > 0) {
                    runComplianceAudit({
                        messageContent: processedText,
                        aiResponse: result.text,
                        systemPrompt: config.customPrompt,
                        tenantId,
                        instanceId,
                        messageId: data[0].id,
                        supabase
                    }).catch(e => null);
                }
            });

            // Increment Usage limits
            supabase.rpc('increment_tenant_usage', {
                t_id: tenantId, msg_incr: 1, tk_incr: result.trace?.usage?.totalTokens || 150
            }).catch(e => null);
        }
    }

    // Background Lead Extraction
    const intentTriggers = /(comprar|precio|costo|agendar|cita|quiero|info|contacto)/i;
    if (processedText.match(intentTriggers) || history.length % 5 === 0) {
        extractLeadInfo({ history, systemPrompt: config.customPrompt }).then(lead => {
            if (lead && lead.isLead) {
                let enrichedLead = { ...lead, phone: remoteJid, instanceId, tenantId, platform };
                // Send to CRMs
                if (config.hubspotAccessToken) hubspotService.syncContact(remoteJid, lead, config.hubspotAccessToken).catch(e => null);
                if (config.webhookUrl) axios.post(config.webhookUrl, enrichedLead, { timeout: 5000 }).catch(e => null);
            }
        }).catch(e => null);
    }
};

module.exports = {
    registerMetaConfig,
    handleIncomingMetaEvent,
    sendMetaReply
};
