require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testPasswordReset() {
    console.log('Attempting to send password reset...');
    const { data, error } = await supabase.auth.resetPasswordForEmail('test@example.com');

    if (error) {
        console.error('ERROR RESPONSE:', {
            message: error.message,
            status: error.status,
            name: error.name
        });
    } else {
        console.log('SUCCESS:', data);
    }
}

testPasswordReset();
