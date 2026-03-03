const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJob() {
    console.log('Searching for "Monescalchi - Bathroom"...');

    const { data, error } = await supabase
        .from('jobs')
        .select('id, job_name, created_at, sale_date, status, completed_date, is_archived')
        .ilike('job_name', '%Monescalchi%')
        .maybeSingle();

    if (error) {
        console.error('Error fetching job:', error);
        return;
    }

    if (!data) {
        console.log('Job not found.');
        return;
    }

    console.log('Job Details:');
    console.log(JSON.stringify(data, null, 2));

    const now = new Date();
    const createdDate = new Date(data.created_at);
    const saleDate = data.sale_date ? new Date(data.sale_date) : null;
    const completedDate = data.completed_date ? new Date(data.completed_date) : null;

    const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    console.log('\nFilter Analysis:');
    console.log('Current Time:', now.toISOString());
    console.log('90 Days Ago:', ninetyDaysAgo.toISOString());
    console.log('30 Days Ago:', thirtyDaysAgo.toISOString());

    console.log('\n1. Existence check (sale_date):', !!data.sale_date ? 'PASS' : 'FAIL');

    const createdTooOld = createdDate < ninetyDaysAgo;
    const saleTooOld = saleDate && saleDate < ninetyDaysAgo;
    console.log('2. 90-day Hard Limit (created_at):', !createdTooOld ? 'PASS' : 'FAIL', `(${data.created_at})`);
    console.log('3. 90-day Hard Limit (sale_date):', !saleTooOld ? 'PASS' : 'FAIL', `(${data.sale_date})`);

    const isCompleted = ['installed', 'completed', 'closed'].includes(data.status?.toLowerCase() || '');
    if (isCompleted) {
        const relevantCompletionStamp = completedDate || saleDate || createdDate;
        const completedTooOld = relevantCompletionStamp < thirtyDaysAgo;
        console.log('4. 30-day Completion Limit:', !completedTooOld ? 'PASS' : 'FAIL', `(Status: ${data.status}, Checked: ${relevantCompletionStamp.toISOString()})`);
    } else {
        console.log('4. 30-day Completion Limit: N/A (Job not completed)');
    }
}

checkJob();
