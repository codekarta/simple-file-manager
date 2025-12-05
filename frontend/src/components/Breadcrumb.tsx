import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Home, ChevronRight, Edit2 } from 'lucide-react';
import { useFiles, useApp } from '../store';
import { cn } from '../utils';
import * as api from '../api';

export default function Breadcrumb() {
  const { currentPath, loadFiles } = useFiles();
  const { user, currentTenantId, setCurrentTenantId } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [tenantName, setTenantName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const parts = currentPath ? currentPath.split('/').filter(Boolean) : [];

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Load tenant name when currentTenantId changes
  useEffect(() => {
    const loadTenantName = async () => {
      if (!currentTenantId) {
        setTenantName(null);
        return;
      }

      // Only super admins can list tenants to get names
      if (user?.role !== 'super_admin') {
        setTenantName(null);
        return;
      }

      try {
        const tenants = await api.listTenants();
        const tenant = tenants.find((t) => t.tenantId === currentTenantId);
        setTenantName(tenant?.name || null);
      } catch (error) {
        console.error('Failed to load tenant name:', error);
        setTenantName(null);
      }
    };

    loadTenantName();
  }, [currentTenantId, user?.role]);

  const handleStartEdit = () => {
    setEditValue(currentPath ? `/${currentPath}` : '/');
    setIsEditing(true);
  };

  const handleEndEdit = () => {
    setIsEditing(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newPath = editValue.replace(/^\/+|\/+$/g, '');
    loadFiles(newPath);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleEndEdit();
    }
  };

  const navigateTo = (index: number) => {
    if (index < 0) {
      loadFiles('');
    } else {
      const newPath = parts.slice(0, index + 1).join('/');
      loadFiles(newPath);
    }
  };

  if (isEditing) {
    return (
      <form onSubmit={handleSubmit} className="flex-1">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleEndEdit}
          onKeyDown={handleKeyDown}
          className="w-full h-8 px-3 text-sm font-mono bg-surface border border-primary focus:outline-none"
          placeholder="/path/to/folder"
        />
      </form>
    );
  }

  const handleBackToAllTenants = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentTenantId(null);
    // Pass null directly to avoid race condition with state update
    loadFiles('', 1, null);
  };

  return (
    <div
      className="flex items-center gap-1 min-w-0 group cursor-text"
      onClick={handleStartEdit}
    >
      {currentTenantId && user?.role === 'super_admin' && (
        <>
          <button
            onClick={handleBackToAllTenants}
            className="px-2 py-1 text-sm text-muted hover:text-foreground hover:bg-surface-tertiary transition-colors"
            title="Back to Super Admin"
          >
            Super Admin
          </button>
          <ChevronRight className="w-4 h-4 text-subtle shrink-0" />
          <span className="px-2 py-1 text-sm text-muted">Tenant:</span>
          <span className="px-2 py-1 text-sm font-medium text-primary truncate max-w-[200px]" title={tenantName || currentTenantId}>
            {tenantName || currentTenantId.substring(0, 8) + '...'}
          </span>
          <ChevronRight className="w-4 h-4 text-subtle shrink-0" />
        </>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          navigateTo(-1);
        }}
        className={cn(
          'flex items-center gap-1 px-2 py-1 text-sm transition-colors',
          parts.length === 0
            ? 'text-foreground font-medium'
            : 'text-muted hover:text-foreground hover:bg-surface-tertiary'
        )}
      >
        <Home className="w-4 h-4" />
        <span className="hidden sm:inline">Home</span>
      </button>

      {parts.map((part, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-1 min-w-0"
        >
          <ChevronRight className="w-4 h-4 text-subtle shrink-0" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigateTo(index);
            }}
            className={cn(
              'px-2 py-1 text-sm truncate max-w-[150px] transition-colors',
              index === parts.length - 1
                ? 'text-foreground font-medium'
                : 'text-muted hover:text-foreground hover:bg-surface-tertiary'
            )}
            title={part}
          >
            {part}
          </button>
        </motion.div>
      ))}

      <button
        onClick={(e) => {
          e.stopPropagation();
          handleStartEdit();
        }}
        className="ml-1 p-1 text-subtle hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        title="Edit path"
      >
        <Edit2 className="w-3 h-3" />
      </button>
    </div>
  );
}
