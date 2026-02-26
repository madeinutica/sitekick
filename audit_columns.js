const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function auditSchema() {
    const { data, error } = await supabase.rpc('get_table_columns_info'); // If this exists, or use information_schema

    // Actually, I'll just use a query against information_schema
    const { data: columns, error: colError } = await supabase
        .from('information_schema.columns')
        .select('table_name, column_name')
        .eq('table_schema', 'public');

    if (colError) {
        console.error(colError);
        return;
    }

    const tables = {};
    columns.forEach(col => {
        if (!tables[col.table_name]) tables[col.table_name] = [];
        tables[col.table_name].push(col.column_name);
    });

    console.log(JSON.stringify(tables, null, 2));
}

// Alternatively, since I can't run JS easily to query information_schema without a proper key/setup if not already provided
// I will just read the SQL files I have to reconstruct the schema
auditSchema();
