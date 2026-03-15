require('dotenv').config();
const { supabase } = require('./services/supabaseClient');
const { v4: uuidv4 } = require('uuid');

async function debugUploadAndRag() {
    console.log('🔍 Debugging Supabase Operations...');
    const tenantId = '00000000-0000-0000-0000-000000000000';
    const instanceId = 'debug_instance';

    // 1. Test RAG Insert
    console.log('\n--- Test 1: RAG Insert ---');
    try {
        const fakeVector = new Array(1536).fill(0);
        const { data, error } = await supabase.from('document_chunks').insert({
            tenant_id: tenantId,
            instance_id: instanceId,
            document_name: 'debug_doc.txt',
            chunk_content: 'debug content',
            embedding: fakeVector
        }).select();

        if (error) {
            console.error('❌ RAG Insert Error:', error.message);
            console.error(error);
        } else {
            console.log('✅ RAG Insert Success:', data);
            await supabase.from('document_chunks').delete().eq('instance_id', instanceId);
        }
    } catch (e) {
        console.error('Crash in RAG Insert:', e);
    }

    // 2. Test Media Upload
    console.log('\n--- Test 2: Media Upload ---');
    try {
        const fileContent = Buffer.from('Debug text content for upload test');
        const fileName = `debug_${uuidv4()}.txt`;
        const filePath = `broadcast/${fileName}`;

        const { data, error } = await supabase.storage
            .from('media')
            .upload(filePath, fileContent, {
                contentType: 'text/plain',
                upsert: true
            });

        if (error) {
            console.error('❌ Media Upload Error:', error.message);
            console.error(error);
        } else {
            console.log('✅ Media Upload Success:', data);
            const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(filePath);
            console.log('Public URL:', publicUrlData.publicUrl);
            await supabase.storage.from('media').remove([filePath]);
        }
    } catch (e) {
        console.error('Crash in Media Upload:', e);
    }
}

debugUploadAndRag();
