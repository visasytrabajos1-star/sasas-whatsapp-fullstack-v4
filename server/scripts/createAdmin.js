/**
 * Run once to create the admin user in Supabase Auth.
 * Usage: node server/scripts/createAdmin.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function createAdmin() {
    const email = 'visasytrabajos@gmail.com';
    const password = '12345678';

    console.log(`🔧 Creating admin user: ${email}`);

    const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,   // Skip email confirmation
        user_metadata: {
            role: 'SUPERADMIN',
            plan: 'ENTERPRISE',
            tenantId: 'tenant_superadmin'
        }
    });

    if (error) {
        if (error.message?.includes('already registered')) {
            console.log('✅ Admin user already exists - updating password...');
            const { data: users } = await supabase.auth.admin.listUsers();
            const existingUser = users?.users?.find(u => u.email === email);
            if (existingUser) {
                await supabase.auth.admin.updateUserById(existingUser.id, { password });
                console.log('✅ Admin password updated successfully');
            }
        } else {
            console.error('❌ Error creating admin:', error.message);
        }
        return;
    }

    console.log('✅ Admin user created successfully:', data.user.id);
    console.log('   Email:', email);
    console.log('   Role: SUPERADMIN | Plan: ENTERPRISE');
}

createAdmin().catch(console.error);
