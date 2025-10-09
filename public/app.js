// Global state
let currentPath = '';
let selectedFiles = [];
let renameTarget = null;
let selectedItems = new Set(); // For bulk delete

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupEventListeners();
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
      showApp(data.username);
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
      showApp(username);
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

function showApp(username) {
  document.getElementById('loginContainer').style.display = 'none';
  document.getElementById('appContainer').classList.add('active');
  document.getElementById('currentUser').textContent = username;
  
  loadFiles();
  loadStorageInfo();
}

// File operations
async function loadFiles(path = '') {
  currentPath = path;
  showLoading(true);
  
  try {
    const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`, {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (response.ok) {
      renderFileList(data.items);
      renderBreadcrumb(path);
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
  
  if (items.length === 0) {
    fileTable.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }
  
  fileTable.style.display = 'table';
  emptyState.style.display = 'none';
  
  tbody.innerHTML = items.map(item => {
    const thumbnail = getFileThumbnail(item.name, item.path, item.isDirectory);
    const size = item.isDirectory ? '-' : formatFileSize(item.size);
    const modified = new Date(item.modified).toLocaleString();
    const escapedPath = item.path.replace(/'/g, "\\'");
    const escapedName = item.name.replace(/'/g, "\\'");
    
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
          </div>
        </td>
        <td>${size}</td>
        <td>${modified}</td>
        <td>
          <div class="file-actions">
            ${!item.isDirectory ? `<button class="icon-btn" onclick="downloadFile('${escapedPath}')" title="Download">⬇️</button>` : ''}
            <button class="icon-btn" onclick="openRenameModal('${escapedPath}', '${escapedName}')" title="Rename">✏️</button>
            <button class="icon-btn danger" onclick="deleteItem('${escapedPath}', '${escapedName}')" title="Delete">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderBreadcrumb(path) {
  const breadcrumb = document.getElementById('breadcrumb');
  const parts = path ? path.split('/').filter(p => p) : [];
  
  let html = '<span class="breadcrumb-item" onclick="loadFiles(\'\')">🏠 Home</span>';
  
  let currentPath = '';
  parts.forEach((part, index) => {
    currentPath += (currentPath ? '/' : '') + part;
    const isLast = index === parts.length - 1;
    
    html += '<span class="breadcrumb-separator">/</span>';
    html += `<span class="breadcrumb-item ${isLast ? 'active' : ''}" onclick="loadFiles('${currentPath}')">${part}</span>`;
  });
  
  breadcrumb.innerHTML = html;
}

function getFileThumbnail(filename, filepath, isDirectory) {
  if (isDirectory) {
    return `
      <div class="file-thumbnail">
        <div class="file-type-icon icon-folder">📁</div>
      </div>
    `;
  }
  
  const ext = filename.split('.').pop().toLowerCase();
  
  // Check if it's an image
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'];
  if (imageExtensions.includes(ext)) {
    return `
      <div class="file-thumbnail">
        <img src="/${filepath}" alt="${filename}" onerror="this.parentElement.innerHTML='<div class=\\'file-type-icon icon-default\\'>IMG</div>'">
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
}

function openFolderUploadModal() {
  document.getElementById('uploadModal').classList.add('active');
  document.getElementById('uploadArea').onclick = () => document.getElementById('folderInput').click();
  document.querySelector('#uploadModal .modal-header h2').textContent = '📁 Upload Folder';
  selectedFiles = [];
  updateSelectedFilesList();
}

function closeUploadModal() {
  document.getElementById('uploadModal').classList.remove('active');
  document.getElementById('fileInput').value = '';
  document.getElementById('folderInput').value = '';
  selectedFiles = [];
  updateSelectedFilesList();
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
}

function closeCreateFolderModal() {
  document.getElementById('createFolderModal').classList.remove('active');
}

async function createFolder() {
  const name = document.getElementById('folderName').value.trim();
  
  if (!name) {
    alert('Please enter a folder name');
    return;
  }
  
  try {
    const response = await fetch('/api/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: currentPath, name }),
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
  if (!confirm(`Are you sure you want to delete "${name}"?`)) {
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
    alert('Please enter a new name');
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

// Search
let searchTimeout;
function handleSearch(event) {
  clearTimeout(searchTimeout);
  
  const query = event.target.value.trim();
  
  if (query.length < 2) {
    loadFiles(currentPath);
    return;
  }
  
  searchTimeout = setTimeout(() => {
    searchFiles(query);
  }, 500);
}

async function searchFiles(query) {
  showLoading(true);
  
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (response.ok) {
      renderFileList(data.results);
      document.getElementById('breadcrumb').innerHTML = `<span class="breadcrumb-item active">🔍 Search results for "${query}"</span>`;
    } else {
      showAlert('alert', data.error || 'Search failed', 'error');
    }
  } catch (error) {
    showAlert('alert', 'Search failed', 'error');
  } finally {
    showLoading(false);
  }
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
  
  if (!confirm(message)) {
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

function showAlert(elementId, message, type) {
  const alert = document.getElementById(elementId);
  alert.className = `alert alert-${type} active`;
  alert.textContent = message;
  
  setTimeout(() => {
    alert.classList.remove('active');
  }, 5000);
}

