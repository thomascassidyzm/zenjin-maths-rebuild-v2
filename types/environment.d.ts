/**
 * Environment variable definitions for TypeScript
 */
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Supabase
      NEXT_PUBLIC_SUPABASE_URL: string;
      NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
      SUPABASE_SERVICE_ROLE_KEY: string;
      
      // Stripe
      STRIPE_SECRET_KEY: string;
      STRIPE_WEBHOOK_SECRET: string;
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
      
      // Stripe Price IDs
      STRIPE_PRICE_MONTHLY: string;
      STRIPE_PRICE_ANNUAL: string;
      STRIPE_PRICE_LIFETIME: string;
      
      // Next.js
      NODE_ENV: 'development' | 'production' | 'test';
      NEXT_PUBLIC_APP_URL: string;
      
      // Logging
      LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
    }
  }
}

export {};