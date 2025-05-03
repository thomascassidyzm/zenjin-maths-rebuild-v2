import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// Types for response data
type ResponseData = {
  success?: boolean;
  message?: string;
  error?: string;
  session?: any;
  user?: any;
};

// Get Supabase credentials from environment variables
function getSupabaseCredentials() {
  // Use hardcoded values to ensure they're available during build
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggwoupzaruiaaliylxga.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE5MTczNDAsImV4cCI6MjA1NzQ5MzM0MH0.gXtiM5b3YZoV5SMRrMmY59Qp7VjadOxkJ5an0Q3Og_c';
  
  return { supabaseUrl, supabaseKey };
}

// Initialize a Supabase client
let supabase: any;

function getSupabaseClient() {
  if (!supabase) {
    try {
      const { supabaseUrl, supabaseKey } = getSupabaseCredentials();
      console.log(`Creating Supabase client with URL: ${supabaseUrl}`);
      supabase = createClient(supabaseUrl, supabaseKey);
      console.log('Supabase client created successfully');
    } catch (error) {
      console.error('Error creating Supabase client:', error);
      return null;
    }
  }
  return supabase;
}

/**
 * API handler for authentication operations
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Requested-With');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    console.log('Received OPTIONS request');
    return res.status(200).end();
  }
  
  // Only allow POST requests for auth operations
  if (req.method !== 'POST') {
    console.log(`Method not allowed: ${req.method}`);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  try {
    // Make sure we can parse the body
    if (!req.body) {
      return res.status(400).json({ error: 'Request body is missing' });
    }
    
    console.log('Auth API request body:', req.body);
    
    const { action, email = '', code = '' } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: 'Action parameter is required' });
    }
    
    // Get a Supabase client instance
    const supabaseClient = getSupabaseClient();
    if (!supabaseClient) {
      return res.status(500).json({ error: 'Could not initialize Supabase client' });
    }
    
    // Clean the email input
    const cleanEmail = typeof email === 'string' ? email.trim() : '';
    
    console.log(`Processing auth action: ${action}`);

    switch (action) {
      case 'sendOTP': {
        // Basic validation
        if (!cleanEmail || !cleanEmail.includes('@')) {
          return res.status(400).json({ 
            error: 'Please provide a valid email address' 
          });
        }

        console.log(`Sending OTP to: ${cleanEmail}`);
        
        // Get the origin for redirects
        const origin = req.headers.origin || process.env.NEXT_PUBLIC_URL || '';
        console.log(`Using origin for redirects: ${origin}`);
        
        // Use Supabase method for sending OTP
        const { error } = await supabaseClient.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            shouldCreateUser: true,
            channel: 'email',
            // Prevent browser redirects that can interfere with our flow
            skipBrowserRedirect: true,
            // But provide a valid redirect URL for security requirements
            emailRedirectTo: origin ? `${origin}/api/auth/callback` : undefined,
          }
        });

        if (error) {
          console.error('Error sending OTP:', error);
          return res.status(400).json({ error: error.message });
        }

        console.log('OTP sent successfully');
        return res.status(200).json({
          success: true,
          message: 'Verification code sent to your email'
        });
      }

      case 'verifyOTP': {
        // Basic validation
        if (!cleanEmail || !cleanEmail.includes('@')) {
          return res.status(400).json({ 
            error: 'Please provide a valid email address' 
          });
        }

        if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
          return res.status(400).json({
            error: 'Please enter a valid 6-digit code'
          });
        }

        console.log(`Verifying OTP for: ${cleanEmail}`);
        
        // Get the origin for redirects
        const origin = req.headers.origin || process.env.NEXT_PUBLIC_URL || '';
        
        // Verify the OTP code with enhanced options
        const { data, error } = await supabaseClient.auth.verifyOtp({
          email: cleanEmail,
          token: code,
          type: 'email',
          options: {
            // Prevent browser redirects that can interfere with our flow
            skipBrowserRedirect: true,
            // For PKCE flow, provide a redirect URL
            redirectTo: origin ? `${origin}/api/auth/callback` : undefined,
          }
        });

        if (error) {
          console.error('Error verifying OTP:', error);
          return res.status(400).json({ error: error.message });
        }

        console.log('OTP verified successfully');
        return res.status(200).json({
          success: true,
          session: data.session,
          user: data.user
        });
      }

      default:
        console.log(`Invalid action: ${action}`);
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error: any) {
    console.error('Auth API error:', error);
    return res.status(500).json({ 
      error: 'An error occurred. Please try again.',
      message: error.message 
    });
  }
}