// Format file size to human readable
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format date to locale string
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format date with time
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Get file extension
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

// File type configurations for icons
export interface FileTypeConfig {
  icon: string;
  color: string;
  bgColor: string;
  label: string;
}

export const FILE_TYPE_CONFIGS: Record<string, FileTypeConfig> = {
  // Documents
  pdf: { icon: 'FileText', color: '#e74c3c', bgColor: '#fef2f2', label: 'PDF' },
  doc: { icon: 'FileText', color: '#2980b9', bgColor: '#eff6ff', label: 'DOC' },
  docx: { icon: 'FileText', color: '#2980b9', bgColor: '#eff6ff', label: 'DOC' },
  txt: { icon: 'FileText', color: '#6b7280', bgColor: '#f3f4f6', label: 'TXT' },
  md: { icon: 'FileText', color: '#6b7280', bgColor: '#f3f4f6', label: 'MD' },
  rtf: { icon: 'FileText', color: '#2980b9', bgColor: '#eff6ff', label: 'RTF' },

  // Spreadsheets
  xls: { icon: 'Table', color: '#27ae60', bgColor: '#f0fdf4', label: 'XLS' },
  xlsx: { icon: 'Table', color: '#27ae60', bgColor: '#f0fdf4', label: 'XLS' },
  csv: { icon: 'Table', color: '#27ae60', bgColor: '#f0fdf4', label: 'CSV' },

  // Presentations
  ppt: { icon: 'Presentation', color: '#d35400', bgColor: '#fff7ed', label: 'PPT' },
  pptx: { icon: 'Presentation', color: '#d35400', bgColor: '#fff7ed', label: 'PPT' },

  // Archives
  zip: { icon: 'Archive', color: '#8e44ad', bgColor: '#faf5ff', label: 'ZIP' },
  rar: { icon: 'Archive', color: '#8e44ad', bgColor: '#faf5ff', label: 'RAR' },
  tar: { icon: 'Archive', color: '#8e44ad', bgColor: '#faf5ff', label: 'TAR' },
  gz: { icon: 'Archive', color: '#8e44ad', bgColor: '#faf5ff', label: 'GZ' },
  '7z': { icon: 'Archive', color: '#8e44ad', bgColor: '#faf5ff', label: '7Z' },

  // Code files
  js: { icon: 'Code', color: '#f59e0b', bgColor: '#fffbeb', label: 'JS' },
  ts: { icon: 'Code', color: '#3178c6', bgColor: '#eff6ff', label: 'TS' },
  jsx: { icon: 'Code', color: '#61dafb', bgColor: '#ecfeff', label: 'JSX' },
  tsx: { icon: 'Code', color: '#3178c6', bgColor: '#eff6ff', label: 'TSX' },
  html: { icon: 'Code', color: '#e34c26', bgColor: '#fef2f2', label: 'HTML' },
  css: { icon: 'Code', color: '#264de4', bgColor: '#eef2ff', label: 'CSS' },
  scss: { icon: 'Code', color: '#cc6699', bgColor: '#fdf4ff', label: 'SCSS' },
  json: { icon: 'Code', color: '#6b7280', bgColor: '#f3f4f6', label: 'JSON' },
  xml: { icon: 'Code', color: '#6b7280', bgColor: '#f3f4f6', label: 'XML' },
  py: { icon: 'Code', color: '#3776ab', bgColor: '#eff6ff', label: 'PY' },
  java: { icon: 'Code', color: '#b07219', bgColor: '#fff7ed', label: 'JAVA' },
  cpp: { icon: 'Code', color: '#00599c', bgColor: '#eff6ff', label: 'CPP' },
  c: { icon: 'Code', color: '#00599c', bgColor: '#eff6ff', label: 'C' },
  php: { icon: 'Code', color: '#4f5d95', bgColor: '#eef2ff', label: 'PHP' },
  rb: { icon: 'Code', color: '#cc342d', bgColor: '#fef2f2', label: 'RB' },
  go: { icon: 'Code', color: '#00add8', bgColor: '#ecfeff', label: 'GO' },
  rs: { icon: 'Code', color: '#ce412b', bgColor: '#fef2f2', label: 'RS' },

  // Images
  jpg: { icon: 'Image', color: '#10b981', bgColor: '#ecfdf5', label: 'JPG' },
  jpeg: { icon: 'Image', color: '#10b981', bgColor: '#ecfdf5', label: 'JPEG' },
  png: { icon: 'Image', color: '#10b981', bgColor: '#ecfdf5', label: 'PNG' },
  gif: { icon: 'Image', color: '#10b981', bgColor: '#ecfdf5', label: 'GIF' },
  webp: { icon: 'Image', color: '#10b981', bgColor: '#ecfdf5', label: 'WEBP' },
  svg: { icon: 'Image', color: '#10b981', bgColor: '#ecfdf5', label: 'SVG' },
  bmp: { icon: 'Image', color: '#10b981', bgColor: '#ecfdf5', label: 'BMP' },
  tiff: { icon: 'Image', color: '#10b981', bgColor: '#ecfdf5', label: 'TIFF' },
  tif: { icon: 'Image', color: '#10b981', bgColor: '#ecfdf5', label: 'TIF' },

  // Video
  mp4: { icon: 'Video', color: '#e84393', bgColor: '#fdf4ff', label: 'MP4' },
  avi: { icon: 'Video', color: '#e84393', bgColor: '#fdf4ff', label: 'AVI' },
  mov: { icon: 'Video', color: '#e84393', bgColor: '#fdf4ff', label: 'MOV' },
  mkv: { icon: 'Video', color: '#e84393', bgColor: '#fdf4ff', label: 'MKV' },
  wmv: { icon: 'Video', color: '#e84393', bgColor: '#fdf4ff', label: 'WMV' },
  flv: { icon: 'Video', color: '#e84393', bgColor: '#fdf4ff', label: 'FLV' },
  webm: { icon: 'Video', color: '#e84393', bgColor: '#fdf4ff', label: 'WEBM' },

  // Audio
  mp3: { icon: 'Music', color: '#00b894', bgColor: '#ecfdf5', label: 'MP3' },
  wav: { icon: 'Music', color: '#00b894', bgColor: '#ecfdf5', label: 'WAV' },
  flac: { icon: 'Music', color: '#00b894', bgColor: '#ecfdf5', label: 'FLAC' },
  aac: { icon: 'Music', color: '#00b894', bgColor: '#ecfdf5', label: 'AAC' },
  ogg: { icon: 'Music', color: '#00b894', bgColor: '#ecfdf5', label: 'OGG' },
  m4a: { icon: 'Music', color: '#00b894', bgColor: '#ecfdf5', label: 'M4A' },
};

export const DEFAULT_FILE_CONFIG: FileTypeConfig = {
  icon: 'File',
  color: '#6b7280',
  bgColor: '#f3f4f6',
  label: 'FILE',
};

export function getFileTypeConfig(filename: string): FileTypeConfig {
  const ext = getFileExtension(filename);
  return FILE_TYPE_CONFIGS[ext] || DEFAULT_FILE_CONFIG;
}

// Check if file is an image
export function isImageFile(filename: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'tif'];
  return imageExtensions.includes(getFileExtension(filename));
}

// Check if file is video
export function isVideoFile(filename: string): boolean {
  const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'];
  return videoExtensions.includes(getFileExtension(filename));
}

// Check if file is audio
export function isAudioFile(filename: string): boolean {
  const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'];
  return audioExtensions.includes(getFileExtension(filename));
}

// Check if file is a text-based file that can be edited
export function isTextFile(filename: string): boolean {
  const textExtensions = [
    'txt', 'md', 'html', 'htm', 'css', 'scss', 'sass', 'less', 'js', 'jsx', 'ts', 'tsx',
    'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'config',
    'py', 'java', 'c', 'cpp', 'cc', 'cxx', 'h', 'hpp', 'php', 'rb', 'go', 'rs',
    'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
    'sql', 'r', 'm', 'swift', 'kt', 'scala', 'clj', 'hs', 'ml', 'fs',
    'vue', 'svelte', 'astro', 'jsx', 'tsx',
    'log', 'env', 'gitignore', 'dockerfile', 'makefile',
    'csv', 'tsv', 'diff', 'patch'
  ];
  return textExtensions.includes(getFileExtension(filename));
}

// Get Monaco editor language from file extension
export function getMonacoLanguage(filename: string): string {
  const ext = getFileExtension(filename);
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'py': 'python',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'fish': 'shell',
    'ps1': 'powershell',
    'bat': 'bat',
    'cmd': 'bat',
    'sql': 'sql',
    'r': 'r',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'vue': 'html',
    'svelte': 'html',
    'md': 'markdown',
    'log': 'plaintext',
    'txt': 'plaintext',
    'env': 'plaintext',
    'gitignore': 'plaintext',
    'dockerfile': 'dockerfile',
    'makefile': 'makefile',
    'csv': 'csv',
    'tsv': 'plaintext',
    'diff': 'diff',
    'patch': 'diff',
  };
  return languageMap[ext] || 'plaintext';
}

// Generate random password
export function generatePassword(length: number = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Debounce function
export function debounce<T extends (...args: string[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Class name helper (simple cn utility)
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Escape regex special characters
export function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Get parent path
export function getParentPath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

// Join paths
export function joinPaths(...paths: string[]): string {
  return paths
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

// Local storage helpers
export function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors
  }
}
