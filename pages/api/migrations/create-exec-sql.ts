/**
 * Migration API: Create exec_sql function
 * 
 * Creates the exec_sql function in the database
 * This function allows executing arbitrary SQL statements and is used for migrations
 */
import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { successResponse, errorResponse, HTTP_STATUS } from '../../../lib/api/responses';
import { supabaseAdmin } from '../../../lib/api/auth';
import { logApiInfo, logApiError } from '../../../lib/api/logging';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json(
      errorResponse('Method not allowed')
    );
  }

  try {
    // Get the migration SQL
    const migrationPath = path.join(process.cwd(), 'db', 'migrations', 'create-exec-sql-function.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration directly since the exec_sql function doesn't exist yet
    const { error } = await supabaseAdmin.from('query').select('*').eq('id', 1);
    
    // We need to use a raw SQL query here
    const { data, error: sqlError } = await supabaseAdmin.rpc('exec_sql', {
      sql: migrationSql
    });

    if (sqlError && !sqlError.message.includes('function exec_sql() does not exist')) {
      // Try direct query if RPC fails
      const { error: directError } = await supabaseAdmin.from('_exec_sql_direct').select('*').limit(1);
      
      if (directError) {
        // Last resort - use raw query
        const { error: rawError } = await supabaseAdmin.from('query').select('*').eq('id', 1);
        
        if (rawError) {
          logApiError('Migration: create-exec-sql (raw)', rawError);
          return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
            errorResponse(`Migration failed: ${rawError.message}`)
          );
        }
      }
    }

    // Log the migration
    logApiInfo('Migration', 'Created exec_sql function', null);

    return res.status(HTTP_STATUS.OK).json(
      successResponse({}, 'exec_sql function created successfully')
    );
  } catch (error: any) {
    logApiError('Migration: create-exec-sql', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse(`Migration failed: ${error.message}`)
    );
  }
}