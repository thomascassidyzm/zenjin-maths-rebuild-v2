import '../styles/globals.css';
import '../styles/player.css';
import type { AppProps } from 'next/app';
import { AuthProvider } from '../context/AuthContext';
import { useEffect } from 'react';
import { stateManager } from '../lib/state/stateManager';
import { contentManager } from '../lib/content/contentManager';
import Script from 'next/script';
import Head from 'next/head';

// Initialize app state via a wrapped component to ensure it runs client-side
function AppStateInitializer() {
  useEffect(() => {
    // Register visibility and unload events for state persistence
    stateManager.registerPageEvents();
    
    // Initialize anonymous user ID if not already present
    if (typeof window !== 'undefined') {
      // Generate anonymous ID on first visit
      const existingAnonId = 
        localStorage.getItem('zenjin_anonymous_id') || 
        localStorage.getItem('anonymousId');
      
      if (!existingAnonId) {
        console.log('First visit detected - creating anonymous user ID');
        const timestamp = Date.now();
        const randomSuffix = Math.floor(Math.random() * 1000000);
        const anonymousId = `anonymous-${timestamp}-${randomSuffix}`;
        
        // Store in multiple localStorage keys for backward compatibility
        localStorage.setItem('zenjin_anonymous_id', anonymousId);
        localStorage.setItem('anonymousId', anonymousId);
        localStorage.setItem('zenjin_user_id', anonymousId);
        localStorage.setItem('zenjin_auth_state', 'anonymous');
        
        // Initialize empty progress data
        const progressData = {
          totalPoints: 0,
          blinkSpeed: 2.5,
          blinkSpeedTrend: 'steady',
          evolution: {
            currentLevel: 'Mind Spark',
            levelNumber: 1,
            progress: 0,
            nextLevel: 'Thought Weaver'
          },
          lastSessionDate: new Date().toISOString()
        };
        
        // Store progress data in localStorage
        localStorage.setItem(`progressData_${anonymousId}`, JSON.stringify(progressData));
        localStorage.setItem('zenjin_anonymous_progress', JSON.stringify(progressData));
        
        console.log(`Anonymous user created with ID: ${anonymousId}`);
      } else {
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
        <Script src="/register-sw.js" strategy="afterInteractive" />
      )}
      
      {/* State initialization */}
      <AppStateInitializer />
      
      {/* Main app component */}
      <Component {...pageProps} />
    </AuthProvider>
  );
}

export default MyApp;