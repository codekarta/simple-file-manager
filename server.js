import express from 'express';
import session from 'express-session';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import * as credentialsManager from './credentials-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const ALLOW_EXTERNAL_UPLOAD_FOLDER = process.env.ALLOW_EXTERNAL_UPLOAD_FOLDER === 'true';

// Initialize credentials on startup
(async () => {
  await credentialsManager.initializeCredentials();
})();

// Resolve upload directory path (supports absolute paths, ~ for home, or relative paths)
function resolveUploadPath(uploadDir) {
  let resolvedPath;
  let pathType;
  let isOutsideRoot = false;
  
  // Handle tilde (~) expansion for home directory
  if (uploadDir.startsWith('~/') || uploadDir === '~') {
    resolvedPath = path.join(homedir(), uploadDir.slice(1));
    pathType = 'home directory';
    isOutsideRoot = true;
  }
  // If it's an absolute path, use it as-is
  else if (path.isAbsolute(uploadDir)) {
    resolvedPath = uploadDir;
    pathType = 'absolute path';
    isOutsideRoot = true;
  }
  // Otherwise, treat it as relative to the application directory
  else {
    resolvedPath = path.join(__dirname, uploadDir);
    pathType = 'relative path';
    isOutsideRoot = false;
  }
  
  console.log(`\n📂 Upload Directory Configuration:`);
  console.log(`   Type: ${pathType}`);
  console.log(`   Configured: ${uploadDir}`);
  console.log(`   Resolved: ${resolvedPath}`);
  
  // Security check: prevent access outside root unless explicitly allowed
  if (isOutsideRoot && !ALLOW_EXTERNAL_UPLOAD_FOLDER) {
    console.error(`\n❌ SECURITY ERROR: Access outside application root is not allowed!`);
    console.error(`\n   The configured upload directory is outside the application folder.`);
    console.error(`   For security reasons, this requires explicit permission.\n`);
    console.error(`   To allow this, add to your .env file:`);
    console.error(`   ALLOW_EXTERNAL_UPLOAD_FOLDER=true\n`);
    console.error(`   Current configuration:`);
    console.error(`   - UPLOAD_DIR=${uploadDir}`);
    console.error(`   - Resolves to: ${resolvedPath}`);
    console.error(`   - Application root: ${__dirname}\n`);
    console.error(`   ⚠️  Security Warning: Only enable this if you understand the implications.`);
    console.error(`   External paths should have proper permissions and access controls.\n`);
    process.exit(1);
  }
  
  if (isOutsideRoot && ALLOW_EXTERNAL_UPLOAD_FOLDER) {
    console.log(`   🔓 External access: Allowed (ALLOW_EXTERNAL_UPLOAD_FOLDER=true)`);
  } else {
    console.log(`   🔒 Location: Inside application root (secure)`);
  }
  
  return resolvedPath;
}

// Ensure upload directory exists
const uploadsPath = resolveUploadPath(UPLOAD_DIR);
if (!existsSync(uploadsPath)) {
  console.log(`   Status: Creating directory...`);
  fs.mkdir(uploadsPath, { recursive: true })
    .then(() => console.log(`   ✓ Directory created successfully`))
    .catch(err => {
      console.error(`   ✗ Failed to create directory: ${err.message}`);
      console.error(`\n⚠️  Please ensure the path exists and you have write permissions.`);
      console.error(`   Fix: Run 'mkdir -p ${uploadsPath}' or set a different UPLOAD_DIR in .env\n`);
      process.exit(1);
    });
} else {
  console.log(`   Status: ✓ Directory exists`);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration with proper cookie settings
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret-key',
  resave: true,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  },
  name: 'filemanager.sid'
}));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsPath);
  },
  filename: (req, file, cb) => {
    cb(null, `temp_${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { 
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 500
  }
});

// Enhanced authentication middleware supporting both session and API tokens
const requireAuth = async (req, res, next) => {
  try {
    // Check for API token in Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const apiKey = authHeader.substring(7);
      const user = await credentialsManager.getUserByApiKey(apiKey);
      
      if (user) {
        req.user = user;
        req.authMethod = 'api_token';
        return next();
      }
    }
    
    // Check for API token in query parameter
    if (req.query.apiKey || req.query.api_key) {
      const apiKey = req.query.apiKey || req.query.api_key;
      const user = await credentialsManager.getUserByApiKey(apiKey);
      
      if (user) {
        req.user = user;
        req.authMethod = 'api_token';
        return next();
      }
    }
    
    // Check session authentication
    if (req.session && req.session.authenticated) {
      req.user = await credentialsManager.getUserByUsername(req.session.username);
      req.authMethod = 'session';
      return next();
    }
    
    // No valid authentication found
    res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please provide a valid session or API token'
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Admin-only middleware
const requireAdmin = async (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ 
      error: 'Admin access required',
      message: 'This operation requires administrator privileges'
    });
  }
};

// Serve static files publicly
app.use(express.static(uploadsPath));

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve API documentation page
app.get('/api-docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'api-docs.html'));
});

// Serve admin static assets
app.get('/admin/:file', (req, res) => {
  const file = req.params.file;
  res.sendFile(path.join(__dirname, 'public', file));
});

// ===== AUTHENTICATION API ROUTES =====

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username and password are required' 
      });
    }
    
    const user = await credentialsManager.getUserByUsername(username);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }
    
    const isValid = await credentialsManager.verifyPassword(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }
    
    req.session.authenticated = true;
    req.session.username = username;
    req.session.role = user.role;
    
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ success: false, error: 'Session save failed' });
      }
      res.json({ 
        success: true, 
        message: 'Login successful',
        user: {
          username: user.username,
          role: user.role
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }
    res.clearCookie('filemanager.sid');
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Check authentication status
app.get('/api/auth/status', async (req, res) => {
  try {
    if (req.session && req.session.authenticated) {
      const userInfo = await credentialsManager.getUserInfo(req.session.username);
      res.json({ 
        authenticated: true,
        user: userInfo
      });
    } else {
      res.json({ 
        authenticated: false 
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== USER MANAGEMENT API ROUTES =====

// Get current user info
app.get('/api/user/me', requireAuth, async (req, res) => {
  try {
    const userInfo = await credentialsManager.getUserInfo(req.user.username);
    res.json({ success: true, user: userInfo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Change password
app.post('/api/user/change-password', requireAuth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Old password and new password are required' 
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: 'New password must be at least 8 characters long' 
      });
    }
    
    await credentialsManager.changePassword(
      req.user.username, 
      oldPassword, 
      newPassword
    );
    
    res.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Generate API token
app.post('/api/user/generate-token', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ 
        error: 'Password is required to generate API token' 
      });
    }
    
    const apiKey = await credentialsManager.generateApiToken(
      req.user.username, 
      password
    );
    
    res.json({ 
      success: true, 
      message: 'API token generated successfully',
      apiKey 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete API token
app.delete('/api/user/delete-token', requireAuth, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ 
        error: 'Password is required to delete API token' 
      });
    }
    
    await credentialsManager.deleteApiToken(req.user.username, password);
    
    res.json({ 
      success: true, 
      message: 'API token deleted successfully' 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== ADMIN USER MANAGEMENT API ROUTES =====

// List all users (admin only)
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await credentialsManager.listUsers();
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create user (admin only)
app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, role, password } = req.body;
    
    if (!username) {
      return res.status(400).json({ 
        error: 'Username is required' 
      });
    }
    
    // Allow simple usernames or valid email addresses
    const simpleUsernamePattern = /^[a-zA-Z0-9_-]+$/;
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!simpleUsernamePattern.test(username) && !emailPattern.test(username)) {
      return res.status(400).json({ 
        error: 'Username must be alphanumeric (with hyphens/underscores) or a valid email address' 
      });
    }
    
    const newUser = await credentialsManager.createUser(
      username, 
      role || 'user',
      password
    );
    
    res.json({ 
      success: true, 
      message: 'User created successfully',
      user: newUser
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Reset user password (admin only)
app.post('/api/admin/users/:username/reset-password', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    
    if (username === req.user.username) {
      return res.status(400).json({ 
        error: 'Cannot reset your own password. Use the change password feature instead.' 
      });
    }
    
    const newPassword = await credentialsManager.resetUserPassword(username, req.user.username);
    
    res.json({ 
      success: true, 
      message: 'Password reset successfully',
      newPassword
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete user (admin only)
app.delete('/api/admin/users/:username', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    
    await credentialsManager.deleteUser(username, req.user.username);
    
    res.json({ 
      success: true, 
      message: 'User deleted successfully' 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===== FILE MANAGEMENT API ROUTES =====

// List files and directories
app.get('/api/files', requireAuth, async (req, res) => {
  try {
    const subPath = req.query.path || '';
    const fullPath = path.join(uploadsPath, subPath);
    
    // Security check: prevent directory traversal
    if (!fullPath.startsWith(uploadsPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const items = await fs.readdir(fullPath, { withFileTypes: true });
    const fileList = await Promise.all(
      items.map(async (item) => {
        const itemPath = path.join(fullPath, item.name);
        const stats = await fs.stat(itemPath);
        const relativePath = path.relative(uploadsPath, itemPath);
        
        return {
          name: item.name,
          path: relativePath,
          isDirectory: item.isDirectory(),
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime
        };
      })
    );
    
    // Sort: directories first, then by name
    fileList.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    
    res.json({ 
      currentPath: subPath,
      items: fileList 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload file(s) or folders
app.post('/api/upload', requireAuth, upload.array('files', 500), async (req, res) => {
  try {
    const basePath = req.body.basePath || req.body.path || '';
    const relativePaths = req.body.relativePaths;
    
    const isFolderUpload = relativePaths && (Array.isArray(relativePaths) ? relativePaths.length > 0 : true);
    
    if (isFolderUpload) {
      console.log('📁 Folder upload detected');
      console.log(`Base path: ${basePath || '(root)'}`);
      console.log(`Files: ${req.files.length}`);
    }
    
    const movedFiles = [];
    const createdFolders = new Set();
    
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      let targetPath;
      let relativePath;
      
      if (relativePaths && Array.isArray(relativePaths) && relativePaths[i]) {
        relativePath = relativePaths[i];
        targetPath = path.join(uploadsPath, basePath, relativePath);
      } else if (relativePaths && !Array.isArray(relativePaths)) {
        relativePath = relativePaths;
        targetPath = path.join(uploadsPath, basePath, relativePath);
      } else {
        targetPath = path.join(uploadsPath, basePath, file.originalname);
      }
      
      const targetDir = path.dirname(targetPath);
      await fs.mkdir(targetDir, { recursive: true });
      
      if (isFolderUpload) {
        const folderPath = path.relative(uploadsPath, targetDir);
        if (folderPath) {
          createdFolders.add(folderPath);
        }
      }
      
      await fs.rename(file.path, targetPath);
      
      movedFiles.push({
        name: file.originalname,
        size: file.size,
        path: path.relative(uploadsPath, targetPath)
      });
    }
    
    if (isFolderUpload && createdFolders.size > 0) {
      console.log(`✅ Created folder structure:`);
      Array.from(createdFolders).sort().forEach(folder => {
        const depth = folder.split('/').length - 1;
        console.log(`   ${'  '.repeat(depth)}└─ ${folder.split('/').pop()}/`);
      });
      console.log(`📄 Uploaded ${movedFiles.length} files`);
    }
    
    let message;
    if (relativePaths) {
      const folderName = Array.isArray(relativePaths) 
        ? relativePaths[0].split('/')[0] 
        : relativePaths.split('/')[0];
      message = `Folder "${folderName}" uploaded successfully (${movedFiles.length} files)`;
    } else {
      message = `${movedFiles.length} file(s) uploaded successfully`;
    }
    
    res.json({ 
      success: true, 
      message,
      files: movedFiles,
      foldersCreated: createdFolders.size
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
    res.status(500).json({ error: error.message });
  }
});

// Create folder
app.post('/api/folder', requireAuth, async (req, res) => {
  try {
    const { path: subPath, name } = req.body;
    const folderPath = path.join(uploadsPath, subPath || '', name);
    
    if (!folderPath.startsWith(uploadsPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await fs.mkdir(folderPath, { recursive: true });
    res.json({ success: true, message: 'Folder created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete file or folder
app.delete('/api/delete', requireAuth, async (req, res) => {
  try {
    const { path: itemPath } = req.body;
    const fullPath = path.join(uploadsPath, itemPath);
    
    if (!fullPath.startsWith(uploadsPath) || fullPath === uploadsPath) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const stats = await fs.stat(fullPath);
    
    if (stats.isDirectory()) {
      await fs.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.unlink(fullPath);
    }
    
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rename file or folder
app.post('/api/rename', requireAuth, async (req, res) => {
  try {
    const { path: itemPath, newName } = req.body;
    const oldPath = path.join(uploadsPath, itemPath);
    const newPath = path.join(path.dirname(oldPath), newName);
    
    if (!oldPath.startsWith(uploadsPath) || !newPath.startsWith(uploadsPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await fs.rename(oldPath, newPath);
    res.json({ success: true, message: 'Renamed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download file
app.get('/api/download', requireAuth, async (req, res) => {
  try {
    const itemPath = req.query.path;
    const fullPath = path.join(uploadsPath, itemPath);
    
    if (!fullPath.startsWith(uploadsPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.download(fullPath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search files
app.get('/api/search', requireAuth, async (req, res) => {
  try {
    const query = req.query.q || '';
    const useRegex = req.query.regex === 'true';
    const results = [];
    
    // Validate regex if enabled
    let regexPattern;
    if (useRegex) {
      try {
        regexPattern = new RegExp(query, 'i'); // case-insensitive
      } catch (e) {
        return res.status(400).json({ 
          error: `Invalid regular expression: ${e.message}` 
        });
      }
    }
    
    async function searchDir(dirPath) {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        const relativePath = path.relative(uploadsPath, fullPath);
        
        // Check if filename matches
        let matches = false;
        if (useRegex) {
          matches = regexPattern.test(item.name);
        } else {
          matches = item.name.toLowerCase().includes(query.toLowerCase());
        }
        
        if (matches) {
          const stats = await fs.stat(fullPath);
          results.push({
            name: item.name,
            path: relativePath,
            isDirectory: item.isDirectory(),
            size: stats.size,
            modified: stats.mtime
          });
        }
        
        if (item.isDirectory()) {
          await searchDir(fullPath);
        }
      }
    }
    
    await searchDir(uploadsPath);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get storage info
app.get('/api/storage', requireAuth, async (req, res) => {
  try {
    let totalSize = 0;
    let fileCount = 0;
    let folderCount = 0;
    
    async function calculateSize(dirPath) {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        
        if (item.isDirectory()) {
          folderCount++;
          await calculateSize(fullPath);
        } else {
          fileCount++;
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    }
    
    await calculateSize(uploadsPath);
    
    res.json({
      totalSize,
      fileCount,
      folderCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Start server
app.listen(PORT, async () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 File Manager Server running on http://localhost:${PORT}`);
  console.log(`📋 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`📖 API Docs: http://localhost:${PORT}/api-docs`);
  console.log(`${'='.repeat(60)}\n`);
});
