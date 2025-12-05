# Simple File Manager (SFM) - API Reference for LLMs

> Complete API documentation for integrating with Simple File Manager. This document is optimized for LLM consumption with structured data, examples, and comprehensive endpoint coverage.

## Base Information

- **Base URL**: `http://localhost:3000` (configurable via PORT env)
- **Content-Type**: `application/json` (except file uploads)
- **Authentication**: Session-based or API Token (Bearer)

---

## Authentication Methods

### Method 1: Session-Based Authentication

```bash
# Login to get session cookie
curl -c cookies.txt -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Use session cookie for subsequent requests
curl -b cookies.txt "http://localhost:3000/api/files"
```

### Method 2: API Token Authentication (Recommended)

```bash
# Using Bearer token in Authorization header
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
  "http://localhost:3000/api/files"

# Using URL parameter
curl "http://localhost:3000/api/files?apiKey=YOUR_API_TOKEN"
```

---

## Endpoints Reference

### Authentication Endpoints

#### POST /api/login
Authenticate user and create session.

**Request Body:**
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "username": "admin",
    "role": "admin"
  }
}
```

**Response (401):**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

---

#### POST /api/logout
End current session.

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### GET /api/auth/status
Check authentication status.

**Response (200):**
```json
{
  "authenticated": true,
  "user": {
    "username": "admin",
    "role": "admin",
    "hasApiKey": true,
    "apiKey": "xxxxxxxxxxxxxx",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Response (when not authenticated):**
```json
{
  "authenticated": false
}
```

---

### File & Folder Operations

#### GET /api/files
List files and folders in a directory with pagination support.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| path | string | "" | Directory path relative to uploads root |
| page | number | 1 | Page number (1-based) |
| limit | number | 50 | Items per page (max 500) |
| showHidden | boolean | false | Include hidden files (starting with .) |

**Example:**
```bash
# List root directory
curl -H "Authorization: Bearer TOKEN" "http://localhost:3000/api/files"

# List specific folder with pagination
curl -H "Authorization: Bearer TOKEN" "http://localhost:3000/api/files?path=products&page=1&limit=20"

# Include hidden files
curl -H "Authorization: Bearer TOKEN" "http://localhost:3000/api/files?showHidden=true"
```

**Response (200):**
```json
{
  "currentPath": "products",
  "items": [
    {
      "name": "images",
      "path": "products/images",
      "isDirectory": true,
      "size": 0,
      "modified": "2024-10-09T10:30:00.000Z",
      "created": "2024-10-08T14:20:00.000Z"
    },
    {
      "name": "tshirt.jpg",
      "path": "products/tshirt.jpg",
      "isDirectory": false,
      "size": 245678,
      "modified": "2024-10-09T10:30:00.000Z",
      "created": "2024-10-08T14:20:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 125,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

#### POST /api/upload
Upload one or more files. Supports folder structure preservation.

**Content-Type:** `multipart/form-data`

**Form Fields:**
| Field | Type | Description |
|-------|------|-------------|
| files | File[] | Files to upload (max 500 files, 100MB each) |
| basePath | string | Target directory path |
| relativePaths | string[] | Preserve folder structure (for folder upload) |

**Examples:**
```bash
# Single file upload
curl -H "Authorization: Bearer TOKEN" \
  -X POST http://localhost:3000/api/upload \
  -F "basePath=products" \
  -F "files=@image.jpg"

# Multiple files
curl -H "Authorization: Bearer TOKEN" \
  -X POST http://localhost:3000/api/upload \
  -F "basePath=products" \
  -F "files=@image1.jpg" \
  -F "files=@image2.jpg"

# Folder upload with structure
curl -H "Authorization: Bearer TOKEN" \
  -X POST http://localhost:3000/api/upload \
  -F "basePath=backups" \
  -F "files=@folder/file1.txt" \
  -F "relativePaths=folder/file1.txt"
```

**Response (200):**
```json
{
  "success": true,
  "message": "3 file(s) uploaded successfully",
  "files": [
    {
      "name": "image1.jpg",
      "size": 12345,
      "path": "products/image1.jpg"
    }
  ],
  "foldersCreated": 1
}
```

---

#### POST /api/folder
Create a new folder.

**Request Body:**
```json
{
  "path": "string (parent directory, empty for root)",
  "name": "string (folder name)"
}
```

**Example:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  -X POST http://localhost:3000/api/folder \
  -H "Content-Type: application/json" \
  -d '{"path":"","name":"documents"}'
```

**Response (200):**
```json
{
  "success": true,
  "message": "Folder created successfully"
}
```

---

#### DELETE /api/delete
Delete a file or folder (recursive).

**Request Body:**
```json
{
  "path": "string (path to file or folder)"
}
```

**Example:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  -X DELETE http://localhost:3000/api/delete \
  -H "Content-Type: application/json" \
  -d '{"path":"products/old-image.jpg"}'
```

**Response (200):**
```json
{
  "success": true,
  "message": "Deleted successfully"
}
```

---

#### POST /api/rename
Rename a file or folder.

**Request Body:**
```json
{
  "path": "string (current path)",
  "newName": "string (new name)"
}
```

**Example:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  -X POST http://localhost:3000/api/rename \
  -H "Content-Type: application/json" \
  -d '{"path":"products/old-name.jpg","newName":"new-name.jpg"}'
```

**Response (200):**
```json
{
  "success": true,
  "message": "Renamed successfully"
}
```

---

#### GET /api/download
Download a file or folder. Folders are automatically zipped.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| path | string | Path to file or folder |

**Examples:**
```bash
# Download a file
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/download?path=products/image.jpg" \
  -o downloaded-image.jpg

# Download a folder (automatically zipped)
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/download?path=products" \
  -o products.zip
```

---

### Search & Storage

#### GET /api/search
Search for files and folders with pagination and optional regex support.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| q | string | "" | Search query |
| regex | boolean | false | Enable regex pattern matching |
| page | number | 1 | Page number (1-based) |
| limit | number | 50 | Items per page (max 500) |
| showHidden | boolean | false | Include hidden files |

**Examples:**
```bash
# Simple search
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/search?q=tshirt"

# Regex search with pagination
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/search?q=.*\.jpg$&regex=true&page=1&limit=20"
```

**Response (200):**
```json
{
  "results": [
    {
      "name": "tshirt-red.jpg",
      "path": "products/tshirt-red.jpg",
      "isDirectory": false,
      "size": 245678,
      "modified": "2024-10-09T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 15,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

#### GET /api/storage
Get storage statistics.

**Response (200):**
```json
{
  "totalSize": 15728640,
  "fileCount": 42,
  "folderCount": 8
}
```

---

### User Management

#### GET /api/user/me
Get current user information.

**Response (200):**
```json
{
  "success": true,
  "user": {
    "username": "john",
    "role": "user",
    "hasApiKey": true,
    "apiKey": "yknngagbkwqyga86qxeus5qd",
    "createdAt": "2025-01-15T10:00:00.000Z",
    "passwordChangedAt": "2025-02-01T08:00:00.000Z",
    "apiKeyGeneratedAt": "2025-01-20T12:00:00.000Z"
  }
}
```

---

#### POST /api/user/change-password
Change your own password.

**Request Body:**
```json
{
  "oldPassword": "string (required)",
  "newPassword": "string (required, min 8 chars)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Response (400):**
```json
{
  "error": "New password must be at least 8 characters long"
}
```

---

#### POST /api/user/generate-token
Generate a new API token for the current user.

**Request Body:**
```json
{
  "password": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "API token generated successfully",
  "apiKey": "yknngagbkwqyga86qxeus5qd"
}
```

> ⚠️ **Important**: Save this token securely. It cannot be retrieved later.

---

#### DELETE /api/user/delete-token
Delete your API token.

**Request Body:**
```json
{
  "password": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "API token deleted successfully"
}
```

---

### Admin Endpoints

> 🔒 These endpoints require admin role.

#### GET /api/admin/users
List all users.

**Response (200):**
```json
{
  "success": true,
  "users": [
    {
      "username": "admin",
      "role": "admin",
      "hasApiKey": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "passwordChangedAt": null
    },
    {
      "username": "john",
      "role": "user",
      "hasApiKey": false,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "passwordChangedAt": "2025-02-01T08:00:00.000Z"
    }
  ]
}
```

---

#### POST /api/admin/users
Create a new user.

**Request Body:**
```json
{
  "username": "string (required, alphanumeric or email)",
  "role": "string (optional, 'user' or 'admin', default: 'user')",
  "password": "string (optional, auto-generated if not provided)"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "username": "newuser",
    "password": "randomly_generated_password_123",
    "role": "user"
  }
}
```

> ⚠️ **Important**: The password is only shown once. Save it securely!

---

#### POST /api/admin/users/:username/reset-password
Reset a user's password (admin only).

**URL Parameters:**
- `username`: Target user's username

**Request Body:**
```json
{
  "customPassword": "string (optional, auto-generated if not provided)"
}
```

**Example:**
```bash
# Reset with auto-generated password
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  -X POST http://localhost:3000/api/admin/users/john/reset-password \
  -H "Content-Type: application/json" \
  -d '{}'

# Reset with custom password
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  -X POST http://localhost:3000/api/admin/users/john/reset-password \
  -H "Content-Type: application/json" \
  -d '{"customPassword":"NewSecurePass123"}'
```

**Response (200 - auto-generated):**
```json
{
  "success": true,
  "message": "Password reset successfully",
  "newPassword": "auto_generated_password_xyz"
}
```

**Response (200 - custom password):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

> ⚠️ **Note**: Admins cannot reset their own password. Use change-password instead.

---

#### DELETE /api/admin/users/:username
Delete a user.

**URL Parameters:**
- `username`: Username to delete

**Example:**
```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  -X DELETE http://localhost:3000/api/admin/users/olduser
```

**Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

> ⚠️ **Note**: Admins cannot delete their own account.

---

### Cache Management (Admin Only)

#### GET /api/cache/status
Get cache status and statistics.

**Response (200):**
```json
{
  "enabled": true,
  "ready": true,
  "totalFiles": 1250,
  "totalDirectories": 45,
  "totalSize": 157286400,
  "lastSync": "2025-01-15T10:30:00.000Z",
  "syncInProgress": false,
  "syncInterval": 600000,
  "databasePath": "./.cache/files.db",
  "databaseSize": 524288
}
```

---

#### POST /api/cache/rebuild
Force cache rebuild (runs in background).

**Response (200):**
```json
{
  "success": true,
  "message": "Cache rebuild started in background"
}
```

---

### System Information

#### GET /api/about
Get application version and information (no authentication required).

**Response (200):**
```json
{
  "version": "1.0.0",
  "name": "simple-file-manage",
  "description": "A simple file management server",
  "license": "MIT"
}
```

---

## Error Responses

All endpoints may return these error responses:

| Status | Type | Example Response |
|--------|------|------------------|
| 400 | Bad Request | `{"error": "Invalid input"}` |
| 401 | Unauthorized | `{"error": "Authentication required", "message": "Please provide a valid session or API token"}` |
| 403 | Forbidden | `{"error": "Access denied"}` or `{"error": "Admin access required"}` |
| 404 | Not Found | `{"error": "File or folder not found"}` |
| 500 | Server Error | `{"error": "Internal server error"}` |

---

## Complete Code Examples

### Python Example

```python
import requests

BASE_URL = "http://localhost:3000"
API_TOKEN = "your_api_token_here"

headers = {"Authorization": f"Bearer {API_TOKEN}"}

# List files with pagination
response = requests.get(
    f"{BASE_URL}/api/files",
    headers=headers,
    params={"path": "", "page": 1, "limit": 20}
)
files = response.json()

print(f"Total items: {files['pagination']['total']}")
for item in files['items']:
    icon = "📁" if item['isDirectory'] else "📄"
    print(f"  {icon} {item['name']}")

# Upload file
with open('document.pdf', 'rb') as f:
    response = requests.post(
        f"{BASE_URL}/api/upload",
        headers=headers,
        files={'files': f},
        data={'basePath': 'documents'}
    )
print(response.json())

# Search with regex
response = requests.get(
    f"{BASE_URL}/api/search",
    headers=headers,
    params={"q": r".*\.pdf$", "regex": "true"}
)
print(response.json())
```

### Node.js Example

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const API_TOKEN = 'your_api_token_here';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Authorization': `Bearer ${API_TOKEN}` }
});

async function main() {
  // List files with pagination
  const { data: files } = await api.get('/api/files', {
    params: { path: '', page: 1, limit: 20 }
  });
  console.log(`Found ${files.pagination.total} items`);

  // Create folder
  await api.post('/api/folder', { path: '', name: 'backups' });

  // Upload file
  const formData = new FormData();
  formData.append('basePath', 'backups');
  formData.append('files', fs.createReadStream('./data.json'));
  
  await api.post('/api/upload', formData, {
    headers: formData.getHeaders()
  });

  // Get storage info
  const { data: storage } = await api.get('/api/storage');
  console.log(`Total size: ${storage.totalSize} bytes`);
}

main().catch(console.error);
```

### Bash/cURL Example

```bash
#!/bin/bash
API_TOKEN="your_api_token_here"
BASE_URL="http://localhost:3000"

# Helper function
api() {
  curl -s -H "Authorization: Bearer $API_TOKEN" "$@"
}

# List files
api "$BASE_URL/api/files?path=&page=1&limit=20" | jq .

# Create folder
api -X POST "$BASE_URL/api/folder" \
  -H "Content-Type: application/json" \
  -d '{"path":"","name":"archive"}'

# Upload file
api -X POST "$BASE_URL/api/upload" \
  -F "basePath=archive" \
  -F "files=@backup.tar.gz"

# Search
api "$BASE_URL/api/search?q=backup&page=1&limit=10" | jq .

# Get storage info
api "$BASE_URL/api/storage" | jq .
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| UPLOAD_DIR | uploads | Upload directory (relative, absolute, or ~/path) |
| ALLOW_EXTERNAL_UPLOAD_FOLDER | false | Allow upload dir outside app root |
| SESSION_SECRET | default-secret-key | Session encryption secret |
| ADMIN_USERNAME | admin | Initial admin username |
| ADMIN_PASSWORD | admin123 | Initial admin password |
| CACHE_ENABLED | true | Enable SQLite file cache |
| CACHE_DB_PATH | ./.cache/files.db | Cache database location |
| CACHE_SYNC_INTERVAL_INTERNAL | 600000 | Cache sync interval (10 min) |
| CACHE_SYNC_INTERVAL_EXTERNAL | 300000 | Cache sync for external dirs (5 min) |

---

## Rate Limits & Constraints

- **Max file size**: 100MB per file
- **Max files per upload**: 500 files
- **Max pagination limit**: 500 items per page
- **Default pagination limit**: 50 items per page
- **Session duration**: 24 hours
- **Password minimum length**: 8 characters

---

## Public File Access

Files in the upload directory are publicly accessible without authentication:

```
http://localhost:3000/{path_to_file}
```

Example: `http://localhost:3000/products/tshirt.jpg`

---

## Best Practices

1. **Use API Tokens** for automation and scripts
2. **Store tokens in environment variables**, never hardcode
3. **Use pagination** for large directories
4. **Batch uploads** when possible (multiple files in one request)
5. **Handle errors gracefully** - check status codes and error messages
6. **Use HTTPS in production**
7. **Rotate API tokens** periodically for security
