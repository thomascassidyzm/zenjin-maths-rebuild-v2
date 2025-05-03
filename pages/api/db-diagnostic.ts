import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../lib/supabase';
import { createRouteHandlerClient } from '../../lib/supabase/route';

/**
 * API endpoint to diagnose database structure and permissions
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const diagnosticResults: any = {
    auth: {},
    tables: {},
    permissions: {},
    testWrites: {}
  };

  // Create both types of clients
  const clientBasic = supabase;
  const clientRoute = createRouteHandlerClient(req, res);

  try {
    // Check authentication status
    const { data: session, error: authError } = await clientRoute.auth.getSession();
    diagnosticResults.auth.hasSession = !!session?.data?.session;
    diagnosticResults.auth.userId = session?.data?.session?.user?.id || null;
    diagnosticResults.auth.error = authError ? authError.message : null;

    // List tables
    try {
      const { data: tables, error: tablesError } = await clientRoute
        .from('pg_catalog.pg_tables')
        .select('schemaname, tablename')
        .eq('schemaname', 'public');
        
      diagnosticResults.tables.list = tables || [];
      diagnosticResults.tables.error = tablesError ? tablesError.message : null;
    } catch (e) {
      diagnosticResults.tables.error = e instanceof Error ? e.message : String(e);
    }

    // Look for specific expected tables
    const expectedTables = [
      'profiles', 
      'user_sessions', 
      'session_results', 
      'users', 
      'user_stitch_progress', 
      'user_tube_position'
    ];
    
    diagnosticResults.tables.specific = {};
    
    for (const tableName of expectedTables) {
      try {
        const { data, error } = await clientRoute
          .from(tableName)
          .select('*')
          .limit(1);
          
        diagnosticResults.tables.specific[tableName] = {
          exists: !error,
          error: error ? error.message : null
        };
      } catch (e) {
        diagnosticResults.tables.specific[tableName] = {
          exists: false,
          error: e instanceof Error ? e.message : String(e)
        };
      }
    }

    // Test write permissions if authenticated
    if (diagnosticResults.auth.userId) {
      try {
        // Try to write to profiles
        const { error: profilesWriteError } = await clientRoute
          .from('profiles')
          .upsert({
            id: diagnosticResults.auth.userId,
            display_name: 'Test User',
            updated_at: new Date().toISOString()
          });
        
        diagnosticResults.testWrites.profiles = !profilesWriteError;
        diagnosticResults.testWrites.profilesError = profilesWriteError ? profilesWriteError.message : null;
      } catch (e) {
        diagnosticResults.testWrites.profilesError = e instanceof Error ? e.message : String(e);
      }
      
      // Check if we can create a session entry
      if (diagnosticResults.tables.specific['user_sessions']?.exists) {
        try {
          const { error: sessionsWriteError } = await clientRoute
            .from('user_sessions')
            .insert({
              user_id: diagnosticResults.auth.userId,
              thread_id: 'test-thread',
              stitch_id: 'test-stitch',
              duration: 10,
              total_points: 10,
              correct_answers: 10,
              total_questions: 10,
              timestamp: new Date().toISOString()
            })
            .select()
            .single();
            
          diagnosticResults.testWrites.user_sessions = !sessionsWriteError;
          diagnosticResults.testWrites.sessionsError = sessionsWriteError ? sessionsWriteError.message : null;
        } catch (e) {
          diagnosticResults.testWrites.sessionsError = e instanceof Error ? e.message : String(e);
        }
      }
      
      // Try session_results as alternative
      if (diagnosticResults.tables.specific['session_results']?.exists) {
        try {
          const { error: resultsWriteError } = await clientRoute
            .from('session_results')
            .insert({
              user_id: diagnosticResults.auth.userId,
              thread_id: 'test-thread',
              stitch_id: 'test-stitch',
              score: 10,
              total_questions: 10,
              timestamp: new Date().toISOString()
            })
            .select()
            .single();
            
          diagnosticResults.testWrites.session_results = !resultsWriteError;
          diagnosticResults.testWrites.resultsError = resultsWriteError ? resultsWriteError.message : null;
        } catch (e) {
          diagnosticResults.testWrites.resultsError = e instanceof Error ? e.message : String(e);
        }
      }
    }

    // Return diagnostic results
    return res.status(200).json(diagnosticResults);
  } catch (error) {
    console.error('Error in DB diagnostic API:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      diagnosticResults 
    });
  }
}