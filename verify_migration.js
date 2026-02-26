const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function verify() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('--- Verification Report ---');

    // 1. Check Company
    const { data: company } = await supabase
        .from('companies')
        .select('id, name')
        .eq('name', 'New York Sash')
        .single();

    if (company) {
        console.log(`✅ Company 'New York Sash' found: ${company.id}`);

        // 2. Check Profiles
        const { count: unassignedProfiles } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .is('company_id', null);

        console.log(`${unassignedProfiles === 0 ? '✅' : '❌'} Unassigned Profiles: ${unassignedProfiles}`);

        // 3. Check Jobs
        const { count: unassignedJobs } = await supabase
            .from('jobs')
            .select('*', { count: 'exact', head: true })
            .is('company_id', null);

        console.log(`${unassignedJobs === 0 ? '✅' : '❌'} Unassigned Jobs: ${unassignedJobs}`);

        // 4. Check Roles
        const { data: roles } = await supabase
            .from('user_roles')
            .select('user_id');
        console.log(`ℹ️ Total User-Role assignments: ${roles?.length || 0}`);

    } else {
        console.log("❌ 'New York Sash' company NOT found.");
    }
}

verify();
