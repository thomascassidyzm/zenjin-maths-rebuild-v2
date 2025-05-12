#!/bin/bash
# Test script for Zustand Content System
# This script helps verify the deployment of the Zustand content system

# Define colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get base URL from argument or use default
BASE_URL=${1:-"http://localhost:3000"}

echo -e "${BLUE}=== Zustand Content System Test Script ===${NC}"
echo -e "Testing deployment at: ${YELLOW}${BASE_URL}${NC}\n"

# Function to test a URL and display result
test_url() {
  local url="$1"
  local description="$2"
  
  echo -e "${YELLOW}Testing ${description}...${NC}"
  
  # Use curl to test if the URL is accessible
  response=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${url}")
  
  if [ "$response" == "200" ]; then
    echo -e "${GREEN}✓ Success: ${url} is accessible (HTTP ${response})${NC}"
    return 0
  else
    echo -e "${RED}✗ Failed: ${url} returned HTTP ${response}${NC}"
    return 1
  fi
}

# Test all Zustand-related pages
echo -e "${BLUE}Testing pages:${NC}"

# 1. Test basic stitch loading
test_url "/test-zustand-stitch" "Basic stitch loading page"
basic_test_result=$?

# 2. Test Zustand player
test_url "/test-zustand-player" "Zustand player test page"
player_test_result=$?

# 3. Test integrated player
test_url "/integrated-player" "Integrated player page"
integrated_test_result=$?

# 4. Test hybrid player
test_url "/hybrid-player" "Hybrid player page"
hybrid_test_result=$?

# 5. Test server sync
test_url "/test-server-sync" "Server sync test page"
server_sync_result=$?

echo -e "\n${BLUE}Test Summary:${NC}"
total_tests=5
passed_tests=$((5 - basic_test_result - player_test_result - integrated_test_result - hybrid_test_result - server_sync_result))

echo -e "Pages tested: ${total_tests}"
echo -e "Pages accessible: ${GREEN}${passed_tests}${NC}"
echo -e "Pages failed: ${RED}$((total_tests - passed_tests))${NC}"

if [ $passed_tests -eq $total_tests ]; then
  echo -e "\n${GREEN}All tests passed! The Zustand content system is working correctly.${NC}"
  echo -e "\nNext steps:"
  echo -e "1. Visit ${YELLOW}${BASE_URL}/test-zustand-stitch${NC} to verify stitch content loading"
  echo -e "2. Visit ${YELLOW}${BASE_URL}/hybrid-player${NC} to test the recommended hybrid implementation"
  echo -e "3. Visit ${YELLOW}${BASE_URL}/test-server-sync${NC} to verify server synchronization"
  exit 0
else
  echo -e "\n${RED}Some tests failed. Please check the deployment.${NC}"
  echo -e "\nTroubleshooting steps:"
  echo -e "1. Verify that all pages are included in the deployment"
  echo -e "2. Check server logs for any errors"
  echo -e "3. Ensure API endpoints are functioning correctly"
  exit 1
fi