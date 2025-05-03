#!/bin/bash
# Script to fix stitch position conflicts and add database uniqueness constraint

# Get directory of the script
SCRIPT_DIR=$(dirname "$0")
PROJECT_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

# Database configuration - load from .env if possible
if [ -f "$PROJECT_ROOT/.env" ]; then
  echo "Loading database configuration from .env file..."
  source "$PROJECT_ROOT/.env"
fi

# Default Supabase credentials if not found in .env
SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-"https://ggwoupzaruiaaliylxga.supabase.co"}
SUPABASE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdnd291cHphcnVpYWFsaXlseGdhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTkxNzM0MCwiZXhwIjoyMDU3NDkzMzQwfQ.3bvfZGkTc9nVtf1I7A0TwYy9pMFudJTrp974RZIwrq0"}

# Check if psql is installed
if ! command -v psql &> /dev/null; then
  echo "Error: psql is required but not installed. Please install PostgreSQL client tools."
  exit 1
fi

# Migration SQL file path
MIGRATION_FILE="$PROJECT_ROOT/db/migrations/unique-stitch-positions.sql"

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
  echo "Error: Migration file not found at $MIGRATION_FILE"
  exit 1
fi

echo "Running migration to fix stitch position conflicts and enforce uniqueness..."

# Create temporary SQL file with connection details
TMP_SQL=$(mktemp)
cat > "$TMP_SQL" << EOF
\connect postgres://postgres:${SUPABASE_KEY}@${SUPABASE_URL}:5432/postgres
\i ${MIGRATION_FILE}
EOF

# Run the migration
psql -f "$TMP_SQL"
RESULT=$?

# Clean up temporary file
rm "$TMP_SQL"

if [ $RESULT -eq 0 ]; then
  echo "Migration completed successfully!"
  echo ""
  echo "The system now enforces unique stitch positions within each thread."
  echo "Any existing conflicts have been automatically resolved by reassigning positions."
  echo ""
  echo "To verify the changes, you can check:"
  echo "1. The user_stitch_progress table for unique order_number values per thread"
  echo "2. The new unique_stitch_position index in the database"
else
  echo "Migration failed with error code $RESULT"
  echo "Please check the error messages above and try again."
fi

exit $RESULT