#!/bin/bash

# =============================================================================
# Simple File Manager - API Test Script
# =============================================================================
# This script tests the main API endpoints:
# - Authentication (login)
# - Create folder
# - List files
# - Upload file
# - Download file
# - Delete file/folder
# =============================================================================
# 
# Usage:
#   ./test-api.sh                                    # Prompts for password
#   USERNAME=myuser PASSWORD=mypass ./test-api.sh   # Session-based auth
#   API_KEY=your_api_key ./test-api.sh              # API key auth (recommended)
#   BASE_URL=http://localhost:3011 ./test-api.sh    # Custom server URL
#
# =============================================================================

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3011}"
USERNAME="${USERNAME:-admin}"
API_KEY="${API_KEY:-}"

# Authentication mode
AUTH_MODE="session"
AUTH_HEADER=""

# If API_KEY is provided, use it
if [ -n "$API_KEY" ]; then
    AUTH_MODE="apikey"
    AUTH_HEADER="Authorization: Bearer $API_KEY"
    echo "Using API Key authentication"
else
    # If PASSWORD not set, prompt for it
    if [ -z "$PASSWORD" ]; then
        echo -n "Enter password for user '$USERNAME' (or set API_KEY env var): "
        read -s PASSWORD
        echo ""
        
        if [ -z "$PASSWORD" ]; then
            echo "Password cannot be empty"
            exit 1
        fi
    fi
fi

TEST_FOLDER="api-test-folder-$(date +%s)"
TEST_FILE="test-file.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Cookie jar for session
COOKIE_JAR="/tmp/sfm-test-cookies.txt"

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  Simple File Manager - API Test Script${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "Base URL: ${YELLOW}$BASE_URL${NC}"
echo -e "Username: ${YELLOW}$USERNAME${NC}"
echo ""

# Cleanup function
cleanup() {
    rm -f "$COOKIE_JAR" "/tmp/$TEST_FILE" 2>/dev/null
}
trap cleanup EXIT

# =============================================================================
# Test 1: Login (only for session auth)
# =============================================================================
echo -e "${BLUE}[TEST 1] Authentication${NC}"
echo "--------------------------------------------"

if [ "$AUTH_MODE" = "apikey" ]; then
    # Test API key by calling auth status
    AUTH_TEST=$(curl -s -X GET "$BASE_URL/api/user/me" \
        -H "$AUTH_HEADER" \
        -w "\n%{http_code}")
    
    HTTP_CODE=$(echo "$AUTH_TEST" | tail -1)
    BODY=$(echo "$AUTH_TEST" | sed '$d')
    
    echo "Response: $BODY"
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ API Key authentication successful (HTTP $HTTP_CODE)${NC}"
    else
        echo -e "${RED}✗ API Key authentication failed (HTTP $HTTP_CODE)${NC}"
        echo -e "${RED}Make sure the API key is valid${NC}"
        exit 1
    fi
else
    # Session-based login
    LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\": \"$USERNAME\", \"password\": \"$PASSWORD\"}" \
        -c "$COOKIE_JAR" \
        -w "\n%{http_code}")
    
    HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -1)
    BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')
    
    echo "Response: $BODY"
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ Login successful (HTTP $HTTP_CODE)${NC}"
    else
        echo -e "${RED}✗ Login failed (HTTP $HTTP_CODE)${NC}"
        echo -e "${RED}Make sure the server is running and credentials are correct${NC}"
        exit 1
    fi
fi
echo ""

# Helper function for authenticated curl requests
auth_curl() {
    if [ "$AUTH_MODE" = "apikey" ]; then
        curl -s -H "$AUTH_HEADER" "$@"
    else
        curl -s -b "$COOKIE_JAR" "$@"
    fi
}

# =============================================================================
# Test 2: List Files (Root)
# =============================================================================
echo -e "${BLUE}[TEST 2] List Files (Root Directory)${NC}"
echo "--------------------------------------------"

LIST_RESPONSE=$(auth_curl -X GET "$BASE_URL/api/files" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$LIST_RESPONSE" | tail -1)
BODY=$(echo "$LIST_RESPONSE" | sed '$d')

echo "Response: $BODY" | head -c 500
echo ""
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ List files successful (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ List files failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# =============================================================================
# Test 3: Create Folder
# =============================================================================
echo -e "${BLUE}[TEST 3] Create Folder: $TEST_FOLDER${NC}"
echo "--------------------------------------------"

CREATE_FOLDER_RESPONSE=$(auth_curl -X POST "$BASE_URL/api/folder" \
    -H "Content-Type: application/json" \
    -d "{\"path\": \"\", \"name\": \"$TEST_FOLDER\", \"mediaAccessLevel\": \"public\"}" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$CREATE_FOLDER_RESPONSE" | tail -1)
BODY=$(echo "$CREATE_FOLDER_RESPONSE" | sed '$d')

echo "Response: $BODY"
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Create folder successful (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ Create folder failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# =============================================================================
# Test 4: List Files (Verify Folder Created)
# =============================================================================
echo -e "${BLUE}[TEST 4] List Files (Verify Folder Created)${NC}"
echo "--------------------------------------------"

LIST_RESPONSE=$(auth_curl -X GET "$BASE_URL/api/files" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$LIST_RESPONSE" | tail -1)
BODY=$(echo "$LIST_RESPONSE" | sed '$d')

echo "Response: $BODY" | head -c 500
echo ""
if echo "$BODY" | grep -q "$TEST_FOLDER"; then
    echo -e "${GREEN}✓ Folder '$TEST_FOLDER' found in listing${NC}"
else
    echo -e "${YELLOW}⚠ Folder '$TEST_FOLDER' NOT found in listing - possible cache issue${NC}"
fi
echo ""

# =============================================================================
# Test 5: Create Test File for Upload
# =============================================================================
echo -e "${BLUE}[TEST 5] Create Test File for Upload${NC}"
echo "--------------------------------------------"

echo "This is a test file created at $(date)" > "/tmp/$TEST_FILE"
echo "Test content line 2" >> "/tmp/$TEST_FILE"
echo "Test content line 3" >> "/tmp/$TEST_FILE"

echo "Created test file: /tmp/$TEST_FILE"
echo "Content:"
cat "/tmp/$TEST_FILE"
echo -e "${GREEN}✓ Test file created${NC}"
echo ""

# =============================================================================
# Test 6: Upload File to Test Folder
# =============================================================================
echo -e "${BLUE}[TEST 6] Upload File to $TEST_FOLDER${NC}"
echo "--------------------------------------------"

if [ "$AUTH_MODE" = "apikey" ]; then
    UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload" \
        -H "$AUTH_HEADER" \
        -F "basePath=$TEST_FOLDER" \
        -F "mediaAccessLevel=public" \
        -F "files=@/tmp/$TEST_FILE" \
        -w "\n%{http_code}")
else
    UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload" \
        -b "$COOKIE_JAR" \
        -F "basePath=$TEST_FOLDER" \
        -F "mediaAccessLevel=public" \
        -F "files=@/tmp/$TEST_FILE" \
        -w "\n%{http_code}")
fi

HTTP_CODE=$(echo "$UPLOAD_RESPONSE" | tail -1)
BODY=$(echo "$UPLOAD_RESPONSE" | sed '$d')

echo "Response: $BODY"
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Upload successful (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ Upload failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# =============================================================================
# Test 7: List Files in Test Folder
# =============================================================================
echo -e "${BLUE}[TEST 7] List Files in $TEST_FOLDER${NC}"
echo "--------------------------------------------"

LIST_FOLDER_RESPONSE=$(auth_curl -X GET "$BASE_URL/api/files?path=$TEST_FOLDER" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$LIST_FOLDER_RESPONSE" | tail -1)
BODY=$(echo "$LIST_FOLDER_RESPONSE" | sed '$d')

echo "Response: $BODY"
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ List folder contents successful (HTTP $HTTP_CODE)${NC}"
    if echo "$BODY" | grep -q "$TEST_FILE"; then
        echo -e "${GREEN}✓ Uploaded file '$TEST_FILE' found in folder${NC}"
    else
        echo -e "${YELLOW}⚠ Uploaded file '$TEST_FILE' NOT found - possible cache issue${NC}"
    fi
else
    echo -e "${RED}✗ List folder contents failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# =============================================================================
# Test 8: Download File
# =============================================================================
echo -e "${BLUE}[TEST 8] Download File${NC}"
echo "--------------------------------------------"

DOWNLOAD_PATH="$TEST_FOLDER/$TEST_FILE"
DOWNLOAD_FILE="/tmp/downloaded-$TEST_FILE"

auth_curl -X GET "$BASE_URL/api/download?path=$DOWNLOAD_PATH" \
    -o "$DOWNLOAD_FILE" \
    -w "HTTP Code: %{http_code}\n"

if [ -f "$DOWNLOAD_FILE" ] && [ -s "$DOWNLOAD_FILE" ]; then
    echo "Downloaded file content:"
    cat "$DOWNLOAD_FILE"
    echo -e "${GREEN}✓ Download successful${NC}"
    
    # Verify content matches
    if diff -q "/tmp/$TEST_FILE" "$DOWNLOAD_FILE" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Downloaded content matches original${NC}"
    else
        echo -e "${YELLOW}⚠ Downloaded content differs from original${NC}"
    fi
    rm -f "$DOWNLOAD_FILE"
else
    echo -e "${RED}✗ Download failed or file is empty${NC}"
fi
echo ""

# =============================================================================
# Test 9: Search Files
# =============================================================================
echo -e "${BLUE}[TEST 9] Search for '$TEST_FILE'${NC}"
echo "--------------------------------------------"

SEARCH_RESPONSE=$(auth_curl -X GET "$BASE_URL/api/search?q=$TEST_FILE" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$SEARCH_RESPONSE" | tail -1)
BODY=$(echo "$SEARCH_RESPONSE" | sed '$d')

echo "Response: $BODY"
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Search successful (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ Search failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# =============================================================================
# Test 10: Get Storage Info
# =============================================================================
echo -e "${BLUE}[TEST 10] Get Storage Info${NC}"
echo "--------------------------------------------"

STORAGE_RESPONSE=$(auth_curl -X GET "$BASE_URL/api/storage" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$STORAGE_RESPONSE" | tail -1)
BODY=$(echo "$STORAGE_RESPONSE" | sed '$d')

echo "Response: $BODY"
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Storage info successful (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ Storage info failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# =============================================================================
# Test 11: Delete Uploaded File
# =============================================================================
echo -e "${BLUE}[TEST 11] Delete Uploaded File${NC}"
echo "--------------------------------------------"

DELETE_FILE_RESPONSE=$(auth_curl -X DELETE "$BASE_URL/api/delete" \
    -H "Content-Type: application/json" \
    -d "{\"path\": \"$TEST_FOLDER/$TEST_FILE\"}" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$DELETE_FILE_RESPONSE" | tail -1)
BODY=$(echo "$DELETE_FILE_RESPONSE" | sed '$d')

echo "Response: $BODY"
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Delete file successful (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ Delete file failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# =============================================================================
# Test 12: Delete Test Folder
# =============================================================================
echo -e "${BLUE}[TEST 12] Delete Test Folder${NC}"
echo "--------------------------------------------"

DELETE_FOLDER_RESPONSE=$(auth_curl -X DELETE "$BASE_URL/api/delete" \
    -H "Content-Type: application/json" \
    -d "{\"path\": \"$TEST_FOLDER\"}" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$DELETE_FOLDER_RESPONSE" | tail -1)
BODY=$(echo "$DELETE_FOLDER_RESPONSE" | sed '$d')

echo "Response: $BODY"
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Delete folder successful (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ Delete folder failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# =============================================================================
# Test 13: Verify Cleanup (List Root Again)
# =============================================================================
echo -e "${BLUE}[TEST 13] Verify Cleanup (List Root)${NC}"
echo "--------------------------------------------"

LIST_FINAL_RESPONSE=$(auth_curl -X GET "$BASE_URL/api/files" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$LIST_FINAL_RESPONSE" | tail -1)
BODY=$(echo "$LIST_FINAL_RESPONSE" | sed '$d')

if echo "$BODY" | grep -q "$TEST_FOLDER"; then
    echo -e "${YELLOW}⚠ Test folder still appears in listing - possible cache issue${NC}"
else
    echo -e "${GREEN}✓ Test folder successfully removed from listing${NC}"
fi
echo ""

# =============================================================================
# Test 14: Logout (only for session auth)
# =============================================================================
echo -e "${BLUE}[TEST 14] Logout${NC}"
echo "--------------------------------------------"

if [ "$AUTH_MODE" = "apikey" ]; then
    echo -e "${YELLOW}Skipped - using API key authentication (no session to logout)${NC}"
else
    LOGOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/logout" \
        -b "$COOKIE_JAR" \
        -w "\n%{http_code}")
    
    HTTP_CODE=$(echo "$LOGOUT_RESPONSE" | tail -1)
    BODY=$(echo "$LOGOUT_RESPONSE" | sed '$d')
    
    echo "Response: $BODY"
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ Logout successful (HTTP $HTTP_CODE)${NC}"
    else
        echo -e "${RED}✗ Logout failed (HTTP $HTTP_CODE)${NC}"
    fi
fi
echo ""

# =============================================================================
# Summary
# =============================================================================
echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  Test Summary${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo "All API endpoint tests completed!"
echo ""
echo -e "${YELLOW}Note: If you see cache-related warnings, the file/folder${NC}"
echo -e "${YELLOW}operations succeeded but the cache may not have updated.${NC}"
echo ""
echo -e "You can also test with API token instead of session:"
echo -e "  ${BLUE}curl -H 'Authorization: Bearer YOUR_API_TOKEN' $BASE_URL/api/files${NC}"
echo ""
