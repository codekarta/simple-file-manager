# File Server Optimization Plan

## Problem Analysis

The current implementation performs expensive disk I/O on every request:

1. **`/api/files` endpoint** (line 492): Calls `fs.readdir()` + `fs.stat()` for each item on every request
2. **`/api/search` endpoint** (line 703): Recursively walks entire directory tree with `fs.readdir()` and `fs.stat()`
3. **`/api/storage` endpoint** (line 761): Recursively calculates sizes by walking entire tree

This causes high disk I/O, especially with large directories or frequent requests.

## Solution: SQLite Cache with Periodic Sync

### Architecture Overview

1. **SQLite Database**: Store file metadata (path, name, size, modified time, created time, isDirectory)
2. **Disk-based with WAL mode**: Use file-based SQLite with WAL for fast reads and crash safety
3. **Periodic Sync**: Background sync at configurable intervals (different for internal vs external folders)
4. **Auto-Sync on Operations**: Update cache on all filesystem operations (upload, delete, rename, create folder)
5. **Non-blocking Startup**: Server starts immediately, cache builds in background
6. **Pagination**: Add pagination support to both API and UI for better performance and UX

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| SQLite Library | `better-sqlite3` | Fast, synchronous, well-maintained |
| Runtime | Node.js | Production stability |
| File Watching | **Disabled** (Option B) | Avoids duplicate entries from watch + manual sync |
| Periodic Sync | External: 5min, Internal: 10min | Configurable via .env |
| Symlinks | **Ignored** | Avoid complexity and potential loops |
| Pagination | Breaking change OK | UI will be updated accordingly |
| Startup | Non-blocking | Server available immediately, fallback to filesystem |

---

## Environment Variables

Add these to `.env` and `.env.example`:

```env
# Cache Configuration
CACHE_ENABLED=true                    # Enable/disable file caching (default: true)
CACHE_DB_PATH=./cache/files.db        # SQLite database file location
CACHE_SYNC_INTERVAL_INTERNAL=600000   # Sync interval for internal folders in ms (default: 10 minutes)
CACHE_SYNC_INTERVAL_EXTERNAL=300000   # Sync interval for external folders in ms (default: 5 minutes)
```

---

## Implementation Steps

### Phase 1: SQLite Cache Infrastructure

#### 1. Add SQLite Dependency
```bash
npm install better-sqlite3
```

- Add `better-sqlite3` to `package.json`
- Lightweight, synchronous, no external dependencies
- Well-suited for single-process applications

#### 2. Create Cache Module (`file-cache.js`)

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS files (
  path TEXT PRIMARY KEY,           -- Full relative path (unique identifier)
  name TEXT NOT NULL,              -- File/directory name
  parent_path TEXT NOT NULL,       -- Parent directory path (empty string for root)
  size INTEGER DEFAULT 0,          -- File size in bytes (0 for directories)
  modified INTEGER NOT NULL,       -- Modified timestamp (Unix ms)
  created INTEGER NOT NULL,        -- Created timestamp (Unix ms)
  is_directory INTEGER NOT NULL,   -- 1 for directories, 0 for files
  last_synced INTEGER NOT NULL     -- Last cache sync timestamp
);

-- Index for fast directory listing
CREATE INDEX IF NOT EXISTS idx_parent_path ON files(parent_path);

-- Index for fast search
CREATE INDEX IF NOT EXISTS idx_name_lower ON files(lower(name));

-- Cache metadata table
CREATE TABLE IF NOT EXISTS cache_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

**Core Functions:**
```javascript
// Initialization
initializeCache()           // Create DB, tables, start background sync
getCacheStatus()            // Return { ready, totalFiles, lastSync, syncInProgress }

// Query functions
getFiles(parentPath, page, limit, showHidden)  // Paginated directory listing
getFilesCount(parentPath, showHidden)          // Total count for pagination
searchFiles(query, useRegex, page, limit)      // Search with pagination
getStorageInfo()                               // Aggregated stats (SUM, COUNT)

// Sync functions (called after file operations)
addFile(filePath, stats)                       // Insert/update single file
addFiles(filesArray)                           // Bulk insert (for initial scan)
deleteFile(filePath)                           // Remove file (recursive for dirs)
renameFile(oldPath, newPath)                   // Update paths (recursive for dirs)
syncDirectory(dirPath)                         // Rescan specific directory
rebuildCache()                                 // Full filesystem scan

// Background sync
startPeriodicSync(interval)                    // Start background sync timer
stopPeriodicSync()                             // Stop background sync
```

#### 3. Startup Behavior (Non-blocking)

```javascript
// In server.js startup
const cache = require('./file-cache.js');

// Initialize cache (non-blocking)
cache.initializeCache(uploadsPath, {
  dbPath: process.env.CACHE_DB_PATH || './cache/files.db',
  syncInterval: ALLOW_EXTERNAL_UPLOAD_FOLDER 
    ? parseInt(process.env.CACHE_SYNC_INTERVAL_EXTERNAL) || 300000   // 5 min
    : parseInt(process.env.CACHE_SYNC_INTERVAL_INTERNAL) || 600000   // 10 min
});

// Server starts immediately
app.listen(PORT);

// Cache builds in background, endpoints fallback to filesystem if not ready
```

**Console Output During Startup:**
```
📂 Upload Directory Configuration:
   Type: relative path
   Resolved: /app/uploads
   Status: ✓ Directory exists

🗄️  Cache Status:
   Database: ./cache/files.db
   Building cache... 1,234 / 5,678 files
   Sync interval: 10 minutes (internal folder)

🚀 File Manager Server running on http://localhost:3000
   ℹ️  Cache building in background, using filesystem fallback
```

---

### Phase 2: Update API Endpoints

#### 4. Update `/api/files` Endpoint (line 492)

**New Query Parameters:**
- `page` (default: 1, min: 1)
- `limit` (default: 50, max: 500, min: 1)
- `showHidden` (default: false) - filter files starting with `.`

**New Response Format:**
```json
{
  "currentPath": "products",
  "items": [
    {
      "name": "image.jpg",
      "path": "products/image.jpg",
      "isDirectory": false,
      "size": 12345,
      "modified": "2024-01-15T10:30:00.000Z",
      "created": "2024-01-10T08:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Implementation:**
```javascript
app.get('/api/files', requireAuth, async (req, res) => {
  try {
    const subPath = req.query.path || '';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
    const showHidden = req.query.showHidden === 'true';
    
    // Security check
    const fullPath = path.join(uploadsPath, subPath);
    if (!fullPath.startsWith(uploadsPath)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Try cache first, fallback to filesystem
    if (cache.isReady()) {
      const { items, total } = cache.getFiles(subPath, page, limit, showHidden);
      return res.json({
        currentPath: subPath,
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      });
    }
    
    // Filesystem fallback (existing implementation with pagination)
    // ... existing fs.readdir code with manual pagination ...
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Sorting:** Directories first, then alphabetically by name (case-insensitive)
```sql
ORDER BY is_directory DESC, lower(name) ASC
LIMIT ? OFFSET ?
```

#### 5. Update `/api/search` Endpoint (line 703)

**Changes:**
- Add pagination support (same params as `/api/files`)
- Use SQL `LIKE` for simple search (case-insensitive)
- For regex search: fallback to filesystem if cache doesn't support regex

**SQL for Simple Search:**
```sql
SELECT * FROM files 
WHERE lower(name) LIKE '%' || lower(?) || '%'
ORDER BY is_directory DESC, lower(name) ASC
LIMIT ? OFFSET ?
```

**Regex Handling:**
- SQLite doesn't have native regex support
- For `regex=true`: Either add custom regex function OR fallback to filesystem scan
- Recommendation: Fallback to filesystem for regex (rare use case)

#### 6. Update `/api/storage` Endpoint (line 761)

**Use SQL Aggregation:**
```sql
SELECT 
  COALESCE(SUM(CASE WHEN is_directory = 0 THEN size ELSE 0 END), 0) as totalSize,
  COUNT(CASE WHEN is_directory = 0 THEN 1 END) as fileCount,
  COUNT(CASE WHEN is_directory = 1 THEN 1 END) as folderCount
FROM files
```

---

### Phase 3: Cache Synchronization

#### 7. Sync Cache on Upload (line 537)

After `fs.rename()` in upload handler:
```javascript
// After moving file to final destination
await fs.rename(file.path, targetPath);

// Update cache
const stats = await fs.stat(targetPath);
cache.addFile(path.relative(uploadsPath, targetPath), {
  size: stats.size,
  modified: stats.mtimeMs,
  created: stats.birthtimeMs,
  isDirectory: false
});
```

For folder uploads, add all files:
```javascript
// After folder upload completes
for (const file of movedFiles) {
  cache.addFile(file.path, { ... });
}
// Also add created directories
for (const folder of createdFolders) {
  cache.addFile(folder, { isDirectory: true, ... });
}
```

#### 8. Sync Cache on Delete (line 645)

After `fs.unlink()` or `fs.rm()`:
```javascript
// For files
await fs.unlink(fullPath);
cache.deleteFile(path.relative(uploadsPath, fullPath));

// For directories (recursive delete in cache)
await fs.rm(fullPath, { recursive: true, force: true });
cache.deleteFile(path.relative(uploadsPath, fullPath)); // Deletes all children too
```

#### 9. Sync Cache on Rename (line 669)

After `fs.rename()`:
```javascript
await fs.rename(oldPath, newPath);
cache.renameFile(
  path.relative(uploadsPath, oldPath),
  path.relative(uploadsPath, newPath)
);
```

For directories, update all child paths:
```sql
-- In cache.renameFile() for directories
UPDATE files 
SET path = replace(path, ?, ?),
    parent_path = replace(parent_path, ?, ?)
WHERE path = ? OR path LIKE ? || '/%'
```

#### 10. Sync Cache on Create Folder (line 628)

After `fs.mkdir()`:
```javascript
await fs.mkdir(folderPath, { recursive: true });

const stats = await fs.stat(folderPath);
cache.addFile(path.relative(uploadsPath, folderPath), {
  size: 0,
  modified: stats.mtimeMs,
  created: stats.birthtimeMs,
  isDirectory: true
});
```

---

### Phase 4: Pagination UI

#### 11. Add Pagination HTML (`public/index.html`)

Add pagination controls below file table:
```html
<div id="paginationControls" class="pagination-controls" style="display: none;">
  <div class="pagination-info">
    Showing <span id="paginationStart">1</span>-<span id="paginationEnd">50</span> 
    of <span id="paginationTotal">0</span> items
  </div>
  
  <div class="pagination-buttons">
    <button id="prevPageBtn" class="btn btn-secondary" onclick="prevPage()" disabled>
      ← Previous
    </button>
    
    <div class="pagination-pages" id="paginationPages">
      <!-- Page numbers inserted dynamically -->
    </div>
    
    <button id="nextPageBtn" class="btn btn-secondary" onclick="nextPage()" disabled>
      Next →
    </button>
  </div>
  
  <div class="pagination-size">
    <label>Items per page:</label>
    <select id="itemsPerPage" onchange="changeItemsPerPage(this.value)">
      <option value="25">25</option>
      <option value="50" selected>50</option>
      <option value="100">100</option>
      <option value="200">200</option>
    </select>
  </div>
</div>
```

**Pagination Styles:**
```css
.pagination-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-top: 1px solid var(--gray-200);
  background: var(--gray-50);
  flex-wrap: wrap;
  gap: 12px;
}

.pagination-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination-pages {
  display: flex;
  gap: 4px;
}

.pagination-pages button {
  min-width: 36px;
  padding: 6px 10px;
}

.pagination-pages button.active {
  background: var(--primary);
  color: white;
}

.pagination-info {
  color: var(--text-secondary);
  font-size: 14px;
}

.pagination-size {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination-size select {
  padding: 6px 10px;
  border: 1px solid var(--gray-300);
  border-radius: 4px;
}
```

#### 12. Add Pagination State (`public/app.js`)

```javascript
// Pagination state
let paginationState = {
  page: 1,
  limit: parseInt(localStorage.getItem('itemsPerPage')) || 50,
  total: 0,
  totalPages: 0
};

// Reset pagination when navigating
function resetPagination() {
  paginationState.page = 1;
}

// Save items per page preference
function saveItemsPerPage(limit) {
  localStorage.setItem('itemsPerPage', limit);
}
```

#### 13. Update `loadFiles()` Function

```javascript
async function loadFiles(path = '', page = 1) {
  currentPath = path;
  
  // Reset to page 1 if navigating to new directory
  if (page === 1) {
    paginationState.page = 1;
  }
  
  showLoading(true);
  
  try {
    const params = new URLSearchParams({
      path: path,
      page: paginationState.page,
      limit: paginationState.limit,
      showHidden: showHiddenFiles
    });
    
    const response = await fetch(`/api/files?${params}`, {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (response.ok) {
      // Update pagination state from response
      if (data.pagination) {
        paginationState.total = data.pagination.total;
        paginationState.totalPages = data.pagination.totalPages;
        paginationState.page = data.pagination.page;
      }
      
      renderFileList(data.items);
      renderBreadcrumb(path);
      renderPagination(data.pagination);
    } else {
      // ... error handling ...
    }
  } catch (error) {
    // ... error handling ...
  } finally {
    showLoading(false);
  }
}
```

#### 14. Add Pagination Rendering and Event Handlers

```javascript
function renderPagination(pagination) {
  const controls = document.getElementById('paginationControls');
  
  if (!pagination || pagination.total === 0) {
    controls.style.display = 'none';
    return;
  }
  
  controls.style.display = 'flex';
  
  // Update info text
  const start = (pagination.page - 1) * pagination.limit + 1;
  const end = Math.min(pagination.page * pagination.limit, pagination.total);
  document.getElementById('paginationStart').textContent = start;
  document.getElementById('paginationEnd').textContent = end;
  document.getElementById('paginationTotal').textContent = pagination.total;
  
  // Update buttons
  document.getElementById('prevPageBtn').disabled = !pagination.hasPrev;
  document.getElementById('nextPageBtn').disabled = !pagination.hasNext;
  
  // Render page numbers
  renderPageNumbers(pagination);
  
  // Update items per page select
  document.getElementById('itemsPerPage').value = pagination.limit;
}

function renderPageNumbers(pagination) {
  const container = document.getElementById('paginationPages');
  const { page, totalPages } = pagination;
  
  let html = '';
  const maxVisible = 5;
  let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  
  // First page + ellipsis
  if (startPage > 1) {
    html += `<button class="btn btn-secondary btn-sm" onclick="goToPage(1)">1</button>`;
    if (startPage > 2) {
      html += `<span style="padding: 0 8px;">...</span>`;
    }
  }
  
  // Page numbers
  for (let i = startPage; i <= endPage; i++) {
    const activeClass = i === page ? 'active' : '';
    html += `<button class="btn btn-secondary btn-sm ${activeClass}" onclick="goToPage(${i})">${i}</button>`;
  }
  
  // Last page + ellipsis
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span style="padding: 0 8px;">...</span>`;
    }
    html += `<button class="btn btn-secondary btn-sm" onclick="goToPage(${totalPages})">${totalPages}</button>`;
  }
  
  container.innerHTML = html;
}

function goToPage(page) {
  paginationState.page = page;
  loadFiles(currentPath, page);
}

function nextPage() {
  if (paginationState.page < paginationState.totalPages) {
    goToPage(paginationState.page + 1);
  }
}

function prevPage() {
  if (paginationState.page > 1) {
    goToPage(paginationState.page - 1);
  }
}

function changeItemsPerPage(limit) {
  paginationState.limit = parseInt(limit);
  paginationState.page = 1; // Reset to first page
  saveItemsPerPage(limit);
  loadFiles(currentPath, 1);
}
```

---

### Phase 5: Background Sync & Error Handling

#### 15. Periodic Background Sync

```javascript
// In file-cache.js
let syncTimer = null;
let syncInProgress = false;

function startPeriodicSync(interval) {
  if (syncTimer) {
    clearInterval(syncTimer);
  }
  
  syncTimer = setInterval(async () => {
    if (syncInProgress) {
      console.log('⏭️  Skipping sync - previous sync still in progress');
      return;
    }
    
    syncInProgress = true;
    console.log('🔄 Starting periodic cache sync...');
    
    try {
      await rebuildCache();
      console.log('✅ Periodic sync completed');
    } catch (error) {
      console.error('❌ Periodic sync failed:', error.message);
    } finally {
      syncInProgress = false;
    }
  }, interval);
  
  console.log(`⏰ Periodic sync scheduled every ${interval / 1000 / 60} minutes`);
}

function stopPeriodicSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}
```

#### 16. Cache Status Endpoint

Add `/api/cache/status` for monitoring:
```javascript
app.get('/api/cache/status', requireAuth, requireAdmin, (req, res) => {
  res.json(cache.getCacheStatus());
});
```

Response:
```json
{
  "enabled": true,
  "ready": true,
  "totalFiles": 5678,
  "totalDirectories": 234,
  "totalSize": 1234567890,
  "lastSync": "2024-01-15T10:30:00.000Z",
  "syncInProgress": false,
  "syncInterval": 600000,
  "databasePath": "./cache/files.db",
  "databaseSize": 524288
}
```

#### 17. Error Handling & Fallback

```javascript
// Wrapper for cache operations with filesystem fallback
async function withCacheFallback(cacheOperation, filesystemFallback) {
  if (!cache.isReady()) {
    return filesystemFallback();
  }
  
  try {
    return cacheOperation();
  } catch (error) {
    console.error('Cache error, falling back to filesystem:', error.message);
    return filesystemFallback();
  }
}
```

#### 18. Symlink Handling

When scanning filesystem, skip symlinks:
```javascript
async function scanDirectory(dirPath) {
  const items = await fs.readdir(dirPath, { withFileTypes: true });
  
  for (const item of items) {
    // Skip symlinks
    if (item.isSymbolicLink()) {
      continue;
    }
    
    // Process regular files and directories
    // ...
  }
}
```

#### 19. Graceful Shutdown

```javascript
// Handle process termination
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  cache.stopPeriodicSync();
  cache.close(); // Close SQLite connection
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  cache.stopPeriodicSync();
  cache.close();
  process.exit(0);
});
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `better-sqlite3` dependency |
| `file-cache.js` | **New file** - Cache module |
| `server.js` | Import cache, update endpoints, add cache sync calls |
| `public/app.js` | Add pagination state, update `loadFiles()`, add pagination handlers |
| `public/index.html` | Add pagination controls HTML and CSS |
| `.env.example` | Add cache configuration variables |

---

## Benefits

- **Performance**: O(1) database lookups vs O(n) filesystem scans
- **Scalability**: Handles large directories efficiently (thousands of files)
- **Pagination**: Better UX with large file lists, faster page loads
- **Non-blocking**: Server available immediately during cache build
- **Crash-safe**: SQLite with WAL mode survives crashes
- **Reduced I/O**: Minimal disk reads after cache is built
- **Configurable**: Different sync intervals for internal/external folders

---

## Testing Checklist

- [ ] Test with empty directories
- [ ] Test with directories containing thousands of files
- [ ] Test pagination edge cases (first page, last page, single page)
- [ ] Test cache sync after upload (single file, folder with files)
- [ ] Test cache sync after delete (file, directory with contents)
- [ ] Test cache sync after rename (file, directory)
- [ ] Test search with pagination
- [ ] Test regex search fallback
- [ ] Test hidden files filter (`showHidden` param)
- [ ] Test startup with existing cache (fast reload)
- [ ] Test startup with no cache (initial build)
- [ ] Test filesystem fallback when cache unavailable
- [ ] Test with symlinks (should be ignored)
- [ ] Test with special characters in filenames
- [ ] Test concurrent operations (multiple uploads)
- [ ] Test periodic sync during file operations
- [ ] Test graceful shutdown
- [ ] Test with external upload folder (5 min sync)
- [ ] Test storage info accuracy

---

## Implementation Order

1. ✅ Add `better-sqlite3` dependency
2. ✅ Add cache environment variables to `.env.example`
3. ✅ Create `file-cache.js` module
4. ✅ Update `server.js` - initialize cache, update `/api/files`
5. ✅ Update `public/app.js` - pagination state and handlers
6. ✅ Update `public/index.html` - pagination UI
7. ✅ Update `/api/search` with pagination
8. ✅ Update `/api/storage` with SQL aggregation
9. ✅ Add cache sync to upload handler
10. ✅ Add cache sync to delete handler
11. ✅ Add cache sync to rename handler
12. ✅ Add cache sync to create folder handler
13. ✅ Add periodic background sync
14. ✅ Add `/api/cache/status` endpoint
15. ✅ Add graceful shutdown handling
16. ✅ Test all scenarios
17. ✅ Performance benchmarking

---

## Notes

- SQLite in WAL mode is very fast for concurrent reads
- Consider adding cache statistics to the About modal
- Monitor cache database size growth over time
- If database grows too large, consider periodic VACUUM
- Hidden files are now filtered server-side for accurate pagination
- Regex search falls back to filesystem (rare use case, acceptable trade-off)
