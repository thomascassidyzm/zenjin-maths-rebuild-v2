#!/bin/bash

# Get Supabase connection string from local environment variables
# This script should be run on your development machine where Supabase CLI is installed

echo "Applying SQL function for efficient user state storage..."

# This assumes you're using Supabase CLI for local development
# For production, you'd use the Supabase dashboard SQL editor or connect to the database directly
supabase sql < ./lib/sql/create_upsert_function.sql

echo "SQL function applied. Check for any errors above."