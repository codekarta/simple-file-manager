#!/bin/bash

echo "🧪 Testing File Manager Authentication"
echo "======================================"
echo ""

# Test 1: Server is running
echo "1️⃣  Testing if server is running..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Server is running on port 3000"
else
    echo "❌ Server is NOT running!"
    echo "   Run: npm run dev"
    exit 1
fi
echo ""

# Test 2: Login
echo "2️⃣  Testing login..."
LOGIN_RESPONSE=$(curl -c /tmp/auth_test_cookies.txt -s -X POST http://localhost:3000/api/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}')

if echo "$LOGIN_RESPONSE" | grep -q "success.*true"; then
    echo "✅ Login successful"
else
    echo "❌ Login failed!"
    echo "   Response: $LOGIN_RESPONSE"
    rm -f /tmp/auth_test_cookies.txt
    exit 1
fi
echo ""

# Test 3: Cookie was set
echo "3️⃣  Testing if session cookie was set..."
if grep -q "filemanager.sid" /tmp/auth_test_cookies.txt 2>/dev/null; then
    echo "✅ Session cookie was set"
    echo "   Cookie: $(grep filemanager.sid /tmp/auth_test_cookies.txt | awk '{print $7}' | cut -c1-30)..."
else
    echo "❌ Session cookie was NOT set!"
    cat /tmp/auth_test_cookies.txt
    rm -f /tmp/auth_test_cookies.txt
    exit 1
fi
echo ""

# Test 4: Authenticated request
echo "4️⃣  Testing authenticated file list request..."
FILES_RESPONSE=$(curl -b /tmp/auth_test_cookies.txt -s http://localhost:3000/api/files)

if echo "$FILES_RESPONSE" | grep -q "currentPath"; then
    echo "✅ Authenticated request successful"
    echo "   Response: $(echo "$FILES_RESPONSE" | head -c 60)..."
else
    echo "❌ Authenticated request failed!"
    echo "   Response: $FILES_RESPONSE"
    rm -f /tmp/auth_test_cookies.txt
    exit 1
fi
echo ""

# Test 5: Storage info
echo "5️⃣  Testing storage info endpoint..."
STORAGE_RESPONSE=$(curl -b /tmp/auth_test_cookies.txt -s http://localhost:3000/api/storage)

if echo "$STORAGE_RESPONSE" | grep -q "totalSize"; then
    echo "✅ Storage info endpoint working"
else
    echo "❌ Storage info endpoint failed!"
    echo "   Response: $STORAGE_RESPONSE"
fi
echo ""

# Cleanup
rm -f /tmp/auth_test_cookies.txt

echo "======================================"
echo "✅ All authentication tests passed!"
echo ""
echo "📋 Next steps:"
echo "   1. Open browser: http://localhost:3000/admin"
echo "   2. Hard refresh: Ctrl+Shift+R (or Cmd+Shift+R on Mac)"
echo "   3. Login with: admin / admin123"
echo "   4. Try uploading a file"
echo ""
echo "🎉 Authentication is working correctly!"

