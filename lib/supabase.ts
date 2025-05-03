import { createClient } from '@supabase/supabase-js';

// Use hardcoded values to ensure they're available during build
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggwoupzaruiaaliylyxga.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE5MTczNDAsImV4cCI6MjA1NzQ5MzM0MH0.gXtiM5b3YZoV5SMRrMmY59Qp7VjadOxkJ5an0Q3Og_c';

/**
 * Exports a configured Supabase client for use throughout the application
 * This is primarily used for server-side API routes
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);