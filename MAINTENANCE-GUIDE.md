# Maintenance Guide for Zenjin Maths

This guide provides important information for future development and maintenance of the Zenjin Maths application, especially regarding UUID handling and database operations.

## UUID Handling Best Practices

To prevent issues with UUID comparisons in the future, follow these guidelines:

### Database Operations

1. **Always Use Consistent Types**
   ```sql
   -- GOOD: Explicit type casting in comparisons
   WHERE user_id::text = auth.uid()::text
   
   -- AVOID: Direct comparison between different types
   WHERE user_id = auth.uid()
   ```

2. **Handle Anonymous Users Consistently**
   ```sql
   -- Use the anonymous_user_id() function
   WHERE user_id = anonymous_user_id()
   
   -- Include fallback for when function isn't available
   OR (user_id::text = 'anonymous' AND anonymous_user_id() IS NULL)
   ```

3. **Include Diagnostic User Support**
   ```sql
   -- Support diagnostic users for testing
   OR user_id::text LIKE 'diag-%'
   ```

### API Development

1. **Convert Anonymous IDs to UUID Format**
   ```typescript
   // Convert string 'anonymous' to standard UUID
   const effectiveUserIdUUID = 
     userId === 'anonymous' 
     ? '00000000-0000-0000-0000-000000000000' 
     : userId;
   ```

2. **Always Check User Types**
   ```typescript
   // Check for diagnostic users (special case)
   const isDiagnosticUser = userId.toString().startsWith('diag-');
   
   // Security check for authenticated users
   if (!isDiagnosticUser && authenticatedUserId && 
       userId !== authenticatedUserId && userId !== 'anonymous') {
     return res.status(403).json({ error: 'Unauthorized' });
   }
   ```

3. **Use Defensive Coding for Database Interactions**
   ```typescript
   try {
     const { error } = await supabase
       .from('table_name')
       .insert({ ... });
       
     if (error) {
       // Handle specific error types
       if (error.message.includes('column') && 
           error.message.includes('does not exist')) {
         // Try with minimal fields
       }
     }
   } catch (err) {
     // Log unexpected errors
     console.error('API: Unexpected error:', err);
   }
   ```

## Schema Evolution

When modifying the database schema:

1. **Create Migration Scripts**
   - Document all schema changes
   - Provide scripts to update existing databases
   - Include rollback procedures

2. **Backward Compatibility**
   - Keep support for legacy tables/columns during transition
   - Use progressive feature detection
   - Add fallback code paths for older schema versions

3. **RLS Policy Updates**
   - Always update RLS policies when adding tables
   - Test policy effectiveness with authenticated and anonymous users
   - Include all user types in policy conditions

## Testing and Monitoring

1. **UUID Testing**
   - Test with multiple user types (authenticated, anonymous, diagnostic)
   - Verify proper conversion between string and UUID formats
   - Check database queries with EXPLAIN ANALYZE

2. **Database Monitoring**
   - Add monitoring for slow queries
   - Track error rates by API endpoint
   - Set up alerts for permission issues

3. **Type Safety**
   - Use TypeScript interfaces for API request/response types
   - Define clear type conversion boundaries
   - Document expected types in API documentation

## Common Pitfalls

1. **UUID vs Text Confusion**
   - Postgres treats UUIDs and strings as different types
   - Direct comparison between UUID and text fails
   - Always cast to consistent types in comparisons

2. **Incomplete RLS Policies**
   - Missing conditions in RLS policies blocks data access
   - Always include all user types in your policies
   - Test policies with different user scenarios

3. **Function Availability**
   - Custom functions may not be available during policy evaluation
   - Include fallback conditions that don't rely on custom functions
   - Test policy behavior when functions return NULL

## Documentation Updates

When making changes:

1. Update relevant files:
   - README.md
   - DATABASE-SETUP-GUIDE.md
   - API-DOCUMENTATION.md
   - MAINTENANCE-GUIDE.md (this file)

2. Include:
   - What changed
   - Why it changed
   - How to test the changes
   - Potential impacts on existing code

## Supabase-Specific Considerations

When working with Supabase:

1. **Service Role Permissions**
   - Use service role for administrative operations
   - Be cautious with RLS bypassing

2. **RLS Policy Creation**
   - Policies are enforced immediately upon creation
   - Test thoroughly before deploying to production

3. **Function Dependencies**
   - RLS policies may evaluate in different contexts
   - Avoid complex function dependencies in policies
   - Include fallbacks for when functions aren't available