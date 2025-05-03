SELECT id, stitch_id 
FROM questions 
WHERE id LIKE 'stitch-A-%' OR id LIKE 'stitch-B-%' OR 
      id LIKE 'stitch-C-%' OR id LIKE 'stitch-D-%' 
LIMIT 20;

SELECT 
    CASE 
        WHEN id LIKE 'stitch-A-%' THEN 'stitch-A pattern'
        WHEN id LIKE 'stitch-B-%' THEN 'stitch-B pattern'
        WHEN id LIKE 'stitch-C-%' THEN 'stitch-C pattern'
        WHEN id LIKE 'stitch-D-%' THEN 'stitch-D pattern'
        WHEN id LIKE 'stitch-T1-%' THEN 'stitch-T1 pattern'
        WHEN id LIKE 'stitch-T2-%' THEN 'stitch-T2 pattern'
        WHEN id LIKE 'stitch-T3-%' THEN 'stitch-T3 pattern'
        ELSE 'Other pattern'
    END AS pattern,
    COUNT(*) 
FROM questions 
GROUP BY pattern 
ORDER BY pattern;

SELECT id, stitch_id 
FROM questions 
WHERE stitch_id LIKE 'stitch-T%' 
AND (id LIKE 'stitch-A-%' OR id LIKE 'stitch-B-%' OR 
     id LIKE 'stitch-C-%' OR id LIKE 'stitch-D-%')
LIMIT 20;

WITH new_ids AS (
    SELECT 
        id AS old_id,
        CASE
            WHEN id ~ 'stitch-T\d+-\d+-\d+-q\d+' THEN id
            ELSE
                stitch_id || '-q' || REGEXP_REPLACE(id, '.*-q(\d+).*', '\1')
        END AS new_id
    FROM questions
    WHERE id LIKE 'stitch-A-%' OR id LIKE 'stitch-B-%' OR 
          id LIKE 'stitch-C-%' OR id LIKE 'stitch-D-%'
)
SELECT new_id, COUNT(*) 
FROM new_ids 
GROUP BY new_id 
HAVING COUNT(*) > 1
ORDER BY new_id;