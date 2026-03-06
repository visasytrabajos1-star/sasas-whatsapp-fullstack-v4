const axios = require('axios');

/**
 * Servicio Integrador para HubSpot CRM (API v3)
 */

class HubspotService {
    /**
     * Sincroniza un contacto y registra una nota basados en el análisis de la IA.
     * @param {string} phone Teléfono de WhatsApp (Ej: 5215555555555)
     * @param {Object} leadData { name, email, temperature, summary } (temperature: COLD, WARM, HOT)
     * @param {string} token Private App Token de HubSpot
     */
    static async syncContact(phone, leadData, token) {
        if (!token) return null;
        if (!phone) return null;

        try {
            // 1. Buscar si el contacto ya existe por teléfono
            let contactId = await this.searchContactByPhone(phone, token);

            // Preparar las propiedades
            const properties = {
                phone: phone,
                lifecyclestage: 'lead',
                hs_lead_status: this.mapTemperatureToLeadStatus(leadData.temperature)
            };

            if (leadData.name && leadData.name.toLowerCase() !== 'desconocido') {
                const nameParts = leadData.name.trim().split(' ');
                properties.firstname = nameParts[0];
                if (nameParts.length > 1) {
                    properties.lastname = nameParts.slice(1).join(' ');
                }
            }

            if (leadData.email && leadData.email.includes('@')) {
                properties.email = leadData.email;
            }

            if (!contactId) {
                // 2. Crear Contacto si no existe
                contactId = await this.createContact(properties, token);
                console.log(`✅ [HubSpot] Nuevo Contacto creado (ID: ${contactId}, Temp: ${leadData.temperature})`);
            } else {
                // 3. Actualizar Contacto si ya existe (Ej: subir temperatura)
                await this.updateContact(contactId, properties, token);
                console.log(`🔄 [HubSpot] Contacto actualizado (ID: ${contactId}, Temp: ${leadData.temperature})`);
            }

            // 4. Agregar Nota (Engagement) con el resumen
            if (contactId && leadData.summary) {
                await this.createNote(contactId, leadData.summary, token);
                console.log(`📝 [HubSpot] Nota agregada al contacto ${contactId}`);
            }

            return contactId;

        } catch (error) {
            console.error('❌ [HubSpot Error]:', error.response?.data?.message || error.message);
            return null;
        }
    }

    static async searchContactByPhone(phone, token) {
        try {
            const url = 'https://api.hubapi.com/crm/v3/objects/contacts/search';
            const payload = {
                filterGroups: [
                    {
                        filters: [
                            {
                                propertyName: 'phone',
                                operator: 'EQ',
                                value: phone
                            }
                        ]
                    }
                ]
            };
            const res = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (res.data.total > 0) {
                return res.data.results[0].id;
            }
            return null;
        } catch (error) {
            // Ignorar errores si no encuentra, solo devolver null
            return null;
        }
    }

    static async createContact(properties, token) {
        const url = 'https://api.hubapi.com/crm/v3/objects/contacts';
        const res = await axios.post(url, { properties }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        return res.data.id;
    }

    static async updateContact(contactId, properties, token) {
        const url = `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`;
        await axios.patch(url, { properties }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    }

    static async createNote(contactId, summary, token) {
        const url = 'https://api.hubapi.com/crm/v3/objects/notes';

        // Formato para asociar la nota al contacto directamente en la creación
        const payload = {
            properties: {
                hs_timestamp: new Date().toISOString(),
                hs_note_body: `🤖 **Resumen de Conversación (IA Bot):**\n\n${summary}`
            },
            associations: [
                {
                    to: {
                        id: contactId
                    },
                    types: [
                        {
                            associationCategory: 'HUBSPOT_DEFINED',
                            associationTypeId: 202 // Note to Contact
                        }
                    ]
                }
            ]
        };

        await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
    }

    static mapTemperatureToLeadStatus(temperature) {
        const t = (temperature || '').toUpperCase();
        if (t === 'HOT') return 'IN_PROGRESS'; // HubSpot standard: En progreso / Open Deal
        if (t === 'WARM') return 'OPEN';
        return 'NEW'; // COLD
    }
}

module.exports = HubspotService;
