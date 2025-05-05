import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase, transferAnonymousData } from '../lib/auth/supabaseClient';
import { cleanupAnonymousData } from '../lib/authUtils';
import AnonymousToAuthMigration from '../components/auth/AnonymousToAuthMigration';

export default function LoginCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Finalizing your login...');
  const [error, setError] = useState('');
  
  // Process query parameters when available
  useEffect(() => {
    async function processAuthRedirect() {
      try {
        // We need query parameters to process the callback
        if (!router.isReady) return;
        
        const { code, token, type, error_description } = router.query;
        
        // Handle error in query parameters
        if (error_description) {
          console.error('Auth error from redirect:', error_description);
          setStatus('Authentication failed');
          setError(error_description as string);
          return;
        }
        
        console.log('Processing auth callback with params:', router.query);
        
        // Get the hash fragment of the URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');
        
        // If we have hash params with tokens, process them
        if (access_token && refresh_token) {
          console.log('Found tokens in URL hash, processing...');
          
          // Store the session
          const { data, error } = await supabase.auth.setSession({
            access_token: access_token,
            refresh_token: refresh_token
          });
          
          if (error) {
            console.error('Error setting session from hash:', error);
            setStatus('Failed to complete authentication');
            setError(error.message);
            return;
          }
          
          // Session set successfully
          console.log('Session established from hash params');
          localStorage.setItem('zenjin_auth_state', 'authenticated');
          
          if (data.user?.email) {
            localStorage.setItem('zenjin_user_email', data.user.email);
          }
          
          // Handle anonymous data transfer if user is new
          if (data.user?.id) {
            try {
              // Set auth state and headers for API calls
              localStorage.setItem('zenjin_auth_state', 'authenticated');
              localStorage.setItem('zenjin_user_id', data.user.id);
              
              if (data.session?.access_token) {
                // Store auth headers for API calls
                const authHeaders = {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${data.session.access_token}`
                };
                localStorage.setItem('zenjin_auth_headers', JSON.stringify(authHeaders));
              }
              
              // Transfer anonymous data
              await transferAnonymousData(data.user.id);
              
              // Create or update user profile
              try {
                const profileResponse = await fetch('/api/auth/create-profile', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${data.session?.access_token || ''}`
                  },
                  body: JSON.stringify({
                    displayName: data.user.email?.split('@')[0] || 'User',
                    anonymousId: localStorage.getItem('zenjin_anonymous_id') || null
                  })
                });
                
                if (!profileResponse.ok) {
                  console.error('Failed to create/update user profile');
                } else {
                  console.log('User profile created/updated successfully');
                }
              } catch (profileError) {
                console.error('Error creating user profile:', profileError);
              }
              
              // Clean up anonymous data after successful transfer
              cleanupAnonymousData();
            } catch (transferError) {
              console.error('Error during data transfer:', transferError);
            }
          }
          
          // Always redirect to home page
          if (localStorage.getItem('zenjin_is_new_user') === 'true') {
            localStorage.removeItem('zenjin_is_new_user');
          }
          
          router.replace('/');
          return;
        }
        
        // Process OTP token
        if (token) {
          console.log('Processing OTP token from URL');
          
          // For OTP tokens, we need to let Supabase handle it
          const { data, error } = await supabase.auth.verifyOtp({
            token: token as string,
            type: (type as 'recovery' | 'email' | 'signup' | 'invite') || 'signup'
          });
          
          if (error) {
            console.error('Error verifying OTP token:', error);
            setStatus('Authentication failed');
            setError(error.message);
            return;
          }
          
          // Session established successfully
          console.log('Session established from OTP token', data);
          localStorage.setItem('zenjin_auth_state', 'authenticated');
          
          if (data.user?.email) {
            localStorage.setItem('zenjin_user_email', data.user.email);
          }
          
          // Handle anonymous data transfer if user is new
          if (data.user?.id) {
            try {
              // Set auth state and headers for API calls
              localStorage.setItem('zenjin_auth_state', 'authenticated');
              localStorage.setItem('zenjin_user_id', data.user.id);
              
              if (data.session?.access_token) {
                // Store auth headers for API calls
                const authHeaders = {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${data.session.access_token}`
                };
                localStorage.setItem('zenjin_auth_headers', JSON.stringify(authHeaders));
              }
              
              // Transfer anonymous data
              await transferAnonymousData(data.user.id);
              
              // Create or update user profile
              try {
                const profileResponse = await fetch('/api/auth/create-profile', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${data.session?.access_token || ''}`
                  },
                  body: JSON.stringify({
                    displayName: data.user.email?.split('@')[0] || 'User',
                    anonymousId: localStorage.getItem('zenjin_anonymous_id') || null
                  })
                });
                
                if (!profileResponse.ok) {
                  console.error('Failed to create/update user profile');
                } else {
                  console.log('User profile created/updated successfully');
                }
              } catch (profileError) {
                console.error('Error creating user profile:', profileError);
              }
              
              // Clean up anonymous data after successful transfer
              cleanupAnonymousData();
            } catch (transferError) {
              console.error('Error during data transfer:', transferError);
            }
          }
          
          // Clean up
          localStorage.removeItem('auth_return_url');
          if (localStorage.getItem('zenjin_is_new_user') === 'true') {
            localStorage.removeItem('zenjin_is_new_user');
          }
          
          // Always redirect to home page
          router.replace('/');
          return;
        }
        
        // Get return URL from local storage or default to home
        const returnUrl = localStorage.getItem('auth_return_url') || '/';
        
        // Clear the return URL
        localStorage.removeItem('auth_return_url');
        
        // Process regular OAuth callback
        if (code) {
          console.log('Auth code present, redirecting to:', returnUrl);
          
          // Exchange code for session using Supabase SDK
          const { data, error } = await supabase.auth.exchangeCodeForSession(code as string);
          
          if (error) {
            console.error('Error exchanging code for session:', error);
            setStatus('Authentication failed');
            setError(error.message);
            return;
          }
          
          // Session established successfully
          console.log('Session established from code');
          localStorage.setItem('zenjin_auth_state', 'authenticated');
          
          if (data.user?.email) {
            localStorage.setItem('zenjin_user_email', data.user.email);
          }
          
          // Handle anonymous data transfer if user is new
          if (data.user?.id) {
            try {
              // Set auth state and headers for API calls
              localStorage.setItem('zenjin_auth_state', 'authenticated');
              localStorage.setItem('zenjin_user_id', data.user.id);
              
              if (data.session?.access_token) {
                // Store auth headers for API calls
                const authHeaders = {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${data.session.access_token}`
                };
                localStorage.setItem('zenjin_auth_headers', JSON.stringify(authHeaders));
              }
              
              // Transfer anonymous data
              await transferAnonymousData(data.user.id);
              
              // Create or update user profile
              try {
                const profileResponse = await fetch('/api/auth/create-profile', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${data.session?.access_token || ''}`
                  },
                  body: JSON.stringify({
                    displayName: data.user.email?.split('@')[0] || 'User',
                    anonymousId: localStorage.getItem('zenjin_anonymous_id') || null
                  })
                });
                
                if (!profileResponse.ok) {
                  console.error('Failed to create/update user profile');
                } else {
                  console.log('User profile created/updated successfully');
                }
              } catch (profileError) {
                console.error('Error creating user profile:', profileError);
              }
              
              // Clean up anonymous data after successful transfer
              cleanupAnonymousData();
            } catch (transferError) {
              console.error('Error during data transfer:', transferError);
            }
          }
          
          // Clean up
          if (localStorage.getItem('zenjin_is_new_user') === 'true') {
            localStorage.removeItem('zenjin_is_new_user');
          }
          
          console.log('Redirecting from code callback to home page');
          router.replace('/');
          return;
        }
        
        // Nothing to process, redirect to home page
        if (!code && !token && !access_token) {
          // Clean up
          if (localStorage.getItem('zenjin_is_new_user') === 'true') {
            localStorage.removeItem('zenjin_is_new_user');
          }
          
          console.log('No auth parameters to process, redirecting to home page');
          router.replace('/');
          return;
        }
      } catch (err: any) {
        console.error('Error processing auth callback:', err);
        setStatus('An error occurred');
        setError(err.message || 'Failed to complete authentication');
      }
    }
    
    processAuthRedirect();
  }, [router.isReady, router.query, router]);
  
  return (
    <div className="min-h-screen flex items-center justify-center dashboard-bg">
      {/* Add the migration component to handle data transfer */}
      <AnonymousToAuthMigration 
        showStatus={true}
        onComplete={() => console.log('Migration complete in callback page')}
        onError={(err) => console.error('Migration error in callback page:', err)}
      />
      
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 max-w-md w-full mx-auto text-center shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-4">{status}</h1>
        
        {error ? (
          <div className="text-red-300 mb-4">
            {error}
            <div className="mt-4">
              <button 
                onClick={() => router.push('/signin')}
                className="py-2 px-4 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-6">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-teal-500 border-teal-200"></div>
          </div>
        )}
        
        <p className="text-white/70">
          You'll be redirected automatically...
        </p>
      </div>
    </div>
  );
}