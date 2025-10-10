# 📁 Simple File Manager

A beautiful, secure file manager application with authentication for managing and sharing files through a web interface. Perfect for personal use, small teams, or as a simple CDN for your website assets.

---

## 📖 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [User Guide](#user-guide)
- [API Documentation](#api-documentation)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)
- [Security](#security)
- [License](#license)

---

## Overview

Simple File Manager is a web-based application that allows you to upload, organize, and manage files through an intuitive interface. Once uploaded, files are instantly accessible via public URLs, making it perfect for serving website assets, sharing documents, or managing media files.

**Access Pattern:**
- **Admin Panel:** `http://yourdomain.com/admin` (password protected)
- **Public Files:** `http://yourdomain.com/path/to/file.jpg` (no authentication required)
- **REST API:** `http://yourdomain.com/api/*` (authentication required)

---

## Key Features

### 🔐 Security & Authentication
- **Multi-User System** - Support for multiple users with different roles (admin/user)
- **Password Management** - Users can change their passwords securely
- **API Token Authentication** - Generate personal API tokens for programmatic access
- **Encrypted Passwords** - All passwords are hashed using bcrypt
- **Session-based Authentication** - Secure cookie-based sessions
- **Flexible API Authentication** - Use Bearer tokens or URL parameters
- **Role-Based Access Control** - Admin-only endpoints for user management
- **Secure file path validation** - Protection against directory traversal attacks

### 📁 File & Folder Management
- **Upload Files** - Single or multiple files (up to 500 files)
- **Upload Folders** - Complete folder structures with nested directories
- **Create Folders** - Organize files in hierarchical structure
- **Delete** - Remove files and folders
- **Rename** - Rename files and folders
- **Download** - Download files directly
- **Bulk Delete** - Select and delete multiple items at once

### 🎨 Modern User Interface
- Clean, professional design
- Mobile-responsive interface
- Real-time search functionality
- File type icons and image thumbnails
- Breadcrumb navigation
- Drag & drop file upload
- Storage statistics (size, file count, folder count)

### 🌐 Public File Access
- All uploaded files are publicly accessible via clean URLs
- No authentication required for viewing files
- Perfect for CDN usage or sharing media

### 📊 Storage Management
- View total storage used
- Track file and folder counts
- Real-time statistics updates

### 🔌 RESTful API
- **Full API access** to all file operations
- **Dual Authentication** - Session-based or API token-based
- **User Management API** - Create, delete users, manage passwords (admin only)
- **API Token Management** - Generate and revoke personal API tokens
- **List, upload, download, delete** files and folders via API
- **Integration with scripts** and applications (Python, Node.js, Bash, cURL)
- **Perfect for automation** and CI/CD pipelines

### 👥 User Management
- **Multi-User Support** - Admin can create and manage multiple users
- **Auto-Generated Passwords** - Secure random passwords for new users
- **Role Management** - Assign admin or user roles
- **User Dashboard** - Each user can manage their own settings
- **Password Change** - Users can update their passwords anytime
- **API Token per User** - Each user can generate their own API token
- **Self-Service** - Users manage their own API tokens and passwords

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js** v14.0 or higher ([Download here](https://nodejs.org/))
- **npm** (comes with Node.js)
- Basic command line knowledge

**Check your Node.js version:**
```bash
node --version
npm --version
```

---

## Quick Start

Follow these steps to get up and running in minutes:

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with your preferred credentials:
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
PORT=3000
SESSION_SECRET=your-random-secret-key-here
UPLOAD_DIR=uploads
```

⚠️ **Important:** Change the default password before using in production!

### 3. Start the Application

```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

### 4. Access the Application

Open your browser and navigate to:
```
http://localhost:3000/admin
```

Login with the credentials you set in `.env` file.

**🎉 That's it! You're ready to start uploading files.**

---

## Configuration

### Environment Variables

All configuration is done through the `.env` file:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ADMIN_USERNAME` | Admin login username | `admin` | Yes |
| `ADMIN_PASSWORD` | Admin login password | `admin123` | Yes |
| `PORT` | Server port number | `3000` | No |
| `SESSION_SECRET` | Secret key for sessions | Auto-generated | Yes |
| `UPLOAD_DIR` | Directory for file storage | `uploads` | No |

### Security Configuration

**Generate a Strong Session Secret:**
```bash
openssl rand -base64 32
```
Copy the output and set it as `SESSION_SECRET` in your `.env` file.

**Password Requirements:**
- Use a unique password
- Minimum 12 characters recommended
- Mix of letters, numbers, and special characters

### Storage Configuration

**Change Upload Directory:**
```env
UPLOAD_DIR=my-custom-folder
```

**File Upload Limits:**
- Maximum file size: 100MB per file
- Maximum files per upload: 500 files
- No restrictions on total storage (depends on your disk space)

### Port Configuration

If port 3000 is already in use, change it:
```env
PORT=8080
```

---

## User Guide

### Logging In

1. Navigate to `http://localhost:3000/admin`
2. Enter your username and password from `.env` file
3. Click "Sign In"
4. Session lasts 24 hours

### Uploading Files

#### Single/Multiple Files:
1. Click **"📤 Upload Files"** button
2. Click the upload area or drag & drop files
3. Select one or more files (up to 500)
4. Click **"Upload"**
5. Files appear in current folder

#### Entire Folders:
1. Click **"📁 Upload Folder"** button
2. Click the upload area
3. Select a folder (complete structure will be preserved)
4. Review the folder name and file count
5. Click **"Upload"**
6. Folder structure is recreated automatically

**Example:**
```
Upload: my-website/
        ├── css/style.css
        ├── js/app.js
        └── images/logo.png

Result: http://yourdomain.com/my-website/css/style.css
        http://yourdomain.com/my-website/js/app.js
        http://yourdomain.com/my-website/images/logo.png
```

### Creating Folders

1. Click **"➕ New Folder"** button
2. Enter folder name
3. Click **"Create"**
4. Folder appears in current location

### Navigating Folders

- Click on any folder name to open it
- Use breadcrumb navigation at the top to go back
- Click "🏠 Home" to return to root directory

### Searching Files

1. Type in the search box (top right)
2. Results appear in real-time (minimum 2 characters)
3. Search works across all folders

### Renaming Files/Folders

1. Click the **✏️ Edit** icon next to the item
2. Enter new name
3. Click **"Rename"**

### Downloading Files

- Click the **⬇️ Download** icon next to any file
- File downloads to your browser's download folder

### Deleting Files/Folders

#### Single Item:
1. Click the **🗑️ Delete** icon next to the item
2. Confirm deletion
3. Item is permanently removed

#### Multiple Items:
1. Check the boxes next to items you want to delete
2. Click **"Delete Selected (X)"** button
3. Confirm bulk deletion
4. All selected items are removed

### User Management (Admin Only)

#### Creating Users
1. Click **"👥 Users"** button (visible only to admins)
2. Enter username (letters, numbers, hyphens, underscores only)
3. Select role (User or Admin)
4. Click **"Create User"**
5. **Save the generated password** - it will only be shown once!

#### Deleting Users
1. Open **"👥 Users"** management panel
2. Find the user in the list
3. Click **"Delete"** button
4. Confirm deletion
5. Note: You cannot delete your own account

### Password & API Token Management

#### Changing Your Password
1. Click **"⚙️ Settings"** button
2. Enter your current password
3. Enter new password (minimum 8 characters)
4. Confirm new password
5. Click **"Change Password"**

#### Managing API Tokens
1. Click **"⚙️ Settings"** button
2. Scroll to API Token section
3. To generate: Click **"🔑 Generate New Token"**, enter password
4. **Save your API token securely** - treat it like a password!
5. To delete: Click **"🗑️ Delete Token"**, confirm with password

**API Token Usage:**
```bash
# Method 1: Bearer Token (Recommended)
curl -H "Authorization: Bearer YOUR_TOKEN" http://yourdomain.com/api/files

# Method 2: URL Parameter
curl "http://yourdomain.com/api/files?apiKey=YOUR_TOKEN"
```

### Accessing Files Publicly

Once uploaded, any file can be accessed via its URL without authentication:

```
http://yourdomain.com/folder/subfolder/filename.ext
```

**Examples:**
- Product images: `http://yourdomain.com/products/tshirt.jpg`
- Documents: `http://yourdomain.com/documents/report.pdf`
- Website assets: `http://yourdomain.com/assets/css/style.css`

This makes the file manager perfect for:
- Website CDN (images, CSS, JavaScript)
- Sharing files with clients
- Media hosting
- Document libraries

---

## API Documentation

The File Manager provides a RESTful API for programmatic access to all file operations. This allows you to integrate the file manager into your applications, scripts, or automation workflows.

### Authentication

All API endpoints (except public file access) require authentication. The API supports **two authentication methods**:

#### Method 1: Session-Based Authentication (Traditional)

Use this method for web-based interactions or when you need temporary access.

#### Step 1: Login to Get Session Cookie

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful"
}
```

The session cookie is saved in `cookies.txt` and must be included in all subsequent requests.

#### Step 2: Use Session Cookie for API Calls

Include the cookie in all API requests using `-b cookies.txt` flag.

---

#### Method 2: API Token Authentication (Recommended for Automation)

Use this method for scripts, automation, CI/CD pipelines, or long-running processes.

##### Step 1: Generate Your API Token

**Via Web Interface:**
1. Login to the admin panel
2. Click **"⚙️ Settings"**
3. Scroll to API Token section
4. Click **"🔑 Generate New Token"**
5. Enter your password
6. **Save the token securely!**

**Via API:**
```bash
# First login to get session
curl -c cookies.txt -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username","password":"your_password"}'

# Then generate API token
curl -b cookies.txt -X POST http://localhost:3000/api/user/generate-token \
  -H "Content-Type: application/json" \
  -d '{"password":"your_password"}'
```

**Response:**
```json
{
  "success": true,
  "message": "API token generated successfully",
  "apiKey": "yknngagbkwqyga86qxeus5qd"
}
```

##### Step 2: Use API Token for API Calls

You can use the API token in two ways:

**Option A: Bearer Token (Recommended)**
```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
  http://localhost:3000/api/files
```

**Option B: URL Parameter**
```bash
curl "http://localhost:3000/api/files?apiKey=YOUR_API_TOKEN"
```

**Advantages of API Tokens:**
- ✅ No need to handle sessions or cookies
- ✅ Perfect for automation scripts
- ✅ No expiration (until manually deleted)
- ✅ Can be revoked anytime without changing password
- ✅ Each user has their own token
- ✅ Works across all API endpoints

**Security Best Practices:**
- Never commit API tokens to version control
- Store tokens in environment variables
- Regenerate tokens if compromised
- Use separate tokens for different applications
- Delete unused tokens

---

### API Endpoints

#### 🔐 Authentication Endpoints

##### Login
```http
POST /api/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful"
}
```

##### Logout
```http
POST /api/logout
Cookie: filemanager.sid=xxx
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

##### Check Auth Status
```http
GET /api/auth/status
Cookie: filemanager.sid=xxx
```

**Response:**
```json
{
  "authenticated": true,
  "username": "admin"
}
```

---

#### 👥 User Management Endpoints

##### Get Current User Info
```http
GET /api/user/me
Cookie: filemanager.sid=xxx
OR
Authorization: Bearer YOUR_API_TOKEN
```

**Response:**
```json
{
  "success": true,
  "user": {
    "username": "john",
    "role": "user",
    "hasApiKey": true,
    "apiKey": "yknngagbkwqyga86qxeus5qd",
    "createdAt": "2025-01-15T10:00:00.000Z",
    "passwordChangedAt": "2025-01-20T15:30:00.000Z",
    "apiKeyGeneratedAt": "2025-01-22T09:00:00.000Z"
  }
}
```

##### Change Password
```http
POST /api/user/change-password
Cookie: filemanager.sid=xxx
OR
Authorization: Bearer YOUR_API_TOKEN
Content-Type: application/json

{
  "oldPassword": "current_password",
  "newPassword": "new_password_min_8_chars"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

##### Generate API Token
```http
POST /api/user/generate-token
Cookie: filemanager.sid=xxx
Content-Type: application/json

{
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "API token generated successfully",
  "apiKey": "yknngagbkwqyga86qxeus5qd"
}
```

**Important:** Save this API token securely. Treat it like a password!

##### Delete API Token
```http
DELETE /api/user/delete-token
Cookie: filemanager.sid=xxx
Content-Type: application/json

{
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "API token deleted successfully"
}
```

---

#### 👮 Admin User Management Endpoints

These endpoints require admin role.

##### List All Users
```http
GET /api/admin/users
Cookie: filemanager.sid=xxx (admin session required)
OR
Authorization: Bearer ADMIN_API_TOKEN
```

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "username": "admin",
      "role": "admin",
      "hasApiKey": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "passwordChangedAt": "2025-01-10T12:00:00.000Z"
    },
    {
      "username": "john",
      "role": "user",
      "hasApiKey": false,
      "createdAt": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

##### Create User
```http
POST /api/admin/users
Cookie: filemanager.sid=xxx (admin session required)
OR
Authorization: Bearer ADMIN_API_TOKEN
Content-Type: application/json

{
  "username": "newuser",
  "role": "user"
}
```

**Response:**
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

**Important:** The password is only shown once. Save it securely!

##### Delete User
```http
DELETE /api/admin/users/{username}
Cookie: filemanager.sid=xxx (admin session required)
OR
Authorization: Bearer ADMIN_API_TOKEN
```

**Example:**
```bash
curl -b cookies.txt -X DELETE http://localhost:3000/api/admin/users/olduser

# Or with API token
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -X DELETE http://localhost:3000/api/admin/users/olduser
```

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Note:** Admins cannot delete their own account.

---

#### 📁 File & Folder Operations

##### List Files and Folders
```http
GET /api/files?path={folder_path}
Cookie: filemanager.sid=xxx
```

**Parameters:**
- `path` (optional) - Folder path to list. Empty for root directory.

**Example:**
```bash
# List root directory
curl -b cookies.txt "http://localhost:3000/api/files"

# List specific folder
curl -b cookies.txt "http://localhost:3000/api/files?path=products/images"
```

**Response:**
```json
{
  "currentPath": "products",
  "items": [
    {
      "name": "tshirt.jpg",
      "path": "products/tshirt.jpg",
      "isDirectory": false,
      "size": 245678,
      "modified": "2024-10-09T10:30:00.000Z",
      "created": "2024-10-08T14:20:00.000Z"
    },
    {
      "name": "images",
      "path": "products/images",
      "isDirectory": true,
      "size": 0,
      "modified": "2024-10-09T09:15:00.000Z",
      "created": "2024-10-08T14:20:00.000Z"
    }
  ]
}
```

##### Upload Files
```http
POST /api/upload
Cookie: filemanager.sid=xxx
Content-Type: multipart/form-data

basePath: products
files: [file1, file2, ...]
```

**Example - Upload single file:**
```bash
curl -b cookies.txt -X POST http://localhost:3000/api/upload \
  -F "basePath=products" \
  -F "files=@/path/to/image.jpg"
```

**Example - Upload multiple files:**
```bash
curl -b cookies.txt -X POST http://localhost:3000/api/upload \
  -F "basePath=products" \
  -F "files=@/path/to/image1.jpg" \
  -F "files=@/path/to/image2.jpg" \
  -F "files=@/path/to/image3.jpg"
```

**Example - Upload to root:**
```bash
curl -b cookies.txt -X POST http://localhost:3000/api/upload \
  -F "basePath=" \
  -F "files=@/path/to/file.pdf"
```

**Response:**
```json
{
  "success": true,
  "message": "3 file(s) uploaded successfully",
  "files": [
    {
      "name": "image1.jpg",
      "size": 245678,
      "path": "products/image1.jpg"
    },
    {
      "name": "image2.jpg",
      "size": 189234,
      "path": "products/image2.jpg"
    }
  ]
}
```

##### Create Folder
```http
POST /api/folder
Cookie: filemanager.sid=xxx
Content-Type: application/json

{
  "path": "products",
  "name": "new-folder"
}
```

**Example:**
```bash
# Create folder in root
curl -b cookies.txt -X POST http://localhost:3000/api/folder \
  -H "Content-Type: application/json" \
  -d '{"path":"","name":"documents"}'

# Create nested folder
curl -b cookies.txt -X POST http://localhost:3000/api/folder \
  -H "Content-Type: application/json" \
  -d '{"path":"products","name":"images"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Folder created successfully"
}
```

##### Delete File or Folder
```http
DELETE /api/delete
Cookie: filemanager.sid=xxx
Content-Type: application/json

{
  "path": "products/image.jpg"
}
```

**Example - Delete file:**
```bash
curl -b cookies.txt -X DELETE http://localhost:3000/api/delete \
  -H "Content-Type: application/json" \
  -d '{"path":"products/old-image.jpg"}'
```

**Example - Delete folder (recursive):**
```bash
curl -b cookies.txt -X DELETE http://localhost:3000/api/delete \
  -H "Content-Type: application/json" \
  -d '{"path":"products/old-folder"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Deleted successfully"
}
```

##### Rename File or Folder
```http
POST /api/rename
Cookie: filemanager.sid=xxx
Content-Type: application/json

{
  "path": "products/old-name.jpg",
  "newName": "new-name.jpg"
}
```

**Example:**
```bash
curl -b cookies.txt -X POST http://localhost:3000/api/rename \
  -H "Content-Type: application/json" \
  -d '{"path":"products/photo.jpg","newName":"tshirt.jpg"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Renamed successfully"
}
```

##### Download File
```http
GET /api/download?path={file_path}
Cookie: filemanager.sid=xxx
```

**Example:**
```bash
curl -b cookies.txt "http://localhost:3000/api/download?path=products/image.jpg" \
  -o downloaded-image.jpg
```

**Response:** Binary file data

---

#### 🔍 Search & Storage

##### Search Files
```http
GET /api/search?q={query}
Cookie: filemanager.sid=xxx
```

**Example:**
```bash
curl -b cookies.txt "http://localhost:3000/api/search?q=tshirt"
```

**Response:**
```json
{
  "results": [
    {
      "name": "tshirt.jpg",
      "path": "products/tshirt.jpg",
      "isDirectory": false,
      "size": 245678,
      "modified": "2024-10-09T10:30:00.000Z"
    },
    {
      "name": "tshirt-blue.jpg",
      "path": "products/images/tshirt-blue.jpg",
      "isDirectory": false,
      "size": 198234,
      "modified": "2024-10-09T11:45:00.000Z"
    }
  ]
}
```

##### Get Storage Statistics
```http
GET /api/storage
Cookie: filemanager.sid=xxx
```

**Example:**
```bash
curl -b cookies.txt "http://localhost:3000/api/storage"
```

**Response:**
```json
{
  "totalSize": 15728640,
  "fileCount": 42,
  "folderCount": 8
}
```

---

### Complete API Usage Examples

#### Example 1: Upload Product Images

```bash
#!/bin/bash

# Step 1: Login
curl -c cookies.txt -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Step 2: Create products folder
curl -b cookies.txt -X POST http://localhost:3000/api/folder \
  -H "Content-Type: application/json" \
  -d '{"path":"","name":"products"}'

# Step 3: Upload images
curl -b cookies.txt -X POST http://localhost:3000/api/upload \
  -F "basePath=products" \
  -F "files=@./tshirt-red.jpg" \
  -F "files=@./tshirt-blue.jpg" \
  -F "files=@./tshirt-green.jpg"

# Step 4: Verify upload
curl -b cookies.txt "http://localhost:3000/api/files?path=products"

echo "Files are now accessible at:"
echo "http://localhost:3000/products/tshirt-red.jpg"
echo "http://localhost:3000/products/tshirt-blue.jpg"
echo "http://localhost:3000/products/tshirt-green.jpg"
```

#### Example 2: Backup All Files

```bash
#!/bin/bash

# Login
curl -c cookies.txt -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get list of all files
FILES=$(curl -s -b cookies.txt "http://localhost:3000/api/files" | jq -r '.items[] | select(.isDirectory==false) | .path')

# Download each file
mkdir -p backup
for file in $FILES; do
  echo "Downloading: $file"
  curl -b cookies.txt "http://localhost:3000/api/download?path=$file" \
    -o "backup/$file" --create-dirs
done

echo "Backup complete!"
```

#### Example 3: Bulk Upload from Directory

```bash
#!/bin/bash

UPLOAD_DIR="./my-images"
TARGET_FOLDER="gallery"

# Login
curl -c cookies.txt -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Create target folder
curl -b cookies.txt -X POST http://localhost:3000/api/folder \
  -H "Content-Type: application/json" \
  -d "{\"path\":\"\",\"name\":\"$TARGET_FOLDER\"}"

# Upload all files from directory
for file in "$UPLOAD_DIR"/*; do
  if [ -f "$file" ]; then
    echo "Uploading: $(basename "$file")"
    curl -b cookies.txt -X POST http://localhost:3000/api/upload \
      -F "basePath=$TARGET_FOLDER" \
      -F "files=@$file"
  fi
done

echo "Upload complete!"
```

#### Example 4: Python Script

```python
import requests
import json

# Configuration
BASE_URL = "http://localhost:3000"
USERNAME = "admin"
PASSWORD = "admin123"

# Create session
session = requests.Session()

# Login
response = session.post(
    f"{BASE_URL}/api/login",
    json={"username": USERNAME, "password": PASSWORD}
)

if response.json()["success"]:
    print("✓ Logged in successfully")
    
    # List files
    files = session.get(f"{BASE_URL}/api/files").json()
    print(f"\nFound {len(files['items'])} items:")
    
    for item in files['items']:
        icon = "📁" if item['isDirectory'] else "📄"
        size = f"{item['size']} bytes" if not item['isDirectory'] else ""
        print(f"  {icon} {item['name']} {size}")
    
    # Upload file
    with open('example.txt', 'rb') as f:
        files_data = {'files': f}
        data = {'basePath': ''}
        response = session.post(
            f"{BASE_URL}/api/upload",
            files=files_data,
            data=data
        )
        print(f"\n✓ Upload: {response.json()['message']}")
    
    # Get storage info
    storage = session.get(f"{BASE_URL}/api/storage").json()
    print(f"\nStorage: {storage['totalSize']} bytes")
    print(f"Files: {storage['fileCount']}")
    print(f"Folders: {storage['folderCount']}")
    
    # Logout
    session.post(f"{BASE_URL}/api/logout")
    print("\n✓ Logged out")
else:
    print("✗ Login failed")
```

#### Example 5: Node.js Script

```javascript
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const USERNAME = 'admin';
const PASSWORD = 'admin123';

// Create axios instance with cookie jar
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

async function main() {
  try {
    // Login
    const loginResponse = await api.post('/api/login', {
      username: USERNAME,
      password: PASSWORD,
    });
    console.log('✓ Logged in:', loginResponse.data.message);

    // List files
    const filesResponse = await api.get('/api/files');
    console.log(`\nFound ${filesResponse.data.items.length} items`);

    // Create folder
    await api.post('/api/folder', {
      path: '',
      name: 'test-folder',
    });
    console.log('✓ Created folder: test-folder');

    // Upload file
    const formData = new FormData();
    formData.append('basePath', 'test-folder');
    formData.append('files', fs.createReadStream('./test.txt'));

    await api.post('/api/upload', formData, {
      headers: formData.getHeaders(),
    });
    console.log('✓ Uploaded file');

    // Get storage stats
    const storageResponse = await api.get('/api/storage');
    console.log('\nStorage Statistics:');
    console.log(`  Size: ${storageResponse.data.totalSize} bytes`);
    console.log(`  Files: ${storageResponse.data.fileCount}`);
    console.log(`  Folders: ${storageResponse.data.folderCount}`);

    // Logout
    await api.post('/api/logout');
    console.log('\n✓ Logged out');
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

main();
```

---

### API Error Responses

All API endpoints return consistent error responses:

#### Authentication Error (401)
```json
{
  "error": "Authentication required"
}
```

#### Validation Error (400)
```json
{
  "error": "Invalid input: folder name is required"
}
```

#### Not Found Error (404)
```json
{
  "error": "File or folder not found"
}
```

#### Server Error (500)
```json
{
  "error": "Internal server error: detailed message"
}
```

---

### API Rate Limits

Currently, there are no built-in rate limits. For production use, consider implementing rate limiting to prevent abuse.

---

### API Best Practices

1. **Reuse Session Cookies**
   - Login once and reuse the session cookie for multiple requests
   - Sessions last 24 hours

2. **Handle Errors Gracefully**
   - Always check response status codes
   - Implement retry logic for failed requests

3. **Use Appropriate Timeouts**
   - Set longer timeouts for file uploads
   - Default timeout may be too short for large files

4. **Validate Before Upload**
   - Check file sizes before uploading
   - Validate file types if needed

5. **Clean Up**
   - Logout when done to free server resources
   - Delete temporary files after operations

---

### Security Considerations for API Usage

⚠️ **Important Security Notes:**

1. **Always use HTTPS in production** - Never send credentials over HTTP
2. **Store credentials securely** - Use environment variables, never hardcode
3. **Rotate passwords regularly** - Change API credentials periodically
4. **Use IP whitelisting** - Restrict API access to known IPs if possible
5. **Monitor API usage** - Log and review API calls regularly
6. **Implement rate limiting** - Prevent brute force attacks

---

### API Troubleshooting

#### Issue: "Authentication required" on every request

**Cause:** Session cookie not being sent

**Solution:**
```bash
# Ensure you're using -b cookies.txt flag
curl -b cookies.txt "http://localhost:3000/api/files"

# Verify cookie was saved during login
cat cookies.txt
```

#### Issue: Upload fails with large files

**Cause:** Request timeout or size limit exceeded

**Solution:**
```bash
# Increase timeout
curl --max-time 600 -b cookies.txt -X POST http://localhost:3000/api/upload \
  -F "basePath=products" \
  -F "files=@large-file.zip"

# Check file size (max 100MB per file)
ls -lh large-file.zip
```

#### Issue: Path not found errors

**Cause:** Incorrect path format

**Solution:**
- Use forward slashes: `products/images` ✓
- No leading slash: `products` not `/products` ✓
- Case sensitive: match exact folder names ✓

---

## Production Deployment

### Option 1: VPS/Cloud Server (Recommended)

#### Step 1: Prepare Your Server

**Ubuntu/Debian:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

#### Step 2: Install Application

```bash
# Create directory
sudo mkdir -p /var/www/file-manager
cd /var/www/file-manager

# Upload your files (via git, scp, or ftp)
# For example, using git:
# git clone your-repo-url .

# Install dependencies
npm install --production

# Create uploads directory
mkdir -p uploads
chmod 755 uploads

# Configure environment
nano .env
```

#### Step 3: Use PM2 for Process Management

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application
pm2 start server.js --name file-manager

# Auto-start on system reboot
pm2 startup
pm2 save

# Check status
pm2 status

# View logs
pm2 logs file-manager
```

**PM2 Commands:**
```bash
pm2 restart file-manager    # Restart app
pm2 stop file-manager        # Stop app
pm2 delete file-manager      # Remove from PM2
pm2 monit                    # Monitor resources
```

#### Step 4: Configure Nginx Reverse Proxy

**Install Nginx:**
```bash
sudo apt install nginx -y
```

**Create Nginx configuration:**
```bash
sudo nano /etc/nginx/sites-available/file-manager
```

**Add this configuration:**
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Increase upload size limit
    client_max_body_size 100M;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for large uploads
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
    }
}
```

**Enable the site:**
```bash
sudo ln -s /etc/nginx/sites-available/file-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 5: Setup SSL with Let's Encrypt (HTTPS)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts to configure
```

SSL certificates auto-renew. Test renewal:
```bash
sudo certbot renew --dry-run
```

#### Step 6: Configure Firewall

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Option 2: Docker Deployment

**Create Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p uploads

EXPOSE 3000

CMD ["node", "server.js"]
```

**Create docker-compose.yml:**
```yaml
version: '3.8'

services:
  file-manager:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./uploads:/app/uploads
      - ./.env:/app/.env
    restart: unless-stopped
    environment:
      - NODE_ENV=production
```

**Deploy:**
```bash
docker-compose up -d
```

### Automated Backups

**Create backup script** (`/var/www/file-manager/backup.sh`):
```bash
#!/bin/bash

BACKUP_DIR="/var/backups/file-manager"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/var/www/file-manager"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup uploads folder
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz $APP_DIR/uploads

# Backup .env file
cp $APP_DIR/.env $BACKUP_DIR/env_$DATE.backup

# Keep only last 7 days of backups
find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "env_*.backup" -mtime +7 -delete

echo "Backup completed: $DATE"
```

**Make executable and schedule:**
```bash
chmod +x /var/www/file-manager/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e

# Add this line:
0 2 * * * /var/www/file-manager/backup.sh >> /var/log/file-manager-backup.log 2>&1
```

---

## Troubleshooting

### Cannot Login / Authentication Required Error

**Symptoms:**
- Getting "Authentication required" error after login
- Can't upload files
- Session expires immediately

**Solutions:**

1. **Hard refresh your browser:**
   - Windows/Linux: Press `Ctrl + Shift + R`
   - Mac: Press `Cmd + Shift + R`

2. **Clear browser cookies:**
   - Open DevTools (F12)
   - Go to Application → Storage → Clear site data
   - Or manually delete cookies for your domain

3. **Restart the server:**
   ```bash
   # If using PM2:
   pm2 restart file-manager
   
   # If running directly:
   # Press Ctrl+C to stop, then:
   npm start
   ```

4. **Check browser console for errors:**
   - Press F12 → Console tab
   - Look for red errors

5. **Verify .env file exists and has correct credentials**

### Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Solution 1 - Kill the process:**
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill

# Or force kill
lsof -ti:3000 | xargs kill -9
```

**Solution 2 - Change port:**
Edit `.env` file:
```env
PORT=8080
```

### Cannot Upload Files

**Error:** "Permission denied" or upload fails

**Solution:**
```bash
# Ensure uploads directory has correct permissions
chmod 755 uploads/

# If needed, change ownership
sudo chown -R $USER:$USER uploads/
```

### Files Not Accessible via Public URL

**Checks:**
1. Verify file uploaded successfully in admin panel
2. Check the exact path (case-sensitive)
3. Ensure server is running
4. Try accessing: `http://localhost:3000/filename.ext`

**Example:**
- ❌ Wrong: `http://localhost:3000/Products/image.jpg`
- ✅ Correct: `http://localhost:3000/products/image.jpg`

### Server Won't Start

**Check for errors:**
```bash
# If using PM2:
pm2 logs file-manager

# If running directly, check terminal output
```

**Common issues:**
- `.env` file missing or malformed
- Port already in use
- Node.js version too old (need v14+)
- Missing dependencies (run `npm install`)

### Slow Upload Speed

**Factors:**
- Internet connection speed
- File sizes
- Server location

**Tips:**
- Use wired connection instead of WiFi
- Upload during off-peak hours
- Split large folders into smaller batches
- Consider uploading directly to server via SFTP for very large files

### Folder Upload Not Working

**Browser Compatibility:**
- ✅ Chrome/Edge/Opera: Full support
- ✅ Firefox: Use "Upload Files" and select multiple files
- ✅ Safari: Supported with webkit prefix
- ❌ Internet Explorer: Not supported

**Solution:**
- Use a modern browser (Chrome recommended)
- For unsupported browsers, upload files individually or use FTP

### Disk Space Full

**Check disk space:**
```bash
df -h
```

**Free up space:**
```bash
# Delete old backups
rm -rf /var/backups/file-manager/uploads_*.tar.gz

# Clean package manager cache
sudo apt clean

# Remove old logs
sudo journalctl --vacuum-time=7d
```

---

## Security

### Pre-Deployment Security Checklist

- [ ] Changed default admin username
- [ ] Set strong admin password (12+ characters)
- [ ] Generated unique SESSION_SECRET
- [ ] Enabled HTTPS/SSL in production
- [ ] Configured firewall (only allow 22, 80, 443)
- [ ] Set up automated backups
- [ ] Secured .env file permissions (`chmod 600 .env`)
- [ ] Updated all dependencies to latest versions

### Strong Password Requirements

- Minimum 12 characters
- Mix of uppercase and lowercase letters
- Include numbers
- Include special characters (@, #, $, %, etc.)
- Avoid dictionary words
- Don't reuse passwords from other services

**Example:** `Xk9#mP2$qL8@nR5`

### Session Secret Best Practice

Generate a cryptographically secure random string:
```bash
openssl rand -base64 32
```

Never use default values in production!

### Security Features Included

✅ **Built-in Protection:**
- Session-based authentication
- Password-protected admin panel
- Directory traversal prevention
- Secure file path validation
- File size limits (100MB default)
- Secure cookie configuration

❌ **Not Included (Consider Adding):**
- Rate limiting for login attempts
- Two-factor authentication
- File type restrictions
- Virus scanning
- IP whitelisting

### Additional Security Recommendations

**For Production Environments:**

1. **Add Rate Limiting:**
   Install express-rate-limit to prevent brute force attacks on login

2. **Restrict File Types:**
   Modify server.js to allow only specific file extensions

3. **Enable Fail2Ban:**
   Automatically ban IPs with repeated failed login attempts

4. **Regular Updates:**
   ```bash
   npm update
   pm2 restart file-manager
   ```

5. **Monitor Logs:**
   ```bash
   pm2 logs file-manager --lines 100
   ```

6. **Use Strong Firewall Rules:**
   Only allow necessary ports and IPs

### File Permissions

**Recommended permissions:**
```bash
# Application files
chmod 644 server.js
chmod 644 package.json
chmod 600 .env

# Uploads directory
chmod 755 uploads/

# Files inside uploads
chmod 644 uploads/*
```

---

## FAQ

### Q: Can I use this for my website's CDN?
**A:** Yes! All uploaded files are publicly accessible via clean URLs, making it perfect for serving images, CSS, JavaScript, and other assets.

### Q: Is there a storage limit?
**A:** No built-in storage limit. Storage is limited only by your disk space.

### Q: Can multiple users access the admin panel?
**A:** Currently, there's only one admin account. All users share the same credentials.

### Q: Are files encrypted?
**A:** Files are stored as-is on the server. They are not encrypted at rest. Use HTTPS/SSL to encrypt data in transit.

### Q: Can I integrate this with my existing website?
**A:** Yes! Deploy it on a subdomain (e.g., files.yourdomain.com) and reference files from your main website.

### Q: What happens if I forget my password?
**A:** Edit the `.env` file on the server and change `ADMIN_PASSWORD` to a new password. Restart the application.

### Q: Can I backup my files?
**A:** Yes! The uploads directory contains all your files. You can back it up manually or use the automated backup script provided in the deployment section.

### Q: Does this work on shared hosting?
**A:** This requires Node.js support. It works on VPS, dedicated servers, and cloud platforms. Most shared hosting doesn't support Node.js applications.

### Q: Can I customize the upload size limit?
**A:** Yes. Edit `server.js` and modify the multer configuration:
```javascript
limits: { fileSize: 200 * 1024 * 1024 } // 200MB
```

### Q: Is this suitable for production?
**A:** Yes, with proper security measures. Follow the production deployment guide, use HTTPS, set strong passwords, and implement regular backups.

---

## Technical Specifications

### System Requirements

**Minimum:**
- CPU: 1 core
- RAM: 512MB
- Storage: 10GB (+ space for files)
- OS: Linux, macOS, or Windows
- Node.js: v14.0+

**Recommended:**
- CPU: 2+ cores
- RAM: 1GB+
- Storage: 50GB+ SSD
- OS: Ubuntu 20.04+ or Debian 11+
- Node.js: v18.0+

### Technology Stack

- **Backend:** Node.js + Express.js
- **Frontend:** Vanilla JavaScript (no framework)
- **Storage:** Local filesystem
- **Authentication:** Express Session
- **File Upload:** Multer

### Browser Compatibility

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 90+ | ✅ Full |
| Firefox | 88+ | ✅ Full |
| Safari | 14+ | ✅ Full |
| Edge | 90+ | ✅ Full |
| Opera | 76+ | ✅ Full |
| IE | All | ❌ Not Supported |

### API Rate Limits

No built-in rate limiting. Consider adding for production use.

---

## Changelog

### Version 2.0.0 (Latest)
- 👥 **Multi-User System** - Support for multiple users with admin/user roles
- 🔑 **API Token Authentication** - Generate personal API tokens for automation
- 🔐 **Password Management** - Users can change their passwords securely
- 🔒 **Encrypted Credentials** - All passwords hashed with bcrypt
- 📝 **User Management UI** - Admin panel for creating and managing users
- ⚙️ **User Settings Panel** - Self-service password and token management
- 🚀 **Dual Authentication** - Session-based or API token-based access
- 📊 **Role-Based Access Control** - Admin-only endpoints and features
- ✨ **Auto-Generated Passwords** - Secure random passwords for new users
- 📁 **credential.json** - Centralized user credential storage

### Version 1.0.3
- ✨ Added folder upload with complete directory structure
- 🎨 Complete UI/UX overhaul with modern design
- 📦 Support for up to 500 files per upload
- 🔧 Improved space efficiency (65% less interface chrome)
- ✅ Enhanced bulk delete functionality
- 📱 Better mobile responsiveness

### Version 1.0.2
- 🔐 Fixed authentication persistence issues
- 🍪 Improved session and cookie handling
- 📝 Added comprehensive troubleshooting guide
- 🧪 Added authentication test script

### Version 1.0.1
- 🔒 Fixed login form security (POST instead of GET)
- 📁 Fixed file upload path issues
- 🎯 Improved static file serving

### Version 1.0.0
- 🎉 Initial release
- 📤 File upload and download
- 📁 Folder management
- 🔍 Search functionality
- 🔐 Authentication system

---

## Support

### Getting Help

1. **Check this README** - Most questions are answered here
2. **Check Troubleshooting section** - Common issues and solutions
3. **Review logs** - Check terminal/PM2 logs for errors
4. **Verify configuration** - Ensure .env file is correct

### Reporting Issues

If you encounter a problem:
1. Check the Troubleshooting section first
2. Try restarting the application
3. Check browser console for errors (F12)
4. Review server logs for error messages

---

## License

ISC License

Copyright (c) 2024

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

---

## Credits

Built with:
- **Express.js** - Web framework
- **Multer** - File upload handling
- **Express-session** - Session management
- Modern vanilla JavaScript and CSS

---

**Made with ❤️ for easy file management**

For the latest updates and more information, visit the project repository.

