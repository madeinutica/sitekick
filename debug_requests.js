const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function checkRequests() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('--- Checking company_join_requests ---');
    const { data, error } = await supabase
        .from('company_join_requests')
        .select('*, companies(name)');

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Requests:', JSON.stringify(data, null, 2));
    }
}

checkRequests();
