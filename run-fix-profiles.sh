#!/bin/bash
# Run migration to fix has_password column in profiles table

echo "Running migration to fix has_password column..."

# Use curl to call the migration API
curl -X POST http://localhost:3000/api/migrations/fix-has-password

echo ""
echo "Migration complete. Check the logs for details."