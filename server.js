import express from 'express';
import session from 'express-session';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Ensure upload directory exists
const uploadsPath = path.join(__dirname, UPLOAD_DIR);
if (!existsSync(uploadsPath)) {
  await fs.mkdir(uploadsPath, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration with proper cookie settings
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret-key',
  resave: true, // Force session to be saved even if not modified
  saveUninitialized: false, // Don't create session until something stored
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true, // Prevent XSS attacks
    secure: false, // Set to true if using HTTPS
    sameSite: 'lax' // CSRF protection
  },
  name: 'filemanager.sid' // Custom session cookie name
}));

// Configure multer for file uploads - store in temp location first
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Store in uploads root temporarily
    cb(null, uploadsPath);
  },
  filename: (req, file, cb) => {
    // Use a temporary name to avoid conflicts
    cb(null, `temp_${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { 
    fileSize: 100 * 1024 * 1024, // 100MB per file
    files: 500 // Allow up to 500 files (for folder uploads)
  }
});

// Authentication middleware with better logging
const requireAuth = (req, res, next) => {
  // Debug logging
  console.log('Auth check:', {
    hasSession: !!req.session,
    authenticated: req.session?.authenticated,
    sessionID: req.sessionID,
    cookie: req.headers.cookie ? 'present' : 'missing'
  });
  
  if (req.session && req.session.authenticated) {
    next();
  } else {
    console.log('Authentication failed for:', req.path);
    res.status(401).json({ 
      error: 'Authentication required',
      debug: {
        hasSession: !!req.session,
        authenticated: req.session?.authenticated
      }
    });
  }
};

// Serve static files publicly (this allows myapp.com/products/tshirt.jpg)
app.use(express.static(uploadsPath));

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin static assets (JS, CSS)
app.get('/admin/:file', (req, res) => {
  const file = req.params.file;
  res.sendFile(path.join(__dirname, 'public', file));
});

// API Routes

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    req.session.username = username;
    
    // Explicitly save the session to ensure it persists
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ success: false, error: 'Session save failed' });
      }
      res.json({ success: true, message: 'Login successful' });
    });
  } else {
    res.status(401).json({ success: false, error: 'Invalid credentials' });
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
app.get('/api/auth/status', (req, res) => {
  res.json({ 
    authenticated: !!req.session.authenticated,
    username: req.session.username 
  });
});

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
    const relativePaths = req.body.relativePaths; // Array for folder uploads
    
    // Detect if this is a folder upload
    const isFolderUpload = relativePaths && (Array.isArray(relativePaths) ? relativePaths.length > 0 : true);
    
    if (isFolderUpload) {
      console.log('📁 Folder upload detected');
      console.log(`Base path: ${basePath || '(root)'}`);
      console.log(`Files: ${req.files.length}`);
    }
    
    // Move files to the correct location
    const movedFiles = [];
    const createdFolders = new Set(); // Track created folders for logging
    
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      let targetPath;
      let relativePath;
      
      // Check if this is a folder upload with relative paths
      if (relativePaths && Array.isArray(relativePaths) && relativePaths[i]) {
        // For folder uploads: basePath + relativePath
        relativePath = relativePaths[i];
        targetPath = path.join(uploadsPath, basePath, relativePath);
      } else if (relativePaths && !Array.isArray(relativePaths)) {
        // Single folder (relativePaths is a string)
        relativePath = relativePaths;
        targetPath = path.join(uploadsPath, basePath, relativePath);
      } else {
        // For regular file uploads: basePath + filename
        targetPath = path.join(uploadsPath, basePath, file.originalname);
      }
      
      // Ensure the directory exists (creates all parent folders automatically)
      const targetDir = path.dirname(targetPath);
      await fs.mkdir(targetDir, { recursive: true });
      
      // Track created folders
      if (isFolderUpload) {
        const folderPath = path.relative(uploadsPath, targetDir);
        if (folderPath) {
          createdFolders.add(folderPath);
        }
      }
      
      // Move the file from temp location to target location
      await fs.rename(file.path, targetPath);
      
      movedFiles.push({
        name: file.originalname,
        size: file.size,
        path: path.relative(uploadsPath, targetPath)
      });
    }
    
    // Log folder structure created
    if (isFolderUpload && createdFolders.size > 0) {
      console.log(`✅ Created folder structure:`);
      Array.from(createdFolders).sort().forEach(folder => {
        const depth = folder.split('/').length - 1;
        console.log(`   ${'  '.repeat(depth)}└─ ${folder.split('/').pop()}/`);
      });
      console.log(`📄 Uploaded ${movedFiles.length} files`);
    }
    
    // Determine message based on upload type
    let message;
    if (relativePaths) {
      // Extract folder name from first relative path
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
    // Clean up any uploaded files on error
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
    
    // Security check
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
    
    // Security check
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
    
    // Security check
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
    
    // Security check
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
    const query = req.query.q?.toLowerCase() || '';
    const results = [];
    
    async function searchDir(dirPath) {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);
        const relativePath = path.relative(uploadsPath, fullPath);
        
        if (item.name.toLowerCase().includes(query)) {
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
app.listen(PORT, () => {
  console.log(`\n🚀 File Manager Server running on http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${uploadsPath}`);
  console.log(`👤 Admin username: ${ADMIN_USERNAME}`);
  console.log(`\n📋 Access the admin panel at: http://localhost:${PORT}/admin\n`);
});

