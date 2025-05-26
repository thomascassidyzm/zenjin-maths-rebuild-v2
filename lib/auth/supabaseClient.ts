/**
 * Supabase Client for Authentication
 * 
 * Handles authentication operations using Supabase's auth services
 * with One-Time Password (OTP) email verification.
 * Uses the new SSR authentication pattern for better cookie handling.
 */
import { createClient as createBrowserClient } from '@supabase/supabase-js';
import { createClient as createClientComponent } from '../supabase/client';

// Initialize a browser client for client-side operations
// Use hardcoded values to ensure they're available during build
const supabaseUrl = 'https://ggwoupzaruiaaliylyxga.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE5MTczNDAsImV4cCI6MjA1NzQ5MzM0MH0.gXtiM5b3YZoV5SMRrMmY59Qp7VjadOxkJ5an0Q3Og_c';

// Create a client for client-side use that leverages the SSR pattern
// Use the singleton pattern from createClientComponent()
export const supabase = typeof window !== 'undefined' 
  ? createClientComponent() 
  : createBrowserClient(supabaseUrl, supabaseKey);

/**
 * Check if the user is authenticated
 * @returns {Promise<object>} Authentication status
 */
export async function checkAuth() {
  // Handle server-side rendering
  if (typeof window === 'undefined') {
    return { authenticated: false, user: null };
  }
  
  try {
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error checking session:', error);
      return { authenticated: false, user: null, error };
    }
    
    // No active session
    if (!session) {
      return { authenticated: false, user: null };
    }
    
    // Get user details
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Error getting user:', userError);
      return { authenticated: false, user: null, error: userError };
    }
    
    return { 
      authenticated: true, 
      user,
      email: user.email
    };
  } catch (error) {
    console.error('Exception checking auth:', error);
    return { authenticated: false, user: null, error };
  }
}

/**
 * Sign in with email OTP or password
 * @param {string} email - User's email address
 * @param {string} password - Optional password for password-based auth
 * @returns {Promise<object>} Auth result
 */
export async function signInWithEmail(email: string, password?: string) {
  try {
    // Clean the email to prevent issues
    const cleanEmail = email.trim().toLowerCase();
    console.log(`Signing in with email: ${cleanEmail}${password ? ' and password' : ' (OTP)'}`);
    
    // If password is provided, use password-based authentication
    if (password) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });
      
      if (error) {
        console.error('Error signing in with password:', error);
        return { success: false, error };
      }
      
      // Store auth state for app
      if (typeof window !== 'undefined') {
        localStorage.setItem('zenjin_auth_state', 'authenticated');
        localStorage.setItem('zenjin_user_email', cleanEmail);
      }
      
      // If we have a user, data transfer for anonymous users is now handled by TTL accounts in Supabase.
      // No explicit client-side transfer call needed.
      // console.log('User signed in with password. Anonymous data transfer (if any) handled by backend/Supabase TTL.');
      
      return { success: true, user: data.user, session: data.session };
    }
    
    // Store email in localStorage consistently
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_email', cleanEmail);
      localStorage.setItem('zenjin_signup_email', cleanEmail);
      
      // Store the return URL if needed
      const currentPath = window.location.pathname;
      if (currentPath !== '/signin' && currentPath !== '/login') {
        localStorage.setItem('auth_return_url', currentPath);
      }
    }
    
    // Use OTP authentication
    const { data, error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
        // Use relative URL for callback to avoid cross-domain issues
        emailRedirectTo: `/api/auth/callback`,
      }
    });
    
    if (error) {
      console.error('Error sending OTP:', error);
      return { success: false, error };
    }
    
    console.log('OTP sent successfully to', cleanEmail);
    
    return { success: true, data, email: cleanEmail };
  } catch (error) {
    console.error('Exception during sign in:', error);
    return { success: false, error };
  }
}

/**
 * Verify OTP code
 * @param {string} code - OTP code from email
 * @returns {Promise<object>} Auth result
 */
export async function verifyOtp(code: string) {
  try {
    // Get email from storage
    const email = localStorage.getItem('auth_email');
    
    if (!email) {
      console.error('No email found in localStorage for OTP verification');
      return { 
        success: false, 
        error: { message: 'Email not found. Please start the sign-in process again.' } 
      };
    }
    
    console.log(`Verifying OTP for ${email} with code: ${code}`);
    
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email'
    });
    
    if (error) {
      console.error('Error verifying OTP:', error);
      return { success: false, error };
    }
    
    console.log('OTP verified successfully, user:', data.user);
    
    // Store auth state for app
    if (typeof window !== 'undefined') {
      localStorage.setItem('zenjin_auth_state', 'authenticated');
      localStorage.setItem('zenjin_user_email', email);
      
      // Clear the temporary auth email
      localStorage.removeItem('auth_email');
      
      // If we have a user, data transfer for anonymous users is now handled by TTL accounts in Supabase.
      // No explicit client-side transfer call needed.
      // console.log('OTP verified. Anonymous data transfer (if any) handled by backend/Supabase TTL.');
    }
    
    return { success: true, user: data.user, session: data.session };
  } catch (error) {
    console.error('Exception verifying OTP:', error);
    return { success: false, error };
  }
}

/**
 * Sign out the current user
 * @returns {Promise<object>} Sign out result
 */
export async function signOut() {
  try {
    console.log('Signing out user');
    
    // Clear stored authentication data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_email');
      localStorage.removeItem('zenjin_auth_state');
      localStorage.removeItem('zenjin_user_email');
    }
    
    // Sign out with Supabase
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error signing out:', error);
      return { success: false, error };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Exception signing out:', error);
    return { success: false, error };
  }
}

export default supabase;