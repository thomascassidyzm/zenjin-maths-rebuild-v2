-- Complete Database Reset (Preserving Auth Users)
-- This script performs a complete reset of the application schema while preserving auth users

-- Step 1: Drop all existing application tables
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS session_results CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS user_stitch_progress CASCADE;
DROP TABLE IF EXISTS user_tube_position CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS stitches CASCADE;
DROP TABLE IF EXISTS threads CASCADE;

-- Step 2: Create tables with proper schema
-- Threads table (main content organization)
CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    tube_number INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Stitches table (learning content units)
CREATE TABLE IF NOT EXISTS stitches (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES threads(id),
    title TEXT,
    content TEXT,
    "order" INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    stitch_id TEXT NOT NULL REFERENCES stitches(id),
    text TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    distractors JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User progress for stitches
CREATE TABLE IF NOT EXISTS user_stitch_progress (
    user_id UUID NOT NULL,
    stitch_id TEXT NOT NULL REFERENCES stitches(id),
    thread_id TEXT NOT NULL REFERENCES threads(id),
    order_number INTEGER DEFAULT 0,
    skip_number INTEGER DEFAULT 3,
    distractor_level TEXT DEFAULT 'L1',
    completed BOOLEAN DEFAULT FALSE,
    started BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (user_id, stitch_id, thread_id)
);

-- Current user tube position
CREATE TABLE IF NOT EXISTS user_tube_position (
    user_id UUID PRIMARY KEY,
    tube_number INTEGER NOT NULL DEFAULT 1,
    thread_id TEXT NOT NULL REFERENCES threads(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User session records (learning sessions)
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT UNIQUE,
    user_id UUID NOT NULL,
    thread_id TEXT NOT NULL REFERENCES threads(id),
    stitch_id TEXT NOT NULL REFERENCES stitches(id),
    score INTEGER,
    total_questions INTEGER,
    points INTEGER DEFAULT 0,
    duration INTEGER, -- in seconds
    accuracy FLOAT,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Detailed session results (alternative format)
CREATE TABLE IF NOT EXISTS session_results (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    thread_id TEXT NOT NULL REFERENCES threads(id),
    stitch_id TEXT NOT NULL REFERENCES stitches(id),
    results JSONB DEFAULT '[]'::jsonb,
    total_points INTEGER DEFAULT 0,
    accuracy FLOAT,
    duration INTEGER, -- in seconds
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Legacy sessions table for backward compatibility 
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT UNIQUE,
    user_id UUID NOT NULL,
    thread_id TEXT NOT NULL REFERENCES threads(id),
    stitch_id TEXT NOT NULL REFERENCES stitches(id),
    score INTEGER,
    total_questions INTEGER,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 3: Create anonymous user ID function
CREATE OR REPLACE FUNCTION anonymous_user_id() 
RETURNS UUID AS $$
BEGIN
    RETURN '00000000-0000-0000-0000-000000000000'::UUID;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 4: Create helper functions
-- Function to safely upsert user stitch progress
CREATE OR REPLACE FUNCTION upsert_user_stitch_progress(
    p_user_id UUID,
    p_thread_id TEXT,
    p_stitch_id TEXT,
    p_order_number INTEGER
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_stitch_progress (user_id, thread_id, stitch_id, order_number)
    VALUES (p_user_id, p_thread_id, p_stitch_id, p_order_number)
    ON CONFLICT (user_id, stitch_id, thread_id) 
    DO UPDATE SET order_number = p_order_number, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Anon to authenticated user data transfer function
CREATE OR REPLACE FUNCTION transfer_anonymous_data(
    p_anon_user TEXT,
    p_auth_user UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_success BOOLEAN := FALSE;
    v_anon_uuid UUID;
BEGIN
    -- Handle anonymous user ID
    IF p_anon_user = 'anonymous' THEN
        v_anon_uuid := anonymous_user_id();
    ELSIF p_anon_user LIKE 'diag-%' THEN
        -- For diagnostic IDs, use as-is in string form for comparisons
        -- First try to copy from diagnostic user string ID
        
        -- Transfer stitch progress
        INSERT INTO user_stitch_progress (
            user_id, thread_id, stitch_id, order_number, skip_number, 
            distractor_level, completed, started, created_at, updated_at
        )
        SELECT 
            p_auth_user, thread_id, stitch_id, order_number, skip_number,
            distractor_level, completed, started, created_at, now()
        FROM 
            user_stitch_progress
        WHERE 
            user_id::text LIKE 'diag-%'
        ON CONFLICT (user_id, stitch_id, thread_id) 
        DO UPDATE SET 
            order_number = EXCLUDED.order_number,
            skip_number = EXCLUDED.skip_number,
            distractor_level = EXCLUDED.distractor_level,
            completed = EXCLUDED.completed,
            updated_at = now();
            
        -- Transfer tube position
        INSERT INTO user_tube_position (
            user_id, tube_number, thread_id, created_at, updated_at
        )
        SELECT 
            p_auth_user, tube_number, thread_id, created_at, now()
        FROM 
            user_tube_position
        WHERE 
            user_id::text LIKE 'diag-%'
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            tube_number = EXCLUDED.tube_number,
            thread_id = EXCLUDED.thread_id,
            updated_at = now();
        
        -- Transfer session records
        INSERT INTO user_sessions (
            session_id, user_id, thread_id, stitch_id, score, 
            total_questions, points, duration, accuracy, completed_at
        )
        SELECT 
            session_id, p_auth_user, thread_id, stitch_id, score,
            total_questions, points, duration, accuracy, completed_at
        FROM 
            user_sessions
        WHERE 
            user_id::text LIKE 'diag-%';
            
        v_success := TRUE;
        RETURN v_success;
    ELSE
        -- Try to convert to UUID if possible
        BEGIN
            v_anon_uuid := p_anon_user::UUID;
        EXCEPTION WHEN OTHERS THEN
            -- If conversion fails, return an error
            RETURN FALSE;
        END;
    END IF;

    -- Transfer stitch progress
    INSERT INTO user_stitch_progress (
        user_id, thread_id, stitch_id, order_number, skip_number, 
        distractor_level, completed, started, created_at, updated_at
    )
    SELECT 
        p_auth_user, thread_id, stitch_id, order_number, skip_number,
        distractor_level, completed, started, created_at, now()
    FROM 
        user_stitch_progress
    WHERE 
        user_id = v_anon_uuid
    ON CONFLICT (user_id, stitch_id, thread_id) 
    DO UPDATE SET 
        order_number = EXCLUDED.order_number,
        skip_number = EXCLUDED.skip_number,
        distractor_level = EXCLUDED.distractor_level,
        completed = EXCLUDED.completed,
        updated_at = now();
        
    -- Transfer tube position
    INSERT INTO user_tube_position (
        user_id, tube_number, thread_id, created_at, updated_at
    )
    SELECT 
        p_auth_user, tube_number, thread_id, created_at, now()
    FROM 
        user_tube_position
    WHERE 
        user_id = v_anon_uuid
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        tube_number = EXCLUDED.tube_number,
        thread_id = EXCLUDED.thread_id,
        updated_at = now();
    
    -- Transfer session records
    INSERT INTO user_sessions (
        session_id, user_id, thread_id, stitch_id, score, 
        total_questions, points, duration, accuracy, completed_at
    )
    SELECT 
        session_id, p_auth_user, thread_id, stitch_id, score,
        total_questions, points, duration, accuracy, completed_at
    FROM 
        user_sessions
    WHERE 
        user_id = v_anon_uuid;
    
    v_success := TRUE;
    RETURN v_success;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Set up RLS policies
-- Enable RLS on all tables
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE stitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stitch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tube_position ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Content tables are readable by everyone
CREATE POLICY thread_read_policy ON threads
    FOR SELECT USING (true);

CREATE POLICY stitch_read_policy ON stitches
    FOR SELECT USING (true);

CREATE POLICY question_read_policy ON questions
    FOR SELECT USING (true);

-- User progress policies with text casting
CREATE POLICY progress_read_policy ON user_stitch_progress
    FOR SELECT
    TO authenticated, anon
    USING (
        (SELECT auth.uid())::text = user_id::text OR 
        user_id::text = anonymous_user_id()::text OR 
        user_id::text LIKE 'diag-%'
    );

CREATE POLICY progress_insert_policy ON user_stitch_progress
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (
        (SELECT auth.uid())::text = user_id::text OR 
        user_id::text = anonymous_user_id()::text OR 
        user_id::text LIKE 'diag-%'
    );

CREATE POLICY progress_update_policy ON user_stitch_progress
    FOR UPDATE
    TO authenticated, anon
    USING (
        (SELECT auth.uid())::text = user_id::text OR 
        user_id::text = anonymous_user_id()::text OR 
        user_id::text LIKE 'diag-%'
    );

-- User tube position policies
CREATE POLICY position_read_policy ON user_tube_position
    FOR SELECT
    TO authenticated, anon
    USING (
        (SELECT auth.uid())::text = user_id::text OR 
        user_id::text = anonymous_user_id()::text OR 
        user_id::text LIKE 'diag-%'
    );

CREATE POLICY position_insert_policy ON user_tube_position
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (
        (SELECT auth.uid())::text = user_id::text OR 
        user_id::text = anonymous_user_id()::text OR 
        user_id::text LIKE 'diag-%'
    );

CREATE POLICY position_update_policy ON user_tube_position
    FOR UPDATE
    TO authenticated, anon
    USING (
        (SELECT auth.uid())::text = user_id::text OR 
        user_id::text = anonymous_user_id()::text OR 
        user_id::text LIKE 'diag-%'
    );

-- Session policies
CREATE POLICY sessions_read_policy ON user_sessions
    FOR SELECT
    TO authenticated, anon
    USING (
        (SELECT auth.uid())::text = user_id::text OR 
        user_id::text = anonymous_user_id()::text OR 
        user_id::text LIKE 'diag-%'
    );

CREATE POLICY sessions_insert_policy ON user_sessions
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (
        (SELECT auth.uid())::text = user_id::text OR 
        user_id::text = anonymous_user_id()::text OR 
        user_id::text LIKE 'diag-%'
    );

-- Results policies
CREATE POLICY results_read_policy ON session_results
    FOR SELECT
    TO authenticated, anon
    USING (
        (SELECT auth.uid())::text = user_id::text OR 
        user_id::text = anonymous_user_id()::text OR 
        user_id::text LIKE 'diag-%'
    );

CREATE POLICY results_insert_policy ON session_results
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (
        (SELECT auth.uid())::text = user_id::text OR 
        user_id::text = anonymous_user_id()::text OR 
        user_id::text LIKE 'diag-%'
    );

-- Legacy sessions policies
CREATE POLICY legacy_read_policy ON sessions
    FOR SELECT
    TO authenticated, anon
    USING (
        (SELECT auth.uid())::text = user_id::text OR 
        user_id::text = anonymous_user_id()::text OR 
        user_id::text LIKE 'diag-%'
    );

CREATE POLICY legacy_insert_policy ON sessions
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (
        (SELECT auth.uid())::text = user_id::text OR 
        user_id::text = anonymous_user_id()::text OR 
        user_id::text LIKE 'diag-%'
    );

-- Step 6: Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE threads, stitches, questions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE user_stitch_progress, user_tube_position TO anon, authenticated;
GRANT SELECT, INSERT ON TABLE user_sessions, session_results, sessions TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_user_stitch_progress TO anon, authenticated;
GRANT EXECUTE ON FUNCTION transfer_anonymous_data TO anon, authenticated;
GRANT EXECUTE ON FUNCTION anonymous_user_id TO anon, authenticated;

-- Step 7: Insert essential content data
INSERT INTO threads (id, name, description, tube_number)
VALUES 
    ('thread-A', 'Counting & Number Recognition', 'Basic number concepts', 1),
    ('thread-B', 'Addition Strategies', 'Different ways to add numbers', 2),
    ('thread-C', 'Word Problems', 'Applying math to real situations', 3),
    ('thread-D', 'Applied Math', 'Using math in everyday contexts', 3),
    ('thread-E', 'Subtraction Concepts', 'Understanding subtraction', 2),
    ('thread-F', 'Number Patterns', 'Recognizing and continuing patterns', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO stitches (id, thread_id, title, content, "order")
VALUES 
    ('stitch-A-01', 'thread-A', 'Counting to 10', 'Learn to count from 1 to 10', 1),
    ('stitch-A-02', 'thread-A', 'Counting to 20', 'Learn to count from 11 to 20', 2),
    ('stitch-A-03', 'thread-A', 'Number Recognition', 'Identify numbers 1-10', 3),
    ('stitch-A-04', 'thread-A', 'Number Recognition Advanced', 'Identify numbers 11-20', 4),
    ('stitch-A-05', 'thread-A', 'Number Sequencing', 'Put numbers in order', 5),
    ('stitch-B-01', 'thread-B', 'Adding Within 5', 'Simple addition with small numbers', 1),
    ('stitch-B-02', 'thread-B', 'Adding Within 10', 'Addition with sums up to 10', 2),
    ('stitch-B-03', 'thread-B', 'Adding Within 20', 'Addition with sums up to 20', 3),
    ('stitch-B-04', 'thread-B', 'Adding Strategies', 'Different methods to add numbers', 4),
    ('stitch-B-05', 'thread-B', 'Adding Three Numbers', 'Add multiple numbers together', 5),
    ('stitch-C-01', 'thread-C', 'Simple Word Problems', 'Basic addition story problems', 1),
    ('stitch-C-02', 'thread-C', 'Word Problems with Subtraction', 'Basic subtraction story problems', 2),
    ('stitch-C-03', 'thread-C', 'Mixed Word Problems', 'Combined addition and subtraction problems', 3),
    ('stitch-D-01', 'thread-D', 'Money Problems', 'Math with dollars and cents', 1),
    ('stitch-D-02', 'thread-D', 'Time Problems', 'Working with time concepts', 2),
    ('stitch-E-01', 'thread-E', 'Subtracting Within 5', 'Simple subtraction with small numbers', 1),
    ('stitch-E-02', 'thread-E', 'Subtracting Within 10', 'Subtraction with numbers up to 10', 2),
    ('stitch-E-03', 'thread-E', 'Subtracting Within 20', 'Subtraction with numbers up to 20', 3),
    ('stitch-F-01', 'thread-F', 'Counting by 2s', 'Skip counting by 2s', 1),
    ('stitch-F-02', 'thread-F', 'Counting by 5s', 'Skip counting by 5s', 2),
    ('stitch-F-03', 'thread-F', 'Counting by 10s', 'Skip counting by 10s', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO questions (id, stitch_id, text, correct_answer, distractors)
VALUES 
    ('q-a01-1', 'stitch-A-01', 'How many apples: 🍎🍎🍎?', '3', '{"L1":"2", "L2":"4", "L3":"5"}'),
    ('q-a01-2', 'stitch-A-01', 'How many stars: ⭐⭐⭐⭐?', '4', '{"L1":"3", "L2":"5", "L3":"6"}'),
    ('q-a01-3', 'stitch-A-01', 'Count the dots: •••••', '5', '{"L1":"4", "L2":"6", "L3":"7"}'),
    ('q-a01-4', 'stitch-A-01', 'How many fingers: 👐?', '10', '{"L1":"8", "L2":"9", "L3":"11"}'),
    ('q-b01-1', 'stitch-B-01', '1 + 2 = ?', '3', '{"L1":"2", "L2":"4", "L3":"5"}'),
    ('q-b01-2', 'stitch-B-01', '2 + 2 = ?', '4', '{"L1":"3", "L2":"5", "L3":"6"}'),
    ('q-b01-3', 'stitch-B-01', '3 + 1 = ?', '4', '{"L1":"3", "L2":"5", "L3":"2"}'),
    ('q-b01-4', 'stitch-B-01', '2 + 3 = ?', '5', '{"L1":"4", "L2":"6", "L3":"7"}'),
    ('q-c01-1', 'stitch-C-01', 'Tom has 3 apples and gets 2 more. How many does he have now?', '5', '{"L1":"4", "L2":"6", "L3":"3"}'),
    ('q-c01-2', 'stitch-C-01', 'There are 4 birds on a tree. 2 more birds join them. How many birds are on the tree now?', '6', '{"L1":"5", "L2":"7", "L3":"8"}')
ON CONFLICT (id) DO NOTHING;

-- Step 8: Initialize anonymous user data
INSERT INTO user_stitch_progress (user_id, thread_id, stitch_id, order_number, skip_number, distractor_level, completed, started)
VALUES 
    (anonymous_user_id(), 'thread-A', 'stitch-A-01', 0, 3, 'L1', false, true),
    (anonymous_user_id(), 'thread-B', 'stitch-B-01', 0, 3, 'L1', false, true),
    (anonymous_user_id(), 'thread-C', 'stitch-C-01', 0, 3, 'L1', false, true),
    (anonymous_user_id(), 'thread-D', 'stitch-D-01', 0, 3, 'L1', false, true)
ON CONFLICT (user_id, thread_id, stitch_id) DO NOTHING;

INSERT INTO user_tube_position (user_id, tube_number, thread_id)
VALUES (anonymous_user_id(), 1, 'thread-A')
ON CONFLICT (user_id) DO NOTHING;

-- Step 9: Initialize data for all existing authenticated users
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM auth.users
    LOOP
        -- Insert initial progress data for each authenticated user
        INSERT INTO user_stitch_progress (user_id, thread_id, stitch_id, order_number, skip_number, distractor_level, completed, started)
        VALUES 
            (user_record.id, 'thread-A', 'stitch-A-01', 0, 3, 'L1', false, true),
            (user_record.id, 'thread-B', 'stitch-B-01', 0, 3, 'L1', false, true),
            (user_record.id, 'thread-C', 'stitch-C-01', 0, 3, 'L1', false, true),
            (user_record.id, 'thread-D', 'stitch-D-01', 0, 3, 'L1', false, true)
        ON CONFLICT (user_id, thread_id, stitch_id) DO NOTHING;
        
        -- Insert initial tube position for each authenticated user
        INSERT INTO user_tube_position (user_id, tube_number, thread_id)
        VALUES (user_record.id, 1, 'thread-A')
        ON CONFLICT (user_id) DO NOTHING;
        
        -- Create a sample session for each user to ensure dashboard shows data
        INSERT INTO user_sessions (
            session_id, 
            user_id, 
            thread_id, 
            stitch_id, 
            score, 
            total_questions, 
            points,
            duration,
            accuracy,
            completed_at
        )
        VALUES (
            'sample-session-' || user_record.id::text,
            user_record.id,
            'thread-A',
            'stitch-A-01',
            5,   -- score
            10,  -- total questions
            25,  -- points
            90,  -- duration in seconds
            50,  -- accuracy percentage
            now() -- completed now
        );
    END LOOP;
END $$;