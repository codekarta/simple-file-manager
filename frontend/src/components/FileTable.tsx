import { motion } from 'framer-motion';
import {
  Download,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  MoreHorizontal,
} from 'lucide-react';
import { useFiles, useModal, useApp } from '../store';
import type { FileItem } from '../types';
import FileIcon from './FileIcon';
import { AccessBadge } from './Badge';
import { formatFileSize, formatDateTime, cn } from '../utils';
import * as api from '../api';
import { useState } from 'react';

export default function FileTable() {
  const { optimisticFiles, selectedFiles, toggleFileSelection, selectAllFiles, clearSelection, loadFiles, currentPath } = useFiles();
  const { showToast } = useApp();
  const { openModal } = useModal();

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
      loadFiles(file.path);
    } else {
      window.open(`/${file.path}`, '_blank');
    }
  };

  const handleDownload = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    window.location.href = api.getDownloadUrl(path);
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
      await api.updateAccessLevel(file.path, newLevel);
      showToast(`Changed to ${newLevel}`, 'success');
      loadFiles(currentPath);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to change access', 'error');
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
          {optimisticFiles.map((file, index) => (
            <FileTableRow
              key={file.path}
              file={file}
              index={index}
              isSelected={selectedFiles.has(file.path)}
              onToggleSelect={() => toggleFileSelection(file.path)}
              onClick={() => handleFileClick(file)}
              onDownload={(e) => handleDownload(e, file.path)}
              onRename={(e) => handleRename(e, file)}
              onDelete={(e) => handleDelete(e, file)}
              onToggleAccess={(e) => handleToggleAccess(e, file)}
            />
          ))}
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
