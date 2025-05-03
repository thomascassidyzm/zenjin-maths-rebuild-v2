-- Manual fix for has_password column
-- Run this directly in the Supabase SQL editor to fix the issue

-- First check if the column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'has_password'
    ) THEN
        -- Column exists, make sure it allows NULL values
        ALTER TABLE profiles 
        ALTER COLUMN has_password DROP NOT NULL;
        
        RAISE NOTICE 'Modified has_password column to allow NULL values';
    ELSE
        -- Column doesn't exist, add it with NULL allowed
        ALTER TABLE profiles 
        ADD COLUMN has_password BOOLEAN DEFAULT false NULL;
        
        RAISE NOTICE 'Added has_password column to profiles table';
    END IF;
END $$;