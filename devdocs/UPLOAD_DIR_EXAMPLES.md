# Upload Directory Configuration Examples

The `UPLOAD_DIR` environment variable in your `.env` file now supports multiple path formats.

## Path Format Options

### 1. Relative Path (Default)
Files stored relative to the application directory.

```env
UPLOAD_DIR=uploads
```

Result: `<app-directory>/uploads/`

---

### 2. Absolute Path
Specify any absolute path on your system.

```env
# Linux/Mac examples
UPLOAD_DIR=/var/www/filemanager-uploads
UPLOAD_DIR=/opt/storage/uploads
UPLOAD_DIR=/mnt/data/uploads

# Windows examples (if applicable)
UPLOAD_DIR=C:/uploads
UPLOAD_DIR=D:/filemanager/uploads
```

---

### 3. Home Directory Path (Linux/Mac)
Use `~` to reference the current user's home directory.

```env
UPLOAD_DIR=~/filemanager-uploads
UPLOAD_DIR=~/Documents/uploads
UPLOAD_DIR=~/storage/files
```

**Examples:**
- If running as user `john`: `~/uploads` becomes `/home/john/uploads`
- If running as user `ubuntu`: `~/uploads` becomes `/home/ubuntu/uploads`
- On macOS: `~/uploads` becomes `/Users/username/uploads`

---

## Setup Instructions

### For Linux User Home Directory

1. **Edit your `.env` file:**
   ```bash
   nano .env
   ```

2. **Set the upload directory:**
   ```env
   UPLOAD_DIR=~/filemanager-uploads
   ```

3. **Save and restart the application:**
   ```bash
   npm start
   # or if using PM2
   pm2 restart file-manager
   ```

4. **Verify the path:**
   - Check the console output when the server starts
   - It will show: `📁 Upload directory: /home/username/filemanager-uploads`

---

### For System-Wide Directory

1. **Create the directory with proper permissions:**
   ```bash
   sudo mkdir -p /var/www/filemanager-uploads
   sudo chown -R $USER:$USER /var/www/filemanager-uploads
   sudo chmod 755 /var/www/filemanager-uploads
   ```

2. **Edit your `.env` file:**
   ```env
   UPLOAD_DIR=/var/www/filemanager-uploads
   ```

3. **Restart the application:**
   ```bash
   npm start
   # or if using PM2
   pm2 restart file-manager
   ```

---

### For Separate Partition/Mount Point

If you have a separate storage partition:

1. **Mount your storage (if not already mounted):**
   ```bash
   # Check mounted filesystems
   df -h
   
   # Example: /mnt/storage is your mounted partition
   ```

2. **Create upload directory:**
   ```bash
   sudo mkdir -p /mnt/storage/uploads
   sudo chown -R $USER:$USER /mnt/storage/uploads
   sudo chmod 755 /mnt/storage/uploads
   ```

3. **Configure `.env`:**
   ```env
   UPLOAD_DIR=/mnt/storage/uploads
   ```

4. **Restart the application**

---

## Permissions

### Required Permissions

The user running the Node.js process needs:
- **Read** permission to list files
- **Write** permission to upload files
- **Execute** permission to access directories

### Setting Permissions

```bash
# Give ownership to your user
sudo chown -R $USER:$USER /path/to/uploads

# Set directory permissions (755 = rwxr-xr-x)
sudo chmod 755 /path/to/uploads

# Set file permissions (644 = rw-r--r--)
sudo chmod 644 /path/to/uploads/*
```

### Permission Check

```bash
# Check if you have write access
touch /path/to/uploads/test.txt && rm /path/to/uploads/test.txt && echo "Write access OK" || echo "No write access"
```

---

## Benefits of Using External Directory

### 1. **Separation of Code and Data**
   - Code updates don't affect uploaded files
   - Easier to backup just the data directory

### 2. **Storage Management**
   - Use a separate partition with more space
   - Easy to expand storage without moving code

### 3. **Security**
   - Keep uploads outside the web root
   - Easier to set specific permissions

### 4. **Backup Strategy**
   - Backup only the upload directory
   - Exclude from code repository

---

## Troubleshooting

### Issue: "Permission denied" error on startup

**Solution:**
```bash
# Check ownership
ls -la /path/to/uploads

# Fix ownership
sudo chown -R $USER:$USER /path/to/uploads

# Fix permissions
sudo chmod 755 /path/to/uploads
```

---

### Issue: Directory not created automatically

**Reason:** Parent directories don't exist or lack permissions

**Solution:**
```bash
# Create all parent directories
sudo mkdir -p /path/to/uploads

# Set ownership
sudo chown -R $USER:$USER /path/to/uploads
```

---

### Issue: "ENOENT: no such file or directory" when uploading

**Solution:**
1. Check if the path in `.env` is correct
2. Restart the application after changing `.env`
3. Verify the directory exists:
   ```bash
   ls -la /path/to/uploads
   ```

---

## Example: Complete Setup for Production

```bash
# 1. Create directory in user home
mkdir -p ~/production-uploads

# 2. Set proper permissions
chmod 755 ~/production-uploads

# 3. Update .env file
echo "UPLOAD_DIR=~/production-uploads" >> .env

# 4. Restart application
pm2 restart file-manager

# 5. Verify in logs
pm2 logs file-manager | grep "Upload directory"
```

---

## Notes

- **Automatic Creation:** The directory will be created automatically if it doesn't exist (including parent directories)
- **Path Validation:** The application validates the path on startup
- **Console Output:** The resolved absolute path is displayed when the server starts
- **Environment Variable:** Changes to `.env` require a server restart to take effect

---

## Recommended Setups

### Development
```env
UPLOAD_DIR=uploads
```

### Production (System-wide)
```env
UPLOAD_DIR=/var/www/filemanager-uploads
```

### Production (User Home)
```env
UPLOAD_DIR=~/filemanager-uploads
```

### Production (Separate Storage)
```env
UPLOAD_DIR=/mnt/storage/filemanager/uploads
```

