import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Image,
  Calendar,
  HardDrive,
  FileType,
  Info,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useFiles, useModal, useApp } from '../store';
import { formatFileSize, formatDateTime, isImageFile, isVideoFile, cn } from '../utils';
import * as api from '../api';
import type { FileItem } from '../types';

export default function SlideshowModal() {
  const { optimisticFiles } = useFiles();
  const { activeModal, closeModal, modalData } = useModal();
  const { currentTenantId } = useApp();

  // Get initial index from modal data if provided
  const initialIndex = (modalData as { initialIndex?: number } | undefined)?.initialIndex ?? 0;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isOpen = activeModal === 'slideshow';

  // Filter image and video files
  const mediaFiles = optimisticFiles.filter(
    (file) => !file.isDirectory && (isImageFile(file.name) || isVideoFile(file.name))
  );

  const currentFile = mediaFiles[currentIndex];
  const hasMedia = mediaFiles.length > 0;
  const isVideo = currentFile ? isVideoFile(currentFile.name) : false;

  // Navigation
  const goToNext = useCallback(() => {
    if (mediaFiles.length > 0) {
      // Pause video if playing
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setImageLoaded(false);
      setImageError(false);
      setCurrentIndex((prev) => (prev + 1) % mediaFiles.length);
    }
  }, [mediaFiles.length]);

  const goToPrev = useCallback(() => {
    if (mediaFiles.length > 0) {
      // Pause video if playing
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setImageLoaded(false);
      setImageError(false);
      setCurrentIndex((prev) => (prev - 1 + mediaFiles.length) % mediaFiles.length);
    }
  }, [mediaFiles.length]);

  const goToIndex = useCallback((index: number) => {
    setImageLoaded(false);
    setImageError(false);
    setCurrentIndex(index);
  }, []);

  // Auto-play for images (videos handle their own playback)
  useEffect(() => {
    // Only auto-advance for images, not videos
    if (isPlaying && hasMedia && !isVideo) {
      intervalRef.current = setInterval(goToNext, 3000); // 3 seconds per image
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, hasMedia, isVideo, goToNext]);

  // Handle video playback when slideshow play/pause is toggled
  useEffect(() => {
    if (!isVideo || !videoRef.current) return;

    if (isPlaying) {
      videoRef.current.play().catch(() => {
        // Auto-play may be blocked by browser
        setIsPlaying(false);
      });
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, isVideo]);

  // Auto-play video when navigating to it (if slideshow is playing)
  useEffect(() => {
    if (isVideo && videoRef.current && isPlaying) {
      videoRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    } else if (isVideo && videoRef.current && !isPlaying) {
      videoRef.current.pause();
    }
  }, [currentIndex, isVideo, isPlaying]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNext();
          break;
        case ' ':
          e.preventDefault();
          if (isVideo && videoRef.current) {
            // For videos, toggle video playback directly
            if (videoRef.current.paused) {
              videoRef.current.play().catch(() => { });
              setIsPlaying(true);
            } else {
              videoRef.current.pause();
              setIsPlaying(false);
            }
          } else {
            // For images, toggle slideshow auto-play
            setIsPlaying((prev) => !prev);
          }
          break;
        case 'Escape':
          if (isFullscreen) {
            document.exitFullscreen?.();
          } else {
            closeModal();
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'i':
        case 'I':
          e.preventDefault();
          setShowDetails((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToNext, goToPrev, closeModal, isFullscreen]);

  // Reset on close or update index when modal opens with new initialIndex
  useEffect(() => {
    if (!isOpen) {
      setCurrentIndex(0);
      setIsPlaying(false);
      setImageLoaded(false);
      setImageError(false);
    } else if (initialIndex !== undefined && initialIndex >= 0 && initialIndex < mediaFiles.length) {
      // Set initial index when modal opens
      setCurrentIndex(initialIndex);
      setImageLoaded(false);
      setImageError(false);
    }
  }, [isOpen, initialIndex, mediaFiles.length]);

  // Fullscreen handling
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Get image URL using API utility for consistent behavior
  const getImageUrl = (file: FileItem) => {
    // If it's a search result, the path might be different than expected
    // We should rely on standard API URL generation
    // Use file's tenantId if available (e.g. from search), otherwise use current context
    const effectiveTenantId = file.tenantId || currentTenantId;

    // For super admin search results, the path might be prefixed with "tenantId:" 
    // We need to strip this prefix to get the actual file path
    // Use regex to replace "tenantId:" pattern at the start of the string
    let filePath = file.path;
    if (file.tenantId) {
      const prefixRegex = new RegExp(`^${file.tenantId}:`);
      filePath = filePath.replace(prefixRegex, '');
    }

    return api.getFileUrl(filePath, effectiveTenantId);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/80 text-white">
          <div className="flex items-center gap-4">
            <button
              onClick={closeModal}
              className="p-2 hover:bg-white/10 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              <span className="font-medium">
                {hasMedia
                  ? `${currentIndex + 1} of ${mediaFiles.length}`
                  : 'No media'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={cn(
                'p-2 transition-colors',
                isPlaying ? 'bg-primary text-white' : 'hover:bg-white/10'
              )}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5" />
              )}
            </button>

            {/* Toggle details */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className={cn(
                'p-2 transition-colors',
                showDetails ? 'bg-white/20' : 'hover:bg-white/10'
              )}
              title="Toggle details (I)"
            >
              <Info className="w-5 h-5" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-white/10 transition-colors"
              title="Fullscreen (F)"
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden">
          {hasMedia ? (
            <>
              {/* Previous button */}
              <button
                onClick={goToPrev}
                className="absolute left-4 z-10 p-3 bg-black/50 hover:bg-black/70 text-white transition-colors"
                title="Previous (←)"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>

              {/* Media (Image or Video) */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-full max-h-full flex items-center justify-center p-4"
                >
                  {isVideo ? (
                    <>
                      {!imageLoaded && !imageError && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                      )}
                      {imageError ? (
                        <div className="flex flex-col items-center justify-center text-white/60 p-8">
                          <Image className="w-16 h-16 mb-4 opacity-50" />
                          <p className="text-lg">Failed to load video</p>
                          <p className="text-sm mt-2 text-white/40">{currentFile.name}</p>
                        </div>
                      ) : (
                        <video
                          ref={videoRef}
                          src={getImageUrl(currentFile)}
                          className={cn(
                            'max-w-full max-h-[calc(100vh-200px)] object-contain transition-opacity duration-300',
                            imageLoaded ? 'opacity-100' : 'opacity-0'
                          )}
                          controls
                          playsInline
                          onLoadedData={() => setImageLoaded(true)}
                          onError={() => {
                            setImageLoaded(true);
                            setImageError(true);
                          }}
                          onEnded={() => {
                            // Auto-advance to next when video ends
                            if (isPlaying) {
                              goToNext();
                            }
                          }}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      {!imageLoaded && !imageError && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                      )}
                      {imageError ? (
                        <div className="flex flex-col items-center justify-center text-white/60 p-8">
                          <Image className="w-16 h-16 mb-4 opacity-50" />
                          <p className="text-lg">Failed to load image</p>
                          <p className="text-sm mt-2 text-white/40">{currentFile.name}</p>
                        </div>
                      ) : (
                        <img
                          src={getImageUrl(currentFile)}
                          alt={currentFile.name}
                          className={cn(
                            'max-w-full max-h-[calc(100vh-200px)] object-contain transition-opacity duration-300',
                            imageLoaded ? 'opacity-100' : 'opacity-0'
                          )}
                          onLoad={() => setImageLoaded(true)}
                          onError={() => {
                            setImageLoaded(true);
                            setImageError(true);
                          }}
                        />
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Next button */}
              <button
                onClick={goToNext}
                className="absolute right-4 z-10 p-3 bg-black/50 hover:bg-black/70 text-white transition-colors"
                title="Next (→)"
              >
                <ChevronRight className="w-8 h-8" />
              </button>

              {/* Progress dots */}
              {mediaFiles.length <= 20 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                  {mediaFiles.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToIndex(index)}
                      className={cn(
                        'w-2 h-2 rounded-full transition-all',
                        index === currentIndex
                          ? 'bg-white w-4'
                          : 'bg-white/40 hover:bg-white/60'
                      )}
                    />
                  ))}
                </div>
              )}

              {/* Progress bar for many media files */}
              {mediaFiles.length > 20 && (
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-white"
                      initial={false}
                      animate={{ width: `${((currentIndex + 1) / mediaFiles.length) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-white/60">
              <Image className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No media files in this folder</p>
              <p className="text-sm mt-2">Upload some images or videos to start a slideshow</p>
            </div>
          )}
        </div>

        {/* Details panel - compact single row */}
        <AnimatePresence>
          {showDetails && currentFile && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-black/80 border-t border-white/10 px-4 py-2"
            >
              <div className="flex items-center gap-3 text-sm overflow-x-auto">
                {/* Filename */}
                <span className="text-white font-medium truncate max-w-[200px] sm:max-w-[300px]" title={currentFile.name}>
                  {currentFile.name}
                </span>

                <span className="text-white/20">|</span>

                {/* Size */}
                <span className="flex items-center gap-1.5 text-white/70 whitespace-nowrap">
                  <HardDrive className="w-3.5 h-3.5 text-white/40" />
                  {formatFileSize(currentFile.size)}
                </span>

                <span className="text-white/20 hidden sm:inline">|</span>

                {/* Type */}
                <span className="hidden sm:flex items-center gap-1.5 text-white/70 whitespace-nowrap">
                  <FileType className="w-3.5 h-3.5 text-white/40" />
                  {currentFile.name.split('.').pop()?.toUpperCase()}
                </span>

                <span className="text-white/20 hidden md:inline">|</span>

                {/* Date */}
                <span className="hidden md:flex items-center gap-1.5 text-white/70 whitespace-nowrap">
                  <Calendar className="w-3.5 h-3.5 text-white/40" />
                  {formatDateTime(currentFile.modified)}
                </span>

                <span className="text-white/20">|</span>

                {/* Access level */}
                <span className={cn(
                  'px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                  currentFile.accessLevel === 'private'
                    ? 'bg-red-500/20 text-red-300'
                    : 'bg-green-500/20 text-green-300'
                )}>
                  {currentFile.accessLevel?.toUpperCase() || 'PUBLIC'}
                </span>

                {/* Path - hidden on mobile */}
                <span className="hidden lg:block text-xs text-white/40 font-mono truncate ml-auto" title={currentFile.path}>
                  /{currentFile.path}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thumbnail strip */}
        {hasMedia && mediaFiles.length > 1 && mediaFiles.length <= 50 && (
          <div className="bg-black/80 border-t border-white/10 p-2 overflow-x-auto">
            <div className="flex gap-2 justify-center min-w-max">
              {mediaFiles.map((file, index) => {
                const isVideoThumb = isVideoFile(file.name);
                return (
                  <button
                    key={file.path}
                    onClick={() => goToIndex(index)}
                    className={cn(
                      'relative w-16 h-12 shrink-0 overflow-hidden transition-all',
                      index === currentIndex
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-black'
                        : 'opacity-50 hover:opacity-100'
                    )}
                  >
                    {isVideoThumb ? (
                      <div className="w-full h-full bg-black/50 flex items-center justify-center">
                        <Play className="w-6 h-6 text-white/60" />
                      </div>
                    ) : (
                      <img
                        src={file.thumbnailUrl || getImageUrl(file)}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Keyboard shortcuts hint */}
        <div className="absolute bottom-2 right-4 text-white/30 text-xs hidden sm:block">
          ← → Navigate • Space Play/Pause • F Fullscreen • I Details • Esc Close
        </div>
      </motion.div>
    </AnimatePresence>
  );
}




