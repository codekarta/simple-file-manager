import { motion } from 'framer-motion';
import {
  Download,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  MoreHorizontal,
  Copy,
  Move,
  Link as LinkIcon,
} from 'lucide-react';
import { useFiles, useModal, useApp, useUI } from '../store';
import type { FileItem } from '../types';
import FileIcon from './FileIcon';
import { AccessBadge } from './Badge';
import TenantItem from './TenantItem';
import { formatFileSize, formatDateTime, cn, isImageFile, isVideoFile, isTextFile } from '../utils';
import * as api from '../api';
import { useState } from 'react';

export default function FileTable() {
  const { optimisticFiles, selectedFiles, toggleFileSelection, selectAllFiles, clearSelection, loadFiles, currentPath } = useFiles();
  const { showToast, user, currentTenantId, setCurrentTenantId, openEditor } = useApp();
  const { openModal } = useModal();
  const { viewMode } = useUI();

  const allSelected = optimisticFiles.length > 0 && selectedFiles.size === optimisticFiles.length;
  const someSelected = selectedFiles.size > 0 && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAllFiles();
    }
  };

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

  const handleDownload = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    let tenantId: string | null = currentTenantId;
    if (!tenantId && user?.tenantId) {
      tenantId = user.tenantId;
    }
    window.location.href = api.getDownloadUrl(path, tenantId);
  };

  const handleRename = (e: React.MouseEvent, file: FileItem) => {
    e.stopPropagation();
    openModal('rename', { path: file.path, currentName: file.name });
  };

  const handleDelete = (e: React.MouseEvent, file: FileItem) => {
    e.stopPropagation();
    openModal('delete', { paths: [file.path], names: [file.name] });
  };

  const handleToggleAccess = async (e: React.MouseEvent, file: FileItem) => {
    e.stopPropagation();
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

  const handleDuplicate = async (e: React.MouseEvent, file: FileItem) => {
    e.stopPropagation();
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

  const handleMove = (e: React.MouseEvent, file: FileItem) => {
    e.stopPropagation();
    openModal('move', { path: file.path, name: file.name });
  };

  const handleCopyLink = async (e: React.MouseEvent, file: FileItem) => {
    e.stopPropagation();
    try {
      // For private files, we need API key - for now, generate link without it
      // User can generate API token from User settings if needed
      const link = api.getShareableLink(file.path);
      await navigator.clipboard.writeText(link);
      showToast('Link copied to clipboard', 'success');
    } catch (error) {
      showToast('Failed to copy link', 'error');
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-border bg-surface-secondary">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={handleSelectAll}
                className="w-4 h-4 cursor-pointer accent-accent"
              />
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide w-24">
              Size
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide w-40 hidden md:table-cell">
              Modified
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide w-32">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
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
            // Regular file row
            return (
              <FileTableRow
                key={file.path}
                file={file}
                index={index}
                isSelected={selectedFiles.has(file.path)}
                onToggleSelect={() => toggleFileSelection(file.path)}
                onClick={() => handleFileClick(file)}
                onDownload={(e) => handleDownload(e, file.path)}
                onDuplicate={(e) => handleDuplicate(e, file)}
                onMove={(e) => handleMove(e, file)}
                onCopyLink={(e) => handleCopyLink(e, file)}
                onRename={(e) => handleRename(e, file)}
                onDelete={(e) => handleDelete(e, file)}
                onToggleAccess={(e) => handleToggleAccess(e, file)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface FileTableRowProps {
  file: FileItem;
  index: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
  onDownload: (e: React.MouseEvent) => void;
  onDuplicate: (e: React.MouseEvent) => void;
  onMove: (e: React.MouseEvent) => void;
  onCopyLink: (e: React.MouseEvent) => void;
  onRename: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onToggleAccess: (e: React.MouseEvent) => void;
}

function FileTableRow({
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
}: FileTableRowProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className={cn(
        'border-b border-border hover:bg-surface-tertiary cursor-pointer transition-colors',
        isSelected && 'bg-primary-subtle hover:bg-primary-subtle'
      )}
      onClick={onClick}
    >
      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="w-4 h-4 cursor-pointer accent-accent"
        />
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-3">
          <FileIcon
            name={file.name}
            isDirectory={file.isDirectory}
            thumbnailUrl={file.thumbnailUrl}
            size="sm"
            isTenant={file.isTenant}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground truncate">
                {file.name}
              </span>
              {file.accessLevel === 'private' && (
                <AccessBadge accessLevel="private" />
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-2 text-sm text-muted">
        {file.isDirectory ? '-' : formatFileSize(file.size)}
      </td>
      <td className="px-4 py-2 text-sm text-muted hidden md:table-cell">
        {formatDateTime(file.modified)}
      </td>
      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {/* Desktop actions */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={onDownload}
              className="p-1.5 text-subtle hover:text-foreground hover:bg-surface-secondary transition-colors"
              title={file.isDirectory ? 'Download as ZIP' : 'Download'}
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onDuplicate}
              className="p-1.5 text-subtle hover:text-foreground hover:bg-surface-secondary transition-colors"
              title="Duplicate"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={onMove}
              className="p-1.5 text-subtle hover:text-foreground hover:bg-surface-secondary transition-colors"
              title="Move"
            >
              <Move className="w-4 h-4" />
            </button>
            {!file.isDirectory && (
              <button
                onClick={onCopyLink}
                className="p-1.5 text-subtle hover:text-foreground hover:bg-surface-secondary transition-colors"
                title="Copy link"
              >
                <LinkIcon className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onRename}
              className="p-1.5 text-subtle hover:text-foreground hover:bg-surface-secondary transition-colors"
              title="Rename"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleAccess}
              className="p-1.5 text-subtle hover:text-foreground hover:bg-surface-secondary transition-colors"
              title={file.accessLevel === 'private' ? 'Make public' : 'Make private'}
            >
              {file.accessLevel === 'private' ? (
                <Unlock className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-subtle hover:text-danger hover:bg-danger-subtle transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile actions dropdown */}
          <div className="relative sm:hidden">
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-1.5 text-subtle hover:text-foreground"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showActions && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowActions(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-surface border border-border shadow-lg z-50 min-w-[120px]">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-tertiary"
                    onClick={(e) => {
                      onDownload(e);
                      setShowActions(false);
                    }}
                  >
                    <Download className="w-4 h-4" />
                    {file.isDirectory ? 'Download ZIP' : 'Download'}
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-tertiary"
                    onClick={(e) => {
                      onDuplicate(e);
                      setShowActions(false);
                    }}
                  >
                    <Copy className="w-4 h-4" />
                    Duplicate
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-tertiary"
                    onClick={(e) => {
                      onMove(e);
                      setShowActions(false);
                    }}
                  >
                    <Move className="w-4 h-4" />
                    Move
                  </button>
                  {!file.isDirectory && (
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-tertiary"
                      onClick={(e) => {
                        onCopyLink(e);
                        setShowActions(false);
                      }}
                    >
                      <LinkIcon className="w-4 h-4" />
                      Copy link
                    </button>
                  )}
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-tertiary"
                    onClick={(e) => {
                      onRename(e);
                      setShowActions(false);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                    Rename
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-tertiary"
                    onClick={(e) => {
                      onToggleAccess(e);
                      setShowActions(false);
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
                    onClick={(e) => {
                      onDelete(e);
                      setShowActions(false);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </td>
    </motion.tr>
  );
}
