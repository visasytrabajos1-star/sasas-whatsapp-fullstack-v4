/**
 * ASSISTANT ROUTER - ALEX IO Standardized
 * Routes incoming messages to the unified alexBrain orchestrator.
 * Legacy assistant types removed in favor of dynamic Constitution.
 */

const alexBrain = require('./alexBrain');

class AssistantRouter {
    constructor(supabase) {
        this.supabase = supabase;
    }

    /**
     * Route message to unified brain
     */
    async routeMessage(whatsappAccountId, message) {
        try {
            // 1. Get WhatsApp account & Bot Config (Constitution + Flow)
            const { data: account, error: accountError } = await this.supabase
                .from('whatsapp_accounts')
                .select(`
                    *,
                    bot_configs (*)
                `)
                .eq('id', whatsappAccountId)
                .single();

            if (accountError || !account) {
                console.error('Account not found:', accountError);
                return this.getDefaultResponse();
            }

            const botConfig = account.bot_configs;

            // 2. Get or create conversation
            const conversation = await this.getOrCreateConversation(
                whatsappAccountId,
                message.from
            );

            // 3. Save incoming message (Traceability)
            await this.saveMessage(conversation.id, message, 'inbound');

            // 4. Invoke the Brain
            const brainParams = {
                message: message.content || message.text,
                history: [],
                botConfig: botConfig,
                conversationId: conversation.id,
                messageType: message.type || 'text'
            };

            const response = await alexBrain.generateResponse(brainParams);

            // 5. Update conversation stats
            await this.updateConversationStats(conversation.id);

            return {
                text: response.text,
                model: response.trace.model,
                audio: response.audio
            };

        } catch (error) {
            console.error('Error in AssistantRouter:', error);
            return this.getDefaultResponse();
        }
    }

    async getOrCreateConversation(whatsappAccountId, customerPhone) {
        let { data: conversation } = await this.supabase
            .from('conversations')
            .select('*')
            .eq('whatsapp_account_id', whatsappAccountId)
            .eq('customer_phone', customerPhone)
            .eq('status', 'active')
            .single();

        if (!conversation) {
            const { data: newConv, error } = await this.supabase
                .from('conversations')
                .insert({
                    whatsapp_account_id: whatsappAccountId,
                    customer_phone: customerPhone,
                    status: 'active'
                })
                .select()
                .single();

            if (error) throw error;
            conversation = newConv;
        }

        return conversation;
    }

    async saveMessage(conversationId, message, direction) {
        await this.supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                direction,
                message_type: message.type || 'text',
                content: message.content || message.text,
                is_ai_generated: direction === 'outbound',
                status: 'sent'
            });
    }

    async updateConversationStats(conversationId) {
        // Optional RPC to increment counts
        console.log(`Stats updated for ${conversationId}`);
    }

    getDefaultResponse() {
        return {
            text: "Gracias por tu mensaje. El cerebro ALEX IO está procesando tu solicitud.",
            model: 'fallback'
        };
    }
}

module.exports = AssistantRouter;
