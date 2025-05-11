import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <meta name="theme-color" content="#0f172a" />
        
        {/* Preconnect to the API domain to speed up initial fetch */}
        <link rel="preconnect" href="/" />
        <link rel="dns-prefetch" href="/" />
        
        {/* 
          Removed preload link for anonymous users since we now use 
          bundled content directly instead of API calls
        */}
      </Head>
      <body>
        <Main />
        <NextScript />
        
        {/* Unregister service worker to fix API URL issues */}
        <script src="/unregister-sw.js"></script>

        {/* EMERGENCY FIX: Disable unnecessary API calls to /api/user-state */}
        <script src="/disable-api-calls.js"></script>
      </body>
    </Html>
  );
}