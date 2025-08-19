#!/bin/bash

# Apply Qwen Migration Script
# This script applies the Qwen provider migration to your Supabase database

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Applying Qwen Provider Migration...${NC}"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Error: .env file not found. Please run this script from the Archon root directory.${NC}"
    exit 1
fi

# Load environment variables
source .env

# Check if required variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo -e "${RED}❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file${NC}"
    exit 1
fi

echo -e "${BLUE}📊 Using Supabase URL: $SUPABASE_URL${NC}"

# Apply the migration using curl and Supabase REST API
echo -e "${BLUE}📝 Applying migration...${NC}"

# Read the migration file
MIGRATION_SQL=$(cat migration/add_qwen_support.sql)

# Apply migration via Supabase API
curl -X POST "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -d "{\"sql\": \"$(echo "$MIGRATION_SQL" | sed 's/"/\\"/g' | tr '\n' ' ')\"}" \
  --fail --silent --show-error

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migration applied successfully!${NC}"
    echo -e "${BLUE}🔍 Verifying migration...${NC}"
    
    # Verify migration by checking for Qwen settings
    VERIFY_SQL="SELECT COUNT(*) as qwen_settings_count FROM archon_settings WHERE key LIKE 'QWEN_%';"
    
    RESULT=$(curl -X POST "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
      -H "Content-Type: application/json" \
      -H "apikey: $SUPABASE_SERVICE_KEY" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
      -d "{\"sql\": \"$VERIFY_SQL\"}" \
      --fail --silent)
    
    echo -e "${GREEN}✅ Migration verification complete!${NC}"
    echo -e "${BLUE}📋 Next steps:${NC}"
    echo -e "  1. Restart Archon services: ${GREEN}docker compose restart${NC}"
    echo -e "  2. Open Archon UI: ${GREEN}http://localhost:3737${NC}"
    echo -e "  3. Go to Settings → RAG Settings"
    echo -e "  4. Select 'Qwen' as your provider"
    echo -e "  5. Set model to 'qwen3-coder-plus'"
    echo -e "  6. Configure your OAuth credentials"
else
    echo -e "${RED}❌ Migration failed. Please check your Supabase connection and try again.${NC}"
    echo -e "${BLUE}💡 Alternative: Apply manually via Supabase SQL Editor${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Qwen provider is now available in Archon!${NC}"
