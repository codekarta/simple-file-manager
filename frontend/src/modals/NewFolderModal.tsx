import { useState, useActionState } from 'react';
import { FolderPlus } from 'lucide-react';
import Modal from '../components/Modal';
import Button from '../components/Button';
import Input from '../components/Input';
import { AccessToggle } from '../components/Toggle';
import { useFiles, useModal, useApp, useStorage } from '../store';
import * as api from '../api';

export default function NewFolderModal() {
  const { currentPath, loadFiles } = useFiles();
  const { activeModal, closeModal } = useModal();
  const { showToast, user, currentTenantId } = useApp();
  const { refreshStorageInfo } = useStorage();

  const [isPrivate, setIsPrivate] = useState(false);

  const isOpen = activeModal === 'newFolder';

  const handleClose = () => {
    setIsPrivate(false);
    closeModal();
  };

  const [, submitAction, isPending] = useActionState(
    async (_prevState: unknown, formData: FormData) => {
      const name = formData.get('name') as string;

      if (!name?.trim()) {
        showToast('Please enter a folder name', 'error');
        return;
      }

      try {
        // Determine tenantId
        let tenantId: string | null = currentTenantId;
        if (!tenantId && user?.tenantId) {
          tenantId = user.tenantId;
        }
        
        await api.createFolder(currentPath, name.trim(), isPrivate ? 'private' : 'public', tenantId);
        showToast(`Folder "${name}" created`, 'success');
        loadFiles(currentPath);
        refreshStorageInfo();
        handleClose();
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to create folder', 'error');
      }
    },
    null
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Folder"
      size="sm"
    >
      <form action={submitAction}>
        <div className="space-y-4">
          <Input
            name="name"
            label="Folder Name"
            placeholder="Enter folder name"
            autoFocus
            disabled={isPending}
            icon={<FolderPlus className="w-4 h-4" />}
          />

          <AccessToggle
            isPrivate={isPrivate}
            onChange={setIsPrivate}
            disabled={isPending}
          />

          <div className="text-xs text-subtle">
            Creating in: <span className="font-mono">/{currentPath || '(root)'}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
          <Button variant="secondary" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isPending}>
            Create Folder
          </Button>
        </div>
      </form>
    </Modal>
  );
}
