const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.SUPABASE_KEY
    || process.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

module.exports = {
    supabase,
    isSupabaseEnabled: Boolean(supabase)
};

// Startup log
const keySource = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE_KEY'
    : process.env.SUPABASE_ANON_KEY ? 'ANON_KEY'
        : process.env.SUPABASE_KEY ? 'SUPABASE_KEY'
            : process.env.VITE_SUPABASE_ANON_KEY ? 'VITE_ANON_KEY'
                : 'NONE';
console.log(`🔗 Supabase: ${supabase ? '✅ Connected' : '❌ Disabled'} (key source: ${keySource}, url: ${supabaseUrl ? 'set' : 'missing'})`);
