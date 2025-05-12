import '../styles/globals.css';
import '../styles/player.css';
import type { AppProps } from 'next/app';
import { AuthProvider } from '../context/AuthContext';
import { useEffect } from 'react';
import { stateManager } from '../lib/state/stateManager';
import { contentManager } from '../lib/content/contentManager';
import Script from 'next/script';
import Head from 'next/head';
// EMERGENCY FIX: Disable unnecessary API calls
import '../lib/disableApiCalls';

// Initialize app state via a wrapped component to ensure it runs client-side
function AppStateInitializer() {
  useEffect(() => {
    // Register visibility and unload events for state persistence
    stateManager.registerPageEvents();
    
    // Do NOT automatically create an anonymous ID on first visit
    // Anonymous IDs will only be created when the user explicitly clicks "Try Without Signing Up"
    if (typeof window !== 'undefined') {
      // Check if we have a createAnonymousState flag - if so, we're coming from "Try Without Signing Up"
      const shouldCreateAnonymousState = localStorage.getItem('zenjin_create_anonymous_state') === 'true';
      
      // If we have an existing anonymous ID, log it but don't create a new one
      const existingAnonId = 
        localStorage.getItem('zenjin_anonymous_id') || 
        localStorage.getItem('anonymousId');
      
      if (existingAnonId) {
        console.log(`Using existing anonymous ID: ${existingAnonId}`);
      }
      
      // Initialize legacy global queues for backward compatibility
      // @ts-ignore - Add global window properties
      window.__STITCH_UPDATE_QUEUE = window.__STITCH_UPDATE_QUEUE || [];
      // @ts-ignore - Add global window properties
      window.__TUBE_POSITION_QUEUE = window.__TUBE_POSITION_QUEUE || [];
      // @ts-ignore - Add global window properties
      window.__TUBE_DEBUG_STATE = window.__TUBE_DEBUG_STATE || {};
    }
    
    // Log initial status
    console.log('State and content management initialized!');
    
    // Clean up any old caches when the app is refreshed
    if (contentManager) {
      setTimeout(() => {
        contentManager.clearOldCache();
      }, 5000);
    }
  }, []);
  
  return null;
}

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Head>
        <meta name="theme-color" content="#0f172a" />
      </Head>
      
      {/* Service worker registration - only on client side */}
      {typeof window !== 'undefined' && (
        <>
          <Script src="/register-sw.js" strategy="afterInteractive" />
          {/* Debug tool loader - works with URL param ?debug=true or keyboard shortcut Ctrl+Shift+D */}
          <Script src="/debug-loader.js" strategy="afterInteractive" />
        </>
      )}

      {/* State initialization */}
      <AppStateInitializer />
      
      {/* Main app component */}
      <Component {...pageProps} />
    </AuthProvider>
  );
}

export default MyApp;