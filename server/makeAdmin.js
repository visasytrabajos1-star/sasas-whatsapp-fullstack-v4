require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.log("❌ Faltan credenciales de Supabase en .env");
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function makeAdmin() {
    const email = process.argv[2];
    if (!email) {
        console.log("Uso: node makeAdmin.js <email>");
        process.exit(1);
    }

    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
        console.error("❌ Error listando usuarios:", listError.message);
        return;
    }

    const user = users.find(u => u.email === email);
    if (!user) {
        console.log(`❌ No se encontró el usuario: ${email}. Regístrate primero en la web.`);
        return;
    }

    console.log(`⏳ Otorgando privilegios SUPERADMIN a ${email} (ID: ${user.id})...`);

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, role: 'SUPERADMIN' }
    });

    if (updateError) {
        console.error("❌ Error actualizando metadatos:", updateError.message);
    } else {
        console.log(`✅ ¡${email} ahora es SUPERADMIN! Cierra sesión y vuelve a entrar en la web.`);
    }
}

makeAdmin();
