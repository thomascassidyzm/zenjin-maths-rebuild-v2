-- Export first 10 stitches for each tube directly as JSON
WITH tube_threads AS (
  -- Get the first thread for each tube
  SELECT 
    t.id, 
    t.tube_number,
    t.title
  FROM threads t
  WHERE t.tube_number IN (1, 2, 3)
  ORDER BY t.tube_number, t.id
),
thread_stitches AS (
  -- Get the first 10 stitches for each thread, ordered by position
  SELECT 
    s.*,
    tt.tube_number,
    ROW_NUMBER() OVER (PARTITION BY s.thread_id ORDER BY s.order) as rn
  FROM stitches s
  JOIN tube_threads tt ON s.thread_id = tt.id
  ORDER BY tt.tube_number, s.thread_id, s.order
),
stitch_questions AS (
  -- Get questions for each stitch
  SELECT 
    q.*,
    ts.id as stitch_id,
    ts.tube_number
  FROM questions q
  JOIN thread_stitches ts ON q.stitch_id = ts.id
  WHERE ts.rn <= 10  -- Only include questions for the first 10 stitches
),
-- Format stitches with their questions as JSON
stitch_json AS (
  SELECT
    ts.id,
    ts.thread_id,
    ts.title,
    ts.content,
    ts.order,
    ts.tube_number,
    json_agg(
      json_build_object(
        'id', sq.id,
        'text', sq.text,
        'correctAnswer', sq.correct_answer,
        'distractors', json_build_object(
          'L1', sq.distractors->>'L1',
          'L2', sq.distractors->>'L2',
          'L3', sq.distractors->>'L3'
        )
      )
    ) as questions
  FROM thread_stitches ts
  LEFT JOIN stitch_questions sq ON ts.id = sq.stitch_id
  WHERE ts.rn <= 10  -- Only include the first 10 stitches
  GROUP BY ts.id, ts.thread_id, ts.title, ts.content, ts.order, ts.tube_number
),
-- Build the bundled content structure
bundled_content AS (
  SELECT
    json_object_agg(
      sj.id,
      json_build_object(
        'id', sj.id,
        'threadId', sj.thread_id,
        'title', sj.title,
        'content', sj.content,
        'order', sj.order,
        'questions', sj.questions
      )
    ) as bundled_content
  FROM stitch_json sj
),
-- Build the manifest structure
manifest_tubes AS (
  SELECT
    json_object_agg(
      tt.tube_number,
      json_build_object(
        'threads', json_object_agg(
          tt.id,
          json_build_object(
            'title', tt.title,
            'stitches', (
              SELECT json_agg(
                json_build_object(
                  'id', ts.id,
                  'order', ts.order,
                  'title', ts.title
                )
              )
              FROM thread_stitches ts
              WHERE ts.thread_id = tt.id AND ts.rn <= 10
              ORDER BY ts.order
            )
          )
        )
      )
    ) as tubes
  FROM tube_threads tt
  GROUP BY tt.tube_number
),
manifest AS (
  SELECT
    json_build_object(
      'version', 1,
      'generated', now(),
      'tubes', mt.tubes,
      'stats', json_build_object(
        'tubeCount', 3,
        'threadCount', (SELECT COUNT(*) FROM tube_threads),
        'stitchCount', (SELECT COUNT(*) FROM thread_stitches WHERE rn <= 10)
      )
    ) as manifest
  FROM manifest_tubes mt
)
-- Output the final TypeScript file content
SELECT
  '/**' || chr(10) ||
  ' * Expanded Bundled Content' || chr(10) ||
  ' * ' || chr(10) ||
  ' * This file contains the actual content for the first 10 stitches of each tube,' || chr(10) ||
  ' * exported directly from the database. This allows the app to function entirely' || chr(10) ||
  ' * offline with a complete learning experience.' || chr(10) ||
  ' * ' || chr(10) ||
  ' * Generated on: ' || to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || chr(10) ||
  ' */' || chr(10) ||
  '' || chr(10) ||
  'import { StitchContent } from ''./client/content-buffer'';' || chr(10) ||
  '' || chr(10) ||
  '/**' || chr(10) ||
  ' * Complete set of basic stitches for each tube (10 per tube × 3 tubes = 30 total)' || chr(10) ||
  ' * These stitches are bundled with the app for immediate use without any API calls' || chr(10) ||
  ' */' || chr(10) ||
  'export const BUNDLED_FULL_CONTENT: Record<string, StitchContent> = ' || 
  bc.bundled_content::text || ';' || chr(10) ||
  '' || chr(10) ||
  '/**' || chr(10) ||
  ' * Default manifest structure' || chr(10) ||
  ' * This provides the basic structure for the first 10 stitches of each tube' || chr(10) ||
  ' */' || chr(10) ||
  'export const DEFAULT_MANIFEST = ' || m.manifest::text || ';'
FROM bundled_content bc, manifest m;