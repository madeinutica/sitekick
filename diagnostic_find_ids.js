const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function findIds() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Searching for Erick and New York Sash...');

    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name, company_id')
        .or('full_name.ilike.%Erick%,username.ilike.%Erick%');

    if (pError) console.error('Profiles search error:', pError);
    else console.log('Matching Profiles:', JSON.stringify(profiles, null, 2));

    const { data: companies, error: cError } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('name', '%New York Sash%');

    if (cError) console.error('Companies search error:', cError);
    else console.log('Matching Companies:', JSON.stringify(companies, null, 2));
}

findIds();
