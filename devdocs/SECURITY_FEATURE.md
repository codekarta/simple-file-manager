# 🔒 Security Feature: ALLOW_EXTERNAL_UPLOAD_FOLDER

## Overview

A security feature has been added to prevent accidental or malicious configuration of upload directories outside the application root. External paths now require **explicit permission** via the `ALLOW_EXTERNAL_UPLOAD_FOLDER` environment variable.

## Why This Matters

### Security Risks of External Paths

Allowing the application to write files outside its own directory can be risky:

1. **Unintended Data Exposure**: Files could be written to sensitive system directories
2. **Permission Escalation**: Potential for writing to directories with elevated permissions
3. **Accidental Misconfiguration**: Typos could lead to files being saved in wrong locations
4. **Malicious Configuration**: In shared environments, prevents unauthorized path changes

### The Solution

By default, the application **only allows** upload directories inside the application folder. To use external paths (home directory, absolute paths), you must **explicitly enable** this feature.

## Configuration

### Default (Secure)

```env
# Files stored inside application directory - no special permission needed
UPLOAD_DIR=uploads
# ALLOW_EXTERNAL_UPLOAD_FOLDER is not needed (defaults to false)
```

**Result:** ✅ Files saved to `/path/to/app/uploads/` (secure)

### External Path (Requires Permission)

```env
# Files stored outside application - requires explicit permission
UPLOAD_DIR=~/filemanager-uploads
ALLOW_EXTERNAL_UPLOAD_FOLDER=true
```

**Result:** ✅ Files saved to `/home/username/filemanager-uploads/` (allowed)

### Security Check Failed

```env
# Attempting external path WITHOUT permission
UPLOAD_DIR=~/filemanager-uploads
# ALLOW_EXTERNAL_UPLOAD_FOLDER is false or not set
```

**Result:** ❌ Server refuses to start with security error

## Behavior Matrix

| UPLOAD_DIR | ALLOW_EXTERNAL_UPLOAD_FOLDER | Result |
|------------|---------------------------|--------|
| `uploads` | `false` (default) | ✅ Allowed (internal) |
| `uploads` | `true` | ✅ Allowed (internal, permission not needed) |
| `~/path` | `false` (default) | ❌ **BLOCKED** |
| `~/path` | `true` | ✅ Allowed (explicit permission) |
| `/absolute/path` | `false` (default) | ❌ **BLOCKED** |
| `/absolute/path` | `true` | ✅ Allowed (explicit permission) |

## Error Messages

### When Security Check Fails

If you try to use an external path without permission, the server will display:

```
❌ SECURITY ERROR: Access outside application root is not allowed!

   The configured upload directory is outside the application folder.
   For security reasons, this requires explicit permission.

   To allow this, add to your .env file:
   ALLOW_EXTERNAL_UPLOAD_FOLDER=true

   Current configuration:
   - UPLOAD_DIR=~/filemanager-uploads
   - Resolves to: /home/username/filemanager-uploads
   - Application root: /path/to/application

   ⚠️  Security Warning: Only enable this if you understand the implications.
   External paths should have proper permissions and access controls.
```

The server will **exit immediately** and refuse to start until the configuration is fixed.

### When Allowed

When external access is explicitly allowed, the server displays:

```
📂 Upload Directory Configuration:
   Type: home directory
   Configured: ~/filemanager-uploads
   Resolved: /home/username/filemanager-uploads
   🔓 External access: Allowed (ALLOW_EXTERNAL_UPLOAD_FOLDER=true)
   Status: ✓ Directory exists
```

### When Internal (Secure Default)

When using internal paths, the server displays:

```
📂 Upload Directory Configuration:
   Type: relative path
   Configured: uploads
   Resolved: /path/to/app/uploads
   🔒 Location: Inside application root (secure)
   Status: ✓ Directory exists
```

## Best Practices

### ✅ Recommended

1. **Use relative paths for development**
   ```env
   UPLOAD_DIR=uploads
   ```

2. **Only enable external access when needed**
   - For production servers with dedicated storage
   - When you have proper permission controls
   - After verifying directory permissions

3. **Always verify the resolved path**
   - Check server startup logs
   - Ensure the path is what you expect

4. **Set proper directory permissions**
   ```bash
   sudo mkdir -p /your/external/path
   sudo chown -R $USER:$USER /your/external/path
   sudo chmod 755 /your/external/path
   ```

### ❌ Avoid

1. **Don't blindly enable external access**
   - Understand why you need it
   - Verify the security implications

2. **Don't use sensitive system directories**
   - Avoid `/etc/`, `/usr/`, `/var/log/`, etc.
   - Use dedicated storage locations

3. **Don't set overly permissive directory permissions**
   - Use `755` for directories
   - Use `644` for files
   - Don't use `777`

## Implementation Details

### Code Logic

```javascript
// Environment variable (defaults to false for security)
const ALLOW_EXTERNAL_UPLOAD_FOLDER = process.env.ALLOW_EXTERNAL_UPLOAD_FOLDER === 'true';

// Path resolution with security check
function resolveUploadPath(uploadDir) {
  let resolvedPath;
  let isOutsideRoot = false;
  
  if (uploadDir.startsWith('~/') || path.isAbsolute(uploadDir)) {
    // External path detected
    isOutsideRoot = true;
  }
  
  // Security check
  if (isOutsideRoot && !ALLOW_EXTERNAL_UPLOAD_FOLDER) {
    console.error('SECURITY ERROR: Access outside root not allowed!');
    process.exit(1); // Refuse to start
  }
  
  return resolvedPath;
}
```

### Key Features

- **Opt-in Security**: External access must be explicitly enabled
- **Clear Error Messages**: Tells users exactly what's wrong and how to fix it
- **Fail-Safe**: Server refuses to start with insecure configuration
- **Transparent**: Shows security status on startup

## Migration Guide

### For New Installations

No action needed! The secure default works out of the box.

```env
UPLOAD_DIR=uploads
# That's it! No external access needed
```

### For Existing Installations Using Relative Paths

No changes required. Your configuration continues to work:

```env
UPLOAD_DIR=uploads
# Existing behavior unchanged
```

### For Existing Installations Using External Paths

You must add the permission flag:

```env
# Old configuration (will now fail)
UPLOAD_DIR=~/filemanager-uploads

# New configuration (required)
UPLOAD_DIR=~/filemanager-uploads
ALLOW_EXTERNAL_UPLOAD_FOLDER=true
```

## Testing

### Test 1: Default Behavior (Secure)

```bash
# .env file
UPLOAD_DIR=uploads

# Result: ✅ Works (internal path)
```

### Test 2: External Path Without Permission

```bash
# .env file
UPLOAD_DIR=~/test-uploads

# Result: ❌ Server refuses to start with security error
```

### Test 3: External Path With Permission

```bash
# .env file
UPLOAD_DIR=~/test-uploads
ALLOW_EXTERNAL_UPLOAD_FOLDER=true

# Result: ✅ Works (explicit permission granted)
```

### Test 4: Security Check Verification

```bash
# Run security test
node -e "
import dotenv from 'dotenv';
dotenv.config();
console.log('UPLOAD_DIR:', process.env.UPLOAD_DIR);
console.log('ALLOW_EXTERNAL_UPLOAD_FOLDER:', process.env.ALLOW_EXTERNAL_UPLOAD_FOLDER);
"
```

## FAQ

### Q: Why is this needed?

**A:** To prevent accidental or malicious configuration of upload directories in sensitive system locations. Security by default.

### Q: Can I disable this check?

**A:** No, and you shouldn't want to. Simply set `ALLOW_EXTERNAL_UPLOAD_FOLDER=true` if you need external paths.

### Q: Will this break my existing setup?

**A:** Only if you're currently using external paths (home directory or absolute paths). Add `ALLOW_EXTERNAL_UPLOAD_FOLDER=true` to fix it.

### Q: What if I forget to set ALLOW_EXTERNAL_UPLOAD_FOLDER?

**A:** The server will refuse to start and show a clear error message with instructions on how to fix it.

### Q: Is ALLOW_EXTERNAL_UPLOAD_FOLDER=false more secure?

**A:** Yes! It restricts uploads to the application directory, preventing accidental writes to system directories.

### Q: Can I use ALLOW_EXTERNAL_UPLOAD_FOLDER with relative paths?

**A:** Yes, but it's not needed. Relative paths work with or without this setting.

## Security Audit Checklist

Before enabling external access:

- [ ] I understand why I need external paths
- [ ] The target directory has proper permissions
- [ ] The target directory is not a sensitive system location
- [ ] I have verified the resolved path is correct
- [ ] The application user has appropriate access rights
- [ ] I have backups configured for the external directory
- [ ] I have monitoring in place for disk space
- [ ] I have documented this configuration decision

## Summary

| Feature | Value |
|---------|-------|
| **Default Behavior** | Secure (internal paths only) |
| **External Path Support** | Yes, with explicit permission |
| **Security Model** | Opt-in (fail-safe) |
| **Error Handling** | Clear messages, refuses to start |
| **Backward Compatibility** | Yes (with one-line addition for external paths) |
| **Performance Impact** | None |

## Credits

Security feature added in response to security concerns about allowing unrestricted external path configuration.

**Version:** 2.1.0  
**Date:** October 10, 2025

