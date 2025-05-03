#!/bin/bash
set -e

echo "----------------------------------------"
echo "User Initialization Fix"
echo "----------------------------------------"
echo "This script fixes issues with the app not finding content for new users."
echo "It will create necessary database tables and initialize test user data."
echo ""

# First, check if we already have the environment variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  # Read configuration - prompt for Supabase URL and key
  read -p "Enter your Supabase URL (e.g., https://xxxxxx.supabase.co): " SUPABASE_URL
  
  if [ -z "$SUPABASE_URL" ]; then
    echo "Supabase URL is required."
    exit 1
  fi
  
  read -p "Enter your Supabase service role key: " SUPABASE_SERVICE_KEY
  
  if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "Supabase service role key is required."
    exit 1
  fi
  
  # Set environment variables
  export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
  export SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_KEY"
fi

echo "Running user initialization fix..."
echo "----------------------------------------"

# Run the script
node scripts/fix-user-initialization.js

# Show final instructions
echo "----------------------------------------"
echo "Done!"
echo ""
echo "Next steps:"
echo "1. Restart the application server if it's running"
echo "2. Create a new user account in the app"
echo "3. You should now see content from the database instead of sample content"
echo "----------------------------------------"