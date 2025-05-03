import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/auth/supabaseClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow GET or POST requests
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    console.log('API: Checking database tables...');
    
    // Get specific table if requested
    const tableToInspect = req.method === 'POST' ? req.body.table : null;
    
    if (tableToInspect) {
      // Return details for a specific table
      const { data: tableData, error: tableError } = await supabase
        .from(tableToInspect)
        .select('*')
        .limit(50);
      
      if (tableError) {
        return res.status(400).json({
          success: false,
          error: `Error fetching data from ${tableToInspect}: ${tableError.message}`
        });
      }
      
      // Get table structure
      const { data: columnData, error: columnError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', tableToInspect)
        .eq('table_schema', 'public');
      
      return res.status(200).json({
        success: true,
        table: tableToInspect,
        schema: columnData || [],
        count: tableData.length,
        data: tableData
      });
    }

    // List all tables in the database
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
      
      // Try an alternative method to check for tables
      console.log('API: Trying to check specific required tables directly...');
      
      // Define the required tables for this application
      const requiredTables = ['threads', 'stitches', 'questions', 'user_stitch_progress', 'session_results'];
      const tableResults: Record<string, any> = {};
      
      // Check each required table
      for (const tableName of requiredTables) {
        try {
          const { count, error } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          
          tableResults[tableName] = { 
            exists: !error, 
            error: error?.message,
            count: count || 0
          };
          
          if (!error) {
            // If table exists, get a sample record
            const { data: sampleData, error: sampleError } = await supabase
              .from(tableName)
              .select('*')
              .limit(1);
            
            tableResults[tableName].sample = sampleError ? null : (sampleData?.length ? sampleData[0] : null);
          }
        } catch (e) {
          tableResults[tableName] = { 
            exists: false, 
            error: e instanceof Error ? e.message : 'Unknown error'
          };
        }
      }
      
      return res.status(200).json({
        success: false,
        message: 'Could not retrieve all tables, showing required tables only',
        error: tablesError.message,
        requiredTables: tableResults
      });
    }
    
    // Get all tables
    const tableList = tables.map(t => t.table_name);
    console.log('API: Tables found:', tableList);
    
    // Now check each table for row counts and get a sample record
    const tableDetails: Record<string, any> = {};
    
    for (const tableName of tableList) {
      try {
        const { count, error: countError } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (countError) {
          tableDetails[tableName] = { 
            exists: true,
            error: countError.message,
            count: 0
          };
          continue;
        }
        
        // Get a sample record if table has data
        let sample = null;
        if (count && count > 0) {
          const { data: sampleData, error: sampleError } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
          
          if (!sampleError && sampleData?.length) {
            sample = sampleData[0];
          }
        }
        
        // Get column information
        const { data: columnData, error: columnError } = await supabase
          .from('information_schema.columns')
          .select('column_name, data_type')
          .eq('table_name', tableName)
          .eq('table_schema', 'public');
        
        tableDetails[tableName] = { 
          exists: true,
          count: count || 0,
          sample,
          columns: columnError ? [] : columnData
        };
      } catch (err) {
        tableDetails[tableName] = { 
          exists: true,
          error: err instanceof Error ? err.message : 'Failed to get table details',
          count: 0
        };
      }
    }
    
    // Check permissions by trying a write operation on user_stitch_progress if it exists
    let permissionCheck = null;
    if (tableDetails['user_stitch_progress'] && tableDetails['user_stitch_progress'].exists) {
      try {
        const testId = `test-${Date.now()}`;
        const { error: insertError } = await supabase
          .from('user_stitch_progress')
          .upsert({
            id: testId,
            user_id: '00000000-0000-0000-0000-000000000000',
            thread_id: 'permission-test',
            stitch_id: 'permission-test',
            order_number: 999,
            skip_number: 999,
            distractor_level: 'TEST',
            updated_at: new Date().toISOString()
          })
          .select();
        
        // Clean up the test record
        if (!insertError) {
          await supabase
            .from('user_stitch_progress')
            .delete()
            .eq('id', testId);
        }
        
        permissionCheck = {
          success: !insertError,
          error: insertError?.message || null
        };
      } catch (e) {
        permissionCheck = {
          success: false,
          error: e instanceof Error ? e.message : 'Unknown error during permission check'
        };
      }
    }
    
    return res.status(200).json({
      success: true,
      tableCount: tableList.length,
      tables: tableList,
      details: tableDetails,
      permissions: permissionCheck
    });
    
  } catch (err) {
    console.error('Unexpected error checking tables:', err);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}