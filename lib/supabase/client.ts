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
  
  // Always use hardcoded values to ensure they're available during build
  const supabaseUrl = 'https://ggwoupzaruiaaliylyxga.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE5MTczNDAsImV4cCI6MjA1NzQ5MzM0MH0.gXtiM5b3YZoV5SMRrMmY59Qp7VjadOxkJ5an0Q3Og_c';
  
  // Create client with cookie options to prevent empty cookie issue
  supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      // Set cookie options to avoid empty name/value in cookie
      name: 'sb-auth-token',
      domain: typeof window !== 'undefined' ? window.location.hostname : undefined,
      path: '/',
      sameSite: 'lax',
      secure: true
    }
  });
  
  return supabaseInstance;
};