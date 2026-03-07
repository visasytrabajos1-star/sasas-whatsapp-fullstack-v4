require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
    const email = 'admin@alex.io';
    const password = 'AlexAdmin2026';
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });
    if (error) {
        console.error("Signup Error:", error.message);
    } else {
        console.log("Signup Success:", data?.user?.id);
    }
}
run();
