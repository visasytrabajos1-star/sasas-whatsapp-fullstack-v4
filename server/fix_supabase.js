require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no encontradas en .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixSupabase() {
    console.log('🔍 Verificando conexión a Supabase...');

    // 1. Verificar/Crear Bucket 'media'
    console.log('📦 Verificando bucket "media"...');
    try {
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        if (listError) throw listError;

        const mediaBucket = buckets.find(b => b.name === 'media');

        if (!mediaBucket) {
            console.log('➕ Creando bucket "media"...');
            const { error: createError } = await supabase.storage.createBucket('media', {
                public: true,
                // Sin restricciones para evitar errores de MIME
                fileSizeLimit: 52428800 // 50MB
            });
            if (createError) {
                console.error('❌ Error creando bucket:', createError.message);
            } else {
                console.log('✅ Bucket "media" creado con éxito.');
            }
        } else {
            console.log('✅ El bucket "media" ya existe.');
            if (!mediaBucket.public) {
                console.log('🔓 Haciendo el bucket "media" público...');
                const { error: updateError } = await supabase.storage.updateBucket('media', { public: true });
                if (updateError) console.error('❌ Error actualizando bucket:', updateError.message);
                else console.log('✅ Bucket "media" ahora es PUBLIC.');
            }
        }
    } catch (err) {
        console.error('❌ Error con Storage:', err.message);
    }

    // 2. Verificar Tabla 'document_chunks'
    console.log('📄 Verificando tabla "document_chunks"...');
    try {
        const { error: tableError } = await supabase.from('document_chunks').select('id').limit(1);
        if (tableError) {
            if (tableError.code === '42P01') {
                console.error('❌ LA TABLA "document_chunks" NO EXISTE.');
                console.log('💡 Gabriel debe ejecutar el SQL proporcionado en tareas_gabriel.md');
            } else {
                console.error('❌ Error verificando tabla:', tableError.message);
            }
        } else {
            console.log('✅ La tabla "document_chunks" existe y es accesible.');
        }
    } catch (err) {
        console.error('❌ Error de red:', err.message);
    }
}

fixSupabase();
