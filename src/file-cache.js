import Database from 'better-sqlite3';
import fs from 'fs/promises';
import { existsSync, mkdirSync, statSync } from 'fs';
import path from 'path';
import * as thumbnailGenerator from './thumbnail-generator.js';

// Cache state
let db = null;
let uploadsPath = null;
let cacheReady = false;
let syncInProgress = false;
let syncTimer = null;
let lastSyncTime = null;
let totalFilesScanned = 0;

/**
 * Initialize the file cache
 * @param {string} uploadDir - The uploads directory path
 * @param {Object} options - Configuration options
 * @param {string} options.dbPath - SQLite database file path
 * @param {number} options.syncInterval - Background sync interval in ms
 * @param {boolean} options.enabled - Whether caching is enabled
 */
export async function initializeCache(uploadDir, options = {}) {
  const {
    dbPath = './.cache/files.db',
    syncInterval = 600000, // 10 minutes default
    enabled = true
  } = options;

  if (!enabled) {
    console.log('🗄️  Cache Status: Disabled');
    return;
  }

  uploadsPath = uploadDir;

  try {
    // Ensure cache directory exists
    const cacheDir = path.dirname(dbPath);
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }

    // Initialize SQLite database with WAL mode for better performance
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    // Create tables and indexes
    createSchema();

    console.log(`\n🗄️  Cache Status:`);
    console.log(`   Database: ${dbPath}`);
    console.log(`   Building cache in background...`);

    // Start background cache build (non-blocking)
    buildCacheAsync(syncInterval);

  } catch (error) {
    console.error('❌ Cache initialization failed:', error.message);
    db = null;
  }
}

/**
 * Create database schema
 */
function createSchema() {
  // Files table
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_path TEXT NOT NULL,
      size INTEGER DEFAULT 0,
      modified INTEGER NOT NULL,
      created INTEGER NOT NULL,
      is_directory INTEGER NOT NULL,
      last_synced INTEGER NOT NULL,
      access_level TEXT DEFAULT 'public'
    )
  `);

  // Migration: Add access_level column if it doesn't exist (for existing databases)
  try {
    const columns = db.prepare("PRAGMA table_info(files)").all();
    const hasAccessLevel = columns.some(col => col.name === 'access_level');
    if (!hasAccessLevel) {
      db.exec(`ALTER TABLE files ADD COLUMN access_level TEXT DEFAULT 'public'`);
      console.log('   📦 Migrated database: added access_level column');
    }
  } catch (e) {
    // Column might already exist or table doesn't exist yet
  }

  // Index for fast directory listing
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_parent_path ON files(parent_path)
  `);

  // Index for fast search (case-insensitive)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_name_lower ON files(name COLLATE NOCASE)
  `);

  // Cache metadata table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cache_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
}

/**
 * Build cache asynchronously (non-blocking)
 */
async function buildCacheAsync(syncInterval) {
  try {
    await rebuildCache();
    cacheReady = true;
    console.log(`   ✅ Cache ready (${totalFilesScanned} items indexed)`);
    
    // Start periodic sync
    startPeriodicSync(syncInterval);
  } catch (error) {
    console.error('   ❌ Cache build failed:', error.message);
    // Cache will remain not ready, endpoints will fallback to filesystem
  }
}

/**
 * Check if cache is ready for use
 */
export function isReady() {
  return db !== null && cacheReady;
}

/**
 * Get cache status information
 */
export function getCacheStatus() {
  if (!db) {
    return {
      enabled: false,
      ready: false,
      totalFiles: 0,
      totalDirectories: 0,
      totalSize: 0,
      lastSync: null,
      syncInProgress: false,
      syncInterval: 0,
      databasePath: null,
      databaseSize: 0
    };
  }

  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(CASE WHEN is_directory = 0 THEN 1 END) as fileCount,
        COUNT(CASE WHEN is_directory = 1 THEN 1 END) as folderCount,
        COALESCE(SUM(CASE WHEN is_directory = 0 THEN size ELSE 0 END), 0) as totalSize
      FROM files
    `).get();

    const dbPath = db.name;
    let dbSize = 0;
    try {
      dbSize = statSync(dbPath).size;
    } catch (e) {
      // Ignore
    }

    return {
      enabled: true,
      ready: cacheReady,
      totalFiles: stats.fileCount,
      totalDirectories: stats.folderCount,
      totalSize: stats.totalSize,
      lastSync: lastSyncTime,
      syncInProgress,
      syncInterval: syncTimer ? syncTimer._idleTimeout : 0,
      databasePath: dbPath,
      databaseSize: dbSize
    };
  } catch (error) {
    return {
      enabled: true,
      ready: false,
      error: error.message
    };
  }
}

/**
 * Get files in a directory with pagination
 * @param {string} parentPath - Parent directory path (empty string for root)
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Items per page
 * @param {boolean} showHidden - Include hidden files (starting with .)
 */
export function getFiles(parentPath, page = 1, limit = 50, showHidden = false) {
  if (!db) throw new Error('Cache not initialized');

  const offset = (page - 1) * limit;
  const normalizedPath = parentPath || '';

  let query, countQuery;
  const params = { parentPath: normalizedPath };

  if (showHidden) {
    query = `
      SELECT path, name, is_directory, size, modified, created, access_level
      FROM files
      WHERE parent_path = @parentPath
      ORDER BY is_directory DESC, name COLLATE NOCASE ASC
      LIMIT @limit OFFSET @offset
    `;
    countQuery = `
      SELECT COUNT(*) as total FROM files WHERE parent_path = @parentPath
    `;
  } else {
    query = `
      SELECT path, name, is_directory, size, modified, created, access_level
      FROM files
      WHERE parent_path = @parentPath AND name NOT LIKE '.%'
      ORDER BY is_directory DESC, name COLLATE NOCASE ASC
      LIMIT @limit OFFSET @offset
    `;
    countQuery = `
      SELECT COUNT(*) as total FROM files 
      WHERE parent_path = @parentPath AND name NOT LIKE '.%'
    `;
  }

  const items = db.prepare(query).all({ ...params, limit, offset });
  const { total } = db.prepare(countQuery).get(params);

  return {
    items: items.map(item => ({
      name: item.name,
      path: item.path,
      isDirectory: item.is_directory === 1,
      size: item.size,
      modified: new Date(item.modified),
      created: new Date(item.created),
      accessLevel: item.access_level || 'public'
    })),
    total
  };
}

/**
 * Search files with pagination
 * @param {string} query - Search query
 * @param {boolean} useRegex - Whether to use regex (falls back to filesystem)
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Items per page
 * @param {boolean} showHidden - Include hidden files
 */
export function searchFiles(query, useRegex = false, page = 1, limit = 50, showHidden = false) {
  if (!db) throw new Error('Cache not initialized');

  // If regex is requested, return null to signal filesystem fallback
  if (useRegex) {
    return null;
  }

  const offset = (page - 1) * limit;
  const searchPattern = `%${query}%`;

  let sql, countSql;

  if (showHidden) {
    sql = `
      SELECT path, name, is_directory, size, modified, created, access_level
      FROM files
      WHERE name LIKE @pattern COLLATE NOCASE
      ORDER BY is_directory DESC, name COLLATE NOCASE ASC
      LIMIT @limit OFFSET @offset
    `;
    countSql = `
      SELECT COUNT(*) as total FROM files
      WHERE name LIKE @pattern COLLATE NOCASE
    `;
  } else {
    sql = `
      SELECT path, name, is_directory, size, modified, created, access_level
      FROM files
      WHERE name LIKE @pattern COLLATE NOCASE AND name NOT LIKE '.%'
      ORDER BY is_directory DESC, name COLLATE NOCASE ASC
      LIMIT @limit OFFSET @offset
    `;
    countSql = `
      SELECT COUNT(*) as total FROM files
      WHERE name LIKE @pattern COLLATE NOCASE AND name NOT LIKE '.%'
    `;
  }

  const items = db.prepare(sql).all({ pattern: searchPattern, limit, offset });
  const { total } = db.prepare(countSql).get({ pattern: searchPattern });

  return {
    results: items.map(item => ({
      name: item.name,
      path: item.path,
      isDirectory: item.is_directory === 1,
      size: item.size,
      modified: new Date(item.modified),
      accessLevel: item.access_level || 'public'
    })),
    total
  };
}

/**
 * Get storage info using SQL aggregation
 */
export function getStorageInfo() {
  if (!db) throw new Error('Cache not initialized');

  const result = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN is_directory = 0 THEN size ELSE 0 END), 0) as totalSize,
      COUNT(CASE WHEN is_directory = 0 THEN 1 END) as fileCount,
      COUNT(CASE WHEN is_directory = 1 THEN 1 END) as folderCount
    FROM files
  `).get();

  return {
    totalSize: result.totalSize,
    fileCount: result.fileCount,
    folderCount: result.folderCount
  };
}

/**
 * Add or update a single file in the cache
 * @param {string} filePath - Relative path to the file
 * @param {Object} stats - File statistics
 * @param {string} accessLevel - Access level ('public' or 'private')
 */
export function addFile(filePath, stats, accessLevel = 'public') {
  if (!db) return;

  const normalizedPath = filePath.replace(/\\/g, '/');
  const name = path.basename(normalizedPath);
  const parentPath = path.dirname(normalizedPath);

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO files (path, name, parent_path, size, modified, created, is_directory, last_synced, access_level)
    VALUES (@path, @name, @parentPath, @size, @modified, @created, @isDirectory, @lastSynced, @accessLevel)
  `);

  stmt.run({
    path: normalizedPath,
    name,
    parentPath: parentPath === '.' ? '' : parentPath,
    size: stats.size || 0,
    modified: stats.modified || stats.mtimeMs || Date.now(),
    created: stats.created || stats.birthtimeMs || Date.now(),
    isDirectory: stats.isDirectory ? 1 : 0,
    lastSynced: Date.now(),
    accessLevel: accessLevel || 'public'
  });
}

/**
 * Add multiple files in a transaction (for bulk operations)
 * @param {Array} files - Array of { path, stats, accessLevel? } objects
 */
export function addFiles(files) {
  if (!db || files.length === 0) return;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO files (path, name, parent_path, size, modified, created, is_directory, last_synced, access_level)
    VALUES (@path, @name, @parentPath, @size, @modified, @created, @isDirectory, @lastSynced, @accessLevel)
  `);

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      const normalizedPath = item.path.replace(/\\/g, '/');
      const name = path.basename(normalizedPath);
      const parentPath = path.dirname(normalizedPath);

      stmt.run({
        path: normalizedPath,
        name,
        parentPath: parentPath === '.' ? '' : parentPath,
        size: item.stats.size || 0,
        modified: item.stats.modified || item.stats.mtimeMs || Date.now(),
        created: item.stats.created || item.stats.birthtimeMs || Date.now(),
        isDirectory: item.stats.isDirectory ? 1 : 0,
        lastSynced: Date.now(),
        accessLevel: item.accessLevel || 'public'
      });
    }
  });

  insertMany(files);
}

/**
 * Delete a file from the cache
 * For directories, also deletes all children
 * @param {string} filePath - Relative path to the file
 */
export function deleteFile(filePath) {
  if (!db) return;

  const normalizedPath = filePath.replace(/\\/g, '/');

  // Delete the file/directory and all children (if directory)
  db.prepare(`
    DELETE FROM files 
    WHERE path = @path OR path LIKE @pathPrefix
  `).run({
    path: normalizedPath,
    pathPrefix: normalizedPath + '/%'
  });
}

/**
 * Rename a file in the cache
 * For directories, also updates all child paths
 * @param {string} oldPath - Old relative path
 * @param {string} newPath - New relative path
 */
export function renameFile(oldPath, newPath) {
  if (!db) return;

  const normalizedOldPath = oldPath.replace(/\\/g, '/');
  const normalizedNewPath = newPath.replace(/\\/g, '/');
  const newName = path.basename(normalizedNewPath);
  const newParentPath = path.dirname(normalizedNewPath);

  const transaction = db.transaction(() => {
    // Update the main file/directory
    db.prepare(`
      UPDATE files 
      SET path = @newPath, 
          name = @newName, 
          parent_path = @newParentPath,
          last_synced = @lastSynced
      WHERE path = @oldPath
    `).run({
      oldPath: normalizedOldPath,
      newPath: normalizedNewPath,
      newName,
      newParentPath: newParentPath === '.' ? '' : newParentPath,
      lastSynced: Date.now()
    });

    // Update all children (for directories)
    const oldPrefix = normalizedOldPath + '/';
    const children = db.prepare(`
      SELECT path FROM files WHERE path LIKE @oldPrefix
    `).all({ oldPrefix: oldPrefix + '%' });

    for (const child of children) {
      const childNewPath = normalizedNewPath + child.path.substring(normalizedOldPath.length);
      const childNewParent = path.dirname(childNewPath);

      db.prepare(`
        UPDATE files 
        SET path = @newPath, 
            parent_path = @newParentPath,
            last_synced = @lastSynced
        WHERE path = @oldPath
      `).run({
        oldPath: child.path,
        newPath: childNewPath,
        newParentPath: childNewParent === '.' ? '' : childNewParent,
        lastSynced: Date.now()
      });
    }
  });

  transaction();
}

/**
 * Rebuild the entire cache by scanning the filesystem
 */
export async function rebuildCache() {
  if (!db || !uploadsPath) return;

  syncInProgress = true;
  totalFilesScanned = 0;

  try {
    // Clear existing data
    db.exec('DELETE FROM files');

    // Scan and add all files
    await scanDirectory('');

    // Update metadata
    db.prepare(`
      INSERT OR REPLACE INTO cache_meta (key, value)
      VALUES ('last_full_sync', @value)
    `).run({ value: new Date().toISOString() });

    lastSyncTime = new Date().toISOString();
  } finally {
    syncInProgress = false;
  }
}

/**
 * Recursively scan a directory and add files to cache
 * @param {string} relativePath - Path relative to uploads directory
 */
async function scanDirectory(relativePath) {
  const fullPath = relativePath 
    ? path.join(uploadsPath, relativePath) 
    : uploadsPath;

  try {
    const items = await fs.readdir(fullPath, { withFileTypes: true });
    const filesToAdd = [];

    for (const item of items) {
      // Skip symlinks
      if (item.isSymbolicLink()) {
        continue;
      }

      const itemRelativePath = relativePath 
        ? `${relativePath}/${item.name}` 
        : item.name;
      const itemFullPath = path.join(fullPath, item.name);

      try {
        const stats = await fs.stat(itemFullPath);
        
        filesToAdd.push({
          path: itemRelativePath,
          stats: {
            size: stats.size,
            modified: stats.mtimeMs,
            created: stats.birthtimeMs,
            isDirectory: item.isDirectory()
          }
        });

        totalFilesScanned++;

        // Recursively scan subdirectories
        if (item.isDirectory()) {
          await scanDirectory(itemRelativePath);
        }
      } catch (statError) {
        // Skip files that can't be stat'd
        console.warn(`Warning: Could not stat ${itemFullPath}: ${statError.message}`);
      }
    }

    // Bulk insert files for this directory
    if (filesToAdd.length > 0) {
      addFiles(filesToAdd);
    }
  } catch (error) {
    console.error(`Error scanning directory ${fullPath}:`, error.message);
  }
}

/**
 * Sync a specific directory (useful after external modifications)
 * @param {string} dirPath - Relative path to directory
 */
export async function syncDirectory(dirPath) {
  if (!db || !uploadsPath) return;

  const normalizedPath = dirPath.replace(/\\/g, '/');

  // Delete existing entries for this directory's children
  db.prepare(`
    DELETE FROM files WHERE parent_path = @path
  `).run({ path: normalizedPath });

  // Re-scan just this directory
  const fullPath = path.join(uploadsPath, normalizedPath);
  
  try {
    const items = await fs.readdir(fullPath, { withFileTypes: true });
    const filesToAdd = [];

    for (const item of items) {
      if (item.isSymbolicLink()) continue;

      const itemRelativePath = normalizedPath 
        ? `${normalizedPath}/${item.name}` 
        : item.name;
      const itemFullPath = path.join(fullPath, item.name);

      try {
        const stats = await fs.stat(itemFullPath);
        filesToAdd.push({
          path: itemRelativePath,
          stats: {
            size: stats.size,
            modified: stats.mtimeMs,
            created: stats.birthtimeMs,
            isDirectory: item.isDirectory()
          }
        });
      } catch (e) {
        // Skip
      }
    }

    if (filesToAdd.length > 0) {
      addFiles(filesToAdd);
    }
  } catch (error) {
    console.error(`Error syncing directory ${dirPath}:`, error.message);
  }
}

/**
 * Start periodic background sync
 * @param {number} interval - Sync interval in milliseconds
 */
export function startPeriodicSync(interval) {
  if (syncTimer) {
    clearInterval(syncTimer);
  }

  const intervalMinutes = Math.round(interval / 1000 / 60);
  console.log(`   ⏰ Periodic sync: every ${intervalMinutes} minutes`);

  syncTimer = setInterval(async () => {
    if (syncInProgress) {
      console.log('⏭️  Skipping sync - previous sync still in progress');
      return;
    }

    console.log('🔄 Starting periodic cache sync...');
    
    try {
      await rebuildCache();
      console.log(`✅ Periodic cache sync completed (${totalFilesScanned} items)`);
      
      // Sync thumbnails after cache rebuild
      if (thumbnailGenerator.getStatus().initialized) {
        console.log('🔄 Starting periodic thumbnail sync...');
        const thumbStats = await thumbnailGenerator.syncThumbnails();
        console.log(`✅ Periodic thumbnail sync completed (${thumbStats.generated} generated, ${thumbStats.deleted} orphans deleted)`);
      }
    } catch (error) {
      console.error('❌ Periodic sync failed:', error.message);
    }
  }, interval);
}

/**
 * Stop periodic background sync
 */
export function stopPeriodicSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log('⏹️  Periodic sync stopped');
  }
}

/**
 * Close the database connection
 */
export function close() {
  stopPeriodicSync();
  
  if (db) {
    try {
      db.close();
      db = null;
      cacheReady = false;
      console.log('🗄️  Cache database closed');
    } catch (error) {
      console.error('Error closing cache database:', error.message);
    }
  }
}

/**
 * Get the effective access level for a path (checking parent hierarchy)
 * A file is private if it or any of its parent folders is private
 * @param {string} filePath - Relative path to check
 * @returns {string} 'public' or 'private'
 */
export function getAccessLevel(filePath) {
  if (!db) return 'public';

  const normalizedPath = filePath.replace(/\\/g, '/');
  
  // Check the file itself first
  const file = db.prepare(`
    SELECT access_level FROM files WHERE path = @path
  `).get({ path: normalizedPath });
  
  if (file && file.access_level === 'private') {
    return 'private';
  }
  
  // Check parent folders (walk up the path hierarchy)
  const parts = normalizedPath.split('/');
  for (let i = parts.length - 1; i >= 0; i--) {
    const parentPath = parts.slice(0, i).join('/');
    if (parentPath === '') continue;
    
    const parent = db.prepare(`
      SELECT access_level FROM files WHERE path = @path AND is_directory = 1
    `).get({ path: parentPath });
    
    if (parent && parent.access_level === 'private') {
      return 'private';
    }
  }
  
  return 'public';
}

/**
 * Update the access level of a file or folder
 * @param {string} filePath - Relative path to update
 * @param {string} level - 'public' or 'private'
 * @returns {boolean} success
 */
export function updateAccessLevel(filePath, level) {
  if (!db) return false;
  
  const normalizedPath = filePath.replace(/\\/g, '/');
  const validLevels = ['public', 'private'];
  
  if (!validLevels.includes(level)) {
    throw new Error('Invalid access level. Must be "public" or "private"');
  }
  
  const result = db.prepare(`
    UPDATE files SET access_level = @level, last_synced = @lastSynced
    WHERE path = @path
  `).run({
    path: normalizedPath,
    level,
    lastSynced: Date.now()
  });
  
  return result.changes > 0;
}

/**
 * Get file info including access level
 * @param {string} filePath - Relative path
 * @returns {Object|null} File info or null if not found
 */
export function getFileInfo(filePath) {
  if (!db) return null;
  
  const normalizedPath = filePath.replace(/\\/g, '/');
  
  const file = db.prepare(`
    SELECT path, name, is_directory, size, modified, created, access_level
    FROM files WHERE path = @path
  `).get({ path: normalizedPath });
  
  if (!file) return null;
  
  return {
    name: file.name,
    path: file.path,
    isDirectory: file.is_directory === 1,
    size: file.size,
    modified: new Date(file.modified),
    created: new Date(file.created),
    accessLevel: file.access_level || 'public'
  };
}

export default {
  initializeCache,
  isReady,
  getCacheStatus,
  getFiles,
  searchFiles,
  getStorageInfo,
  addFile,
  addFiles,
  deleteFile,
  renameFile,
  rebuildCache,
  syncDirectory,
  startPeriodicSync,
  stopPeriodicSync,
  close,
  getAccessLevel,
  updateAccessLevel,
  getFileInfo
};
