import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Exports a configured Supabase client for use throughout the application
 * This is primarily used for server-side API routes
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);