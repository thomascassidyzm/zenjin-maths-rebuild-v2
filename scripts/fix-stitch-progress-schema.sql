BEGIN;

-- First check if the user_stitch_progress table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_stitch_progress'
    ) THEN
        CREATE TABLE public.user_stitch_progress (
            user_id TEXT NOT NULL,
            thread_id TEXT NOT NULL,
            stitch_id TEXT NOT NULL,
            order_number INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (user_id, thread_id, stitch_id)
        );
    END IF;
END
$$;

-- Add the skip_number column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_stitch_progress' 
        AND column_name = 'skip_number'
    ) THEN
        ALTER TABLE public.user_stitch_progress ADD COLUMN skip_number INTEGER NOT NULL DEFAULT 3;
    END IF;
END
$$;

-- Add the distractor_level column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_stitch_progress' 
        AND column_name = 'distractor_level'
    ) THEN
        ALTER TABLE public.user_stitch_progress ADD COLUMN distractor_level TEXT NOT NULL DEFAULT 'L1';
    END IF;
END
$$;

-- Add the updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_stitch_progress' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.user_stitch_progress ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END
$$;

-- Add the is_current_tube column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_stitch_progress' 
        AND column_name = 'is_current_tube'
    ) THEN
        ALTER TABLE public.user_stitch_progress ADD COLUMN is_current_tube BOOLEAN DEFAULT FALSE;
    END IF;
END
$$;

-- Create an index on user_id for faster lookups
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'user_stitch_progress' 
        AND indexname = 'idx_user_stitch_progress_user_id'
    ) THEN
        CREATE INDEX idx_user_stitch_progress_user_id ON public.user_stitch_progress(user_id);
    END IF;
END
$$;

-- Create an index on updated_at for faster ordering
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'user_stitch_progress' 
        AND indexname = 'idx_user_stitch_progress_updated_at'
    ) THEN
        CREATE INDEX idx_user_stitch_progress_updated_at ON public.user_stitch_progress(updated_at);
    END IF;
END
$$;

COMMIT;