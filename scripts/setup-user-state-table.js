// Script to create user_state table in Supabase
// Run this script with: node scripts/setup-user-state-table.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env file if present
require('dotenv').config();

async function setupUserStateTable() {
  console.log('Setting up user_state table in Supabase...');
  
  // Check if required environment variables are set
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing required environment variables:');
    if (!supabaseUrl) console.error('- NEXT_PUBLIC_SUPABASE_URL');
    if (!serviceRoleKey) console.error('- SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nPlease set these in your .env file or environment.');
    process.exit(1);
  }
  
  // Create Supabase admin client
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
  
  try {
    console.log('Checking Supabase connection...');
    // Simple test query
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error connecting to Supabase:', error);
      process.exit(1);
    }
    
    console.log('Successfully connected to Supabase');
    
    // Read SQL script
    console.log('Reading SQL script...');
    const sqlScript = fs.readFileSync(
      path.join(__dirname, 'create-user-state-table.sql'),
      'utf8'
    );
    
    console.log('Executing SQL script...');
    // Execute SQL using raw query (need to use service role key)
    const { error: sqlError } = await supabase.rpc('exec_sql', { sql: sqlScript });
    
    if (sqlError) {
      console.error('Error executing SQL script:');
      console.error(sqlError);
      
      // Try alternative approach - execute statements one by one
      console.log('Trying alternative approach...');
      const statements = sqlScript.split(';').filter(stmt => stmt.trim().length > 0);
      
      for (const [index, stmt] of statements.entries()) {
        console.log(`Executing statement ${index + 1}/${statements.length}...`);
        try {
          const { error: stmtError } = await supabase.rpc('exec_sql', { sql: stmt });
          if (stmtError) {
            console.warn(`Warning: Statement failed: ${stmtError.message}`);
            console.warn('Statement was:', stmt.trim());
          }
        } catch (e) {
          console.warn(`Error executing statement: ${e.message}`);
        }
      }
    }
    
    // Verify table exists
    console.log('Verifying table creation...');
    const { data: tableData, error: tableError } = await supabase
      .from('user_state')
      .select('count', { count: 'exact', head: true });
    
    if (tableError) {
      if (tableError.code === '42P01') { // table does not exist
        console.error('Failed to create user_state table');
      } else {
        console.error('Error verifying table:', tableError);
      }
    } else {
      console.log('user_state table successfully created or verified!');
    }
    
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

setupUserStateTable().catch(console.error);