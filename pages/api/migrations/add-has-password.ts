/**
 * Migration API: Add has_password column
 * 
 * Adds the has_password column to the profiles table if it doesn't exist
 * This column is used to track whether users have set a password
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
    const migrationPath = path.join(process.cwd(), 'db', 'migrations', 'add-has-password-column.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    const { error } = await supabaseAdmin.rpc('exec_sql', { 
      sql: migrationSql 
    });

    if (error) {
      logApiError('Migration: has_password', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse(`Migration failed: ${error.message}`)
      );
    }

    // Also run a direct check to see if the column exists
    const { data: columnInfo, error: columnError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'has_password'
      `
    });

    if (columnError) {
      logApiError('Migration: column check', columnError);
    }

    // Log the migration
    logApiInfo('Migration', 'Added has_password column to profiles table', null, {
      columnInfo
    });

    return res.status(HTTP_STATUS.OK).json(
      successResponse({ columnInfo }, 'Migration completed successfully')
    );
  } catch (error: any) {
    logApiError('Migration: has_password', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse(`Migration failed: ${error.message}`)
    );
  }
}