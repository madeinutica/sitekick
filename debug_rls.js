const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function debugRLS() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('--- Checking RLS Policies on company_join_requests ---');
    const { data: policies, error: pError } = await supabase.rpc('exec_sql', {
        sql: "SELECT * FROM pg_policies WHERE tablename = 'company_join_requests';"
    });

    if (pError) {
        console.error('Error fetching policies:', pError.message);
    } else {
        console.log('Policies:', JSON.stringify(policies, null, 2));
    }

    // Also check if the join_requests table has any data at all
    const { count, error: cError } = await supabase
        .from('company_join_requests')
        .select('*', { count: 'exact', head: true });

    console.log(`Total Join Requests: ${count}`);
}

debugRLS();
