const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function decoupleSuperAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Decoupling Super Admin (Erick) from company...');

    const { data, error } = await supabase
        .from('profiles')
        .update({ company_id: null })
        .eq('id', 'de81c896-89e6-45b7-9f0e-3933a42aeb64')
        .select();

    if (error) {
        console.error('Update error:', error);
    } else {
        console.log('Update successful:', JSON.stringify(data, null, 2));
    }
}

decoupleSuperAdmin();
