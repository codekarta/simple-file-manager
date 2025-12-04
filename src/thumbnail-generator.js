import sharp from 'sharp';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

// Configuration
const THUMBNAIL_SIZE = 300; // 300x300 pixels
const THUMBNAIL_FORMAT = 'webp';
const THUMBNAIL_QUALITY = 80;

// Supported image extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.bmp'];

// State
let uploadsPath = null;
let thumbnailBasePath = null;

/**
 * Initialize the thumbnail generator
 * @param {string} uploadDir - The uploads directory path
 * @param {string} thumbnailDir - The thumbnail directory path (defaults to .thumbnail next to uploads)
 */
export function initialize(uploadDir, thumbnailDir = null) {
  uploadsPath = uploadDir;
  
  // Default thumbnail directory is .thumbnail at project root
  if (thumbnailDir) {
    thumbnailBasePath = thumbnailDir;
  } else {
    // Place .thumbnail as sibling to uploads directory
    const parentDir = path.dirname(uploadDir);
    thumbnailBasePath = path.join(parentDir, '.thumbnail');
  }
  
  // Ensure thumbnail directory exists
  if (!existsSync(thumbnailBasePath)) {
    mkdirSync(thumbnailBasePath, { recursive: true });
    console.log(`   📸 Thumbnail directory created: ${thumbnailBasePath}`);
  }
  
  console.log(`\n📸 Thumbnail Generator:`);
  console.log(`   Directory: ${thumbnailBasePath}`);
  console.log(`   Size: ${THUMBNAIL_SIZE}x${THUMBNAIL_SIZE}`);
  console.log(`   Format: ${THUMBNAIL_FORMAT.toUpperCase()}`);
}

/**
 * Check if a file is an image based on extension
 * @param {string} filename - The filename to check
 * @returns {boolean}
 */
export function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Get the thumbnail path for a given file path
 * @param {string} relativePath - Relative path to the original file
 * @returns {string} Path to the thumbnail file
 */
export function getThumbnailPath(relativePath) {
  const dir = path.dirname(relativePath);
  const basename = path.basename(relativePath, path.extname(relativePath));
  const thumbnailName = `${basename}.${THUMBNAIL_FORMAT}`;
  return path.join(dir, thumbnailName);
}

/**
 * Get the full thumbnail filesystem path
 * @param {string} relativePath - Relative path to the original file
 * @returns {string} Full filesystem path to the thumbnail
 */
export function getThumbnailFullPath(relativePath) {
  const thumbnailRelPath = getThumbnailPath(relativePath);
  return path.join(thumbnailBasePath, thumbnailRelPath);
}

/**
 * Get the thumbnail URL for a file
 * @param {string} relativePath - Relative path to the original file
 * @returns {string|null} URL path or null if not an image
 */
export function getThumbnailUrl(relativePath) {
  if (!isImageFile(relativePath)) {
    return null;
  }
  const thumbnailRelPath = getThumbnailPath(relativePath);
  return `/thumb/${thumbnailRelPath}`;
}

/**
 * Generate a thumbnail for an image
 * @param {string} relativePath - Relative path to the image in uploads
 * @returns {Promise<boolean>} Success status
 */
export async function generateThumbnail(relativePath) {
  if (!uploadsPath || !thumbnailBasePath) {
    console.warn('Thumbnail generator not initialized');
    return false;
  }
  
  if (!isImageFile(relativePath)) {
    return false;
  }
  
  const sourcePath = path.join(uploadsPath, relativePath);
  const thumbnailPath = getThumbnailFullPath(relativePath);
  
  try {
    // Ensure thumbnail directory exists
    const thumbnailDir = path.dirname(thumbnailPath);
    if (!existsSync(thumbnailDir)) {
      await fs.mkdir(thumbnailDir, { recursive: true });
    }
    
    // Generate thumbnail using sharp
    await sharp(sourcePath)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: THUMBNAIL_QUALITY })
      .toFile(thumbnailPath);
    
    return true;
  } catch (error) {
    console.error(`Failed to generate thumbnail for ${relativePath}:`, error.message);
    return false;
  }
}

/**
 * Delete a thumbnail
 * @param {string} relativePath - Relative path to the original image
 * @returns {Promise<boolean>} Success status
 */
export async function deleteThumbnail(relativePath) {
  if (!thumbnailBasePath) {
    return false;
  }
  
  const thumbnailPath = getThumbnailFullPath(relativePath);
  
  try {
    if (existsSync(thumbnailPath)) {
      await fs.unlink(thumbnailPath);
      
      // Try to clean up empty parent directories
      await cleanupEmptyDirs(path.dirname(thumbnailPath));
      
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Failed to delete thumbnail for ${relativePath}:`, error.message);
    return false;
  }
}

/**
 * Delete thumbnails for a directory (recursive)
 * @param {string} relativePath - Relative path to the directory
 * @returns {Promise<boolean>} Success status
 */
export async function deleteThumbnailDirectory(relativePath) {
  if (!thumbnailBasePath) {
    return false;
  }
  
  const thumbnailDirPath = path.join(thumbnailBasePath, relativePath);
  
  try {
    if (existsSync(thumbnailDirPath)) {
      await fs.rm(thumbnailDirPath, { recursive: true, force: true });
      
      // Try to clean up empty parent directories
      await cleanupEmptyDirs(path.dirname(thumbnailDirPath));
      
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Failed to delete thumbnail directory for ${relativePath}:`, error.message);
    return false;
  }
}

/**
 * Rename/move a thumbnail
 * @param {string} oldRelativePath - Old relative path
 * @param {string} newRelativePath - New relative path
 * @returns {Promise<boolean>} Success status
 */
export async function renameThumbnail(oldRelativePath, newRelativePath) {
  if (!thumbnailBasePath) {
    return false;
  }
  
  // Only process if both are images
  if (!isImageFile(oldRelativePath) || !isImageFile(newRelativePath)) {
    return false;
  }
  
  const oldThumbnailPath = getThumbnailFullPath(oldRelativePath);
  const newThumbnailPath = getThumbnailFullPath(newRelativePath);
  
  try {
    if (existsSync(oldThumbnailPath)) {
      // Ensure new directory exists
      const newDir = path.dirname(newThumbnailPath);
      if (!existsSync(newDir)) {
        await fs.mkdir(newDir, { recursive: true });
      }
      
      await fs.rename(oldThumbnailPath, newThumbnailPath);
      
      // Clean up empty old directories
      await cleanupEmptyDirs(path.dirname(oldThumbnailPath));
      
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Failed to rename thumbnail from ${oldRelativePath} to ${newRelativePath}:`, error.message);
    return false;
  }
}

/**
 * Rename/move thumbnails for a directory
 * @param {string} oldRelativePath - Old relative directory path
 * @param {string} newRelativePath - New relative directory path
 * @returns {Promise<boolean>} Success status
 */
export async function renameThumbnailDirectory(oldRelativePath, newRelativePath) {
  if (!thumbnailBasePath) {
    return false;
  }
  
  const oldThumbnailDir = path.join(thumbnailBasePath, oldRelativePath);
  const newThumbnailDir = path.join(thumbnailBasePath, newRelativePath);
  
  try {
    if (existsSync(oldThumbnailDir)) {
      // Ensure parent of new directory exists
      const newParentDir = path.dirname(newThumbnailDir);
      if (!existsSync(newParentDir)) {
        await fs.mkdir(newParentDir, { recursive: true });
      }
      
      await fs.rename(oldThumbnailDir, newThumbnailDir);
      
      // Clean up empty old parent directories
      await cleanupEmptyDirs(path.dirname(oldThumbnailDir));
      
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Failed to rename thumbnail directory from ${oldRelativePath} to ${newRelativePath}:`, error.message);
    return false;
  }
}

/**
 * Clean up empty directories recursively up to thumbnail base
 * @param {string} dirPath - Directory to start cleaning from
 */
async function cleanupEmptyDirs(dirPath) {
  if (!thumbnailBasePath || !dirPath.startsWith(thumbnailBasePath) || dirPath === thumbnailBasePath) {
    return;
  }
  
  try {
    const items = await fs.readdir(dirPath);
    if (items.length === 0) {
      await fs.rmdir(dirPath);
      // Recursively check parent
      await cleanupEmptyDirs(path.dirname(dirPath));
    }
  } catch (error) {
    // Ignore errors (directory might not be empty or already deleted)
  }
}

/**
 * Check if a thumbnail exists for a file
 * @param {string} relativePath - Relative path to the original file
 * @returns {boolean}
 */
export function thumbnailExists(relativePath) {
  if (!thumbnailBasePath || !isImageFile(relativePath)) {
    return false;
  }
  return existsSync(getThumbnailFullPath(relativePath));
}

/**
 * Generate thumbnails for all images in a directory (recursive)
 * @param {string} relativePath - Relative path to scan (empty for root)
 * @param {function} progressCallback - Optional callback for progress updates
 * @returns {Promise<{generated: number, skipped: number, failed: number}>}
 */
export async function generateAllThumbnails(relativePath = '', progressCallback = null) {
  if (!uploadsPath || !thumbnailBasePath) {
    throw new Error('Thumbnail generator not initialized');
  }
  
  const stats = { generated: 0, skipped: 0, failed: 0 };
  
  async function scanDir(dirPath) {
    const fullPath = dirPath ? path.join(uploadsPath, dirPath) : uploadsPath;
    
    try {
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isSymbolicLink()) continue;
        
        const itemRelPath = dirPath ? `${dirPath}/${item.name}` : item.name;
        
        if (item.isDirectory()) {
          await scanDir(itemRelPath);
        } else if (isImageFile(item.name)) {
          // Check if thumbnail already exists
          if (thumbnailExists(itemRelPath)) {
            stats.skipped++;
          } else {
            const success = await generateThumbnail(itemRelPath);
            if (success) {
              stats.generated++;
              if (progressCallback) {
                progressCallback({ type: 'generated', path: itemRelPath });
              }
            } else {
              stats.failed++;
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${fullPath}:`, error.message);
    }
  }
  
  await scanDir(relativePath);
  return stats;
}

/**
 * Sync thumbnails - generate missing and remove orphaned thumbnails
 * @returns {Promise<{generated: number, deleted: number, failed: number}>}
 */
export async function syncThumbnails() {
  if (!uploadsPath || !thumbnailBasePath) {
    throw new Error('Thumbnail generator not initialized');
  }
  
  const stats = { generated: 0, deleted: 0, failed: 0 };
  
  // First, generate missing thumbnails
  const generateStats = await generateAllThumbnails();
  stats.generated = generateStats.generated;
  stats.failed = generateStats.failed;
  
  // Then, remove orphaned thumbnails
  async function findOrphans(thumbnailDir, uploadDir, relativePath = '') {
    if (!existsSync(thumbnailDir)) return;
    
    try {
      const items = await fs.readdir(thumbnailDir, { withFileTypes: true });
      
      for (const item of items) {
        const itemRelPath = relativePath ? `${relativePath}/${item.name}` : item.name;
        const thumbnailFullPath = path.join(thumbnailDir, item.name);
        
        if (item.isDirectory()) {
          const correspondingUploadDir = path.join(uploadDir, item.name);
          
          // If upload directory doesn't exist, remove entire thumbnail directory
          if (!existsSync(correspondingUploadDir)) {
            try {
              await fs.rm(thumbnailFullPath, { recursive: true, force: true });
              stats.deleted++;
            } catch (e) {
              stats.failed++;
            }
          } else {
            // Recursively check subdirectory
            await findOrphans(thumbnailFullPath, correspondingUploadDir, itemRelPath);
          }
        } else {
          // It's a thumbnail file - check if original exists
          // Thumbnail is name.webp, original could be name.jpg, name.png, etc.
          const basename = path.basename(item.name, `.${THUMBNAIL_FORMAT}`);
          
          // Check if any original image with this basename exists
          let originalExists = false;
          for (const ext of IMAGE_EXTENSIONS) {
            const possibleOriginal = path.join(uploadDir, `${basename}${ext}`);
            if (existsSync(possibleOriginal)) {
              originalExists = true;
              break;
            }
          }
          
          if (!originalExists) {
            try {
              await fs.unlink(thumbnailFullPath);
              stats.deleted++;
            } catch (e) {
              stats.failed++;
            }
          }
        }
      }
      
      // Clean up empty directory
      await cleanupEmptyDirs(thumbnailDir);
    } catch (error) {
      console.error(`Error scanning thumbnail directory ${thumbnailDir}:`, error.message);
    }
  }
  
  await findOrphans(thumbnailBasePath, uploadsPath);
  
  return stats;
}

/**
 * Get the thumbnail base path
 * @returns {string|null}
 */
export function getThumbnailBasePath() {
  return thumbnailBasePath;
}

/**
 * Get thumbnail generator status
 * @returns {Object}
 */
export function getStatus() {
  return {
    initialized: uploadsPath !== null && thumbnailBasePath !== null,
    uploadsPath,
    thumbnailBasePath,
    thumbnailSize: THUMBNAIL_SIZE,
    thumbnailFormat: THUMBNAIL_FORMAT,
    thumbnailQuality: THUMBNAIL_QUALITY,
    supportedExtensions: IMAGE_EXTENSIONS
  };
}

export default {
  initialize,
  isImageFile,
  getThumbnailPath,
  getThumbnailFullPath,
  getThumbnailUrl,
  generateThumbnail,
  deleteThumbnail,
  deleteThumbnailDirectory,
  renameThumbnail,
  renameThumbnailDirectory,
  thumbnailExists,
  generateAllThumbnails,
  syncThumbnails,
  getThumbnailBasePath,
  getStatus
};
