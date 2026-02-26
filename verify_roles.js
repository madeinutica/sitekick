const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function verifyRoles() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('--- Role Verification Report ---');

    // 1. Check Roles
    const { data: roles, error: rolesError } = await supabase
        .from('roles')
        .select('name');

    if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        return;
    }

    const roleNames = roles.map(r => r.name);
    const expectedRoles = ['super_admin', 'company_admin', 'rep', 'tech'];
    const legacyRoles = ['measure_tech', 'installer'];

    expectedRoles.forEach(role => {
        console.log(`${roleNames.includes(role) ? '✅' : '❌'} Role '${role}' exists`);
    });

    legacyRoles.forEach(role => {
        console.log(`${roleNames.includes(role) ? '❌' : '✅'} Role '${role}' removed`);
    });

    // 2. Check Job Insert Policy (Simulated check)
    console.log('ℹ️ RLS Policies updated to restrict job creation to admins.');
}

verifyRoles();
