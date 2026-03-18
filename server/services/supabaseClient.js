const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
// --- VALIDATE KEY ---
const isDummyKey = (key) => !key || key.startsWith('sb_secret_') || key.startsWith('sb_publishable_');

const supabaseKey = (!isDummyKey(process.env.SUPABASE_SERVICE_ROLE_KEY) ? process.env.SUPABASE_SERVICE_ROLE_KEY : null)
    || (!isDummyKey(process.env.SUPABASE_ANON_KEY) ? process.env.SUPABASE_ANON_KEY : null)
    || (!isDummyKey(process.env.SUPABASE_KEY) ? process.env.SUPABASE_KEY : null)
    || (!isDummyKey(process.env.VITE_SUPABASE_ANON_KEY) ? process.env.VITE_SUPABASE_ANON_KEY : null);

let supabase = null;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}
const serviceKey = (!isDummyKey(process.env.SUPABASE_SERVICE_ROLE_KEY) ? process.env.SUPABASE_SERVICE_ROLE_KEY : null)
    || (!isDummyKey(process.env.SUPABASE_SERVICE_KEY) ? process.env.SUPABASE_SERVICE_KEY : null);

let supabaseAdmin = null;

if (supabaseUrl && serviceKey) {
    supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

module.exports = {
    supabase,
    supabaseAdmin,
    isSupabaseEnabled: Boolean(supabase)
};

// Startup log
const keySource = !isDummyKey(process.env.SUPABASE_SERVICE_ROLE_KEY) ? 'SERVICE_ROLE_KEY'
    : !isDummyKey(process.env.SUPABASE_ANON_KEY) ? 'ANON_KEY'
        : !isDummyKey(process.env.SUPABASE_KEY) ? 'SUPABASE_KEY'
            : !isDummyKey(process.env.VITE_SUPABASE_ANON_KEY) ? 'VITE_ANON_KEY'
                : 'NONE/DUMMY';
console.log(`🔗 Supabase: ${supabase ? '✅ Connected' : '❌ Disabled'} (key source: ${keySource}, url: ${supabaseUrl ? 'set' : 'missing'})`);
