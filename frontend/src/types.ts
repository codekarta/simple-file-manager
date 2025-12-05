// User types
export interface User {
  username: string;
  role: 'admin' | 'user';
  hasApiKey?: boolean;
  apiKey?: string;
  createdAt?: string;
}

export interface AuthState {
  authenticated: boolean;
  user: User | null;
}

// File types
export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
  created?: string;
  accessLevel: 'public' | 'private';
  thumbnailUrl: string | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface FilesResponse {
  currentPath: string;
  items: FileItem[];
  pagination: Pagination;
}

export interface SearchResponse {
  results: FileItem[];
  pagination: Pagination;
}

export interface StorageInfo {
  totalSize: number;
  fileCount: number;
  folderCount: number;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  user?: User;
  error?: string;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  files: Array<{
    name: string;
    size: number;
    path: string;
    accessLevel: string;
  }>;
  foldersCreated: number;
  accessLevel: string;
}

export interface UserListResponse {
  success: boolean;
  users: Array<{
    username: string;
    role: 'admin' | 'user';
    hasApiKey: boolean;
    createdAt: string;
  }>;
}

export interface CreateUserResponse {
  success: boolean;
  message: string;
  user: {
    username: string;
    password: string;
    role: 'admin' | 'user';
  };
}

export interface AboutInfo {
  version: string;
  name: string;
  description: string;
  license: string;
}

export interface CacheStatus {
  enabled: boolean;
  ready: boolean;
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
  lastSync: string;
  syncInProgress: boolean;
  syncInterval: number;
  databasePath: string;
  databaseSize: number;
}

export interface ThumbnailStatus {
  initialized: boolean;
  uploadsPath: string;
  thumbnailBasePath: string;
  thumbnailSize: number;
  thumbnailFormat: string;
  thumbnailQuality: number;
  supportedExtensions: string[];
}

// App state types
export interface AppState {
  // Auth
  isAuthenticated: boolean;
  user: User | null;
  
  // Files
  currentPath: string;
  files: FileItem[];
  pagination: Pagination | null;
  selectedFiles: Set<string>;
  
  // UI
  viewMode: 'grid' | 'table';
  showHiddenFiles: boolean;
  sidebarCollapsed: boolean;
  searchQuery: string;
  isRegexSearch: boolean;
  
  // Storage
  storageInfo: StorageInfo | null;
  
  // Loading states
  isLoading: boolean;
}

// Modal types
export type ModalType = 
  | 'upload'
  | 'newFolder'
  | 'newFile'
  | 'rename'
  | 'delete'
  | 'settings'
  | 'user'
  | 'admin'
  | 'about'
  | 'slideshow'
  | null;

export interface ModalState {
  type: ModalType;
  data?: unknown;
}

// Action types for file operations
export interface RenameData {
  path: string;
  currentName: string;
}

export interface DeleteData {
  paths: string[];
  names: string[];
}
