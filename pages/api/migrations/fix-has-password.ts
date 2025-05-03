/**
 * Migration API: Fix has_password column
 * 
 * Ensures the has_password column in the profiles table exists 
 * and is configured to allow NULL values (making it optional).
 * This fixes issues with OTP-based authentication that doesn't use passwords.
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
    const migrationPath = path.join(process.cwd(), 'db', 'migrations', 'fix-has-password-column.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    const { error } = await supabaseAdmin.rpc('exec_sql', { 
      sql: migrationSql 
    });

    if (error) {
      logApiError('Migration: fix has_password', error);
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
        errorResponse(`Migration failed: ${error.message}`)
      );
    }

    // Also run a direct check to see the current state of the column
    const { data: columnInfo, error: columnError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'has_password'
      `
    });

    if (columnError) {
      logApiError('Migration: column check', columnError);
    }

    // Log the migration
    logApiInfo('Migration', 'Fixed has_password column in profiles table', null, {
      columnInfo
    });

    return res.status(HTTP_STATUS.OK).json(
      successResponse({ columnInfo }, 'Migration completed successfully')
    );
  } catch (error: any) {
    logApiError('Migration: fix has_password', error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      errorResponse(`Migration failed: ${error.message}`)
    );
  }
}