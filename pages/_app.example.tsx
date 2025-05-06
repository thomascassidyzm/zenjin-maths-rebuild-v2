import React, { useEffect } from 'react';
import type { AppProps } from 'next/app';
import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { useRouter } from 'next/router';

// Import our session provider wrapper
import SessionProviderWrapper from '../components/SessionProviderWrapper';

// Import styles
import '../styles/globals.css';

/**
 * Example App Component with Session Provider Integration
 * 
 * This is an example of how to integrate the SessionProviderWrapper into
 * your Next.js application. It shows how to wrap the SessionProviderWrapper
 * around your application while maintaining compatibility with other context
 * providers like Supabase.
 * 
 * To use this:
 * 1. Rename this file to _app.tsx (or copy its contents to your existing _app.tsx)
 * 2. Make any adjustments needed for your specific context providers
 */
function MyApp({ Component, pageProps }: AppProps) {
  // Initialize Supabase client
  const [supabaseClient] = React.useState(() => createBrowserSupabaseClient());
  const router = useRouter();

  // Initialize anonymous ID for session tracking if needed
  useEffect(() => {
    // First, check if a userId exists in localStorage
    if (typeof window !== 'undefined') {
      const existingAnonymousId = localStorage.getItem('anonymousId');
      
      // If no anonymous ID exists, create one
      if (!existingAnonymousId) {
        const newAnonymousId = `anon-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        localStorage.setItem('anonymousId', newAnonymousId);
        console.log('Created new anonymous ID:', newAnonymousId);
      }
    }
  }, []);

  // Handle route changes to refresh session state
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      // You could add logic here to refresh session state on route changes if needed
      console.log(`Route changed to: ${url}`);
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    // Clean up event listener
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  return (
    // First wrap with Supabase authentication context
    <SessionContextProvider
      supabaseClient={supabaseClient}
      initialSession={pageProps.initialSession}
    >
      {/* Then wrap with our session management context */}
      <SessionProviderWrapper>
        {/* Render the page component */}
        <Component {...pageProps} />
      </SessionProviderWrapper>
    </SessionContextProvider>
  );
}

export default MyApp;