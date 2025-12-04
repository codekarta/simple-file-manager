# Upload Directory Configuration Feature

## Summary

The application now supports configuring the upload directory to be stored **outside the application directory**, including:
- ✅ User home directory (`~/path`)
- ✅ Absolute paths (`/var/www/uploads`)
- ✅ Relative paths (default: `uploads`)

## Changes Made

### 1. Server Configuration (`server.js`)

**Added:**
- Import of `homedir` from `os` module for home directory expansion
- `resolveUploadPath()` function that handles all three path types
- Console output showing upload directory configuration on startup
- Explicit error handling with helpful messages if directory creation fails

**Behavior:**
- Automatically resolves `~` to the user's home directory
- Detects and uses absolute paths as-is
- Falls back to relative paths (application directory)
- Creates the directory automatically if it doesn't exist
- Shows detailed configuration on server startup

### 2. Environment Configuration

**Created `.env.example`:**
- Comprehensive documentation of all configuration options
- Clear examples for each path type (relative, absolute, home)
- Platform-specific examples (Linux/Mac/Windows)
- Step-by-step setup instructions
- Security warnings and best practices

### 3. Documentation

**Updated `README.md`:**
- Added detailed Storage Configuration section
- Updated Environment Variables table
- Added examples for all path types
- Included permission setup instructions
- Added notes about automatic directory creation

**Created `UPLOAD_DIR_EXAMPLES.md`:**
- Complete guide with multiple examples
- Troubleshooting section
- Permission management guide
- Production deployment recommendations

**Created `setup-upload-dir.sh`:**
- Interactive script to configure upload directory
- Test directory permissions
- Show current configuration
- Create directories with proper permissions

## Usage Examples

### Example 1: User Home Directory
```env
UPLOAD_DIR=~/filemanager-uploads
```
Result: `/home/username/filemanager-uploads`

### Example 2: Absolute Path
```env
UPLOAD_DIR=/var/www/filemanager-uploads
```
Result: `/var/www/filemanager-uploads`

### Example 3: Relative Path (Default)
```env
UPLOAD_DIR=uploads
```
Result: `<app-directory>/uploads`

## Server Startup Output

When the server starts, it now displays:

```
📂 Upload Directory Configuration:
   Type: home directory
   Configured: ~/filemanager-uploads
   Resolved: /home/username/filemanager-uploads
   Status: ✓ Directory exists

============================================================
🚀 File Manager Server running on http://localhost:3000
📋 Admin Panel: http://localhost:3000/admin
📖 API Docs: http://localhost:3000/api-docs
============================================================
```

## Benefits

1. **Separation of Concerns**: Keep uploaded files separate from application code
2. **Flexible Storage**: Use any location on the filesystem
3. **Easy Backups**: Backup just the upload directory without code
4. **Storage Management**: Use separate partitions or external drives
5. **Security**: Store files outside web root if needed
6. **Multi-Environment**: Different paths for dev/staging/production

## Migration Guide

### For Existing Installations

If you're already using the default `uploads` directory:

**Option 1: Keep Current Setup (No Changes Needed)**
```env
UPLOAD_DIR=uploads
```

**Option 2: Move to Home Directory**
```bash
# 1. Create new directory
mkdir -p ~/filemanager-uploads

# 2. Move existing files
mv uploads/* ~/filemanager-uploads/

# 3. Update .env
echo "UPLOAD_DIR=~/filemanager-uploads" >> .env

# 4. Restart server
pm2 restart file-manager
```

**Option 3: Move to System Directory**
```bash
# 1. Create directory with proper permissions
sudo mkdir -p /var/www/filemanager-uploads
sudo chown -R $USER:$USER /var/www/filemanager-uploads

# 2. Move existing files
sudo mv uploads/* /var/www/filemanager-uploads/

# 3. Update .env
echo "UPLOAD_DIR=/var/www/filemanager-uploads" >> .env

# 4. Restart server
pm2 restart file-manager
```

## Setup Assistant

Use the interactive setup script:

```bash
./setup-upload-dir.sh
```

Options:
1. Configure relative path
2. Configure user home directory
3. Configure absolute path
4. Show current configuration
5. Test directory permissions

## Troubleshooting

### Issue: Permission Denied

**Solution:**
```bash
# For home directory
chmod 755 ~/filemanager-uploads

# For system directory
sudo chown -R $USER:$USER /path/to/uploads
sudo chmod 755 /path/to/uploads
```

### Issue: Directory Not Created

**Check:**
1. Parent directories exist
2. Process has write permission
3. SELinux/AppArmor policies (Linux)

**Fix:**
```bash
# Create manually
mkdir -p /path/to/uploads
sudo chown $USER:$USER /path/to/uploads
```

### Issue: Wrong Path Shown

**Verify:**
```bash
# Check .env file
cat .env | grep UPLOAD_DIR

# Test resolution
node -e "console.log(require('os').homedir())"
```

## Testing

Test the configuration:

```bash
# Using the setup script
./setup-upload-dir.sh
# Choose option 5 to test permissions

# Or manually
touch /path/to/uploads/.test && rm /path/to/uploads/.test
```

## Environment-Specific Configurations

### Development
```env
UPLOAD_DIR=uploads
```

### Staging
```env
UPLOAD_DIR=/opt/staging/filemanager-uploads
```

### Production
```env
UPLOAD_DIR=/var/www/filemanager-uploads
```

## Security Considerations

1. **Permissions**: Use `755` for directories, `644` for files
2. **Ownership**: Ensure the Node.js process user owns the directory
3. **Isolation**: Consider using separate partitions for uploads
4. **Backups**: Regular backups of the upload directory
5. **Monitoring**: Monitor disk space usage

## Files Modified/Created

### Modified:
- `server.js` - Added path resolution logic
- `README.md` - Updated documentation

### Created:
- `.env.example` - Comprehensive configuration template
- `UPLOAD_DIR_EXAMPLES.md` - Detailed examples guide
- `setup-upload-dir.sh` - Interactive setup script
- `CHANGELOG_UPLOAD_DIR.md` - This file

## Backward Compatibility

✅ **Fully backward compatible**
- Existing `UPLOAD_DIR=uploads` configuration works as before
- No breaking changes
- Default behavior unchanged

## Version

Feature added: Version 2.1.0
Date: October 10, 2025

