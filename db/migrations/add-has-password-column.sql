-- Migration to add has_password column to profiles table
-- This column is used to track whether a user has set a password
-- It's referenced by the email update functionality to determine if password verification is needed

-- Check if the column already exists before adding it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'has_password'
    ) THEN
        -- Add the has_password column with a default of false
        ALTER TABLE profiles 
        ADD COLUMN has_password BOOLEAN DEFAULT false;
        
        -- Set has_password to true for existing users who likely have passwords
        -- This assumes that most existing users have passwords set
        -- If this isn't the case, remove or modify this update
        UPDATE profiles 
        SET has_password = true 
        WHERE created_at < NOW() - INTERVAL '1 day';
        
        RAISE NOTICE 'Added has_password column to profiles table';
    ELSE
        RAISE NOTICE 'has_password column already exists in profiles table';
    END IF;
END $$;