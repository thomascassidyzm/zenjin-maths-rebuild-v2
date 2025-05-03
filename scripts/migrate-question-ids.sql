-- Migration script for question IDs
BEGIN;

-- Create mapping table
CREATE TEMP TABLE question_id_mapping (
    old_id TEXT,
    new_id TEXT
);

-- Populate mapping table with correct transformations
INSERT INTO question_id_mapping (old_id, new_id)
SELECT 
    q.id AS old_id,
    CASE
        -- If already in new format, leave it alone
        WHEN q.id ~ 'stitch-T\d+-\d+-\d+-q\d+' THEN q.id
        
        -- For old format, extract just the question number and append to new stitch ID
        ELSE
            q.stitch_id || '-q' || REGEXP_REPLACE(q.id, '.*-q(\d+).*', '\1')
    END AS new_id
FROM questions q
WHERE 
    q.id LIKE 'stitch-A-%' OR 
    q.id LIKE 'stitch-B-%' OR 
    q.id LIKE 'stitch-C-%' OR 
    q.id LIKE 'stitch-D-%';

-- Find potential duplicates before updating
SELECT new_id, COUNT(*), array_agg(old_id)
FROM question_id_mapping 
GROUP BY new_id 
HAVING COUNT(*) > 1;

-- Find conflicts with existing IDs
SELECT m.old_id, m.new_id
FROM question_id_mapping m
JOIN questions q ON q.id = m.new_id
WHERE q.id != m.old_id;

-- Update only non-conflicting IDs
UPDATE questions 
SET id = m.new_id 
FROM question_id_mapping m 
WHERE 
    questions.id = m.old_id AND
    NOT EXISTS (
        SELECT 1 FROM questions 
        WHERE id = m.new_id AND id != m.old_id
    );

-- For any conflicts, add a suffix to make the ID unique
WITH conflict_ids AS (
    SELECT m.old_id, m.new_id
    FROM question_id_mapping m
    JOIN questions q ON q.id = m.new_id
    WHERE q.id != m.old_id
)
UPDATE questions
SET id = c.new_id || '-migrated'
FROM conflict_ids c
WHERE questions.id = c.old_id;

COMMIT;