import { motion } from 'framer-motion';
import { Users, FolderOpen } from 'lucide-react';
import { useApp, useModal } from '../store';
import type { FileItem } from '../types';
import FileIcon from './FileIcon';
import { cn } from '../utils';
import Button from './Button';

interface TenantItemProps {
  file: FileItem;
  index: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  viewMode: 'grid' | 'table';
}

export default function TenantItem({
  file,
  index,
  isSelected,
  onToggleSelect,
  viewMode,
}: TenantItemProps) {
  const { user, setCurrentTenantId, loadFiles } = useApp();
  const { openModal } = useModal();

  // Extract tenantId from file path (tenant folders have tenantId as path)
  const tenantId = file.path;

  const handleViewFiles = () => {
    if (user?.role === 'super_admin' && tenantId) {
      setCurrentTenantId(tenantId);
      // Pass tenantId directly to avoid race condition with state update
      // Ensure tenantId is a valid string
      loadFiles('', 1, tenantId);
    }
  };

  const handleManageUsers = () => {
    openModal('tenantUser', { tenantId });
  };

  if (viewMode === 'table') {
    return (
      <motion.tr
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02 }}
        className={cn(
          'border-b border-border hover:bg-surface-tertiary',
          isSelected && 'bg-primary-subtle hover:bg-primary-subtle'
        )}
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
              isTenant={true}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-foreground">
                  {file.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Users className="w-3 h-3" />}
                  onClick={handleManageUsers}
                >
                  Users
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<FolderOpen className="w-3 h-3" />}
                  onClick={handleViewFiles}
                >
                  View Files
                </Button>
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-2 text-sm text-muted">-</td>
        <td className="px-4 py-2 text-sm text-muted hidden md:table-cell">
          -
        </td>
        <td className="px-4 py-2"></td>
      </motion.tr>
    );
  }

  // Grid view
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.02 }}
      className={cn(
        'relative group border transition-colors',
        isSelected
          ? 'border-primary bg-primary-subtle'
          : 'border-border hover:border-text-tertiary bg-surface'
      )}
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

      {/* Content */}
      <div className="flex flex-col items-center p-4 pt-8">
        <FileIcon
          name={file.name}
          isDirectory={file.isDirectory}
          thumbnailUrl={file.thumbnailUrl}
          isTenant={true}
        />
        <div className="mt-3 w-full text-center">
          <p
            className="text-sm font-medium text-foreground truncate mb-3"
            title={file.name}
          >
            {file.name}
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Users className="w-3 h-3" />}
              onClick={handleManageUsers}
              className="w-full"
            >
              Users
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<FolderOpen className="w-3 h-3" />}
              onClick={handleViewFiles}
              className="w-full"
            >
              View Files
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
