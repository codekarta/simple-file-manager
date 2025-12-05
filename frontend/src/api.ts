import axios, { AxiosError } from 'axios';
import type {
  AuthState,
  User,
  FilesResponse,
  SearchResponse,
  StorageInfo,
  LoginResponse,
  UploadResponse,
  UserListResponse,
  CreateUserResponse,
  AboutInfo,
  CacheStatus,
  ThumbnailStatus,
} from './types';

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error handler
function handleError(error: unknown): never {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.error || error.message || 'An error occurred';
    throw new Error(message);
  }
  throw error;
}

// ===== Authentication =====

export async function checkAuthStatus(): Promise<AuthState> {
  try {
    const { data } = await api.get<{ authenticated: boolean; user?: User }>('/auth/status');
    return {
      authenticated: data.authenticated,
      user: data.user || null,
    };
  } catch {
    return { authenticated: false, user: null };
  }
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  try {
    const { data } = await api.post<LoginResponse>('/login', { username, password });
    return data;
  } catch (error) {
    handleError(error);
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post('/logout');
  } catch (error) {
    handleError(error);
  }
}

// ===== User Management =====

export async function getCurrentUser(): Promise<{ success: boolean; user: User }> {
  try {
    const { data } = await api.get('/user/me');
    return data;
  } catch (error) {
    handleError(error);
  }
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  try {
    await api.post('/user/change-password', { oldPassword, newPassword });
  } catch (error) {
    handleError(error);
  }
}

export async function generateApiToken(password: string): Promise<string> {
  try {
    const { data } = await api.post<{ success: boolean; apiKey: string }>('/user/generate-token', { password });
    return data.apiKey;
  } catch (error) {
    handleError(error);
  }
}

export async function deleteApiToken(password: string): Promise<void> {
  try {
    await api.delete('/user/delete-token', { data: { password } });
  } catch (error) {
    handleError(error);
  }
}

// ===== Admin User Management =====

export async function listUsers(): Promise<UserListResponse['users']> {
  try {
    const { data } = await api.get<UserListResponse>('/admin/users');
    return data.users;
  } catch (error) {
    handleError(error);
  }
}

export async function createUser(
  username: string,
  role: 'admin' | 'user',
  password: string
): Promise<CreateUserResponse['user']> {
  try {
    const { data } = await api.post<CreateUserResponse>('/admin/users', { username, role, password });
    return data.user;
  } catch (error) {
    handleError(error);
  }
}

export async function deleteUser(username: string): Promise<void> {
  try {
    await api.delete(`/admin/users/${encodeURIComponent(username)}`);
  } catch (error) {
    handleError(error);
  }
}

export async function resetUserPassword(
  username: string,
  customPassword?: string
): Promise<string | undefined> {
  try {
    const { data } = await api.post<{ success: boolean; newPassword?: string }>(
      `/admin/users/${encodeURIComponent(username)}/reset-password`,
      { customPassword }
    );
    return data.newPassword;
  } catch (error) {
    handleError(error);
  }
}

// ===== File Operations =====

export async function getFiles(
  path: string = '',
  page: number = 1,
  limit: number = 50,
  showHidden: boolean = false
): Promise<FilesResponse> {
  try {
    const { data } = await api.get<FilesResponse>('/files', {
      params: { path, page, limit, showHidden },
    });
    return data;
  } catch (error) {
    handleError(error);
  }
}

export async function searchFiles(
  query: string,
  regex: boolean = false,
  page: number = 1,
  limit: number = 50,
  showHidden: boolean = false
): Promise<SearchResponse> {
  try {
    const { data } = await api.get<SearchResponse>('/search', {
      params: { q: query, regex, page, limit, showHidden },
    });
    return data;
  } catch (error) {
    handleError(error);
  }
}

export async function uploadFiles(
  files: File[],
  basePath: string = '',
  accessLevel: 'public' | 'private' = 'public',
  relativePaths?: string[],
  onProgress?: (progress: number) => void
): Promise<UploadResponse> {
  try {
    const formData = new FormData();
    formData.append('basePath', basePath);
    formData.append('mediaAccessLevel', accessLevel);

    files.forEach((file) => {
      formData.append('files', file);
    });

    if (relativePaths) {
      relativePaths.forEach((path) => {
        formData.append('relativePaths', path);
      });
    }

    const { data } = await api.post<UploadResponse>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    return data;
  } catch (error) {
    handleError(error);
  }
}

// Upload a single file with individual progress tracking
export async function uploadSingleFile(
  file: File,
  basePath: string = '',
  accessLevel: 'public' | 'private' = 'public',
  relativePath?: string,
  onProgress?: (progress: number) => void
): Promise<UploadResponse> {
  try {
    const formData = new FormData();
    formData.append('basePath', basePath);
    formData.append('mediaAccessLevel', accessLevel);
    formData.append('files', file);

    if (relativePath) {
      formData.append('relativePaths', relativePath);
    }

    const { data } = await api.post<UploadResponse>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    return data;
  } catch (error) {
    handleError(error);
  }
}

export async function createFolder(
  path: string,
  name: string,
  accessLevel: 'public' | 'private' = 'public'
): Promise<void> {
  try {
    await api.post('/folder', { path, name, mediaAccessLevel: accessLevel });
  } catch (error) {
    handleError(error);
  }
}

export async function createFile(
  path: string,
  name: string,
  content: string = '',
  accessLevel: 'public' | 'private' = 'public'
): Promise<void> {
  try {
    await api.post('/file', { path, name, content, mediaAccessLevel: accessLevel });
  } catch (error) {
    handleError(error);
  }
}

export async function deleteItem(path: string): Promise<void> {
  try {
    await api.delete('/delete', { data: { path } });
  } catch (error) {
    handleError(error);
  }
}

export async function renameItem(path: string, newName: string): Promise<void> {
  try {
    await api.post('/rename', { path, newName });
  } catch (error) {
    handleError(error);
  }
}

export async function duplicateItem(path: string): Promise<{ success: boolean; newPath: string; newName: string }> {
  try {
    const { data } = await api.post<{ success: boolean; newPath: string; newName: string }>('/duplicate', { path });
    return data;
  } catch (error) {
    handleError(error);
  }
}

export async function moveItem(path: string, destination: string): Promise<{ success: boolean; newPath: string }> {
  try {
    const { data } = await api.post<{ success: boolean; newPath: string }>('/move', { path, destination });
    return data;
  } catch (error) {
    handleError(error);
  }
}

export async function updateAccessLevel(
  path: string,
  accessLevel: 'public' | 'private'
): Promise<void> {
  try {
    await api.post('/access-level', { path, accessLevel });
  } catch (error) {
    handleError(error);
  }
}

export function getDownloadUrl(path: string): string {
  return `/api/download?path=${encodeURIComponent(path)}`;
}

export function getShareableLink(path: string, apiKey?: string): string {
  const baseUrl = window.location.origin;
  const encodedPath = encodeURIComponent(path);
  if (apiKey) {
    return `${baseUrl}/api/download?path=${encodedPath}&apiKey=${encodeURIComponent(apiKey)}`;
  }
  return `${baseUrl}/api/download?path=${encodedPath}`;
}

// ===== Storage =====

export async function getStorageInfo(): Promise<StorageInfo> {
  try {
    const { data } = await api.get<StorageInfo>('/storage');
    return data;
  } catch (error) {
    handleError(error);
  }
}

// ===== System Info =====

export async function getAboutInfo(): Promise<AboutInfo> {
  try {
    const { data } = await api.get<AboutInfo>('/about');
    return data;
  } catch (error) {
    handleError(error);
  }
}

// ===== Cache Management (Admin) =====

export async function getCacheStatus(): Promise<CacheStatus> {
  try {
    const { data } = await api.get<CacheStatus>('/cache/status');
    return data;
  } catch (error) {
    handleError(error);
  }
}

export async function rebuildCache(): Promise<void> {
  try {
    await api.post('/cache/rebuild');
  } catch (error) {
    handleError(error);
  }
}

// ===== Thumbnail Management (Admin) =====

export async function getThumbnailStatus(): Promise<ThumbnailStatus> {
  try {
    const { data } = await api.get<ThumbnailStatus>('/thumbnails/status');
    return data;
  } catch (error) {
    handleError(error);
  }
}

export async function generateThumbnails(): Promise<void> {
  try {
    await api.post('/thumbnails/generate');
  } catch (error) {
    handleError(error);
  }
}

export async function syncThumbnails(): Promise<void> {
  try {
    await api.post('/thumbnails/sync');
  } catch (error) {
    handleError(error);
  }
}

export default api;
