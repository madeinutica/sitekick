const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function checkConfigs() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase environment variables');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
        .from('companies')
        .select('id, name, marketsharp_config')
        .not('marketsharp_config', 'is', null);

    if (error) {
        console.error('Error fetching companies:', error);
        process.exit(1);
    }

    console.log('--- START ---');
    data.forEach(c => {
        console.log(`COMPANY_NAME: ${c.name}`);
        console.log(`COMPANY_ID_VAL: ${c.marketsharp_config?.companyId}`);
        console.log(`API_KEY_VAL: ${c.marketsharp_config?.apiKey}`);
        console.log(`---`);
    });
    console.log('--- END ---');
}

checkConfigs();
