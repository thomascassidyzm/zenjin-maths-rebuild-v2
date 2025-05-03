import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        <meta name="theme-color" content="#0f172a" />
        
        {/* Preconnect to the API domain to speed up initial fetch */}
        <link rel="preconnect" href="/" />
        <link rel="dns-prefetch" href="/" />
        
        {/* Preload the first stitch data if possible */}
        <link 
          rel="preload" 
          href="/api/user-stitches?userId=anonymous&prefetch=5&isAnonymous=true" 
          as="fetch" 
          crossOrigin="anonymous" 
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}