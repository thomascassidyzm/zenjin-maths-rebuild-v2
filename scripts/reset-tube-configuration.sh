#!/bin/bash
set -e

echo "----------------------------------------"
echo "Reset Tube Configuration"
echo "----------------------------------------"
echo "This script resets tube configurations and user progress"
echo "to match the actual stitch content in the database."
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

# Check if a specific user ID was provided
if [ "$1" != "" ]; then
  echo "Will reset tube configuration for user ID: $1"
  export RESET_USER_ID="$1"
else
  echo "Will reset tube configuration for ALL users"
fi

echo "Running configuration reset..."
echo "----------------------------------------"

# Run the script
node scripts/reset-tube-configuration.js

# Show final instructions
echo "----------------------------------------"
echo "Done!"
echo ""
echo "Next steps:"
echo "1. Restart the application server if it's running"
echo "2. Log out and back in to see the reset tube configuration"
echo "----------------------------------------"