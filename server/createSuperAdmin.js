require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Faltan credenciales de Supabase en el archivo .env del servidor.");
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
    const email = 'admin@alex.io';
    const password = 'AlexAdmin2026';

    console.log(`⏳ Verificando identidad de ${email}...`);

    try {
        // 1. Crear el usuario (confirmado automáticamente a través del Service Role)
        const { data: userCreated, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { role: 'SUPERADMIN' } // Guardado directamente en la metadata
        });

        if (createError) {
            if (createError.message.includes('already been registered')) {
                console.log(`ℹ️ El usuario ya existe. Actualizando contraseña y rol a SUPERADMIN...`);

                // Find user by email
                const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
                if (listError) throw listError;

                const existingUser = users.find(u => u.email === email);
                if (existingUser) {
                    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
                        password,
                        user_metadata: { role: 'SUPERADMIN' },
                        email_confirm: true
                    });
                    if (updateError) throw updateError;
                    console.log(`✅ ¡Cuenta reactivada exitosamente!`);
                } else {
                    console.log(`❌ No se pudo localizar al usuario en la BD.`);
                }
            } else {
                throw createError;
            }
        } else {
            console.log(`✅ ¡Cuenta SUPERADMIN creada exitosamente!`);
        }

        console.log(`\n======================================`);
        console.log(`🔑 CREDENCIALES SUPERADMIN`);
        console.log(`Email: ${email}`);
        console.log(`Clave: ${password}`);
        console.log(`======================================\n`);
        console.log(`Ya puedes iniciar sesión desde el panel principal.`);
    } catch (err) {
        console.error('❌ Error Fatal:', err.message);
    }
}

run();
