# Supabase Security Model

This document explains our Supabase security architecture and how we handle authentication and authorization in API endpoints.

## Client Types

We use three different Supabase client types throughout the application:

1. **Browser Client** (`client.ts`)
   - Uses the anon key
   - Has limited permissions based on RLS policies
   - Used for client-side authenticated requests

2. **Route Handler Client** (`route.ts`)
   - Uses the anon key with cookie-based auth
   - Respects RLS policies
   - Used for server-side API requests that should respect RLS

3. **Admin Client** (`route.ts`, `admin.ts`)
   - Uses the service role key
   - Bypasses RLS completely
   - Used for admin operations and for reliable data access

## Security Model

Our security model follows these principles:

1. **Use Admin Client With Manual Checks**
   - We use the admin client in API endpoints
   - We manually check user IDs before any data operation
   - This approach avoids RLS issues but requires careful coding

2. **API Endpoint Security**
   - Every API endpoint verifies the user's identity
   - For authenticated operations, we confirm the authenticated user matches the requested user ID
   - For anonymous users, we have special handling with anonymous IDs

3. **Table Creation and Migration**
   - We always use the admin client for table creation/migration
   - This is proper since these operations require elevated privileges

## RLS Policies

Even though we primarily use admin clients with manual checks, we still maintain RLS policies for these reasons:

1. **Defense in depth** - Provides an additional security layer
2. **Client-side operations** - Protects data when accessed from browser client
3. **Future flexibility** - Allows changing the security model later

Our core RLS policies follow this pattern:

```sql
-- Users can only access their own data
CREATE POLICY user_data_select_policy ON user_table
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY user_data_insert_policy ON user_table
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY user_data_update_policy ON user_table
  FOR UPDATE USING (auth.uid()::text = user_id);
```

## Using Admin Client Safely

When using the admin client (which bypasses RLS), we follow these guidelines:

1. **Always verify user identity**
   ```typescript
   // Get authenticated user ID
   const { data: authData } = await supabase.auth.getUser();
   const authenticatedUserId = authData?.user?.id;
   
   // Only allow operations on own data
   if (userId !== authenticatedUserId) {
     return res.status(403).json({ error: 'Unauthorized' });
   }
   ```

2. **Be explicit about admin usage**
   ```typescript
   // Admin client for database operations
   const supabaseAdmin = createAdminClient();
   ```

3. **Document the reason for admin usage**
   ```typescript
   // Using admin client because:
   // 1. We need reliable access across users
   // 2. We perform manual user ID checks
   // 3. We want to avoid RLS policy issues
   ```

This approach gives us more control over security while avoiding potential RLS configuration issues.

## Recommended Practices

1. Always check `userId` matches authenticated user before operations
2. Log authentication context in debug mode for troubleshooting
3. Be explicit when using admin client and document why
4. Consider adding an additional middleware layer for auth checks