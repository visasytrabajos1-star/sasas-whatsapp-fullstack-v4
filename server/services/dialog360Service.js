const axios = require('axios');

const API_URL = process.env.DIALOG360_API_URL || 'https://hub.360dialog.io/api/v2';
const DIALOG360_KEY = process.env.DIALOG360_API_KEY;

class Dialog360Service {
    constructor() {
        this.client = axios.create({
            baseURL: API_URL,
            headers: {
                'D360-API-KEY': DIALOG360_KEY,
                'Content-Type': 'application/json'
            }
        });
    }

    // Enviar mensaje de texto
    async sendTextMessage(phone, text) {
        try {
            const response = await this.client.post('/messages', {
                messaging_product: 'whatsapp',
                to: phone,
                type: 'text',
                text: { body: text }
            });
            return response.data;
        } catch (error) {
            console.error('❌ 360Dialog Error:', error.response?.data || error.message);
            throw error;
        }
    }

    // Enviar mensaje con imagen
    async sendImageMessage(phone, imageUrl, caption = '') {
        try {
            const response = await this.client.post('/messages', {
                messaging_product: 'whatsapp',
                to: phone,
                type: 'image',
                image: { link: imageUrl, caption }
            });
            return response.data;
        } catch (error) {
            console.error('❌ 360Dialog Image Error:', error.response?.data || error.message);
            throw error;
        }
    }

    // Enviar audio
    async sendAudioMessage(phone, audioUrl) {
        try {
            const response = await this.client.post('/messages', {
                messaging_product: 'whatsapp',
                to: phone,
                type: 'audio',
                audio: { link: audioUrl }
            });
            return response.data;
        } catch (error) {
            console.error('❌ 360Dialog Audio Error:', error.response?.data || error.message);
            throw error;
        }
    }

    // Enviar plantilla (Template Message)
    async sendTemplateMessage(phone, templateName, components = []) {
        try {
            const response = await this.client.post('/messages', {
                messaging_product: 'whatsapp',
                to: phone,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: 'es' },
                    components
                }
            });
            return response.data;
        } catch (error) {
            console.error('❌ 360Dialog Template Error:', error.response?.data || error.message);
            throw error;
        }
    }

    // Obtener información de la cuenta
    async getAccountInfo() {
        try {
            const response = await this.client.get('/account');
            return response.data;
        } catch (error) {
            console.error('❌ 360Dialog Account Error:', error.response?.data || error.message);
            throw error;
        }
    }

    // Verificar webhooks
    async getWebhooks() {
        try {
            const response = await this.client.get('/webhooks');
            return response.data;
        } catch (error) {
            console.error('❌ 360Dialog Webhooks Error:', error.response?.data || error.message);
            throw error;
        }
    }
}

module.exports = new Dialog360Service();
