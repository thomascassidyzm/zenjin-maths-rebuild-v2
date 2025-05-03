# Deployment Notes

This project uses Vercel for deployment. Here are important notes for deployment:

## Required Environment Variables

The following environment variables must be set in your Vercel deployment:

- `NEXT_PUBLIC_SUPABASE_URL` - The URL of your Supabase project
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - The anon/public key for your Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` - The service role key for your Supabase project (for admin operations)

## Database Setup

The application requires the following tables in Supabase:

1. `user_state` - Stores user state data
   - Fields: id, user_id, state (JSONB), last_updated, created_at
   - This table can be created automatically by visiting the /state-inspector page

2. `profiles` - User profile information
   - This is created automatically by Supabase Auth

## State Inspector

The State Inspector tool at `/state-inspector` provides:

1. Database table setup/repair
2. Viewing and debugging server-side state
3. Testing state persistence
4. Clearing local state cache

## First Deployment

When deploying for the first time:

1. Deploy to Vercel with the required environment variables
2. Visit the application and sign in
3. Navigate to `/state-inspector` 
4. Click "Create/Repair Database Tables" button
5. Verify state persistence is working

## Troubleshooting

If you see 500 errors related to database tables:

1. Visit `/state-inspector`
2. Click the "Create/Repair Database Tables" button
3. Refresh and try again