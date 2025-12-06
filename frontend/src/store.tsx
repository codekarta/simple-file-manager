import { createContext, useContext, useState, useCallback, useEffect, useOptimistic, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { User, FileItem, Pagination, StorageInfo, ModalType } from './types';
import * as api from './api';
import { setAuthErrorHandler } from './api';
import { getStorageItem, setStorageItem } from './utils';

// ===== App State Context =====

interface AppContextValue {
  // Auth state
  isAuthenticated: boolean;
  user: User | null;
  isAuthLoading: boolean; // Renamed from isLoading
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;

  // Tenant state
  currentTenantId: string | null;
  setCurrentTenantId: (tenantId: string | null) => void;

  // File state
  currentPath: string;
  files: FileItem[];
  isFilesLoading: boolean; // New state for file loading
  pagination: Pagination | null;
  selectedFiles: Set<string>;
  setCurrentPath: (path: string) => void;
  loadFiles: (path?: string, page?: number, tenantIdOverride?: string | null) => Promise<void>;
  searchFiles: (query: string, regex?: boolean) => Promise<void>;
  selectFile: (path: string) => void;
  deselectFile: (path: string) => void;
  toggleFileSelection: (path: string) => void;
  selectAllFiles: () => void;
  clearSelection: () => void;
  isFileSelected: (path: string) => boolean;

  // Optimistic updates
  optimisticFiles: FileItem[];
  deleteFileOptimistic: (path: string) => void;
  addFileOptimistic: (file: FileItem) => void;
  renameFileOptimistic: (path: string, newName: string, newPath: string) => void;

  // Storage info
  storageInfo: StorageInfo | null;
  refreshStorageInfo: () => Promise<void>;

  // UI state
  viewMode: 'grid' | 'table';
  setViewMode: (mode: 'grid' | 'table') => void;
  showHiddenFiles: boolean;
  setShowHiddenFiles: (show: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  itemsPerPage: number;
  setItemsPerPage: (count: number) => void;

  // Search state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isRegexSearch: boolean;
  setIsRegexSearch: (isRegex: boolean) => void;
  isSearching: boolean;

  // Modal state
  activeModal: ModalType;
  modalData: unknown;
  openModal: (type: ModalType, data?: unknown) => void;
  closeModal: () => void;

  // Toast/notification
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;

  // Editor state
  openFile: { path: string; name: string } | null;
  openEditor: (path: string, name: string) => void;
  closeEditor: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true); // Renamed from isLoading

  // Tenant state
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(() =>
    getStorageItem('currentTenantId', null)
  );

  // File state
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isFilesLoading, setIsFilesLoading] = useState(false); // New state
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Optimistic updates for files
  type OptimisticAction =
    | { type: 'delete'; path: string }
    | { type: 'add'; file: FileItem }
    | { type: 'rename'; path: string; newName: string; newPath: string };

  const [optimisticFiles, setOptimisticFiles] = useOptimistic(
    files,
    (state, action: OptimisticAction) => {
      switch (action.type) {
        case 'delete':
          return state.filter((f) => f.path !== action.path);
        case 'add':
          return [...state, action.file].sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
        case 'rename':
          return state.map((f) =>
            f.path === action.path
              ? { ...f, name: action.newName, path: action.newPath }
              : f
          );
        default:
          return state;
      }
    }
  );

  // Storage info
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);

  // UI state from localStorage
  const [viewMode, setViewModeState] = useState<'grid' | 'table'>(() =>
    getStorageItem('viewMode', 'grid')
  );
  const [showHiddenFiles, setShowHiddenFilesState] = useState(() =>
    getStorageItem('showHiddenFiles', false)
  );
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() =>
    getStorageItem('sidebarCollapsed', false)
  );
  const [itemsPerPage, setItemsPerPageState] = useState(() =>
    getStorageItem('itemsPerPage', 50)
  );

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isRegexSearch, setIsRegexSearch] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Modal state
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [modalData, setModalData] = useState<unknown>(null);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Editor state
  const [openFile, setOpenFile] = useState<{ path: string; name: string } | null>(null);

  // Persist UI preferences
  const setViewMode = useCallback((mode: 'grid' | 'table') => {
    setViewModeState(mode);
    setStorageItem('viewMode', mode);
  }, []);

  const setShowHiddenFiles = useCallback((show: boolean) => {
    setShowHiddenFilesState(show);
    setStorageItem('showHiddenFiles', show);
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed);
    setStorageItem('sidebarCollapsed', collapsed);
  }, []);

  const setItemsPerPage = useCallback((count: number) => {
    setItemsPerPageState(count);
    setStorageItem('itemsPerPage', count);
  }, []);

  // Auth functions
  const checkAuth = useCallback(async () => {
    try {
      setIsAuthLoading(true);
      const status = await api.checkAuthStatus();
      setIsAuthenticated(status.authenticated);
      setUser(status.user);
    } catch {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.login(username, password);
    if (response.success && response.user) {
      setIsAuthenticated(true);
      setUser(response.user);
    } else {
      throw new Error(response.error || 'Login failed');
    }
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setIsAuthenticated(false);
    setUser(null);
    setFiles([]);
    setPagination(null);
    setCurrentPath('');
    setSelectedFiles(new Set());
    setSearchQuery('');
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user } = await api.getCurrentUser();
      setUser(user);
    } catch {
      // Ignore errors
    }
  }, []);

  // Tenant functions
  const setCurrentTenantIdWithStorage = useCallback((tenantId: string | null) => {
    setCurrentTenantId(tenantId);
    setStorageItem('currentTenantId', tenantId);
    // Reset path when switching tenants
    setCurrentPath('');
    setFiles([]);
    setPagination(null);
  }, []);

  // File functions
  const loadFiles = useCallback(async (path?: string, page?: number, tenantIdOverride?: string | null) => {
    try {
      setIsFilesLoading(true);
      let targetPath = path ?? currentPath;

      // Handle special "all-files" marker path - show tenant root folders only
      if (targetPath === '__all_files__' || targetPath === 'all-files') {
        targetPath = 'all-files';

        // Only show tenant folders for super admin
        if (user?.role === 'super_admin') {
          try {
            // Get all tenants and show them as folders
            const tenants = await api.listTenants();

            // Transform tenants to FileItem format with tenant names
            const tenantFolders: FileItem[] = tenants.map(tenant => ({
              name: tenant.name, // Use tenant name instead of ID
              path: tenant.tenantId, // Store tenantId in path for navigation
              isDirectory: true,
              size: 0,
              modified: tenant.createdAt,
              created: tenant.createdAt,
              accessLevel: 'public' as const,
              thumbnailUrl: null,
              isTenant: false, // Not marked as tenant so it behaves like a regular folder
              tenantId: tenant.tenantId,
              tenantName: tenant.name,
            }));

            // Sort by tenant name
            tenantFolders.sort((a, b) =>
              (a.tenantName || '').localeCompare(b.tenantName || '')
            );

            // Apply pagination
            const total = tenantFolders.length;
            const currentPage = page || 1;
            const offset = (currentPage - 1) * itemsPerPage;
            const paginatedFolders = tenantFolders.slice(offset, offset + itemsPerPage);

            setFiles(paginatedFolders);
            setPagination({
              page: currentPage,
              limit: itemsPerPage,
              total,
              totalPages: Math.ceil(total / itemsPerPage),
              hasNext: offset + itemsPerPage < total,
              hasPrev: currentPage > 1,
            });
            setCurrentPath('all-files');
            setSelectedFiles(new Set());
            setSearchQuery('');
            setIsFilesLoading(false);
            return;
          } catch (error) {
            if (error instanceof Error) {
              showToast(error.message, 'error');
            }
            setIsFilesLoading(false);
            return;
          }
        } else {
          // Non-super admin - show empty
          setFiles([]);
          setPagination(null);
          setCurrentPath('all-files');
          setSelectedFiles(new Set());
          setSearchQuery('');
          setIsFilesLoading(false);
          return;
        }
      }

      // Determine tenantId: use override if provided, otherwise currentTenantId, or user's tenantId, or null for super admin
      let tenantId: string | null = tenantIdOverride !== undefined ? tenantIdOverride : currentTenantId;
      if (!tenantId && user?.tenantId) {
        tenantId = user.tenantId;
      }
      // Super admin can view all tenants or root (null)

      const response = await api.getFiles(
        targetPath,
        page || 1,
        itemsPerPage,
        showHiddenFiles,
        tenantId
      );
      setFiles(response.items);
      setPagination(response.pagination);
      if (path !== undefined) {
        setCurrentPath(targetPath);
      }
      setSelectedFiles(new Set());
      setSearchQuery('');
    } catch (error) {
      if (error instanceof Error) {
        showToast(error.message, 'error');
      }
    } finally {
      setIsFilesLoading(false);
    }
  }, [currentPath, itemsPerPage, showHiddenFiles, currentTenantId, user]);

  const searchFilesHandler = useCallback(async (query: string, regex?: boolean) => {
    if (!query.trim()) {
      loadFiles(currentPath);
      return;
    }
    try {
      setIsSearching(true);

      // Check if we're on "all-files" view - search across all tenants
      const isOnAllFilesView = currentPath === 'all-files' && user?.role === 'super_admin';

      if (isOnAllFilesView) {
        // Search across all tenants' files and folders
        const tenants = await api.listTenants();
        const useRegex = regex ?? isRegexSearch;

        // Search files in each tenant
        const searchPromises = tenants.map(async (tenant) => {
          try {
            // Search from root of each tenant (empty path means search from tenant root)
            const searchResponse = await api.searchFiles(
              query,
              useRegex,
              1,
              1000, // Get all matching files from each tenant
              showHiddenFiles,
              tenant.tenantId,
              '' // Search from tenant root, not a specific subfolder
            );

            // Return empty array if no results (only show tenants where files actually exist)
            if (!searchResponse.results || searchResponse.results.length === 0) {
              return [];
            }

            // Deduplicate results within this tenant's search results
            const seenInTenant = new Map<string, FileItem>();
            searchResponse.results.forEach((file) => {
              // Use file path as unique key (since path should be unique within a tenant)
              // Normalize the path to handle edge cases
              const normalizedPath = (file.path || '').trim();
              const uniqueKey = normalizedPath || `${file.name}_${file.isDirectory ? 'dir' : 'file'}`;

              // Only add if we haven't seen this path before
              if (!seenInTenant.has(uniqueKey)) {
                seenInTenant.set(uniqueKey, file);
              }
            });

            // Convert deduplicated results and add tenant info
            return Array.from(seenInTenant.values()).map((file) => ({
              ...file,
              tenantId: tenant.tenantId,
              tenantName: tenant.name,
              // Prefix file/folder name with tenant name for display
              name: `${tenant.name}/${file.name}`,
              // Store original path with tenant context (format: "tenantId:filePath")
              path: `${tenant.tenantId}:${file.path}`,
            }));
          } catch (error) {
            console.error(`Error searching in tenant ${tenant.name}:`, error);
            return [];
          }
        });

        const allResultsArrays = await Promise.all(searchPromises);
        const allResults = allResultsArrays.flat();

        // Deduplicate results to ensure each file appears only once per tenant
        // Use a combination of tenantId and file path to create unique keys
        const uniqueResultsMap = new Map<string, FileItem>();

        allResults.forEach((file) => {
          // Extract the original file path (before we added tenant prefix)
          // The path format after transformation is: "tenantId:originalPath"
          let originalPath = file.path || '';
          if (file.path && file.path.includes(':')) {
            const parts = file.path.split(':');
            originalPath = parts.slice(1).join(':') || parts[1] || '';
          }

          // Extract original name (remove tenant prefix from display name)
          // Display name format is: "TenantName/FileName"
          let originalName = file.name || '';
          if (file.name && file.name.includes('/')) {
            const parts = file.name.split('/');
            originalName = parts.slice(1).join('/') || parts[1] || '';
          }

          // Create a unique key: tenantId + normalized file path
          // This ensures same file from same tenant only appears once
          // Use path if available, otherwise use name
          const fileIdentifier = originalPath || originalName || file.name || '';
          const normalizedIdentifier = fileIdentifier.trim().toLowerCase();
          const uniqueKey = `${file.tenantId || 'unknown'}:${normalizedIdentifier}`;

          // Only keep the first occurrence of this tenant+file combination
          // This prevents duplicates even if search returns same file multiple times
          if (!uniqueResultsMap.has(uniqueKey)) {
            uniqueResultsMap.set(uniqueKey, file);
          }
        });

        // Convert map back to array (this gives us deduplicated results)
        const uniqueResults = Array.from(uniqueResultsMap.values());

        // Sort results: directories first, then by tenant name, then by file name
        uniqueResults.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          if (a.tenantName !== b.tenantName) {
            return (a.tenantName || '').localeCompare(b.tenantName || '');
          }
          // Compare by original file name (without tenant prefix) for proper sorting
          const aOriginalName = a.name.includes('/') ? a.name.split('/').pop() || a.name : a.name;
          const bOriginalName = b.name.includes('/') ? b.name.split('/').pop() || b.name : b.name;
          return aOriginalName.toLowerCase().localeCompare(bOriginalName.toLowerCase());
        });

        // Apply pagination
        const total = uniqueResults.length;
        const currentPage = 1;
        const offset = 0;
        const paginatedResults = uniqueResults.slice(offset, offset + itemsPerPage);

        setFiles(paginatedResults);
        setPagination({
          page: currentPage,
          limit: itemsPerPage,
          total,
          totalPages: Math.ceil(total / itemsPerPage),
          hasNext: offset + itemsPerPage < total,
          hasPrev: false,
        });
        setSelectedFiles(new Set());
        return;
      }

      // Check if we're on tenants list page (super admin viewing tenants)
      // We check files to see if we're currently viewing tenant folders
      const isOnTenantsList = user?.role === 'super_admin' &&
        !currentTenantId &&
        currentPath === '' &&
        files.length > 0 &&
        files.some(f => f.isTenant);

      if (isOnTenantsList) {
        // Search/filter tenants client-side
        const allTenants = await api.listTenants();
        const searchTerm = query.toLowerCase();
        const useRegex = regex ?? isRegexSearch;
        const filteredTenants = allTenants.filter(tenant => {
          if (useRegex) {
            try {
              const regexPattern = new RegExp(query, 'i');
              return regexPattern.test(tenant.name) || regexPattern.test(tenant.tenantId);
            } catch {
              // Invalid regex, fall back to simple search
              return tenant.name.toLowerCase().includes(searchTerm) ||
                tenant.tenantId.toLowerCase().includes(searchTerm);
            }
          }
          return tenant.name.toLowerCase().includes(searchTerm) ||
            tenant.tenantId.toLowerCase().includes(searchTerm);
        });

        // Convert tenants to FileItem format
        const tenantItems: FileItem[] = filteredTenants.map(tenant => ({
          name: tenant.name,
          path: tenant.tenantId,
          isDirectory: true,
          size: 0,
          modified: tenant.createdAt,
          created: tenant.createdAt,
          accessLevel: 'public' as const,
          thumbnailUrl: null,
          isTenant: true
        }));

        setFiles(tenantItems);
        setPagination({
          page: 1,
          limit: tenantItems.length,
          total: tenantItems.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        });
        setSelectedFiles(new Set());
        return;
      }

      // Determine tenantId - enforce tenant scope for tenant users
      let tenantId: string | null = currentTenantId;

      // For tenant users, always enforce their tenant (search scoped to their tenant only)
      if (user?.tenantId && user?.role !== 'super_admin') {
        tenantId = user.tenantId;
      } else if (!tenantId && user?.tenantId) {
        tenantId = user.tenantId;
      }

      // Determine search path - if we're inside a tenant folder, search only within current path and its children
      // Don't search from path if we're in "all-files" view (already handled above)
      let searchPath = '';
      if (currentPath && currentPath !== 'all-files' && tenantId) {
        // When inside a tenant folder, search only within current path (scoped search)
        searchPath = currentPath;
      }

      const response = await api.searchFiles(
        query,
        regex ?? isRegexSearch,
        1,
        itemsPerPage,
        showHiddenFiles,
        tenantId,
        searchPath
      );
      setFiles(response.results);
      setPagination(response.pagination);
      setSelectedFiles(new Set());
    } catch (error) {
      if (error instanceof Error) {
        showToast(error.message, 'error');
      }
    } finally {
      setIsSearching(false);
    }
  }, [currentPath, isRegexSearch, itemsPerPage, showHiddenFiles, loadFiles, currentTenantId, user, files]);

  // Selection functions
  const selectFile = useCallback((path: string) => {
    setSelectedFiles((prev) => new Set(prev).add(path));
  }, []);

  const deselectFile = useCallback((path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  const toggleFileSelection = useCallback((path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const selectAllFiles = useCallback(() => {
    setSelectedFiles(new Set(files.map((f) => f.path)));
  }, [files]);

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set());
  }, []);

  const isFileSelected = useCallback((path: string) => {
    return selectedFiles.has(path);
  }, [selectedFiles]);

  // Optimistic actions
  const deleteFileOptimistic = useCallback((path: string) => {
    setOptimisticFiles({ type: 'delete', path });
  }, [setOptimisticFiles]);

  const addFileOptimistic = useCallback((file: FileItem) => {
    setOptimisticFiles({ type: 'add', file });
  }, [setOptimisticFiles]);

  const renameFileOptimistic = useCallback((path: string, newName: string, newPath: string) => {
    setOptimisticFiles({ type: 'rename', path, newName, newPath });
  }, [setOptimisticFiles]);

  // Storage info
  const refreshStorageInfo = useCallback(async () => {
    try {
      const info = await api.getStorageInfo();
      setStorageInfo(info);
    } catch {
      // Ignore errors
    }
  }, []);

  // Modal functions
  const openModal = useCallback((type: ModalType, data?: unknown) => {
    setActiveModal(type);
    setModalData(data);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalData(null);
  }, []);

  // Toast function
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Editor functions
  const openEditor = useCallback((path: string, name: string) => {
    setOpenFile({ path, name });
  }, []);

  const closeEditor = useCallback(() => {
    setOpenFile(null);
  }, []);

  // Track if initial data has been loaded
  const initialLoadDone = useRef(false);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Register auth error handler for 401 responses
  useEffect(() => {
    setAuthErrorHandler(() => {
      // When session expires, just set authenticated to false to show login page
      setIsAuthenticated(false);
      setUser(null);
    });
  }, []);

  // Load files when authenticated (only once)
  useEffect(() => {
    if (isAuthenticated && !initialLoadDone.current) {
      initialLoadDone.current = true;
      loadFiles('');
      refreshStorageInfo();
    }
    // Reset when logged out
    if (!isAuthenticated) {
      initialLoadDone.current = false;
    }
  }, [isAuthenticated, loadFiles, refreshStorageInfo]);

  const value: AppContextValue = useMemo(() => ({
    // Auth
    isAuthenticated,
    user,
    isAuthLoading, // Renamed
    login,
    logout,
    checkAuth,
    refreshUser,

    // Tenant
    currentTenantId,
    setCurrentTenantId: setCurrentTenantIdWithStorage,

    // Files
    currentPath,
    files,
    isFilesLoading, // New
    pagination,
    selectedFiles,
    setCurrentPath,
    loadFiles,
    searchFiles: searchFilesHandler,
    selectFile,
    deselectFile,
    toggleFileSelection,
    selectAllFiles,
    clearSelection,
    isFileSelected,

    // Optimistic
    optimisticFiles,
    deleteFileOptimistic,
    addFileOptimistic, // New
    renameFileOptimistic, // New

    // Storage
    storageInfo,
    refreshStorageInfo,

    // UI
    viewMode,
    setViewMode,
    showHiddenFiles,
    setShowHiddenFiles,
    sidebarCollapsed,
    setSidebarCollapsed,
    itemsPerPage,
    setItemsPerPage,

    // Search
    searchQuery,
    setSearchQuery,
    isRegexSearch,
    setIsRegexSearch,
    isSearching,

    // Modal
    activeModal,
    modalData,
    openModal,
    closeModal,

    // Toast
    showToast,
    toast,

    // Editor
    openFile,
    openEditor,
    closeEditor,
  }), [
    isAuthenticated, user, isAuthLoading, login, logout, checkAuth, refreshUser,
    currentTenantId, setCurrentTenantIdWithStorage,
    currentPath, files, isFilesLoading, pagination, selectedFiles, setCurrentPath, loadFiles, searchFilesHandler,
    selectFile, deselectFile, toggleFileSelection, selectAllFiles, clearSelection, isFileSelected,
    optimisticFiles, deleteFileOptimistic, addFileOptimistic, renameFileOptimistic, // Added dependencies
    storageInfo, refreshStorageInfo,
    viewMode, setViewMode, showHiddenFiles, setShowHiddenFiles, sidebarCollapsed, setSidebarCollapsed, itemsPerPage, setItemsPerPage,
    searchQuery, setSearchQuery, isRegexSearch, setIsRegexSearch, isSearching,
    activeModal, modalData, openModal, closeModal,
    showToast, toast,
    openFile, openEditor, closeEditor,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

// Convenience hooks
export function useAuth() {
  const { isAuthenticated, user, isAuthLoading, login, logout, checkAuth, refreshUser } = useApp();
  return { isAuthenticated, user, isAuthLoading, login, logout, checkAuth, refreshUser };
}

export function useFiles() {
  const {
    currentPath,
    files,
    isFilesLoading, // New
    optimisticFiles,
    pagination,
    selectedFiles,
    setCurrentPath,
    loadFiles,
    searchFiles,
    selectFile,
    deselectFile,
    toggleFileSelection,
    selectAllFiles,
    clearSelection,
    isFileSelected,
    deleteFileOptimistic,
    addFileOptimistic, // New
    renameFileOptimistic, // New
  } = useApp();
  return {
    currentPath,
    files,
    isFilesLoading, // New
    optimisticFiles,
    pagination,
    selectedFiles,
    setCurrentPath,
    loadFiles,
    searchFiles,
    selectFile,
    deselectFile,
    toggleFileSelection,
    selectAllFiles,
    clearSelection,
    isFileSelected,
    deleteFileOptimistic,
    addFileOptimistic, // New
    renameFileOptimistic, // New
  };
}

export function useStorage() {
  const { storageInfo, refreshStorageInfo } = useApp();
  return { storageInfo, refreshStorageInfo };
}

export function useModal() {
  const { activeModal, modalData, openModal, closeModal } = useApp();
  return { activeModal, modalData, openModal, closeModal };
}

export function useUI() {
  const {
    viewMode,
    setViewMode,
    showHiddenFiles,
    setShowHiddenFiles,
    sidebarCollapsed,
    setSidebarCollapsed,
    itemsPerPage,
    setItemsPerPage,
    searchQuery,
    setSearchQuery,
    isRegexSearch,
    setIsRegexSearch,
    isSearching,
    showToast,
    toast,
  } = useApp();
  return {
    viewMode,
    setViewMode,
    showHiddenFiles,
    setShowHiddenFiles,
    sidebarCollapsed,
    setSidebarCollapsed,
    itemsPerPage,
    setItemsPerPage,
    searchQuery,
    setSearchQuery,
    isRegexSearch,
    setIsRegexSearch,
    isSearching,
    showToast,
    toast,
  };
}
