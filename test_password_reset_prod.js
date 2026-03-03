require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testPasswordReset() {
    console.log('Testing reset with redirectTo...');
    const { data, error } = await supabase.auth.resetPasswordForEmail('test_prod@sitekickapp.com', {
        redirectTo: 'https://sitekickapp.com/reset-password'
    });

    if (error) {
        console.error('ERROR RESPONSE:', {
            message: error.message,
            status: error.status,
            name: error.name
        });
    } else {
        console.log('SUCCESS with redirectTo:', data);
    }
}

testPasswordReset();
