const { OpenAI } = require('openai');
const { supabase, isSupabaseEnabled } = require('./supabaseClient');
const crypto = require('crypto');

// Initialize OpenAI for embeddings
let openai = null;
if (process.env.OPENAI_API_KEY) {
    try {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } catch (err) {
        console.warn('⚠️ No se pudo inicializar OpenAI Embedded Data en ragService');
    }
}

/**
 * Divide un texto largo en fragmentos más pequeños (chunks)
 * @param {string} text Texto completo extraído del documento
 * @param {number} maxTokens Tamaño aproximado máximo por chunk
 */
function chunkText(text, maxTokens = 800) {
    if (!text) return [];
    // Una implementación simple: separar por saltos de línea y agrupar
    const paragraphs = text.split(/\n\s*\n/);
    const chunks = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
        if (currentChunk.length + paragraph.length > maxTokens * 4) { // Estimación rápida de tokens a chars (x4)
            if (currentChunk.trim()) chunks.push(currentChunk.trim());
            currentChunk = paragraph + '\n\n';
        } else {
            currentChunk += paragraph + '\n\n';
        }
    }
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }
    return chunks;
}

/**
 * Genera el embedding vectorial para un texto usando OpenAI
 * @param {string} text Texto a vectorizar
 */
async function generateEmbedding(text) {
    if (!openai) throw new Error("OpenAI API Key not configured for embeddings.");

    // Clean text
    const cleanText = text.replace(/\n/g, ' ');

    const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: cleanText,
    });

    return response.data[0].embedding;
}

/**
 * Procesa un archivo subido (asume que ya se sacó el texto plano en el router HTTP)
 * Fragmenta el texto, genera embeddings y lo guarda en Supabase (tabla document_chunks).
 */
async function ingestDocument(tenantId, instanceId, documentName, documentText) {
    if (!isSupabaseEnabled) throw new Error("Supabase is required for RAG.");

    console.log(`📚 Ingestando conocimiento: ${documentName} para instancia ${instanceId}`);

    const chunks = chunkText(documentText);
    let successCount = 0;

    for (const chunk of chunks) {
        try {
            const embedding = await generateEmbedding(chunk);
            const { error } = await supabase.from('document_chunks').insert({
                tenant_id: tenantId,
                instance_id: instanceId,
                document_name: documentName,
                chunk_content: chunk,
                embedding: embedding
            });

            if (error) {
                console.error(`❌ Fallo guardando chunk de RAG:`, error.message);
            } else {
                successCount++;
            }
        } catch (err) {
            console.error(`❌ Error vectorizando chunk:`, err.message);
        }
    }

    return { document: documentName, totalChunks: chunks.length, savedChunks: successCount };
}

/**
 * Busca el contenido más relevante en la Knowledge Base basado en el Query del usuario.
 */
async function queryKnowledgeBase(tenantId, instanceId, queryText, limit = 3) {
    if (!isSupabaseEnabled || !openai) return null;

    try {
        // 1. Convert user's message into an embedding vector
        const queryEmbedding = await generateEmbedding(queryText);

        // 2. Call the Supabase RPC function 'match_document_chunks'
        const { data, error } = await supabase.rpc('match_document_chunks', {
            query_embedding: queryEmbedding,
            match_tenant_id: tenantId,
            match_instance_id: instanceId,
            match_count: limit
        });

        if (error) throw error;

        // Return only the text chunks with a similarity score > threshold (e.g. 0.76)
        return data.filter(doc => doc.similarity > 0.78).map(doc => doc.chunk_content).join('\n\n---\n\n');
    } catch (err) {
        console.error(`❌ Error consultando base de conocimiento RAG:`, err.message);
        return null; // Silent fail gracefully so the bot keeps chatting
    }
}

/**
 * Lista los documentos almacenados para una instancia (para borrarlos en UI)
 */
async function listDocuments(tenantId, instanceId) {
    if (!isSupabaseEnabled) return [];
    const { data, error } = await supabase
        .from('document_chunks')
        .select('document_name')
        .eq('tenant_id', tenantId)
        .eq('instance_id', instanceId);

    if (error) {
        console.error(`❌ Error listando docs RAG:`, error.message);
        return [];
    }

    // Get unique document names
    const uniqueDocs = [...new Set(data.map(d => d.document_name))];
    return uniqueDocs;
}

/**
 * Borra todo el conocimiento asociado a un documento.
 */
async function deleteDocument(tenantId, instanceId, documentName) {
    if (!isSupabaseEnabled) return false;
    const { error } = await supabase
        .from('document_chunks')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('instance_id', instanceId)
        .eq('document_name', documentName);

    return !error;
}

module.exports = {
    ingestDocument,
    queryKnowledgeBase,
    listDocuments,
    deleteDocument
};
