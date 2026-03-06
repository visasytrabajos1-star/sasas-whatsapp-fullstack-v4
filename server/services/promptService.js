const { supabase, isSupabaseEnabled } = require('./supabaseClient');
const { randomUUID } = require('crypto');

const promptVersionsTable = process.env.PROMPT_VERSIONS_TABLE || 'prompt_versiones';
const promptVersionsMemoryStore = new Map();
const allowedPromptStatuses = new Set(['test', 'active', 'archived']);

const savePromptVersion = async ({ tenantId, instanceId, promptText, superPromptJson, status = 'test' }) => {
    const normalizedStatus = allowedPromptStatuses.has(status) ? status : 'test';
    const now = new Date().toISOString();
    const versionRecord = {
        id: randomUUID(),
        tenant_id: tenantId,
        instance_id: instanceId,
        version: superPromptJson?.version || 'v1',
        status: normalizedStatus,
        prompt_text: promptText,
        super_prompt_json: superPromptJson || null,
        created_at: now,
        updated_at: now
    };

    if (!instanceId) {
        throw new Error('instanceId es requerido para versionar prompt');
    }

    if (!isSupabaseEnabled) {
        const key = `${tenantId}:${instanceId}`;
        const list = promptVersionsMemoryStore.get(key) || [];
        list.unshift(versionRecord);
        promptVersionsMemoryStore.set(key, list.slice(0, 50));
        return versionRecord;
    }

    const { data, error } = await supabase
        .from(promptVersionsTable)
        .insert(versionRecord)
        .select('*')
        .single();

    if (error) {
        throw new Error(`No se pudo guardar versión del prompt: ${error.message}`);
    }

    return data;
};

const listPromptVersions = async ({ tenantId, instanceId, limit = 20 }) => {
    if (!instanceId) return [];

    if (!isSupabaseEnabled) {
        const key = `${tenantId}:${instanceId}`;
        const ranking = { active: 0, test: 1, archived: 2 };
        return (promptVersionsMemoryStore.get(key) || [])
            .slice()
            .sort((a, b) => (ranking[a.status] ?? 9) - (ranking[b.status] ?? 9) || String(b.created_at).localeCompare(String(a.created_at)))
            .slice(0, limit);
    }

    const { data, error } = await supabase
        .from(promptVersionsTable)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('instance_id', instanceId)
        .order('status', { ascending: true })
        .order('updated_at', { ascending: false })
        .limit(limit);

    if (error) throw new Error(`No se pudo listar versiones: ${error.message}`);
    return data || [];
};

const promotePromptVersion = async ({ tenantId, instanceId, versionId }) => {
    if (!instanceId || !versionId) {
        throw new Error('instanceId y versionId son requeridos');
    }

    const now = new Date().toISOString();

    if (!isSupabaseEnabled) {
        const key = `${tenantId}:${instanceId}`;
        const list = (promptVersionsMemoryStore.get(key) || []).map((v) => ({
            ...v,
            status: v.id === versionId ? 'active' : (v.status === 'active' ? 'archived' : v.status),
            updated_at: now
        }));
        promptVersionsMemoryStore.set(key, list);
        return list.find((v) => v.id === versionId) || null;
    }

    const { error: deactivateError } = await supabase
        .from(promptVersionsTable)
        .update({ status: 'archived', updated_at: now })
        .eq('tenant_id', tenantId)
        .eq('instance_id', instanceId)
        .eq('status', 'active');

    if (deactivateError) {
        throw new Error(`No se pudo archivar versión activa previa: ${deactivateError.message}`);
    }

    const { data, error } = await supabase
        .from(promptVersionsTable)
        .update({ status: 'active', updated_at: now })
        .eq('tenant_id', tenantId)
        .eq('instance_id', instanceId)
        .eq('id', versionId)
        .select('*')
        .single();

    if (error) {
        throw new Error(`No se pudo promover versión: ${error.message}`);
    }

    return data;
};

const archivePromptVersion = async ({ tenantId, instanceId, versionId }) => {
    if (!instanceId || !versionId) throw new Error('instanceId y versionId son requeridos');
    const now = new Date().toISOString();

    if (!isSupabaseEnabled) {
        const key = `${tenantId}:${instanceId}`;
        const list = (promptVersionsMemoryStore.get(key) || []).map((v) =>
            v.id === versionId ? { ...v, status: 'archived', updated_at: now } : v
        );
        promptVersionsMemoryStore.set(key, list);
        return list.find((v) => v.id === versionId) || null;
    }

    const { data, error } = await supabase
        .from(promptVersionsTable)
        .update({ status: 'archived', updated_at: now })
        .eq('tenant_id', tenantId)
        .eq('instance_id', instanceId)
        .eq('id', versionId)
        .select('*')
        .single();

    if (error) throw new Error(`No se pudo archivar versión: ${error.message}`);
    return data;
};

module.exports = {
    savePromptVersion,
    listPromptVersions,
    promotePromptVersion,
    archivePromptVersion,
    allowedPromptStatuses
};
