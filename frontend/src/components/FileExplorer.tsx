import { useState, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, CheckCircle, AlertCircle, File, Folder, Minimize2, Maximize2 } from 'lucide-react';
import { useFiles, useUI, useStorage, useApp } from '../store';
import FileTable from './FileTable';
import FileGrid from './FileGrid';
import Pagination from './Pagination';
import EmptyState from './EmptyState';
import FileEditor from './FileEditor';
import SystemResourcesDashboard from './SystemResourcesDashboard';
import { LoadingOverlay } from './Spinner';
import { formatFileSize, cn } from '../utils';
import * as api from '../api';

// Upload item interface
interface UploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  relativePath?: string;
}

function FileExplorer() {
  const { optimisticFiles, isLoading, currentPath, loadFiles } = useFiles();
  const { viewMode, searchQuery, showToast } = useUI();
  const { refreshStorageInfo } = useStorage();
  const { user, currentTenantId, openFile, closeEditor } = useApp();

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const dragCounter = useRef(0);
  const isUploadingRef = useRef(false);

  const isEmpty = optimisticFiles.length === 0;
  const hasTenantFolders = optimisticFiles.some(file => file.isTenant && file.isDirectory);

  // Generate unique ID
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Process dropped files and folders
  const processEntry = async (entry: FileSystemEntry, path: string = ''): Promise<File[]> => {
    const files: File[] = [];
    
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
      // Add relative path to file object
      Object.defineProperty(file, 'webkitRelativePath', {
        value: path ? `${path}/${file.name}` : file.name,
        writable: false,
      });
      files.push(file);
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });
      
      for (const childEntry of entries) {
        const childPath = path ? `${path}/${entry.name}` : entry.name;
        const childFiles = await processEntry(childEntry, childPath);
        files.push(...childFiles);
      }
    }
    
    return files;
  };

  // Handle drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const items = e.dataTransfer.items;
    const droppedFiles: File[] = [];

    // Process all items (including folders)
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const entry = item.webkitGetAsEntry?.();
      
      if (entry) {
        try {
          const files = await processEntry(entry);
          droppedFiles.push(...files);
        } catch (err) {
          console.error('Error processing entry:', err);
        }
      } else if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          droppedFiles.push(file);
        }
      }
    }

    if (droppedFiles.length === 0) return;

    // Create upload items
    const newUploads: UploadItem[] = droppedFiles.map((file) => ({
      id: generateId(),
      file,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'pending' as const,
      relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    }));

    setUploads((prev) => [...prev, ...newUploads]);
    setShowUploadPanel(true);

    // Start uploading
    startUploading(newUploads);
  }, [currentPath]);

  // Upload files one by one
  const startUploading = async (items: UploadItem[]) => {
    if (isUploadingRef.current) return;
    isUploadingRef.current = true;

    for (const item of items) {
      // Update status to uploading
      setUploads((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, status: 'uploading' as const } : u))
      );

      try {
        // Determine tenantId for upload
        let tenantId: string | null = currentTenantId;
        if (!tenantId && user?.tenantId) {
          tenantId = user.tenantId;
        }
        
        await api.uploadSingleFile(
          item.file,
          currentPath,
          'public',
          item.relativePath !== item.name ? item.relativePath : undefined,
          (progress) => {
            setUploads((prev) =>
              prev.map((u) => (u.id === item.id ? { ...u, progress } : u))
            );
          },
          tenantId
        );

        // Update status to completed
        setUploads((prev) =>
          prev.map((u) => (u.id === item.id ? { ...u, status: 'completed' as const, progress: 100 } : u))
        );
      } catch (error) {
        // Update status to error
        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id
              ? { ...u, status: 'error' as const, error: error instanceof Error ? error.message : 'Upload failed' }
              : u
          )
        );
      }
    }

    isUploadingRef.current = false;

    // Refresh file list and storage info
    loadFiles(currentPath);
    refreshStorageInfo();

    // Show toast
    const completed = items.filter(
      (item) => uploads.find((u) => u.id === item.id)?.status === 'completed'
    ).length;
    showToast(`${completed} of ${items.length} file(s) uploaded`, 'success');
  };

  // Clear completed uploads
  const clearCompleted = () => {
    setUploads((prev) => prev.filter((u) => u.status !== 'completed' && u.status !== 'error'));
    if (uploads.every((u) => u.status === 'completed' || u.status === 'error')) {
      setShowUploadPanel(false);
    }
  };

  // Close upload panel
  const closeUploadPanel = () => {
    if (uploads.some((u) => u.status === 'uploading')) {
      showToast('Please wait for uploads to complete', 'info');
      return;
    }
    setUploads([]);
    setShowUploadPanel(false);
  };

  // Calculate progress stats
  const completedCount = uploads.filter((u) => u.status === 'completed').length;
  const errorCount = uploads.filter((u) => u.status === 'error').length;
  const uploadingCount = uploads.filter((u) => u.status === 'uploading').length;
  const pendingCount = uploads.filter((u) => u.status === 'pending').length;
  const totalProgress = uploads.length > 0
    ? Math.round(uploads.reduce((acc, u) => acc + u.progress, 0) / uploads.length)
    : 0;
  const isAllCompleted = completedCount + errorCount === uploads.length && uploads.length > 0;

  return (
    <div
      className="flex-1 flex flex-col bg-surface relative min-h-0"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isLoading && <LoadingOverlay />}

      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-primary/10 border-2 border-dashed border-primary flex items-center justify-center pointer-events-none"
          >
            <div className="bg-surface px-8 py-6 border border-primary shadow-lg">
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-12 h-12 text-primary" />
                <div className="text-lg font-medium text-foreground">Drop files here to upload</div>
                <div className="text-sm text-muted">Files will be uploaded to: /{currentPath || '(root)'}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Show editor if file is open, otherwise show file list or dashboard */}
      {openFile ? (
        <FileEditor
          filePath={openFile.path}
          fileName={openFile.name}
          onClose={closeEditor}
        />
      ) : user?.role === 'super_admin' && !currentTenantId && currentPath === '' && !searchQuery && !hasTenantFolders ? (
        // Show system resources dashboard for super admin at home (when no tenant folders are loaded)
        <SystemResourcesDashboard />
      ) : isEmpty ? (
        <EmptyState
          type={searchQuery ? 'search' : 'empty'}
          searchQuery={searchQuery}
        />
      ) : (
        <>
          <div className="flex-1 overflow-auto">
            {viewMode === 'table' ? <FileTable /> : <FileGrid />}
          </div>
          <Pagination />
        </>
      )}

      {/* Upload Progress Panel */}
      <AnimatePresence>
        {showUploadPanel && uploads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-4 right-4 w-96 max-w-[calc(100vw-2rem)] bg-surface border border-border shadow-lg z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-secondary">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {isAllCompleted
                    ? 'Upload Complete'
                    : uploadingCount > 0
                    ? `Uploading ${uploadingCount} of ${uploads.length}...`
                    : `${pendingCount} files pending`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1 text-subtle hover:text-foreground transition-colors"
                >
                  {isMinimized ? (
                    <Maximize2 className="w-4 h-4" />
                  ) : (
                    <Minimize2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={closeUploadPanel}
                  className="p-1 text-subtle hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Overall progress */}
            {!isMinimized && !isAllCompleted && (
              <div className="px-4 py-2 border-b border-border">
                <div className="flex items-center justify-between text-xs text-muted mb-1">
                  <span>Overall Progress</span>
                  <span>{totalProgress}%</span>
                </div>
                <div className="h-1.5 bg-surface-secondary overflow-hidden">
                  <motion.div
                    className={cn(
                      'h-full',
                      errorCount > 0 ? 'bg-warning' : 'bg-primary'
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${totalProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}

            {/* File list */}
            <AnimatePresence>
              {!isMinimized && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="max-h-64 overflow-y-auto">
                    {uploads.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="px-4 py-2 border-b border-border last:border-b-0 hover:bg-surface-secondary"
                      >
                        <div className="flex items-start gap-2">
                          {/* Icon */}
                          <div className="mt-0.5">
                            {item.status === 'completed' ? (
                              <CheckCircle className="w-4 h-4 text-success" />
                            ) : item.status === 'error' ? (
                              <AlertCircle className="w-4 h-4 text-danger" />
                            ) : item.relativePath?.includes('/') ? (
                              <Folder className="w-4 h-4 text-warning" />
                            ) : (
                              <File className="w-4 h-4 text-subtle" />
                            )}
                          </div>

                          {/* File info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-foreground truncate" title={item.relativePath || item.name}>
                                {item.relativePath || item.name}
                              </span>
                              <span className="text-xs text-subtle shrink-0">
                                {formatFileSize(item.size)}
                              </span>
                            </div>

                            {/* Progress bar for uploading items */}
                            {item.status === 'uploading' && (
                              <div className="mt-1.5">
                                <div className="h-1 bg-surface-secondary overflow-hidden">
                                  <motion.div
                                    className="h-full bg-primary"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${item.progress}%` }}
                                    transition={{ duration: 0.2 }}
                                  />
                                </div>
                                <div className="text-xs text-muted mt-0.5">{item.progress}%</div>
                              </div>
                            )}

                            {/* Error message */}
                            {item.status === 'error' && item.error && (
                              <div className="text-xs text-danger mt-1">{item.error}</div>
                            )}

                            {/* Status text */}
                            {item.status === 'pending' && (
                              <div className="text-xs text-subtle mt-1">Waiting...</div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer */}
            {!isMinimized && (
              <div className="px-4 py-2 border-t border-border bg-surface-secondary flex items-center justify-between">
                <div className="text-xs text-muted">
                  {completedCount} of {uploads.length} completed
                  {errorCount > 0 && <span className="text-danger ml-1">({errorCount} failed)</span>}
                </div>
                {isAllCompleted && (
                  <button
                    onClick={clearCompleted}
                    className="text-xs text-primary hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(FileExplorer);
