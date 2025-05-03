-- This script should be run AFTER the main setup-database.sql
-- It grants necessary permissions to anonymous and authenticated users
-- and enables multi-tenancy for proper RLS functionality

-- Grant permissions for basic operations
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Grant table-specific permissions to anonymous users
GRANT SELECT ON TABLE threads, stitches, questions TO anon;
GRANT SELECT, INSERT, UPDATE ON TABLE user_stitch_progress, user_tube_position TO anon;
GRANT SELECT, INSERT ON TABLE user_sessions, session_results, sessions TO anon;

-- Grant table-specific permissions to authenticated users
GRANT SELECT ON TABLE threads, stitches, questions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE user_stitch_progress, user_tube_position TO authenticated;
GRANT SELECT, INSERT ON TABLE user_sessions, session_results, sessions TO authenticated;

-- Allow anon and authenticated roles to use the sequence for serial columns
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Additional permissions for functions
GRANT EXECUTE ON FUNCTION upsert_user_stitch_progress TO anon, authenticated;
GRANT EXECUTE ON FUNCTION transfer_anonymous_data TO anon, authenticated;

-- The following superuser commands have been removed for better compatibility with Supabase:
-- ALTER DATABASE postgres SET "app.settings.jwt_secret" TO 'your-jwt-secret';
-- ALTER DATABASE postgres SET "app.settings.enableMultitenancy" TO true;
-- Supabase automatically handles JWT settings and multitenancy

-- Enable RLS on tables to enforce policies
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE stitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stitch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tube_position ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;