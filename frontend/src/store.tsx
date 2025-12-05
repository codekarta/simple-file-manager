import { createContext, useContext, useState, useCallback, useEffect, useOptimistic, useRef } from 'react';
import type { ReactNode } from 'react';
import type { User, FileItem, Pagination, StorageInfo, ModalType } from './types';
import * as api from './api';
import { getStorageItem, setStorageItem } from './utils';

// ===== App State Context =====

interface AppContextValue {
  // Auth state
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
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
  const [isLoading, setIsLoading] = useState(true);

  // Tenant state
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(() =>
    getStorageItem('currentTenantId', null)
  );

  // File state
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Optimistic updates for files
  const [optimisticFiles, setOptimisticFiles] = useOptimistic(
    files,
    (state, deletedPath: string) => state.filter((f) => f.path !== deletedPath)
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
      setIsLoading(true);
      const status = await api.checkAuthStatus();
      setIsAuthenticated(status.authenticated);
      setUser(status.user);
    } catch {
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
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
      setIsLoading(true);
      const targetPath = path ?? currentPath;
      
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
      setIsLoading(false);
    }
  }, [currentPath, itemsPerPage, showHiddenFiles, currentTenantId, user]);

  const searchFilesHandler = useCallback(async (query: string, regex?: boolean) => {
    if (!query.trim()) {
      loadFiles(currentPath);
      return;
    }
    try {
      setIsSearching(true);
      
      // Determine tenantId
      let tenantId: string | null = currentTenantId;
      if (!tenantId && user?.tenantId) {
        tenantId = user.tenantId;
      }
      
      const response = await api.searchFiles(
        query,
        regex ?? isRegexSearch,
        1,
        itemsPerPage,
        showHiddenFiles,
        tenantId
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
  }, [currentPath, isRegexSearch, itemsPerPage, showHiddenFiles, loadFiles, currentTenantId, user]);

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

  // Optimistic delete
  const deleteFileOptimistic = useCallback((path: string) => {
    setOptimisticFiles(path);
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

  const value: AppContextValue = {
    // Auth
    isAuthenticated,
    user,
    isLoading,
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
  };

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
  const { isAuthenticated, user, isLoading, login, logout, checkAuth, refreshUser } = useApp();
  return { isAuthenticated, user, isLoading, login, logout, checkAuth, refreshUser };
}

export function useFiles() {
  const {
    currentPath,
    files,
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
    isLoading,
  } = useApp();
  return {
    currentPath,
    files,
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
    isLoading,
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
