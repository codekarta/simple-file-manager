import express from 'express';
import session from 'express-session';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, statSync, createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import { homedir, totalmem, freemem, cpus, uptime, loadavg, platform } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
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

// Helper function to extract tenantId from request
function extractTenantId(req) {
  // From URL path: /{tenantId}/...
  const pathMatch = req.path.match(/^\/([^\/]+)/);
  if (pathMatch && pathMatch[1] !== 'api' && pathMatch[1] !== 'admin' && pathMatch[1] !== 'thumb' && pathMatch[1] !== 'assets') {
    // Validate it looks like a CUID (starts with 'c' and is ~25 chars)
    const potentialTenantId = pathMatch[1];
    if (potentialTenantId.length > 20 && potentialTenantId.match(/^[a-z0-9]+$/)) {
      return potentialTenantId;
    }
  }
  
  // From query parameter
  if (req.query.tenantId) {
    return req.query.tenantId;
  }
  
  return null;
}

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
        // Extract tenantId from request if available
        req.tenantId = extractTenantId(req) || user.tenantId;
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
        req.tenantId = extractTenantId(req) || user.tenantId;
        return next();
      }
    }
    
    // Check session authentication
    if (req.session && req.session.authenticated) {
      const user = await credentialsManager.getUserByUsername(req.session.username);
      if (user) {
        req.user = user;
        req.authMethod = 'session';
        // Extract tenantId from request, or use user's tenant, or from session
        req.tenantId = extractTenantId(req) || req.session.tenantId || user.tenantId;
        return next();
      }
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

// Super admin only middleware
const requireSuperAdmin = async (req, res, next) => {
  if (req.user && req.user.role === 'super_admin') {
    next();
  } else {
    res.status(403).json({ 
      error: 'Super admin access required',
      message: 'This operation requires super administrator privileges'
    });
  }
};

// Tenant admin or super admin middleware
const requireTenantAdmin = async (req, res, next) => {
  if (req.user && (req.user.role === 'super_admin' || req.user.role === 'tenant_admin')) {
    next();
  } else {
    res.status(403).json({ 
      error: 'Admin access required',
      message: 'This operation requires administrator privileges'
    });
  }
};

// Admin-only middleware (backward compatibility - checks for both admin and super_admin)
const requireAdmin = async (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.role === 'tenant_admin')) {
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

// Helper function to resolve tenant-aware file path
function resolveTenantFilePath(tenantId, filePath, baseUploadsPath) {
  if (tenantId) {
    // Tenant-specific path: uploads/{tenantId}/...
    return path.join(baseUploadsPath, tenantId, filePath);
  } else {
    // Legacy path for super admin: uploads/...
    return path.join(baseUploadsPath, filePath);
  }
}

// Helper function to verify tenant access
async function verifyTenantAccess(user, tenantId) {
  // Super admin can access all tenants
  if (user.role === 'super_admin') {
    return true;
  }
  
  // Tenant users can only access their own tenant
  if (user.tenantId === tenantId) {
    return true;
  }
  
  return false;
}

// Auth-aware static file middleware for public/private access control
// Public files: accessible to everyone
// Private files: require session or API token authentication
app.use(async (req, res, next) => {
  // Skip API routes, admin routes, and thumbnail routes
  if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path.startsWith('/thumb') || req.path === '/api-docs' || req.path === '/llms.md') {
    return next();
  }
  
  // Extract tenantId from URL path: /{tenantId}/...
  const pathParts = req.path.split('/').filter(p => p);
  let tenantId = null;
  let filePath = '';
  
  if (pathParts.length > 0) {
    const firstPart = pathParts[0];
    // Check if first part looks like a CUID (tenantId)
    if (firstPart.length > 20 && firstPart.match(/^[a-z0-9]+$/)) {
      tenantId = firstPart;
      filePath = pathParts.slice(1).join('/');
    } else {
      // Legacy path without tenantId (for super admin only)
      filePath = pathParts.join('/');
    }
  }
  
  // Decode URL-encoded path
  const decodedPath = decodeURIComponent(filePath);
  
  // Resolve full path based on tenant
  const fullPath = resolveTenantFilePath(tenantId, decodedPath, uploadsPath);
  
  // Security check: prevent directory traversal
  const expectedBase = tenantId ? path.join(uploadsPath, tenantId) : uploadsPath;
  if (!fullPath.startsWith(expectedBase)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Check if file exists
  if (!existsSync(fullPath)) {
    return next(); // Let other handlers deal with 404
  }
  
  // If tenantId is specified, verify access
  if (tenantId) {
    // Try to get user from session or API token
    let user = null;
    try {
      if (req.session && req.session.authenticated) {
        user = await credentialsManager.getUserByUsername(req.session.username);
      } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        const apiKey = req.headers.authorization.substring(7);
        user = await credentialsManager.getUserByApiKey(apiKey);
      } else if (req.query.apiKey || req.query.api_key) {
        const apiKey = req.query.apiKey || req.query.api_key;
        user = await credentialsManager.getUserByApiKey(apiKey);
      }
      
      if (user && !(await verifyTenantAccess(user, tenantId))) {
        return res.status(403).json({ error: 'Access denied to this tenant' });
      }
    } catch (error) {
      // If auth check fails, allow public files to be served
      // Private files will be blocked by access level check below
    }
  }
  
  // Get effective access level (checks file and parent hierarchy)
  // For tenant files, we'll default to public for now
  // Cache would need to be tenant-aware in the future to properly check tenant file access levels
  let accessLevel = 'public';
  if (fileCache.isReady() && !tenantId) {
    // Only check cache for non-tenant files (legacy support)
    try {
      accessLevel = fileCache.getAccessLevel(decodedPath) || 'public';
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
    req.session.tenantId = user.tenantId || null;
    
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
          role: user.role,
          tenantId: user.tenantId || null
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
      const user = await credentialsManager.getUserByUsername(req.session.username);
      if (user) {
        return res.json({
          authenticated: true,
          user: {
            username: user.username,
            role: user.role,
            tenantId: user.tenantId || null
          }
        });
      }
    }
    
    res.json({ authenticated: false });
  } catch (error) {
    console.error('Auth status error:', error);
    res.json({ authenticated: false });
  }
});

// ===== TENANT MANAGEMENT API ROUTES (Super Admin Only) =====

// Create tenant
app.post('/api/super-admin/tenants', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tenant name is required' });
    }
    
    const tenant = await credentialsManager.createTenant(name.trim(), req.user.username);
    
    res.json({
      success: true,
      message: 'Tenant created successfully',
      tenant
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// List all tenants
app.get('/api/super-admin/tenants', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const tenants = await credentialsManager.listTenants();
    res.json({ success: true, tenants });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tenant by ID
app.get('/api/super-admin/tenants/:tenantId', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await credentialsManager.getTenantById(tenantId);
    
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    res.json({ success: true, tenant });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update tenant
app.put('/api/super-admin/tenants/:tenantId', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tenant name is required' });
    }
    
    const tenant = await credentialsManager.updateTenant(tenantId, { name: name.trim() });
    
    res.json({
      success: true,
      message: 'Tenant updated successfully',
      tenant
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get system resources (super admin only)
app.get('/api/super-admin/system-resources', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    // Memory information
    const totalMem = totalmem();
    const freeMem = freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = (usedMem / totalMem) * 100;

    // CPU information
    const cpuInfo = cpus();
    const cpuCount = cpuInfo.length;
    
    // Calculate CPU usage by measuring over time
    let cpuUsagePercent = 0;
    if (cpuInfo.length > 0) {
      // Get initial CPU times
      const startMeasure = cpus().map(cpu => ({
        idle: cpu.times.idle,
        total: cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq
      }));
      
      // Wait 100ms and measure again
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const endMeasure = cpus().map(cpu => ({
        idle: cpu.times.idle,
        total: cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq
      }));
      
      // Calculate average CPU usage across all cores
      let totalUsage = 0;
      for (let i = 0; i < cpuInfo.length; i++) {
        const idle = endMeasure[i].idle - startMeasure[i].idle;
        const total = endMeasure[i].total - startMeasure[i].total;
        const usage = 100 - (idle / total) * 100;
        totalUsage += Math.max(0, Math.min(100, usage)); // Clamp between 0-100
      }
      cpuUsagePercent = totalUsage / cpuInfo.length;
    }

    // Disk space information (for the filesystem containing uploads directory)
    let diskTotal = 0;
    let diskUsed = 0;
    let diskAvailable = 0;
    
    try {
      const uploadPath = uploadsPath;
      
      // Get disk space using system command (cross-platform)
      if (platform() !== 'win32') {
        // Unix/Mac: use df command
        try {
          const { stdout } = await execAsync(`df -k "${uploadPath}" | tail -1`);
          const parts = stdout.trim().split(/\s+/);
          if (parts.length >= 4) {
            // df output: Filesystem, 1K-blocks, Used, Available, Use%, Mounted on
            diskTotal = parseInt(parts[1]) * 1024; // Convert KB to bytes
            diskUsed = parseInt(parts[2]) * 1024;
            diskAvailable = parseInt(parts[3]) * 1024;
          }
        } catch (err) {
          console.error('Error getting disk space via df:', err.message);
        }
      } else {
        // Windows: use wmic or PowerShell
        try {
          const { stdout } = await execAsync(`wmic logicaldisk get size,freespace,caption | findstr "${uploadPath.charAt(0)}"`);
          const parts = stdout.trim().split(/\s+/);
          if (parts.length >= 3) {
            diskAvailable = parseInt(parts[0]);
            diskTotal = parseInt(parts[1]);
            diskUsed = diskTotal - diskAvailable;
          }
        } catch (err) {
          console.error('Error getting disk space on Windows:', err.message);
        }
      }
      
      // Fallback: if system commands fail, estimate from uploads directory size
      if (diskTotal === 0 && existsSync(uploadPath)) {
        async function calculateDirSize(dirPath) {
          let size = 0;
          try {
            const items = await fs.readdir(dirPath, { withFileTypes: true });
            for (const item of items) {
              if (item.isSymbolicLink()) continue;
              const fullPath = path.join(dirPath, item.name);
              try {
                if (item.isDirectory()) {
                  size += await calculateDirSize(fullPath);
                } else {
                  const stats = await fs.stat(fullPath);
                  size += stats.size;
                }
              } catch (err) {
                // Skip files that can't be accessed
              }
            }
          } catch (err) {
            // Directory might not be readable
          }
          return size;
        }
        
        diskUsed = await calculateDirSize(uploadPath);
        // For fallback, we can't determine total/available without system info
        diskTotal = diskUsed * 2; // Rough estimate
        diskAvailable = diskTotal - diskUsed;
      }
    } catch (error) {
      console.error('Error calculating disk space:', error);
    }

    // Active sessions count
    let activeSessions = 0;
    try {
      const sessionStore = req.sessionStore;
      if (sessionStore && typeof sessionStore.all === 'function') {
        const sessions = await new Promise((resolve, reject) => {
          sessionStore.all((err, sessions) => {
            if (err) reject(err);
            else resolve(sessions || {});
          });
        });
        activeSessions = Object.keys(sessions).length;
      } else if (sessionStore && typeof sessionStore.length === 'function') {
        activeSessions = await new Promise((resolve, reject) => {
          sessionStore.length((err, count) => {
            if (err) reject(err);
            else resolve(count || 0);
          });
        });
      }
    } catch (error) {
      console.error('Error counting sessions:', error);
      activeSessions = 0;
    }

    // Calculate total storage used (across all tenants)
    let totalStorageUsed = 0;
    try {
      const tenants = await credentialsManager.listTenants();
      
      async function calculateTenantStorage(tenantId) {
        const tenantBasePath = path.join(uploadsPath, tenantId);
        if (!existsSync(tenantBasePath)) return 0;
        
        let size = 0;
        async function calculateSize(dirPath) {
          if (!existsSync(dirPath)) return;
          try {
            const items = await fs.readdir(dirPath, { withFileTypes: true });
            for (const item of items) {
              if (item.isSymbolicLink()) continue;
              const fullPath = path.join(dirPath, item.name);
              try {
                if (item.isDirectory()) {
                  await calculateSize(fullPath);
                } else {
                  const stats = await fs.stat(fullPath);
                  size += stats.size;
                }
              } catch (err) {
                // Skip inaccessible files
              }
            }
          } catch (err) {
            // Skip inaccessible directories
          }
        }
        
        await calculateSize(tenantBasePath);
        return size;
      }
      
      for (const tenant of tenants) {
        totalStorageUsed += await calculateTenantStorage(tenant.tenantId);
      }
    } catch (error) {
      console.error('Error calculating total storage:', error);
    }

    // Storage growth rate (simplified - would need historical data for accurate forecasting)
    // For now, return basic info that can be tracked over time
    const storageGrowthRate = 0; // Would need historical tracking

    // Get system uptime
    const systemUptime = uptime();

    res.json({
      success: true,
      resources: {
        disk: {
          total: diskTotal,
          used: diskUsed,
          available: diskAvailable,
          usedPercent: diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0
        },
        memory: {
          total: totalMem,
          used: usedMem,
          available: freeMem,
          usedPercent: memUsagePercent
        },
        cpu: {
          cores: cpuCount,
          model: cpuInfo[0]?.model || 'Unknown',
          usagePercent: cpuUsagePercent,
          loadAverage: platform() !== 'win32' ? loadavg() : [0, 0, 0]
        },
        system: {
          platform: process.platform,
          uptime: systemUptime,
          nodeVersion: process.version
        },
        storage: {
          totalUsed: totalStorageUsed,
          growthRate: storageGrowthRate // Bytes per hour (calculated from historical data)
        },
        sessions: {
          active: activeSessions
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete tenant
app.delete('/api/super-admin/tenants/:tenantId', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    await credentialsManager.deleteTenant(tenantId);
    
    res.json({
      success: true,
      message: 'Tenant deleted successfully'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
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

// List all users (tenant-aware)
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Super admin can list all users or filter by tenantId
    // Tenant admin can only list users in their tenant
    let tenantId = req.query.tenantId;
    
    if (req.user.role === 'tenant_admin') {
      tenantId = req.user.tenantId;
    } else if (req.user.role === 'super_admin' && !tenantId) {
      // Super admin without tenantId gets all users
      tenantId = null;
    }
    
    const users = await credentialsManager.listUsers(tenantId);
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List users in a specific tenant (super admin only)
app.get('/api/super-admin/tenants/:tenantId/users', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const users = await credentialsManager.getUsersByTenant(tenantId);
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create user in tenant (super admin only)
app.post('/api/super-admin/tenants/:tenantId/users', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
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
    
    // Validate tenant exists
    const tenant = await credentialsManager.getTenantById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const newUser = await credentialsManager.createUser(
      username, 
      role || 'user',
      tenantId,
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

// Create user (tenant admin creates in own tenant, super admin can specify tenant)
app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { username, role, password, tenantId } = req.body;
    
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
    
    // Determine tenantId based on user role
    let targetTenantId = tenantId;
    if (req.user.role === 'tenant_admin') {
      // Tenant admin can only create users in their own tenant
      targetTenantId = req.user.tenantId;
    } else if (req.user.role === 'super_admin') {
      // Super admin can create users in any tenant or as super admin (no tenantId)
      // If tenantId not provided, create as super admin
      targetTenantId = tenantId || null;
    }
    
    // If tenantId provided, validate tenant exists
    if (targetTenantId) {
      const tenant = await credentialsManager.getTenantById(targetTenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
    }
    
    const newUser = await credentialsManager.createUser(
      username, 
      role || 'user',
      targetTenantId,
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

// Create user in own tenant (tenant admin only)
app.post('/api/tenant-admin/users', requireAuth, requireTenantAdmin, async (req, res) => {
  try {
    if (req.user.role !== 'tenant_admin') {
      return res.status(403).json({ error: 'Tenant admin access required' });
    }
    
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
      req.user.tenantId,
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

// List files and directories with pagination (tenant-aware)
app.get('/api/files', requireAuth, async (req, res) => {
  try {
    // Get tenantId from query or user's tenant
    let tenantId = req.query.tenantId || req.tenantId;
    
    // For tenant users, enforce their tenant
    if (req.user.tenantId && req.user.role !== 'super_admin') {
      tenantId = req.user.tenantId;
    }
    
    // For super admin viewing root, show all tenants
    const subPath = req.query.path || '';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
    const showHidden = req.query.showHidden === 'true';
    
    // If super admin and no tenantId specified and path is empty, list tenants
    if (req.user.role === 'super_admin' && !tenantId && subPath === '') {
      const tenants = await credentialsManager.listTenants();
      const tenantItems = tenants.map(tenant => ({
        name: tenant.name,
        path: tenant.tenantId,
        isDirectory: true,
        size: 0,
        modified: tenant.createdAt,
        created: tenant.createdAt,
        accessLevel: 'public',
        isTenant: true // Mark as tenant folder
      }));
      
      return res.json({
        currentPath: '',
        items: tenantItems,
        pagination: {
          page: 1,
          limit,
          total: tenantItems.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      });
    }
    
    // Verify tenant access
    if (tenantId && !(await verifyTenantAccess(req.user, tenantId))) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }
    
    const fullPath = resolveTenantFilePath(tenantId, subPath, uploadsPath);
    const expectedBase = tenantId ? path.join(uploadsPath, tenantId) : uploadsPath;
    
    // Security check: prevent directory traversal
    if (!fullPath.startsWith(expectedBase)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Try cache first, fallback to filesystem
    // Skip cache for tenant-specific requests as cache may not be tenant-aware
    if (fileCache.isReady() && !tenantId) {
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
          // Calculate relative path from tenant base or uploads base
          const basePath = tenantId ? path.join(uploadsPath, tenantId) : uploadsPath;
          const relativePath = path.relative(basePath, itemPath);
          
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

// Upload file(s) or folders (tenant-aware)
app.post('/api/upload', requireAuth, upload.array('files', 500), async (req, res) => {
  try {
    // Get tenantId from query or user's tenant
    let tenantId = req.query.tenantId || req.tenantId;
    
    // For tenant users, enforce their tenant
    if (req.user.tenantId && req.user.role !== 'super_admin') {
      tenantId = req.user.tenantId;
    }
    
    // Verify tenant access
    if (tenantId && !(await verifyTenantAccess(req.user, tenantId))) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }
    
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
      console.log(`Tenant: ${tenantId || '(none)'}`);
      console.log(`Base path: ${basePath || '(root)'}`);
      console.log(`Files: ${req.files.length}`);
      console.log(`Access level: ${accessLevel}`);
    }
    
    const movedFiles = [];
    const createdFolders = new Set();
    const tenantBasePath = tenantId ? path.join(uploadsPath, tenantId) : uploadsPath;
    
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      let targetPath;
      let relativePath;
      
      if (relativePaths && Array.isArray(relativePaths) && relativePaths[i]) {
        relativePath = relativePaths[i];
        targetPath = path.join(tenantBasePath, basePath, relativePath);
      } else if (relativePaths && !Array.isArray(relativePaths)) {
        relativePath = relativePaths;
        targetPath = path.join(tenantBasePath, basePath, relativePath);
      } else {
        targetPath = path.join(tenantBasePath, basePath, file.originalname);
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
      
      const fileRelativePath = path.relative(tenantBasePath, targetPath);
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
        const fullFolderPath = path.join(tenantBasePath, folderPath);
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

// Create folder (tenant-aware)
app.post('/api/folder', requireAuth, async (req, res) => {
  try {
    // Get tenantId from query or user's tenant
    let tenantId = req.query.tenantId || req.tenantId;
    
    // For tenant users, enforce their tenant
    if (req.user.tenantId && req.user.role !== 'super_admin') {
      tenantId = req.user.tenantId;
    }
    
    // Verify tenant access
    if (tenantId && !(await verifyTenantAccess(req.user, tenantId))) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }
    
    const { path: subPath, name, mediaAccessLevel } = req.body;
    const accessLevel = mediaAccessLevel || 'public'; // Default to public
    const tenantBasePath = tenantId ? path.join(uploadsPath, tenantId) : uploadsPath;
    const folderPath = path.join(tenantBasePath, subPath || '', name);
    
    // Validate access level
    if (!['public', 'private'].includes(accessLevel)) {
      return res.status(400).json({ 
        error: 'Invalid mediaAccessLevel. Must be "public" or "private"' 
      });
    }
    
    if (!folderPath.startsWith(tenantBasePath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await fs.mkdir(folderPath, { recursive: true });
    
    // Update cache with access level
    try {
      const relativePath = path.relative(tenantBasePath, folderPath);
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

// Create new file (tenant-aware)
app.post('/api/file', requireAuth, async (req, res) => {
  try {
    // Get tenantId from query or user's tenant
    let tenantId = req.query.tenantId || req.tenantId;
    
    // For tenant users, enforce their tenant
    if (req.user.tenantId && req.user.role !== 'super_admin') {
      tenantId = req.user.tenantId;
    }
    
    // Verify tenant access
    if (tenantId && !(await verifyTenantAccess(req.user, tenantId))) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }
    
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
    const tenantBasePath = tenantId ? path.join(uploadsPath, tenantId) : uploadsPath;
    const filePath = path.join(tenantBasePath, subPath || '', sanitizedName);
    
    if (!filePath.startsWith(tenantBasePath)) {
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
      const relativePath = path.relative(tenantBasePath, filePath);
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

// Delete file or folder (tenant-aware)
app.delete('/api/delete', requireAuth, async (req, res) => {
  try {
    // Get tenantId from query or user's tenant
    let tenantId = req.query.tenantId || req.tenantId;
    
    // For tenant users, enforce their tenant
    if (req.user.tenantId && req.user.role !== 'super_admin') {
      tenantId = req.user.tenantId;
    }
    
    const { path: itemPath } = req.body;
    
    // Verify tenant access
    if (tenantId && !(await verifyTenantAccess(req.user, tenantId))) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }
    
    const fullPath = resolveTenantFilePath(tenantId, itemPath, uploadsPath);
    const expectedBase = tenantId ? path.join(uploadsPath, tenantId) : uploadsPath;

    if (!fullPath.startsWith(expectedBase) || fullPath === expectedBase) {
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

// Read file content as text (tenant-aware)
app.get('/api/file-content', requireAuth, async (req, res) => {
  try {
    // Get tenantId from query or user's tenant
    let tenantId = req.query.tenantId || req.tenantId;
    
    // For tenant users, enforce their tenant
    if (req.user.tenantId && req.user.role !== 'super_admin') {
      tenantId = req.user.tenantId;
    }
    
    const filePath = req.query.path;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    // Verify tenant access
    if (tenantId && !(await verifyTenantAccess(req.user, tenantId))) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }
    
    const fullPath = resolveTenantFilePath(tenantId, filePath, uploadsPath);
    const expectedBase = tenantId ? path.join(uploadsPath, tenantId) : uploadsPath;
    
    // Security check: prevent directory traversal
    if (!fullPath.startsWith(expectedBase)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if file exists and is a file (not directory)
    try {
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        return res.status(400).json({ error: 'Path is a directory, not a file' });
      }
    } catch (error) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Read file content as text
    const content = await fs.readFile(fullPath, 'utf8');
    
    res.json({ success: true, content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Write file content (tenant-aware)
app.post('/api/file-content', requireAuth, async (req, res) => {
  try {
    // Get tenantId from query or user's tenant
    let tenantId = req.query.tenantId || req.tenantId;
    
    // For tenant users, enforce their tenant
    if (req.user.tenantId && req.user.role !== 'super_admin') {
      tenantId = req.user.tenantId;
    }
    
    const { path: filePath, content } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    // Verify tenant access
    if (tenantId && !(await verifyTenantAccess(req.user, tenantId))) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }
    
    const fullPath = resolveTenantFilePath(tenantId, filePath, uploadsPath);
    const expectedBase = tenantId ? path.join(uploadsPath, tenantId) : uploadsPath;
    
    // Security check: prevent directory traversal
    if (!fullPath.startsWith(expectedBase)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if file exists and is a file (not directory)
    try {
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        return res.status(400).json({ error: 'Path is a directory, not a file' });
      }
    } catch (error) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Write file content as text
    await fs.writeFile(fullPath, content || '', 'utf8');
    
    res.json({ success: true, message: 'File saved successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rename file or folder (tenant-aware)
app.post('/api/rename', requireAuth, async (req, res) => {
  try {
    // Get tenantId from query or user's tenant
    let tenantId = req.query.tenantId || req.tenantId;
    
    // For tenant users, enforce their tenant
    if (req.user.tenantId && req.user.role !== 'super_admin') {
      tenantId = req.user.tenantId;
    }
    
    const { path: itemPath, newName } = req.body;
    
    // Verify tenant access
    if (tenantId && !(await verifyTenantAccess(req.user, tenantId))) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }
    
    const oldPath = resolveTenantFilePath(tenantId, itemPath, uploadsPath);
    const newPath = path.join(path.dirname(oldPath), newName);
    const expectedBase = tenantId ? path.join(uploadsPath, tenantId) : uploadsPath;
    
    if (!oldPath.startsWith(expectedBase) || !newPath.startsWith(expectedBase)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if it's a directory before renaming
    const stats = await fs.stat(oldPath);
    const isDirectory = stats.isDirectory();
    
    await fs.rename(oldPath, newPath);
    
    const newRelativePath = path.relative(expectedBase, newPath);
    
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

// Duplicate file or folder (tenant-aware)
app.post('/api/duplicate', requireAuth, async (req, res) => {
  try {
    // Get tenantId from query or user's tenant
    let tenantId = req.query.tenantId || req.tenantId;
    
    // For tenant users, enforce their tenant
    if (req.user.tenantId && req.user.role !== 'super_admin') {
      tenantId = req.user.tenantId;
    }
    
    const { path: itemPath } = req.body;
    if (!itemPath) {
      return res.status(400).json({ error: 'Path is required' });
    }

    // Verify tenant access
    if (tenantId && !(await verifyTenantAccess(req.user, tenantId))) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }

    const sourcePath = resolveTenantFilePath(tenantId, itemPath, uploadsPath);
    const expectedBase = tenantId ? path.join(uploadsPath, tenantId) : uploadsPath;

    if (!sourcePath.startsWith(expectedBase)) {
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

    const newRelativePath = path.relative(expectedBase, newPath);

    // Update cache
    try {
      if (isDirectory) {
        // For directories, we need to rebuild cache for that path
        // Or add all files recursively - for now, trigger a sync
        fileCache.syncDirectory(path.relative(expectedBase, dirName));
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
    if (!isDirectory && thumbnailGenerator.isImageFile(newRelativePath)) {
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

// Move file or folder (tenant-aware)
app.post('/api/move', requireAuth, async (req, res) => {
  try {
    // Get tenantId from query or user's tenant
    let tenantId = req.query.tenantId || req.tenantId;
    
    // For tenant users, enforce their tenant
    if (req.user.tenantId && req.user.role !== 'super_admin') {
      tenantId = req.user.tenantId;
    }
    
    const { path: itemPath, destination } = req.body;
    if (!itemPath || !destination) {
      return res.status(400).json({ error: 'Path and destination are required' });
    }

    // Verify tenant access
    if (tenantId && !(await verifyTenantAccess(req.user, tenantId))) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }

    const sourcePath = resolveTenantFilePath(tenantId, itemPath, uploadsPath);
    const destDir = resolveTenantFilePath(tenantId, destination, uploadsPath);
    const fileName = path.basename(sourcePath);
    const targetPath = path.join(destDir, fileName);
    const expectedBase = tenantId ? path.join(uploadsPath, tenantId) : uploadsPath;

    // Security checks
    if (!sourcePath.startsWith(expectedBase) || !targetPath.startsWith(expectedBase)) {
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

    const newRelativePath = path.relative(expectedBase, targetPath);

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

// Download file or folder (folders are automatically zipped) (tenant-aware)
app.get('/api/download', requireAuth, async (req, res) => {
  try {
    // Get tenantId from query or user's tenant
    let tenantId = req.query.tenantId || req.tenantId;
    
    // For tenant users, enforce their tenant
    if (req.user.tenantId && req.user.role !== 'super_admin') {
      tenantId = req.user.tenantId;
    }
    
    const itemPath = req.query.path;
    if (!itemPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    // Verify tenant access
    if (tenantId && !(await verifyTenantAccess(req.user, tenantId))) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }
    
    const fullPath = resolveTenantFilePath(tenantId, itemPath, uploadsPath);
    const expectedBase = tenantId ? path.join(uploadsPath, tenantId) : uploadsPath;
    
    if (!fullPath.startsWith(expectedBase)) {
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

// Update access level of a file or folder (tenant-aware)
app.post('/api/access-level', requireAuth, async (req, res) => {
  try {
    // Get tenantId from query or user's tenant
    let tenantId = req.query.tenantId || req.tenantId;
    
    // For tenant users, enforce their tenant
    if (req.user.tenantId && req.user.role !== 'super_admin') {
      tenantId = req.user.tenantId;
    }
    
    const { path: itemPath, accessLevel } = req.body;
    
    if (!itemPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    
    if (!accessLevel || !['public', 'private'].includes(accessLevel)) {
      return res.status(400).json({ 
        error: 'Invalid accessLevel. Must be "public" or "private"' 
      });
    }
    
    // Verify tenant access
    if (tenantId && !(await verifyTenantAccess(req.user, tenantId))) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }
    
    const fullPath = resolveTenantFilePath(tenantId, itemPath, uploadsPath);
    const expectedBase = tenantId ? path.join(uploadsPath, tenantId) : uploadsPath;
    
    // Security check
    if (!fullPath.startsWith(expectedBase)) {
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
        const relativePath = path.relative(searchBasePath, fullPath);
        
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
    
    await searchDir(searchBasePath);
    
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

// Get storage info (uses cache for fast aggregation) (tenant-aware)
app.get('/api/storage', requireAuth, async (req, res) => {
  try {
    // Get tenantId from query or user's tenant
    let tenantId = req.query.tenantId || req.tenantId;
    
    // For tenant users, enforce their tenant
    if (req.user.tenantId && req.user.role !== 'super_admin') {
      tenantId = req.user.tenantId;
    }
    
    // Verify tenant access
    if (tenantId && !(await verifyTenantAccess(req.user, tenantId))) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }
    
    const tenantBasePath = tenantId ? path.join(uploadsPath, tenantId) : uploadsPath;
    
    // Filesystem calculation (cache doesn't support tenant filtering yet)
    let totalSize = 0;
    let fileCount = 0;
    let folderCount = 0;

    async function calculateSize(dirPath) {
      if (!existsSync(dirPath)) return;
      
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
    
    await calculateSize(tenantBasePath);
    
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
