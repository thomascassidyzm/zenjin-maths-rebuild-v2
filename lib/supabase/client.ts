import { createBrowserClient } from "@supabase/ssr";

// Singleton instance for Supabase client
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Create a Supabase client for use in client components
 * Uses a singleton pattern to avoid multiple instances
 * @returns Supabase client for browser usage
 */
export const createClient = () => {
  // Return existing instance if we already created one
  if (supabaseInstance) {
    return supabaseInstance;
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    // Provide fallback values for build process to continue
    supabaseInstance = createBrowserClient(
      'https://ggwoupzaruiaaliylxga.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE5MTczNDAsImV4cCI6MjA1NzQ5MzM0MH0.gXtiM5b3YZoV5SMRrMmY59Qp7VjadOxkJ5an0Q3Og_c'
    );
    return supabaseInstance;
  }
  
  supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
};