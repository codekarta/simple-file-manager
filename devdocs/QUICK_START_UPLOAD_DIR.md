# Quick Start: Configuring Upload Directory Outside Application

This guide shows you how to set the upload directory to a location outside your application directory, such as your Linux home directory.

## Step 1: Copy Environment File

```bash
cp .env.example .env
```

## Step 2: Edit .env File

Open the `.env` file:

```bash
nano .env
# or
vi .env
# or use your preferred editor
```

## Step 3: Set UPLOAD_DIR

### Option A: User Home Directory (Recommended for Personal Use)

```env
UPLOAD_DIR=~/filemanager-uploads
ALLOW_EXTERNAL_UPLOAD_FOLDER=true
```

**Important:** You must set `ALLOW_EXTERNAL_UPLOAD_FOLDER=true` for external paths.

This will create the uploads directory in your home folder:
- Linux: `/home/yourusername/filemanager-uploads`
- macOS: `/Users/yourusername/filemanager-uploads`

### Option B: System Directory (Recommended for Production)

```env
UPLOAD_DIR=/var/www/filemanager-uploads
ALLOW_EXTERNAL_UPLOAD_FOLDER=true
```

**Important:** You must set `ALLOW_EXTERNAL_UPLOAD_FOLDER=true` and create this directory first with proper permissions:

```bash
sudo mkdir -p /var/www/filemanager-uploads
sudo chown -R $USER:$USER /var/www/filemanager-uploads
sudo chmod 755 /var/www/filemanager-uploads
```

### Option C: Separate Storage Partition

```env
UPLOAD_DIR=/mnt/storage/uploads
ALLOW_EXTERNAL_UPLOAD_FOLDER=true
```

**Important:** You must set `ALLOW_EXTERNAL_UPLOAD_FOLDER=true` for external paths.

## Step 4: Start the Application

```bash
npm start
```

## Step 5: Verify Configuration

When the server starts, you'll see:

```
📂 Upload Directory Configuration:
   Type: home directory
   Configured: ~/filemanager-uploads
   Resolved: /home/yourusername/filemanager-uploads
   🔓 External access: Allowed (ALLOW_EXTERNAL_UPLOAD_FOLDER=true)
   Status: ✓ Directory created successfully

============================================================
🚀 File Manager Server running on http://localhost:3000
📋 Admin Panel: http://localhost:3000/admin
📖 API Docs: http://localhost:3000/api-docs
============================================================
```

### 🔒 Security Note

If you try to use an external path without setting `ALLOW_EXTERNAL_UPLOAD_FOLDER=true`, the server will refuse to start and show:

```
❌ SECURITY ERROR: Access outside application root is not allowed!

   The configured upload directory is outside the application folder.
   For security reasons, this requires explicit permission.

   To allow this, add to your .env file:
   ALLOW_EXTERNAL_UPLOAD_FOLDER=true
```

## Done! 🎉

Your files will now be stored in the configured directory, completely separate from your application code.

---

## Alternative: Use Interactive Setup Script

```bash
./setup-upload-dir.sh
```

This script will guide you through the configuration process and automatically:
- Update your `.env` file
- Create the directory
- Test permissions
- Show the final configuration

---

## Common Configurations

### For Development (Secure Default)
```env
UPLOAD_DIR=uploads
ALLOW_EXTERNAL_UPLOAD_FOLDER=false
```

### For Personal Server
```env
UPLOAD_DIR=~/Documents/filemanager
ALLOW_EXTERNAL_UPLOAD_FOLDER=true
```

### For Production VPS
```env
UPLOAD_DIR=/var/www/filemanager-uploads
ALLOW_EXTERNAL_UPLOAD_FOLDER=true
```

### For External Drive
```env
UPLOAD_DIR=/mnt/external/uploads
ALLOW_EXTERNAL_UPLOAD_FOLDER=true
```

---

## Troubleshooting

### Permission Issues

If you see permission errors:

```bash
# For home directory
mkdir -p ~/filemanager-uploads
chmod 755 ~/filemanager-uploads

# For system directory
sudo mkdir -p /var/www/filemanager-uploads
sudo chown -R $USER:$USER /var/www/filemanager-uploads
sudo chmod 755 /var/www/filemanager-uploads
```

### Verify Your Configuration

Check what's in your `.env` file:

```bash
cat .env | grep UPLOAD_DIR
```

Test if you can write to the directory:

```bash
# Replace with your path
touch ~/filemanager-uploads/.test && rm ~/filemanager-uploads/.test && echo "✓ Write access OK"
```

---

## Need More Help?

- See `UPLOAD_DIR_EXAMPLES.md` for detailed examples
- See `.env.example` for all configuration options
- See `README.md` for full documentation

