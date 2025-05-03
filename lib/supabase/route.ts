import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Create a Supabase client for use in API route handlers (Pages Router)
 * This uses the anon key and respects RLS
 * @returns Supabase client with request/response cookie handling for API routes
 */
export const createRouteHandlerClient = (req: NextApiRequest, res: NextApiResponse) => {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies[name];
        },
        set(name: string, value: string, options: CookieOptions) {
          res.setHeader('Set-Cookie', `${name}=${value}; Path=/; ${getHeaderStringFromOptions(options)}`);
        },
        remove(name: string, options: CookieOptions) {
          res.setHeader('Set-Cookie', `${name}=; Max-Age=0; Path=/; ${getHeaderStringFromOptions(options)}`);
        },
      },
    }
  );
};

/**
 * Create a Supabase Admin client that bypasses RLS
 * For use in API routes that need to access data without row-level security
 * @returns Supabase admin client with service role key
 */
export const createAdminClient = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials for admin client');
    throw new Error('Missing required environment variables for Supabase admin client');
  }
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false
      }
    }
  );
};

/**
 * Converts cookie options to header string format
 */
function getHeaderStringFromOptions(options: CookieOptions): string {
  const parts: string[] = [];
  
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  
  if (options.maxAge) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  
  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }
  
  if (options.httpOnly) {
    parts.push('HttpOnly');
  }
  
  if (options.secure) {
    parts.push('Secure');
  }
  
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }
  
  return parts.join('; ');
}