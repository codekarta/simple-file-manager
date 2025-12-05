import { useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import { useFiles, useModal, useApp, useStorage } from '../store';
import type { DeleteData } from '../types';
import * as api from '../api';

export default function DeleteModal() {
  const { currentPath, loadFiles, deleteFileOptimistic } = useFiles();
  const { activeModal, modalData, closeModal } = useModal();
  const { showToast } = useApp();
  const { refreshStorageInfo } = useStorage();

  const [isDeleting, setIsDeleting] = useState(false);

  const isOpen = activeModal === 'delete';
  const data = modalData as DeleteData | undefined;

  const handleDelete = async () => {
    if (!data?.paths?.length) return;

    setIsDeleting(true);

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const path of data.paths) {
        try {
          // Optimistic update
          deleteFileOptimistic(path);
          await api.deleteItem(path);
          successCount++;
        } catch {
          errorCount++;
        }
      }

      if (errorCount === 0) {
        showToast(`Deleted ${successCount} item(s)`, 'success');
      } else {
        showToast(`Deleted ${successCount}, failed ${errorCount}`, 'error');
      }

      loadFiles(currentPath);
      refreshStorageInfo();
      closeModal();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Delete failed', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const itemCount = data?.paths?.length || 0;
  const itemNames = data?.names?.slice(0, 3).join(', ') || '';
  const moreCount = itemCount > 3 ? ` and ${itemCount - 3} more` : '';

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={closeModal}
      onConfirm={handleDelete}
      title={`Delete ${itemCount} item(s)?`}
      message={`Are you sure you want to delete "${itemNames}"${moreCount}?\n\nThis action cannot be undone.`}
      confirmText="Delete"
      variant="danger"
      loading={isDeleting}
    />
  );
}
