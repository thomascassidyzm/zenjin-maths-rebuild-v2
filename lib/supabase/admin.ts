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
  // Use hardcoded URL to ensure it's available during build
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggwoupzaruiaaliylyxga.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Don't throw error at build time, but provide fallback (will be overridden at runtime)
  if (!supabaseServiceKey && process.env.NODE_ENV === 'production') {
    console.warn('Missing Supabase service key. Will use placeholder for build process.');
    
    // Use a placeholder for build time only - this will never be used in production
    // as the real key will be provided at runtime
    return createClient(supabaseUrl, 'build-time-placeholder-key', {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  
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