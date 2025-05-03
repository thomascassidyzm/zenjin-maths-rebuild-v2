-- Rename Stitches SQL Script
-- Updates stitch IDs to match the new thread naming convention
-- Must be run after threads have been renamed to the new format

-- Start transaction
BEGIN;

-- Create temporary mapping table
CREATE TEMP TABLE stitch_id_mapping (
    old_id TEXT,
    new_id TEXT
);

-- Populate the mapping table with the new IDs
-- Format: stitch-T{tube_number}-{thread_order}-{stitch_order}
INSERT INTO stitch_id_mapping (old_id, new_id)
SELECT 
    s.id AS old_id,
    CASE
        -- Extract thread details from the thread ID
        WHEN t.id ~ 'thread-T(\d+)-(\d+)' THEN
            -- Extract tube number and thread order from thread ID
            'stitch-T' || 
            REGEXP_REPLACE(t.id, 'thread-T(\d+)-(\d+)', '\1') || '-' ||
            REGEXP_REPLACE(t.id, 'thread-T(\d+)-(\d+)', '\2') || '-' ||
            -- Extract the original stitch number if it exists
            COALESCE(
                REGEXP_REPLACE(s.id, '.*-(\d+)$', '\1'),
                -- If no number pattern, use the stitch order 
                LPAD(s.order::TEXT, 2, '0')
            )
        -- Fallback for old format (thread-A, thread-B, etc.)
        ELSE
            -- Map old thread letters to tube numbers
            CASE
                WHEN t.id = 'thread-A' THEN 'stitch-T1-001-'
                WHEN t.id = 'thread-B' THEN 'stitch-T2-001-'
                WHEN t.id = 'thread-C' THEN 'stitch-T3-001-'
                WHEN t.id = 'thread-D' THEN 'stitch-T3-002-'
                WHEN t.id = 'thread-E' THEN 'stitch-T2-002-'
                WHEN t.id = 'thread-F' THEN 'stitch-T1-002-'
                ELSE 'stitch-unknown-'
            END ||
            -- Extract the original stitch number if it exists
            COALESCE(
                REGEXP_REPLACE(s.id, '.*-(\d+)$', '\1'),
                -- If no number pattern, use the stitch order 
                LPAD(s.order::TEXT, 2, '0')
            )
    END AS new_id
FROM 
    stitches s
JOIN 
    threads t ON s.thread_id = t.id
ORDER BY 
    t.id, s.order;

-- Check the mapping (commented out for production)
-- SELECT * FROM stitch_id_mapping ORDER BY old_id;

-- Disable triggers for foreign key constraints
SET session_replication_role = 'replica';

-- Update references in the questions table first
UPDATE 
    questions q
SET 
    stitch_id = m.new_id
FROM 
    stitch_id_mapping m
WHERE 
    q.stitch_id = m.old_id;

-- Update references in user_stitch_progress
UPDATE 
    user_stitch_progress usp
SET 
    stitch_id = m.new_id
FROM 
    stitch_id_mapping m
WHERE 
    usp.stitch_id = m.old_id;

-- Finally, update the stitches table itself
UPDATE 
    stitches s
SET 
    id = m.new_id
FROM 
    stitch_id_mapping m
WHERE 
    s.id = m.old_id;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Commit the transaction
COMMIT;

-- Verify the changes (commented out for production)
-- SELECT id FROM stitches ORDER BY id;
-- SELECT stitch_id FROM questions ORDER BY stitch_id;
-- SELECT DISTINCT stitch_id FROM user_stitch_progress ORDER BY stitch_id;