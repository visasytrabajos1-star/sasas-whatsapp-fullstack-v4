const baileys = require('@whiskeysockets/baileys');
const { initAuthCreds, BufferJSON } = baileys;

/**
 * useSupabaseAuthState
 * Custom Baileys state manager that connects directly to PostgreSQL via Supabase.
 * Solves Render's ephemeral disk wipe by persisting cryptographic keys in `whatsapp_auth_state`.
 */
module.exports = async function useSupabaseAuthState(instanceId, supabase) {
    const tableName = 'whatsapp_auth_state';

    const writeData = async (data, keyName) => {
        try {
            const dataString = JSON.stringify(data, BufferJSON.replacer);

            const { error } = await supabase.from(tableName).upsert({
                instance_id: instanceId,
                key_name: keyName,
                data: JSON.parse(dataString), // Upsert requires standard JSON object/array
                updated_at: new Date().toISOString()
            }, { onConflict: 'instance_id, key_name' });

            if (error) throw error;
        } catch (error) {
            console.error(`[AuthState] Error writing ${keyName} to Supabase:`, error.message);
        }
    };

    const readData = async (keyName) => {
        try {
            const { data, error } = await supabase
                .from(tableName)
                .select('data')
                .eq('instance_id', instanceId)
                .eq('key_name', keyName)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is 'not found'
                throw error;
            }

            if (data && data.data) {
                const dataString = JSON.stringify(data.data);
                return JSON.parse(dataString, BufferJSON.reviver);
            }
            return null;
        } catch (error) {
            console.error(`[AuthState] Error reading ${keyName} from Supabase:`, error.message);
            return null;
        }
    };

    const removeData = async (keyName) => {
        try {
            await supabase.from(tableName).delete()
                .eq('instance_id', instanceId)
                .eq('key_name', keyName);
        } catch (error) {
            console.error(`[AuthState] Error deleting ${keyName} from Supabase:`, error.message);
        }
    };

    const clearState = async () => {
        try {
            await supabase.from(tableName).delete().eq('instance_id', instanceId);
        } catch (error) {
            console.error(`[AuthState] Error clearing state for ${instanceId}:`, error.message);
        }
    };

    // Load initial Creds (like local creds.json)
    const credsData = await readData('creds');
    let creds = credsData || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async id => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = baileys.proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) {
                                tasks.push(writeData(value, key));
                            } else {
                                tasks.push(removeData(key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => {
            return writeData(creds, 'creds');
        },
        clearState
    };
};
