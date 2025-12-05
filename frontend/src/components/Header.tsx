import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Menu,
  Upload,
  FolderPlus,
  FilePlus,
  Trash2,
  LayoutGrid,
  LayoutList,
  Eye,
  EyeOff,
  Search,
  X,
  MoreHorizontal,
  RefreshCw,
  Play,
} from 'lucide-react';
import { useFiles, useUI, useModal, useStorage } from '../store';
import Button from './Button';
import Breadcrumb from './Breadcrumb';
import Tooltip from './Tooltip';
import { cn, formatFileSize, debounce } from '../utils';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { selectedFiles, clearSelection, loadFiles, currentPath, searchFiles } = useFiles();
  const {
    viewMode,
    setViewMode,
    showHiddenFiles,
    setShowHiddenFiles,
    searchQuery,
    setSearchQuery,
    isRegexSearch,
    setIsRegexSearch,
    isSearching,
  } = useUI();
  const { openModal } = useModal();
  const { storageInfo, refreshStorageInfo } = useStorage();

  const [showSearch, setShowSearch] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const hasSelection = selectedFiles.size > 0;

  // Debounced search
  const debouncedSearch = debounce((query: string) => {
    if (query.length >= 2) {
      searchFiles(query, isRegexSearch);
    } else if (query.length === 0) {
      loadFiles(currentPath);
    }
  }, 500);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    debouncedSearch(value);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    loadFiles(currentPath);
    setShowSearch(false);
  };

  const handleBulkDelete = () => {
    openModal('delete', {
      paths: Array.from(selectedFiles),
      names: Array.from(selectedFiles).map((p) => p.split('/').pop()),
    });
  };

  const handleRefresh = () => {
    loadFiles(currentPath);
    refreshStorageInfo();
  };

  return (
    <header className="bg-surface border-b border-border sticky top-0 z-30">
      {/* Main header row */}
      <div className="flex items-center gap-3 px-4 h-14">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-muted hover:text-foreground hover:bg-surface-tertiary transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb */}
        <div className="flex-1 min-w-0">
          <Breadcrumb />
        </div>

        {/* Storage info - desktop */}
        {storageInfo && (
          <div className="hidden md:flex items-center gap-4 text-xs text-muted px-3 py-1.5 bg-surface-secondary border border-border">
            <span>
              <strong className="text-foreground">{formatFileSize(storageInfo.totalSize)}</strong> used
            </span>
            <span>
              <strong className="text-foreground">{storageInfo.fileCount}</strong> files
            </span>
            <span>
              <strong className="text-foreground">{storageInfo.folderCount}</strong> folders
            </span>
          </div>
        )}

        {/* Action buttons - desktop */}
        <div className="hidden sm:flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={<Upload className="w-4 h-4" />}
            onClick={() => openModal('upload')}
          >
            Upload
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<FolderPlus className="w-4 h-4" />}
            onClick={() => openModal('newFolder')}
          >
            New Folder
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<FilePlus className="w-4 h-4" />}
            onClick={() => openModal('newFile')}
          >
            New File
          </Button>
        </div>

        {/* More menu - mobile */}
        <div className="relative sm:hidden">
          <Button
            variant="ghost"
            size="sm"
            icon={<MoreHorizontal className="w-4 h-4" />}
            onClick={() => setShowMoreMenu(!showMoreMenu)}
          />
          {showMoreMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMoreMenu(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full mt-1 bg-surface border border-border shadow-lg z-50 min-w-[160px]"
              >
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-tertiary"
                  onClick={() => {
                    openModal('upload');
                    setShowMoreMenu(false);
                  }}
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-tertiary"
                  onClick={() => {
                    openModal('newFolder');
                    setShowMoreMenu(false);
                  }}
                >
                  <FolderPlus className="w-4 h-4" />
                  New Folder
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-tertiary"
                  onClick={() => {
                    openModal('newFile');
                    setShowMoreMenu(false);
                  }}
                >
                  <FilePlus className="w-4 h-4" />
                  New File
                </button>
              </motion.div>
            </>
          )}
        </div>
      </div>

      {/* Toolbar row */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-border bg-surface-secondary">
        {/* Bulk delete button */}
        {hasSelection && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2"
          >
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={handleBulkDelete}
            >
              Delete ({selectedFiles.size})
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
          </motion.div>
        )}

        {/* Search */}
        <div className="flex-1 flex items-center gap-2">
          {showSearch ? (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              className="flex items-center gap-2 flex-1 max-w-md"
            >
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-subtle" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search files..."
                  className="w-full h-8 pl-8 pr-3 text-sm bg-surface border border-border focus:border-primary focus:outline-none"
                  autoFocus
                />
                {(searchQuery || isSearching) && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-subtle hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setIsRegexSearch(!isRegexSearch)}
                className={cn(
                  'px-2 py-1 text-xs font-medium border transition-colors',
                  isRegexSearch
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface text-muted border-border hover:border-text-tertiary'
                )}
              >
                .*
              </button>
            </motion.div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              icon={<Search className="w-4 h-4" />}
              onClick={() => setShowSearch(true)}
            >
              <span className="hidden sm:inline">Search</span>
            </Button>
          )}
        </div>

        {/* View controls */}
        <div className="flex items-center gap-1">
          <Tooltip content="Refresh" position="bottom">
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={handleRefresh}
            />
          </Tooltip>

          <Tooltip content="Play Slideshow" position="bottom">
            <Button
              variant="ghost"
              size="sm"
              icon={<Play className="w-4 h-4" />}
              onClick={() => openModal('slideshow')}
            />
          </Tooltip>
          
          <Tooltip content={showHiddenFiles ? 'Hide hidden files' : 'Show hidden files'} position="bottom">
            <button
              onClick={() => setShowHiddenFiles(!showHiddenFiles)}
              className={cn(
                'p-2 transition-colors',
                showHiddenFiles
                  ? 'text-primary bg-primary-subtle'
                  : 'text-muted hover:text-foreground hover:bg-surface-tertiary'
              )}
            >
              {showHiddenFiles ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
            </button>
          </Tooltip>

          <div className="flex border border-border">
            <Tooltip content="Grid view" position="bottom">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-2 transition-colors',
                  viewMode === 'grid'
                    ? 'bg-primary text-white'
                    : 'text-muted hover:text-foreground hover:bg-surface-tertiary'
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip content="Table view" position="bottom">
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  'p-2 transition-colors border-l border-border',
                  viewMode === 'table'
                    ? 'bg-primary text-white'
                    : 'text-muted hover:text-foreground hover:bg-surface-tertiary'
                )}
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </header>
  );
}
