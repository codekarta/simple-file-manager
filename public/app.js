// Global state
let currentPath = '';
let selectedFiles = [];
let renameTarget = null;
let selectedItems = new Set(); // For bulk delete
let currentUser = null; // Store current user info
let showHiddenFiles = localStorage.getItem('showHiddenFiles') === 'true'; // Hidden files visibility preference

// Pagination state
let paginationState = {
  page: 1,
  limit: parseInt(localStorage.getItem('itemsPerPage')) || 50,
  total: 0,
  totalPages: 0
};

// Custom modal callbacks
let customAlertCallback = null;
let customConfirmCallback = null;
let customPromptCallback = null;
let passwordResetCallback = null;
let passwordResetUsername = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupEventListeners();
  updateHiddenFilesButton(); // Initialize hidden files button state
  
  // Generate initial random password when user management modal is opened
  document.addEventListener('click', function(e) {
    if (e.target.closest('[onclick*="openUserManagement"]')) {
      setTimeout(() => generateRandomPassword(), 100);
    }
  });
});

// Setup event listeners
function setupEventListeners() {
  // Login form
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  
  // Drag and drop
  const uploadArea = document.getElementById('uploadArea');
  if (uploadArea) {
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('drag-over');
    });
    
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('drag-over');
    });
    
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files);
      handleFilesDrop(files);
    });
  }
  
  // Modal click outside to close
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
}

// Authentication
async function checkAuth() {
  try {
    const response = await fetch('/api/auth/status', {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (data.authenticated) {
      currentUser = data.user;
      showApp(data.user);
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (data.success) {
      currentUser = data.user;
      showApp(data.user);
    } else {
      showAlert('loginAlert', data.error || 'Invalid credentials', 'error');
    }
  } catch (error) {
    showAlert('loginAlert', 'Login failed. Please try again.', 'error');
  }
}

async function logout() {
  try {
    await fetch('/api/logout', { 
      method: 'POST',
      credentials: 'include'
    });
    showLogin();
  } catch (error) {
    console.error('Logout error:', error);
  }
}

function showLogin() {
  document.getElementById('loginContainer').style.display = 'flex';
  document.getElementById('appContainer').classList.remove('active');
}

function showApp(user) {
  document.getElementById('loginContainer').style.display = 'none';
  document.getElementById('appContainer').classList.add('active');
  
  // Set username
  const username = typeof user === 'string' ? user : user.username;
  const role = typeof user === 'string' ? 'user' : user.role;
  currentUser = typeof user === 'string' ? { username, role: 'user' } : user;
  
  document.getElementById('currentUser').textContent = username;
  
  // Show/hide admin menu items
  const adminItems = document.querySelectorAll('.admin-only');
  adminItems.forEach(item => {
    item.style.display = role === 'admin' ? 'block' : 'none';
  });
  
  loadFiles();
  loadStorageInfo();
}

// File operations
async function loadFiles(path = '', resetPage = true) {
  currentPath = path;
  
  // Reset to page 1 when navigating to new directory
  if (resetPage) {
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
      // If authentication failed, redirect to login
      if (response.status === 401) {
        console.error('Session expired or not authenticated');
        showLogin();
        showAlert('loginAlert', 'Session expired. Please login again.', 'error');
      } else {
        showAlert('alert', data.error || 'Failed to load files', 'error');
      }
    }
  } catch (error) {
    console.error('Load files error:', error);
    showAlert('alert', 'Failed to load files: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

function renderFileList(items) {
  const tbody = document.getElementById('fileTableBody');
  const emptyState = document.getElementById('emptyState');
  const fileTable = document.getElementById('fileTable');
  
  // Clear selections when rendering new list
  selectedItems.clear();
  updateBulkDeleteButton();
  document.getElementById('selectAll').checked = false;
  
  // Filter hidden files if setting is disabled
  const filteredItems = showHiddenFiles 
    ? items 
    : items.filter(item => !item.name.startsWith('.'));
  
  if (filteredItems.length === 0) {
    fileTable.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }
  
  fileTable.style.display = 'table';
  emptyState.style.display = 'none';
  
  tbody.innerHTML = filteredItems.map(item => {
    const thumbnail = getFileThumbnail(item.name, item.path, item.isDirectory, item.thumbnailUrl);
    const size = item.isDirectory ? '-' : formatFileSize(item.size);
    const modified = new Date(item.modified).toLocaleString();
    const escapedPath = item.path.replace(/'/g, "\\'");
    const escapedName = item.name.replace(/'/g, "\\'");
    const isPrivate = item.accessLevel === 'private';
    const privateIndicator = isPrivate ? '<span class="private-indicator">🔒 Private</span>' : '';
    
    return `
      <tr id="row-${btoa(item.path)}" class="${selectedItems.has(item.path) ? 'selected' : ''}">
        <td class="file-checkbox">
          <input type="checkbox" 
                 class="item-checkbox" 
                 data-path="${escapedPath}" 
                 data-name="${escapedName}"
                 onchange="toggleItemSelection(this)"
                 ${selectedItems.has(item.path) ? 'checked' : ''}>
        </td>
        <td>
          <div class="file-name" onclick="${item.isDirectory ? `loadFiles('${escapedPath}')` : `window.open('/${escapedPath}', '_blank')`}">
            ${thumbnail}
            ${item.name}
            ${privateIndicator}
          </div>
        </td>
        <td>${size}</td>
        <td>${modified}</td>
        <td>
          <div class="file-actions">
            ${!item.isDirectory ? `<button class="icon-btn" onclick="downloadFile('${escapedPath}')" title="Download">⬇️</button>` : ''}
            <button class="icon-btn" onclick="openRenameModal('${escapedPath}', '${escapedName}')" title="Rename">✏️</button>
            <button class="icon-btn" onclick="toggleAccessLevel('${escapedPath}', '${isPrivate ? 'public' : 'private'}')" title="${isPrivate ? 'Make Public' : 'Make Private'}">${isPrivate ? '🔓' : '🔒'}</button>
            <button class="icon-btn danger" onclick="deleteItem('${escapedPath}', '${escapedName}')" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderBreadcrumb(path) {
  const breadcrumb = document.getElementById('breadcrumb');
  const pathInput = document.getElementById('pathInput');
  const parts = path ? path.split('/').filter(p => p) : [];
  
  let html = '<span class="breadcrumb-item" onclick="event.stopPropagation(); loadFiles(\'\')">🏠 Home</span>';
  
  let currentPath = '';
  parts.forEach((part, index) => {
    currentPath += (currentPath ? '/' : '') + part;
    const isLast = index === parts.length - 1;
    
    html += '<span class="breadcrumb-separator">/</span>';
    html += `<span class="breadcrumb-item ${isLast ? 'active' : ''}" onclick="event.stopPropagation(); loadFiles('${currentPath}')">${part}</span>`;
  });
  
  breadcrumb.innerHTML = html;
  breadcrumb.style.display = 'flex';
  
  // Store current path in data attribute for editing
  breadcrumb.dataset.currentPath = path || '';
  
  // Update path input value (hidden by default)
  if (pathInput) {
    pathInput.value = path ? '/' + path : '/';
    pathInput.style.display = 'none';
  }
}

function getFileThumbnail(filename, filepath, isDirectory, thumbnailUrl = null) {
  if (isDirectory) {
    return `
      <div class="file-thumbnail">
        <div class="file-type-icon icon-folder">📁</div>
      </div>
    `;
  }
  
  const ext = filename.split('.').pop().toLowerCase();
  
  // Check if it's an image - use thumbnail if available
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'tif'];
  if (imageExtensions.includes(ext)) {
    // Use thumbnail URL if available, otherwise fall back to original
    const imgSrc = thumbnailUrl || `/${filepath}`;
    return `
      <div class="file-thumbnail">
        <img src="${imgSrc}" alt="${filename}" onerror="this.parentElement.innerHTML='<div class=\\'file-type-icon icon-default\\'>IMG</div>'">
      </div>
    `;
  }
  
  // File type configurations
  const fileTypes = {
    // Documents
    pdf: { class: 'icon-pdf', text: 'PDF' },
    doc: { class: 'icon-doc', text: 'DOC' },
    docx: { class: 'icon-doc', text: 'DOC' },
    txt: { class: 'icon-txt', text: 'TXT' },
    md: { class: 'icon-txt', text: 'MD' },
    rtf: { class: 'icon-doc', text: 'RTF' },
    
    // Spreadsheets
    xls: { class: 'icon-xls', text: 'XLS' },
    xlsx: { class: 'icon-xls', text: 'XLS' },
    csv: { class: 'icon-xls', text: 'CSV' },
    
    // Presentations
    ppt: { class: 'icon-ppt', text: 'PPT' },
    pptx: { class: 'icon-ppt', text: 'PPT' },
    
    // Archives
    zip: { class: 'icon-zip', text: 'ZIP' },
    rar: { class: 'icon-zip', text: 'RAR' },
    tar: { class: 'icon-zip', text: 'TAR' },
    gz: { class: 'icon-zip', text: 'GZ' },
    '7z': { class: 'icon-zip', text: '7Z' },
    
    // Code files
    js: { class: 'icon-code', text: 'JS' },
    ts: { class: 'icon-code', text: 'TS' },
    jsx: { class: 'icon-code', text: 'JSX' },
    tsx: { class: 'icon-code', text: 'TSX' },
    html: { class: 'icon-code', text: 'HTML' },
    css: { class: 'icon-code', text: 'CSS' },
    scss: { class: 'icon-code', text: 'SCSS' },
    json: { class: 'icon-code', text: 'JSON' },
    xml: { class: 'icon-code', text: 'XML' },
    py: { class: 'icon-code', text: 'PY' },
    java: { class: 'icon-code', text: 'JAVA' },
    cpp: { class: 'icon-code', text: 'CPP' },
    c: { class: 'icon-code', text: 'C' },
    php: { class: 'icon-code', text: 'PHP' },
    rb: { class: 'icon-code', text: 'RB' },
    go: { class: 'icon-code', text: 'GO' },
    rs: { class: 'icon-code', text: 'RS' },
    
    // Video
    mp4: { class: 'icon-video', text: 'MP4' },
    avi: { class: 'icon-video', text: 'AVI' },
    mov: { class: 'icon-video', text: 'MOV' },
    mkv: { class: 'icon-video', text: 'MKV' },
    wmv: { class: 'icon-video', text: 'WMV' },
    flv: { class: 'icon-video', text: 'FLV' },
    
    // Audio
    mp3: { class: 'icon-audio', text: 'MP3' },
    wav: { class: 'icon-audio', text: 'WAV' },
    flac: { class: 'icon-audio', text: 'FLAC' },
    aac: { class: 'icon-audio', text: 'AAC' },
    ogg: { class: 'icon-audio', text: 'OGG' },
    m4a: { class: 'icon-audio', text: 'M4A' }
  };
  
  const fileType = fileTypes[ext] || { class: 'icon-default', text: ext.toUpperCase().substring(0, 4) };
  
  return `
    <div class="file-thumbnail">
      <div class="file-type-icon ${fileType.class}">${fileType.text}</div>
    </div>
  `;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Upload files
function openUploadModal() {
  document.getElementById('uploadModal').classList.add('active');
  document.getElementById('uploadArea').onclick = () => document.getElementById('fileInput').click();
  document.querySelector('#uploadModal .modal-header h2').textContent = '📤 Upload Files';
  selectedFiles = [];
  updateSelectedFilesList();
  // Reset access level toggle to public (unchecked)
  document.getElementById('uploadAccessLevel').checked = false;
  updateUploadToggleText();
}

function openFolderUploadModal() {
  document.getElementById('uploadModal').classList.add('active');
  document.getElementById('uploadArea').onclick = () => document.getElementById('folderInput').click();
  document.querySelector('#uploadModal .modal-header h2').textContent = '📁 Upload Folder';
  selectedFiles = [];
  updateSelectedFilesList();
  // Reset access level toggle to public (unchecked)
  document.getElementById('uploadAccessLevel').checked = false;
  updateUploadToggleText();
}

function closeUploadModal() {
  document.getElementById('uploadModal').classList.remove('active');
  document.getElementById('fileInput').value = '';
  document.getElementById('folderInput').value = '';
  selectedFiles = [];
  updateSelectedFilesList();
  // Reset access level toggle
  document.getElementById('uploadAccessLevel').checked = false;
  updateUploadToggleText();
}

// Update upload access level toggle text
function updateUploadToggleText() {
  const checkbox = document.getElementById('uploadAccessLevel');
  const textSpan = document.getElementById('uploadAccessText');
  if (checkbox.checked) {
    textSpan.textContent = 'Private';
    textSpan.className = 'toggle-text private';
  } else {
    textSpan.textContent = 'Public';
    textSpan.className = 'toggle-text public';
  }
}

// Update folder access level toggle text
function updateFolderToggleText() {
  const checkbox = document.getElementById('folderAccessLevel');
  const textSpan = document.getElementById('folderAccessText');
  if (checkbox.checked) {
    textSpan.textContent = 'Private';
    textSpan.className = 'toggle-text private';
  } else {
    textSpan.textContent = 'Public';
    textSpan.className = 'toggle-text public';
  }
}

function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  selectedFiles = files;
  updateSelectedFilesList();
}

function handleFolderSelect(event) {
  const files = Array.from(event.target.files);
  // Files from folder input have webkitRelativePath property
  selectedFiles = files;
  updateSelectedFilesList(true);
}

function handleFilesDrop(files) {
  selectedFiles = files;
  updateSelectedFilesList();
}

function updateSelectedFilesList(isFolder = false) {
  const container = document.getElementById('selectedFiles');
  const uploadBtn = document.getElementById('uploadBtn');
  
  if (selectedFiles.length === 0) {
    container.innerHTML = '';
    uploadBtn.disabled = true;
    return;
  }
  
  uploadBtn.disabled = false;
  
  if (isFolder && selectedFiles[0]?.webkitRelativePath) {
    // Extract folder name from first file's path
    const folderName = selectedFiles[0].webkitRelativePath.split('/')[0];
    const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    
    container.innerHTML = `
      <div style="margin-bottom: 15px; padding: 12px; background: var(--gray-50); border-radius: 6px;">
        <strong>📁 ${folderName}</strong>
        <div style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
          ${selectedFiles.length} files • ${formatFileSize(totalSize)}
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div style="margin-bottom: 15px;">
        <strong>Selected files (${selectedFiles.length}):</strong>
        <ul style="margin-top: 10px; padding-left: 20px; max-height: 200px; overflow-y: auto;">
          ${selectedFiles.map(f => `<li style="margin-bottom: 4px;">${f.name} (${formatFileSize(f.size)})</li>`).join('')}
        </ul>
      </div>
    `;
  }
}

async function uploadFiles() {
  if (selectedFiles.length === 0) return;
  
  const formData = new FormData();
  // Add base path FIRST so multer can parse it before processing files
  formData.append('basePath', currentPath);
  
  // Add access level (public or private)
  const accessLevelCheckbox = document.getElementById('uploadAccessLevel');
  const accessLevel = accessLevelCheckbox && accessLevelCheckbox.checked ? 'private' : 'public';
  formData.append('mediaAccessLevel', accessLevel);
  
  // Check if this is a folder upload (files have webkitRelativePath)
  const isFolder = selectedFiles[0]?.webkitRelativePath;
  
  // Add files with their relative paths for folder uploads
  selectedFiles.forEach(file => {
    formData.append('files', file);
    
    if (isFolder) {
      // For folders, send the relative path so server knows the structure
      formData.append('relativePaths', file.webkitRelativePath);
    }
  });
  
  const uploadBtn = document.getElementById('uploadBtn');
  uploadBtn.disabled = true;
  uploadBtn.textContent = 'Uploading...';
  
  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('alert', data.message, 'success');
      closeUploadModal();
      loadFiles(currentPath);
      loadStorageInfo();
    } else {
      // If authentication failed, redirect to login
      if (response.status === 401) {
        console.error('Session expired during upload');
        closeUploadModal();
        showLogin();
        showAlert('loginAlert', 'Session expired. Please login again.', 'error');
      } else {
        showAlert('alert', data.error || 'Upload failed', 'error');
        console.error('Upload error:', data);
      }
    }
  } catch (error) {
    console.error('Upload exception:', error);
    showAlert('alert', 'Upload failed: ' + error.message, 'error');
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload';
  }
}

// Create folder
function openCreateFolderModal() {
  document.getElementById('createFolderModal').classList.add('active');
  document.getElementById('folderName').value = '';
  // Reset access level toggle to public (unchecked)
  document.getElementById('folderAccessLevel').checked = false;
  updateFolderToggleText();
}

function closeCreateFolderModal() {
  document.getElementById('createFolderModal').classList.remove('active');
  // Reset access level toggle
  document.getElementById('folderAccessLevel').checked = false;
  updateFolderToggleText();
}

async function createFolder() {
  const name = document.getElementById('folderName').value.trim();
  
  if (!name) {
    await customAlert('Please enter a folder name', 'Missing Folder Name');
    return;
  }
  
  // Get access level
  const accessLevelCheckbox = document.getElementById('folderAccessLevel');
  const accessLevel = accessLevelCheckbox && accessLevelCheckbox.checked ? 'private' : 'public';
  
  try {
    const response = await fetch('/api/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentPath, name, mediaAccessLevel: accessLevel }),
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('alert', data.message, 'success');
      closeCreateFolderModal();
      loadFiles(currentPath);
      loadStorageInfo();
    } else {
      showAlert('alert', data.error || 'Failed to create folder', 'error');
    }
  } catch (error) {
    showAlert('alert', 'Failed to create folder', 'error');
  }
}

// Delete
async function deleteItem(path, name) {
  const confirmed = await customConfirm(`Are you sure you want to delete "${name}"?`, 'Confirm Deletion');
  if (!confirmed) {
    return;
  }
  
  try {
    const response = await fetch('/api/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('alert', data.message, 'success');
      loadFiles(currentPath);
      loadStorageInfo();
    } else {
      showAlert('alert', data.error || 'Failed to delete', 'error');
    }
  } catch (error) {
    showAlert('alert', 'Failed to delete', 'error');
  }
}

// Rename
function openRenameModal(path, currentName) {
  renameTarget = path;
  document.getElementById('renameModal').classList.add('active');
  document.getElementById('newName').value = currentName;
}

function closeRenameModal() {
  document.getElementById('renameModal').classList.remove('active');
  renameTarget = null;
}

async function confirmRename() {
  const newName = document.getElementById('newName').value.trim();
  
  if (!newName) {
    await customAlert('Please enter a new name', 'Missing Name');
    return;
  }
  
  try {
    const response = await fetch('/api/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: renameTarget, newName }),
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('alert', data.message, 'success');
      closeRenameModal();
      loadFiles(currentPath);
    } else {
      showAlert('alert', data.error || 'Failed to rename', 'error');
    }
  } catch (error) {
    showAlert('alert', 'Failed to rename', 'error');
  }
}

// Download
function downloadFile(path) {
  window.location.href = `/api/download?path=${encodeURIComponent(path)}`;
}

// Toggle access level (public/private)
async function toggleAccessLevel(itemPath, newAccessLevel) {
  const actionText = newAccessLevel === 'private' ? 'make this item private' : 'make this item public';
  const confirmed = await customConfirm(`Are you sure you want to ${actionText}?`, 'Change Access Level');
  
  if (!confirmed) {
    return;
  }
  
  try {
    const response = await fetch('/api/access-level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: itemPath, accessLevel: newAccessLevel }),
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('alert', data.message, 'success');
      loadFiles(currentPath, false); // Reload without resetting page
    } else {
      showAlert('alert', data.error || 'Failed to change access level', 'error');
    }
  } catch (error) {
    showAlert('alert', 'Failed to change access level: ' + error.message, 'error');
  }
}

// Search
let searchTimeout;
let isRegexEnabled = false;

function toggleRegex() {
  isRegexEnabled = !isRegexEnabled;
  const regexToggle = document.getElementById('regexToggle');
  
  if (isRegexEnabled) {
    regexToggle.classList.add('active');
  } else {
    regexToggle.classList.remove('active');
  }
  
  // Re-trigger search if there's text
  const searchInput = document.getElementById('searchInput');
  if (searchInput.value.trim().length >= 2) {
    handleSearch({ target: searchInput });
  }
}

function handleSearch(event) {
  clearTimeout(searchTimeout);
  
  const query = event.target.value.trim();
  
  if (query.length < 2) {
    loadFiles(currentPath);
    return;
  }
  
  searchTimeout = setTimeout(() => {
    searchFiles(query, isRegexEnabled);
  }, 500);
}

async function searchFiles(query, useRegex = false) {
  showLoading(true);
  
  try {
    const params = new URLSearchParams({
      q: query,
      regex: useRegex,
      page: paginationState.page,
      limit: paginationState.limit,
      showHidden: showHiddenFiles
    });
    
    const response = await fetch(`/api/search?${params}`, {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (response.ok) {
      // Update pagination state if available
      if (data.pagination) {
        paginationState.total = data.pagination.total;
        paginationState.totalPages = data.pagination.totalPages;
        paginationState.page = data.pagination.page;
      }
      
      renderFileList(data.results);
      const searchType = useRegex ? ' (Regex)' : '';
      document.getElementById('breadcrumb').innerHTML = `<span class="breadcrumb-item active">🔍 Search results for "${query}"${searchType}</span>`;
      renderPagination(data.pagination);
    } else {
      showAlert('alert', data.error || 'Search failed', 'error');
    }
  } catch (error) {
    showAlert('alert', 'Search failed', 'error');
  } finally {
    showLoading(false);
  }
}

// Pagination functions
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
  
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  
  let html = '';
  const maxVisible = 5;
  let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  
  // First page + ellipsis
  if (startPage > 1) {
    html += `<button class="btn btn-secondary" onclick="goToPage(1)">1</button>`;
    if (startPage > 2) {
      html += `<span class="ellipsis">...</span>`;
    }
  }
  
  // Page numbers
  for (let i = startPage; i <= endPage; i++) {
    const activeClass = i === page ? 'active' : '';
    html += `<button class="btn btn-secondary ${activeClass}" onclick="goToPage(${i})">${i}</button>`;
  }
  
  // Last page + ellipsis
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span class="ellipsis">...</span>`;
    }
    html += `<button class="btn btn-secondary" onclick="goToPage(${totalPages})">${totalPages}</button>`;
  }
  
  container.innerHTML = html;
}

function goToPage(page) {
  paginationState.page = page;
  loadFiles(currentPath, false);
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
  localStorage.setItem('itemsPerPage', limit);
  loadFiles(currentPath, false);
}

// Storage info
async function loadStorageInfo() {
  try {
    const response = await fetch('/api/storage', {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (response.ok) {
      document.getElementById('totalSize').textContent = formatFileSize(data.totalSize);
      document.getElementById('fileCount').textContent = data.fileCount;
      document.getElementById('folderCount').textContent = data.folderCount;
    }
  } catch (error) {
    console.error('Failed to load storage info:', error);
  }
}

// Bulk delete functions
function toggleItemSelection(checkbox) {
  const path = checkbox.getAttribute('data-path');
  const row = checkbox.closest('tr');
  
  if (checkbox.checked) {
    selectedItems.add(path);
    row.classList.add('selected');
  } else {
    selectedItems.delete(path);
    row.classList.remove('selected');
  }
  
  updateBulkDeleteButton();
  updateSelectAllCheckbox();
}

function toggleSelectAll(checkbox) {
  const itemCheckboxes = document.querySelectorAll('.item-checkbox');
  
  itemCheckboxes.forEach(itemCheckbox => {
    itemCheckbox.checked = checkbox.checked;
    const path = itemCheckbox.getAttribute('data-path');
    const row = itemCheckbox.closest('tr');
    
    if (checkbox.checked) {
      selectedItems.add(path);
      row.classList.add('selected');
    } else {
      selectedItems.delete(path);
      row.classList.remove('selected');
    }
  });
  
  updateBulkDeleteButton();
}

function updateSelectAllCheckbox() {
  const itemCheckboxes = document.querySelectorAll('.item-checkbox');
  const selectAllCheckbox = document.getElementById('selectAll');
  
  if (itemCheckboxes.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    return;
  }
  
  const checkedCount = document.querySelectorAll('.item-checkbox:checked').length;
  
  if (checkedCount === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  } else if (checkedCount === itemCheckboxes.length) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  }
}

function updateBulkDeleteButton() {
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const selectedCount = document.getElementById('selectedCount');
  
  if (selectedItems.size > 0) {
    bulkDeleteBtn.style.display = 'inline-flex';
    selectedCount.textContent = selectedItems.size;
  } else {
    bulkDeleteBtn.style.display = 'none';
  }
}

async function bulkDelete() {
  const count = selectedItems.size;
  
  if (count === 0) return;
  
  const message = `Are you sure you want to delete ${count} item(s)? This action cannot be undone.`;
  
  const confirmed = await customConfirm(message, 'Confirm Bulk Deletion');
  if (!confirmed) {
    return;
  }
  
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const originalText = bulkDeleteBtn.innerHTML;
  bulkDeleteBtn.disabled = true;
  bulkDeleteBtn.innerHTML = '⏳ Deleting...';
  
  const itemsToDelete = Array.from(selectedItems);
  let successCount = 0;
  let errorCount = 0;
  
  for (const itemPath of itemsToDelete) {
    try {
      const response = await fetch('/api/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: itemPath }),
        credentials: 'include'
      });
      
      if (response.ok) {
        successCount++;
      } else {
        errorCount++;
        console.error(`Failed to delete: ${itemPath}`);
      }
    } catch (error) {
      errorCount++;
      console.error(`Error deleting ${itemPath}:`, error);
    }
  }
  
  // Clear selections
  selectedItems.clear();
  updateBulkDeleteButton();
  
  // Show result
  if (errorCount === 0) {
    showAlert('alert', `Successfully deleted ${successCount} item(s)`, 'success');
  } else {
    showAlert('alert', `Deleted ${successCount} item(s), ${errorCount} failed`, 'error');
  }
  
  // Reload file list
  loadFiles(currentPath);
  loadStorageInfo();
  
  bulkDeleteBtn.disabled = false;
  bulkDeleteBtn.innerHTML = originalText;
}

// UI helpers
function showLoading(show) {
  const loading = document.getElementById('loading');
  const content = document.getElementById('fileListContent');
  
  if (show) {
    loading.classList.add('active');
    content.style.display = 'none';
  } else {
    loading.classList.remove('active');
    content.style.display = 'block';
  }
}

// Toggle hidden files visibility
function toggleHiddenFiles() {
  showHiddenFiles = !showHiddenFiles;
  localStorage.setItem('showHiddenFiles', showHiddenFiles.toString());
  updateHiddenFilesButton();
  loadFiles(currentPath); // Reload current directory with new filter
}

// Update hidden files button appearance
function updateHiddenFilesButton() {
  const btn = document.getElementById('hiddenFilesToggle');
  if (btn) {
    if (showHiddenFiles) {
      btn.classList.add('active');
      btn.title = 'Hide hidden files';
    } else {
      btn.classList.remove('active');
      btn.title = 'Show hidden files';
    }
  }
}

// Enable path editing mode when clicking breadcrumb area
function enablePathEdit(event) {
  // Don't enable if clicking on a breadcrumb item (they handle navigation)
  if (event && event.target.classList.contains('breadcrumb-item')) {
    return;
  }
  
  const breadcrumb = document.getElementById('breadcrumb');
  const pathInput = document.getElementById('pathInput');
  
  if (breadcrumb && pathInput) {
    // Switch to edit mode
    breadcrumb.style.display = 'none';
    pathInput.style.display = 'block';
    
    // Focus and move cursor to end of text
    setTimeout(() => {
      pathInput.focus();
      // Move cursor to end
      const length = pathInput.value.length;
      pathInput.setSelectionRange(length, length);
    }, 0);
  }
}

// Disable path editing mode (called on blur or after navigation)
function disablePathEdit() {
  const breadcrumb = document.getElementById('breadcrumb');
  const pathInput = document.getElementById('pathInput');
  
  if (breadcrumb && pathInput) {
    // Show breadcrumb, hide input
    setTimeout(() => {
      breadcrumb.style.display = 'flex';
      pathInput.style.display = 'none';
    }, 100);
  }
}

// Handle path input navigation
function handlePathInputKeydown(event) {
  const pathInput = document.getElementById('pathInput');
  
  if (event.key === 'Enter') {
    event.preventDefault();
    let path = pathInput.value.trim();
    
    // Remove leading/trailing slashes for navigation
    path = path.replace(/^\/+|\/+$/g, '');
    
    // Navigate to the path
    loadFiles(path);
    
    // Blur will trigger disablePathEdit
    pathInput.blur();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    // Cancel editing - restore original path
    const breadcrumb = document.getElementById('breadcrumb');
    const originalPath = breadcrumb?.dataset.currentPath || '';
    pathInput.value = originalPath ? '/' + originalPath : '/';
    pathInput.blur();
  }
}

function showAlert(elementId, message, type) {
  const alert = document.getElementById(elementId);
  alert.className = `alert alert-${type} active`;
  alert.textContent = message;
  
  setTimeout(() => {
    alert.classList.remove('active');
  }, 5000);
}

// ========== CUSTOM MODAL FUNCTIONS ==========

// Custom Alert
function customAlert(message, title = 'Alert') {
  return new Promise((resolve) => {
    document.getElementById('customAlertTitle').textContent = title;
    document.getElementById('customAlertMessage').textContent = message;
    document.getElementById('customAlertModal').classList.add('active');
    customAlertCallback = resolve;
  });
}

function closeCustomAlert() {
  document.getElementById('customAlertModal').classList.remove('active');
  if (customAlertCallback) {
    customAlertCallback();
    customAlertCallback = null;
  }
}

// Custom Confirm
function customConfirm(message, title = 'Confirm') {
  return new Promise((resolve) => {
    document.getElementById('customConfirmTitle').textContent = title;
    document.getElementById('customConfirmMessage').textContent = message;
    document.getElementById('customConfirmModal').classList.add('active');
    customConfirmCallback = resolve;
  });
}

function closeCustomConfirm(result) {
  document.getElementById('customConfirmModal').classList.remove('active');
  if (customConfirmCallback) {
    customConfirmCallback(result);
    customConfirmCallback = null;
  }
}

// Custom Prompt
function customPrompt(message, title = 'Input Required') {
  return new Promise((resolve) => {
    document.getElementById('customPromptTitle').textContent = title;
    document.getElementById('customPromptMessage').textContent = message;
    document.getElementById('customPromptInput').value = '';
    document.getElementById('customPromptModal').classList.add('active');
    
    // Focus on input
    setTimeout(() => {
      document.getElementById('customPromptInput').focus();
    }, 100);
    
    // Handle Enter key
    const handleEnter = (e) => {
      if (e.key === 'Enter') {
        closeCustomPrompt(document.getElementById('customPromptInput').value);
        document.getElementById('customPromptInput').removeEventListener('keypress', handleEnter);
      }
    };
    document.getElementById('customPromptInput').addEventListener('keypress', handleEnter);
    
    customPromptCallback = resolve;
  });
}

function closeCustomPrompt(result) {
  document.getElementById('customPromptModal').classList.remove('active');
  if (customPromptCallback) {
    customPromptCallback(result);
    customPromptCallback = null;
  }
}

// ========== SETTINGS FUNCTIONS (Admin Only) ==========

// Open Settings modal
function openSettingsModal() {
  document.getElementById('settingsModal').classList.add('active');
  document.getElementById('settingsAlert').className = 'alert';
  document.getElementById('settingsAlert').textContent = '';
  loadThumbnailStatus();
}

// Close Settings modal
function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('active');
}

// Load thumbnail status
async function loadThumbnailStatus() {
  const statusText = document.getElementById('thumbStatusText');
  try {
    const response = await fetch('/api/thumbnails/status', {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (response.ok && data.initialized) {
      statusText.innerHTML = `✅ Initialized | Size: ${data.thumbnailSize}x${data.thumbnailSize} | Format: ${data.thumbnailFormat.toUpperCase()}`;
    } else {
      statusText.innerHTML = '❌ Not initialized';
    }
  } catch (error) {
    statusText.innerHTML = '❌ Error loading status';
  }
}

// Sync cache
async function syncCache() {
  const btn = document.getElementById('syncCacheBtn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⏳ Syncing...';
  
  try {
    const response = await fetch('/api/cache/rebuild', {
      method: 'POST',
      credentials: 'include'
    });
    const data = await response.json();
    
    if (response.ok) {
      showAlert('settingsAlert', 'Cache sync started in background', 'success');
    } else {
      showAlert('settingsAlert', data.error || 'Failed to sync cache', 'error');
    }
  } catch (error) {
    showAlert('settingsAlert', 'Failed to sync cache: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// Generate thumbnails
async function generateThumbnails() {
  const btn = document.getElementById('generateThumbBtn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⏳ Generating...';
  
  try {
    const response = await fetch('/api/thumbnails/generate', {
      method: 'POST',
      credentials: 'include'
    });
    const data = await response.json();
    
    if (response.ok) {
      showAlert('settingsAlert', 'Thumbnail generation started in background', 'success');
    } else {
      showAlert('settingsAlert', data.error || 'Failed to generate thumbnails', 'error');
    }
  } catch (error) {
    showAlert('settingsAlert', 'Failed to generate thumbnails: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// Sync thumbnails (generate missing + remove orphaned)
async function syncThumbnails() {
  const btn = document.getElementById('syncThumbBtn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⏳ Syncing...';
  
  try {
    const response = await fetch('/api/thumbnails/sync', {
      method: 'POST',
      credentials: 'include'
    });
    const data = await response.json();
    
    if (response.ok) {
      showAlert('settingsAlert', 'Thumbnail sync started in background', 'success');
    } else {
      showAlert('settingsAlert', data.error || 'Failed to sync thumbnails', 'error');
    }
  } catch (error) {
    showAlert('settingsAlert', 'Failed to sync thumbnails: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// ========== USER MANAGEMENT FUNCTIONS ==========

// Open About modal
async function openAbout() {
  document.getElementById('aboutModal').classList.add('active');
  await loadAboutInfo();
}

function closeAbout() {
  document.getElementById('aboutModal').classList.remove('active');
}

// Load about information
async function loadAboutInfo() {
  try {
    const response = await fetch('/api/about', {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (response.ok) {
      document.getElementById('aboutVersion').textContent = data.version || 'Unknown';
      document.getElementById('aboutDescription').textContent = data.description || 'Simple file manager with authentication';
      document.getElementById('aboutLicense').textContent = data.license || 'MIT';
    } else {
      document.getElementById('aboutVersion').textContent = 'Unknown';
      document.getElementById('aboutDescription').textContent = 'Simple file manager with authentication';
      document.getElementById('aboutLicense').textContent = 'MIT';
    }
  } catch (error) {
    console.error('Failed to load about info:', error);
    document.getElementById('aboutVersion').textContent = 'Unknown';
    document.getElementById('aboutDescription').textContent = 'Simple file manager with authentication';
    document.getElementById('aboutLicense').textContent = 'MIT';
  }
}

// Open change password modal
function openChangePasswordModal() {
  document.getElementById('changePasswordModal').classList.add('active');
  document.getElementById('oldPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';
  document.getElementById('changePasswordAlert').className = 'alert';
  document.getElementById('changePasswordAlert').textContent = '';
  
  // Focus on first input
  setTimeout(() => {
    document.getElementById('oldPassword').focus();
  }, 100);
}

function closeChangePasswordModal() {
  document.getElementById('changePasswordModal').classList.remove('active');
  document.getElementById('oldPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';
}

// Open API Token modal
function openUserSettings() {
  document.getElementById('userSettingsModal').classList.add('active');
  loadUserInfo();
}

function closeUserSettings() {
  document.getElementById('userSettingsModal').classList.remove('active');
}

// Load current user info
async function loadUserInfo() {
  try {
    const response = await fetch('/api/user/me', {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (response.ok) {
      currentUser = data.user;
      
      // Display API key if exists
      const noApiKeyMsg = document.getElementById('noApiKeyMsg');
      const apiKeyValue = document.getElementById('apiKeyValue');
      
      if (data.user.hasApiKey && data.user.apiKey) {
        noApiKeyMsg.style.display = 'none';
        apiKeyValue.value = data.user.apiKey;
      } else {
        noApiKeyMsg.style.display = 'block';
        apiKeyValue.value = '';
      }
    }
  } catch (error) {
    console.error('Failed to load user info:', error);
  }
}

// Change password
async function changePassword() {
  const oldPassword = document.getElementById('oldPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  
  if (!oldPassword || !newPassword || !confirmPassword) {
    showAlert('changePasswordAlert', 'All password fields are required', 'error');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    showAlert('changePasswordAlert', 'New passwords do not match', 'error');
    return;
  }
  
  if (newPassword.length < 8) {
    showAlert('changePasswordAlert', 'Password must be at least 8 characters', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/user/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword }),
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('changePasswordAlert', 'Password changed successfully', 'success');
      // Clear fields and close modal after a short delay
      setTimeout(() => {
        document.getElementById('oldPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        closeChangePasswordModal();
      }, 1500);
    } else {
      showAlert('changePasswordAlert', data.error || 'Failed to change password', 'error');
    }
  } catch (error) {
    showAlert('changePasswordAlert', 'Failed to change password', 'error');
  }
}

// Generate API token
async function generateApiToken() {
  const password = await customPrompt('Enter your password to generate API token:', 'Generate API Token');
  
  if (!password) {
    return;
  }
  
  try {
    const response = await fetch('/api/user/generate-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('userSettingsAlert', 'API token generated successfully', 'success');
      loadUserInfo();
      
      // Show the API key in a copyable format
      await customAlert(`Your new API token (save this securely):\n\n${data.apiKey}\n\nYou can use it in Bearer token or as URL parameter.`, 'API Token Generated');
    } else {
      showAlert('userSettingsAlert', data.error || 'Failed to generate token', 'error');
    }
  } catch (error) {
    showAlert('userSettingsAlert', 'Failed to generate token', 'error');
  }
}

// Delete API token
async function deleteApiToken() {
  const confirmed = await customConfirm('Are you sure you want to delete your API token? This action cannot be undone.', 'Delete API Token');
  if (!confirmed) {
    return;
  }
  
  const password = await customPrompt('Enter your password to delete API token:', 'Delete API Token');
  
  if (!password) {
    return;
  }
  
  try {
    const response = await fetch('/api/user/delete-token', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('userSettingsAlert', 'API token deleted successfully', 'success');
      loadUserInfo();
    } else {
      showAlert('userSettingsAlert', data.error || 'Failed to delete token', 'error');
    }
  } catch (error) {
    showAlert('userSettingsAlert', 'Failed to delete token', 'error');
  }
}

// Copy API token to clipboard
function copyApiToken() {
  const apiKeyValue = document.getElementById('apiKeyValue').value;
  if (!apiKeyValue) {
    showAlert('userSettingsAlert', 'No API token to copy', 'error');
    return;
  }
  navigator.clipboard.writeText(apiKeyValue).then(() => {
    showAlert('userSettingsAlert', 'API token copied to clipboard', 'success');
  }).catch(() => {
    showAlert('userSettingsAlert', 'Failed to copy token', 'error');
  });
}

// ========== ADMIN USER MANAGEMENT FUNCTIONS ==========

// Generate random password
function generateRandomPassword() {
  const length = 16;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  document.getElementById('newUserPassword').value = password;
}

// Open user management modal
function openUserManagement() {
  document.getElementById('userManagementModal').classList.add('active');
  loadUsers();
  generateRandomPassword(); // Generate initial password
}

function closeUserManagement() {
  document.getElementById('userManagementModal').classList.remove('active');
}

// Load all users (admin only)
async function loadUsers() {
  try {
    const response = await fetch('/api/admin/users', {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (response.ok) {
      renderUserList(data.users);
    } else {
      showAlert('userMgmtAlert', data.error || 'Failed to load users', 'error');
    }
  } catch (error) {
    showAlert('userMgmtAlert', 'Failed to load users', 'error');
  }
}

// Render user list
function renderUserList(users) {
  const tbody = document.getElementById('userTableBody');
  
  tbody.innerHTML = users.map(user => `
    <tr>
      <td>${user.username}</td>
      <td><span class="user-role ${user.role}">${user.role}</span></td>
      <td>${user.hasApiKey ? '✅ Yes' : '❌ No'}</td>
      <td>${new Date(user.createdAt).toLocaleDateString()}</td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" onclick="resetUserPassword('${user.username}')" 
                  ${user.username === currentUser.username ? 'disabled title="Cannot reset your own password"' : ''}>
            🔄 Reset Password
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.username}')" 
                  ${user.username === currentUser.username ? 'disabled title="Cannot delete yourself"' : ''}>
            🗑️ Delete
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Create new user (admin only)
async function createUser() {
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newUserPassword').value.trim();
  const role = document.getElementById('newUserRole').value;
  
  if (!username) {
    showAlert('userMgmtAlert', 'Username is required', 'error');
    return;
  }
  
  // Allow simple usernames (letters, numbers, hyphens, underscores) or valid email addresses
  const simpleUsernamePattern = /^[a-zA-Z0-9_-]+$/;
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!simpleUsernamePattern.test(username) && !emailPattern.test(username)) {
    showAlert('userMgmtAlert', 'Username must be alphanumeric (with hyphens/underscores) or a valid email address', 'error');
    return;
  }
  
  if (!password) {
    showAlert('userMgmtAlert', 'Password is required', 'error');
    return;
  }
  
  if (password.length < 8) {
    showAlert('userMgmtAlert', 'Password must be at least 8 characters long', 'error');
    return;
  }
  
  try {
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, role, password }),
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('userMgmtAlert', 'User created successfully!', 'success');
      await customAlert(`User created successfully!\n\nUsername: ${data.user.username}\nPassword: ${password}\nRole: ${data.user.role}\n\nPlease save this password securely. It won't be shown again.`, 'User Created');
      document.getElementById('newUsername').value = '';
      document.getElementById('newUserPassword').value = '';
      document.getElementById('newUserRole').value = 'user';
      generateRandomPassword(); // Generate new password for next user
      loadUsers();
    } else {
      showAlert('userMgmtAlert', data.error || 'Failed to create user', 'error');
    }
  } catch (error) {
    showAlert('userMgmtAlert', 'Failed to create user', 'error');
  }
}

// Reset user password (admin only)
async function resetUserPassword(username) {
  passwordResetUsername = username;
  document.getElementById('passwordResetTitle').textContent = 'Reset User Password';
  document.getElementById('passwordResetMessage').textContent = `Are you sure you want to reset password for user "${username}"?`;
  document.getElementById('passwordResetCustomSection').style.display = 'none';
  document.getElementById('passwordResetCustomInput').value = '';
  document.getElementById('passwordResetAlert').className = 'alert';
  document.getElementById('passwordResetAlert').textContent = '';
  document.getElementById('passwordResetChooseBtn').style.display = 'inline-block';
  const resetBtn = document.getElementById('passwordResetAutoBtn');
  resetBtn.textContent = 'Auto Generate';
  resetBtn.setAttribute('onclick', 'confirmPasswordReset(true)');
  document.getElementById('passwordResetModal').classList.add('active');
  
  // Focus on input if it becomes visible
  setTimeout(() => {
    const customInput = document.getElementById('passwordResetCustomInput');
    if (customInput && customInput.offsetParent !== null) {
      customInput.focus();
    }
  }, 100);
  
  return new Promise((resolve) => {
    passwordResetCallback = resolve;
  });
}

// Show custom password input in reset modal
function showPasswordResetCustomInput() {
  document.getElementById('passwordResetCustomSection').style.display = 'block';
  document.getElementById('passwordResetChooseBtn').style.display = 'none';
  const resetBtn = document.getElementById('passwordResetAutoBtn');
  resetBtn.textContent = 'Reset Password';
  resetBtn.setAttribute('onclick', 'confirmPasswordReset(false)');
  
  setTimeout(() => {
    document.getElementById('passwordResetCustomInput').focus();
  }, 100);
  
  // Handle Enter key in custom password input
  const customInput = document.getElementById('passwordResetCustomInput');
  const handleEnter = (e) => {
    if (e.key === 'Enter') {
      confirmPasswordReset(false);
      customInput.removeEventListener('keypress', handleEnter);
    }
  };
  customInput.addEventListener('keypress', handleEnter);
}

// Confirm password reset (auto-generate or custom)
async function confirmPasswordReset(autoGenerate) {
  const username = passwordResetUsername;
  let customPassword = null;
  
  if (!autoGenerate) {
    customPassword = document.getElementById('passwordResetCustomInput').value.trim();
    
    if (!customPassword) {
      showAlert('passwordResetAlert', 'Please enter a password', 'error');
      return;
    }
    
    if (customPassword.length < 8) {
      showAlert('passwordResetAlert', 'Password must be at least 8 characters long', 'error');
      return;
    }
  }
  
  closePasswordResetModal();
  
  try {
    const response = await fetch(`/api/admin/users/${username}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customPassword: customPassword || null }),
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('userMgmtAlert', 'Password reset successfully', 'success');
      const passwordMessage = autoGenerate 
        ? `Password reset successfully for user "${username}"!\n\nNew Password: ${data.newPassword}\n\nPlease save this password securely and share it with the user. It won't be shown again.`
        : `Password reset successfully for user "${username}"!\n\nCustom password has been set.`;
      await customAlert(passwordMessage, 'Password Reset');
      loadUsers();
    } else {
      showAlert('userMgmtAlert', data.error || 'Failed to reset password', 'error');
    }
  } catch (error) {
    showAlert('userMgmtAlert', 'Failed to reset password', 'error');
  }
  
  if (passwordResetCallback) {
    passwordResetCallback();
    passwordResetCallback = null;
  }
}

// Close password reset modal
function closePasswordResetModal() {
  document.getElementById('passwordResetModal').classList.remove('active');
  passwordResetUsername = null;
  if (passwordResetCallback) {
    passwordResetCallback();
    passwordResetCallback = null;
  }
}

// Delete user (admin only)
async function deleteUser(username) {
  const confirmed = await customConfirm(`Are you sure you want to delete user "${username}"?`, 'Confirm User Deletion');
  if (!confirmed) {
    return;
  }
  
  try {
    const response = await fetch(`/api/admin/users/${username}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showAlert('userMgmtAlert', 'User deleted successfully', 'success');
      loadUsers();
    } else {
      showAlert('userMgmtAlert', data.error || 'Failed to delete user', 'error');
    }
  } catch (error) {
    showAlert('userMgmtAlert', 'Failed to delete user', 'error');
  }
}

