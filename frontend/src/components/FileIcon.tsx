import {
  Folder,
  File,
  FileText,
  FileCode,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileSpreadsheet,
  Presentation,
  Building2,
} from 'lucide-react';
import { getFileExtension, isImageFile } from '../utils';
import { cn } from '../utils';

interface FileIconProps {
  name: string;
  isDirectory: boolean;
  thumbnailUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isTenant?: boolean;
}

export default function FileIcon({
  name,
  isDirectory,
  thumbnailUrl,
  size = 'md',
  className,
  isTenant = false,
}: FileIconProps) {
  const sizes = {
    sm: { wrapper: 'w-8 h-8', icon: 'w-4 h-4', thumb: 'w-8 h-8' },
    md: { wrapper: 'w-10 h-10', icon: 'w-5 h-5', thumb: 'w-10 h-10' },
    lg: { wrapper: 'w-16 h-16', icon: 'w-8 h-8', thumb: 'w-16 h-16' },
  };

  // Show thumbnail for images
  if (!isDirectory && thumbnailUrl && isImageFile(name)) {
    return (
      <div
        className={cn(
          'shrink-0 overflow-hidden bg-surface-secondary border border-border',
          sizes[size].thumb,
          className
        )}
      >
        <img
          src={thumbnailUrl}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            // Hide broken image and show default icon
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  // Get icon and colors based on file type
  const { icon: IconComponent, bgColor, color } = getIconConfig(name, isDirectory, isTenant);

  return (
    <div
      className={cn(
        'shrink-0 flex items-center justify-center',
        sizes[size].wrapper,
        className
      )}
      style={{ backgroundColor: bgColor }}
    >
      <IconComponent className={sizes[size].icon} style={{ color }} />
    </div>
  );
}

function getIconConfig(name: string, isDirectory: boolean, isTenant: boolean = false) {
  if (isDirectory) {
    if (isTenant) {
      // Tenant folder - use building icon with distinct color
      return {
        icon: Building2,
        bgColor: '#e0e7ff',
        color: '#4f46e5',
      };
    }
    // Regular folder
    return {
      icon: Folder,
      bgColor: '#fff7ed',
      color: '#ea580c',
    };
  }

  const ext = getFileExtension(name);

  // Documents
  if (['pdf'].includes(ext)) {
    return { icon: FileText, bgColor: '#fef2f2', color: '#dc2626' };
  }
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) {
    return { icon: FileText, bgColor: '#eff6ff', color: '#2563eb' };
  }
  if (['txt', 'md'].includes(ext)) {
    return { icon: FileText, bgColor: '#f3f4f6', color: '#6b7280' };
  }

  // Spreadsheets
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return { icon: FileSpreadsheet, bgColor: '#f0fdf4', color: '#16a34a' };
  }

  // Presentations
  if (['ppt', 'pptx', 'odp'].includes(ext)) {
    return { icon: Presentation, bgColor: '#fff7ed', color: '#ea580c' };
  }

  // Code files
  if (
    [
      'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'json', 'xml',
      'py', 'java', 'cpp', 'c', 'h', 'php', 'rb', 'go', 'rs', 'swift',
      'kt', 'sh', 'bash', 'zsh', 'yaml', 'yml', 'toml', 'ini', 'sql',
    ].includes(ext)
  ) {
    return { icon: FileCode, bgColor: '#f3f4f6', color: '#374151' };
  }

  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif', 'ico'].includes(ext)) {
    return { icon: FileImage, bgColor: '#ecfdf5', color: '#10b981' };
  }

  // Videos
  if (['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm', 'm4v'].includes(ext)) {
    return { icon: FileVideo, bgColor: '#fdf4ff', color: '#a855f7' };
  }

  // Audio
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma'].includes(ext)) {
    return { icon: FileAudio, bgColor: '#fef3c7', color: '#d97706' };
  }

  // Archives
  if (['zip', 'rar', 'tar', 'gz', '7z', 'bz2', 'xz'].includes(ext)) {
    return { icon: FileArchive, bgColor: '#faf5ff', color: '#9333ea' };
  }

  // Default
  return { icon: File, bgColor: '#f3f4f6', color: '#6b7280' };
}

// Grid item component for grid view
interface FileGridItemProps {
  name: string;
  isDirectory: boolean;
  thumbnailUrl?: string | null;
  isTenant?: boolean;
}

export function FileGridIcon({ name, isDirectory, thumbnailUrl, isTenant = false }: FileGridItemProps) {
  // Show thumbnail for images
  if (!isDirectory && thumbnailUrl && isImageFile(name)) {
    return (
      <div className="w-20 h-20 overflow-hidden bg-surface-secondary border border-border">
        <img
          src={thumbnailUrl}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  const { icon: IconComponent, bgColor, color } = getIconConfig(name, isDirectory, isTenant);

  return (
    <div
      className="w-20 h-20 flex items-center justify-center"
      style={{ backgroundColor: bgColor }}
    >
      <IconComponent className="w-10 h-10" style={{ color }} />
    </div>
  );
}
