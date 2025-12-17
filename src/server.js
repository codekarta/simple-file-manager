import express from 'express';
import session from 'express-session';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, statSync, createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import archiver from 'archiver';
import * as credentialsManager from './credentials-manager.js';
import * as fileCache from './file-cache.js';
import * as thumbnailGenerator from './thumbnail-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const ALLOW_EXTERNAL_UPLOAD_FOLDER = process.env.ALLOW_EXTERNAL_UPLOAD_FOLDER === 'true';

// Cache configuration
const CACHE_ENABLED = process.env.CACHE_ENABLED !== 'false'; // Default: true
const CACHE_DB_PATH = process.env.CACHE_DB_PATH || './.cache/files.db';
const CACHE_SYNC_INTERVAL = ALLOW_EXTERNAL_UPLOAD_FOLDER
  ? parseInt(process.env.CACHE_SYNC_INTERVAL_EXTERNAL) || 300000   // 5 min for external
  : parseInt(process.env.CACHE_SYNC_INTERVAL_INTERNAL) || 600000;  // 10 min for internal

// Initialize credentials on startup
(async () => {
  await credentialsManager.initializeCredentials();
})();

// Project root directory (one level up from src)
const projectRoot = path.join(__dirname, '..');

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
  // Otherwise, treat it as relative to the project root directory
  else {
    resolvedPath = path.join(projectRoot, uploadDir);
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
    console.error(`   - Application root: ${projectRoot}\n`);
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

// Initialize thumbnail generator
thumbnailGenerator.initialize(uploadsPath);

// Middleware - explicitly specify content types to avoid parsing multipart as JSON
app.use(express.json({ limit: '50mb', type: 'application/json' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Handle JSON parsing errors gracefully
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});

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

// Thumbnail serving middleware with access control
app.use('/thumb', async (req, res, next) => {
  const decodedPath = decodeURIComponent(req.path);
  const relativePath = decodedPath.startsWith('/') ? decodedPath.slice(1) : decodedPath;
  const thumbnailBasePath = thumbnailGenerator.getThumbnailBasePath();
  
  if (!thumbnailBasePath) {
    return res.status(503).json({ error: 'Thumbnail service not initialized' });
  }
  
  const fullPath = path.join(thumbnailBasePath, relativePath);
  
  // Security check: prevent directory traversal
  if (!fullPath.startsWith(thumbnailBasePath)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Check if thumbnail exists
  if (!existsSync(fullPath)) {
    console.log(`Thumbnail not found: ${fullPath}`);
    return res.status(404).json({ error: 'Thumbnail not found', path: relativePath });
  }
  
  // Find the original file path to check access level
  // Thumbnail is name.webp, need to find original (name.jpg, name.png, etc.)
  const thumbnailDir = path.dirname(relativePath);
  const thumbnailBasename = path.basename(relativePath, '.webp');
  
  // Try to find the original file to check its access level
  let originalRelativePath = null;
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp'];
  
  for (const ext of imageExtensions) {
    const possiblePath = thumbnailDir ? `${thumbnailDir}/${thumbnailBasename}${ext}` : `${thumbnailBasename}${ext}`;
    const possibleFullPath = path.join(uploadsPath, possiblePath);
    if (existsSync(possibleFullPath)) {
      originalRelativePath = possiblePath;
      break;
    }
  }
  
  // Check access level of original file (if found)
  let accessLevel = 'public';
  if (originalRelativePath && fileCache.isReady()) {
    try {
      accessLevel = fileCache.getAccessLevel(originalRelativePath);
    } catch (e) {
      // Default to public if cache fails
    }
  }
  
  // If private, check authentication
  if (accessLevel === 'private') {
    let isAuthenticated = false;
    
    // Check session authentication
    if (req.session && req.session.authenticated) {
      isAuthenticated = true;
    }
    
    // Check for API token in query parameter
    if (!isAuthenticated && (req.query.apiKey || req.query.api_key)) {
      const apiKey = req.query.apiKey || req.query.api_key;
      try {
        const user = await credentialsManager.getUserByApiKey(apiKey);
        if (user) {
          isAuthenticated = true;
        }
      } catch (e) {
        // Ignore auth errors
      }
    }
    
    // Check for API token in Authorization header
    if (!isAuthenticated) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const apiKey = authHeader.substring(7);
        try {
          const user = await credentialsManager.getUserByApiKey(apiKey);
          if (user) {
            isAuthenticated = true;
          }
        } catch (e) {
          // Ignore auth errors
        }
      }
    }
    
    if (!isAuthenticated) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'This thumbnail is private. Please provide a valid session or API token.'
      });
    }
  }
  
  // Serve the thumbnail using stream (more reliable than sendFile)
  try {
    const stat = statSync(fullPath);
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    const readStream = createReadStream(fullPath);
    readStream.on('error', (err) => {
      console.error('Error streaming thumbnail:', fullPath, err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to serve thumbnail' });
      }
    });
    readStream.pipe(res);
  } catch (err) {
    console.error('Error serving thumbnail:', fullPath, err.message);
    res.status(500).json({ error: 'Failed to serve thumbnail' });
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

// Serve static assets from public folder (React build output)
// This MUST come before the auth-aware uploads middleware
app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets'), {
  maxAge: '1y', // Cache assets for 1 year (they have hashes in filenames)
  immutable: true
}));

// Serve other static files from public folder (favicon, etc.)
app.use(express.static(path.join(__dirname, '..', 'public'), {
  index: false // Don't serve index.html for / - we handle that separately
}));

// Auth-aware static file middleware for public/private access control
// Public files: accessible to everyone
// Private files: require session or API token authentication
app.use(async (req, res, next) => {
  // Skip API routes, admin routes, and thumbnail routes
  if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path.startsWith('/thumb') || req.path === '/api-docs' || req.path === '/llms.md') {
    return next();
  }
  
  // Decode URL-encoded path
  const decodedPath = decodeURIComponent(req.path);
  const relativePath = decodedPath.startsWith('/') ? decodedPath.slice(1) : decodedPath;
  const fullPath = path.join(uploadsPath, relativePath);
  
  // Security check: prevent directory traversal
  if (!fullPath.startsWith(uploadsPath)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Check if file exists
  if (!existsSync(fullPath)) {
    return next(); // Let other handlers deal with 404
  }
  
  // Get effective access level (checks file and parent hierarchy)
  let accessLevel = 'public';
  if (fileCache.isReady()) {
    try {
      accessLevel = fileCache.getAccessLevel(relativePath);
    } catch (e) {
      // If cache fails, default to public for backwards compatibility
      console.warn('Cache access level check failed:', e.message);
    }
  }
  
  // If private, check authentication
  if (accessLevel === 'private') {
    let isAuthenticated = false;
    
    // Check session authentication
    if (req.session && req.session.authenticated) {
      isAuthenticated = true;
    }
    
    // Check for API token in query parameter
    if (!isAuthenticated && (req.query.apiKey || req.query.api_key)) {
      const apiKey = req.query.apiKey || req.query.api_key;
      try {
        const user = await credentialsManager.getUserByApiKey(apiKey);
        if (user) {
          isAuthenticated = true;
        }
      } catch (e) {
        // Ignore auth errors
      }
    }
    
    // Check for API token in Authorization header
    if (!isAuthenticated) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const apiKey = authHeader.substring(7);
        try {
          const user = await credentialsManager.getUserByApiKey(apiKey);
          if (user) {
            isAuthenticated = true;
          }
        } catch (e) {
          // Ignore auth errors
        }
      }
    }
    
    if (!isAuthenticated) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'This file is private. Please provide a valid session or API token.'
      });
    }
  }
  
  // Serve the file (public or authenticated private)
  return res.sendFile(fullPath);
});

// Serve admin panel (React app)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Serve API documentation page
app.get('/api-docs', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'api-docs.html'));
});

// Serve LLM-friendly markdown documentation
app.get('/llms.md', (req, res) => {
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.sendFile(path.join(__dirname, '..', 'public', 'Simple-file-server-llms.md'));
});

// ===== HEALTH CHECK API ROUTE =====

// Health check endpoint (no authentication required)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'Simple File Manager'
  });
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
    const { customPassword } = req.body;
    
    if (username === req.user.username) {
      return res.status(400).json({ 
        error: 'Cannot reset your own password. Use the change password feature instead.' 
      });
    }
    
    // Validate custom password if provided
    if (customPassword !== undefined && customPassword !== null) {
      if (customPassword.length < 8) {
        return res.status(400).json({ 
          error: 'Password must be at least 8 characters long' 
        });
      }
    }
    
    const newPassword = await credentialsManager.resetUserPassword(username, req.user.username, customPassword);
    
    res.json({ 
      success: true, 
      message: 'Password reset successfully',
      newPassword: customPassword ? undefined : newPassword // Only return password if auto-generated
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

// List files and directories with pagination
app.get('/api/files', requireAuth, async (req, res) => {
  try {
    const subPath = req.query.path || '';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
    const showHidden = req.query.showHidden === 'true';
    const fullPath = path.join(uploadsPath, subPath);
    
    // Security check: prevent directory traversal
    if (!fullPath.startsWith(uploadsPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Try cache first, fallback to filesystem
    if (fileCache.isReady()) {
      try {
        const { items, total } = fileCache.getFiles(subPath, page, limit, showHidden);
        // Add thumbnailUrl for image files
        const itemsWithThumbnails = items.map(item => ({
          ...item,
          thumbnailUrl: !item.isDirectory ? thumbnailGenerator.getThumbnailUrl(item.path) : null
        }));
        return res.json({
          currentPath: subPath,
          items: itemsWithThumbnails,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1
          }
        });
      } catch (cacheError) {
        console.error('Cache error, falling back to filesystem:', cacheError.message);
      }
    }
    
    // Filesystem fallback with pagination
    const allItems = await fs.readdir(fullPath, { withFileTypes: true });
    let fileList = await Promise.all(
      allItems
        .filter(item => !item.isSymbolicLink()) // Skip symlinks
        .filter(item => showHidden || !item.name.startsWith('.')) // Filter hidden files
        .map(async (item) => {
          const itemPath = path.join(fullPath, item.name);
          const stats = await fs.stat(itemPath);
          const relativePath = path.relative(uploadsPath, itemPath);
          
          // Get access level from cache if available
          let accessLevel = 'public';
          if (fileCache.isReady()) {
            try {
              const fileInfo = fileCache.getFileInfo(relativePath);
              if (fileInfo) {
                accessLevel = fileInfo.accessLevel;
              }
            } catch (e) {
              // Default to public if cache fails
            }
          }
          
          const isDir = item.isDirectory();
          return {
            name: item.name,
            path: relativePath,
            isDirectory: isDir,
            size: stats.size,
            modified: stats.mtime,
            created: stats.birthtime,
            accessLevel,
            thumbnailUrl: !isDir ? thumbnailGenerator.getThumbnailUrl(relativePath) : null
          };
        })
    );
    
    // Sort: directories first, then by name (case-insensitive)
    fileList.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
    
    // Apply pagination
    const total = fileList.length;
    const offset = (page - 1) * limit;
    const paginatedItems = fileList.slice(offset, offset + limit);
    
    res.json({ 
      currentPath: subPath,
      items: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
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
    const accessLevel = req.body.mediaAccessLevel || 'public'; // Default to public
    
    // Validate access level
    if (!['public', 'private'].includes(accessLevel)) {
      return res.status(400).json({ 
        error: 'Invalid mediaAccessLevel. Must be "public" or "private"' 
      });
    }
    
    const isFolderUpload = relativePaths && (Array.isArray(relativePaths) ? relativePaths.length > 0 : true);
    
    if (isFolderUpload) {
      console.log('📁 Folder upload detected');
      console.log(`Base path: ${basePath || '(root)'}`);
      console.log(`Files: ${req.files.length}`);
      console.log(`Access level: ${accessLevel}`);
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
      
      const fileRelativePath = path.relative(uploadsPath, targetPath);
      movedFiles.push({
        name: file.originalname,
        size: file.size,
        path: fileRelativePath,
        accessLevel
      });
      
      // Update cache for uploaded file with access level
      try {
        const stats = await fs.stat(targetPath);
        fileCache.addFile(fileRelativePath, {
          size: stats.size,
          modified: stats.mtimeMs,
          created: stats.birthtimeMs,
          isDirectory: false
        }, accessLevel);
      } catch (cacheErr) {
        // Don't fail upload if cache update fails
        console.warn('Cache update failed for file:', fileRelativePath);
      }
      
      // Generate thumbnail for images (non-blocking)
      if (thumbnailGenerator.isImageFile(file.originalname)) {
        thumbnailGenerator.generateThumbnail(fileRelativePath).catch(err => {
          console.warn('Thumbnail generation failed for:', fileRelativePath, err.message);
        });
      }
    }
    
    // Update cache for created folders with access level
    for (const folderPath of createdFolders) {
      try {
        const fullFolderPath = path.join(uploadsPath, folderPath);
        const stats = await fs.stat(fullFolderPath);
        fileCache.addFile(folderPath, {
          size: 0,
          modified: stats.mtimeMs,
          created: stats.birthtimeMs,
          isDirectory: true
        }, accessLevel);
      } catch (cacheErr) {
        // Don't fail upload if cache update fails
        console.warn('Cache update failed for folder:', folderPath);
      }
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
      foldersCreated: createdFolders.size,
      accessLevel
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
    const { path: subPath, name, mediaAccessLevel } = req.body;
    const accessLevel = mediaAccessLevel || 'public'; // Default to public
    const folderPath = path.join(uploadsPath, subPath || '', name);
    
    // Validate access level
    if (!['public', 'private'].includes(accessLevel)) {
      return res.status(400).json({ 
        error: 'Invalid mediaAccessLevel. Must be "public" or "private"' 
      });
    }
    
    if (!folderPath.startsWith(uploadsPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await fs.mkdir(folderPath, { recursive: true });
    
    // Update cache with access level
    try {
      const relativePath = path.relative(uploadsPath, folderPath);
      const stats = await fs.stat(folderPath);
      fileCache.addFile(relativePath, {
        size: 0,
        modified: stats.mtimeMs,
        created: stats.birthtimeMs,
        isDirectory: true
      }, accessLevel);
    } catch (cacheErr) {
      console.warn('Cache update failed for new folder:', name);
    }
    
    res.json({ 
      success: true, 
      message: 'Folder created successfully',
      accessLevel
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new file
app.post('/api/file', requireAuth, async (req, res) => {
  try {
    const { path: subPath, name, content, mediaAccessLevel } = req.body;
    const accessLevel = mediaAccessLevel || 'public'; // Default to public
    
    if (!name) {
      return res.status(400).json({ error: 'File name is required' });
    }
    
    // Validate access level
    if (!['public', 'private'].includes(accessLevel)) {
      return res.status(400).json({
        error: 'Invalid mediaAccessLevel. Must be "public" or "private"'
      });
    }
    
    // Sanitize filename - remove path separators and dangerous characters
    const sanitizedName = name.replace(/[\/\\:*?"<>|]/g, '_');
    const filePath = path.join(uploadsPath, subPath || '', sanitizedName);
    
    if (!filePath.startsWith(uploadsPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if file already exists
    try {
      await fs.access(filePath);
      return res.status(409).json({ error: 'A file with this name already exists' });
    } catch {
      // File doesn't exist, continue
    }
    
    // Ensure parent directory exists
    const parentDir = path.dirname(filePath);
    await fs.mkdir(parentDir, { recursive: true });
    
    // Write file with content (or empty string if no content)
    await fs.writeFile(filePath, content || '', 'utf8');
    
    // Update cache with access level
    try {
      const relativePath = path.relative(uploadsPath, filePath);
      const stats = await fs.stat(filePath);
      fileCache.addFile(relativePath, {
        size: stats.size,
        modified: stats.mtimeMs,
        created: stats.birthtimeMs,
        isDirectory: false
      }, accessLevel);
    } catch (cacheErr) {
      console.warn('Cache update failed for new file:', sanitizedName);
    }
    
    res.json({
      success: true,
      message: 'File created successfully',
      fileName: sanitizedName,
      accessLevel
    });
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
    const isDirectory = stats.isDirectory();
    
    if (isDirectory) {
      await fs.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.unlink(fullPath);
    }
    
    // Update cache (deleteFile handles recursive deletion for directories)
    try {
      fileCache.deleteFile(itemPath);
    } catch (cacheErr) {
      console.warn('Cache update failed for delete:', itemPath);
    }
    
    // Delete corresponding thumbnail(s)
    try {
      if (isDirectory) {
        await thumbnailGenerator.deleteThumbnailDirectory(itemPath);
      } else if (thumbnailGenerator.isImageFile(itemPath)) {
        await thumbnailGenerator.deleteThumbnail(itemPath);
      }
    } catch (thumbErr) {
      console.warn('Thumbnail delete failed for:', itemPath, thumbErr.message);
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
    
    // Check if it's a directory before renaming
    const stats = await fs.stat(oldPath);
    const isDirectory = stats.isDirectory();
    
    await fs.rename(oldPath, newPath);
    
    const newRelativePath = path.relative(uploadsPath, newPath);
    
    // Update cache (renameFile handles recursive path updates for directories)
    try {
      fileCache.renameFile(itemPath, newRelativePath);
    } catch (cacheErr) {
      console.warn('Cache update failed for rename:', itemPath);
    }
    
    // Rename corresponding thumbnail(s)
    try {
      if (isDirectory) {
        await thumbnailGenerator.renameThumbnailDirectory(itemPath, newRelativePath);
      } else if (thumbnailGenerator.isImageFile(itemPath) && thumbnailGenerator.isImageFile(newRelativePath)) {
        await thumbnailGenerator.renameThumbnail(itemPath, newRelativePath);
      } else if (thumbnailGenerator.isImageFile(itemPath) && !thumbnailGenerator.isImageFile(newRelativePath)) {
        // If renamed from image to non-image, delete the thumbnail
        await thumbnailGenerator.deleteThumbnail(itemPath);
      } else if (!thumbnailGenerator.isImageFile(itemPath) && thumbnailGenerator.isImageFile(newRelativePath)) {
        // If renamed from non-image to image, generate thumbnail
        thumbnailGenerator.generateThumbnail(newRelativePath).catch(err => {
          console.warn('Thumbnail generation failed for:', newRelativePath, err.message);
        });
      }
    } catch (thumbErr) {
      console.warn('Thumbnail rename failed for:', itemPath, thumbErr.message);
    }
    
    res.json({ success: true, message: 'Renamed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Duplicate file or folder
app.post('/api/duplicate', requireAuth, async (req, res) => {
  try {
    const { path: itemPath } = req.body;
    if (!itemPath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const sourcePath = path.join(uploadsPath, itemPath);
    
    if (!sourcePath.startsWith(uploadsPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!existsSync(sourcePath)) {
      return res.status(404).json({ error: 'File or folder not found' });
    }

    const stats = await fs.stat(sourcePath);
    const isDirectory = stats.isDirectory();
    const dirName = path.dirname(sourcePath);
    const baseName = path.basename(sourcePath);
    const ext = path.extname(baseName);
    const nameWithoutExt = path.basename(baseName, ext);

    // Generate new name with (copy) suffix
    let newName = isDirectory 
      ? `${baseName} (copy)`
      : `${nameWithoutExt} (copy)${ext}`;
    let newPath = path.join(dirName, newName);
    let counter = 1;

    // If name exists, increment counter
    while (existsSync(newPath)) {
      counter++;
      newName = isDirectory
        ? `${baseName} (copy ${counter})`
        : `${nameWithoutExt} (copy ${counter})${ext}`;
      newPath = path.join(dirName, newName);
    }

    // Copy file or directory
    if (isDirectory) {
      // Recursively copy directory
      await fs.cp(sourcePath, newPath, { recursive: true });
    } else {
      // Copy file
      await fs.copyFile(sourcePath, newPath);
    }

    const newRelativePath = path.relative(uploadsPath, newPath);

    // Update cache
    try {
      if (isDirectory) {
        // For directories, we need to rebuild cache for that path
        // Or add all files recursively - for now, trigger a sync
        fileCache.syncDirectory(path.relative(uploadsPath, dirName));
      } else {
        // Add single file to cache
        const newStats = await fs.stat(newPath);
        const accessLevel = fileCache.isReady() 
          ? fileCache.getAccessLevel(itemPath) 
          : 'public';
        fileCache.addFile(newRelativePath, newStats, accessLevel);
      }
    } catch (cacheErr) {
      console.warn('Cache update failed for duplicate:', itemPath);
    }

    // Copy thumbnail if it's an image file
    if (!isDirectory && thumbnailGenerator.isImageFile(itemPath)) {
      try {
        const oldThumbPath = thumbnailGenerator.getThumbnailFullPath(itemPath);
        const newThumbPath = thumbnailGenerator.getThumbnailFullPath(newRelativePath);
        if (existsSync(oldThumbPath)) {
          await fs.copyFile(oldThumbPath, newThumbPath);
        } else {
          // Generate thumbnail if it doesn't exist
          thumbnailGenerator.generateThumbnail(newRelativePath).catch(err => {
            console.warn('Thumbnail generation failed for:', newRelativePath, err.message);
          });
        }
      } catch (thumbErr) {
        console.warn('Thumbnail copy failed for:', itemPath, thumbErr.message);
      }
    }

    res.json({ 
      success: true, 
      message: 'Duplicated successfully',
      newPath: newRelativePath,
      newName 
    });
  } catch (error) {
    console.error('Duplicate error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Move file or folder
app.post('/api/move', requireAuth, async (req, res) => {
  try {
    const { path: itemPath, destination } = req.body;
    if (!itemPath || !destination) {
      return res.status(400).json({ error: 'Path and destination are required' });
    }

    const sourcePath = path.join(uploadsPath, itemPath);
    const destDir = path.join(uploadsPath, destination);
    const fileName = path.basename(sourcePath);
    const targetPath = path.join(destDir, fileName);

    // Security checks
    if (!sourcePath.startsWith(uploadsPath) || !targetPath.startsWith(uploadsPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!existsSync(sourcePath)) {
      return res.status(404).json({ error: 'Source file or folder not found' });
    }

    if (!existsSync(destDir)) {
      return res.status(404).json({ error: 'Destination folder not found' });
    }

    const stats = await fs.stat(sourcePath);
    const isDirectory = stats.isDirectory();

    // Prevent moving into itself or subdirectory
    if (targetPath.startsWith(sourcePath + path.sep) || targetPath === sourcePath) {
      return res.status(400).json({ error: 'Cannot move into itself or subdirectory' });
    }

    // Check if target already exists
    if (existsSync(targetPath)) {
      return res.status(400).json({ error: 'A file or folder with this name already exists in the destination' });
    }

    // Move the file/folder
    await fs.rename(sourcePath, targetPath);

    const newRelativePath = path.relative(uploadsPath, targetPath);

    // Update cache
    try {
      if (isDirectory) {
        // For directories, use renameFile which handles recursive updates
        fileCache.renameFile(itemPath, newRelativePath);
      } else {
        // For files, use renameFile
        fileCache.renameFile(itemPath, newRelativePath);
      }
    } catch (cacheErr) {
      console.warn('Cache update failed for move:', itemPath);
    }

    // Move thumbnail if it's an image file
    if (!isDirectory && thumbnailGenerator.isImageFile(itemPath)) {
      try {
        await thumbnailGenerator.renameThumbnail(itemPath, newRelativePath);
      } catch (thumbErr) {
        console.warn('Thumbnail move failed for:', itemPath, thumbErr.message);
      }
    } else if (isDirectory) {
      // Move thumbnail directory
      try {
        await thumbnailGenerator.renameThumbnailDirectory(itemPath, newRelativePath);
      } catch (thumbErr) {
        console.warn('Thumbnail directory move failed for:', itemPath, thumbErr.message);
      }
    }

    res.json({ 
      success: true, 
      message: 'Moved successfully',
      newPath: newRelativePath
    });
  } catch (error) {
    console.error('Move error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download file or folder (folders are automatically zipped)
app.get('/api/download', requireAuth, async (req, res) => {
  try {
    const itemPath = req.query.path;
    if (!itemPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    const fullPath = path.join(uploadsPath, itemPath);
    
    if (!fullPath.startsWith(uploadsPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!existsSync(fullPath)) {
      return res.status(404).json({ error: 'File or folder not found' });
    }
    
    const stats = statSync(fullPath);
    
    if (stats.isDirectory()) {
      // Folder download - create zip on-the-fly
      const folderName = path.basename(fullPath);
      const zipFileName = `${folderName}.zip`;
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
      
      const archive = archiver('zip', {
        zlib: { level: 6 } // Compression level (0-9)
      });
      
      // Handle archive errors
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to create archive' });
        }
      });
      
      // Pipe archive to response
      archive.pipe(res);
      
      // Add the folder contents to the archive
      archive.directory(fullPath, folderName);
      
      // Finalize the archive
      await archive.finalize();
    } else {
      // File download
      res.download(fullPath);
    }
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update access level of a file or folder
app.post('/api/access-level', requireAuth, async (req, res) => {
  try {
    const { path: itemPath, accessLevel } = req.body;
    
    if (!itemPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    if (!accessLevel || !['public', 'private'].includes(accessLevel)) {
      return res.status(400).json({ 
        error: 'Invalid accessLevel. Must be "public" or "private"' 
      });
    }
    
    const fullPath = path.join(uploadsPath, itemPath);
    
    // Security check
    if (!fullPath.startsWith(uploadsPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if file/folder exists
    if (!existsSync(fullPath)) {
      return res.status(404).json({ error: 'File or folder not found' });
    }
    
    // Update access level in cache
    const updated = fileCache.updateAccessLevel(itemPath, accessLevel);
    
    if (!updated) {
      // If not in cache, try to add it first
      try {
        const stats = statSync(fullPath);
        fileCache.addFile(itemPath, {
          size: stats.size,
          modified: stats.mtimeMs,
          created: stats.birthtimeMs,
          isDirectory: stats.isDirectory()
        }, accessLevel);
      } catch (cacheErr) {
        return res.status(500).json({ 
          error: 'Failed to update access level. Cache may not be ready.' 
        });
      }
    }
    
    res.json({ 
      success: true, 
      message: `Access level updated to ${accessLevel}`,
      path: itemPath,
      accessLevel
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search files with pagination
app.get('/api/search', requireAuth, async (req, res) => {
  try {
    const query = req.query.q || '';
    const useRegex = req.query.regex === 'true';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
    const showHidden = req.query.showHidden === 'true';
    
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
    
    // Try cache first for non-regex searches
    if (fileCache.isReady() && !useRegex) {
      try {
        const cacheResult = fileCache.searchFiles(query, useRegex, page, limit, showHidden);
        if (cacheResult) {
          // Add thumbnailUrl for image files
          const resultsWithThumbnails = cacheResult.results.map(item => ({
            ...item,
            thumbnailUrl: !item.isDirectory ? thumbnailGenerator.getThumbnailUrl(item.path) : null
          }));
          return res.json({
            results: resultsWithThumbnails,
            pagination: {
              page,
              limit,
              total: cacheResult.total,
              totalPages: Math.ceil(cacheResult.total / limit),
              hasNext: page * limit < cacheResult.total,
              hasPrev: page > 1
            }
          });
        }
      } catch (cacheError) {
        console.error('Cache search error, falling back to filesystem:', cacheError.message);
      }
    }
    
    // Filesystem fallback (always used for regex)
    const results = [];
    
    async function searchDir(dirPath) {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        // Skip symlinks
        if (item.isSymbolicLink()) continue;
        
        // Skip hidden files if not showing them
        if (!showHidden && item.name.startsWith('.')) continue;
        
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
          
          // Get access level from cache if available
          let accessLevel = 'public';
          if (fileCache.isReady()) {
            try {
              const fileInfo = fileCache.getFileInfo(relativePath);
              if (fileInfo) {
                accessLevel = fileInfo.accessLevel;
              }
            } catch (e) {
              // Default to public if cache fails
            }
          }
          
          const isDir = item.isDirectory();
          results.push({
            name: item.name,
            path: relativePath,
            isDirectory: isDir,
            size: stats.size,
            modified: stats.mtime,
            accessLevel,
            thumbnailUrl: !isDir ? thumbnailGenerator.getThumbnailUrl(relativePath) : null
          });
        }
        
        if (item.isDirectory()) {
          await searchDir(fullPath);
        }
      }
    }
    
    await searchDir(uploadsPath);
    
    // Sort results: directories first, then by name
    results.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
    
    // Apply pagination
    const total = results.length;
    const offset = (page - 1) * limit;
    const paginatedResults = results.slice(offset, offset + limit);
    
    res.json({ 
      results: paginatedResults,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get storage info (uses cache for fast aggregation)
app.get('/api/storage', requireAuth, async (req, res) => {
  try {
    // Try cache first for instant results
    if (fileCache.isReady()) {
      try {
        const storageInfo = fileCache.getStorageInfo();
        return res.json(storageInfo);
      } catch (cacheError) {
        console.error('Cache storage info error, falling back to filesystem:', cacheError.message);
      }
    }
    
    // Filesystem fallback
    let totalSize = 0;
    let fileCount = 0;
    let folderCount = 0;
    
    async function calculateSize(dirPath) {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        // Skip symlinks
        if (item.isSymbolicLink()) continue;
        
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

// Get cache status (admin only)
app.get('/api/cache/status', requireAuth, requireAdmin, (req, res) => {
  res.json(fileCache.getCacheStatus());
});

// Force cache rebuild (admin only)
app.post('/api/cache/rebuild', requireAuth, requireAdmin, async (req, res) => {
  try {
    if (!fileCache.isReady()) {
      return res.status(503).json({ error: 'Cache not initialized' });
    }
    
    // Run rebuild in background
    fileCache.rebuildCache().then(() => {
      console.log('✅ Manual cache rebuild completed');
    }).catch(err => {
      console.error('❌ Manual cache rebuild failed:', err.message);
    });
    
    res.json({ 
      success: true, 
      message: 'Cache rebuild started in background' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== THUMBNAIL API ROUTES =====

// Get thumbnail generator status
app.get('/api/thumbnails/status', requireAuth, (req, res) => {
  res.json(thumbnailGenerator.getStatus());
});

// Generate thumbnails for all existing images (admin only)
app.post('/api/thumbnails/generate', requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = thumbnailGenerator.getStatus();
    if (!status.initialized) {
      return res.status(503).json({ error: 'Thumbnail generator not initialized' });
    }
    
    // Run generation in background
    thumbnailGenerator.generateAllThumbnails().then(stats => {
      console.log(`✅ Bulk thumbnail generation completed: ${stats.generated} generated, ${stats.skipped} skipped, ${stats.failed} failed`);
    }).catch(err => {
      console.error('❌ Bulk thumbnail generation failed:', err.message);
    });
    
    res.json({ 
      success: true, 
      message: 'Thumbnail generation started in background' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sync thumbnails - generate missing and remove orphaned (admin only)
app.post('/api/thumbnails/sync', requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = thumbnailGenerator.getStatus();
    if (!status.initialized) {
      return res.status(503).json({ error: 'Thumbnail generator not initialized' });
    }
    
    // Run sync in background
    thumbnailGenerator.syncThumbnails().then(stats => {
      console.log(`✅ Thumbnail sync completed: ${stats.generated} generated, ${stats.deleted} orphans deleted, ${stats.failed} failed`);
    }).catch(err => {
      console.error('❌ Thumbnail sync failed:', err.message);
    });
    
    res.json({ 
      success: true, 
      message: 'Thumbnail sync started in background' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get app version and info
app.get('/api/about', async (req, res) => {
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    
    res.json({
      version: packageJson.version,
      name: packageJson.name,
      description: packageJson.description,
      license: packageJson.license
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Root redirect
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Graceful shutdown handling
function gracefulShutdown(signal) {
  console.log(`\n${signal} received, shutting down gracefully...`);
  fileCache.close();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
app.listen(PORT, async () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 File Manager Server running on http://localhost:${PORT}`);
  console.log(`📋 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`📖 API Docs: http://localhost:${PORT}/api-docs`);
  console.log(`${'='.repeat(60)}`);
  
  // Initialize cache (non-blocking)
  if (CACHE_ENABLED) {
    fileCache.initializeCache(uploadsPath, {
      dbPath: CACHE_DB_PATH,
      syncInterval: CACHE_SYNC_INTERVAL,
      enabled: CACHE_ENABLED
    });
  } else {
    console.log('\n🗄️  Cache Status: Disabled');
  }
  
  console.log('');
});
