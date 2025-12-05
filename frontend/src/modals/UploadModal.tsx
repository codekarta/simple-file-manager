import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, File, FolderUp } from 'lucide-react';
import Modal from '../components/Modal';
import Button from '../components/Button';
import { AccessToggle } from '../components/Toggle';
import { useFiles, useModal, useApp, useStorage } from '../store';
import { formatFileSize, cn } from '../utils';
import * as api from '../api';

export default function UploadModal() {
  const { currentPath, loadFiles } = useFiles();
  const { activeModal, closeModal } = useModal();
  const { showToast, user, currentTenantId } = useApp();
  const { refreshStorageInfo } = useStorage();

  const [files, setFiles] = useState<File[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadType, setUploadType] = useState<'files' | 'folder'>('files');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const isOpen = activeModal === 'upload';

  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      setIsPrivate(false);
      setUploadProgress(0);
      setUploadType('files');
      closeModal();
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
    setUploadType('files');
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    setUploadType('files');
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    setUploadType('folder');
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const relativePaths =
        uploadType === 'folder'
          ? files.map((f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name)
          : undefined;

      // Determine tenantId
      let tenantId: string | null = currentTenantId;
      if (!tenantId && user?.tenantId) {
        tenantId = user.tenantId;
      }
      
      await api.uploadFiles(
        files,
        currentPath,
        isPrivate ? 'private' : 'public',
        relativePaths,
        setUploadProgress,
        tenantId
      );

      showToast(`${files.length} file(s) uploaded successfully`, 'success');
      loadFiles(currentPath);
      refreshStorageInfo();
      handleClose();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload Files"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleUpload}
            loading={isUploading}
            disabled={files.length === 0}
          >
            {isUploading ? `Uploading ${uploadProgress}%` : `Upload ${files.length} file(s)`}
          </Button>
        </>
      }
    >
      {/* Upload type tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 border transition-colors',
            'hover:border-primary hover:bg-primary-subtle'
          )}
        >
          <Upload className="w-5 h-5" />
          <span className="text-sm font-medium">Upload Files</span>
        </button>
        <button
          onClick={() => folderInputRef.current?.click()}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-3 border transition-colors',
            'hover:border-primary hover:bg-primary-subtle'
          )}
        >
          <FolderUp className="w-5 h-5" />
          <span className="text-sm font-medium">Upload Folder</span>
        </button>
      </div>

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory is not in types
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFolderSelect}
      />

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
          isDragging ? 'border-primary bg-primary-subtle' : 'border-border hover:border-text-tertiary',
          files.length > 0 && 'border-solid'
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        {files.length === 0 ? (
          <div className="flex flex-col items-center">
            <Upload className="w-10 h-10 text-subtle mb-3" />
            <p className="text-sm text-muted mb-1">
              <span className="font-medium text-primary">Click to browse</span> or drag
              and drop files here
            </p>
            <p className="text-xs text-subtle">Max 100MB per file</p>
          </div>
        ) : (
          <div className="text-left" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-foreground">
                {uploadType === 'folder' ? (
                  <>
                    📁 {(files[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/')[0] || 'Folder'}
                  </>
                ) : (
                  `${files.length} file(s) selected`
                )}
              </div>
              <div className="text-xs text-muted">
                Total: {formatFileSize(totalSize)}
              </div>
            </div>

            {/* Progress bar when uploading */}
            {isUploading && (
              <div className="mb-3">
                <div className="h-1 bg-surface-secondary overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* File list */}
            <div className="max-h-40 overflow-y-auto space-y-1">
              <AnimatePresence>
                {files.slice(0, 10).map((file, index) => (
                  <motion.div
                    key={file.name + index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center gap-2 py-1 px-2 bg-surface-secondary"
                  >
                    <File className="w-4 h-4 text-subtle shrink-0" />
                    <span className="text-sm text-foreground truncate flex-1">
                      {uploadType === 'folder'
                        ? (file as File & { webkitRelativePath?: string }).webkitRelativePath
                        : file.name}
                    </span>
                    <span className="text-xs text-subtle shrink-0">
                      {formatFileSize(file.size)}
                    </span>
                    {!isUploading && (
                      <button
                        onClick={() => removeFile(index)}
                        className="p-0.5 text-subtle hover:text-danger"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              {files.length > 10 && (
                <p className="text-xs text-subtle text-center py-1">
                  +{files.length - 10} more files
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Access level */}
      <div className="mt-4">
        <AccessToggle
          isPrivate={isPrivate}
          onChange={setIsPrivate}
          disabled={isUploading}
        />
      </div>

      {/* Current path info */}
      <div className="mt-4 text-xs text-subtle">
        Uploading to: <span className="font-mono">/{currentPath || '(root)'}</span>
      </div>
    </Modal>
  );
}
