/**
 * Supabase Admin Client
 * 
 * This file provides functions to create a Supabase client with admin/service role privileges,
 * which allows performing operations with elevated permissions.
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Create a Supabase client with service role privileges
 * This client has admin-level access to the database, bypassing RLS policies
 */
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables for service role');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}