import { useState, useEffect } from 'react';
import { RefreshCw, Image, Database } from 'lucide-react';
import Modal from '../components/Modal';
import Button from '../components/Button';
import { useModal, useApp } from '../store';
import type { CacheStatus, ThumbnailStatus } from '../types';
import * as api from '../api';

export default function SettingsModal() {
  const { activeModal, closeModal } = useModal();
  const { showToast } = useApp();

  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [thumbStatus, setThumbStatus] = useState<ThumbnailStatus | null>(null);
  const [isRebuildingCache, setIsRebuildingCache] = useState(false);
  const [isGeneratingThumbs, setIsGeneratingThumbs] = useState(false);
  const [isSyncingThumbs, setIsSyncingThumbs] = useState(false);

  const isOpen = activeModal === 'settings';

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  const loadStatus = async () => {
    try {
      const [cache, thumb] = await Promise.all([
        api.getCacheStatus(),
        api.getThumbnailStatus(),
      ]);
      setCacheStatus(cache);
      setThumbStatus(thumb);
    } catch {
      // Ignore errors
    }
  };

  const handleRebuildCache = async () => {
    setIsRebuildingCache(true);
    try {
      await api.rebuildCache();
      showToast('Cache rebuild started in background', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to rebuild cache', 'error');
    } finally {
      setIsRebuildingCache(false);
    }
  };

  const handleGenerateThumbnails = async () => {
    setIsGeneratingThumbs(true);
    try {
      await api.generateThumbnails();
      showToast('Thumbnail generation started in background', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to generate thumbnails', 'error');
    } finally {
      setIsGeneratingThumbs(false);
    }
  };

  const handleSyncThumbnails = async () => {
    setIsSyncingThumbs(true);
    try {
      await api.syncThumbnails();
      showToast('Thumbnail sync started in background', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to sync thumbnails', 'error');
    } finally {
      setIsSyncingThumbs(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Admin Settings"
      size="md"
    >
      <div className="space-y-6">
        {/* Cache Management */}
        <div className="p-4 bg-surface-secondary border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Cache Management</h3>
          </div>
          <p className="text-sm text-muted mb-4">
            Rebuild the file cache to sync with filesystem changes made outside the app.
          </p>

          {cacheStatus && (
            <div className="text-xs text-subtle mb-4 space-y-1">
              <p>Status: {cacheStatus.ready ? '✓ Ready' : '⏳ Initializing'}</p>
              <p>Files: {cacheStatus.totalFiles} | Folders: {cacheStatus.totalDirectories}</p>
              <p>Last sync: {new Date(cacheStatus.lastSync).toLocaleString()}</p>
            </div>
          )}

          <Button
            variant="primary"
            size="sm"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={handleRebuildCache}
            loading={isRebuildingCache}
          >
            Sync Cache
          </Button>
        </div>

        {/* Thumbnail Management */}
        <div className="p-4 bg-surface-secondary border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Image className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Thumbnail Management</h3>
          </div>
          <p className="text-sm text-muted mb-4">
            Generate thumbnails for all images or sync thumbnails (generate missing, remove orphaned).
          </p>

          {thumbStatus && (
            <div className="text-xs text-subtle mb-4 space-y-1">
              <p>Status: {thumbStatus.initialized ? '✓ Initialized' : '✗ Not initialized'}</p>
              <p>Size: {thumbStatus.thumbnailSize}x{thumbStatus.thumbnailSize} | Format: {thumbStatus.thumbnailFormat.toUpperCase()}</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<Image className="w-4 h-4" />}
              onClick={handleGenerateThumbnails}
              loading={isGeneratingThumbs}
            >
              Generate All
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={handleSyncThumbnails}
              loading={isSyncingThumbs}
            >
              Sync Thumbnails
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6 pt-4 border-t border-border">
        <Button variant="secondary" onClick={closeModal}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
