const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: './.env' })

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

console.log('Testing with URL:', supabaseUrl)
console.log('Testing with Key prefix:', supabaseKey ? supabaseKey.substring(0, 15) : 'NULL')

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL or SUPABASE_ANON_KEY missing in .env')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    try {
        // Test Auth first (it's often more permissive or gives clearer errors)
        console.log('Testing Auth service...')
        const { data: authData, error: authError } = await supabase.auth.getSession()
        if (authError) {
            console.error('Auth Error:', authError.message)
        } else {
            console.log('Auth Service responded correctly.')
        }

        // Test auth registration
        console.log('Testing Registration...')
        const testEmail = `test_${Date.now()}@example.com`
        const { data: regData, error: regError } = await supabase.auth.signUp({
            email: testEmail,
            password: 'Password123!',
        })

        if (regError) {
            console.error('Registration Error:', regError.message)
            if (regError.message.includes('apiKey') || regError.message.includes('JWT') || regError.message.includes('forbidden')) {
                console.log('Verification Result: KEY IS REJECTED FOR SIGNUP.')
            }
        } else {
            console.log('Registration Success (or Email Sent)! Email:', testEmail)
        }
    } catch (err) {
        console.error('Fatal Error:', err.message)
    }
}

test()
