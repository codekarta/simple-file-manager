import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Folder, ArrowRight, Check } from 'lucide-react';
import { useFiles, useModal, useApp } from '../store';
import { cn } from '../utils';
import * as api from '../api';
import type { FileItem } from '../types';

interface MoveData {
  path: string;
  name: string;
}

export default function MoveModal() {
  const { activeModal, closeModal, modalData } = useModal();
  const { loadFiles, currentPath } = useFiles();
  const { showToast } = useApp();

  const [destinationPath, setDestinationPath] = useState('');
  const [isMoving, setIsMoving] = useState(false);
  const [destFiles, setDestFiles] = useState<FileItem[]>([]);
  const [destLoading, setDestLoading] = useState(false);

  const data = modalData as MoveData | undefined;
  const isOpen = activeModal === 'move';

  // Load destination folder files
  useEffect(() => {
    if (isOpen) {
      loadDestinationFiles(destinationPath);
    }
  }, [isOpen, destinationPath]);

  // Reset destination path when modal opens
  useEffect(() => {
    if (isOpen) {
      setDestinationPath('');
      setIsMoving(false);
    }
  }, [isOpen]);

  const loadDestinationFiles = async (path: string) => {
    setDestLoading(true);
    try {
      const response = await api.getFiles(path, 1, 1000);
      setDestFiles(response.items || []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load destination', 'error');
      setDestFiles([]);
    } finally {
      setDestLoading(false);
    }
  };

  const handleDestinationClick = (file: FileItem) => {
    if (file.isDirectory) {
      setDestinationPath(file.path);
    }
  };

  const handleMove = async () => {
    if (!data) return;

    // Validate destination
    if (data.path.startsWith(destinationPath + '/') || data.path === destinationPath) {
      showToast('Cannot move into itself or subdirectory', 'error');
      return;
    }

    setIsMoving(true);
    try {
      await api.moveItem(data.path, destinationPath || '');
      showToast(`Moved "${data.name}" successfully`, 'success');
      loadFiles(currentPath); // Refresh current view
      closeModal();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to move', 'error');
    } finally {
      setIsMoving(false);
    }
  };

  const handleCancel = () => {
    closeModal();
  };

  if (!isOpen || !data) return null;

  const isMobile = window.innerWidth < 768;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          'bg-surface border border-border flex flex-col',
          isMobile ? 'w-full h-full' : 'w-[90vw] max-w-6xl h-[85vh]'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Folder className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Move Item</h2>
              <p className="text-sm text-muted">Moving: {data.name}</p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 text-muted hover:text-foreground hover:bg-surface-tertiary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {isMobile ? (
            /* Mobile: Full-screen destination browser */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Breadcrumb */}
              <div className="px-4 py-2 border-b border-border bg-surface-secondary">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDestinationPath('')}
                    className="text-sm text-primary hover:underline"
                  >
                    Root
                  </button>
                  {destinationPath && (
                    <>
                      <ArrowRight className="w-4 h-4 text-muted" />
                      <span className="text-sm text-muted truncate">{destinationPath}</span>
                    </>
                  )}
                </div>
              </div>

              {/* File list */}
              <div className="flex-1 overflow-auto">
                {destLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {destinationPath && (
                      <button
                        onClick={() => {
                          const parent = destinationPath.split('/').slice(0, -1).join('/');
                          setDestinationPath(parent);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-3 border-b border-border hover:bg-surface-tertiary"
                      >
                        <Folder className="w-5 h-5 text-muted" />
                        <span className="text-sm font-medium">.. (Parent)</span>
                      </button>
                    )}
                    {/* Use a custom file list for destination */}
                    {destFiles.length === 0 && !destLoading ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted p-8">
                        <Folder className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-sm">No items in this folder</p>
                      </div>
                    ) : (
                      destFiles.map((file) => (
                        <button
                          key={file.path}
                          onClick={() => handleDestinationClick(file)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-surface-tertiary transition-colors',
                            file.isDirectory ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                          )}
                          disabled={!file.isDirectory}
                        >
                          <Folder className="w-5 h-5 text-muted" />
                          <span className="text-sm font-medium flex-1 text-left">{file.name}</span>
                          {file.isDirectory && (
                            <ArrowRight className="w-4 h-4 text-muted" />
                          )}
                        </button>
                      ))
                    )}
                  </>
                )}
              </div>

              {/* Move button */}
              <div className="px-4 py-3 border-t border-border bg-surface-secondary">
                <button
                  onClick={handleMove}
                  disabled={isMoving}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white font-medium transition-colors',
                    isMoving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/90'
                  )}
                >
                  {isMoving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Moving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Move Here
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Desktop: Split panel */
            <>
              {/* Left panel - Current files (dimmed) */}
              <div className="w-1/2 border-r border-border flex flex-col opacity-50 pointer-events-none">
                <div className="px-4 py-2 border-b border-border bg-surface-secondary">
                  <h3 className="text-sm font-medium text-muted">Current Location</h3>
                </div>
                <div className="flex-1 overflow-auto flex items-center justify-center p-8">
                  <div className="text-center text-muted">
                    <Folder className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Current file location</p>
                    <p className="text-xs mt-2 opacity-75">{data.path}</p>
                  </div>
                </div>
              </div>

              {/* Right panel - Destination browser */}
              <div className="w-1/2 flex flex-col">
                <div className="px-4 py-2 border-b border-border bg-surface-secondary">
                  <h3 className="text-sm font-medium text-foreground">Select Destination</h3>
                </div>

                {/* Breadcrumb */}
                <div className="px-4 py-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDestinationPath('')}
                      className="text-sm text-primary hover:underline"
                    >
                      Root
                    </button>
                    {destinationPath && (
                      <>
                        <ArrowRight className="w-4 h-4 text-muted" />
                        <span className="text-sm text-muted truncate">{destinationPath}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Destination file list */}
                <div className="flex-1 overflow-auto">
                  {destLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <>
                      {destinationPath && (
                        <button
                          onClick={() => {
                            const parent = destinationPath.split('/').slice(0, -1).join('/');
                            setDestinationPath(parent);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-3 border-b border-border hover:bg-surface-tertiary"
                        >
                          <Folder className="w-5 h-5 text-muted" />
                          <span className="text-sm font-medium">.. (Parent)</span>
                        </button>
                      )}
                      {destFiles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted p-8">
                          <Folder className="w-12 h-12 mb-4 opacity-50" />
                          <p className="text-sm">No items in this folder</p>
                        </div>
                      ) : (
                        destFiles.map((file) => (
                          <button
                            key={file.path}
                            onClick={() => handleDestinationClick(file)}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-surface-tertiary transition-colors',
                              file.isDirectory ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                            )}
                            disabled={!file.isDirectory}
                          >
                            <Folder className="w-5 h-5 text-muted" />
                            <span className="text-sm font-medium flex-1 text-left">{file.name}</span>
                            {file.isDirectory && (
                              <ArrowRight className="w-4 h-4 text-muted" />
                            )}
                          </button>
                        ))
                      )}
                    </>
                  )}
                </div>

                {/* Footer with Move button */}
                <div className="px-4 py-3 border-t border-border bg-surface-secondary flex items-center justify-between">
                  <div className="text-sm text-muted">
                    {destinationPath ? `Moving to: ${destinationPath}` : 'Moving to: Root'}
                  </div>
                  <button
                    onClick={handleMove}
                    disabled={isMoving}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 bg-primary text-white font-medium transition-colors',
                      isMoving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/90'
                    )}
                  >
                    {isMoving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Moving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Move Here
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
