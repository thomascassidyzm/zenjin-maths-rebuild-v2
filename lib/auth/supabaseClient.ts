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
 * Transfer anonymous session data to new authenticated user
 * @param {string} userId - The authenticated user ID
 * @returns {Promise<boolean>} Success status
 */
export async function transferAnonymousData(userId: string) {
  try {
    if (typeof window === 'undefined') {
      return false;
    }
    
    // Set a flag that a transfer is in progress - this prevents
    // the StateMachine from clearing localStorage state during authentication
    console.log('Setting transfer flag before anonymous data migration');
    localStorage.setItem('zenjin_auth_transfer_in_progress', 'true');
    localStorage.setItem('zenjin_auth_transfer_start_time', Date.now().toString());
    
    // Get anonymous session data from localStorage - try multiple key patterns
    // since different parts of the app might use different patterns
    let anonymousId = localStorage.getItem('anonymousId');
    let anonymousData = null;
    
    // Try different possible storage locations/patterns
    const possibleKeys = [
      'zenjin_anonymous_state',
      anonymousId ? `zenjin_state_${anonymousId}` : null,
      anonymousId ? `triple_helix_state_${anonymousId}` : null,
      'zenjin_state_anonymous'
    ].filter(Boolean);
    
    console.log('Checking for anonymous data in these keys:', possibleKeys);
    
    // Try each possible key until we find data
    for (const key of possibleKeys) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (parsed && (parsed.tubes || (parsed.state && parsed.state.tubes))) {
            anonymousData = data;
            console.log(`Found anonymous data in key: ${key}`);
            break;
          }
        } catch (e) {
          console.warn(`Error parsing data from key ${key}:`, e);
        }
      }
    }
    
    if (!anonymousData) {
      console.log('No anonymous data found in any storage location');
      return false;
    }
    
    // Try to parse the data, handling both direct state and wrapped state formats
    let parsedData;
    try {
      parsedData = JSON.parse(anonymousData);
      
      // Handle case where data is wrapped in a "state" property
      if (parsedData.state && parsedData.state.tubes) {
        parsedData = parsedData;
      }
      // Handle case where state is directly stored
      else if (parsedData.tubes) {
        parsedData = { state: parsedData };
      }
      else {
        console.log('Invalid anonymous data format - no tubes found');
        return false;
      }
    } catch (e) {
      console.error('Error parsing anonymous data:', e);
      return false;
    }
    
    console.log('Transferring anonymous session data to user:', userId);
    
    // We will handle this transfer through an API call since it requires database access
    const response = await fetch('/api/transfer-anonymous-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        anonymousData: parsedData
      })
    });
    
    if (!response.ok) {
      console.error('Failed to transfer anonymous data:', response.statusText);
      return false;
    }
    
    // Only clear anonymous data after successful transfer
    if (response.ok) {
      // Clear all formats of anonymous data to ensure clean state
      localStorage.removeItem('zenjin_anonymous_state');
      
      // Clear anonymousId-based keys if they exist
      if (anonymousId) {
        localStorage.removeItem(`zenjin_state_${anonymousId}`);
        localStorage.removeItem(`triple_helix_state_${anonymousId}`);
        localStorage.removeItem(`sessionData_${anonymousId}`);
        localStorage.removeItem(`progressData_${anonymousId}`);
      }
      
      // Clear the anonymousId itself
      localStorage.removeItem('anonymousId');
      
      console.log('Anonymous data transferred successfully and cleared from localStorage');
      
      // IMPORTANT: Clear the transfer flag now that we're done
      localStorage.removeItem('zenjin_auth_transfer_in_progress');
      localStorage.removeItem('zenjin_auth_transfer_start_time');
      console.log('Cleared transfer-in-progress flag');
    } else {
      console.warn('Transfer API call succeeded but returned non-200 status - keeping anonymous data as backup');
      // Clear the transfer flag even on failure to prevent getting stuck
      localStorage.removeItem('zenjin_auth_transfer_in_progress');
      localStorage.removeItem('zenjin_auth_transfer_start_time');
    }
    
    return true;
  } catch (error) {
    console.error('Error transferring anonymous data:', error);
    
    // Clear the transfer flag in case of error to prevent getting stuck
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('zenjin_auth_transfer_in_progress');
        localStorage.removeItem('zenjin_auth_transfer_start_time');
        console.log('Cleared transfer flag due to error');
      } catch (err) {
        console.warn('Could not clear transfer flag:', err);
      }
    }
    
    return false;
  }
}

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
      
      // If we have a user, transfer any anonymous data
      if (data.user?.id) {
        await transferAnonymousData(data.user.id);
      }
      
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
      
      // If we have a user, transfer any anonymous data
      if (data.user?.id) {
        await transferAnonymousData(data.user.id);
      }
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