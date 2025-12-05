import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  MoreVertical,
  Copy,
  Move,
  Link as LinkIcon,
} from 'lucide-react';
import { useFiles, useModal, useApp, useUI } from '../store';
import type { FileItem } from '../types';
import { FileGridIcon } from './FileIcon';
import TenantItem from './TenantItem';
import { formatFileSize, cn, isImageFile, isVideoFile, isTextFile } from '../utils';
import * as api from '../api';

export default function FileGrid() {
  const { optimisticFiles, selectedFiles, toggleFileSelection, loadFiles, currentPath } = useFiles();
  const { showToast, user, currentTenantId, setCurrentTenantId, openEditor } = useApp();
  const { openModal } = useModal();
  const { viewMode } = useUI();

  const handleFileClick = (file: FileItem) => {
    if (file.isDirectory) {
      // If it's a tenant folder (marked with isTenant), switch to that tenant
      if (file.isTenant && user?.role === 'super_admin') {
        const tenantId = file.path; // file.path is the tenantId for tenant folders
        setCurrentTenantId(tenantId);
        // Pass tenantId directly to avoid race condition with state update
        loadFiles('', 1, tenantId);
      } else {
        loadFiles(file.path);
      }
    } else if (isImageFile(file.name) || isVideoFile(file.name)) {
      // Open gallery/slideshow for images and videos
      const mediaFiles = optimisticFiles.filter(
        (f) => !f.isDirectory && (isImageFile(f.name) || isVideoFile(f.name))
      );
      const foundIndex = mediaFiles.findIndex((f) => f.path === file.path);
      if (foundIndex >= 0) {
        openModal('slideshow', { initialIndex: foundIndex });
      }
    } else if (isTextFile(file.name)) {
      // For text files, open in integrated editor
      openEditor(file.path, file.name);
    } else {
      // For other file types, open in new tab with tenant context
      let tenantId: string | null = currentTenantId;
      if (!tenantId && user?.tenantId) {
        tenantId = user.tenantId;
      }
      const fileUrl = api.getFileUrl(file.path, tenantId);
      window.open(fileUrl, '_blank');
    }
  };

  const handleDownload = (path: string) => {
    let tenantId: string | null = currentTenantId;
    if (!tenantId && user?.tenantId) {
      tenantId = user.tenantId;
    }
    window.location.href = api.getDownloadUrl(path, tenantId);
  };

  const handleRename = (file: FileItem) => {
    openModal('rename', { path: file.path, currentName: file.name });
  };

  const handleDelete = (file: FileItem) => {
    openModal('delete', { paths: [file.path], names: [file.name] });
  };

  const handleToggleAccess = async (file: FileItem) => {
    try {
      const newLevel = file.accessLevel === 'private' ? 'public' : 'private';
      let tenantId: string | null = currentTenantId;
      if (!tenantId && user?.tenantId) {
        tenantId = user.tenantId;
      }
      await api.updateAccessLevel(file.path, newLevel, tenantId);
      showToast(`Changed to ${newLevel}`, 'success');
      loadFiles(currentPath);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to change access', 'error');
    }
  };

  const handleDuplicate = async (file: FileItem) => {
    try {
      let tenantId: string | null = currentTenantId;
      if (!tenantId && user?.tenantId) {
        tenantId = user.tenantId;
      }
      await api.duplicateItem(file.path, tenantId);
      showToast(`Duplicated "${file.name}"`, 'success');
      loadFiles(currentPath);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to duplicate', 'error');
    }
  };

  const handleMove = (file: FileItem) => {
    openModal('move', { path: file.path, name: file.name });
  };

  const handleCopyLink = async (file: FileItem) => {
    try {
      const link = api.getShareableLink(file.path);
      await navigator.clipboard.writeText(link);
      showToast('Link copied to clipboard', 'success');
    } catch (error) {
      showToast('Failed to copy link', 'error');
    }
  };

  return (
    <div className="file-grid p-4">
      {optimisticFiles.map((file, index) => {
        // Use TenantItem for tenant folders
        if (file.isTenant && file.isDirectory) {
          return (
            <TenantItem
              key={file.path}
              file={file}
              index={index}
              isSelected={selectedFiles.has(file.path)}
              onToggleSelect={() => toggleFileSelection(file.path)}
              viewMode={viewMode}
            />
          );
        }
        // Regular file grid item
        return (
          <FileGridItem
            key={file.path}
            file={file}
            index={index}
            isSelected={selectedFiles.has(file.path)}
            onToggleSelect={() => toggleFileSelection(file.path)}
            onClick={() => handleFileClick(file)}
            onDownload={() => handleDownload(file.path)}
            onDuplicate={() => handleDuplicate(file)}
            onMove={() => handleMove(file)}
            onCopyLink={() => handleCopyLink(file)}
            onRename={() => handleRename(file)}
            onDelete={() => handleDelete(file)}
            onToggleAccess={() => handleToggleAccess(file)}
          />
        );
      })}
    </div>
  );
}

interface FileGridItemProps {
  file: FileItem;
  index: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
  onDownload: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onCopyLink: () => void;
  onRename: () => void;
  onDelete: () => void;
  onToggleAccess: () => void;
}

function FileGridItem({
  file,
  index,
  isSelected,
  onToggleSelect,
  onClick,
  onDownload,
  onDuplicate,
  onMove,
  onCopyLink,
  onRename,
  onDelete,
  onToggleAccess,
}: FileGridItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.02 }}
      className={cn(
        'relative group cursor-pointer border transition-colors',
        isSelected
          ? 'border-primary bg-primary-subtle'
          : 'border-border hover:border-text-tertiary bg-surface'
      )}
      onClick={onClick}
    >
      {/* Checkbox */}
      <div
        className={cn(
          'absolute top-2 left-2 z-10 transition-opacity',
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="w-4 h-4 cursor-pointer accent-accent"
        />
      </div>

      {/* Private indicator */}
      {file.accessLevel === 'private' && !showMenu && (
        <div className="absolute top-2 right-2 z-10">
          <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-warning-subtle text-warning">
            🔒
          </span>
        </div>
      )}

      {/* Actions menu */}
      <div
        className={cn(
          'absolute top-2 right-2 z-10 transition-opacity',
          showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1 bg-surface border border-border hover:bg-surface-tertiary"
        >
          <MoreVertical className="w-4 h-4 text-muted" />
        </button>
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-full mt-1 bg-surface border border-border shadow-lg z-50 min-w-[130px]">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-tertiary"
                onClick={() => {
                  onDownload();
                  setShowMenu(false);
                }}
              >
                <Download className="w-4 h-4" />
                {file.isDirectory ? 'Download ZIP' : 'Download'}
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-tertiary"
                onClick={() => {
                  onDuplicate();
                  setShowMenu(false);
                }}
              >
                <Copy className="w-4 h-4" />
                Duplicate
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-tertiary"
                onClick={() => {
                  onMove();
                  setShowMenu(false);
                }}
              >
                <Move className="w-4 h-4" />
                Move
              </button>
              {!file.isDirectory && (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-tertiary"
                  onClick={() => {
                    onCopyLink();
                    setShowMenu(false);
                  }}
                >
                  <LinkIcon className="w-4 h-4" />
                  Copy link
                </button>
              )}
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-tertiary"
                onClick={() => {
                  onRename();
                  setShowMenu(false);
                }}
              >
                <Pencil className="w-4 h-4" />
                Rename
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-tertiary"
                onClick={() => {
                  onToggleAccess();
                  setShowMenu(false);
                }}
              >
                {file.accessLevel === 'private' ? (
                  <>
                    <Unlock className="w-4 h-4" />
                    Make public
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Make private
                  </>
                )}
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-subtle"
                onClick={() => {
                  onDelete();
                  setShowMenu(false);
                }}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col items-center p-4 pt-8">
        <FileGridIcon
          name={file.name}
          isDirectory={file.isDirectory}
          thumbnailUrl={file.thumbnailUrl}
          isTenant={file.isTenant}
        />
        <div className="mt-3 w-full text-center">
          <p
            className="text-sm font-medium text-foreground truncate"
            title={file.name}
          >
            {file.name}
          </p>
          {!file.isDirectory && (
            <p className="text-xs text-subtle mt-1">
              {formatFileSize(file.size)}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
