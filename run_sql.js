const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

async function runSQL() {
  const sqlFile = process.argv[2] || 'add_job_documents.sql';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'present' : 'missing');
    console.error('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const sqlPath = path.join(__dirname, sqlFile);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log(`Running SQL migration from ${sqlFile}...`);

    // Split SQL into individual statements, but respect $$ blocks
    const rawStatements = [];
    let currentStatement = '';
    let inDollarBlock = false;

    const lines = sql.split('\n');
    for (const line of lines) {
      if (line.includes('$$')) {
        inDollarBlock = !inDollarBlock;
      }

      currentStatement += line + '\n';

      if (!inDollarBlock && line.trim().endsWith(';')) {
        rawStatements.push(currentStatement.trim());
        currentStatement = '';
      }
    }

    if (currentStatement.trim()) {
      rawStatements.push(currentStatement.trim());
    }

    const statements = rawStatements
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 100) + '...');
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        if (error) {
          console.error('Error executing statement:', error);
          // Continue with other statements
        } else if (data) {
          console.log('Result:', JSON.stringify(data, null, 2));
        }
      }
    }

    console.log('SQL migration completed');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runSQL();