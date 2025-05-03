# Stitch Renaming Convention

This document explains the new naming convention for stitches in the Zenjin Maths application, which aligns with the thread naming convention.

## Overview

Just as threads have been renamed to follow the format `thread-T{tube_number}-{thread_order}`, stitches should follow a similar pattern:

```
stitch-T{tube_number}-{thread_order}-{stitch_order}
```

For example:
- `stitch-T1-001-01` (First stitch in thread-T1-001, which is in Tube 1)
- `stitch-T1-001-02` (Second stitch in thread-T1-001)
- `stitch-T2-001-01` (First stitch in thread-T2-001, which is in Tube 2)

## Why Rename Stitches?

1. **Consistency**: Maintain a consistent naming pattern across all content types.
2. **Hierarchy**: Make the tube and thread hierarchy explicit in the stitch ID.
3. **Sorting**: Ensure stitches sort correctly by their numeric order.
4. **Traceability**: Make it easier to track which tube and thread a stitch belongs to.

## Implementation

The stitch renaming has been implemented using an SQL script that:

1. Creates a mapping between old stitch IDs and new stitch IDs
2. Updates references in the questions table
3. Updates references in the user_stitch_progress table 
4. Finally updates the stitches table itself

## Code Impact

The existing codebase already includes functionality to handle the new naming pattern:

- In `reset-tube-configuration.js`, stitch sorting uses regex `/-(\d+)$/` which extracts the numeric suffix
- The StitchSequencer properly extracts thread information from thread IDs
- Components already use ID patterns that work with both naming conventions

## SQL Script for Renaming

A SQL script has been provided that:

```sql
-- Example SQL for stitch renaming (abbreviated)
BEGIN;

-- Create mapping table
CREATE TEMP TABLE stitch_id_mapping (
    old_id TEXT,
    new_id TEXT
);

-- Populate with new IDs
INSERT INTO stitch_id_mapping (old_id, new_id)
SELECT 
    s.id AS old_id,
    CASE
        -- For new thread format (thread-T1-001)
        WHEN t.id ~ 'thread-T(\d+)-(\d+)' THEN
            'stitch-T' || 
            REGEXP_REPLACE(t.id, 'thread-T(\d+)-(\d+)', '\1') || '-' ||
            REGEXP_REPLACE(t.id, 'thread-T(\d+)-(\d+)', '\2') || '-' ||
            COALESCE(
                REGEXP_REPLACE(s.id, '.*-(\d+)$', '\1'),
                LPAD(s.order::TEXT, 2, '0')
            )
        -- For old format (thread-A, thread-B, etc.)
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
            COALESCE(
                REGEXP_REPLACE(s.id, '.*-(\d+)$', '\1'),
                LPAD(s.order::TEXT, 2, '0')
            )
    END AS new_id
FROM stitches s
JOIN threads t ON s.thread_id = t.id;

-- Update references in other tables
UPDATE questions SET stitch_id = m.new_id FROM stitch_id_mapping m WHERE questions.stitch_id = m.old_id;
UPDATE user_stitch_progress SET stitch_id = m.new_id FROM stitch_id_mapping m WHERE user_stitch_progress.stitch_id = m.old_id;
UPDATE stitches SET id = m.new_id FROM stitch_id_mapping m WHERE stitches.id = m.old_id;

COMMIT;
```

## Compatibility

After reviewing the codebase, we have determined that:

1. The existing code in the player app will continue to work with the new naming convention
2. The pattern extraction in components like StitchSequencer extract suffixes correctly
3. The tube-configuration.js already handles both formats

## Conclusion

Renaming stitches to match the thread naming convention provides consistency and makes the hierarchy explicit. The existing code is already compatible with the new naming pattern, so no code changes are required beyond running the SQL script.