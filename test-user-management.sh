#!/bin/bash

# Comprehensive Test Script for File Manager User Management & API
# This script tests all positive and negative test cases

BASE_URL="http://localhost:3000"
COOKIE_FILE="test-cookies.txt"
TEST_USER="testuser$$"
TEST_USER2="testuser2$$"
TEST_FILE="test-upload.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Create test file
echo "This is a test file for upload" > $TEST_FILE

# Helper function to print test results
print_test() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ $1 -eq 0 ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✓ PASS${NC}: $2"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}✗ FAIL${NC}: $2"
        if [ -n "$3" ]; then
            echo -e "  ${YELLOW}Details:${NC} $3"
        fi
    fi
}

# Helper function to make API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local use_cookie=${4:-true}
    
    if [ "$use_cookie" = "true" ]; then
        if [ -n "$data" ]; then
            curl -s -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -b $COOKIE_FILE \
                -d "$data"
        else
            curl -s -X $method "$BASE_URL$endpoint" \
                -b $COOKIE_FILE
        fi
    else
        if [ -n "$data" ]; then
            curl -s -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data"
        else
            curl -s -X $method "$BASE_URL$endpoint"
        fi
    fi
}

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}FILE MANAGER - COMPREHENSIVE TEST${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# ===== AUTHENTICATION TESTS =====
echo -e "${BLUE}[1] AUTHENTICATION TESTS${NC}"
echo ""

# Test 1: Login with invalid credentials (negative test)
echo -e "${YELLOW}Test 1.1:${NC} Login with invalid credentials"
RESPONSE=$(api_call "POST" "/api/login" '{"username":"invalid","password":"wrong"}' "false")
if echo "$RESPONSE" | grep -q '"success":false'; then
    print_test 0 "Invalid login rejected"
else
    print_test 1 "Invalid login should be rejected" "$RESPONSE"
fi

# Test 2: Login with valid credentials (positive test)
echo -e "${YELLOW}Test 1.2:${NC} Login with valid credentials"
RESPONSE=$(curl -s -c $COOKIE_FILE -X POST "$BASE_URL/api/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}')
    
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_test 0 "Admin login successful"
else
    print_test 1 "Admin login failed" "$RESPONSE"
    echo -e "${RED}Cannot proceed without admin login. Exiting.${NC}"
    exit 1
fi

# Test 3: Check auth status
echo -e "${YELLOW}Test 1.3:${NC} Check authentication status"
RESPONSE=$(api_call "GET" "/api/auth/status")
if echo "$RESPONSE" | grep -q '"authenticated":true'; then
    print_test 0 "Auth status check successful"
else
    print_test 1 "Auth status check failed" "$RESPONSE"
fi

echo ""

# ===== USER MANAGEMENT TESTS (ADMIN) =====
echo -e "${BLUE}[2] USER MANAGEMENT TESTS${NC}"
echo ""

# Test 4: Create user with invalid username (negative test)
echo -e "${YELLOW}Test 2.1:${NC} Create user with invalid username"
RESPONSE=$(api_call "POST" "/api/admin/users" '{"username":"invalid user!","role":"user"}')
if echo "$RESPONSE" | grep -q 'error'; then
    print_test 0 "Invalid username rejected"
else
    print_test 1 "Invalid username should be rejected" "$RESPONSE"
fi

# Test 5: Create valid user (positive test)
echo -e "${YELLOW}Test 2.2:${NC} Create new user"
RESPONSE=$(api_call "POST" "/api/admin/users" "{\"username\":\"$TEST_USER\",\"role\":\"user\"}")
if echo "$RESPONSE" | grep -q '"success":true'; then
    USER_PASSWORD=$(echo "$RESPONSE" | grep -o '"password":"[^"]*"' | cut -d'"' -f4)
    print_test 0 "User created successfully (Password: $USER_PASSWORD)"
else
    print_test 1 "User creation failed" "$RESPONSE"
fi

# Test 6: Create duplicate user (negative test)
echo -e "${YELLOW}Test 2.3:${NC} Create duplicate user"
RESPONSE=$(api_call "POST" "/api/admin/users" "{\"username\":\"$TEST_USER\",\"role\":\"user\"}")
if echo "$RESPONSE" | grep -q 'already exists'; then
    print_test 0 "Duplicate user rejected"
else
    print_test 1 "Duplicate user should be rejected" "$RESPONSE"
fi

# Test 7: List all users
echo -e "${YELLOW}Test 2.4:${NC} List all users"
RESPONSE=$(api_call "GET" "/api/admin/users")
if echo "$RESPONSE" | grep -q "$TEST_USER"; then
    print_test 0 "User list retrieved successfully"
else
    print_test 1 "User list retrieval failed" "$RESPONSE"
fi

# Test 8: Create another user for testing
echo -e "${YELLOW}Test 2.5:${NC} Create second test user"
RESPONSE=$(api_call "POST" "/api/admin/users" "{\"username\":\"$TEST_USER2\",\"role\":\"user\"}")
if echo "$RESPONSE" | grep -q '"success":true'; then
    USER2_PASSWORD=$(echo "$RESPONSE" | grep -o '"password":"[^"]*"' | cut -d'"' -f4)
    print_test 0 "Second user created successfully"
else
    print_test 1 "Second user creation failed" "$RESPONSE"
fi

echo ""

# ===== PASSWORD CHANGE TESTS =====
echo -e "${BLUE}[3] PASSWORD CHANGE TESTS${NC}"
echo ""

# Test 9: Login as new user
echo -e "${YELLOW}Test 3.1:${NC} Login as new user"
rm -f $COOKIE_FILE
RESPONSE=$(curl -s -c $COOKIE_FILE -X POST "$BASE_URL/api/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$TEST_USER\",\"password\":\"$USER_PASSWORD\"}")
    
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_test 0 "New user login successful"
else
    print_test 1 "New user login failed" "$RESPONSE"
fi

# Test 10: Change password with wrong old password (negative test)
echo -e "${YELLOW}Test 3.2:${NC} Change password with wrong old password"
RESPONSE=$(api_call "POST" "/api/user/change-password" '{"oldPassword":"wrongpassword","newPassword":"newpass123"}')
if echo "$RESPONSE" | grep -q 'error'; then
    print_test 0 "Wrong old password rejected"
else
    print_test 1 "Wrong old password should be rejected" "$RESPONSE"
fi

# Test 11: Change password with too short new password (negative test)
echo -e "${YELLOW}Test 3.3:${NC} Change password with short password"
RESPONSE=$(api_call "POST" "/api/user/change-password" "{\"oldPassword\":\"$USER_PASSWORD\",\"newPassword\":\"short\"}")
if echo "$RESPONSE" | grep -q 'at least 8 characters'; then
    print_test 0 "Short password rejected"
else
    print_test 1 "Short password should be rejected" "$RESPONSE"
fi

# Test 12: Change password successfully (positive test)
echo -e "${YELLOW}Test 3.4:${NC} Change password successfully"
NEW_PASSWORD="newpassword123"
RESPONSE=$(api_call "POST" "/api/user/change-password" "{\"oldPassword\":\"$USER_PASSWORD\",\"newPassword\":\"$NEW_PASSWORD\"}")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_test 0 "Password changed successfully"
    USER_PASSWORD=$NEW_PASSWORD
else
    print_test 1 "Password change failed" "$RESPONSE"
fi

# Test 13: Login with new password
echo -e "${YELLOW}Test 3.5:${NC} Login with new password"
rm -f $COOKIE_FILE
RESPONSE=$(curl -s -c $COOKIE_FILE -X POST "$BASE_URL/api/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$TEST_USER\",\"password\":\"$NEW_PASSWORD\"}")
    
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_test 0 "Login with new password successful"
else
    print_test 1 "Login with new password failed" "$RESPONSE"
fi

echo ""

# ===== API TOKEN TESTS =====
echo -e "${BLUE}[4] API TOKEN TESTS${NC}"
echo ""

# Test 14: Generate API token with wrong password (negative test)
echo -e "${YELLOW}Test 4.1:${NC} Generate API token with wrong password"
RESPONSE=$(api_call "POST" "/api/user/generate-token" '{"password":"wrongpassword"}')
if echo "$RESPONSE" | grep -q 'error'; then
    print_test 0 "API token generation with wrong password rejected"
else
    print_test 1 "Wrong password should be rejected" "$RESPONSE"
fi

# Test 15: Generate API token successfully (positive test)
echo -e "${YELLOW}Test 4.2:${NC} Generate API token"
RESPONSE=$(api_call "POST" "/api/user/generate-token" "{\"password\":\"$NEW_PASSWORD\"}")
if echo "$RESPONSE" | grep -q '"apiKey"'; then
    API_TOKEN=$(echo "$RESPONSE" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)
    print_test 0 "API token generated successfully"
    echo -e "  ${GREEN}Token:${NC} $API_TOKEN"
else
    print_test 1 "API token generation failed" "$RESPONSE"
fi

# Test 16: Get user info to verify API token exists
echo -e "${YELLOW}Test 4.3:${NC} Verify API token exists"
RESPONSE=$(api_call "GET" "/api/user/me")
if echo "$RESPONSE" | grep -q '"hasApiKey":true'; then
    print_test 0 "API token verified in user info"
else
    print_test 1 "API token not found in user info" "$RESPONSE"
fi

# Test 17: Use API token with Bearer auth (positive test)
echo -e "${YELLOW}Test 4.4:${NC} Use API token with Bearer authentication"
RESPONSE=$(curl -s -X GET "$BASE_URL/api/files" \
    -H "Authorization: Bearer $API_TOKEN")
    
if echo "$RESPONSE" | grep -q '"items"'; then
    print_test 0 "Bearer token authentication successful"
else
    print_test 1 "Bearer token authentication failed" "$RESPONSE"
fi

# Test 18: Use API token in URL parameter (positive test)
echo -e "${YELLOW}Test 4.5:${NC} Use API token as URL parameter"
RESPONSE=$(curl -s -X GET "$BASE_URL/api/files?apiKey=$API_TOKEN")
    
if echo "$RESPONSE" | grep -q '"items"'; then
    print_test 0 "URL parameter token authentication successful"
else
    print_test 1 "URL parameter token authentication failed" "$RESPONSE"
fi

# Test 19: Use invalid API token (negative test)
echo -e "${YELLOW}Test 4.6:${NC} Use invalid API token"
RESPONSE=$(curl -s -X GET "$BASE_URL/api/files" \
    -H "Authorization: Bearer invalid_token_123")
    
if echo "$RESPONSE" | grep -q 'Authentication required'; then
    print_test 0 "Invalid API token rejected"
else
    print_test 1 "Invalid API token should be rejected" "$RESPONSE"
fi

# Test 20: Delete API token
echo -e "${YELLOW}Test 4.7:${NC} Delete API token"
rm -f $COOKIE_FILE
curl -s -c $COOKIE_FILE -X POST "$BASE_URL/api/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$TEST_USER\",\"password\":\"$NEW_PASSWORD\"}" > /dev/null
    
RESPONSE=$(api_call "DELETE" "/api/user/delete-token" "{\"password\":\"$NEW_PASSWORD\"}")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_test 0 "API token deleted successfully"
else
    print_test 1 "API token deletion failed" "$RESPONSE"
fi

# Test 21: Verify token is deleted
echo -e "${YELLOW}Test 4.8:${NC} Verify API token is deleted"
RESPONSE=$(curl -s -X GET "$BASE_URL/api/files" \
    -H "Authorization: Bearer $API_TOKEN")
    
if echo "$RESPONSE" | grep -q 'Authentication required'; then
    print_test 0 "Deleted token no longer works"
else
    print_test 1 "Deleted token should not work" "$RESPONSE"
fi

echo ""

# ===== FILE OPERATIONS WITH API TOKEN =====
echo -e "${BLUE}[5] FILE OPERATIONS WITH API TOKEN${NC}"
echo ""

# Generate new token for file operations
curl -s -c $COOKIE_FILE -X POST "$BASE_URL/api/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$TEST_USER\",\"password\":\"$NEW_PASSWORD\"}" > /dev/null
    
RESPONSE=$(api_call "POST" "/api/user/generate-token" "{\"password\":\"$NEW_PASSWORD\"}")
API_TOKEN=$(echo "$RESPONSE" | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4)

# Test 22: Upload file with API token
echo -e "${YELLOW}Test 5.1:${NC} Upload file with API token"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/upload?apiKey=$API_TOKEN" \
    -F "basePath=" \
    -F "files=@$TEST_FILE")
    
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_test 0 "File upload with API token successful"
else
    print_test 1 "File upload with API token failed" "$RESPONSE"
fi

# Test 23: List files with API token
echo -e "${YELLOW}Test 5.2:${NC} List files with API token"
RESPONSE=$(curl -s -X GET "$BASE_URL/api/files?apiKey=$API_TOKEN")
    
if echo "$RESPONSE" | grep -q "$TEST_FILE"; then
    print_test 0 "File listing with API token successful"
else
    print_test 1 "File listing with API token failed" "$RESPONSE"
fi

# Test 24: Create folder with API token
echo -e "${YELLOW}Test 5.3:${NC} Create folder with API token"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/folder?apiKey=$API_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"path":"","name":"test-folder"}')
    
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_test 0 "Folder creation with API token successful"
else
    print_test 1 "Folder creation with API token failed" "$RESPONSE"
fi

# Test 25: Delete file with API token
echo -e "${YELLOW}Test 5.4:${NC} Delete file with API token"
RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/delete?apiKey=$API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"path\":\"$TEST_FILE\"}")
    
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_test 0 "File deletion with API token successful"
else
    print_test 1 "File deletion with API token failed" "$RESPONSE"
fi

# Test 26: Delete folder with API token
echo -e "${YELLOW}Test 5.5:${NC} Delete folder with API token"
RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/delete?apiKey=$API_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"path":"test-folder"}')
    
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_test 0 "Folder deletion with API token successful"
else
    print_test 1 "Folder deletion with API token failed" "$RESPONSE"
fi

# Test 27: Get storage info with API token
echo -e "${YELLOW}Test 5.6:${NC} Get storage info with API token"
RESPONSE=$(curl -s -X GET "$BASE_URL/api/storage?apiKey=$API_TOKEN")
    
if echo "$RESPONSE" | grep -q '"totalSize"'; then
    print_test 0 "Storage info with API token successful"
else
    print_test 1 "Storage info with API token failed" "$RESPONSE"
fi

echo ""

# ===== ADMIN OPERATIONS =====
echo -e "${BLUE}[6] ADMIN OPERATIONS${NC}"
echo ""

# Login as admin again
rm -f $COOKIE_FILE
curl -s -c $COOKIE_FILE -X POST "$BASE_URL/api/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' > /dev/null

# Test 28: Non-admin cannot access admin endpoints (negative test)
echo -e "${YELLOW}Test 6.1:${NC} Non-admin cannot access admin endpoints"
rm -f $COOKIE_FILE
curl -s -c $COOKIE_FILE -X POST "$BASE_URL/api/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$TEST_USER\",\"password\":\"$NEW_PASSWORD\"}" > /dev/null
    
RESPONSE=$(api_call "GET" "/api/admin/users")
if echo "$RESPONSE" | grep -q 'Admin access required'; then
    print_test 0 "Non-admin access to admin endpoint rejected"
else
    print_test 1 "Non-admin should not access admin endpoints" "$RESPONSE"
fi

# Login as admin again for cleanup
rm -f $COOKIE_FILE
curl -s -c $COOKIE_FILE -X POST "$BASE_URL/api/login" \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}' > /dev/null

# Test 29: Admin cannot delete themselves (negative test)
echo -e "${YELLOW}Test 6.2:${NC} Admin cannot delete themselves"
RESPONSE=$(api_call "DELETE" "/api/admin/users/admin")
if echo "$RESPONSE" | grep -q 'Cannot delete your own account'; then
    print_test 0 "Self-deletion prevented"
else
    print_test 1 "Admin should not be able to delete themselves" "$RESPONSE"
fi

# Test 30: Delete test user (cleanup)
echo -e "${YELLOW}Test 6.3:${NC} Delete first test user"
RESPONSE=$(api_call "DELETE" "/api/admin/users/$TEST_USER")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_test 0 "Test user deleted successfully"
else
    print_test 1 "Test user deletion failed" "$RESPONSE"
fi

# Test 31: Delete second test user (cleanup)
echo -e "${YELLOW}Test 6.4:${NC} Delete second test user"
RESPONSE=$(api_call "DELETE" "/api/admin/users/$TEST_USER2")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_test 0 "Second test user deleted successfully"
else
    print_test 1 "Second test user deletion failed" "$RESPONSE"
fi

# Test 32: Verify users are deleted
echo -e "${YELLOW}Test 6.5:${NC} Verify test users are deleted"
RESPONSE=$(api_call "GET" "/api/admin/users")
if ! echo "$RESPONSE" | grep -q "$TEST_USER"; then
    print_test 0 "Test users successfully removed from list"
else
    print_test 1 "Test users should be removed" "$RESPONSE"
fi

echo ""

# ===== LOGOUT TEST =====
echo -e "${BLUE}[7] LOGOUT TEST${NC}"
echo ""

# Test 33: Logout
echo -e "${YELLOW}Test 7.1:${NC} Logout"
RESPONSE=$(api_call "POST" "/api/logout")
if echo "$RESPONSE" | grep -q '"success":true'; then
    print_test 0 "Logout successful"
else
    print_test 1 "Logout failed" "$RESPONSE"
fi

# Test 34: Verify logout - should not access protected endpoint
echo -e "${YELLOW}Test 7.2:${NC} Verify logout"
RESPONSE=$(api_call "GET" "/api/files")
if echo "$RESPONSE" | grep -q 'Authentication required'; then
    print_test 0 "Session cleared after logout"
else
    print_test 1 "Session should be cleared after logout" "$RESPONSE"
fi

echo ""

# ===== CLEANUP =====
echo -e "${BLUE}[8] CLEANUP${NC}"
echo ""
rm -f $COOKIE_FILE $TEST_FILE
echo -e "${GREEN}Cleanup completed${NC}"

echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ ALL TESTS PASSED!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    exit 1
fi

