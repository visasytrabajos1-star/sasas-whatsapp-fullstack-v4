const axios = require('axios');

/**
 * Servicio Integrador para Copper CRM
 */

class CopperService {
    /**
     * Sincroniza un contacto y registra una nota basados en el análisis de la IA.
     * @param {string} phone Teléfono de WhatsApp
     * @param {Object} leadData { name, email, temperature, summary }
     * @param {Object} creds { apiKey, userEmail }
     */
    static async syncContact(phone, leadData, creds) {
        if (!creds || !creds.apiKey || !creds.userEmail) return null;
        if (!phone) return null;

        const headers = {
            'X-PW-AccessToken': creds.apiKey,
            'X-PW-Application': 'developer_api',
            'X-PW-UserEmail': creds.userEmail,
            'Content-Type': 'application/json'
        };

        try {
            // 1. Buscar si el contacto ya existe por teléfono
            let personId = await this.searchPersonByPhone(phone, headers);

            const personData = {
                phone_numbers: [{ number: phone, category: 'work' }]
            };

            if (leadData.name && leadData.name.toLowerCase() !== 'desconocido') {
                personData.name = leadData.name;
            } else {
                personData.name = `Lead WhatsApp - ${phone}`;
            }

            if (leadData.email && leadData.email.includes('@')) {
                personData.emails = [{ email: leadData.email, category: 'work' }];
            }

            // Mapeo rudimentario de temperatura a Custom Fields o Tags (usamos tags por simplicidad)
            personData.tags = [leadData.temperature || 'COLD'];

            if (!personId) {
                // 2. Crear Contacto si no existe
                personId = await this.createPerson(personData, headers);
                console.log(`✅ [Copper] Nuevo Person creado (ID: ${personId}, Temp: ${leadData.temperature})`);
            } else {
                // 3. Actualizar Contacto si ya existe
                await this.updatePerson(personId, personData, headers);
                console.log(`🔄 [Copper] Person actualizado (ID: ${personId}, Temp: ${leadData.temperature})`);
            }

            // 4. Agregar Nota (Activity) con el resumen
            if (personId && leadData.summary) {
                await this.createActivity(personId, leadData.summary, headers);
                console.log(`📝 [Copper] Actividad/Nota agregada al Person ${personId}`);
            }

            return personId;

        } catch (error) {
            console.error('❌ [Copper Error]:', error.response?.data?.message || error.message);
            return null;
        }
    }

    static async searchPersonByPhone(phone, headers) {
        try {
            const url = 'https://api.copper.com/developer_api/v1/people/search';
            const payload = {
                phone_numbers: [phone]
            };
            const res = await axios.post(url, payload, { headers });

            if (res.data && res.data.length > 0) {
                return res.data[0].id;
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    static async createPerson(personData, headers) {
        const url = 'https://api.copper.com/developer_api/v1/people';
        const res = await axios.post(url, personData, { headers });
        return res.data.id;
    }

    static async updatePerson(personId, personData, headers) {
        const url = `https://api.copper.com/developer_api/v1/people/${personId}`;
        await axios.put(url, personData, { headers });
    }

    static async createActivity(personId, summary, headers) {
        const url = 'https://api.copper.com/developer_api/v1/activities';

        // type_id 0 is standard note
        const payload = {
            parent: {
                type: 'person',
                id: personId
            },
            type: {
                category: 'user',
                id: 0
            },
            details: `🤖 **Resumen de Conversación (IA Bot):**\n\n${summary}`
        };

        await axios.post(url, payload, { headers });
    }
}

module.exports = CopperService;
