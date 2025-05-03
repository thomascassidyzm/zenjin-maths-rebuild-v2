#!/bin/bash
# Run database migration to add has_password column

echo "Running migration to add has_password column to profiles table..."

# Get the ADMIN_API_KEY from .env file if it exists
if [ -f .env ]; then
  ADMIN_API_KEY=$(grep ADMIN_API_KEY .env | cut -d '=' -f2)
fi

# If ADMIN_API_KEY is not set in .env, use default
if [ -z "$ADMIN_API_KEY" ]; then
  ADMIN_API_KEY="admin-key-for-development-only"
  echo "Warning: Using default ADMIN_API_KEY"
fi

# Get the base URL
if [ -z "$BASE_URL" ]; then
  BASE_URL="http://localhost:3000"
  echo "Using default base URL: $BASE_URL"
fi

# Run the migration
curl -X POST \
  -H "Content-Type: application/json" \
  -H "x-admin-key: $ADMIN_API_KEY" \
  -d '{}' \
  $BASE_URL/api/migrations/alter-profiles-table

echo -e "\nMigration complete!"