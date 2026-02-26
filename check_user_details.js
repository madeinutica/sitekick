const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function checkDetails() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const ids = ['de81c896-89e6-45b7-9f0e-3933a42aeb64', 'a4096697-5fb9-481e-a499-0c6c54745a66'];

    for (const id of ids) {
        console.log(`--- Checking ID: ${id} ---`);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
        console.log('Profile:', JSON.stringify(profile, null, 2));
        const { data: roles } = await supabase.from('user_roles').select('*, roles(name)').eq('user_id', id);
        console.log('Roles:', JSON.stringify(roles, null, 2));
    }
}

checkDetails();
